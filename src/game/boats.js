import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BOATS } from './gear.js';

// Player boats: the Blender-built GLB on a buoyant rigid body (scene/floaters.js), with
// throttle + rudder forces. Hull dims mirror tools/blender/build_boats.py.
const HULLS = {
  jon: { length: 3.8, beam: 1.55, depth: 0.55, deckDrop: 0.42, sheer: 0.2, draft: 0.17 },
  bass: { length: 6.2, beam: 2.35, depth: 0.78, deckDrop: 0.18, sheer: 0.12, draft: 0.32 },
  skiff: { length: 5.6, beam: 2.1, depth: 0.62, deckDrop: 0.2, sheer: 0.14, draft: 0.3 },
  center: { length: 8.6, beam: 2.8, depth: 1.35, deckDrop: 0.75, sheer: 0.16, draft: 0.34 },
  sport: { length: 14.0, beam: 4.6, depth: 2.5, deckDrop: 0.95, sheer: 0.2, draft: 0.38 },
  trawler: { length: 20.0, beam: 6.4, depth: 3.4, deckDrop: 1.1, sheer: 0.24, draft: 0.45 },
  seiner: { length: 26.0, beam: 8.0, depth: 3.9, deckDrop: 1.2, sheer: 0.26, draft: 0.45 },
};
const RHO = 1025;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function deckHeight(id, x) {
  const h = HULLS[id];
  const t = Math.min(1, Math.max(0, (x + h.length / 2) / h.length));
  const sheer = h.depth * (1 + h.sheer * Math.pow(sm(0.35, 1, t), 1.5));
  return sheer - h.deckDrop * (1 - 0.6 * sm(0.75, 1, t)) - h.depth / 2;   // relative to body origin (mid-depth)
}

const loader = new GLTFLoader();
const cache = new Map();
function loadModel(id) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(`${import.meta.env.BASE_URL}models/boats/${id}.glb`));
  return cache.get(id);
}

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion();

export class PlayerBoat {
  constructor(id) {
    this.id = id;
    this.spec = BOATS[id];
    this.hull = HULLS[id];
    this.control = { throttle: 0, steer: 0 };
    this.body = null;
    this.speed = 0;
    this.wakeTimer = 0;
    this.rough = 0;                       // 0..1 squall roughness (set by the game)
    this.gust = { x: 0, z: 0 };           // squall wind direction
    this.gustT = Math.random() * 100;
  }

  async create(floaters, patchProp, pos, yaw) {
    const gltf = await loadModel(this.id);
    const h = this.hull;
    const model = gltf.scene.clone(true);
    model.position.y = -h.depth / 2;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      patchProp(o.material, this.id === 'jon' ? 'boat' : 'prop');
      o.receiveShadow = this.id !== 'jon';   // coarse sun-shadow map blotches a boat this small
      o.castShadow = false;
      o.layers.enable(1);
    });
    const object = new THREE.Group();
    object.add(model);
    object.name = 'player-boat';

    const volume = h.length * h.beam * h.depth * 0.55;
    const samples = [];
    for (let i = 0; i < 6; i++) {
      const t = 0.08 + (i / 5) * 0.8;
      const half = t < 0.55 ? 0.85 + 0.15 * Math.sin((t / 0.55) * Math.PI / 2) : Math.max(0.15, Math.pow(1 - Math.pow((t - 0.55) / 0.45, 1.9), 0.62));
      for (const s of [-1, 1]) samples.push(new THREE.Vector3(-h.length / 2 + h.length * t, 0, s * h.beam * 0.32 * half));
    }
    const desc = {
      kind: 'boat-' + this.id, object, size: new THREE.Vector3(h.length, h.depth, h.beam),
      volume, density: RHO * h.draft, samples, cellHeight: h.depth,
      dragScale: 0.12,
      extraForce: (b, force, torque) => this.forces(b, force, torque),
    };
    this.body = floaters.addDesc(desc, new THREE.Vector3(pos.x, 0, pos.z), yaw);
    this.body.keep = true;
    return this;
  }

  forces(b, force, torque) {
    const c = this.control, s = this.spec, m = b.mass;
    const fwd = _f.set(1, 0, 0).applyQuaternion(b.quat).setY(0).normalize();
    const right = _r.set(-fwd.z, 0, fwd.x);
    const vF = b.vel.dot(fwd), vL = b.vel.dot(right);
    if (b.wet) {
      let a = 0;
      if (c.throttle > 0) a = s.accel * c.throttle * Math.max(0, 1 - vF / s.speed) * 1.6;
      else if (c.throttle < 0) a = s.accel * c.throttle * 0.5 * Math.max(0, 1 + vF / (s.speed * 0.3));
      force.addScaledVector(fwd, m * a);
      // hull drag (quadratic) + keel resisting sideways slip
      force.addScaledVector(fwd, -m * vF * Math.abs(vF) * 0.006 - m * vF * 0.04);
      force.addScaledVector(right, -m * vL * 1.2);
      // rudder: aim for a yaw rate, scaled by speed through the water
      const authority = Math.min(1, 0.25 + Math.abs(vF) / 4) * Math.sign(vF || 1);
      const want = -c.steer * s.turn * authority;
      const Iy = 1 / b.invInertia.y;
      torque.y += (want - b.angVel.y) * Iy * 2.5;
      // squall: gusts shove the hull downwind and slew it about, so it fights the helm
      if (this.rough > 0) {
        const r = this.rough, g = 0.55 + 0.45 * Math.sin(this.gustT * 1.3) * Math.sin(this.gustT * 0.47 + 1);
        force.x += this.gust.x * m * 1.1 * r * g;
        force.z += this.gust.z * m * 1.1 * r * g;
        torque.y += Math.sin(this.gustT * 0.9 + 2) * Iy * 0.9 * r;
      }
      // a little bow lift when on the throttle
      const bowUp = new THREE.Vector3(0, 0, 1).applyQuaternion(b.quat);
      torque.addScaledVector(bowUp, Math.min(1, Math.abs(vF) / s.speed) * 0.04 * m * this.hull.length * (vF > 0 ? 1 : 0));
    }
  }

  // river current pushes the hull
  update(dt, floaters, current) {
    if (!this.body) return;
    const b = this.body;
    this.gustT += dt;
    if (current && (current[0] || current[1])) {
      b.vel.x += (current[0] - b.vel.x) * 0.02 * dt * 10 * (this.control.throttle ? 0 : 1);
      b.vel.z += (current[1] - b.vel.z) * 0.02 * dt * 10 * (this.control.throttle ? 0 : 1);
    }
    const fwd = _f.set(1, 0, 0).applyQuaternion(b.quat).setY(0).normalize();
    this.speed = b.vel.dot(fwd);
    // wake: ripple rings + spray off the stern while under way
    this.wakeTimer -= dt;
    if (Math.abs(this.speed) > 2.5 && this.wakeTimer <= 0) {
      this.wakeTimer = THREE.MathUtils.clamp(2.2 / Math.abs(this.speed), 0.12, 0.6);
      const stern = new THREE.Vector3(-this.hull.length * 0.5, 0, 0).applyQuaternion(b.quat).add(b.pos);
      floaters.impacts.push({ x: stern.x, z: stern.z, t: floaters.time, amp: Math.min(0.12, 0.012 * Math.abs(this.speed)), size: this.hull.beam * 0.5 });
      if (floaters.impacts.length > 8) floaters.impacts.shift();
    }
  }

  get position() { return this.body.pos; }
  get quaternion() { return this.body.quat; }
  heading() {
    const f = _f.set(1, 0, 0).applyQuaternion(this.body.quat);
    return Math.atan2(-f.z, f.x);
  }

  // world-space standing point for the first-person camera
  eyeWorld(out) {
    const x = this.spec.eye;
    out.set(x, deckHeight(this.id, x) + 1.68 + (this.spec.eyeUp || 0), 0).applyQuaternion(this.body.quat).add(this.body.pos);
    return out;
  }

  // rod tip world position helper: a point on the boat in local coords
  toWorld(local, out) {
    return out.copy(local).applyQuaternion(this.body.quat).add(this.body.pos);
  }

  dispose(floaters) {
    if (this.body) floaters.remove(this.body);
    this.body = null;
  }
}

export function boatYawQuat(b, out = _q) {
  const f = _f.set(1, 0, 0).applyQuaternion(b.quat);
  return out.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-f.z, f.x));
}

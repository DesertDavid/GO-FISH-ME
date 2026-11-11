import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FEEL } from './fightFeel.js';

// The stylised "jellybean" angler (public/models/jellybean.glb, tools/blender/build_jellybean.py): one capsule for body and
// head, capsule limbs, ball hands, boots, a sou'wester. A hierarchy of joints with rigid meshes, built facing +Z (+X = its
// left, like the rod handle frame). Two users:
//   - hands3.js (first person): the same model with the body hidden, its two arms reaching onto the rod and crank;
//   - PlayerBody (third person): the whole figure standing / walking / sitting at the helm, arms on the same rod.
// Arms are solved with two-bone IK onto world-space targets (the rod's grip and the real crank `knob` anchor).
const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
const loader = new GLTFLoader().setDRACOLoader(draco);
export const GRIP_Z = 0.09;                     // where the right ball sits on the handle axis: the foregrip ahead of the reel seat
export const BODY_SCALE = 1.2;                 // model eye is 1.40 m; the game's eye is 1.68 m
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.55 });
// a faint warm rim so the silhouette separates from dark water and bright sky
MAT.onBeforeCompile = (sh) => {
  const rim = ['float jRim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.6);',
    'outgoingLight += jRim * vec3(0.95, 0.88, 0.72) * 0.16;', '#include <opaque_fragment>'].join(String.fromCharCode(10));
  sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', rim);
};
let srcP = null;

export function loadJelly() {
  if (!srcP) {
    srcP = loader.loadAsync(`${import.meta.env.BASE_URL}models/jellybean.glb`).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.material = MAT; o.frustumCulled = false; } });
      return g.scene;
    });
  }
  return srcP;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const _S = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
const _pq = new THREE.Quaternion(), _r = new THREE.Quaternion(), _q = new THREE.Quaternion(), _rest = new THREE.Vector3();
const _eu = new THREE.Euler();

export class Jelly {
  constructor(src) {
    this.root = src.clone(true);
    this.j = {};
    this.meshes = { body: [], arm: [], leg: [] };
    this.root.traverse((o) => {
      if (o.name) this.j[o.name] = o;
      if (o.isMesh) {
        const k = o.name.split('_')[0];
        if (this.meshes[k]) this.meshes[k].push(o);
      }
    });
    this.l1 = this.j.Elbow_L.position.length();
    this.l2 = this.j.Wrist_L.position.length() + this.j.HandBall_L.position.length();
    this.rest = {};
    for (const n of ['Hips', 'Torso', 'Hip_L', 'Hip_R', 'Knee_L', 'Knee_R', 'Shoulder_L', 'Shoulder_R']) this.rest[n] = this.j[n].position.clone();
  }

  // first person: only the arms (and tucked in closer together, as seen from the eye)
  armsOnly(on, shoulderX = 0.17, ball = 0.56, thin = 0.78) {
    for (const m of [...this.meshes.body, ...this.meshes.leg]) m.visible = !on;
    this.j.Shoulder_L.position.x = on ? shoulderX : this.rest.Shoulder_L.x;
    this.j.Shoulder_R.position.x = on ? -shoulderX : this.rest.Shoulder_R.x;
    for (const n of ['HandBall_L', 'HandBall_R']) this.j[n].scale.setScalar(on ? ball : 1);   // smaller balls up close (scales about the ball centre)
    // slimmer sleeves up close: the sleeve and cuff meshes get their own geometry squeezed about the limb axis
    this.thin ??= new Map();
    for (const m of this.meshes.arm) {
      if (m.name.startsWith('arm_hand')) continue;
      if (!this.thin.has(m)) this.thin.set(m, { orig: m.geometry, slim: null });
      const t = this.thin.get(m);
      if (on && !t.slim) {
        const g = m.geometry.clone(), pos = g.attributes.position;
        g.computeBoundingBox();
        const cx = (g.boundingBox.min.x + g.boundingBox.max.x) / 2;
        for (let i = 0; i < pos.count; i++) pos.setXYZ(i, cx + (pos.getX(i) - cx) * thin, pos.getY(i), pos.getZ(i) * thin);
        pos.needsUpdate = true; g.computeBoundingSphere();
        t.slim = g;
      }
      m.geometry = on ? t.slim : t.orig;
    }
  }

  // point `joint` (whose bone hangs along its parent's -Y at rest) along the world direction `dir`
  aim(joint, dir) {
    joint.parent.updateWorldMatrix(true, false);
    joint.parent.getWorldQuaternion(_pq);
    _rest.copy(DOWN).applyQuaternion(_pq);
    _r.setFromUnitVectors(_rest, dir);
    joint.quaternion.copy(_pq).invert().multiply(_r).multiply(_pq);
    joint.updateMatrixWorld(true);
  }

  // two-bone IK: the ball hand's centre onto the world point `T`; `pole` = world direction the elbow bends toward
  solveArm(side, T, pole) {
    const sh = this.j['Shoulder_' + side], el = this.j['Elbow_' + side];
    const sc = this.root.scale.x, l1 = this.l1 * sc, l2 = this.l2 * sc;
    this.root.updateMatrixWorld(true);
    sh.getWorldPosition(_S);
    _d.subVectors(T, _S);
    const full = _d.length() || 1e-4;
    const dist = Math.min(full, (l1 + l2) * 0.999);
    _d.divideScalar(full);
    const ang = Math.acos(THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
    _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
    _e.copy(_d).multiplyScalar(Math.cos(ang)).addScaledVector(_p, Math.sin(ang));      // shoulder -> elbow direction
    this.aim(sh, _e);
    _e.multiplyScalar(l1).add(_S);                                                     // elbow position
    _t.copy(_S).addScaledVector(_d, dist).sub(_e).normalize();
    this.aim(el, _t);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Third person: the whole angler, standing where the camera's eye is (feet on the deck, dock or bank), holding the rod.
const EYE = 1.68;
const _y = new THREE.Vector3(0, 1, 0), _f = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

// where each hand goes on the rod (shared by the first-person arms): the grip and the real crank knob (+ fight pull and tremble)
export function rodHandTargets(rod, right, left) {
  rod.handle.updateMatrixWorld(true);
  rod.handle.localToWorld(right.set(0, 0, GRIP_Z));
  (rod.knob || rod.crank).getWorldPosition(left);
  const ld = rod.load || 0, H = FEEL.hand, hq = rod.handle.quaternion, spin = rod.reelSpin || 0;
  if (ld > 0.01) {
    const tr = (Math.sin(spin * 2.3) + Math.sin(spin * 5.1)) * 0.5 * ld;
    left.addScaledVector(_c.set(0, -1, 0.6).applyQuaternion(hq), H.pull * ld).addScaledVector(_b.set(1, 0, 0).applyQuaternion(hq), tr * 0.004);
    right.addScaledVector(_c.set(0, -1, 0).applyQuaternion(hq), 0.004 * ld * Math.sin(spin * 3.1));
  }
}

export class PlayerBody {
  constructor(game) {
    this.g = game;
    this.jelly = null;
    this.holder = new THREE.Group();
    this.holder.name = 'playerBody';
    this.holder.visible = false;
    game.scene.add(this.holder);
    this.phase = 0; this.sit = 0; this.lean = 0; this.t = 0; this.walk = 0;
    this.pos = new THREE.Vector3(); this.have = false;
    this.hop = null;
    this.rT = new THREE.Vector3(); this.lT = new THREE.Vector3();
    loadJelly().then((src) => {
      this.jelly = new Jelly(src);
      this.jelly.root.scale.setScalar(BODY_SCALE);
      this.holder.add(this.jelly.root);
    });
  }

  update(dt, visible) {
    const g = this.g, J = this.jelly;
    this.holder.visible = !!visible && !!J;
    if (!J || !visible) { this.have = false; return; }
    const A = g.angler, rod = g.rod, j = J.j;
    this.t += dt;
    A.getWorldPosition(_a);
    A.getWorldDirection(_f);
    const yaw = Math.atan2(_f.x, _f.z);
    const onFoot = !!g.foot;
    const bspec = !onFoot ? g.boatSpec?.() : null, seated = !!bspec?.sit;   // kayak: always sitting, eye is lower
    const dk = !onFoot ? g.deck : null, dseat = dk?.seat && !dk.seat.fixed ? dk.seat : null;   // walking the deck / sitting on a bench
    const feetY = onFoot ? g.footPos.y : _a.y - (dseat ? dseat.eye : EYE) - (seated ? bspec.eyeUp || 0 : 0);
    // sitting: at the helm of a moving boat with nothing on the line
    const busy = g.fishing.busy?.() || g.fishing.state !== 'idle';
    const sitWant = seated || dseat ? 1 : !onFoot && !dk && Math.abs(g.boatSpeed?.() || 0) > 1.2 && !busy ? 1 : 0;
    this.sit += (sitWant - this.sit) * Math.min(1, dt * 5);
    // base position, with a hop between boat and shore
    const want = _b.set(_a.x, feetY, _a.z);
    if (!this.have) { this.pos.copy(want); this.have = true; this.lastFoot = onFoot; }
    if (onFoot !== this.lastFoot) { this.hop = { t: 0, from: this.pos.clone() }; this.lastFoot = onFoot; }
    if (this.hop) {
      this.hop.t += dt / 0.55;
      const k = Math.min(1, this.hop.t), e = k * k * (3 - 2 * k);
      this.pos.lerpVectors(this.hop.from, want, e);
      this.pos.y += Math.sin(k * Math.PI) * 0.45;
      if (k >= 1) this.hop = null;
    } else this.pos.copy(want);
    const airborne = this.hop ? Math.sin(Math.min(1, this.hop.t) * Math.PI) : 0;
    this.holder.position.copy(this.pos);
    this.holder.rotation.y = yaw;
    // walking: legs swing with the ground speed
    const sp = onFoot ? g.foot.speed || 0 : 0;
    this.walk += ((sp > 0.05 ? 1 : 0) - this.walk) * Math.min(1, dt * 8);
    this.phase += dt * sp * 3.4;
    const sw = Math.sin(this.phase) * 0.62 * this.walk * Math.min(1, sp / 1.7 + 0.2);
    const idleSway = Math.sin(this.t * 1.5) * 0.012;
    const sit = this.sit, hop = airborne;
    // pelvis and legs
    j.Hips.position.y = J.rest.Hips.y - sit * (0.28 + (seated ? bspec.sitDrop || 0 : 0)) + (hop > 0 ? 0 : idleSway * 0.3);
    for (const [s, sgn] of [['L', 1], ['R', -1]]) {
      const hipX = -sw * sgn - sit * 1.45 - hop * 0.9;
      const kneeX = Math.max(0, sw * sgn * 1.0 + 0.1 * this.walk) * 1.1 + sit * 1.45 + hop * 1.3;
      j['Hip_' + s].rotation.x = hipX;
      j['Knee_' + s].rotation.x = kneeX;
      j['Ankle_' + s].rotation.x = -(hipX + kneeX) * 0.5;
    }
    // torso: lean back into a fish, forward through the cast, walking bob
    const ld = rod.load || 0;
    const leanWant = -0.24 * ld + 0.2 * (rod.castAnim || 0) + 0.04 * this.walk;
    this.lean += (leanWant - this.lean) * Math.min(1, dt * 8);
    j.Torso.rotation.x = this.lean - sit * 0.05;
    j.Torso.rotation.z = Math.sin(this.phase) * 0.04 * this.walk * (sp > 0 ? 1 : 0) + Math.sin(this.t * 31) * 0.008 * ld;
    j.Torso.position.y = J.rest.Torso.y - sit * 0.28 + Math.abs(Math.sin(this.phase)) * 0.025 * this.walk + idleSway - Math.min(0, 0);
    J.root.updateMatrixWorld(true);
    // arms: onto the rod, or hanging when it is put away
    rodHandTargets(rod, this.rT, this.lT);
    const hol = rod.holster || 0;
    for (const [s, T, sgn] of [['R', this.rT, -1], ['L', this.lT, 1]]) {
      const sh = j['Shoulder_' + s];
      sh.getWorldPosition(_c);
      const hang = _d_hang.set(0, -(J.l1 + J.l2) * BODY_SCALE * 0.93, 0).add(_c);
      hang.x += 0; hang.addScaledVector(_f, 0.05 + Math.sin(this.phase + (sgn > 0 ? 0 : Math.PI)) * 0.12 * this.walk).addScaledVector(_a.set(_f.z, 0, -_f.x), 0.02 * sgn);
      const tgt = _t2.copy(T).lerp(hang, THREE.MathUtils.smoothstep(hol, 0, 1));
      // the elbow bends outward and down
      const out = _a.set(-_f.z, 0, _f.x).multiplyScalar(-sgn * 0.8).addScaledVector(_y, -1).addScaledVector(_f, -0.15);
      J.solveArm(s, tgt, out);
    }
  }
}
const _d_hang = new THREE.Vector3(), _t2 = new THREE.Vector3();

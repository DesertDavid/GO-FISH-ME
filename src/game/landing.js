import * as THREE from 'three';
import { FEEL } from './fightFeel.js';

// Landing a tired fish: the fish glides to a spot in front of you, then a landing net scoops it,
// a gaff takes it (big or toothy fish from a boat) or a hand lifts it by the lip. The tool lives in
// the world scene so it dips into the real water; when it has lifted the fish up to the camera the
// normal hold-up / livewell flow (Fishing.landed -> Game.onCatch) takes over.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _fw = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const L = FEEL.land;

export class Landing {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.kind = null;
    this.t = 0;
    this.mats = {
      alu: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.9 }),
      grip: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.8 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.9 }),
      mesh: new THREE.MeshBasicMaterial({ color: 0x2c3a34, wireframe: true, transparent: true, opacity: 0.85 }),
      bag: new THREE.MeshStandardMaterial({ color: 0x24302b, roughness: 1, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
      sleeve: new THREE.MeshStandardMaterial({ color: 0x1f5f6a, roughness: 0.88 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xb98a70, roughness: 0.6 }),
    };
  }

  active() { return !!this.kind; }

  // camera-local point -> world
  at(cam, x, y, z, out) { return out.set(x, y, z).applyMatrix4(cam.matrixWorld); }

  start(f, kind, ctx) {
    const cam = ctx.camera;
    this.kind = kind; this.t = 0; this.f = f; this.hit = false; this.splashed = false;
    this.start0 = f.pos.clone();
    this.dirH = _a.subVectors(f.pos, cam.position).setY(0);
    const d0 = this.dirH.length() || 3;
    this.dirH = this.dirH.normalize().clone();
    this.spot = new THREE.Vector3().copy(cam.position).addScaledVector(this.dirH, THREE.MathUtils.clamp(d0, 3.2, 4.4));
    this.surf = ctx.waterAt(1);
    ctx.clearHull?.(this.spot);
    this.spot.y = this.surf - 0.12;
    this.len = f.len;
    this.heading0 = f.heading;
    this.build(ctx);
    this.group.visible = true;
  }

  build(ctx) {
    const g = this.group, m = this.mats;
    while (g.children.length) g.remove(g.children[0]);
    this.parts = {};
    const f = this.f;
    if (this.kind === 'net') {
      const R = THREE.MathUtils.clamp(f.len * 0.55, 0.26, 0.5);
      this.R = R;
      const net = new THREE.Group();
      net.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.012, 6, 32).rotateX(Math.PI / 2), m.alu));
      const pts = [];
      for (let i = 0; i <= 8; i++) { const s = i / 8; pts.push(new THREE.Vector2(R * Math.cos(s * Math.PI * 0.5) * 0.98 + 0.004, -R * 1.25 * Math.sin(s * Math.PI * 0.5))); }
      const lathe = new THREE.LatheGeometry(pts, 16);
      net.add(new THREE.Mesh(lathe, m.mesh), new THREE.Mesh(lathe, m.bag));
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), m.alu);
      handle.position.z = R;
      net.add(handle);
      this.parts.handle = handle;
      // bare forearm and cuff from the handle's end
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, 1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), m.sleeve);
      net.add(arm);
      this.parts.arm = arm;
      g.add(net);
      this.parts.net = net;
    } else if (this.kind === 'gaff') {
      const gaff = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), m.alu);
      gaff.add(pole);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 6, 14, Math.PI * 1.25).rotateZ(Math.PI * 0.9), m.brass);
      hook.position.set(0, 0.0, 0);
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.05, 6), m.brass);
      point.position.set(0.055, 0.045, 0);
      gaff.add(hook, point);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, 1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), m.sleeve);
      gaff.add(arm);
      this.parts.pole = pole; this.parts.arm = arm;
      g.add(gaff);
      this.parts.gaff = gaff;
    } else {
      const hand = new THREE.Group();
      const src = ctx.rod.hands?.cloneLeft ? ctx.rod.hands.cloneLeft() : ctx.rod.hands?.left?.children?.[0];
      if (src) {
        const c = ctx.rod.hands?.cloneLeft ? src : src.clone(true);
        hand.add(c);
        this.parts.model = true;
      } else {
        hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.11), m.skin));
      }
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, 1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), m.sleeve);
      const holder = new THREE.Group();
      holder.add(hand, arm);
      this.parts.arm = arm; this.parts.hand = hand;
      g.add(holder);
      this.parts.holder = holder;
    }
  }

  // fish position control point (the "carrier" tool position), written to f.pos / f.heading
  update(dt, ctx) {
    const f = this.f, cam = ctx.camera, G = L.glide, A = L.scoop, B = L.lift;
    this.t += dt;
    const t = this.t;
    const anchor = this.at(cam, this.kind === 'hand' ? -0.14 : 0.34, this.kind === 'hand' ? -0.55 : -0.5, -0.5, _b).clone();
    const trophy = this.at(cam, -0.3, -0.12, -1.1, new THREE.Vector3());
    const surfY = this.surf;
    const awayYaw = Math.atan2(-this.dirH.z, this.dirH.x);   // heading that faces away from the camera
    const eG = ease(t / G), eA = ease((t - G) / A), eL = ease((t - G - A) / B);
    const p = f.pos;
    f.pitch = 0; f.roll = f.roll || 0;
    // --- fish glides to the spot
    if (t < G) {
      p.lerpVectors(this.start0, this.spot, eG);
      p.y = this.start0.y + (this.spot.y - this.start0.y) * eG;
      const to = _a.subVectors(this.spot, this.start0).setY(0);
      const trav = to.lengthSq() > 1e-4 ? Math.atan2(-to.z, to.x) : awayYaw;
      f.heading = lerpAng(trav, awayYaw, ease((eG - 0.6) / 0.4));
      f.roll *= 0.9;
    }
    const hold = new THREE.Vector3();   // where the tool carries the fish once it has it
    if (this.kind === 'net') {
      const R = this.R, net = this.parts.net;
      // under the fish while it settles, up under it in the scoop, then up to the camera
      const under = _a.copy(this.spot).addScaledVector(this.dirH, 0.1).setY(surfY - 0.55);
      const upto = _b.copy(this.spot).setY(surfY - 0.08);
      const H = new THREE.Vector3();
      if (t < G) H.copy(under).add(_up.clone().multiplyScalar(Math.sin(t * 5) * 0.015));
      else if (t < G + A) H.lerpVectors(under, upto, eA);
      else H.lerpVectors(upto, trophy.clone().add(new THREE.Vector3(0, -0.25, 0)), eL);
      net.position.copy(H);
      net.lookAt(anchor);
      this.sizeTool(net, H, anchor, R);
      if (t >= G) {
        p.set(H.x, H.y + 0.07 + R * 0.2 * (1 - eL), H.z);
        f.heading = awayYaw;
        f.pitch = -0.25 * eA;
        f.roll = Math.sin(t * 14) * 0.18 * (1 - eL * 0.5);
      }
      if (t >= G && !this.hit) { this.hit = true; ctx.audio.playNetScoop(); ctx.fx.burst('splash', _a.set(p.x, surfY, p.z), 18, null, 1); ctx.splash(p.x, p.z, 0.08, f.len * 0.7); ctx.kick(0.35); }
    } else if (this.kind === 'gaff') {
      const gaff = this.parts.gaff;
      const hover = _a.copy(this.spot).addScaledVector(this.dirH, 0.35).setY(surfY + 0.75);
      const shoulder = _b.copy(this.spot).setY(surfY - 0.02);
      const P = new THREE.Vector3();
      const jab = ease((t - G) / (A * 0.35));
      if (t < G) P.copy(hover).y += Math.sin(t * 3) * 0.02;
      else if (t < G + A) P.lerpVectors(hover, shoulder, jab);
      else P.lerpVectors(shoulder, trophy.clone().add(new THREE.Vector3(0.05, 0.08, 0)), eL);
      gaff.position.copy(P);
      gaff.lookAt(anchor);
      this.sizeTool(gaff, P, anchor, 0);
      if (t >= G + A * 0.3) {
        p.set(P.x, P.y - 0.04, P.z);
        f.heading = awayYaw;
        f.roll = Math.sin(t * 20) * 0.35 * (1 - eL);
        f.pitch = 0.5 * eL;
      }
      if (t >= G + A * 0.35 && !this.hit) { this.hit = true; ctx.audio.playSplash(1.1); ctx.fx.burst('splash', _a.set(p.x, surfY, p.z), 26, null, 1.3); ctx.splash(p.x, p.z, 0.12, f.len * 0.8); ctx.kick(1); }
    } else {
      const holder = this.parts.holder;
      const mouth = _a.set(Math.cos(awayYaw) * f.len * 0.5, 0, -Math.sin(awayYaw) * f.len * 0.5);
      // the hand reaches in from below the screen, closes on the jaw, lifts
      const reachFrom = this.at(cam, -0.14, -0.62, -0.55, new THREE.Vector3());
      const jaw = new THREE.Vector3(this.spot.x + mouth.x, surfY + 0.02, this.spot.z + mouth.z);
      const P = new THREE.Vector3();
      const reach = ease((t - G * 0.4) / (G * 0.6 + A * 0.6));
      if (t < G + A) P.lerpVectors(reachFrom, jaw, reach);
      else P.lerpVectors(jaw, trophy.clone().add(new THREE.Vector3(0.0, 0.0, 0)), eL);
      holder.position.copy(P);
      holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(anchor, P, _up));
      this.sizeTool(holder, P, anchor, 0, true);
      if (t >= G + A * 0.55) {
        const m = _b.set(Math.cos(awayYaw) * f.len * 0.5, 0, -Math.sin(awayYaw) * f.len * 0.5);
        p.set(P.x - m.x * (1 - eL), P.y - 0.02 - f.len * 0.12 * eL, P.z - m.z * (1 - eL));
        f.heading = awayYaw;
        f.pitch = 0.9 * eL;
        f.roll = Math.sin(t * 16) * 0.25 * (1 - eL * 0.6);
      }
      if (t >= G + A * 0.55 && !this.hit) { this.hit = true; ctx.audio.playFlop(0.8); ctx.fx.burst('splash', _a.set(p.x, surfY, p.z), 14, null, 1); ctx.kick(0.5); }
    }
    // droplets fall off the fish while it comes up
    if (t > G + A && Math.random() < dt * 40) ctx.fx.emit('drop', _a.copy(p).add(_b.set((Math.random() - 0.5) * f.len * 0.5, -0.05, (Math.random() - 0.5) * f.len * 0.4)), null, 1);
    ctx.landVis = { t, kind: this.kind };
    return t >= G + A + B;
  }

  // stretch the handle / forearm so it runs from the tool to the hand anchor
  sizeTool(root, pos, anchor, R, hand) {
    const dist = pos.distanceTo(anchor);
    if (this.parts.handle) {
      const total = Math.max(0.3, dist - R);
      this.parts.handle.scale.z = Math.min(total, 1.5);
      const rest = total - 1.5;
      this.parts.arm.visible = rest > 0.05;
      if (rest > 0.05) { this.parts.arm.position.z = R + 1.5; this.parts.arm.scale.z = rest; }
    } else if (this.parts.pole) {
      const total = Math.max(0.3, dist);
      this.parts.pole.scale.z = Math.min(total, 1.6);
      const rest = total - 1.6;
      this.parts.arm.visible = rest > 0.05;
      if (rest > 0.05) { this.parts.arm.position.z = 1.6; this.parts.arm.scale.z = rest; }
    } else if (hand) {
      const total = Math.max(0.2, dist);
      this.parts.arm.position.z = 0.05;
      this.parts.arm.scale.z = total;
    }
  }

  clear() {
    this.kind = null;
    this.group.visible = false;
    while (this.group.children.length) this.group.remove(this.group.children[0]);
  }
}

function lerpAng(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

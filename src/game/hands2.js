import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { FEEL } from './fightFeel.js';

// Second set of first-person hands (public/models/hands2.glb, tools/blender/build_hands_v2.py):
// a skinned, textured right hand ("Rigged hand" by Elena FF, CC-BY-SA-4.0, see public/credits.md)
// with 22 named deform bones, plus a rigid forearm with a rolled flannel sleeve ("Arm", "Elbow").
// Hand frame: origin = wrist centre, +z along the fingers, +y back of the hand, +x thumb side.
// The left hand is the same model mirrored (scale.x = -1). Fingers are posed at runtime by rotating
// bones about hand-frame axes, so one mesh does relaxed / rod grip / crank grip / holstered.
// Same public surface as Hands in hands.js: left, right, arm, update().
const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
const loader = new GLTFLoader().setDRACOLoader(draco);
const Z = new THREE.Vector3(0, 0, 1);
const KNOB_HOME = new THREE.Vector3(0.042 + 0.015, -0.085, 0.07);   // crank knob's average spot in the handle frame
const ARM_LEN = 0.46;                                               // = ARM_LEN in build_hands_v2.py

// ------------------------------------------------------------------ placement (tuned in handslab.html)
export const T = {
  // right hand: c = where the rod axis passes through the hand (hand frame, m), zg = where along the handle (z),
  // phi = diagonal turn of the hand about its back (rad), tilt = wrist roll about the finger-curl axis,
  // dir = where the forearm runs from the wrist, in the handle frame (rigid, the right wrist never moves)
  right: { c: [0.0, -0.04, 0.058], zg: 0.07, phi: 0.6, tilt: 0.0, dir: [-0.12, -0.5, -0.85] },
  // left hand (mirrored): c = where the knob sits in the hand, beta = wrist bend toward the palm, roll about the forearm,
  // elbow = fixed elbow offset from the knob home (handle frame). The hand is turned each frame to follow its forearm.
  left: { c: [0.0, -0.04, 0.058], beta: 0.5, roll: 0.0, elbow: [0.02, -0.28, -0.42] },
};
const _R = new THREE.Matrix4(), _R2 = new THREE.Matrix4(), _c = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function placeRight(gr, armR) {
  // hand frame (x thumb side, y back, z fingers) -> handle frame: thumb toward the tip (+z), back of hand to the right (-x),
  // fingers down. Then a diagonal turn about the back of the hand and a wrist tilt.
  const r = T.right;
  _R.makeBasis(_x.set(0, 0, 1), _y.set(-1, 0, 0), _z.set(0, -1, 0));
  _R.multiply(_R2.makeRotationY(r.phi)).multiply(_R2.makeRotationX(r.tilt));
  gr.quaternion.setFromRotationMatrix(_R);
  gr.position.set(0, 0, r.zg).sub(_c.fromArray(r.c).applyQuaternion(gr.quaternion));
  if (armR) armR.quaternion.setFromUnitVectors(_x.set(0, 0, -1), _y.fromArray(r.dir).normalize().applyQuaternion(_q.copy(gr.quaternion).invert()));
}
// left: orient the (mirrored) hand along its forearm direction `dir` (elbow -> wrist, handle frame), palm down
function placeLeft(gl, dir, extraBeta) {
  const l = T.left;
  _z.copy(dir).normalize();
  _y.copy(_up).addScaledVector(_z, -_up.dot(_z)).normalize();
  _x.crossVectors(_y, _z);
  _R.makeBasis(_x, _y, _z).multiply(_R2.makeRotationZ(l.roll)).multiply(_R2.makeRotationX(l.beta + extraBeta));
  gl.quaternion.setFromRotationMatrix(_R);
  gl.position.set(0, 0, 0).sub(_c.set(-l.c[0], l.c[1], l.c[2]).applyQuaternion(gl.quaternion));
}

// ------------------------------------------------------------------ pose data
const FING = ['Index', 'Middle', 'Ring', 'Pinky'];
const BONES = ['Wrist', 'Thumb0', 'Thumb1', 'Thumb2', 'Thumb3'];
for (const f of FING) BONES.push(f + '0', f + '1', f + '2', f + '3');
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

// rotation vectors (axis * angle, hand frame) per bone. +x curls a finger toward the palm,
// +y swings +z toward +x (fingers spread toward the thumb side for Index).
function pose(spec) {
  const a = new Float32Array(BONES.length * 3);
  const set = (b, x, y = 0, z = 0) => { const i = BI[b] * 3; a[i] = x; a[i + 1] = y; a[i + 2] = z; };
  FING.forEach((f, k) => {
    const c = spec.fingers[k], sp = spec.spread?.[k] ?? 0;
    set(f + '0', c[3] ?? 0, sp);
    set(f + '1', c[0]); set(f + '2', c[1]); set(f + '3', c[2]);
  });
  const t = spec.thumb;
  for (let i = 0; i < 4; i++) if (t[i]) set('Thumb' + i, ...t[i]);
  return a;
}
export const POSES = {
  // relaxed, slightly cupped: the hand lowered by the holster
  idle: pose({
    fingers: [[0.35, 0.5, 0.3, 0.05], [0.42, 0.55, 0.32, 0.05], [0.5, 0.6, 0.34, 0.06], [0.58, 0.62, 0.36, 0.08]],
    spread: [0.05, 0, -0.04, -0.1], thumb: [[0, 0, 0], [0.12, -0.1, 0], [0.15, 0, 0], [0.1, 0, 0]],
  }),
  // right hand round the rod grip
  grip: pose({
    fingers: [[1.1, 1.35, 0.7, 0.15], [1.2, 1.4, 0.75, 0.15], [1.25, 1.4, 0.7, 0.15], [1.3, 1.3, 0.7, 0.15]],
    spread: [0.04, 0.08, -0.1, -0.1], thumb: [[0, -0.3, 0], [0.3, -0.3, 0], [0.4, 0, 0], [0.3, 0, 0]],
  }),
  // left hand round the crank knob
  crank: pose({
    fingers: [[1.0, 1.4, 0.8, 0.1], [1.1, 1.4, 0.8, 0.1], [1.15, 1.4, 0.8, 0.1], [1.2, 1.3, 0.8, 0.1]],
    spread: [0, 0, 0, 0], thumb: [[0, -0.3, 0], [0.3, -0.3, 0], [0.4, 0, 0], [0.3, 0, 0]],
  }),
};
const _p = new Float32Array(BONES.length * 3);
function lerpPose(a, b, t, out = _p) {
  for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

const _v = new THREE.Vector3(), _e = new THREE.Vector3(), _w = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _eu = new THREE.Euler();

function dress(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (o.name === 'Arm') o.material.forEach?.((q) => { q.side = THREE.DoubleSide; });
    const m = o.material, name = m?.name || '';
    if (name === 'Skin') {
      o.material = new THREE.MeshPhysicalMaterial({
        map: m.map, roughness: 0.58, envMapIntensity: 0.6,
        sheen: 0.18, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xc05840),
      });
    } else if (name === 'ArmSkin') {
      o.material = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.6, envMapIntensity: 0.6, sheen: 0.18, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xc05840) });
    } else if (name === 'Sleeve') {
      o.material.roughness = 0.95; o.material.envMapIntensity = 0.5;
    }
  });
}

// one posable hand: a clone of the loaded model with its bone table
class Hand {
  constructor(src) {
    this.root = cloneSkinned(src);
    this.arm = this.root.getObjectByName('Arm');
    const elbow = this.root.getObjectByName('Elbow');
    if (this.arm) this.arm.removeFromParent();
    if (elbow) elbow.removeFromParent();
    this.root.updateMatrixWorld(true);
    this.bones = BONES.map((n) => {
      const b = this.root.getObjectByName(n);
      return { b, rest: b.quaternion.clone(), wq: b.getWorldQuaternion(new THREE.Quaternion()) };
    });
  }
  // blend pose arrays and write bone rotations: local = rest * wq^-1 * R(v) * wq  (v is a hand-frame rotation vector)
  apply(p) {
    for (let i = 0; i < this.bones.length; i++) {
      const { b, rest, wq } = this.bones[i];
      _v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      const ang = _v.length();
      if (ang < 1e-5) { b.quaternion.copy(rest); continue; }
      _q.setFromAxisAngle(_v.divideScalar(ang), ang);
      _qi.copy(wq).invert();
      b.quaternion.copy(rest).multiply(_qi).multiply(_q).multiply(wq);
    }
  }
}

export class Hands2 {
  constructor(rod) {
    this.rod = rod;
    this.right = new THREE.Group();
    this.left = new THREE.Group();
    this.arm = new THREE.Group();        // forearm pieces (left and right), hinged to elbows in update()
    rod.handle.add(this.right);
    rod.group.add(this.left, this.arm);
    this.knob = new THREE.Vector3();
    this.hr = this.hl = null;
    this.src = null;
    this.armL = new THREE.Group();
    this.arm.add(this.armL);
    this.grip = 1;                       // smoothed 1 = gripping, 0 = relaxed (holstered)
    this.ready = loader.loadAsync(`${import.meta.env.BASE_URL}models/hands2.glb`).then((gltf) => {
      this.src = gltf.scene;
      dress(this.src);
      this.hr = new Hand(gltf.scene); this.hl = new Hand(gltf.scene);
      const place = (h, holder, cfg, mirror) => {
        const g = new THREE.Group();
        if (mirror) g.scale.x = -1;
        g.add(h.root);
        holder.add(g);
        return g;
      };
      this.gr = place(this.hr, this.right, T.right, false);
      this.gl = place(this.hl, this.left, T.left, true);
      this.gr.add(this.hr.arm);          // right forearm: rigid, bent from the hand by T.right.bend
      if (this.hl.arm) { this.hl.arm.rotation.y = Math.PI; this.armL.add(this.hl.arm); }   // mesh runs along -z; hinge wants +z
      this.apply();
    });
  }

  // re-read T (the lab tunes it live)
  apply() {
    if (this.gr) placeRight(this.gr, this.hr.arm);
  }

  // a posed, mirrored copy of the left hand with its forearm for the landing animation (hand-landing a fish)
  cloneLeft() {
    if (!this.src) return null;
    const h = new Hand(this.src), g = new THREE.Group(), inner = new THREE.Group();
    inner.scale.x = -1;
    inner.add(h.root);
    h.apply(POSES.idle);
    g.add(inner);
    return g;
  }

  update() {
    if (!this.gr) return;
    const rod = this.rod, hq = rod.handle.quaternion;
    rod.handle.updateMatrixWorld(true);
    rod.knob.getWorldPosition(this.knob);
    const spin = rod.reelSpin || 0, ld = rod.load || 0, H = FEEL.hand;
    // grip eases off while the rod is put away
    const want = 1 - (rod.holster || 0);
    this.grip += (want - this.grip) * 0.2;
    const g = this.grip * this.grip * (3 - 2 * this.grip);

    // --- right hand: fixed on the grip, squeezes under load
    const sq = Math.min(1, ld * 0.6);
    lerpPose(POSES.idle, POSES.grip, g, _p);
    for (let i = 0; i < _p.length; i += 3) _p[i] += sq * 0.12 * g;
    this.hr.apply(_p);

    // --- left hand: rides the crank knob; under load it is dragged down and toward the tip, trembling
    this.left.position.copy(this.knob);
    if (ld > 0.01) {
      const tr = (Math.sin(spin * 2.3) + Math.sin(spin * 5.1)) * 0.5 * ld;
      this.left.position.addScaledVector(_v.set(0, -1, 0.6).applyQuaternion(hq), H.pull * ld).addScaledVector(_w.set(1, 0, 0).applyQuaternion(hq), tr * 0.004);
    }
    this.left.quaternion.copy(hq);
    // turn the hand along the elbow -> wrist line (two passes: the wrist depends on the turn), wrist rocking with the crank
    const wob = (0.12 + 0.1 * ld) * Math.sin(spin);
    const el = _e.fromArray(T.left.elbow).add(rod.knobHome || KNOB_HOME);                                   // elbow, handle frame
    const kn = this.left.position.clone(); rod.handle.worldToLocal(kn);                   // knob (+pull), handle frame
    let dirH = _v.copy(kn).add(_w.set(0, 0, 0.0)).sub(el);
    this.dirL = this.dirL || new THREE.Vector3(); this.dirL.copy(dirH);
    for (let it = 0; it < 2; it++) {
      placeLeft(this.gl, this.dirL, wob);
      this.dirL.copy(kn).add(this.gl.position).sub(el);
    }
    lerpPose(POSES.idle, POSES.crank, g, _p);
    // fingers work a little with the crank
    for (const f of FING) { _p[BI[f + '1'] * 3] += 0.06 * Math.sin(spin + 1) * g; _p[BI[f + '2'] * 3] += 0.05 * Math.sin(spin + 2) * g; }
    this.hl.apply(_p);

    // --- left forearm hinges from its fixed elbow to the wrist (the right one is rigid on the hand)
    this.left.updateMatrixWorld(true);
    this.hinge(this.armL, this.gl, el, hq);
  }

  hinge(holder, wristNode, elbowH, hq) {
    const wrist = wristNode.getWorldPosition(_w);
    const elbow = _e.copy(elbowH);
    this.rod.handle.localToWorld(elbow);
    const dir = _v.subVectors(elbow, wrist);
    const len = dir.length();
    dir.applyQuaternion(_qi.copy(hq).invert()).divideScalar(len);
    holder.position.copy(wrist);
    holder.quaternion.copy(hq).multiply(_q2.setFromUnitVectors(Z, dir));
    holder.scale.set(1, 1, len / ARM_LEN);
  }
}

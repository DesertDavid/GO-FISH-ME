import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// First-person hands. Built in the rod handle's frame (+z along the rod toward the tip,
// +y up, +x to the angler's left): right hand wraps the cork with the reel foot between
// its middle fingers, left hand holds the crank knob and circles with it.
const SKIN = 0x34393f, SLEEVE = 0x1f5f6a;   // SKIN: sun-glove fabric

function capsule(r, len, from, to) {
  const g = new THREE.CapsuleGeometry(r, len, 6, 12);
  const dir = new THREE.Vector3().subVectors(to, from);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// a finger as two bent segments around a grip axis (z), starting at angle a0 on radius r
function curledFinger(z, r, a0, sweep, thick) {
  const parts = [];
  let prev = V(Math.cos(a0) * r, Math.sin(a0) * r, z);
  const steps = 3;
  for (let i = 1; i <= steps; i++) {
    const a = a0 + (sweep * i) / steps;
    const p = V(Math.cos(a) * r, Math.sin(a) * r, z + i * 0.002);
    parts.push(capsule(thick * (1 - i * 0.08), prev.distanceTo(p), prev, p));
    prev = p;
  }
  return parts;
}

function rightHand() {
  const skin = [], sleeve = [];
  const R = 0.024;
  // palm on the angler's right side of the grip (-x)
  skin.push(capsule(0.024, 0.06, V(-0.03, 0.0, 0.0), V(-0.032, -0.005, 0.085)));
  // fingers wrap under the handle to the left side: two before the reel foot, two after
  for (const [z, len] of [[0.035, 1.0], [0.055, 1.05], [0.088, 1.0], [0.106, 0.85]]) {
    skin.push(...curledFinger(z, R, Math.PI * 1.02, -Math.PI * 1.25 * len, 0.0085));
  }
  // thumb along the top of the handle
  skin.push(capsule(0.009, 0.035, V(-0.016, 0.018, 0.04), V(-0.004, 0.02, 0.085)));
  // wrist + forearm back toward the bottom-right of the view
  skin.push(capsule(0.022, 0.03, V(-0.034, -0.008, -0.01), V(-0.04, -0.02, -0.05)));
  sleeve.push(new THREE.CylinderGeometry(0.036, 0.045, 0.34, 14).rotateX(Math.PI / 2).translate(0, 0, -0.17)
    .applyMatrix4(new THREE.Matrix4().lookAt(V(0, 0, 0), V(-0.15, -0.35, -1), V(0, 1, 0))).translate(-0.045, -0.03, -0.05));
  return { skin: mergeGeometries(skin), sleeve: mergeGeometries(sleeve) };
}

function leftHand() {
  const skin = [], sleeve = [];
  // fist around a knob whose axis is x: knuckles on top, fingers wrapping down
  skin.push(capsule(0.022, 0.03, V(0.02, 0.0, -0.012), V(0.02, -0.005, 0.02)));
  for (let i = 0; i < 4; i++) {
    const x = 0.006 + i * 0.011;
    skin.push(...curledFinger(0, 0.016, Math.PI * 0.4, Math.PI * 1.3, 0.0075).map((g) => g.rotateY(Math.PI / 2).translate(x, 0, 0)));
  }
  skin.push(capsule(0.008, 0.02, V(0.0, 0.012, 0.0), V(-0.008, 0.012, 0.02)));
  skin.push(capsule(0.02, 0.03, V(0.03, -0.01, -0.02), V(0.05, -0.03, -0.06)));
  sleeve.push(new THREE.CylinderGeometry(0.034, 0.044, 0.32, 14).rotateX(Math.PI / 2).translate(0, 0, -0.16)
    .applyMatrix4(new THREE.Matrix4().lookAt(V(0, 0, 0), V(0.3, -0.35, -1), V(0, 1, 0))).translate(0.055, -0.035, -0.07));
  return { skin: mergeGeometries(skin), sleeve: mergeGeometries(sleeve) };
}

export class Hands {
  constructor(rod) {
    this.rod = rod;
    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.9, metalness: 0 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.85, metalness: 0 });
    const r = rightHand(), l = leftHand();
    this.right = new THREE.Group();
    this.right.add(new THREE.Mesh(r.skin, skinMat), new THREE.Mesh(r.sleeve, sleeveMat));
    this.right.scale.setScalar(0.9);
    rod.handle.add(this.right);
    this.left = new THREE.Group();
    this.left.add(new THREE.Mesh(l.skin, skinMat), new THREE.Mesh(l.sleeve, sleeveMat));
    this.left.scale.setScalar(0.9);
    rod.group.add(this.left);
    this.knob = new THREE.Vector3();
  }

  // left hand follows the crank knob, keeping the handle's orientation
  update() {
    const rod = this.rod;
    rod.handle.updateMatrixWorld(true);
    rod.knob.getWorldPosition(this.knob);
    this.left.position.copy(this.knob);
    this.left.quaternion.copy(rod.handle.quaternion);
  }
}

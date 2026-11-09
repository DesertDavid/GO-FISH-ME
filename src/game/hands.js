import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// First-person hands, modelled in Blender (tools/blender/build_hands.py). The model is built in
// the rod handle's frame (+z along the rod toward the tip, +y up, +x to the angler's left):
// HandR wraps the grip with the reel stem between its middle and ring fingers, HandL closes
// round the crank knob (its origin is the knob centre) and circles with it. The left forearm
// (ArmL) is a separate piece hinged at a fixed elbow, so it swings to follow the wrist instead
// of orbiting rigidly with the hand.
const loader = new GLTFLoader();
const Z = new THREE.Vector3(0, 0, 1);
// the crank knob's average spot in the handle frame (crank hub + knob offset along the axle)
const KNOB_HOME = new THREE.Vector3(0.042 + 0.015, -0.085, 0.07);
const _v = new THREE.Vector3(), _e = new THREE.Vector3(), _w = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _eu = new THREE.Euler();

function dress(node) {
  node.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material?.name || '';
    if (name.startsWith('Skin')) {
      o.material = new THREE.MeshPhysicalMaterial({
        vertexColors: !!o.geometry.attributes.color,
        color: o.geometry.attributes.color ? 0xe0d2c8 : 0xb47c5e,
        roughness: 0.55,
        sheen: 0.12, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xd06048),   // a little warm scatter at the edges
        envMapIntensity: 0.6,
      });
    } else if (name.startsWith('Nail')) {
      o.material = new THREE.MeshStandardMaterial({ color: 0xb98272, roughness: 0.5, envMapIntensity: 0.25 });
    } else if (name.startsWith('Sleeve')) {
      o.material = new THREE.MeshStandardMaterial({ color: 0x1f5f6a, roughness: 0.88 });
    }
    o.frustumCulled = false;
  });
  return node;
}

export class Hands {
  constructor(rod) {
    this.rod = rod;
    this.right = new THREE.Group();
    this.left = new THREE.Group();
    this.arm = new THREE.Group();
    rod.handle.add(this.right);
    rod.group.add(this.left, this.arm);
    this.knob = new THREE.Vector3();
    this.wrist = null;     // wrist and elbow in the left hand's frame
    this.elbow = null;
    this.armLen = 1;
    loader.loadAsync(`${import.meta.env.BASE_URL}models/hands.glb`).then((gltf) => {
      const s = gltf.scene;
      const r = s.getObjectByName('HandR'), l = s.getObjectByName('HandL'), a = s.getObjectByName('ArmL');
      const w = s.getObjectByName('WristL'), e = s.getObjectByName('ElbowL');
      if (r) this.right.add(dress(r));
      if (l) this.left.add(dress(l));
      if (a && w && e) {
        this.wrist = w.position.clone();
        this.elbow = e.position.clone();
        const dir = _v.subVectors(this.elbow, this.wrist);
        this.armLen = dir.length();
        // bake the forearm so it starts at the wrist and runs up +z to the elbow
        const bake = new THREE.Matrix4().makeRotationFromQuaternion(_q.setFromUnitVectors(dir.normalize(), Z))
          .multiply(new THREE.Matrix4().makeTranslation(-this.wrist.x, -this.wrist.y, -this.wrist.z));
        // (the Blender script applies every transform, so the arm's nodes sit at the origin)
        dress(a).traverse((o) => { if (o.isMesh) o.geometry.applyMatrix4(bake); });
        this.arm.add(a);
      }
    });
  }

  // The left hand rides the crank knob with a little wrist roll; the forearm hinges from a fixed
  // elbow to wherever the wrist is now.
  update() {
    const rod = this.rod, hq = rod.handle.quaternion;
    rod.handle.updateMatrixWorld(true);
    rod.knob.getWorldPosition(this.knob);
    const spin = rod.reelSpin || 0;
    this.left.position.copy(this.knob);
    this.left.quaternion.copy(hq).multiply(_q.setFromEuler(_eu.set(0.22 * Math.sin(spin), 0.08 * Math.cos(spin), 0.1 * Math.cos(spin))));
    if (!this.wrist) return;
    this.left.updateMatrixWorld(true);
    const wrist = this.left.localToWorld(_w.copy(this.wrist));
    const elbow = rod.handle.localToWorld(_e.copy(KNOB_HOME).add(this.elbow));
    const dir = _v.subVectors(elbow, wrist);
    const len = dir.length();
    // direction in the handle frame, so the arm keeps the handle's roll
    dir.applyQuaternion(_qi.copy(hq).invert()).divideScalar(len);
    this.arm.position.copy(wrist);
    this.arm.quaternion.copy(hq).multiply(_q.setFromUnitVectors(Z, dir));
    this.arm.scale.set(1, 1, len / this.armLen);
  }
}

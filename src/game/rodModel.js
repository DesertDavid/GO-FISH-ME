import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Real rod models (public/models/rods/*.glb, built by tools/blender/rod_mode.py from the Sketchfab downloads listed in
// tools/assets/manifest.json). Built in the rod handle's frame: +Z along the rod to the tip, +Y up (the reel hangs below),
// +X to the angler's left (crank side), metres, reel centre at z = 0.07 like the procedural reel in rod.js.
//   rod_skin  skinned: grip, blank, guides. Bones bend_root (rigid grip) -> bend0..bendN-1 (equal segments from flex_z to the tip)
//   rod_reel  rigid reel body      crank  turns about X through its origin     knob  empty at the crank knob (child of crank)
//   tip / guide_i / spool  empties (tip and guides ride the bones, spool is rigid)
const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
const loader = new GLTFLoader().setDRACOLoader(draco);
const sources = new Map();   // name -> promise of the untouched glTF scene
const shared = new Map();    // name -> the one RodModel the first-person rod drives
const Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3(), _d = new THREE.Quaternion(), _a = new THREE.Quaternion(), _p = new THREE.Quaternion();

function source(name) {
  if (!sources.has(name)) sources.set(name, loader.loadAsync(`${import.meta.env.BASE_URL}models/rods/${name}.glb`).then((g) => g.scene));
  return sources.get(name);
}

// the model the first-person rod uses (loaded once)
export function loadRodModel(name) {
  if (!shared.has(name)) shared.set(name, source(name).then((sc) => new RodModel(name, cloneSkinned(sc))));
  return shared.get(name);
}

// a fresh independent copy (own skeleton) for rods on boats
export function loadRodClone(name) {
  return source(name).then((sc) => new RodModel(name, cloneSkinned(sc)));
}

export class RodModel {
  constructor(name, scene) {
    this.name = name;
    this.root = scene;
    let meta = null;
    scene.traverse((o) => {
      if (o.userData?.rod) meta = typeof o.userData.rod === 'string' ? JSON.parse(o.userData.rod) : o.userData.rod;
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m) m.envMapIntensity = 0.9;
      }
    });
    if (!meta) throw new Error('rod model without meta: ' + name);
    this.meta = meta;
    this.nb = meta.bones;
    this.flexZ = meta.flex_z;
    this.tipZ = meta.tip_z;
    this.crank = scene.getObjectByName('crank') || null;
    this.knob = scene.getObjectByName('knob') || null;
    this.spool = scene.getObjectByName('spool');
    this.crankR = meta.crank_r || 0.06;
    // circle the knob runs on (handle frame): centre on the axle, used by the hands for the elbow
    this.knobHome = meta.pivot && meta.knob ? new THREE.Vector3(meta.knob[0], meta.pivot[1], meta.pivot[2]) : null;
    scene.updateMatrixWorld(true);
    this.rootBone = scene.getObjectByName('bend_root');
    this.bones = [];
    for (let i = 0; i < this.nb; i++) this.bones.push(scene.getObjectByName(`bend${i}`));
    // rest orientation of every bone frame (model frame): the bend rotates these
    this.rest = [this.rootBone, ...this.bones].map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
    // tip and guides follow the bones: re-parent them at rest, keeping their place
    const seg = (this.tipZ - this.flexZ) / this.nb;
    const bone = (z) => this.bones[Math.max(0, Math.min(this.nb - 1, Math.floor((z - this.flexZ) / seg)))];
    this.tip = scene.getObjectByName('tip');
    this.bones[this.nb - 1].attach(this.tip);
    this.guides = [];
    for (let i = 0; scene.getObjectByName(`guide_${i}`); i++) {
      const g = scene.getObjectByName(`guide_${i}`);
      const z = g.position.z;
      (z < this.flexZ ? this.rootBone : bone(z)).attach(g);
      this.guides.push(g);
    }
    this.path = [this.spool, ...this.guides, this.tip].filter(Boolean);
  }

  // dirs[k] (k = 1..n): world direction of the k-th piece of the bent blank; invQ: world -> handle frame
  pose(invQ, dirs, n) {
    const nb = this.nb;
    _p.copy(this.rest[0]);
    for (let j = 0; j < nb; j++) {
      const k = Math.max(1, Math.min(n, Math.round(((j + 0.5) / nb) * n)));
      _v.copy(dirs[k]).applyQuaternion(invQ);
      _d.setFromUnitVectors(Z, _v);
      _a.copy(_d).multiply(this.rest[j + 1]);
      this.bones[j].quaternion.copy(_p).invert().multiply(_a);
      _p.copy(_a);
    }
  }
}

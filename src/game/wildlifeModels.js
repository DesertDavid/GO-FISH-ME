import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Real animal models (downloaded, CC-BY; see public/credits.md) built by tools/blender/import_assets.py:
// nose +x, up +y, 1 unit = 1 m, feet on y = 0 for land animals, named clips (idle, walk, swim, ...).
// Loaded on demand and shared; instances are skeleton clones so each animal has its own pose.
const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
const loader = new GLTFLoader().setDRACOLoader(draco);
const files = {
  dolphin: 'dolphin', whale: 'whale', turtle: 'turtle', duck: 'duckloop', duckwalk: 'duckwalk', hippo: 'hippo',
  moose: 'moose', wolf: 'wolf', bear: 'bear', gator: 'alligator', pelican: 'pelican',
  ray: 'ray', deer: 'deer', bluebird: 'bluebird',
};
const cache = new Map();      // kind -> Promise<gltf | null>
const loaded = new Map();     // kind -> gltf

export function loadKinds(kinds) {
  return Promise.all([...new Set(kinds)].map((k) => {
    if (!cache.has(k)) {
      cache.set(k, loader.loadAsync(`${import.meta.env.BASE_URL}models/wildlife/${files[k]}.glb`)
        .then((g) => { loaded.set(k, g); return g; })
        .catch((e) => { console.warn('wildlife model', k, e); return null; }));
    }
    return cache.get(k);
  }));
}

export const hasModel = (kind) => loaded.has(kind);

// A fresh animal: { root, mixer, play(name, fade) } or null when the model is not loaded.
export function makeAnimal(kind, patchProp) {
  const g = loaded.get(kind);
  if (!g) return null;
  const root = clone(g.scene);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;   // skinned bounds come from the bind pose
    o.material = o.material.clone();
    if (patchProp) patchProp(o.material);
  });
  const wrap = new THREE.Group();
  wrap.add(root);
  const mixer = g.animations.length ? new THREE.AnimationMixer(root) : null;
  const actions = {};
  if (mixer) for (const c of g.animations) actions[c.name] = mixer.clipAction(c);
  let cur = null;
  const play = (name, fade = 0.35) => {
    const a = actions[name];
    if (!a || a === cur) return;
    a.reset().fadeIn(fade).play();
    if (cur) cur.fadeOut(fade);
    cur = a;
  };
  return { root: wrap, mixer, actions, play, clips: Object.keys(actions) };
}

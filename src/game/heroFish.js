import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Real (downloaded, CC-BY) fish models that stand in for the procedural bodies of some species.
// Built by tools/blender/import_assets.py (static mesh, nose +x, length 1, Draco + WEBP) from
// tools/assets/manifest.json; credits live in public/credits.md. buildFish() uses a hero model when it is
// loaded and falls back to the procedural body otherwise, so nothing waits on the download.
export const HERO_MODELS = {
  tuna: { file: 'fish/tuna.glb', species: ['yellowfin', 'blackfin', 'bluefin', 'skipjack', 'dogtooth'], tint: 0.18, tints: { bluefin: 0.8, blackfin: 0.65, skipjack: 0.7, dogtooth: 0.7 } },
  swordfish: { file: 'fish/swordfish.glb', species: ['swordfish'], tint: 0.12 },
  shark: { file: 'fish/shark.glb', species: ['mako', 'porbeagle', 'blacktip', 'lemonshark', 'tigershark'], tint: 0.6 },
  perch: { file: 'fish/bass.glb', species: ['yellowperch', 'sauger'], tint: 0.1 },
};
const BY_SPECIES = {};
for (const [id, m] of Object.entries(HERO_MODELS)) for (const s of m.species) BY_SPECIES[s] = id;

const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
const loader = new GLTFLoader().setDRACOLoader(draco);
const templates = {};      // model id -> [{ geometry, material }]

export const heroReady = Promise.all(Object.entries(HERO_MODELS).map(async ([id, m]) => {
  try {
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${m.file}`);
    const parts = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => { if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material }); });
    if (parts.length) templates[id] = parts;
  } catch (e) { console.warn('hero fish', id, e); }
}));

// a hero model for this species, or null (not mapped / not loaded yet)
export function heroFor(sp) {
  const id = BY_SPECIES[sp.id];
  return id && templates[id] ? { id, parts: templates[id], cfg: HERO_MODELS[id] } : null;
}

// grey-scale recolour toward the species/morph colours, keeping the photographic detail of the texture
function tintPatch(material, uniforms) {
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (base) base(shader, r);
    shader.uniforms.uTint = uniforms.uTint;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float heroL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint.rgb * (0.25 + heroL * 1.5), uTint.a);`);
  };
}

export function buildHero(hero, sp, morph, look, uniforms, swimPatch, opts) {
  const group = new THREE.Group();
  const normal = morph.id === 'normal';
  uniforms.uTint = { value: new THREE.Vector4() };
  const c = new THREE.Color(look.side);
  uniforms.uTint.value.set(c.r, c.g, c.b, normal ? (hero.cfg.tints?.[sp.id] ?? hero.cfg.tint) : 0.85);
  for (const p of hero.parts) {
    const m = p.material.clone();
    m.roughness = Math.min(m.roughness ?? 0.5, look.metal > 0.6 ? 0.35 : 0.5);
    m.envMapIntensity = 0.8;
    if (look.ghost) { m.transparent = true; m.opacity = 0.62; }
    tintPatch(m, uniforms);
    swimPatch(m, uniforms, opts.patchProp);
    const key = m.customProgramCacheKey();
    m.customProgramCacheKey = () => 'hero-' + key;   // different shader from the procedural fish that share swimPatch's key
    const mesh = new THREE.Mesh(p.geometry.clone(), m);
    mesh.frustumCulled = false;   // the swim wave bends the mesh outside its static bounds
    group.add(mesh);
  }
  return group;
}

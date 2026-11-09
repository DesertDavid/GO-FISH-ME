import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BODIES } from './fishBodies.js';
import { paintSkin, morphLook } from './fishSkin.js';
import { heroFor, buildHero } from './heroFish.js';

// Procedural fish: a lofted body (superellipse sections), planar fins, eyes, bill/barbels,
// a painted skin and a vertex-shader swim wave. Built at length 1 (head +x, tail -x), then
// scaled by the caller to the real length in metres.
const NL = 96, NA = 40;

// Most fish are flattened side to side; these body plans stay round in cross-section.
const ROUND = new Set(['tuna', 'pike', 'catfish', 'eel', 'sturgeon', 'shark', 'mackerel', 'billfish', 'swordfish', 'barracuda', 'cobia', 'gar', 'arapaima', 'bonefish', 'flat']);

export function bodyFor(sp) {
  const b = { ...BODIES[sp.body], ...(sp.o || {}) };
  b.kind = sp.body;
  b.lat = b.lat ?? (ROUND.has(sp.body) ? 1 : 0.68);
  return b;
}

// the snout sits lower than the eye: the centre line dips toward the mouth
function headDrop(b, t) {
  if (b.flatfish || t > 0.2) return 0;
  return -b.H * 0.07 * Math.pow(1 - t / 0.2, 2);
}

// where the gill cover's rear edge crosses height c (-1 belly .. 1 back)
function gillT(b, c) {
  return 0.135 + (b.snout || 0) + 0.035 * (1 - c * c);
}

function profile(b, t) {
  const { H, hp, blunt, stalk } = b;
  let h;
  if (t < hp) h = Math.pow(Math.sin((t / hp) * Math.PI / 2), blunt);
  else h = stalk + (1 - stalk) * Math.pow(Math.cos(((t - hp) / (1 - hp)) * Math.PI / 2), 1.15);
  if (b.snout && t < hp) {
    h *= THREE.MathUtils.smoothstep(t, 0, b.snout * 3) * 0.75 + 0.25 * Math.min(1, t / b.snout);
    // only true needle-nosed fish (gars) keep a pencil snout; pike etc. have a deep jaw
    if (b.snout < 0.15) h = Math.max(h, 0.32 * Math.min(1, t / 0.03));
  }
  return (h * H) / 2;
}
function widthAt(b, t) {
  const hp = Math.min(b.hp, 0.35);
  let w = t < hp ? Math.pow(Math.sin((t / hp) * Math.PI / 2), b.blunt * 0.8) : 0.18 + 0.82 * Math.pow(Math.cos(((t - hp) / (1 - hp)) * Math.PI / 2), 1.3);
  // duck-bill: long-snouted fish are broad across the jaws, not pinched
  if (b.snout && b.snout < 0.15 && t < b.snout * 2.5) w = Math.max(w, 0.5 * Math.min(1, t / 0.03));
  if (b.flatHead && t < 0.25) w *= 1.15;
  return (w * b.W * b.lat) / 2;
}

// Cross-section: an egg shape, widest a little below the middle and drawn to a ridge
// along the back and belly (the keel), with a mouth line carved into the head, a slight
// underbite and the rear edge of the gill cover raised as a ridge.
function sectionZ(b, c, s, w) {
  let z = Math.sign(s) * Math.pow(Math.abs(s), 0.95) * w;
  z *= 1 - 0.12 * c;                                   // fuller below the middle
  if (!ROUND.has(b.kind)) z *= 1 - 0.35 * Math.pow(Math.abs(c), 5);   // keel
  return z;
}

function bodyGeometry(b) {
  const pos = [], uv = [], idx = [];
  const mouthLen = b.mouth || 0.08;
  for (let i = 0; i <= NL; i++) {
    const t = Math.pow(i / NL, 1.2);
    const h = profile(b, t), w = widthAt(b, t), yc = headDrop(b, t);
    const belly = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, t / 0.7));
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      let x = 0.5 - t;
      let y = c * h * (c < 0 ? belly : 1);
      let z = sectionZ(b, c, s, w);
      if (b.flatHead && t < 0.3 && c < 0) y *= 0.7;   // flat belly under a wide head
      if (!b.flatfish && !b.underMouth && t < mouthLen * 1.1) {
        // mouth: a groove along the lips, deepest at the front
        const k = t / mouthLen;
        const lipC = b.upturned ? 0.15 - 0.3 * k : -0.05 - 0.22 * k;
        const d = Math.abs(c - lipC);
        if (d < 0.11) z *= 1 - 0.38 * (1 - d / 0.11) * (1 - 0.6 * Math.min(1, k));
        if (c < lipC && k < 0.6) x += 0.006 * (1 - k / 0.6);   // lower jaw juts forward
      }
      if (!b.flatfish && !b.gills && Math.abs(c) < 0.85) {
        // gill cover: a plate that swells slightly, ending in a sharp ridge
        const tg = gillT(b, c);
        // soft: a slight rise to the edge and a shallow groove after it (a deep step read as a collar)
        const g = b.flatHead ? 0.5 : 1;
        if (t > tg - 0.07 && t < tg) z *= 1 + 0.025 * g * Math.sin(((t - (tg - 0.07)) / 0.07) * Math.PI / 2);
        else if (t >= tg && t < tg + 0.025) z *= 1 + 0.025 * g - 0.05 * g * Math.sin(((t - tg) / 0.025) * Math.PI);
      }
      pos.push(x, y + yc, z);
      uv.push(t, j / NA);
    }
  }
  for (let i = 0; i < NL; i++) for (let j = 0; j < NA; j++) {
    const a = i * (NA + 1) + j, c = a + NA + 1;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- fins -------------------------------------------------------------------------------
// Every fin is built like a real one: rays fanning out from a base on the body, with a thin
// membrane stretched between them. Between each pair of rays there is a membrane column that
// can be shorter than the rays (the notches of a spiny fin) and sits slightly off-plane from
// them, so the membrane is pleated. finRay = (ray coordinate: cos peaks on the rays, 0..1 from
// base to edge) drives the fin shader.

// body surface height at t (top or bottom edge), matching bodyGeometry
function surfaceY(b, t, top) {
  t = Math.min(1, Math.max(0, t));
  const h = profile(b, t), belly = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, t / 0.7));
  return (top ? h * 0.96 : -h * belly * 0.96) + headDrop(b, t);
}

// bases/tips: arrays of [x, y] for each ray (in the fin's own plane). notch: how far the
// membrane between rays reaches (1 = straight edge, 0.5 = deep notches). pleat: fold depth.
function rayFin(bases, tips, { notch = 0.9, pleat = 0.003, segs = 5, fleshy = false } = {}) {
  if (fleshy) notch = 1;   // fleshy fins (adipose, sharks) have smooth edges
  const cols = [];
  for (let i = 0; i < bases.length; i++) {
    cols.push({ b: bases[i], t: tips[i], ray: true });
    if (i < bases.length - 1) {
      const b2 = bases[i + 1], t2 = tips[i + 1];
      const mb = [(bases[i][0] + b2[0]) / 2, (bases[i][1] + b2[1]) / 2];
      const mt = [(tips[i][0] + t2[0]) / 2, (tips[i][1] + t2[1]) / 2];
      cols.push({ b: mb, t: [mb[0] + (mt[0] - mb[0]) * notch, mb[1] + (mt[1] - mb[1]) * notch], ray: false });
    }
  }
  const pos = [], ray = [], uv = [], idx = [];
  cols.forEach((col, ci) => {
    const z = fleshy ? 0 : (col.ray ? 1 : -1) * pleat;
    for (let k = 0; k <= segs; k++) {
      const s = k / segs;
      // fleshy fins curve gently (so light shades across them); rayed fins pleat
      const zz = fleshy ? 0.006 * Math.sin(Math.PI * s * 0.9) : z * Math.min(1, s * 3);
      pos.push(col.b[0] + (col.t[0] - col.b[0]) * s, col.b[1] + (col.t[1] - col.b[1]) * s, zz);
      // rays sit on even columns: cos(ci * PI/2) = +-1 there, 0 between
      ray.push(fleshy ? Math.PI / 2 : ci * Math.PI / 2, s * (col.ray ? 1 : notch));
      uv.push(ci / (cols.length - 1), s);
    }
  });
  const R = segs + 1;
  for (let ci = 0; ci < cols.length - 1; ci++) for (let k = 0; k < segs; k++) {
    const a = ci * R + k, c = a + R;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('finRay', new THREE.Float32BufferAttribute(ray, 2));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// fin outline per shape: height at u (0 front .. 1 back of the base) and how far the rays
// lean back (radians)
const FIN_PROFILE = {
  tri: { h: (u) => (u < 0.3 ? 0.35 + (u / 0.3) * 0.65 : 1 - ((u - 0.3) / 0.7) * 0.8), lean: 0.45, notch: 0.85 },
  round: { h: (u) => Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * u)), 0.6), lean: 0.3, notch: 0.9 },
  long: { h: (u) => Math.min(1, u / 0.08 + 0.3) * (0.82 + 0.18 * Math.sin(Math.PI * u)) * Math.min(1, (1 - u) / 0.1 + 0.4), lean: 0.35, notch: 0.9 },
  sickle: { h: (u) => (u < 0.12 ? 0.75 + (u / 0.12) * 0.35 : 1.1 * Math.pow(1 - (u - 0.12) / 0.88, 1.6) + 0.08), lean: 0.95, notch: 0.92 },
  shark: { h: (u) => (u < 0.35 ? 0.8 + (u / 0.35) * 0.25 : 1.05 * Math.pow(1 - (u - 0.35) / 0.65, 1.3) + 0.05), lean: 0.75, notch: 0.97 },
  marlin: { h: (u) => (u < 0.1 ? 1 : 0.32 - 0.12 * u), lean: 0.35, notch: 0.9 },
  sail: { h: (u) => Math.pow(Math.sin(Math.PI * Math.min(0.97, 0.05 + u)), 0.55) * (1 - 0.15 * u), lean: 0.15, notch: 0.8 },
  filament: { h: (u) => (u > 0.92 ? 1.6 : u < 0.2 ? 0.4 + (u / 0.2) * 0.5 : 0.9 - (u - 0.2) * 0.6), lean: 0.6, notch: 0.85 },
  spiny: { h: (u) => (1 - 0.35 * u) * Math.min(1, 0.55 + u * 4), lean: 0.3, notch: 0.55 },
};

function finAlong(b, start, end, height, shape, top, extra = {}) {
  const P = FIN_PROFILE[shape] || FIN_PROFILE.round;
  // real fins have a handful of rays: ~10 spines in a bass's spiny dorsal, 12-15 soft rays
  const span = end - start;
  const n = shape === 'spiny' ? Math.max(6, Math.min(13, Math.round(span * 42))) : Math.max(5, Math.min(18, Math.round(span * 55)));
  const bases = [], tips = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), t = start + (end - start) * u;
    const x = 0.5 - t, y = surfaceY(b, t, top) * 0.97;
    const L = Math.max(0.004, P.h(u) * height * (b.gills ? 1 : jitter(i + start * 97)));
    const lean = P.lean * (0.6 + 0.4 * u);
    bases.push([x, y]);
    tips.push([x - Math.sin(lean) * L, y + Math.cos(lean) * L * (top ? 1 : -1)]);
  }
  return rayFin(bases, tips, { notch: P.notch, pleat: 0.0012 * Math.min(1, height / 0.1 + 0.3), fleshy: !!b.gills, ...extra });
}

// small fixed irregularity in ray length so edges aren't machine-perfect
function jitter(k) {
  const s = Math.sin(k * 12.9898) * 43758.5453;
  return 0.95 + 0.1 * (s - Math.floor(s));
}

// tail: rays radiating from the peduncle; length by angle gives fork / crescent / square / round
function tailGeometry(b) {
  const [type, size] = b.tail;
  const sh = Math.max(profile(b, 1) * 0.95, 0.008);
  const x0 = -0.495, n = 15;
  const spread = { fork: 1.0, lunate: 1.1, truncate: 0.75, round: 0.85, hetero: 1.0 }[type] ?? 1;
  const len = (s) => {
    const a = Math.abs(s);
    switch (type) {
      case 'lunate': return 0.22 + 0.42 * Math.pow(a, 1.8);   // tuna-style crescent: span about a third of body length
      case 'truncate': return 0.8 + 0.12 * a;
      case 'round': return 0.95 - 0.3 * a * a;
      case 'hetero': return s > 0 ? 0.35 + 0.9 * Math.pow(a, 1.2) : 0.3 + 0.35 * a;
      default: return 0.45 + 0.75 * Math.pow(a, 1.5);   // fork
    }
  };
  const bases = [], tips = [];
  for (let i = 0; i < n; i++) {
    const s = 1 - (2 * i) / (n - 1);                     // +1 top .. -1 bottom
    const phi = s * spread * (type === 'hetero' && s > 0 ? 0.85 : 1);
    const L = size * len(s) * (b.gills ? 1 : jitter(i + 7));
    const by = s * sh;
    bases.push([x0, by]);
    tips.push([x0 - Math.cos(phi) * L, by + Math.sin(phi) * L * 0.95]);
  }
  return rayFin(bases, tips, { notch: type === 'round' || type === 'truncate' ? 0.96 : 0.93, pleat: 0.0015, segs: 7, fleshy: !!b.gills });
}

// paired fins: built flat, folded back along the body, then mounted
function pairedFin(b, size, side, t, down, spread, angleX, angleY) {
  const n = 8, bases = [], tips = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    if (b.gills) {
      // shark: a swept blade, rooted along the body, longest at the leading edge
      const bx = -u * size * 0.35;
      const phi = -0.75 - u * 0.25;
      const L = size * (1 - 0.72 * u);
      bases.push([bx, 0]);
      tips.push([bx - Math.cos(-phi) * L * 0.7, -Math.sin(-phi) * L]);
      continue;
    }
    const by = (0.5 - u) * size * 0.35;
    const phi = -0.15 - u * spread;                       // fan backward and downward
    const L = size * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.15))) * jitter(i + 31);
    bases.push([0, by]);
    tips.push([-Math.cos(phi) * L, by + Math.sin(phi) * L]);
  }
  const g = rayFin(bases, tips, { notch: 0.92, pleat: 0.001, segs: 4, fleshy: !!b.gills });
  // tilt the free edge away from the body (negative X rotation sends -y outward on +z)
  g.rotateX(-side * angleX);
  g.rotateY(side * angleY);
  // mount on the skin at that height, not inside it
  const h = profile(b, t), yS = surfaceY(b, t, false) * down + headDrop(b, t) * (1 - down);
  const c = THREE.MathUtils.clamp((yS - headDrop(b, t)) / Math.max(h, 1e-4), -0.95, 0.95);
  const zS = Math.abs(sectionZ(b, c, Math.sqrt(1 - c * c), widthAt(b, t))) + 0.002;
  g.translate(0.5 - t, yS, zS * side);
  return g;
}
// pectorals lie back along the flank, tipped out a little so they show from the side;
// pelvics hang under the belly
const pectoral = (b, size, side) => pairedFin(b, size, side, gillT(b, -0.3) + 0.015, 0.4, 0.9, 0.42, 0.12);
const pelvic = (b, size, side) => pairedFin(b, size, side, 0.4, 0.92, 0.5, 0.6, 0.08);

const SWIM_VERT = /* glsl */`
  float swimT = clamp(0.5 - position.x, 0.0, 1.25);
  float swimW = 0.12 + swimT * swimT;
  transformed.z += sin(uSwim.x * uSwim.z - swimT * 5.5) * uSwim.y * swimW;
  transformed.x -= abs(sin(uSwim.x * uSwim.z - swimT * 5.5)) * uSwim.y * swimW * 0.15;
`;

function swimPatch(material, uniforms, patchProp) {
  if (patchProp) patchProp(material);
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (base) base(shader, r);
    shader.uniforms.uSwim = uniforms.uSwim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSwim;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWIM_VERT);
  };
  material.customProgramCacheKey = () => 'fish-' + (patchProp ? 'p' : 'n') + (material.transparent ? 't' : 'o');
}

// fin membrane: dark rays, lighter see-through edges
const FIN_VERT_PARS = `attribute vec2 finRay;
varying vec2 vFinRay;`;
const FIN_FRAG = /* glsl */`
  // rays: darker, nearly opaque; membrane: lighter and see-through toward the edge
  float rayLine = pow(abs(cos(vFinRay.x)), 28.0);
  float edge = vFinRay.y;
  diffuseColor.rgb *= mix(1.0, 0.55, rayLine);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.03, smoothstep(0.5, 1.0, edge) * (1.0 - rayLine));
  diffuseColor.a *= mix(mix(0.7, 0.22, smoothstep(0.2, 1.0, edge)), 0.95, rayLine);
`;
function finPatch(material) {
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    base(shader, r);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${FIN_VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vFinRay = finRay;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vFinRay;`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
${FIN_FRAG}`)
      // pleats: the membrane folds between rays, so light catches alternate bands
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(normal + vec3(sin(vFinRay.x) * 0.08, 0.0, 0.0));`);
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => key() + '-fin';
}

// shared tangent-space normal map of overlapping scales (u along the body, v around it)
let scaleNormal = null;
function scaleNormalMap() {
  if (scaleNormal) return scaleNormal;
  const N = 256, h = new Float32Array(N * N);
  const rows = 8, cols = 8, cw = N / cols, rh = N / rows;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let best = 0;
    for (let r = -1; r <= rows; r++) {
      const off = (r & 1) * cw * 0.5;
      for (let c = -1; c <= cols; c++) {
        // each scale: a dome whose free edge points toward the tail (+x)
        const cx = c * cw + off, cy = r * rh;
        const dx = (((x - cx) % N) + N + N / 2) % N - N / 2, dy = (((y - cy) % N) + N + N / 2) % N - N / 2;
        const d = Math.hypot(dx / (cw * 0.62), dy / (rh * 0.62));
        if (d < 1 && dx > -cw * 0.45) best = Math.max(best, (1 - d * d) * (0.4 + 0.6 * Math.min(1, (dx + cw * 0.45) / cw)));
      }
    }
    h[y * N + x] = best;
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const at = (i, j) => h[((j + N) % N) * N + ((i + N) % N)];
    const nx = (at(x - 1, y) - at(x + 1, y)) * 2.5, ny = (at(x, y - 1) - at(x, y + 1)) * 2.5;
    const l = Math.hypot(nx, ny, 1), k = (y * N + x) * 4;
    data[k] = (nx / l * 0.5 + 0.5) * 255; data[k + 1] = (ny / l * 0.5 + 0.5) * 255; data[k + 2] = (1 / l * 0.5 + 0.5) * 255; data[k + 3] = 255;
  }
  scaleNormal = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  scaleNormal.wrapS = scaleNormal.wrapT = THREE.RepeatWrapping;
  scaleNormal.repeat.set(16, 7);
  scaleNormal.generateMipmaps = true;
  scaleNormal.minFilter = THREE.LinearMipmapLinearFilter;
  scaleNormal.magFilter = THREE.LinearFilter;
  scaleNormal.needsUpdate = true;
  return scaleNormal;
}
const SMOOTH_SKIN = new Set(['catfish', 'shark', 'sturgeon', 'eel', 'mackerel', 'billfish', 'swordfish']);

const textureCache = new Map();

// Build a fish model. opts: { patchProp } patches materials for underwater lighting.
export function buildFish(sp, morph, opts = {}) {
  const b = bodyFor(sp);
  const look = morphLook(sp, morph);
  const hero = heroFor(sp);
  if (hero) {   // a real model (see heroFish.js); same uniforms and swim wave as the procedural fish
    const uniforms = { uSwim: { value: new THREE.Vector3(0, 0.025, 9) } };
    const group = buildHero(hero, sp, morph, look, uniforms, swimPatch, opts);
    return { group, uniforms, body: b, look };
  }
  const key = sp.id + ':' + morph.id;
  let tex = textureCache.get(key);
  if (!tex) {
    tex = paintSkin(sp, b, look);
    textureCache.set(key, tex);
  }
  const uniforms = { uSwim: { value: new THREE.Vector3(0, 0.025, 9) } };
  // wet skin: clear coat over the scales, a little iridescence on the silvery species
  const smooth = SMOOTH_SKIN.has(sp.body);
  // a thin wet film over the scales, not a lacquer: low clear coat, satin base
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: tex, roughness: look.metal > 0.6 ? 0.32 : 0.5, metalness: look.metal * 0.5,
    normalMap: scaleNormalMap(), normalScale: new THREE.Vector2(smooth ? 0.08 : 0.32, smooth ? 0.08 : 0.32),
    clearcoat: 0.35, clearcoatRoughness: 0.25,
    iridescence: look.metal > 0.4 ? 0.5 : 0.05, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520],
    transparent: look.ghost, opacity: look.ghost ? 0.62 : 1, envMapIntensity: 0.8,
  });
  swimPatch(bodyMat, uniforms, opts.patchProp);
  // sharks: fins are solid cartilage under skin, so opaque and ray-free; everything else
  // gets the ray-and-membrane fin shader
  const cartilage = !!b.gills;
  const finMat = new THREE.MeshStandardMaterial({
    color: look.fin, roughness: cartilage ? 0.55 : 0.45, metalness: 0.05, side: THREE.DoubleSide,
    transparent: !cartilage || look.ghost, opacity: look.ghost ? 0.45 : cartilage ? 1 : 0.95, depthWrite: cartilage,
  });
  swimPatch(finMat, uniforms, opts.patchProp);
  finPatch(finMat);   // cartilage fins: no rays (fleshy), but the same base-to-edge shading

  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeometry(b), bodyMat);
  group.add(body);

  const fins = [];
  for (const [s, e, h, shape] of b.dorsal) {
    const sail = sp.o?.sail && shape === 'marlin';
    if (shape === 'spiny' && e - s > 0.3) {
      // long dorsals (snapper, grouper, sunfish) are spines in front and soft rays behind
      const m = s + (e - s) * 0.55;
      fins.push(finAlong(b, s, m, h, 'spiny', true), finAlong(b, m - 0.01, e, h * 1.1, 'round', true));
      continue;
    }
    fins.push(finAlong(b, s, e, sail ? 0.42 : sp.o?.dorsalTall ? h * 1.6 : h, sail ? 'sail' : shape, true));
  }
  for (const [s, e, h, shape] of b.anal || []) fins.push(finAlong(b, s, e, h, shape || 'round', false));
  if (b.adipose) fins.push(finAlong(b, 0.78, 0.84, 0.03, 'round', true, { fleshy: true }));
  if (b.finlets) {
    for (let i = 0; i < 6; i++) {
      const t = 0.62 + i * 0.05;
      fins.push(finAlong(b, t, t + 0.025, 0.018, 'tri', true), finAlong(b, t, t + 0.025, 0.018, 'tri', false));
    }
  }
  fins.push(tailGeometry(b));
  const ps = b.pect * (sp.o?.longfins ? 1.8 : 1);
  fins.push(pectoral(b, ps, 1), pectoral(b, ps, -1));
  if (!b.flatfish) fins.push(pelvic(b, b.pect * 0.7, 1), pelvic(b, b.pect * 0.7, -1));
  group.add(new THREE.Mesh(mergeGeometries(fins), finMat));

  // eyes
  // eyes: set into the head at the surface (only the cornea bulges), with a dark rim
  const eyeR = 0.021 * (sp.eye || 1) * (b.H > 0.4 ? 1.2 : 1);
  const te = Math.max(0.065, (b.snout || 0) * 0.9 + 0.075);
  const hE = profile(b, te), cE = b.flatfish ? 0.55 : 0.32;
  const ex = 0.5 - te, ey = hE * cE + headDrop(b, te);
  const ez = Math.abs(sectionZ(b, cE, Math.sqrt(1 - cE * cE), widthAt(b, te))) - eyeR * 0.45;
  const irisMat = new THREE.MeshPhysicalMaterial({ color: look.iris, roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.02 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: look.pupil, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.back).multiplyScalar(0.45), roughness: 0.6 });
  [irisMat, pupilMat, rimMat].forEach((m) => swimPatch(m, uniforms, opts.patchProp));
  const sides = b.flatfish ? [1, 1] : [1, -1];
  const eyeParts = { iris: [], pupil: [], rim: [] };
  sides.forEach((side, k) => {
    const off = b.flatfish ? (k ? -0.035 : 0.0) : 0;
    const c = new THREE.Vector3(ex + off, ey + (b.flatfish ? k * 0.03 : 0), ez * side);
    const out = new THREE.Vector3(0.15, 0.1, side).normalize();   // eyes look a little forward and up
    const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
    const place = (g, push) => g.applyQuaternion(turn).translate(c.x + out.x * push, c.y + out.y * push, c.z + out.z * push);
    eyeParts.iris.push(place(new THREE.SphereGeometry(eyeR, 20, 14), 0));
    eyeParts.pupil.push(place(new THREE.SphereGeometry(eyeR * 0.55, 14, 10).scale(1, 1.15, 0.6), eyeR * 0.72));
    eyeParts.rim.push(place(new THREE.TorusGeometry(eyeR * 1.02, eyeR * 0.2, 8, 24), eyeR * 0.15));
  });
  group.add(new THREE.Mesh(mergeGeometries(eyeParts.iris), irisMat), new THREE.Mesh(mergeGeometries(eyeParts.pupil), pupilMat), new THREE.Mesh(mergeGeometries(eyeParts.rim), rimMat));

  const extraMat = new THREE.MeshStandardMaterial({ color: look.back, roughness: 0.5, metalness: 0.1 });
  swimPatch(extraMat, uniforms, opts.patchProp);
  const extras = [];
  if (b.bill) {
    const L = b.bill;
    const g = new THREE.ConeGeometry(b.flatBill ? 0.018 : 0.011, L, 10);
    g.rotateZ(-Math.PI / 2);
    if (b.flatBill) g.scale(1, 0.45, 1.6);
    g.translate(0.5 + L / 2 - 0.01, profile(b, 0.02) * 0.2, 0);
    extras.push(g);
  }
  const barbels = sp.barbel ?? b.barbel ?? 0;
  for (let i = 0; i < barbels; i++) {
    const side = i % 2 ? 1 : -1, long = i < 2;
    const L = long ? 0.12 : 0.06;
    const g = new THREE.CylinderGeometry(0.0015, 0.004, L, 5);
    g.translate(0, -L / 2, 0);
    g.rotateZ(-0.9 - (long ? 0 : 0.6));
    g.rotateY(side * (long ? 0.7 : 0.3));
    g.translate(0.49, -profile(b, 0.02) * 0.4, side * 0.01);
    extras.push(g);
  }
  if (sp.hammer) {
    const g = new THREE.SphereGeometry(0.05, 16, 8);
    g.scale(0.7, 0.25, 3.0);
    g.translate(0.47, 0.0, 0);
    extras.push(g);
  }
  if (extras.length) group.add(new THREE.Mesh(mergeGeometries(extras), extraMat));

  if (b.flatfish) group.rotation.x = -Math.PI / 2;   // eyed side up, lying on the bottom
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group, uniforms, body: b, look };
}

// metres from lb
export function fishLengthM(sp, lb) {
  const b = bodyFor(sp);
  const inches = Math.cbrt(lb / b.cond);
  return { inches, m: inches * 0.0254 };
}

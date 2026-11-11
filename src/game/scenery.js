import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm } from '../scene/noise.js';

// Location dressing: instanced trees/reeds/cabins, the Gulf oil rig, and fish hotspots
// (a bait ball under the surface with gulls wheeling over it).
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const paint = (g, hex, jitter = 0, rand = Math.random) => {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = 1 + (rand() - 0.5) * jitter;
    a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
};
const blob = (r, detail, rand, squash = 1) => {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.8 + rand() * 0.4;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
};

// a tapered ribbon (blade of grass): base point, lean direction, height, width, arch; colours base -> tip
function blade(bx, bz, ang, h, w, arch, c0, c1, c2, seg = 2) {
  const pos = [], col = [], idx = [];
  const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx;
  const k0 = new THREE.Color(c0), k1 = new THREE.Color(c1), k2 = new THREE.Color(c2), c = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, out = arch * h * t * t, y = h * (1 - 0.18 * t * t) * t, ww = w * (1 - t) * 0.5 + (i === seg ? 0 : 0.002);
    const x = bx + dx * out, z = bz + dz * out;
    c.copy(t < 0.5 ? k0.clone().lerp(k1, t * 2) : k1.clone().lerp(k2, (t - 0.5) * 2));
    if (i === seg) { pos.push(x, y, z); col.push(c.r, c.g, c.b); } else {
      pos.push(x - px * ww, y, z - pz * ww, x + px * ww, y, z + pz * ww); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < seg - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const a = (seg - 1) * 2; idx.push(a, a + 1, a + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

// ---- organic tree parts: ragged skirts, bark and foliage gradients -------------------------------------
// a drooping conifer tier: open cone, ragged rim that sags, dark inside to light tips
function tier(r, h, y, rand, cBase, cTip, seg = 9, sag = 0.35) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, true), p = g.attributes.position, n = p.count, col = new Float32Array(n * 3), cb = new THREE.Color(cBase), ct = new THREE.Color(cTip), c = new THREE.Color();
  const jit = []; for (let i = 0; i < seg + 1; i++) jit.push(1 + (rand() - 0.5) * 0.42);
  for (let i = 0; i < n; i++) {
    let x = p.getX(i), yy = p.getY(i), z = p.getZ(i); const t = Math.min(1, Math.max(0, (yy + h / 2) / h)), a = Math.atan2(z, x), j = jit[Math.floor(((a + Math.PI) / (Math.PI * 2)) * seg) % (seg + 1)];
    const rim = 1 - Math.min(1, t * 2); x *= 1 + (j - 1) * rim; z *= 1 + (j - 1) * rim; yy -= rim * rim * sag * (0.4 + j * 0.6);
    p.setXYZ(i, x, yy + y + h / 2, z);
    c.copy(cb).lerp(ct, Math.pow(t, 0.8)).multiplyScalar(0.88 + rand() * 0.24); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); g.computeVertexNormals();
  { const q = g.attributes.normal; for (let i = 0; i < q.count; i++) { const nx = q.getX(i) * 0.6, ny = q.getY(i) * 0.6 + 0.55, nz = q.getZ(i) * 0.6, l = Math.hypot(nx, ny, nz) || 1; q.setXYZ(i, nx / l, ny / l, nz / l); } }   // soften: lean the normals up so the underside is not black
  return g.toNonIndexed();
}
// a tapered trunk / limb with a bark gradient (dark at the base), optionally leaned
function limb(r0, r1, len, rand, c0, c1, lean = [0, 0], base = [0, 0, 0], seg = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 3).translate(0, len / 2, 0), p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; c.copy(a).lerp(b, t).multiplyScalar(0.85 + rand() * 0.3); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv');
  g.rotateZ(lean[0]).rotateX(lean[1]).translate(base[0], base[1], base[2]);
  return g.index ? g.toNonIndexed() : g;
}
// a foliage clump: flattened lumpy blob, dark underside and a lit top
function clump(r, x, y, z, rand, cLow, cHigh, squash = 0.62, detail = 0) {
  const g = blob(r, detail, rand, squash).toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3), nn = new Float32Array(p.count * 3), lo = new THREE.Color(cLow), hi = new THREE.Color(cHigh), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), t = Math.min(1, Math.max(0, (py / (r * squash) + 1) / 2));
    c.copy(lo).lerp(hi, t).multiplyScalar(0.9 + rand() * 0.2); col.set([c.r, c.g, c.b], i * 3);
    const ny = py / Math.max(squash, 0.3) + r * 0.25, l = Math.hypot(px, ny, pz) || 1; nn[i * 3] = px / l; nn[i * 3 + 1] = ny / l; nn[i * 3 + 2] = pz / l;   // rounded, softly lit volume instead of flat facets
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); g.deleteAttribute('uv'); g.translate(x, y, z);
  return g;
}

const CONIFERS = new Set(['jeffrey', 'whitefir', 'cedar', 'lodgepole']);
const TREE_BUILDERS = {
  // tall arching water grass (sawgrass / maidencane): a fan of ribbons, olive at the root, green-yellow to tan at the tips
  sawgrass(rand) {
    const parts = [], n = 12;
    const tips = [[0x4a5a24, 0x86983a, 0xb4ae62], [0x55652a, 0x94a444, 0xc2b66c], [0x46561f, 0x7c9034, 0xa8a45a]][Math.floor(rand() * 3)];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = rand() * 0.55, h = 0.7 + rand() * 0.55;
      parts.push(blade(Math.cos(a) * r, Math.sin(a) * r, a + (rand() - 0.5) * 0.9, h, 0.09 + rand() * 0.06, 0.25 + rand() * 0.5, tips[0], tips[1], tips[2], 1));
    }
    return mergeGeometries(parts);
  },
  // bulrush / cattail: straight dark stems with brown seed heads, a few leaf blades
  bulrush(rand) {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const h = 1.7 + rand() * 1.1, a = rand() * Math.PI * 2, r = rand() * 0.3, lean = (rand() - 0.5) * 0.14;
      const stem = new THREE.CylinderGeometry(0.012, 0.022, h, 3, 1, true).translate(0, h / 2, 0).rotateZ(lean).translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      parts.push(paint(stem, 0x56702e, 0.25, rand));
      if (i % 2 === 0) parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 5, 1, true).translate(0, h - 0.3, 0).rotateZ(lean).translate(Math.cos(a) * r, 0, Math.sin(a) * r), 0x5a3c22, 0.2, rand));
    }
    for (let i = 0; i < 3; i++) { const a = rand() * Math.PI * 2; parts.push(blade(Math.cos(a) * 0.15, Math.sin(a) * 0.15, a, 1.2 + rand() * 0.8, 0.07, 0.25 + rand() * 0.3, 0x435a22, 0x6f8a36, 0x9aa456)); }
    return mergeGeometries(parts);
  },
  // spatterdock / lily pads floating flat on the water, an occasional yellow bloom
  lily(rand) {
    const parts = [], n = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const r = 0.2 + rand() * 0.22, a = rand() * Math.PI * 2, d = rand() * 1.1;
      const pad = new THREE.CircleGeometry(r, 9, rand() * 6, Math.PI * 2 - 0.55).rotateX(-Math.PI / 2).rotateY(rand() * 6).translate(Math.cos(a) * d, 0, Math.sin(a) * d);
      parts.push(paint(pad, rand() < 0.5 ? 0x3c6a2a : 0x56802f, 0.3, rand));
    }
    if (rand() < 0.4) parts.push(paint(new THREE.SphereGeometry(0.07, 6, 4).scale(1, 0.7, 1).translate((rand() - 0.5) * 0.8, 0.05, (rand() - 0.5) * 0.8), 0xe0c030));
    return mergeGeometries(parts);
  },
  pine(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.18, 0.3, 4, 6).translate(0, 2, 0), 0x4a3424)];
    for (let i = 0; i < 5; i++) {
      const r = 2.6 - i * 0.45, y = 2.5 + i * 2.1;
      parts.push(paint(new THREE.ConeGeometry(r, 3.4, 9).translate(0, y, 0), 0x1f3a24, 0.25, rand));
    }
    return mergeGeometries(parts);
  },
  lodgepole(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.12, 0.22, 11, 5).translate(0, 5.5, 0), 0x6a5a48)];
    for (let i = 0; i < 4; i++) parts.push(paint(new THREE.ConeGeometry(1.15 - i * 0.18, 2.8, 6).translate(0, 7 + i * 1.7, 0), 0x4c6a34, 0.3, rand));
    return mergeGeometries(parts);
  },
  aspen(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.1, 0.17, 8, 5).translate(0, 4, 0), 0xe8e4d8)];
    for (let i = 0; i < 3; i++) parts.push(paint(blob(1.5 + rand() * 0.5, 1, rand, 1.15).translate((rand() - 0.5) * 1.1, 7 + i * 0.9, (rand() - 0.5) * 1.1), i % 2 ? 0x8aa63c : 0x6e9a34, 0.3, rand));
    return mergeGeometries(parts);
  },
  alder(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.16, 0.28, 5, 6).translate(0, 2.5, 0), 0x6a604e)];
    for (let i = 0; i < 3; i++) parts.push(paint(blob(2.1, 1, rand, 0.95).translate((rand() - 0.5) * 2, 5.4 + rand() * 1.2, (rand() - 0.5) * 2), i % 2 ? 0x4e7a30 : 0x5d8a34, 0.3, rand));
    return mergeGeometries(parts);
  },
  // ---- San Bernardino Mountains natives (Big Bear): Jeffrey pine, white fir, incense cedar, black / canyon live oak,
  // juniper, manzanita, scrub oak chaparral, sagebrush, Mojave yucca, willow -------------------------------------
  // Jeffrey pine: tall bare plated-orange trunk, a few heavy limbs, open tufts of long blue-green needles
  jeffrey(rand) {
    const H = 11 + rand() * 4, parts = [limb(0.42, 0.14, H, rand, 0x5a3a28, 0xa86a3e, [(rand() - 0.5) * 0.06, 0])];
    const nb = 6;
    for (let i = 0; i < nb; i++) {
      const t = i / nb, y = H * (0.5 + t * 0.48), a = rand() * 6.283, len = 1.6 * (1.15 - t * 0.7) + rand() * 0.6, cx = Math.cos(a) * len, cz = Math.sin(a) * len;
      for (let k = 0; k < 1; k++) parts.push(clump(1.35 - t * 0.35 + rand() * 0.4, cx, y + 0.25 + rand() * 0.5, cz, rand, 0x3a5a3a, 0x7a9a58, 0.5));
    }
    parts.push(clump(1.1, 0, H + 0.35, 0, rand, 0x40623e, 0x86a460, 0.9));
    return mergeGeometries(parts);
  },
  // white fir: dense regular tiers of blue-green boughs, ragged skirts, grey bark
  whitefir(rand) {
    const parts = [limb(0.3, 0.1, 5, rand, 0x4a4238, 0x6a6258)], n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), r = 2.7 * (1 - t) ** 0.9 + 0.35, hh = 2.3 - t * 0.7;
      parts.push(tier(r, hh, 1.6 + i * 1.28, rand, 0x3a6a52, 0x82ac90, 9, 0.55));
    }
    parts.push(tier(0.3, 1.4, 1.6 + n * 1.28, rand, 0x4a7a62, 0x92b8a0, 6, 0.1));
    return mergeGeometries(parts);
  },
  // incense cedar: a narrow flame-shaped column, flat sprays, rusty fibrous trunk
  cedar(rand) {
    const parts = [limb(0.38, 0.12, 3, rand, 0x5a2e22, 0x7a4a34)], n = 7;
    for (let i = 0; i < n; i++) { const t = i / (n - 1), r = 1.55 * (1 - t * 0.78) + 0.2; parts.push(tier(r, 2.3 - t * 0.6, 1.4 + i * 1.55, rand, 0x2e5a30, 0x6a9a50, 8, 0.35)); }
    return mergeGeometries(parts);
  },
  // black oak / canyon live oak: short fork, wide domed crown of dense clumps
  oak(rand) {
    const parts = [limb(0.42, 0.28, 2.4, rand, 0x2e241c, 0x4a3c30), limb(0.22, 0.12, 2.4, rand, 0x3a2e24, 0x54463a, [0.55, 0.1], [0, 1.9, 0]), limb(0.22, 0.12, 2.4, rand, 0x3a2e24, 0x54463a, [-0.5, -0.25], [0, 1.9, 0]), limb(0.2, 0.1, 2.2, rand, 0x3a2e24, 0x54463a, [0.05, -0.6], [0, 1.9, 0])];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + rand(), r = 1.2 + rand() * 1.5; parts.push(clump(1.9 + rand() * 0.9, Math.cos(a) * r, 3.9 + rand() * 1.1, Math.sin(a) * r, rand, 0x233d22, 0x5a7c36, 0.68)); }
    parts.push(clump(2.2, 0, 5.4, 0, rand, 0x2c4a28, 0x6a8c3e, 0.7));
    return mergeGeometries(parts);
  },
  // California / Utah juniper: a twisted shaggy trunk and bare limbs, grey-green scale foliage in tufts
  juniper(rand) {
    const parts = [limb(0.4, 0.2, 2.6, rand, 0x4a3a2c, 0x7a5e44, [0.12, 0.05]), limb(0.2, 0.1, 2.2, rand, 0x5a4636, 0x84684c, [-0.5, 0.2], [0, 1.6, 0], 5), limb(0.18, 0.1, 2, rand, 0x5a4636, 0x84684c, [0.45, -0.3], [0, 1.4, 0], 5)];
    for (let i = 0; i < 5; i++) { const a = rand() * 6.283, r = 0.4 + rand() * 1.1; parts.push(clump(1.1 + rand() * 0.6, Math.cos(a) * r, 2.6 + rand() * 1.5, Math.sin(a) * r, rand, 0x43553a, 0x7f9166, 0.8)); }
    return mergeGeometries(parts);
  },
  // scrub oak / ceanothus chaparral: a dense domed mound
  chaparral(rand) {
    const parts = [];
    for (let i = 0; i < 6; i++) { const a = rand() * 6.283, r = rand() * 0.9; parts.push(clump(0.75 + rand() * 0.55, Math.cos(a) * r, 0.5 + rand() * 0.55, Math.sin(a) * r, rand, 0x40502c, [0x7e8a4a, 0x8a9050, 0x6a7c40][i % 3], 0.8)); }
    return mergeGeometries(parts);
  },
  // manzanita: smooth mahogany limbs, glossy olive leaf clusters, an occasional pink blossom head
  manzanita(rand) {
    const parts = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + rand() * 0.5, lean = 0.35 + rand() * 0.45; parts.push(limb(0.07, 0.035, 1.7 + rand() * 0.8, rand, 0x5a1e14, 0x8a3a24, [-Math.cos(a) * lean, Math.sin(a) * lean], [0, 0, 0], 4)); }
    for (let i = 0; i < 6; i++) { const a = rand() * 6.283, r = 0.5 + rand() * 0.9; parts.push(clump(0.55 + rand() * 0.35, Math.cos(a) * r, 1.0 + rand() * 0.9, Math.sin(a) * r, rand, 0x3a5030, [0x7a9448, 0x8aa050][i % 2], 0.75)); }
    if (rand() < 0.35) parts.push(clump(0.28, rand() - 0.5, 1.9, rand() - 0.5, rand, 0xd9b0b0, 0xf2dede, 0.9, 0));
    return mergeGeometries(parts);
  },
  // sagebrush / white sage: a low silvery-grey mound
  sage(rand) {
    const parts = [];
    for (let i = 0; i < 5; i++) { const a = rand() * 6.283, r = rand() * 0.6; parts.push(clump(0.4 + rand() * 0.3, Math.cos(a) * r, 0.28 + rand() * 0.3, Math.sin(a) * r, rand, 0x707a64, [0xaab29c, 0x9ca894, 0xb4baa8][i % 3], 0.7)); }
    return mergeGeometries(parts);
  },
  // Mojave yucca of the dry east side: a rosette of stiff pale blades on a short trunk
  yucca(rand) {
    const top = 1.2 + rand() * 0.8, parts = [limb(0.16, 0.1, top, rand, 0x5a4a34, 0x8a7656, [0.05, 0], [0, 0, 0], 5)];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283 + rand() * 0.3; parts.push(blade(Math.cos(a) * 0.05, Math.sin(a) * 0.05, a, 0.95 + rand() * 0.5, 0.07, 0.35 + rand() * 0.25, 0x5a6a3a, 0x8a9a5a, 0xc0b078, 2).translate(0, top, 0)); }
    return mergeGeometries(parts);
  },
  // willow / cottonwood by the water: a forked trunk under a loose crown with hanging fronds
  willow(rand) {
    const parts = [limb(0.3, 0.16, 3.6, rand, 0x4a4030, 0x6a604a, [0.15, 0]), limb(0.16, 0.08, 2.6, rand, 0x5a5040, 0x7a6e56, [-0.6, 0.1], [0, 2.8, 0], 5)];
    for (let i = 0; i < 5; i++) { const a = rand() * 6.283, r = 0.9 + rand() * 1.1; parts.push(clump(1.5 + rand() * 0.5, Math.cos(a) * r, 4.3 + rand() * 1.0, Math.sin(a) * r, rand, 0x5a7a38, 0xa0bc58, 0.7)); }
    return mergeGeometries(parts);
  },
  birch(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.12, 0.2, 7, 6).translate(0, 3.5, 0), 0xe8e4dc)];
    parts.push(paint(blob(2.4, 1, rand, 1.3).translate(0, 8, 0), 0x5a8a34, 0.3, rand));
    parts.push(paint(blob(1.8, 1, rand, 1.2).translate(0.9, 6.6, 0.4), 0x6a9a3a, 0.3, rand));
    return mergeGeometries(parts);
  },
  cypress(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.25, 0.8, 9, 7).translate(0, 4.5, 0), 0x6a5a48)];
    for (let i = 0; i < 3; i++) parts.push(paint(blob(2.2, 1, rand, 0.45).translate((rand() - 0.5) * 2, 8.5 + i * 1.2, (rand() - 0.5) * 2), 0x4a6a2a, 0.3, rand));
    return mergeGeometries(parts);
  },
  palm(rand) {
    const parts = [];
    let x = 0, y = 0;
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.CylinderGeometry(0.2, 0.25, 1.6, 6).translate(0, 0.8, 0).rotateZ(-0.08 * i).translate(x, y, 0);
      parts.push(paint(seg, 0x8a7458, 0.15, rand));
      x += Math.sin(0.08 * i) * 1.6; y += Math.cos(0.08 * i) * 1.6;
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const leaf = new THREE.PlaneGeometry(3.6, 0.7, 4, 1);
      const p = leaf.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) + 1.8; p.setY(i, p.getY(i) - 0.12 * u * u); }
      leaf.translate(1.8, 0, 0).rotateX(Math.PI / 2).rotateZ(-0.3).rotateY(a).translate(x, y, 0);
      parts.push(paint(leaf, 0x3a6a24, 0.3, rand));
    }
    return mergeGeometries(parts);
  },
  jungle(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.3, 0.6, 14, 7).translate(0, 7, 0), 0x5a4a38)];
    for (let i = 0; i < 4; i++) parts.push(paint(blob(3.5, 1, rand, 0.7).translate((rand() - 0.5) * 4, 13 + rand() * 3, (rand() - 0.5) * 4), i % 2 ? 0x2a5a1c : 0x3a6a22, 0.3, rand));
    return mergeGeometries(parts);
  },
  mangrove(rand) {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(paint(new THREE.CylinderGeometry(0.05, 0.08, 1.6, 4).translate(0, 0.5, 0).rotateZ(0.5).rotateY(a), 0x5a4a3a));
    }
    for (let i = 0; i < 3; i++) parts.push(paint(blob(1.8, 1, rand, 0.6).translate((rand() - 0.5) * 2.5, 2.4 + rand(), (rand() - 0.5) * 2.5), 0x2e5a26, 0.3, rand));
    return mergeGeometries(parts);
  },
  reed(rand) {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const h = 1.4 + rand() * 1.2;
      parts.push(paint(new THREE.CylinderGeometry(0.012, 0.02, h, 3).translate(0, h / 2, 0).rotateZ((rand() - 0.5) * 0.3).translate((rand() - 0.5) * 0.9, 0, (rand() - 0.5) * 0.9), 0x8a9a4a, 0.3, rand));
      if (i % 3 === 0) parts.push(paint(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 5).translate((rand() - 0.5) * 0.9, h - 0.1, (rand() - 0.5) * 0.9), 0x5a3a20));
    }
    return mergeGeometries(parts);
  },
  // a drowned tree: bleached trunk standing in the water with a few bare branches. Its base sits
  // 8.5 m down (buried in the lake bed where it's shallower) so the top always clears the surface.
  snag(rand) {
    const parts = [];
    const lean = (rand() - 0.5) * 0.12;
    const top = 11.2 + rand() * 2.4;
    parts.push(paint(new THREE.CylinderGeometry(0.06, 0.3, top, 6).translate(0, top / 2, 0).rotateZ(lean), rand() < 0.5 ? 0xa89c88 : 0x8e8678, 0.25, rand));
    parts.push(paint(new THREE.CylinderGeometry(0.33, 0.34, 8.9, 6).translate(0, 4.45, 0), 0x3a3a30));   // waterlogged, with a dark stain just above the waterline
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const len = 1.2 + rand() * 2.2, y = top * (0.8 + rand() * 0.15), a = rand() * Math.PI * 2;
      const b = new THREE.CylinderGeometry(0.03, 0.1, len, 4).translate(0, len / 2, 0).rotateZ(0.6 + rand() * 0.6).rotateY(a).translate(-lean * y, y, 0);
      parts.push(paint(b, 0xc8bca8, 0.2, rand));
    }
    return mergeGeometries(parts);
  },
  acacia(rand) {
    const parts = [];
    const trunk = 0x4a3a2e;
    parts.push(paint(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6).translate(0, 1.6, 0), trunk));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rand();
      parts.push(paint(new THREE.CylinderGeometry(0.08, 0.14, 2.6, 5).translate(0, 1.3, 0).rotateZ(0.55).rotateY(a).translate(0, 3, 0), trunk));
    }
    for (let i = 0; i < 4; i++) parts.push(paint(blob(2.2, 1, rand, 0.22).translate((rand() - 0.5) * 3, 5.1 + rand() * 0.4, (rand() - 0.5) * 3), i % 2 ? 0x5a6a2c : 0x6a7434, 0.3, rand));
    return mergeGeometries(parts);
  },
  // cardon cactus: a fluted column with arms that turn upward
  cactus(rand) {
    const parts = [], green = 0x4e6a3c;
    const h = 4 + rand() * 4;
    parts.push(paint(new THREE.CylinderGeometry(0.3, 0.38, h, 9).translate(0, h / 2, 0), green, 0.15, rand));
    parts.push(paint(new THREE.SphereGeometry(0.3, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h, 0), green));
    const arms = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < arms; i++) {
      const a = rand() * Math.PI * 2, y = h * (0.3 + rand() * 0.35), out = 0.7 + rand() * 0.5, up = h * (0.35 + rand() * 0.4);
      const dx = Math.cos(a), dz = Math.sin(a);
      parts.push(paint(new THREE.CylinderGeometry(0.2, 0.22, out, 7).rotateZ(Math.PI / 2).rotateY(-a).translate(dx * out / 2, y, dz * out / 2), green, 0.15, rand));
      parts.push(paint(new THREE.CylinderGeometry(0.21, 0.23, up, 8).translate(dx * out, y + up / 2 - 0.1, dz * out), green, 0.15, rand));
      parts.push(paint(new THREE.SphereGeometry(0.21, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(dx * out, y + up - 0.1, dz * out), green));
    }
    return mergeGeometries(parts);
  },
  // a Lao riverside house on stilts with a rusty tin roof
  stilt(rand) {
    const wood = 0x7a5a3a;
    const parts = [paint(new THREE.BoxGeometry(5.5, 2.4, 4).translate(0, 4, 0), wood, 0.2, rand)];
    parts.push(paint(new THREE.BoxGeometry(6.2, 0.18, 5.2).translate(0, 2.75, 0.4), 0x5a4028));      // floor and porch
    const roof = new THREE.CylinderGeometry(0.01, 3.9, 1.8, 4, 1).rotateY(Math.PI / 4).scale(1.2, 1, 1).translate(0, 6.1, 0.2);
    parts.push(paint(roof, rand() < 0.5 ? 0x8a5a3a : 0x8a8a84, 0.15, rand));
    for (const x of [-2.6, 0, 2.6]) for (const z of [-1.8, 0.4, 2.7]) parts.push(paint(new THREE.CylinderGeometry(0.1, 0.12, 5, 5).translate(x, 0.3, z), 0x4a3424));
    return mergeGeometries(parts);
  },
  cabin() {
    const walls = paint(new THREE.BoxGeometry(6, 3.2, 4.5).translate(0, 1.6, 0), 0x9a2a1e);
    const roof = new THREE.CylinderGeometry(0.01, 3.6, 2, 4, 1).rotateY(Math.PI / 4).scale(1.25, 1, 0.9).translate(0, 4.2, 0);
    const trim = paint(new THREE.BoxGeometry(6.1, 0.2, 4.6).translate(0, 3.2, 0), 0xf0f0e8);
    const posts = [];
    for (const x of [-2.6, 0, 2.6]) for (const z of [-1.9, 1.9]) posts.push(paint(new THREE.CylinderGeometry(0.15, 0.15, 4, 5).translate(x, -1.5, z), 0x3a2a1a));
    return mergeGeometries([walls, paint(roof, 0x2a2a2a), trim, ...posts]);
  },
};

// wind sway for marsh grass: the top of each clump leans and rocks, phased by where it stands
const swayUniform = { value: 0 };
function swayMaterial(mat) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.uSway = swayUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'uniform float uSway;\n#include <common>')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
      vec2 swp = instanceMatrix[3].xz;
#else
      vec2 swp = vec2(0.0);
#endif
      float swg = sin(uSway * 1.4 + swp.x * 0.11 + swp.y * 0.07) * 0.6 + sin(uSway * 2.3 + swp.y * 0.19) * 0.25;
      float swh = position.y * position.y;
      transformed.x += swg * swh * 0.04;
      transformed.z += cos(uSway * 1.1 + swp.x * 0.09) * 0.5 * swh * 0.03;`);
  };
  mat.customProgramCacheKey = () => (key ? key.call(mat) : '') + 'sway';
}

export function buildScenery(loc, heightAt, patchProp) {
  const group = new THREE.Group();
  const rand = rng(loc.id.length * 7919 + 13);
  const half = loc.size / 2 - 20;
  const colliders = [];
  group.userData.colliders = colliders;
  const veg = group.userData.veg = [];   // instanced plants the vegetation-density setting thins out
  for (const [type, count, minH, maxH, radius, only] of loc.trees || []) {
    const loose = !['snag', 'cabin', 'stilt'].includes(type);   // plants, not structures
    const mat_ = ['sawgrass', 'bulrush', 'lily'].includes(type);   // marsh plants: dense mats, no slope limit, wind sway
    const variants = Array.from({ length: loose ? 6 : 3 }, () => TREE_BUILDERS[type](rand));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: type === 'palm' || type === 'reed' || mat_ ? THREE.DoubleSide : THREE.FrontSide });
    patchProp(mat);
    if (loose && !mat_) mat.emissive.setRGB(0.012, 0.022, 0.012);   // sky-lit green in the shade: tiers shadowed by the tier above are not pure black
    if (type !== 'lily' && mat_) swayMaterial(mat);
    const spots = [];
    for (let i = 0; i < count * (mat_ ? 5 : 12) && spots.length < count; i++) {
      let x = (rand() * 2 - 1) * half, z = (rand() * 2 - 1) * half;
      if (radius) { const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * radius; x = Math.cos(a) * rr; z = Math.sin(a) * rr; }
      const h = heightAt(x, z);
      if (h < minH || h > maxH) continue;
      if (only && !only(x, z, h)) continue;   // optional place rule (aspect, side of the lake)
      const slope = Math.abs(heightAt(x + 4, z) - h) + Math.abs(heightAt(x, z + 4) - h);
      if (!mat_ && slope > (type === 'pine' || type === 'cactus' || type === 'juniper' || type === 'chaparral' || type === 'manzanita' || type === 'sage' || type === 'yucca' || type === 'oak' || CONIFERS.has(type) ? 3.5 : type === 'snag' ? 9 : 2)) continue;
      if (Math.hypot(x, z) < (type === 'snag' ? 90 : 40)) continue;
      if (type === 'snag' && fbm(x * 0.005, z * 0.005, 3, 33) < 0.08) continue;   // drowned groves, not an even scatter
      // plants grow in stands with gaps between, not an even scatter: accept by a density field
      if (type === 'lily' && fbm(x * 0.02, z * 0.02, 3, 83) < -0.05) continue;   // pads grow in patches
      if (loose && !(mat_ && type !== 'lily') && rand() > Math.min(1, Math.max(0.06, (fbm(x * 0.006, z * 0.006, 3, 71 + type.length) + 0.25) * 2.2))) continue;
      const y = type === 'cabin' ? Math.max(h, 0.6) : type === 'snag' ? -8.5 : type === 'lily' ? 0.05 : h - 0.2;
      // a few are suckers, a few are old: size is skewed small with an occasional big one
      const big = loose && rand() < 0.06 ? 1.35 : 1;
      spots.push({ x, y, z, s: (type === 'snag' ? 0.88 + rand() * 0.25 : mat_ ? 1.0 + rand() * 0.8 : (0.6 + rand() * rand() * 1.1) * big), r: rand() * Math.PI * 2, v: Math.floor(rand() * (loose ? 6 : 3)), t: rand() });
    }
    if (type === 'snag') for (const s of spots) colliders.push({ x: s.x, z: s.z, r: 0.34 * s.s });    variants.forEach((geo, v) => {
      const mine = spots.filter((s) => s.v === v);
      if (!mine.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), ax = new THREE.Vector3();
      const col = new THREE.Color();
      mine.forEach((s, i) => {
        const sy = type === 'snag' ? 1 : s.s * (0.85 + rand() * 0.3);   // snags keep their waterline stain at the surface
        const sx = loose ? s.s * (0.82 + rand() * 0.36) : s.s, sz = loose ? s.s * (0.82 + rand() * 0.36) : s.s;
        q.setFromAxisAngle(up, s.r);
        if (loose && !mat_ && rand() < 0.4) { q2.setFromAxisAngle(ax.set(Math.cos(s.r * 3), 0, Math.sin(s.r * 3)), (rand() - 0.5) * 0.16); q.premultiply(q2); }   // lean
        m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(sx, sy, sz));
        mesh.setMatrixAt(i, m);
        // every tree its own tint (sun-bleached, dry, deep green), multiplied into the vertex colours
        if (loose) { const k = 0.8 + s.t * 0.3; col.setRGB(k * (1.04 - s.t * 0.1), k, k * (0.92 + s.t * 0.1)); mesh.setColorAt(i, col); }
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.layers.enable(1);
      mesh.castShadow = !mat_;
      if (mat_ && type !== 'lily') mesh.onBeforeRender = () => { swayUniform.value = performance.now() / 1000; };
      group.add(mesh);
      if (!['snag', 'cabin', 'stilt'].includes(type)) veg.push({ mesh, n: mine.length });
    });
  }
  if (loc.rig) {
    group.add(oilRig(patchProp));
    for (const x of [-14, 14]) for (const z of [-14, 14]) colliders.push({ x: 260 + x, z: -420 + z, r: 1.9 });
  }
  return group;
}

function oilRig(patchProp) {
  const parts = [];
  const steel = 0x8a8f94, yellow = 0xe0b020, white = 0xe8e8e4, rust = 0xa0502a;
  for (const x of [-14, 14]) for (const z of [-14, 14]) {
    parts.push(paint(new THREE.CylinderGeometry(1.4, 1.8, 70, 12).translate(x, -25, z), rust));
    parts.push(paint(new THREE.CylinderGeometry(1.4, 1.4, 6, 12).translate(x, 13, z), yellow));
  }
  for (const y of [-2, 6]) {
    parts.push(paint(new THREE.BoxGeometry(30, 0.6, 0.6).translate(0, y, -14), steel), paint(new THREE.BoxGeometry(30, 0.6, 0.6).translate(0, y, 14), steel));
    parts.push(paint(new THREE.BoxGeometry(0.6, 0.6, 30).translate(-14, y, 0), steel), paint(new THREE.BoxGeometry(0.6, 0.6, 30).translate(14, y, 0), steel));
  }
  parts.push(paint(new THREE.BoxGeometry(40, 3, 40).translate(0, 17.5, 0), steel));
  parts.push(paint(new THREE.BoxGeometry(18, 9, 14).translate(-8, 23.5, -8), white));
  parts.push(paint(new THREE.BoxGeometry(12, 6, 12).translate(10, 22, 8), 0xc04020));
  parts.push(paint(new THREE.CylinderGeometry(9, 9, 0.8, 20).translate(10, 26, -10), 0x3a4a3a));
  parts.push(paint(new THREE.BoxGeometry(2, 30, 2).translate(-14, 34, 14), steel));
  const boom = new THREE.BoxGeometry(1.2, 1.2, 30).translate(0, 0, 15).rotateX(-0.6).translate(-14, 46, 14);
  parts.push(paint(boom, yellow));
  const derrick = new THREE.CylinderGeometry(1.2, 5, 34, 4, 1, true).translate(4, 36, -2);
  parts.push(paint(derrick, 0xd8d8d0));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
  patchProp(mat);
  const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
  mesh.position.set(260, 0, -420);
  mesh.layers.enable(1);
  mesh.castShadow = true;
  const flare = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 3.2, 0.6) }));
  flare.position.set(260 + 20, 40, -420 - 18);
  const g = new THREE.Group();
  g.add(mesh, flare);
  return g;
}

// ---- hotspots ---------------------------------------------------------------------------
function gullGeometry() {
  const body = new THREE.SphereGeometry(0.16, 8, 6).scale(2.4, 1, 1);
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.25, 0, 0, -0.1, 0, 0.75], 3));
  wing.computeVertexNormals();
  return { body, wing };
}

export class Hotspots {
  constructor(loc, heightAt, start, patchProp) {
    this.spots = [];
    this.group = new THREE.Group();
    this.heightAt = heightAt;
    const rand = rng(loc.id.length * 31 + 7);
    const fishGeo = new THREE.ConeGeometry(0.05, 0.3, 5).rotateZ(-Math.PI / 2).scale(1, 1, 0.45);
    const baitMat = new THREE.MeshStandardMaterial({ color: 0xc8d4dc, metalness: 0.9, roughness: 0.25 });
    patchProp(baitMat);
    const { body, wing } = gullGeometry();
    const gullMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0, tries = 0; i < loc.hotspots && tries < 400; tries++) {
      const a = rand() * Math.PI * 2, r = 120 + rand() * 650;
      const x = start.x + Math.cos(a) * r, z = start.z + Math.sin(a) * r;
      if (heightAt(x, z) > -2.5) continue;
      const bait = new THREE.InstancedMesh(fishGeo, baitMat, 140);
      bait.frustumCulled = false;
      const gulls = [];
      if (loc.birds) {
        for (let k = 0; k < 6; k++) {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(body, gullMat));
          const l = new THREE.Mesh(wing, gullMat), rr = new THREE.Mesh(wing, gullMat);
          rr.scale.z = -1;
          g.add(l, rr);
          g.userData = { l, r: rr, phase: rand() * 10, radius: 8 + rand() * 18, h: 6 + rand() * 12, speed: 0.4 + rand() * 0.4 };
          gulls.push(g);
          this.group.add(g);
        }
      }
      this.group.add(bait);
      this.spots.push({ x, z, vx: (rand() - 0.5) * 0.6, vz: (rand() - 0.5) * 0.6, bait, gulls, seed: rand() * 100, boil: rand() * 4 });
      i++;
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
  }

  update(dt, time, floaters, near) {
    const m = this._m, q = this._q, up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    for (const sp of this.spots) {
      // drift; turn back before reaching shallow water
      const nx = sp.x + sp.vx * dt, nz = sp.z + sp.vz * dt;
      if (this.heightAt(nx, nz) > -3) { sp.vx *= -1; sp.vz *= -1; } else { sp.x = nx; sp.z = nz; }
      const d = Math.hypot(sp.x - near.x, sp.z - near.z);
      const visible = d < 900;
      sp.bait.visible = visible && d < 260;
      if (sp.bait.visible) {
        for (let i = 0; i < 140; i++) {
          const a = time * (0.6 + (i % 7) * 0.05) + i * 2.399 + sp.seed;
          const r = 1.5 + ((i * 37) % 23) * 0.18;
          p.set(sp.x + Math.cos(a) * r, -1.6 - ((i * 13) % 11) * 0.22 + Math.sin(a * 2) * 0.3, sp.z + Math.sin(a) * r);
          q.setFromAxisAngle(up, -a + Math.PI);
          m.compose(p, q, s);
          sp.bait.setMatrixAt(i, m);
        }
        sp.bait.instanceMatrix.needsUpdate = true;
      }
      for (const g of sp.gulls) {
        const u = g.userData;
        g.visible = visible;
        const a = time * u.speed + u.phase;
        g.position.set(sp.x + Math.cos(a) * u.radius, u.h + Math.sin(a * 1.7) * 2, sp.z + Math.sin(a) * u.radius);
        g.rotation.y = -a - Math.PI / 2;
        const flap = Math.sin(time * 9 + u.phase) * 0.6;
        u.l.rotation.x = flap; u.r.rotation.x = -flap;
      }
      // fish busting bait on the surface
      sp.boil -= dt;
      if (sp.boil <= 0 && d < 400) {
        sp.boil = 1.5 + Math.random() * 4;
        floaters.impacts.push({ x: sp.x + (Math.random() - 0.5) * 6, z: sp.z + (Math.random() - 0.5) * 6, t: floaters.time, amp: 0.06, size: 0.6 });
        if (floaters.impacts.length > 8) floaters.impacts.shift();
      }
    }
  }

  // 0..1, how close a point is to the nearest school
  near(x, z, radius = 45) {
    let best = 0;
    for (const sp of this.spots) best = Math.max(best, 1 - Math.min(1, Math.hypot(x - sp.x, z - sp.z) / radius));
    return best;
  }

  nearest(x, z) {
    let best = null, bd = Infinity;
    for (const sp of this.spots) { const d = Math.hypot(x - sp.x, z - sp.z); if (d < bd) { bd = d; best = sp; } }
    return { spot: best, dist: bd };
  }
}

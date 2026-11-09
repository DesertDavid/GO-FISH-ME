import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

const TREE_BUILDERS = {
  pine(rand) {
    const parts = [paint(new THREE.CylinderGeometry(0.18, 0.3, 4, 6).translate(0, 2, 0), 0x4a3424)];
    for (let i = 0; i < 5; i++) {
      const r = 2.6 - i * 0.45, y = 2.5 + i * 2.1;
      parts.push(paint(new THREE.ConeGeometry(r, 3.4, 9).translate(0, y, 0), 0x1f3a24, 0.25, rand));
    }
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
  cabin() {
    const walls = paint(new THREE.BoxGeometry(6, 3.2, 4.5).translate(0, 1.6, 0), 0x9a2a1e);
    const roof = new THREE.CylinderGeometry(0.01, 3.6, 2, 4, 1).rotateY(Math.PI / 4).scale(1.25, 1, 0.9).translate(0, 4.2, 0);
    const trim = paint(new THREE.BoxGeometry(6.1, 0.2, 4.6).translate(0, 3.2, 0), 0xf0f0e8);
    const posts = [];
    for (const x of [-2.6, 0, 2.6]) for (const z of [-1.9, 1.9]) posts.push(paint(new THREE.CylinderGeometry(0.15, 0.15, 4, 5).translate(x, -1.5, z), 0x3a2a1a));
    return mergeGeometries([walls, paint(roof, 0x2a2a2a), trim, ...posts]);
  },
};

export function buildScenery(loc, heightAt, patchProp) {
  const group = new THREE.Group();
  const rand = rng(loc.id.length * 7919 + 13);
  const half = loc.size / 2 - 20;
  for (const [type, count, minH, maxH] of loc.trees || []) {
    const variants = [0, 1, 2].map(() => TREE_BUILDERS[type](rand));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: type === 'palm' || type === 'reed' ? THREE.DoubleSide : THREE.FrontSide });
    patchProp(mat);
    const spots = [];
    for (let i = 0; i < count * 12 && spots.length < count; i++) {
      const x = (rand() * 2 - 1) * half, z = (rand() * 2 - 1) * half;
      const h = heightAt(x, z);
      if (h < minH || h > maxH) continue;
      const slope = Math.abs(heightAt(x + 4, z) - h) + Math.abs(heightAt(x, z + 4) - h);
      if (slope > (type === 'pine' ? 3.5 : 2)) continue;
      if (Math.hypot(x, z) < 40) continue;
      spots.push({ x, y: type === 'cabin' ? Math.max(h, 0.6) : h - 0.2, z, s: 0.7 + rand() * 0.7, r: rand() * Math.PI * 2, v: Math.floor(rand() * 3) });
    }
    variants.forEach((geo, v) => {
      const mine = spots.filter((s) => s.v === v);
      if (!mine.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      mine.forEach((s, i) => {
        m.compose(new THREE.Vector3(s.x, s.y, s.z), q.setFromAxisAngle(up, s.r), new THREE.Vector3(s.s, s.s * (0.85 + rand() * 0.3), s.s));
        mesh.setMatrixAt(i, m);
      });
      mesh.computeBoundingSphere();
      mesh.layers.enable(1);
      mesh.castShadow = true;
      group.add(mesh);
    });
  }
  if (loc.rig) group.add(oilRig(patchProp));
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
  g.userData.collider = { x: 260, z: -420, r: 22 };
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

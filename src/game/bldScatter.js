import * as THREE from 'three';
import { Mesher, rng, house } from './bldMesh.js';
import { dwelling, townhouse, barn, siloKind, block, plant, church, wat, hjell, fishPlant, lerp } from './bldKinds.js';
import { lighthouse, bridge, levee, dam, platform, turbine, pier } from './bldLandmarks.js';
import { STYLES, pick } from './bldStyles.js';
import { GFX } from './gfx.js';

// Background buildings, placed from the real heightfield: villages that face the water, farms,
// industry, hotels, lighthouses, bridges, a dam, a levee, offshore platforms. Each cluster is baked
// into a few merged meshes (one per material) with its own bounding sphere, then culled by view and
// by distance, with a detail level that drops trim, ironwork and signs beyond 700 m.
const DETAIL = new Set(['tex:wood', 'metal', 'sign', 'plain']);
const FAR = 3600, DETAIL_DIST = 700;

class Scatter {
  constructor(B) {
    this.B = B; this.loc = B.loc; this.H = B.H; this.g = B.g;
    this.rand = rng(this.loc.id.length * 9173 + 29);
    this.group = new THREE.Group();
    this.group.name = 'scatter';
    this.clusters = []; this.circles = []; this.beams = []; this.occ = [];
    this.start = B.g.start;
    this.half = this.loc.size / 2 - 40;
    // keep clear of the dock approaches and the shops
    for (const d of B.g.docks.list) this.occ.push({ x: d.x, z: d.z, r: 60 }, { x: d.end.x, z: d.end.z, r: 40 });
    for (const r of B.rects) this.occ.push({ x: r.x, z: r.z, r: 22 });
    this.cur = null;
  }

  cluster(name, cx, cz, r, o = {}) {
    const cl = { name, cx, cz, r, M: new Mesher(this.rand, this.B.mats.glowAtlas.white()), big: !!o.big, meshes: [] };
    this.clusters.push(cl);
    return cl;
  }

  // copy a locally built mesher into a world mesher, rotated by yaw (front +z -> (sin, cos)) and moved
  bakeLocal(target, local, x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [key, b] of local.b) {
      const t = target.bucket(key);
      for (let i = 0; i < b.pos.length; i += 3) {
        const px = b.pos[i], py = b.pos[i + 1], pz = b.pos[i + 2];
        t.pos.push(x + px * c + pz * s, y + py, z - px * s + pz * c);
      }
      for (const v of b.uv) t.uv.push(v);
      for (const v of b.col) t.col.push(v);
    }
  }

  slope(x, z, d = 5) { const h = this.H(x, z); return Math.abs(this.H(x + d, z) - h) + Math.abs(this.H(x, z + d) - h); }

  // direction (as a yaw) to the nearest water within `max` metres, or null
  waterDir(x, z, max = 120, min = 0) {
    let best = null, bd = max;
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      for (let t = 6; t <= bd; t += 6) {
        if (this.H(x + dx * t, z + dz * t) < -0.2) { if (t >= min && t < bd) { bd = t; best = a; } break; }
      }
    }
    return best === null ? null : { yaw: best, dist: bd };
  }

  // which way the ground falls (a yaw), when it falls clearly; otherwise null
  downhill(x, z, d = 9) {
    const gx = this.H(x + d, z) - this.H(x - d, z), gz = this.H(x, z + d) - this.H(x, z - d);
    return Math.hypot(gx, gz) > 2.2 ? Math.atan2(-gx, -gz) : null;
  }

  taken(x, z, r) { for (const o of this.occ) if ((o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2) return true; return false; }

  footprint(x, z, theta, w, d, margin = 0.8) {
    const c = Math.cos(theta), s = Math.sin(theta);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 3; i++) for (let k = 0; k <= 3; k++) {
      const lx = (i / 3 - 0.5) * (w + margin * 2), lz = (k / 3 - 0.5) * (d + margin * 2);
      const h = this.H(x + lx * c + lz * s, z - lx * s + lz * c);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return { lo, hi };
  }

  // find an anchor with plenty of buildable ground around it
  find(o = {}) {
    const around = o.around || [this.start.x, this.start.z];
    let best = null;
    for (let i = 0; i < (o.tries ?? 140); i++) {
      const a = o.angle !== undefined ? o.angle + (this.rand() - 0.5) * (o.spread ?? 1.2) : this.rand() * Math.PI * 2, r = (o.rmin ?? 300) + this.rand() * ((o.rmax ?? 1400) - (o.rmin ?? 300));
      const x = around[0] + Math.cos(a) * r, z = around[1] + Math.sin(a) * r;
      if (Math.abs(x) > this.half || Math.abs(z) > this.half) continue;
      if (this.taken(x, z, o.r ?? 40)) continue;
      let n = 0;
      for (let k = 0; k < 24; k++) {
        const aa = this.rand() * 6.283, rr = Math.sqrt(this.rand()) * (o.r ?? 80), px = x + Math.cos(aa) * rr, pz = z + Math.sin(aa) * rr, h = this.H(px, pz);
        if (h < (o.hmin ?? 0.6) || h > (o.hmax ?? 40)) continue;
        if (this.slope(px, pz) > (o.slope ?? 3)) continue;
        if (o.shore && !this.waterDir(px, pz, o.shore, 8)) continue;
        n++;
      }
      if (!best || n > best.n) best = { x, z, n };
      if (n >= 22) break;
    }
    return best && best.n >= (o.need ?? 8) ? best : null;
  }

  // place buildings of the given kinds inside a circle; every one is checked against the terrain
  populate(cl, o) {
    const kinds = o.kinds, tot = kinds.reduce((a, k) => a + k[0], 0), rand = this.rand;
    let placed = 0;
    for (let t = 0; t < o.n * 18 && placed < o.n; t++) {
      let u = rand() * tot, kind = kinds[0][1];
      for (const [wgt, k] of kinds) { u -= wgt; if (u <= 0) { kind = k; break; } }
      const w = lerp(rand(), kind.w), d = lerp(rand(), kind.d);
      const aa = rand() * 6.283, rr = Math.sqrt(rand()) * (o.r ?? cl.r);
      let x = (o.cx ?? cl.cx) + Math.cos(aa) * rr, z = (o.cz ?? cl.cz) + Math.sin(aa) * rr;
      if (Math.abs(x) > this.half || Math.abs(z) > this.half) continue;
      const wet = !!kind.wet;
      let snap = null;
      if (wet) {
        // piled houses stand right at the water's edge: walk from the sample to the 0.9 m contour
        snap = this.waterDir(x, z, 160, 0);
        if (!snap) continue;
        const sx = Math.sin(snap.yaw), sz = Math.cos(snap.yaw);
        for (let k = 0; k < 160 && this.H(x, z) > 0.9; k++) { x += sx; z += sz; }
      }
      const h = this.H(x, z);
      if (wet ? (h < 0.05 || h > 1.6) : (h < (o.hmin ?? 0.6) || h > (o.hmax ?? 60))) continue;
      if (!wet && this.slope(x, z, 6) > Math.min(kind.slope ?? 99, o.slope ?? 3.2)) continue;
      let theta = rand() * 6.283;
      if (wet) theta = this.downhill(x, z, 6) ?? this.waterDir(x, z, 40, 0)?.yaw ?? snap.yaw;
      else if (o.face === 'water') { const wd = this.waterDir(x, z, o.shore ?? 90, o.shoreMin ?? 10); if (!wd) continue; theta = this.downhill(x, z) ?? wd.yaw; }
      else if (o.face === 'down') { const gx = this.H(x + 4, z) - this.H(x - 4, z), gz = this.H(x, z + 4) - this.H(x, z - 4); if (Math.hypot(gx, gz) > 0.05) theta = Math.atan2(-gx, -gz); }
      else if (o.theta !== undefined) theta = o.theta + (rand() - 0.5) * 0.3;
      const fp = this.footprint(x, z, theta, w, d);
      if (!wet && fp.lo < (o.hmin ?? 0.6) - 0.3) continue;
      if (!wet && fp.hi - fp.lo > Math.min(kind.range ?? 99, o.range ?? 3.4)) continue;
      const rad = Math.hypot(w, d) / 2 + (o.gap ?? 3);
      if (this.taken(x, z, rad)) continue;
      const range = fp.hi - fp.lo, y0 = wet ? 1.25 : range > 2 ? fp.lo + range * 0.5 + 0.25 : fp.hi + 0.25;
      const found = wet ? y0 - Math.min(fp.lo, -1.5) + 0.5 : y0 - fp.lo + 0.4;
      const M2 = new Mesher(rand, this.B.mats.glowAtlas.white());
      kind.build(M2, rand, { w, d, found, wet });
      this.bakeLocal(cl.M, M2, x, y0, z, theta);
      if (wet) this.circles.push({ x: x + Math.sin(theta) * d * 0.25, z: z + Math.cos(theta) * d * 0.25, r: Math.max(w, d) * 0.45 });
      this.occ.push({ x, z, r: rad });
      placed++;
    }
    cl.placed = (cl.placed || 0) + placed;
    return placed;
  }

  // water extent along a line (for bridges and dams): the two bank points just beyond the water
  crossing(cx, cz, ang, half = 1400) {
    const dx = Math.cos(ang), dz = Math.sin(ang);
    let first = null, last = null;
    for (let t = -half; t <= half; t += 6) { const x = cx + dx * t, z = cz + dz * t; if (Math.abs(x) > this.half || Math.abs(z) > this.half) continue; if (this.H(x, z) < -1.2) { if (first === null) first = t; last = t; } }
    if (first === null) return null;
    return { a: [cx + dx * (first - 40), cz + dz * (first - 40)], b: [cx + dx * (last + 40), cz + dz * (last + 40)], len: last - first + 80, ang };
  }

  finish() {
    const mats = this.B.mats;
    for (const cl of this.clusters) {
      let any = false;
      for (const key of cl.M.b.keys()) {
        const geo = cl.M.build(key);
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, mats.get(key));
        mesh.layers.enable(1);
        mesh.userData.detail = !cl.big && DETAIL.has(key);
        mesh.userData.key = key;
        geo.computeBoundingSphere();
        cl.meshes.push(mesh);
        this.group.add(mesh);
        any = true;
      }
      cl.M = null;
      if (!any) cl.dead = true;
    }
    // sweeping light beams
    const wedge = new THREE.BufferGeometry();
    const L = 1, w = 0.012, pos = [0, 0, 0, L, 0, -w, L, 0, w, 0, 0, 0, L, -w, 0, L, w, 0], col = [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0];
    wedge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wedge.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    for (const b of this.beams) {
      const m = new THREE.Mesh(wedge, mats.get('beam'));
      m.position.set(b.x, b.y, b.z); m.scale.setScalar(b.len);
      m.frustumCulled = false; m.renderOrder = 5;
      b.mesh = m; this.group.add(m);
    }
    this.t = 0; this.cullT = 0;
  }

  update(dt, night, pos) {
    this.t += dt;
    const mats = this.B.mats;
    mats.beacon.color.setScalar(night > 0.03 ? Math.min(2.5, night * 2.4) * (0.55 + 0.45 * Math.sin(this.t * 3.1) ** 2) : 0);
    mats.beacon.visible = night > 0.03;
    mats.beam.color.setScalar(night * 0.55);
    mats.beam.visible = night > 0.04;
    for (const b of this.beams) { b.mesh.rotation.y = this.t * b.speed + b.phase; b.mesh.visible = night > 0.04 && Math.hypot(b.x - pos.x, b.z - pos.z) < 6000; }
    this.cullT -= dt;
    if (this.cullT > 0) return;
    this.cullT = 0.4;
    // Settings > Graphics: draw distance scales the two ranges, building density hides a spread of whole villages
    let ci = 0;
    for (const cl of this.clusters) {
      const keep = ((ci++ * 0.618034) % 1) < GFX.buildings;
      if (cl.dead) continue;
      const d = Math.hypot(cl.cx - pos.x, cl.cz - pos.z) - cl.r;
      const vis = d < FAR * GFX.drawDistance && keep, det = d < DETAIL_DIST * GFX.drawDistance;
      for (const m of cl.meshes) m.visible = vis && (det || !m.userData.detail);
    }
  }
}

// ---- per-location plans ----------------------------------------------------------------------
const dw = dwelling, th = townhouse;
function village(S, name, find, n, kinds, pop = {}) {
  const a = S.find({ r: 80, ...find });
  if (!a) { console.warn('[buildings] no site for', S.loc.id, name); return null; }
  const cl = S.cluster(name, a.x, a.z, find.r ?? 80);
  const got = S.populate(cl, { n, kinds, face: 'water', shore: 140, shoreMin: 10, ...pop });
  return { cl, got, a };
}

const PLANS = {
  okeechobee(S) {
    // fish camps along the shore, a town behind the levee, a sugar mill and farms inland
    village(S, 'camps', { rmin: 400, rmax: 1100, hmin: 0.5, hmax: 4, shore: 110, r: 150 }, 14, [[1, dw('cracker', { w: [6, 9], d: [5, 7] })]], { shoreMin: 12, range: 1.6 });
    village(S, 'town', { rmin: 950, rmax: 1450, hmin: 0.8, hmax: 8, r: 150, need: 6 }, 26, [[5, dw('cracker', { floors: 2 })], [1, th('chesapeake', { brick: true })], [0.5, church('cracker')]], { face: 'down', range: 1.6, gap: 4 });
    const m = S.find({ rmin: 1100, rmax: 1500, hmin: 0.8, r: 70, need: 5 });
    if (m) { const cl = S.cluster('mill', m.x, m.z, 70); S.populate(cl, { n: 2, kinds: [[1, plant({ stackH: 55, tanks: 3 })]], face: 'down', gap: 10, range: 1.8 }); }
    for (let i = 0; i < 3; i++) { const f = S.find({ rmin: 700, rmax: 1500, hmin: 0.8, r: 50, need: 6 }); if (f) { const cl = S.cluster('farm', f.x, f.z, 50); S.populate(cl, { n: 4, kinds: [[1, barn], [2, dw('cracker', { w: [8, 11] })], [1, siloKind]], face: 'down', gap: 6, range: 1.6 }); } }
    // Herbert Hoover Dike: the long earth levee between lake and town, with a pump station
    const nx = -0.8, nz = -0.6, d0 = 820, tx = -0.6, tz = 0.8;
    const cl = S.cluster('levee', nx * d0, nz * d0, 1600, { big: true });
    levee(S, cl.M, [nx * d0 - tx * 1450, nz * d0 - tz * 1450], [nx * d0 + tx * 1450, nz * d0 + tz * 1450], { crest: 5.5 });
  },
  woods(S) {
    for (let i = 0; i < 3; i++) village(S, 'lodge', { rmin: 250, rmax: 1300, hmin: 1, hmax: 14, shore: 90, r: 100, need: 5 }, 9, [[3, dw('log', { w: [6, 9], d: [5, 7] })], [1, dw('chalet', { w: [10, 14], d: [7, 9], floors: 2 })]], { slope: 3.6, range: 3 });
    for (let i = 0; i < 5; i++) village(S, 'cabins', { rmin: 200, rmax: 1500, hmin: 1, hmax: 12, shore: 80, r: 40, need: 4 }, 2, [[1, dw('log', { w: [5, 8], d: [4, 6] })]], { slope: 3.6, range: 3, gap: 8 });
  },
  tahoe(S) {
    const A = { rmin: 650, rmax: 1450, hmin: 1, hmax: 160, slope: 4, shore: 140 };
    for (let i = 0; i < 4; i++) village(S, 'shore', { ...A, r: 130, need: 6 }, 16, [[3, dw('chalet', { w: [9, 14], d: [7, 10], floors: 2 })], [2, dw('log', { w: [7, 10], d: [5, 8] })], [1, th('chesapeake', { brick: false })]], { range: 4, slope: 4.5, gap: 5 });
    // Stateline: a handful of hotel-casino towers at the south shore
    village(S, 'casinos', { rmin: 700, rmax: 1500, hmin: 1, hmax: 25, r: 90, need: 5, shore: 160 }, 4, [[1, block({ w: [26, 34], d: [18, 24], floors: [12, 18], tiers: 2, lit: 0.55, wall: 'conc', wcols: [0xd8d4c8, 0xc4c0b4, 0xe0dccc], sign: true })], [1, block({ w: [34, 44], d: [16, 22], floors: [5, 8], tiers: 1, lit: 0.5, wall: 'conc', wcols: [0xb8a888, 0xc8bca0] })]], { gap: 14, range: 5, shoreMin: 30 });
    // a ski lodge high on the hillside
    const f = S.find({ rmin: 800, rmax: 1500, hmin: 70, hmax: 200, r: 40, need: 4, slope: 4 }); if (f) { const cl = S.cluster('ski', f.x, f.z, 40); S.populate(cl, { n: 3, kinds: [[1, dw('chalet', { w: [14, 20], d: [9, 12], floors: 2 })]], face: 'down', hmin: 70, range: 5, slope: 5, gap: 6 }); }
  },
  columbia(S) {
    // the dam, a rail bridge, wind turbines on the ridges, river towns and a mill
    const dz = S.crossing(0, -1180, 0, 700);
    if (dz) { const cl = S.cluster('dam', (dz.a[0] + dz.b[0]) / 2, dz.a[1], dz.len, { big: true }); dam(S, cl.M, dz.a, dz.b, { top: 14 }); }
    const br = S.crossing(0, 1100, 0, 700);
    if (br) { const cl = S.cluster('bridge', (br.a[0] + br.b[0]) / 2, br.a[1], br.len, { big: true }); bridge(S, cl.M, br.a, br.b, { deck: 22, width: 9, mainLen: 220, rise: 10, arch: 18, steel: 0x5a6a68, pierEvery: 70 }); }
    for (let i = 0; i < 3; i++) village(S, 'town', { rmin: 300, rmax: 1500, hmin: 1.2, hmax: 40, shore: 150, r: 120, need: 4, slope: 5 }, 18, [[4, dw('columbia', { floors: 2 })], [2, th('columbia')], [0.7, barn]], { slope: 4.5, range: 3.4, gap: 4 });
    const m = S.find({ rmin: 500, rmax: 1500, hmin: 1.2, hmax: 40, r: 60, need: 4, slope: 5 });
    if (m) { const cl = S.cluster('mill', m.x, m.z, 70); S.populate(cl, { n: 2, kinds: [[1, plant({ stackH: 50, tall: true, tanks: 4 })]], face: 'water', shore: 160, gap: 12, range: 4, slope: 5 }); }
    const cl = S.cluster('wind', 0, 0, 2200, { big: true });
    let n = 0;
    for (let t = 0; t < 600 && n < 22; t++) { const x = (S.rand() - 0.5) * 2 * S.half, z = (S.rand() - 0.5) * 2 * S.half, h = S.H(x, z); if (h < 120 || h > 300 || S.slope(x, z, 6) > 5 || S.taken(x, z, 120)) continue; if (Math.hypot(x, z) < 500) continue; turbine(S, cl.M, x, z, { yaw: 1.4, h: 64 }); S.occ.push({ x, z, r: 120 }); n++; }
  },
  chesapeake(S) {
    // waterfront town, watermen's shacks on the marsh, a power plant, farms, a bay bridge and a screw-pile light
    village(S, 'town', { rmin: 650, rmax: 1300, hmin: 1.2, hmax: 14, shore: 200, r: 170, need: 6 }, 40, [[3, th('chesapeake')], [3, dw('chesapeake', { floors: 2, w: [7, 11] })], [0.6, church('chesapeake')], [0.5, block({ w: [18, 24], d: [10, 14], floors: [3, 4], tiers: 1, wall: 'brick', wcols: [0xa8604a, 0xb87058], lit: 0.5 })]], { range: 2.4, gap: 3.5 });
    for (let i = 0; i < 2; i++) village(S, 'shacks', { rmin: 450, rmax: 1500, hmin: 0.3, hmax: 3, shore: 90, r: 120, need: 4 }, 8, [[1, dw('chesapeake', { w: [5, 8], d: [4, 6] })]], { range: 1.2, shoreMin: 6, gap: 6, slope: 2 });
    const pp = S.find({ rmin: 900, rmax: 1500, hmin: 1.2, hmax: 12, r: 60, need: 5 });
    if (pp) { const cl = S.cluster('plant', pp.x, pp.z, 80); S.populate(cl, { n: 2, kinds: [[1, plant({ stackH: 70, tall: true })]], face: 'water', shore: 400, gap: 14, range: 2.2 }); }
    for (let i = 0; i < 3; i++) { const f = S.find({ rmin: 800, rmax: 1500, hmin: 2, hmax: 25, r: 50, need: 6 }); if (f) { const cl = S.cluster('farm', f.x, f.z, 50); S.populate(cl, { n: 4, kinds: [[1, barn], [2, dw('chesapeake', { w: [8, 11], floors: 2 })], [1, siloKind]], face: 'down', gap: 6, range: 2.4 }); } }
    const b = S.crossing(1180, 0, Math.PI / 2, 1450);
    const bcl = S.cluster('bridge', 1180, 0, 1500, { big: true });
    bridge(S, bcl.M, [1180, -1450], [1180, 1450], { deck: 16, width: 13, mainAt: 0.5, mainLen: 190, rise: 20, arch: 16, pierEvery: 52 }); void b;
    let lh = null; for (let t = 0; t < 400 && !lh; t++) { const a = S.rand() * 6.283, r = 260 + S.rand() * 600, x = Math.cos(a) * r - 120, z = Math.sin(a) * r; const h = S.H(x, z); if (h < -2.5 && h > -4.5 && !S.taken(x, z, 90)) lh = [x, z]; }
    if (lh) { const cl = S.cluster('lighthouse', lh[0], lh[1], 60, { big: true }); lighthouse(S, cl.M, lh[0], lh[1], { kind: 'screw', speed: 0.5 }); }
  },
  keys(S) {
    for (let i = 0; i < 4; i++) village(S, 'conch', { rmin: 250, rmax: 1500, hmin: 0.5, hmax: 4, shore: 80, r: 90, need: 4 }, 10, [[4, dw('conch', { floors: 2, w: [7, 11] })], [1, dw('conch', { w: [5, 7], d: [4, 5] })]], { range: 1.4, shoreMin: 6, gap: 5, slope: 1.8 });
    const bcl = S.cluster('bridge', 0, 600, 1500, { big: true });
    bridge(S, bcl.M, [-1450, 650], [1450, 520], { deck: 9, width: 11, mainAt: 0.46, mainLen: 130, rise: 11, arch: 10, pierEvery: 42, steel: 0x7a8286 });
    let lh = null; for (let t = 0; t < 400 && !lh; t++) { const a = S.rand() * 6.283, r = 500 + S.rand() * 900, x = Math.cos(a) * r, z = Math.sin(a) * r, h = S.H(x, z); if (h < -1.2 && h > -2.2 && !S.taken(x, z, 120)) lh = [x, z]; }
    if (lh) { const cl = S.cluster('sombrero', lh[0], lh[1], 40, { big: true }); lighthouse(S, cl.M, lh[0], lh[1], { kind: 'skeleton', h: 30, speed: 0.4 }); }
  },
  mekong(S) {
    for (let i = 0; i < 5; i++) village(S, 'village', { rmin: 250, rmax: 1500, hmin: 0.6, hmax: 5, shore: 90, r: 90, need: 4 }, 12, [[4, dw('stilt', { w: [5, 8], d: [4, 6] })], [1, dw('stilt', { w: [8, 11], d: [5, 7], floors: 2 })]], { range: 1.8, shoreMin: 8, gap: 4, slope: 2 });
    const w = S.find({ rmin: 400, rmax: 1500, hmin: 0.8, hmax: 6, r: 50, need: 5, shore: 140 });
    if (w) { const cl = S.cluster('wat', w.x, w.z, 50); S.populate(cl, { n: 1, kinds: [[1, wat]], face: 'water', shore: 200, gap: 8, range: 1.6, shoreMin: 25 }); S.populate(cl, { n: 5, kinds: [[1, dw('stilt', { w: [5, 7], d: [4, 5] })]], face: 'water', shore: 200, gap: 5, range: 1.6, shoreMin: 25 }); }
  },
  amazon(S) {
    for (let i = 0; i < 3; i++) village(S, 'palafitas', { rmin: 350, rmax: 1500, hmin: 0.5, hmax: 4, shore: 100, r: 70, need: 3 }, 7, [[1, dw('palm', { w: [5, 8], d: [4, 6] })]], { range: 1.8, shoreMin: 8, gap: 5, slope: 2 });
    // IBAMA-style ranger station: a larger white stilt house with a lookout
    const f = S.find({ rmin: 500, rmax: 1500, hmin: 0.6, hmax: 4, r: 40, need: 3, shore: 90 });
    if (f) { const cl = S.cluster('ranger', f.x, f.z, 40); S.populate(cl, { n: 1, kinds: [[1, { w: [10, 12], d: [6, 7], build(M, rand, o) { house(M, { w: o.w, d: o.d, floors: 1, wall: 'clap', wcol: 0xe8eee6, roof: 'hip', rtex: 'tin', rcol: 0x3a6a4a, trim: 0xffffff, pitch: 0.4, over: 0.9, found: 0, piles: { depth: Math.max(2.8, o.found + 0.6) }, porch: { rail: true, w: o.w * 0.8, s: 0, d: 2 }, lit: 0.6 }); } }]], face: 'water', shore: 150, shoreMin: 10, range: 1.8, gap: 6 }); }
  },
  kariba(S) {
    for (let i = 0; i < 3; i++) village(S, 'lodge', { rmin: 350, rmax: 1500, hmin: 1, hmax: 60, shore: 100, r: 90, need: 4, slope: 4 }, 8, [[3, dw('kariba', { w: [8, 12], d: [6, 8] })], [1, dw('kariba', { w: [14, 18], d: [8, 10] })]], { range: 3.2, gap: 6 });
    for (let i = 0; i < 2; i++) village(S, 'town', { rmin: 500, rmax: 1500, hmin: 1, hmax: 60, shore: 140, r: 110, need: 6, slope: 4 }, 22, [[3, dw('kariba', { w: [6, 9], d: [5, 7] })], [1, th('kariba', { brick: false })], [0.4, church('cracker')]], { range: 3.2, gap: 4 });
  },
  fjord(S) {
    // Lofoten: red and ochre rorbuer on piles along the shore, drying racks, a church, a fish plant,
    // lighthouse on a headland and a high bridge across the fjord
    for (let i = 0; i < 5; i++) village(S, 'rorbuer', { rmin: 300, rmax: 2000, hmin: 0.1, hmax: 12, shore: 70, r: 100, need: 4, slope: 6 }, 16, [[5, dw('rorbu', { w: [6, 8.5], d: [4.5, 6], wet: true })], [1, { ...dw('rorbu', { w: [9, 12], d: [6, 7], floors: 2, wet: true }) }], [1.4, hjell], [0.3, church('chesapeake')]], { range: 9, slope: 9, shoreMin: 3, gap: 2.2 });
    const fp = S.find({ rmin: 400, rmax: 2000, hmin: 0.6, hmax: 8, r: 60, need: 4, slope: 6 });
    if (fp) { const cl = S.cluster('fishplant', fp.x, fp.z, 60); S.populate(cl, { n: 2, kinds: [[1, fishPlant]], face: 'water', shore: 100, shoreMin: 8, gap: 10, range: 6, slope: 8 }); }
    const lhp = S.find({ rmin: 700, rmax: 2000, hmin: 3, hmax: 40, r: 25, need: 3, slope: 8 });
    if (lhp) { const cl = S.cluster('light', lhp.x, lhp.z, 40, { big: true }); lighthouse(S, cl.M, lhp.x, lhp.z, { kind: 'round', h: 15, stripes: [0xf2eee4, 0xb02a24], bands: 2, hx: 7 }); }
    const cr = S.crossing(-1100, 0, Math.PI / 2, 900);
    if (cr) { const cl = S.cluster('bridge', (cr.a[0] + cr.b[0]) / 2, (cr.a[1] + cr.b[1]) / 2, cr.len, { big: true }); bridge(S, cl.M, cr.a, cr.b, { deck: 30, width: 9, mainLen: 180, rise: 14, arch: 20, pierEvery: 90, steel: 0xcfcfcc, truss: false }); }
  },
  gulf(S) {
    const cl = S.cluster('platforms', 0, 0, 3000, { big: true });
    platform(S, cl.M, -760, 540, { scale: 1.3 }); platform(S, cl.M, 680, 900, { scale: 1.1 }); platform(S, cl.M, -440, -900, { scale: 0.95 });
  },
  cabo(S) {
    // hotels along the bay beach, villas on the slopes, marina condos and the lighthouse on the cape
    village(S, 'hotels', { rmin: 450, rmax: 1500, hmin: 1, hmax: 25, shore: 220, r: 140, need: 5, slope: 5 }, 9, [[1, block({ w: [24, 34], d: [14, 18], floors: [5, 8], tiers: 3, balcony: true, tile: true, lit: 0.5 })]], { range: 5, gap: 10, shoreMin: 25 });
    for (let i = 0; i < 4; i++) village(S, 'villas', { rmin: 250, rmax: 1500, hmin: 5, hmax: 140, shore: 600, r: 130, need: 5, slope: 6 }, 14, [[3, dw('cabo', { w: [9, 14], d: [7, 10], floors: 2 })], [1, block({ w: [12, 16], d: [10, 14], floors: [2, 3], tiers: 2, balcony: true, tile: true, lit: 0.45 })]], { face: 'water', range: 5, slope: 7, shoreMin: 20, gap: 4 });
    const p = S.find({ rmin: 150, rmax: 700, hmin: 4, hmax: 80, around: [-260, -200], r: 40, need: 3, slope: 8 });
    if (p) { const cl = S.cluster('light', p.x, p.z, 40, { big: true }); lighthouse(S, cl.M, p.x, p.z, { kind: 'round', h: 18, stripes: [0xf4f0e6], bands: 1, hx: 7 }); }
  },
  reef(S) {
    village(S, 'station', { rmin: 100, rmax: 900, hmin: 1.2, hmax: 8, shore: 120, r: 60, need: 4, slope: 4 }, 7, [[3, dw('reef', { w: [6, 9], d: [5, 6] })], [1, dw('reef', { w: [11, 14], d: [6, 8] })]], { range: 2, gap: 6 });
    const p = S.find({ rmin: 100, rmax: 900, hmin: 3, hmax: 40, r: 25, need: 3, slope: 8 });
    if (p) { const cl = S.cluster('light', p.x, p.z, 40, { big: true }); lighthouse(S, cl.M, p.x, p.z, { kind: 'round', h: 14, stripes: [0xf4f0e6, 0x2a3a4a], bands: 1, hx: 6 }); }
  },
  bering() {},
};

export function buildScatter(B) {
  const plan = PLANS[B.loc.id];
  if (!plan) return null;
  const S = new Scatter(B);
  const t0 = performance.now();
  plan(S);
  S.finish();
  console.log(`[buildings] ${B.loc.id}: ${S.clusters.filter((c) => !c.dead).length} clusters, ${S.clusters.reduce((a, c) => a + (c.placed || 0), 0)} buildings, ${S.group.children.length} meshes, ${(performance.now() - t0) | 0} ms`);
  return S;
}

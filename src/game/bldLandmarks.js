import * as THREE from 'three';
import { Mesher, house } from './bldMesh.js';

// Big one-off structures seen across the water: lighthouses, bridges, levees, a dam, offshore
// platforms, wind turbines and piers. All of them are built in world coordinates from the terrain
// heightfield (S.H) into a Mesher; S.circles collects the parts a boat can hit.
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const WHITE = (M) => ({ rect: M.white, jit: 0, uo: 0, vo: 0 });

// ---- lighthouses ---------------------------------------------------------------------------
// kind 'round': tapered masonry tower with day-marks and a keeper's house
// kind 'screw': a hexagonal cottage on screw-piles standing in the water
// kind 'skeleton': an iron-lattice reef tower
export function lighthouse(S, M, x, z, o = {}) {
  const kind = o.kind || 'round';
  const bed = S.H(x, z), baseY = kind === 'round' ? Math.max(bed, 0.4) : 0;
  const stripes = o.stripes || [0xf2eee4];
  let topY = baseY, beamY;
  if (kind === 'round') {
    const h = o.h || 24, r0 = o.r || 3.4, r1 = r0 * 0.62, n = 14;
    M.prism('tex:stone', x, z, baseY - 4, baseY + 1.2, r0 * 1.25, r0 * 1.12, n, 0x8a847a, true);
    const bands = stripes.length * (o.bands || 2);
    for (let i = 0; i < bands; i++) {
      const y0 = baseY + 1.2 + (h - 1.2) * (i / bands), y1 = baseY + 1.2 + (h - 1.2) * ((i + 1) / bands);
      M.prism('tex:stucco', x, z, y0, y1, mix(r0, r1, i / bands), mix(r0, r1, (i + 1) / bands), n, stripes[i % stripes.length], false);
    }
    topY = baseY + h;
    for (let k = 0; k < 4; k++) {   // narrow slit windows spiralling up
      const a = k * 1.9, rr = mix(r0, r1, (k + 0.5) / 4.5) + 0.02, yy = baseY + 4 + k * (h - 8) / 4;
      M.quad('glass', [x + Math.cos(a) * rr - 0.2, yy, z + Math.sin(a) * rr], [x + Math.cos(a) * rr + 0.2, yy, z + Math.sin(a) * rr], [x + Math.cos(a) * rr + 0.2, yy + 1.0, z + Math.sin(a) * rr], [x + Math.cos(a) * rr - 0.2, yy + 1.0, z + Math.sin(a) * rr], 0x151d24);
    }
    M.prism('tex:conc', x, z, topY - 0.15, topY + 0.25, r1 * 1.55, r1 * 1.55, n, 0x3a3e42, true);
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; M.beam('metal', [x + Math.cos(a) * r1 * 1.5, topY + 0.25, z + Math.sin(a) * r1 * 1.5], [x + Math.cos(a) * r1 * 1.5, topY + 1.2, z + Math.sin(a) * r1 * 1.5], 0.05, 0x2a2e32); }
    // keeper's house at the foot
    const hm = new Mesher(M.rand, M.white);
    house(hm, { w: 9, d: 5.4, floors: 1, wall: 'clap', wcol: 0xf0ece0, roof: 'gable', rtex: 'shingle', rcol: 0x7a3a2c, pitch: 0.55, found: 1.6, chimney: { tex: 'brick' }, lit: 0.6 });
    S.bakeLocal(M, hm, x + (o.hx ?? 8), baseY + 0.1, z + 3, o.hyaw ?? 0.3);
  } else if (kind === 'screw') {
    const lvl = 3.4, n = 6, r = 4.2;
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, px = x + Math.cos(a) * (r + 0.6), pz = z + Math.sin(a) * (r + 0.6); M.prism('tex:wood', px, pz, Math.min(bed, -1) - 2.4, lvl, 0.28, 0.24, 8, 0x3a362e, false); M.beam('metal', [px, -0.5, pz], [x, -4.5, z], 0.1, 0x2a2a2a); }
    M.prism('tex:wood', x, z, lvl, lvl + 0.35, r + 1.4, r + 1.4, 12, 0x7a6a54, true);
    M.prism('tex:clap', x, z, lvl + 0.35, lvl + 3.9, r, r, 6, 0xf0ece2, false);
    for (let i = 0; i < 6; i++) { const a0 = ((i + 0.5) / 6) * 6.283 + 0.0, rr = r * 0.866 + 0.03; const cx = x + Math.cos(a0) * rr, cz = z + Math.sin(a0) * rr; const tx = -Math.sin(a0), tz = Math.cos(a0); for (const yy of [lvl + 0.9]) { M.quad('glass', [cx + tx * 0.5, yy, cz + tz * 0.5], [cx - tx * 0.5, yy, cz - tz * 0.5], [cx - tx * 0.5, yy + 1.3, cz - tz * 0.5], [cx + tx * 0.5, yy + 1.3, cz + tz * 0.5], 0x151d24); if (i % 2 === 0) M.quad('glow', [cx + tx * 0.42 + Math.cos(a0) * 0.02, yy + 0.08, cz + tz * 0.42 + Math.sin(a0) * 0.02], [cx - tx * 0.42 + Math.cos(a0) * 0.02, yy + 0.08, cz - tz * 0.42 + Math.sin(a0) * 0.02], [cx - tx * 0.42 + Math.cos(a0) * 0.02, yy + 1.22, cz - tz * 0.42 + Math.sin(a0) * 0.02], [cx + tx * 0.42 + Math.cos(a0) * 0.02, yy + 1.22, cz + tz * 0.42 + Math.sin(a0) * 0.02], new THREE.Color(1, 0.72, 0.4), WHITE(M)); } }
    M.prism('tex:shingle', x, z, lvl + 3.9, lvl + 5.4, r + 0.9, 1.3, 6, 0x8a2e24, true);
    topY = lvl + 5.4 + 1.8;
    M.prism('tex:clap', x, z, lvl + 5.4, topY, 1.3, 1.3, 6, 0xf0ece2, false);
    S.circles.push({ x, z, r: r + 2.0 });
  } else {
    const h = o.h || 28, w0 = 5.5, w1 = 1.6, y0 = Math.max(bed, 0) - 1;
    const corners = (t) => { const w = mix(w0, w1, t), y = y0 + (h - y0) * t; return [[x - w, y, z - w], [x + w, y, z - w], [x + w, y, z + w], [x - w, y, z + w]]; };
    const ns = 5;
    for (let i = 0; i < ns; i++) {
      const A = corners(i / ns), B = corners((i + 1) / ns), col = i % 2 ? 0xf0ece0 : 0xb03a2a;
      for (let k = 0; k < 4; k++) M.beam('metal', A[k], B[k], 0.35, 0x3a3e42);
      for (let k = 0; k < 4; k++) { const j = (k + 1) % 4; M.beam('metal', A[k], B[j], 0.12, col); M.beam('metal', B[k], A[j], 0.12, col); M.beam('metal', B[k], B[j], 0.15, 0x3a3e42); }
    }
    topY = h;
    M.box('tex:wood', x - 2.2, x + 2.2, topY - 0.2, topY + 0.1, z - 2.2, z + 2.2, 0x3a3e42);
    S.circles.push({ x, z, r: w0 + 1.2 });
  }
  // lantern room: glass, lit lamp, dome, ball
  const lr = kind === 'skeleton' ? 1.1 : 1.45;
  M.prism('beacon', x, z, topY + 0.3, topY + 2.4, lr, lr, 10, 0xfff0c0, true);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; M.beam('metal', [x + Math.cos(a) * (lr + 0.04), topY + 0.3, z + Math.sin(a) * (lr + 0.04)], [x + Math.cos(a) * (lr + 0.04), topY + 2.4, z + Math.sin(a) * (lr + 0.04)], 0.07, 0x2a2e32); }
  M.prism('metal', x, z, topY + 2.4, topY + 3.4, lr + 0.15, 0.1, 10, 0x8a2a24, true);
  S.beams.push({ x, z, y: topY + 1.3, speed: o.speed ?? 0.55, len: o.len ?? 650, phase: Math.random() * 6, col: o.col || [1, 0.92, 0.7] });
  return { x, z, topY };
}

// ---- bridges ---------------------------------------------------------------------------
// a long bridge on piers with a raised, trussed main span; deck lamps and tower beacons light at night
export function bridge(S, M, a, b, o = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, px = -dz, pz = dx;
  const W = o.width ?? 12, step = 8;
  let hmax = -99;
  for (let t = 0; t <= len; t += 25) hmax = Math.max(hmax, S.H(a[0] + dx * t, a[1] + dz * t));
  const deck = Math.max(o.deck ?? 12, hmax + 4);
  const mainAt = (o.mainAt ?? 0.5) * len, mainLen = o.mainLen ?? 150, rise = o.rise ?? 14;
  const hump = (t) => rise * smooth(1 - Math.abs(t - mainAt) / (mainLen * 0.9));
  const deckY = (t) => deck + hump(t);
  const steel = o.steel ?? 0x56645a, conc = o.conc ?? 0xb4b0a6, hw = W / 2;
  const P = (t, s, y) => [a[0] + dx * t + px * s, y, a[1] + dz * t + pz * s];
  for (let t = 0; t < len; t += step) {
    const t1 = Math.min(len, t + step), y0 = deckY(t), y1 = deckY(t1);
    M.quad('tex:conc', P(t, -hw, y0), P(t1, -hw, y1), P(t1, hw, y1), P(t, hw, y0), 0x4a4a4c, { uo: 0, vo: t * 0.5 });
    M.quad('tex:conc', P(t, hw, y0 - 1.4), P(t1, hw, y1 - 1.4), P(t1, hw, y1), P(t, hw, y0), conc);
    M.quad('tex:conc', P(t1, -hw, y1 - 1.4), P(t, -hw, y0 - 1.4), P(t, -hw, y0), P(t1, -hw, y1), conc);
    M.quad('tex:conc', P(t, -hw, y0 - 1.4), P(t1, -hw, y1 - 1.4), P(t1, hw, y1 - 1.4), P(t, hw, y0 - 1.4), 0x7a7870);
    for (const s of [-hw + 0.15, hw - 0.15]) M.beam('metal', P(t, s, y0 + 0.9), P(t1, s, y1 + 0.9), 0.1, 0x8a8e90);
  }
  for (let t = 0; t <= len; t += step * 2) for (const s of [-hw + 0.15, hw - 0.15]) M.beam('metal', P(t, s, deckY(t)), P(t, s, deckY(t) + 0.9), 0.08, 0x8a8e90);
  // piers
  const every = o.pierEvery ?? 56;
  for (let t = every / 2; t < len; t += every) {
    const c = P(t, 0, 0), g = S.H(c[0], c[2]), top = deckY(t) - 1.4;
    if (g > top - 3) continue;
    const big = Math.abs(t - mainAt) < mainLen * 0.6;
    const bw = big ? hw + 1.5 : hw * 0.55, ang = Math.atan2(dz, dx);
    const box = (s0, s1, t0, t1, y0, y1, col, tex) => { const A = P(t0, s0, 0), B = P(t1, s1, 0); M.box(tex, Math.min(A[0], B[0]), Math.max(A[0], B[0]), y0, y1, Math.min(A[2], B[2]), Math.max(A[2], B[2]), col, { sides: [1, 1, 1, 1, 1, 0] }); void ang; };
    if (Math.abs(dx) > Math.abs(dz)) box(-bw, bw, t - 1.4, t + 1.4, g - 1.5, top, 0xa8a49a, 'tex:conc'); else box(-bw, bw, t - 1.4, t + 1.4, g - 1.5, top, 0xa8a49a, 'tex:conc');
    // rounded cutwater ends, cap beam
    for (const s of [-bw, bw]) { const cp = P(t, s, 0); M.prism('tex:conc', cp[0], cp[2], g - 1.5, top, 1.4, 1.4, 8, 0xa8a49a, false); }
    const cp0 = P(t, -hw - 0.6, 0), cp1 = P(t, hw + 0.6, 0);
    M.box('tex:conc', Math.min(cp0[0], cp1[0]) - 1.7, Math.max(cp0[0], cp1[0]) + 1.7, top - 0.3, top + 0.2, Math.min(cp0[2], cp1[2]) - 1.7, Math.max(cp0[2], cp1[2]) + 1.7, 0xb4b0a6);
    if (g < 0.5) S.circles.push({ x: c[0], z: c[2], r: Math.max(2.2, bw * 0.9) }, ...(bw > 3 ? [{ x: P(t, -bw * 0.6, 0)[0], z: P(t, -bw * 0.6, 0)[2], r: 2 }, { x: P(t, bw * 0.6, 0)[0], z: P(t, bw * 0.6, 0)[2], r: 2 }] : []));
  }
  // truss over the main span: arched top chord, verticals and diagonals both sides
  if (o.truss !== false) {
    const t0 = mainAt - mainLen * 0.5, t1 = mainAt + mainLen * 0.5, nb = Math.round(mainLen / 9), arch = o.arch ?? 16;
    for (const s of [-hw + 0.3, hw - 0.3]) {
      let prev = null;
      for (let i = 0; i <= nb; i++) {
        const t = t0 + (mainLen * i) / nb, top = deckY(t) + 4 + arch * Math.sin((i / nb) * Math.PI);
        const pt = P(t, s, top);
        M.beam('metal', P(t, s, deckY(t)), pt, 0.35, steel);
        if (prev) { M.beam('metal', prev, pt, 0.55, steel); const tp = t - mainLen / nb; M.beam('metal', P(tp, s, deckY(tp)), pt, 0.22, steel); }
        prev = pt;
      }
    }
    for (let i = 0; i <= nb; i += 2) { const t = t0 + (mainLen * i) / nb, top = deckY(t) + 4 + arch * Math.sin((i / nb) * Math.PI); M.beam('metal', P(t, -hw + 0.3, top), P(t, hw - 0.3, top), 0.3, steel); }
    const tc = P(mainAt, 0, deckY(mainAt) + 4 + arch + 1.4);
    M.box('beacon', tc[0] - 0.35, tc[0] + 0.35, tc[1], tc[1] + 1.1, tc[2] - 0.35, tc[2] + 0.35, 0xff2a1a);
  }
  // deck lamps
  for (let t = 20; t < len; t += 48) for (const s of [-hw + 0.15, hw - 0.15]) { const y = deckY(t); M.beam('metal', P(t, s, y), P(t, s, y + 5.2), 0.12, 0x6a6e70); const q = P(t, s, y + 5.3); M.box('glow', q[0] - 0.3, q[0] + 0.3, q[1], q[1] + 0.2, q[2] - 0.3, q[2] + 0.3, new THREE.Color(1.7, 1.35, 0.85), { jit: 0, rect: M.white, sides: [1, 1, 1, 1, 0, 1] }); }
  return { deck, len };
}

// ---- levee ---------------------------------------------------------------------------------
// a long earth embankment with a gravel crest road; the lakeward face is riprapped
export function levee(S, M, a, b, o = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, px = -dz, pz = dx;
  const lake = o.lake ?? 1, top = o.crest ?? 5.2, cw = 3, base = o.base ?? 11;
  const step = 20;
  let prev = null;
  for (let t = 0; t <= len; t += step) {
    const cx = a[0] + dx * t, cz = a[1] + dz * t;
    let g = -99; for (const k of [-4, 0, 4]) g = Math.max(g, S.H(cx + px * k, cz + pz * k));
    const y = Math.max(g, 0.5) + top;
    const row = {
      c0: [cx - px * cw, y, cz - pz * cw], c1: [cx + px * cw, y, cz + pz * cw],
      b0: [cx - px * base, S.H(cx - px * base, cz - pz * base) - 0.6, cz - pz * base], b1: [cx + px * base, S.H(cx + px * base, cz + pz * base) - 0.6, cz + pz * base],
    };
    if (prev) {
      const q = (k0, k1, key, col, side) => M.quad(key, ...(side ? [prev[k0], prev[k1], row[k1], row[k0]] : [prev[k1], prev[k0], row[k0], row[k1]]), col, { jit: 0.1 });
      // left slope, crest, right slope (wound so normals point up/out)
      M.quad('plain', prev.b0, row.b0, row.c0, prev.c0, 0x6d8a46, { jit: 0.1 });
      M.quad('tex:conc', prev.c0, row.c0, row.c1, prev.c1, 0xa49e8c, { jit: 0.06 });
      M.quad('plain', prev.c1, row.c1, row.b1, prev.b1, 0x6d8a46, { jit: 0.1 });
      if (lake > 0) M.quad('tex:stone', prev.c1, row.c1, [row.c1[0] * 0.6 + row.b1[0] * 0.4, row.c1[1] * 0.6 + row.b1[1] * 0.4, row.c1[2] * 0.6 + row.b1[2] * 0.4], [prev.c1[0] * 0.6 + prev.b1[0] * 0.4, prev.c1[1] * 0.6 + prev.b1[1] * 0.4, prev.c1[2] * 0.6 + prev.b1[2] * 0.4], 0x8a867a, { jit: 0.05 });
      void q;
    }
    prev = row;
  }
}

// ---- dam ---------------------------------------------------------------------------------
// a gated spillway dam across a river (a - b along x at constant z), with a powerhouse and gantry crane
export function dam(S, M, a, b, o = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, nx = -dz, nz = dx;
  const top = o.top ?? 14, bayW = 20, pierW = 4, n = Math.floor(len / (bayW + pierW));
  const P = (t, s, y) => [a[0] + dx * t + nx * s, y, a[1] + dz * t + nz * s];
  const box = (t0, t1, s0, s1, y0, y1, col, tex, sides) => { const A = P(t0, s0, 0), B = P(t1, s1, 0); M.box(tex, Math.min(A[0], B[0]), Math.max(A[0], B[0]), y0, y1, Math.min(A[2], B[2]), Math.max(A[2], B[2]), col, { sides: sides || [1, 1, 1, 1, 1, 0] }); };
  box(0, len, -6, 6, -22, top - 5, 0x9a968c, 'tex:conc', [1, 1, 1, 1, 0, 0]);
  for (let i = 0; i <= n; i++) {
    const t = i * (bayW + pierW);
    box(t, t + pierW, -7, 7, -22, top + 8, 0xa8a49a, 'tex:conc');
    if (i < n) {
      box(t + pierW, t + pierW + bayW, -5, -3.4, -2, top + 6.6, 0x4a5a52, 'tex:tin');    // steel gate leaf
      box(t + pierW, t + pierW + bayW, -6, 6, top - 5, top - 4.2, 0x7a7870, 'tex:conc');
    }
    if (i < n) { for (const s of [-7.02, 7.02]) { const q0 = P(t + pierW + 1, s, top + 0.5), q1 = P(t + pierW + 3, s, top + 5); void q0; void q1; } }
  }
  // road deck and rail on top
  box(0, len, -7, 7, top + 8, top + 8.6, 0x8a8a86, 'tex:conc');
  for (const s of [-7, 7]) box(0, len, s - 0.06, s + 0.06, top + 8.6, top + 9.6, 0x6e7276, 'tex:conc');
  // gantry crane running on the deck
  const gt = len * 0.58;
  for (const s of [-5, 5]) { box(gt, gt + 3, s - 0.4, s + 0.4, top + 8.6, top + 24, 0xd4a020, 'metal'); }
  box(gt, gt + 3, -6, 6, top + 22, top + 24.5, 0xd4a020, 'metal');
  // lights on the piers
  for (let i = 0; i <= n; i += 2) { const q = P(i * (bayW + pierW) + pierW / 2, 7.1, top + 7); M.box('glow', q[0] - 0.35, q[0] + 0.35, q[1], q[1] + 0.5, q[2] - 0.35, q[2] + 0.35, new THREE.Color(1.6, 1.4, 1.0), { jit: 0, rect: M.white, sides: [1, 1, 1, 1, 1, 1] }); }
  // powerhouse at the far end: long hall with a window band
  const ph0 = len * 0.7, ph1 = len * 0.7 + 90;
  box(ph0, Math.min(len, ph1), -48, -8, -10, top + 7, 0xb4b0a6, 'tex:conc');
  box(ph0 - 1, Math.min(len, ph1) + 1, -49, -7, top + 7, top + 8.4, 0x6e7276, 'tex:tin');
  for (let t = ph0 + 4; t < Math.min(len, ph1) - 4; t += 7) {
    const A = P(t, -7.99, top + 1.5), B = P(t + 4, -7.99, top + 1.5), C = P(t + 4, -7.99, top + 5.5), D = P(t, -7.99, top + 5.5);
    M.quad('glass', B, A, D, C, 0x18222a);
    if (S.rand() < 0.7) { const e = (v) => [v[0] - nx * 0.01, v[1], v[2] - nz * 0.01]; M.quad('glow', e(B), e(A), e(D), e(C), new THREE.Color(1, 0.88, 0.6), WHITE(M)); }
  }
  // boats can't pass: circles along the wall
  for (let t = 4; t < len; t += 9) { const c = P(t, 0, 0); S.circles.push({ x: c[0], z: c[2], r: 7 }); }
}

// ---- offshore platform ---------------------------------------------------------------------
export function platform(S, M, x, z, o = {}) {
  const sc = o.scale ?? 1, hw = 15 * sc, deckY = 16 * sc, steel = 0x8a8f94, rust = 0xa0502a, yellow = 0xe0b020;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    M.prism('plain', x + sx * hw * 0.9, z + sz * hw * 0.9, -60, deckY, 1.7 * sc, 1.4 * sc, 10, rust, false);
    M.prism('plain', x + sx * hw * 0.9, z + sz * hw * 0.9, 4, 10, 1.75 * sc, 1.75 * sc, 10, yellow, false);
    S.circles.push({ x: x + sx * hw * 0.9, z: z + sz * hw * 0.9, r: 2.2 * sc });
  }
  for (const y of [-1, 7]) { for (const s of [-1, 1]) { M.beam('metal', [x - hw * 0.9, y, z + s * hw * 0.9], [x + hw * 0.9, y, z + s * hw * 0.9], 0.5, steel); M.beam('metal', [x + s * hw * 0.9, y, z - hw * 0.9], [x + s * hw * 0.9, y, z + hw * 0.9], 0.5, steel); } }
  M.box('tex:conc', x - hw - 3, x + hw + 3, deckY, deckY + 2.4, z - hw - 3, z + hw + 3, steel);
  // accommodation block with windows lit at night
  const bx0 = x - hw, bx1 = x - hw * 0.1, bz0 = z - hw * 0.8, bz1 = z - hw * 0.05, by0 = deckY + 2.4, by1 = by0 + 9 * sc;
  M.box('tex:tin', bx0, bx1, by0, by1, bz0, bz1, 0xe8e6de);
  M.box('tex:tin', bx0 - 0.2, bx1 + 0.2, by1, by1 + 0.3, bz0 - 0.2, bz1 + 0.2, 0xc04a30);
  for (let f = 0; f < 3; f++) for (let k = 0; k < 9; k++) {
    const wx = bx0 + 1.5 + k * ((bx1 - bx0 - 3) / 8), wy = by0 + 1.4 + f * 2.6;
    M.quad('glass', [wx, wy, bz1 + 0.02], [wx + 1.2, wy, bz1 + 0.02], [wx + 1.2, wy + 1.2, bz1 + 0.02], [wx, wy + 1.2, bz1 + 0.02], 0x18222a);
    if (S.rand() < 0.55) M.quad('glow', [wx + 0.05, wy + 0.05, bz1 + 0.035], [wx + 1.15, wy + 0.05, bz1 + 0.035], [wx + 1.15, wy + 1.15, bz1 + 0.035], [wx + 0.05, wy + 1.15, bz1 + 0.035], new THREE.Color(1, 0.82, 0.55), WHITE(M));
  }
  // helideck on the corner, derrick, crane, flare boom
  M.prism('plain', x + hw * 0.7, z + hw * 0.8, by0 + 4.5, by0 + 5, 8.5 * sc, 8.5 * sc, 16, 0x3c4a3c, true);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; M.box('glow', x + hw * 0.7 + Math.cos(a) * 8.4 * sc - 0.2, x + hw * 0.7 + Math.cos(a) * 8.4 * sc + 0.2, by0 + 4.9, by0 + 5.1, z + hw * 0.8 + Math.sin(a) * 8.4 * sc - 0.2, z + hw * 0.8 + Math.sin(a) * 8.4 * sc + 0.2, new THREE.Color(0.6, 1.8, 0.7), { jit: 0, rect: M.white }); }
  M.beam('metal', [x + hw * 0.7 - 8, by0, z + hw * 0.8 - 8], [x + hw * 0.7 - 5, by0 + 4.6, z + hw * 0.8 - 5], 0.4, steel);
  M.beam('metal', [x + hw * 0.7 + 8, by0, z + hw * 0.8 + 8], [x + hw * 0.7 + 5, by0 + 4.6, z + hw * 0.8 + 5], 0.4, steel);
  const dx = x + hw * 0.15, dz = z + hw * 0.1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.beam('metal', [dx + sx * 4.5, deckY + 2.4, dz + sz * 4.5], [dx + sx * 0.8, deckY + 38 * sc, dz + sz * 0.8], 0.28, 0xd8d8d0);
  for (let h = 8; h < 36; h += 7) { const w = mix(4.5, 0.8, h / 38); M.beam('metal', [dx - w, deckY + 2.4 + h, dz - w], [dx + w, deckY + 2.4 + h, dz + w], 0.12, 0xd8d8d0); M.beam('metal', [dx + w, deckY + 2.4 + h, dz - w], [dx - w, deckY + 2.4 + h, dz + w], 0.12, 0xd8d8d0); }
  M.box('beacon', dx - 0.3, dx + 0.3, deckY + 39 * sc, deckY + 40 * sc, dz - 0.3, dz + 0.3, 0xff2a1a);
  // flare boom with a flame
  const fx = x + hw * 1.1, fz = z - hw * 1.1;
  M.beam('metal', [x + hw * 0.6, deckY + 2.4, z - hw * 0.6], [fx + hw * 0.3, deckY + 22 * sc, fz - hw * 0.3], 0.5, steel);
  M.prism('beacon', fx + hw * 0.3, fz - hw * 0.3, deckY + 22 * sc, deckY + 27 * sc, 0.2, 1.6, 7, 0xff7a1a, true);
  // a few storage tanks and containers
  for (let i = 0; i < 4; i++) M.box('plain', x + hw * 0.1 + i * 2.7, x + hw * 0.1 + i * 2.7 + 2.4, deckY + 2.4, deckY + 4.9, z - hw * 0.9, z - hw * 0.9 + 6, [0x3a6a8a, 0xb04a2a, 0x6a7a4a, 0xc8c0a8][i], { jit: 0.1 });
  return { x, z };
}

// ---- wind turbines ------------------------------------------------------------------------
export function turbine(S, M, x, z, o = {}) {
  const g = Math.max(S.H(x, z), 0.5), h = o.h ?? 62, yaw = o.yaw ?? 0, spin = o.spin ?? S.rand() * 6.28;
  M.prism('metal', x, z, g - 1, g + h, 2.1, 1.25, 10, 0xe8e8e4, false);
  const nx = Math.cos(yaw), nz = Math.sin(yaw);
  M.box('metal', x - 2.2, x + 2.2, g + h, g + h + 2.6, z - 1.3, z + 1.3, 0xdcdcd8);
  M.box('beacon', x - 0.2, x + 0.2, g + h + 2.6, g + h + 3.2, z - 0.2, z + 0.2, 0xff2a1a);
  const hubx = x + nx * 2.6, hubz = z + nz * 2.6, hy = g + h + 1.3;
  M.prism('metal', hubx, hubz, hy - 0.7, hy + 0.7, 0.9, 0.9, 8, 0xe8e8e4, true);
  const side = [-nz, nx];
  for (let b = 0; b < 3; b++) {
    const a = spin + (b * Math.PI * 2) / 3, L = 38, ca = Math.cos(a), sa = Math.sin(a);
    const A = (u, w) => [hubx + side[0] * sa * u + nx * w, hy + ca * u, hubz + side[1] * sa * u + nz * w];
    M.quad('metal', A(1, -0.6), A(1, 0.9), A(L, 0.12), A(L, -0.12), 0xf0f0ec, { jit: 0.02 });
    M.quad('metal', A(L, -0.12), A(L, 0.12), A(1, 0.9), A(1, -0.6), 0xe4e4e0, { jit: 0.02 });
  }
}

// ---- piers ---------------------------------------------------------------------------------
// a long public pier into the water with an end pavilion; piles and handrails, lamps lit at night
export function pier(S, M, x0, z0, dir, len, o = {}) {
  const dx = Math.cos(dir), dz = Math.sin(dir), px = -dz, pz = dx, w = o.width ?? 3.2, deck = o.deck ?? 1.5;
  const P = (t, s, y) => [x0 + dx * t + px * s, y, z0 + dz * t + pz * s];
  const step = 3;
  for (let t = -2; t < len; t += step) {
    const t1 = Math.min(len, t + step);
    M.quad('tex:wood', P(t, -w / 2, deck), P(t1, -w / 2, deck), P(t1, w / 2, deck), P(t, w / 2, deck), 0x8a7a66, { uo: 0, vo: t * 0.4, jit: 0.1 });
    M.quad('tex:wood', P(t1, -w / 2, deck - 0.35), P(t, -w / 2, deck - 0.35), P(t, -w / 2, deck), P(t1, -w / 2, deck), 0x5a4c3c);
    M.quad('tex:wood', P(t, w / 2, deck - 0.35), P(t1, w / 2, deck - 0.35), P(t1, w / 2, deck), P(t, w / 2, deck), 0x5a4c3c);
    for (const s of [-w / 2 + 0.1, w / 2 - 0.1]) M.beam('tex:wood', P(t, s, deck + 1.0), P(t1, s, deck + 1.0), 0.07, 0x9a8a74);
  }
  for (let t = 0; t <= len; t += 4) {
    for (const s of [-w / 2 + 0.2, w / 2 - 0.2]) {
      const c = P(t, s, 0), g = S.H(c[0], c[2]);
      M.prism('tex:wood', c[0], c[2], Math.min(g, -0.5) - 0.5, deck + 1.05, 0.2, 0.18, 6, 0x4a4234, false);
    }
    if (t % 12 === 0) { const c = P(t, -w / 2, deck + 1.6), l = P(t, -w / 2, deck); M.beam('metal', l, c, 0.08, 0x2a2e32); M.box('glow', c[0] - 0.25, c[0] + 0.25, c[1], c[1] + 0.18, c[2] - 0.25, c[2] + 0.25, new THREE.Color(1.8, 1.4, 0.9), { jit: 0, rect: M.white, sides: [1, 1, 1, 1, 0, 1] }); }
    if (t > 2) { const c = P(t, 0, 0); S.circles.push({ x: c[0], z: c[2], r: 1.9 }); }
  }
  if (o.pavilion !== false) {
    const hm = new Mesher(M.rand, M.white), pw = 8, pd = 5;
    house(hm, { w: pw, d: pd, floors: 1, wall: o.wall || 'clap', wcol: o.wcol || 0xe8e2d0, roof: 'hip', rtex: o.rtex || 'tin', rcol: o.rcol || 0x7a3a2c, pitch: 0.45, over: 0.8, found: 0, piles: null, porch: { rail: true, w: 5, s: 0, d: 1.4 }, lit: 0.8, attic: false });
    const pe = P(len - 1.2, 0, deck);
    // house() front is +z; turn it so the front faces back along the pier, then bake it onto the deck
    S.bakeLocal(M, hm, pe[0], deck, pe[2], Math.atan2(-dx, -dz) + 0);
  }
}

// vertical position helper for callers
export { smooth };

import * as THREE from 'three';
import { house, crate, barrel } from './bldMesh.js';
import { STYLES, pick } from './bldStyles.js';

// Building kinds for the background scenery: each is { w:[min,max], d:[min,max], build(M, rand, o) }
// with o = { w, d, found (depth of foundation needed below the floor), style }. Built around the local
// origin with y = 0 at the floor and +z the front (the side that faces the water).
const lerp = (r, [a, b]) => a + (b - a) * r;
export { lerp };

// a plain dwelling in a regional style
export function dwelling(styleName, o2 = {}) {
  const st = STYLES[styleName];
  return {
    w: o2.w || [6, 10], d: o2.d || [5, 7], wet: !!st.piles && o2.wet,
    build(M, rand, o) {
      const piles = st.piles ? { depth: Math.max(2.4, o.found + 0.6) } : null;
      house(M, {
        w: o.w, d: o.d, floors: o2.floors ? (rand() < 0.4 ? o2.floors : 1) : 1, wall: st.wall, wcol: pick(rand, o2.wcols || st.wcols), roof: st.roof, rtex: st.rtex, rcol: pick(rand, st.rcols), trim: st.trim,
        pitch: st.pitch * (0.9 + rand() * 0.25), over: st.over, found: piles ? 0 : Math.min(9, o.found), ftex: st.ftex || 'stone', fcol: st.fcol ?? 0x9a948a, piles, chimney: st.chimney && rand() < 0.65 ? { ...st.chimney, x: (rand() - 0.5) * o.w * 0.5 } : null,
        shutters: st.shutters && rand() < 0.5 ? st.shutters : null, porch: st.porch && rand() < 0.55 ? { ...st.porch, w: o.w * 0.6, s: 0 } : null, lit: o2.lit ?? 0.42, door: st.door, attic: st.front === 'none',
      });
      if (!piles && rand() < 0.5) { // barrels and crates by the wall or a stack of pots beside the house
        const sx = (rand() < 0.5 ? -1 : 1) * (o.w / 2 + 1.1 + rand());
        barrel(M, sx, 0, o.d / 2 * 0.3, 0.28, 0.85, [0x2f5a8a, 0x8a2a24, 0x6a6e72][Math.floor(rand() * 3)]);
        crate(M, sx + 0.7, 0, o.d / 2 * 0.3 + 0.2, 0.55, 0x6a5238, rand());
      }
    },
  };
}

// brick or clapboard townhouse, 2-3 floors, pitched roof end-on to the street
export function townhouse(styleName, o2 = {}) {
  const st = STYLES[styleName];
  return {
    w: o2.w || [8, 13], d: o2.d || [7, 9],
    build(M, rand, o) {
      const brick = o2.brick ?? rand() < 0.4;
      house(M, {
        w: o.w, d: o.d, floors: 2 + (rand() < 0.35 ? 1 : 0), fh: 3, wall: brick ? 'brick' : st.wall, wcol: brick ? pick(rand, [0xb86a50, 0xa85a44, 0x9a6a58, 0xc08060]) : pick(rand, st.wcols), roof: st.roof, rtex: st.rtex, rcol: pick(rand, st.rcols), trim: st.trim,
        pitch: 0.3 + rand() * 0.15, over: 0.35, found: Math.min(5, o.found), chimney: { tex: 'brick', x: (rand() - 0.5) * o.w * 0.6 }, shutters: st.shutters, lit: 0.45, ww: 1.05, wh: 1.5, attic: false,
        porch: rand() < 0.4 ? { rail: true, w: o.w * 0.5, s: 0 } : null,
      });
    },
  };
}

// a gambrel barn: tin or shingle, white trim, big sliding doors
export const barn = {
  w: [12, 18], d: [9, 12],
  build(M, rand, o) {
    const w = o.w, d = o.d, hw = w / 2, hd = d / 2, wh = 4.6, red = rand() < 0.8, col = red ? pick(rand, [0x8a2a22, 0x7a2a22, 0x9a3a2a]) : 0x9a9488;
    M.box('tex:conc', -hw - 0.05, hw + 0.05, -Math.min(4, o.found), 0.4, -hd - 0.05, hd + 0.05, 0x9a948a, { sides: [1, 1, 1, 1, 0, 0] });
    for (const n of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { /* walls below */ }
    // walls (long sides run along x; gable ends face +/-z)
    const Y0 = 0.4;
    M.quad('tex:batten', [-hw, Y0, hd], [hw, Y0, hd], [hw, Y0 + wh, hd], [-hw, Y0 + wh, hd], col);
    M.quad('tex:batten', [hw, Y0, -hd], [-hw, Y0, -hd], [-hw, Y0 + wh, -hd], [hw, Y0 + wh, -hd], col);
    // gambrel profile across x: eave -> knuckle -> ridge
    const kx = hw * 0.62, ky = Y0 + wh + 2.2, ry = Y0 + wh + 3.6, ov = 0.5;
    const prof = [[-hw - ov, Y0 + wh - 0.15], [-kx, ky], [0, ry], [kx, ky], [hw + ov, Y0 + wh - 0.15]];
    for (let i = 0; i < 4; i++) {
      const a = prof[i], b = prof[i + 1];
      const rc = new THREE.Color(rand() < 0.5 ? 0x6a6a68 : 0x4e4a46).multiplyScalar(0.9 + rand() * 0.2);
      M.quad('tex:tin', [a[0], a[1], hd + ov], [b[0], b[1], hd + ov], [b[0], b[1], -hd - ov], [a[0], a[1], -hd - ov], rc);
      M.quad('tex:tin', [a[0], a[1], -hd - ov], [b[0], b[1], -hd - ov], [b[0], b[1], hd + ov], [a[0], a[1], hd + ov], rc);
    }
    // end gables (pentagon)
    const gp = [[-hw, Y0 + wh], [-kx + 0.2, ky - 0.05], [0, ry - 0.05], [kx - 0.2, ky - 0.05], [hw, Y0 + wh]];
    for (const sz of [1, -1]) {
      const z = sz * hd, P = (i) => [gp[i][0], gp[i][1], z];
      const tr = (a, b, c) => (sz > 0 ? M.tri('tex:batten', a, b, c, col) : M.tri('tex:batten', a, c, b, col));
      tr(P(0), P(4), P(2)); tr(P(0), P(2), P(1)); tr(P(4), P(3), P(2));
    }
    // door with white X-brace, hay-hood window
    M.box('tex:wood', -2.2, 2.2, Y0, Y0 + 3.4, hd, hd + 0.08, 0xe8e4d8, { sides: [1, 0, 1, 1, 1, 0] });
    M.box('tex:batten', -2.0, 2.0, Y0, Y0 + 3.3, hd + 0.08, hd + 0.1, col, { sides: [1, 0, 0, 0, 0, 0] });
    M.beam('tex:wood', [-2.0, Y0, hd + 0.13], [2.0, Y0 + 3.3, hd + 0.13], 0.12, 0xe8e4d8);
    M.beam('tex:wood', [2.0, Y0, hd + 0.13], [-2.0, Y0 + 3.3, hd + 0.13], 0.12, 0xe8e4d8);
    M.quad('glass', [-0.6, Y0 + wh + 1.0, hd + 0.03], [0.6, Y0 + wh + 1.0, hd + 0.03], [0.6, Y0 + wh + 2.3, hd + 0.03], [-0.6, Y0 + wh + 2.3, hd + 0.03], 0x151d24);
    // silo beside it
    if (rand() < 0.7) silo(M, hw + 3.2, -hd * 0.3, rand);
  },
};
function silo(M, x, z, rand) {
  const r = 2.1, h = 12 + rand() * 3;
  M.prism('tex:conc', x, z, -2, h, r, r, 12, 0xb8b4a8, false);
  M.prism('tex:conc', x, z, h, h + 1.3, r, 0.3, 12, 0x7a7e84, true);
  for (let i = 1; i < 6; i++) M.prism('metal', x, z, i * 2.2, i * 2.2 + 0.08, r + 0.03, r + 0.03, 12, 0x5a5e62, false);
}
export const siloKind = { w: [5, 6], d: [5, 6], build(M, rand, o) { silo(M, 0, 0, rand); } };

// stepped mid-rise: hotel, apartments, casino tower. Terraces, balconies, rooftop plant.
export function block(o2 = {}) {
  return {
    w: o2.w || [18, 26], d: o2.d || [12, 16],
    build(M, rand, o) {
      const tiers = [], base = o2.floors ? o2.floors : [4, 8];
      let fl = Array.isArray(base) ? base[0] + Math.floor(rand() * (base[1] - base[0] + 1)) : base;
      let w = o.w, d = o.d, y = 0;
      const nTier = o2.tiers ?? 2;
      for (let t = 0; t < nTier; t++) { tiers.push({ w, d, y, fl: t === 0 ? Math.max(2, Math.round(fl * (nTier > 1 ? 0.55 : 1))) : Math.max(2, Math.round(fl * 0.45)), ox: t ? (rand() - 0.5) * (tiers[0].w - w) : 0 }); y += tiers[t].fl * 3.2; w *= 0.72; d *= 0.8; }
      const wall = o2.wall || 'stucco', wcol = pick(rand, o2.wcols || [0xf2ece0, 0xeadfc8, 0xf0d8b8]);
      M.box('tex:conc', -o.w / 2 - 0.1, o.w / 2 + 0.1, -Math.min(5, o.found), 0.3, -o.d / 2 - 0.1, o.d / 2 + 0.1, 0xa8a49a, { sides: [1, 1, 1, 1, 0, 0] });
      for (const t of tiers) {
        const x0 = t.ox - t.w / 2, x1 = t.ox + t.w / 2, z0 = -t.d / 2, z1 = t.d / 2, Y0 = t.y + 0.3, Y1 = Y0 + t.fl * 3.2;
        M.box(`tex:${wall}`, x0, x1, Y0, Y1, z0, z1, wcol, { jit: 0.03 });
        // parapet + terracotta eave
        M.box('tex:conc', x0 - 0.15, x1 + 0.15, Y1, Y1 + 0.9, z0 - 0.15, z0 + 0.1, 0xd8d0c0); M.box('tex:conc', x0 - 0.15, x1 + 0.15, Y1, Y1 + 0.9, z1 - 0.1, z1 + 0.15, 0xd8d0c0);
        M.box('tex:conc', x0 - 0.15, x0 + 0.1, Y1, Y1 + 0.9, z0, z1, 0xd8d0c0); M.box('tex:conc', x1 - 0.1, x1 + 0.15, Y1, Y1 + 0.9, z0, z1, 0xd8d0c0);
        if (o2.tile) M.box('tex:tile', x0 - 0.4, x1 + 0.4, Y1 + 0.9, Y1 + 1.4, z1 - 0.1, z1 + 0.5, 0xb85a3a);
        // window grid: glass + (some lit) glow, balcony slab per floor on the front
        const floorLit = Array.from({ length: t.fl }, () => 0.25 + rand() * 1.1), colLit = Array.from({ length: 8 }, () => rand());
        for (let f = 0; f < t.fl; f++) {
          const fy = Y0 + f * 3.2 + 0.9;
          M.box('tex:conc', x0 - 0.05, x1 + 0.05, Y0 + f * 3.2 - 0.1, Y0 + f * 3.2 + 0.1, z0 - 0.05, z1 + 0.05, 0xcfc9bb, { sides: [1, 1, 1, 1, 0, 0] });
          if (o2.balcony && f > 0) M.box('tex:conc', x0 + 0.5, x1 - 0.5, Y0 + f * 3.2 - 0.12, Y0 + f * 3.2 + 0.05, z1, z1 + 1.3, 0xe0d8c8);
          if (o2.balcony && f > 0) M.box('plain', x0 + 0.5, x1 - 0.5, Y0 + f * 3.2 + 0.05, Y0 + f * 3.2 + 0.95, z1 + 1.2, z1 + 1.26, 0x2a3a48);
          for (const side of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const len = side[1] ? t.w : t.d, n = Math.max(2, Math.floor(len / 3));
            for (let k = 0; k < n; k++) {
              const s = -len / 2 + (len * (k + 0.5)) / n;
              const nx = side[0], nz = side[1], px = nz ? t.ox + s : (nx > 0 ? x1 : x0), pz = nz ? (nz > 0 ? z1 : z0) : s;
              const off = 0.03, tx = nz ? 1 : 0, tz = nx ? (nx > 0 ? -1 : 1) : 0, tx2 = nz ? (nz > 0 ? 1 : -1) : 0;
              const hw2 = 0.65, a = [px + tx2 * -hw2 + tz * 0 + nx * off, fy, pz + tz * -hw2 + nz * off], b = [px + tx2 * hw2 + nx * off, fy, pz + tz * hw2 + nz * off];
              const c = [b[0], fy + 1.4, b[2]], dd = [a[0], fy + 1.4, a[2]];
              M.quad('glass', a, b, c, dd, 0x18222a, { jit: 0.2 });
              if (rand() < (o2.lit ?? 0.5) * floorLit[f] * (0.55 + 0.9 * colLit[k % 8])) {
                const wc = [[1, 0.78, 0.45], [1, 0.86, 0.6], [0.8, 0.9, 1]][Math.floor(rand() * 3)], kk = 0.8 + rand() * 0.5;
                const e = 0.015, a2 = [a[0] + nx * e, a[1] + 0.05, a[2] + nz * e], b2 = [b[0] + nx * e, a[1] + 0.05, b[2] + nz * e];
                M.quad('glow', a2, b2, [b2[0], fy + 1.35, b2[2]], [a2[0], fy + 1.35, a2[2]], new THREE.Color(wc[0] * kk, wc[1] * kk, wc[2] * kk), { rect: M.white, jit: 0, uo: 0, vo: 0 });
              }
            }
          }
        }
      }
      // rooftop: stair core, water tank, AC units
      const top = tiers[tiers.length - 1], Yt = top.y + 0.3 + top.fl * 3.2 + 0.9;
      M.box('tex:conc', top.ox - 1.6, top.ox + 1.6, Yt, Yt + 2.6, -1.4, 1.4, 0xd0c8b8);
      M.prism('tex:tin', top.ox + top.w * 0.25, top.d * 0.2, Yt, Yt + 2.2, 1.1, 1.1, 9, 0x8a8c8e, true);
      for (let i = 0; i < 3; i++) M.box('metal', top.ox - top.w * 0.3 + i * 1.4, top.ox - top.w * 0.3 + i * 1.4 + 1.0, Yt, Yt + 0.8, top.d * 0.2, top.d * 0.2 + 0.9, 0xb0b4b8);
      if (o2.sign) M.box('beacon', top.ox - 0.15, top.ox + 0.15, Yt + 2.6, Yt + 3.4, -0.15, 0.15, 0xff2a1a);
    },
  };
}

// a working industrial site: low sheds with sawtooth or gable tin roofs, tanks, a chimney with a beacon
export function plant(o2 = {}) {
  return {
    w: o2.w || [30, 46], d: o2.d || [20, 28],
    build(M, rand, o) {
      const w = o.w, d = o.d, hw = w / 2, hd = d / 2;
      M.box('tex:conc', -hw - 1, hw + 1, -Math.min(4, o.found), 0.2, -hd - 1, hd + 1, 0x8a8a86, { sides: [1, 1, 1, 1, 1, 0] });
      // main hall with rolling doors and ribbon windows
      const hh = 8, wx = -hw * 0.1;
      M.box('tex:tin', wx - hw * 0.7, wx + hw * 0.7, 0.2, 0.2 + hh, -hd * 0.1, hd * 0.9, pick(rand, [0xc8ccce, 0xa8b0b4, 0xb8b4a6]), { jit: 0.05 });
      const roofCol = pick(rand, [0x9a9894, 0x6e7478, 0x8a4a3a]);
      const teeth = 4, tw = (hw * 1.4) / teeth;
      for (let i = 0; i < teeth; i++) {
        const x0 = wx - hw * 0.7 + i * tw, x1 = x0 + tw, yB = 0.2 + hh;
        M.quad('tex:tin', [x0, yB, hd * 0.9 + 0.3], [x1, yB + 2.4, hd * 0.9 + 0.3], [x1, yB + 2.4, -hd * 0.1 - 0.3], [x0, yB, -hd * 0.1 - 0.3], roofCol);
        M.quad('glass', [x1 - 0.02, yB + 2.4, hd * 0.9 + 0.3], [x1 - 0.02, yB, hd * 0.9 + 0.3], [x1 - 0.02, yB, -hd * 0.1 - 0.3], [x1 - 0.02, yB + 2.4, -hd * 0.1 - 0.3], 0x202a30);
        M.quad('glow', [x1 - 0.03, yB + 0.1, hd * 0.9 + 0.3], [x1 - 0.03, yB + 2.3, hd * 0.9 + 0.3], [x1 - 0.03, yB + 2.3, -hd * 0.1 - 0.3], [x1 - 0.03, yB + 0.1, -hd * 0.1 - 0.3], new THREE.Color(0.9, 0.95, 0.9), { rect: M.white, jit: 0, uo: 0, vo: 0 });
      }
      for (let k = 0; k < 4; k++) {
        const x = wx - hw * 0.55 + k * hw * 0.36;
        M.box('plain', x - 2, x + 2, 0.2, 5, hd * 0.9, hd * 0.9 + 0.1, 0x6a7a82);
        M.quad('glow', [x - 1.8, 4.3, hd * 0.9 + 0.12], [x + 1.8, 4.3, hd * 0.9 + 0.12], [x + 1.8, 4.9, hd * 0.9 + 0.12], [x - 1.8, 4.9, hd * 0.9 + 0.12], new THREE.Color(1.0, 0.9, 0.6), { rect: M.white, jit: 0, uo: 0, vo: 0 });
      }
      // tanks / silos
      const nt = o2.tanks ?? 3;
      for (let i = 0; i < nt; i++) {
        const tx = hw * 0.75 + (i % 2) * 5.5, tz = -hd * 0.5 + Math.floor(i / 2) * 6, r = 2.4 + (i % 2) * 0.4, th = o2.tall ? 18 : 9 + i;
        M.prism('tex:tin', tx, tz, 0.2, th, r, r, 14, o2.tankCol ?? 0xd8d6cc, false);
        M.prism('tex:tin', tx, tz, th, th + 1.2, r, 0.4, 14, 0x9a9c9e, true);
        for (let k = 1; k < 3; k++) M.prism('metal', tx, tz, th * k / 3, th * k / 3 + 0.07, r + 0.03, r + 0.03, 14, 0x555a5e, false);
      }
      // stack with a beacon
      if (o2.stack !== false) {
        const sx = -hw * 0.82, sh = o2.stackH ?? 48;
        M.prism('tex:brick', sx, -hd * 0.4, 0, sh, 2.2, 1.2, 12, 0xa4604a, true);
        M.prism('plain', sx, -hd * 0.4, sh - 6, sh - 3.6, 1.35, 1.25, 12, 0xe8e4dc, false);
        M.prism('plain', sx, -hd * 0.4, sh - 3.6, sh - 1.2, 1.25, 1.2, 12, 0xc03a28, false);
        M.box('beacon', sx - 0.25, sx + 0.25, sh + 0.1, sh + 0.7, -hd * 0.4 - 0.25, -hd * 0.4 + 0.25, 0xff2a1a);
      }
      // office
      M.box('tex:clap', hw * 0.1, hw * 0.1 + 8, 0.2, 3.4, hd * 0.6, hd * 0.6 + 5, 0xe0ddd2);
      M.box('tex:tin', hw * 0.1 - 0.3, hw * 0.1 + 8.3, 3.4, 3.6, hd * 0.6 - 0.3, hd * 0.6 + 5.3, 0x7a7e82);
      for (let k = 0; k < 3; k++) { const x = hw * 0.1 + 1.4 + k * 2.6; M.quad('glass', [x, 1.2, hd * 0.6 + 5.02], [x + 1.2, 1.2, hd * 0.6 + 5.02], [x + 1.2, 2.5, hd * 0.6 + 5.02], [x, 2.5, hd * 0.6 + 5.02], 0x18222a); if (rand() < 0.7) M.quad('glow', [x + 0.05, 1.25, hd * 0.6 + 5.04], [x + 1.15, 1.25, hd * 0.6 + 5.04], [x + 1.15, 2.45, hd * 0.6 + 5.04], [x + 0.05, 2.45, hd * 0.6 + 5.04], new THREE.Color(1, 0.8, 0.5), { rect: M.white, jit: 0, uo: 0, vo: 0 }); }
    },
  };
}

// a white clapboard church with a square tower and spire
export function church(styleName = 'chesapeake') {
  const st = STYLES[styleName];
  return {
    w: [8, 10], d: [14, 18],
    build(M, rand, o) {
      const w = o.w, d = o.d;
      // nave runs along z; house() ridge runs along x, so build it rotated by hand: use two quads sets
      const hw = w / 2, hd = d / 2, wh = 5.2, rise = 3.4, white = 0xf0ece0;
      M.box('tex:stone', -hw - 0.05, hw + 0.05, -Math.min(4, o.found), 0.5, -hd - 0.05, hd + 0.05, 0x9a948a, { sides: [1, 1, 1, 1, 0, 0] });
      for (const sx of [-1, 1]) M.quad('tex:clap', [sx * hw, 0.5, sx > 0 ? hd : -hd], [sx * hw, 0.5, sx > 0 ? -hd : hd], [sx * hw, 0.5 + wh, sx > 0 ? -hd : hd], [sx * hw, 0.5 + wh, sx > 0 ? hd : -hd], white);
      M.quad('tex:clap', [-hw, 0.5, hd], [hw, 0.5, hd], [hw, 0.5 + wh, hd], [-hw, 0.5 + wh, hd], white);
      M.quad('tex:clap', [hw, 0.5, -hd], [-hw, 0.5, -hd], [-hw, 0.5 + wh, -hd], [hw, 0.5 + wh, -hd], white);
      const rc = pick(rand, st.rcols);
      M.quad('tex:shingle', [-hw - 0.5, 0.5 + wh - 0.1, hd + 0.4], [0, 0.5 + wh + rise, hd + 0.4], [0, 0.5 + wh + rise, -hd - 0.4], [-hw - 0.5, 0.5 + wh - 0.1, -hd - 0.4], rc);
      M.quad('tex:shingle', [hw + 0.5, 0.5 + wh - 0.1, -hd - 0.4], [0, 0.5 + wh + rise, -hd - 0.4], [0, 0.5 + wh + rise, hd + 0.4], [hw + 0.5, 0.5 + wh - 0.1, hd + 0.4], rc);
      M.tri('tex:clap', [-hw, 0.5 + wh, hd], [hw, 0.5 + wh, hd], [0, 0.5 + wh + rise - 0.05, hd], white);
      M.tri('tex:clap', [hw, 0.5 + wh, -hd], [-hw, 0.5 + wh, -hd], [0, 0.5 + wh + rise - 0.05, -hd], white);
      // tall windows, lit from inside at night
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
        const z = -hd + 2.5 + k * ((d - 5) / 3), x = sx * (hw + 0.03);
        M.quad('glass', [x, 1.8, z + 0.5 * sx], [x, 1.8, z - 0.5 * sx], [x, 4.6, z - 0.5 * sx], [x, 4.6, z + 0.5 * sx], 0x1c2230);
        if (rand() < 0.5) { const e = sx * 0.015; M.quad('glow', [x + e, 1.9, z + 0.4 * sx], [x + e, 1.9, z - 0.4 * sx], [x + e, 4.5, z - 0.4 * sx], [x + e, 4.5, z + 0.4 * sx], new THREE.Color(1, 0.72, 0.4), { rect: M.white, jit: 0, uo: 0, vo: 0 }); }
      }
      // tower at the front + spire
      const tw = 2.8, tz = hd + tw / 2 - 0.4, th = wh + 4.5;
      M.box('tex:clap', -tw / 2, tw / 2, 0.5, th, hd - 0.4, hd - 0.4 + tw, white);
      M.box('plain', -tw / 2 + 0.5, tw / 2 - 0.5, th - 3, th - 1.5, tz - 0.2, tz + tw / 2 - 0.35, 0x20262c);
      M.quad('tex:shingle', [-tw / 2 - 0.2, th, tz + tw / 2 + 0.2], [tw / 2 + 0.2, th, tz + tw / 2 + 0.2], [0, th + 6.5, tz], [0, th + 6.5, tz], 0x5a6068);
      M.quad('tex:shingle', [tw / 2 + 0.2, th, tz - tw / 2 - 0.2], [-tw / 2 - 0.2, th, tz - tw / 2 - 0.2], [0, th + 6.5, tz], [0, th + 6.5, tz], 0x5a6068);
      M.quad('tex:shingle', [tw / 2 + 0.2, th, tz + tw / 2 + 0.2], [tw / 2 + 0.2, th, tz - tw / 2 - 0.2], [0, th + 6.5, tz], [0, th + 6.5, tz], 0x5a6068);
      M.quad('tex:shingle', [-tw / 2 - 0.2, th, tz - tw / 2 - 0.2], [-tw / 2 - 0.2, th, tz + tw / 2 + 0.2], [0, th + 6.5, tz], [0, th + 6.5, tz], 0x5a6068);
      M.beam('metal', [0, th + 6.3, tz], [0, th + 7.8, tz], 0.08, 0xd8d0b0);
      M.box('tex:wood', -0.9, 0.9, 0.5, 2.8, hd + 0.0, hd + 0.1, 0x5a2a22, { sides: [1, 0, 0, 0, 0, 0] });
    },
  };
}

// a Lao/Thai wat: tiered orange tile roofs over a white hall, with a gilded stupa
export const wat = {
  w: [10, 12], d: [16, 20], slope: 4, range: 3,
  build(M, rand, o) {
    const hw = o.w / 2, hd = o.d / 2;
    M.box('tex:conc', -hw - 1, hw + 1, -Math.min(4, o.found), 1.0, -hd - 1, hd + 1, 0xd8d0c0, { sides: [1, 1, 1, 1, 1, 0] });
    M.box('tex:stucco', -hw, hw, 1.0, 6, -hd, hd, 0xf0e8d8);
    for (const [k, [hy, sc]] of [[0, [6, 1.45]], [1, [8.4, 1.15]]]) {
      const y = hy, x = hw * sc, z = hd * sc, top = y + 3.6 - k * 0.5;
      for (const [cx, cz] of [[-x, z], [x, z], [x, -z], [-x, -z]]) M.beam('plain', [cx, y, cz], [cx * 1.06, y + 0.9, cz * 1.06], 0.14, 0xe8c040);
      const rc = k ? 0xc84a22 : 0xd05a28;
      M.quad('tex:tile', [-x, y, z], [x, y, z], [x * 0.75, top, z * 0.2], [-x * 0.75, top, z * 0.2], rc);
      M.quad('tex:tile', [x, y, -z], [-x, y, -z], [-x * 0.75, top, -z * 0.2], [x * 0.75, top, -z * 0.2], rc);
      M.quad('tex:tile', [x, y, z], [x, y, -z], [x * 0.75, top, -z * 0.2], [x * 0.75, top, z * 0.2], rc);
      M.quad('tex:tile', [-x, y, -z], [-x, y, z], [-x * 0.75, top, z * 0.2], [-x * 0.75, top, -z * 0.2], rc);
      M.beam('plain', [-x, y + 0.1, z], [x, y + 0.1, z], 0.2, 0xe8c040);
    }
    M.box('plain', -hw * 0.9, hw * 0.9, 6, 8.4, -hd * 0.5, hd * 0.5, 0xf0e8d8);
    for (let i = -2; i <= 2; i++) { M.prism('plain', i * (hw * 0.38), hd + 0.9, 1.0, 5.6, 0.22, 0.2, 8, 0x9a2a22, false); M.prism('plain', i * (hw * 0.38), hd + 0.9, 5.6, 5.8, 0.3, 0.3, 8, 0xe8c040, true); }
    M.box('tex:conc', -hw - 0.2, hw + 0.2, 0.6, 1.0, hd, hd + 2.0, 0xd0c8b6);
    M.box('plain', -hw * 0.9, hw * 0.9, 5.8, 6.05, hd - 0.1, hd + 1.1, 0xe8c040);
    // door and tall windows, a little gold
    M.box('plain', -1.2, 1.2, 1.0, 4.2, hd, hd + 0.1, 0x8a2a22, { sides: [1, 0, 0, 0, 0, 0] });
    for (const sx of [-4, 4]) { M.quad('glass', [sx - 0.6, 2, hd + 0.03], [sx + 0.6, 2, hd + 0.03], [sx + 0.6, 4.2, hd + 0.03], [sx - 0.6, 4.2, hd + 0.03], 0x1c2230); M.quad('glow', [sx - 0.5, 2.1, hd + 0.05], [sx + 0.5, 2.1, hd + 0.05], [sx + 0.5, 4.1, hd + 0.05], [sx - 0.5, 4.1, hd + 0.05], new THREE.Color(1, 0.74, 0.4), { rect: M.white, jit: 0, uo: 0, vo: 0 }); }
    // stupa behind
    const sz = -hd - 6;
    for (let i = 0; i < 4; i++) M.prism('plain', 0, sz, i * 0.8, i * 0.8 + 0.8, 3.4 - i * 0.5, 3.0 - i * 0.5, 8, 0xe0c870, true);
    M.prism('plain', 0, sz, 3.2, 10, 1.6, 0.9, 10, 0xe8cc78, true);
    M.prism('plain', 0, sz, 10, 15, 0.9, 0.05, 10, 0xe8cc78, true);
    M.box('beacon', -0.08, 0.08, 15, 15.3, sz - 0.08, sz + 0.08, 0xffaa40);
  },
};

// a hjell: A-frame rack with split cod hung out to dry
export const hjell = {
  w: [10, 14], d: [3, 3], slope: 3.5, range: 2.4,
  build(M, rand, o) {
    const n = Math.round(o.w / 2.6);
    for (let i = 0; i <= n; i++) { const x = -o.w / 2 + (o.w * i) / n; M.beam('tex:wood', [x, 0, -0.9], [x, 4.2, 0], 0.12, 0x7a6a56); M.beam('tex:wood', [x, 0, 0.9], [x, 4.2, 0], 0.12, 0x7a6a56); }
    for (const y of [1.6, 2.5, 3.4, 4.2]) M.beam('tex:wood', [-o.w / 2, y, 0], [o.w / 2, y, 0], 0.09, 0x6a5a48);
    for (let k = 0; k < o.w * 2.2; k++) { const x = -o.w / 2 + 0.3 + (k / (o.w * 2.2)) * (o.w - 0.6), y = [2.5, 3.4, 4.2][k % 3]; M.box('plain', x - 0.1, x + 0.1, y - 0.7, y, -0.07, 0.07, [0xe4d8b8, 0xd8c8a0, 0xc8b890][k % 3], { jit: 0.2 }); }
  },
};

// the old coastal fishing plant: white sheds with red roofs, tanks and a conveyor to the quay (Lofoten)
export const fishPlant = plant({ tanks: 2, stack: false, tankCol: 0xe4e0d6 });

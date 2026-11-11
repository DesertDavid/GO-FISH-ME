import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mesher, rng, house, faceMap, windowOn, doorOn, crate, barrel, pot } from './bldMesh.js';
import { bldTexture, SignAtlas } from './bldTex.js';
import { dockProfile } from './chart.js';
import { buildScatter } from './bldScatter.js';
import { hallShell, HALL } from './trophyHall.js';
import { STYLES, LOC_STYLE, TEXT, BOARDS, FONTS, pick } from './bldStyles.js';

// Buildings for every water: the shop behind each Chart dock marker (NPC buildings you walk up to:
// marina office, bait & tackle, fish buyer, fuel pumps, boat yard) and the background villages,
// farms, bridges and landmarks (bldScatter.js). Dock-side buildings are modelled per regional
// style, signed in the local language, lit at night, and block walking (and the Chart's
// services work from their doors as well as from the deck).
const ROOF_TEX = new Set(['shingle', 'tin', 'tile', 'thatch']);

export class BldMats {
  constructor(patchProp) {
    this.patch = patchProp;
    this.map = new Map();
    this.glowAtlas = new SignAtlas(true);
    this.signAtlas = new SignAtlas(false);
    this.glow = new THREE.MeshBasicMaterial({ map: this.glowAtlas.tex, vertexColors: true, transparent: true, depthWrite: false, fog: true });
    this.glow.color.setScalar(0);
    this.beacon = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    this.beacon.color.setScalar(0);
    this.beam = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
    this.beam.color.setScalar(0);
  }

  get(key) {
    if (key === 'glow') return this.glow;
    if (key === 'beacon') return this.beacon;
    if (key === 'beam') return this.beam;
    let m = this.map.get(key);
    if (m) return m;
    if (key === 'glass') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.5 });
    else if (key === 'sign') m = new THREE.MeshStandardMaterial({ map: this.signAtlas.tex, vertexColors: true, roughness: 0.85 });
    else if (key === 'metal') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.65 });
    else if (key === 'plain') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    else {
      const kind = key.slice(4);
      m = new THREE.MeshStandardMaterial({
        map: bldTexture(kind), vertexColors: true, roughness: kind === 'tin' ? 0.5 : 0.9, metalness: kind === 'tin' ? 0.5 : 0,
        side: ROOF_TEX.has(kind) || kind === 'wood' ? THREE.DoubleSide : THREE.FrontSide,
      });
    }
    this.patch(m);
    this.map.set(key, m);
    return m;
  }
}


export class Buildings {
  constructor(g) {
    this.g = g;
    this.loc = g.loc;
    this.H = g.heightAt;
    this.group = new THREE.Group();
    this.group.name = 'buildings';
    this.mats = new BldMats(g.patchProp);
    this.rects = [];           // walk blockers: oriented boxes
    this.hall = null;          // trophy hall site { cx, cz, y0, theta } (marina only)
    this.doors = [];           // { x, z, dock, title, role }
    this.circles = [];         // boat obstacles (stilts over water, piers, towers)
    this.lights = [];
    this.night = 0;
    this._cullT = 0;
    this.styleName = LOC_STYLE[this.loc.id] || null;
    this.rand = rng(this.loc.id.length * 4099 + 71);
    this.buildDockSide();
    this.scatter = buildScatter(this);
    if (this.scatter) this.group.add(this.scatter.group);
    // one warm light at the nearest shop door (fixed count keeps the shaders stable)
    this.light = new THREE.PointLight(0xffc27a, 0, 22, 2);
    this.group.add(this.light);
  }

  // ---- sign and sign-board geometry -----------------------------------------------------
  signRect(o) { return this.mats.signAtlas.add(o); }
  neonRect(o) { return this.mats.glowAtlas.add(o); }

  // a painted board on a wall, with a plank frame and corner brackets
  board(M, F, s, y, bw, bh, o, off = 0.12) {
    const rect = this.signRect(o);
    const q = (a, b, c, d) => M.quad('sign', a, b, c, d, 0xffffff, { rect, jit: 0.03 });
    q(F.p(s - bw / 2, y, off + 0.045), F.p(s + bw / 2, y, off + 0.045), F.p(s + bw / 2, y + bh, off + 0.045), F.p(s - bw / 2, y + bh, off + 0.045));
    const fr = 0x3a2e24, t = 0.06;
    const S = (s0, s1, y0, y1) => { const A = F.p(s0, y0, off), B = F.p(s1, y1, off + 0.05); M.box('tex:wood', Math.min(A[0], B[0]), Math.max(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[1], B[1]), Math.min(A[2], B[2]), Math.max(A[2], B[2]), fr, { jit: 0.1 }); };
    S(s - bw / 2 - t, s + bw / 2 + t, y - t, y); S(s - bw / 2 - t, s + bw / 2 + t, y + bh, y + bh + t); S(s - bw / 2 - t, s - bw / 2, y, y + bh); S(s + bw / 2, s + bw / 2 + t, y, y + bh);
  }

  // a sign hung on an iron bracket, readable from the path (faces both ways along the wall)
  blade(M, F, s, y, bw, bh, o) {
    const rect = this.signRect(o);
    const arm = 0.8, x0 = F.p(s, y + bh + 0.28, 0.05), x1 = F.p(s, y + bh + 0.28, 0.05 + arm);
    M.beam('metal', x0, x1, 0.05, 0x23262a);
    M.beam('metal', F.p(s, y + bh + 0.28, 0.05 + arm), F.p(s, y + bh, 0.05 + arm), 0.025, 0x23262a);
    // the board lies in the plane spanned by the wall normal and the vertical, 0.6 m wide
    const N = F.p(0, 0, 1), N0 = F.p(0, 0, 0), nv = [N[0] - N0[0], 0, N[2] - N0[2]];
    const T = F.p(1, 0, 0), tv = [T[0] - N0[0], 0, T[2] - N0[2]];
    const c = F.p(s, y, 0.05 + arm * 0.5);
    for (const side of [1, -1]) {
      const p = (u, yy) => [c[0] + nv[0] * u * 0.4 + tv[0] * side * 0.03, yy, c[2] + nv[2] * u * 0.4 + tv[2] * side * 0.03];
      const A = side > 0 ? [p(-1, y), p(1, y), p(1, y + bh), p(-1, y + bh)] : [p(1, y), p(-1, y), p(-1, y + bh), p(1, y + bh)];
      // quad winding such that the face looks away from the board centre line
      M.quad('sign', A[0], A[1], A[2], A[3], 0xffffff, { rect, jit: 0.02 });
    }
  }

  // ---- finding a flat patch --------------------------------------------------------------
  // centre (cx,cz), footprint w x d facing yaw theta (local +z -> (sin, cos)): heights over the footprint
  probe(cx, cz, theta, w, d, margin = 0.6) {
    const c = Math.cos(theta), s = Math.sin(theta);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
      const lx = (i / 4 - 0.5) * (w + margin * 2), lz = (k / 4 - 0.5) * (d + margin * 2);
      const h = this.H(cx + lx * c + lz * s, cz - lx * s + lz * c);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return { lo, hi };
  }

  // best spot beside a dock's shore end: tries both sides and a few distances
  siteBeside(dk, w, d, opt = {}) {
    const theta = Math.atan2(dk.dx, dk.dz);
    let best = null;
    for (const side of opt.sides || [1, -1]) for (let extra = 0; extra < (opt.reach ?? 20); extra += 2.5) {
      const U = 3 + d / 2 + (opt.u ?? 3.2) + extra, V = side * ((opt.v ?? 2.8) + w / 2 + (opt.vExtra || 0));
      const cx = dk.x - dk.dx * U + -dk.dz * V, cz = dk.z - dk.dz * U + dk.dx * V;
      const p = this.probe(cx, cz, theta, w, d);
      if (p.lo < (opt.minLo ?? 0.3)) continue;
      const range = p.hi - p.lo;
      if (opt.ok && !opt.ok({ cx, cz, theta, lo: p.lo, range })) continue;
      const sc = range + extra * 0.04;
      if (!best || sc < best.sc) best = { cx, cz, theta, lo: p.lo, hi: p.hi, range, sc, side, U, V };
    }
    return best;
  }

  buildDockSide() {
    const g = this.g, list = g.docks.list;
    if (!list.length) return;
    const style = STYLES[this.styleName] || STYLES.cracker;
    const parts = new Map();
    const add = (M, site, y0) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(site.cx, y0, site.cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.theta), new THREE.Vector3(1, 1, 1));
      for (const key of M.b.keys()) {
        const geo = M.build(key);
        if (!geo) continue;
        geo.applyMatrix4(m);
        if (!parts.has(key)) parts.set(key, []);
        parts.get(key).push(geo);
      }
    };
    const text = TEXT[this.loc.id] || TEXT.default;
    list.forEach((dk, i) => {
      const prof = dockProfile(i);
      if (dk.landing) prof.name = `${dk.landing} ${prof.name}`;   // real landings: Clewiston Marina, Pahokee Bait shop
      dk.profile = prof;
      const role = i === 0 ? 'marina' : i === 1 ? 'bait' : 'buyer';
      const rand = rng(this.loc.id.length * 131 + i * 977 + 5);
      const spec = this.dockSpec(role, style, rand);
      let site = null;
      // a flat patch of dry land beside the walkway; on cramped islands settle for a smaller shack
      for (const [k, minLo, reach] of [[1, 0.3, 20], [0.82, 0.15, 32], [0.9, -3.2, 44]]) {
        spec.w = Math.round(spec.w * k * 10) / 10; spec.d = Math.round(spec.d * k * 10) / 10;
        site = this.siteBeside(dk, spec.w, spec.d + (spec.porch ? 1.8 : 0), { u: 2.6, v: 2.4, minLo, reach });
        if (site) break;
      }
      if (!site) { console.warn('[buildings] no site for dock', this.loc.id, i); return; }
      const M = new Mesher(rand, this.mats.glowAtlas.white());
      const wet = site.lo < 0.1;   // cramped island: the shop stands on piles over the shallows
      const y0 = wet ? Math.max(site.hi, 0.3) + 1.1 : site.range > 2 ? site.lo + site.range * 0.5 + 0.3 : site.hi + 0.3;   // steep ground: dig the building in rather than stilt it
      const fnd = Math.min(10, y0 - site.lo + (wet ? 0.6 : 0.35));
      if (wet) this.circles.push({ x: site.cx, z: site.cz, r: Math.max(spec.w, spec.d) * 0.55 });
      const o = this.buildShop(M, role, style, spec, rand, fnd, text, dk, site);
      add(M, site, y0);
      // walking footprint (incl. porch) and door
      const cs = Math.cos(site.theta), sn = Math.sin(site.theta);
      const pd = spec.porch ? 1.9 : 0;
      this.rects.push({ x: site.cx + sn * pd / 2, z: site.cz + cs * pd / 2, hw: spec.w / 2 + 0.35, hd: spec.d / 2 + 0.35 + pd / 2, c: cs, s: sn, role, dock: dk });
      const dpos = [site.cx + sn * (spec.d / 2 + pd + 1.0) + cs * (o.doorS || 0), site.cz + cs * (spec.d / 2 + pd + 1.0) - sn * (o.doorS || 0)];
      const kd = spec.d / 2 + (pd ? pd * 0.5 + 0.3 : 0.7);
      this.doors.push({ kx: site.cx + sn * kd + cs * (o.doorS || 0), kz: site.cz + cs * kd - sn * (o.doorS || 0), ky: y0 + 0.05, yaw: Math.atan2(sn, cs), x: dpos[0], z: dpos[1], dock: dk, role, title: role === 'marina' ? 'Marina office' : role === 'bait' ? 'Bait & tackle' : 'Fish market', services: prof.services });
      dk.shop = { x: dpos[0], z: dpos[1], role, title: prof.name };
      // extras: fuel pumps and a boat yard at the marina
      if (role === 'marina') {
        const ex = this.siteBeside(dk, 6, 4.4, { u: 2.2, v: 3 + spec.w / 2 + 3, sides: [-site.side, site.side] });
        if (ex) {
          const M2 = new Mesher(rand, this.mats.glowAtlas.white());
          this.fuelPumps(M2, style, text, rand);
          add(M2, ex, ex.hi + 0.18);
          this.rects.push({ x: ex.cx, z: ex.cz, hw: 3.3, hd: 2.4, c: Math.cos(ex.theta), s: Math.sin(ex.theta), role: 'fuel', dock: dk });
        }
        const yd = this.siteBeside(dk, 9, 7, { u: 9, v: 4 + spec.w / 2, sides: [site.side], vExtra: 6 });
        if (yd) {
          const M3 = new Mesher(rand, this.mats.glowAtlas.white());
          this.boatYard(M3, style, rand, text);
          add(M3, yd, yd.hi + 0.15);
          this.rects.push({ x: yd.cx, z: yd.cz, hw: 4.8, hd: 3.8, c: Math.cos(yd.theta), s: Math.sin(yd.theta), role: 'yard', dock: dk });
        }
        // the trophy hall: an open shed with the mounted fish and the records boards, on the side away from the fuel dock when there is room
        let hs = null;
        const clear = (c) => {   // no other building under the hall's footprint (sampled)
          const cc = Math.cos(c.theta), sn = Math.sin(c.theta);
          for (let i = -2; i <= 2; i++) for (let k = -1; k <= 1; k++) {
            const lx = i * (HALL.w / 2 + 0.8) / 2, lz = k * (HALL.d / 2 + 0.6);
            if (this.blocks(c.cx + lx * cc + lz * sn, c.cz - lx * sn + lz * cc)) return false;
          }
          return true;
        };
        for (const vx of [4, 8, 12, 16, 22, 30]) {
          for (const sd of [-site.side, site.side]) {
            const c = this.siteBeside(dk, HALL.w, HALL.d + 0.8, { u: 2.2, v: 3 + spec.w / 2, sides: [sd], vExtra: vx, reach: 46, ok: (c) => c.lo > 0.2 && c.range < 2.6 && clear(c) });
            if (c) { hs = c; break; }
          }
          if (hs) break;
        }
        if (!hs) console.warn('[buildings] no trophy hall site at', this.loc.id);
        if (hs) {
          const M4 = new Mesher(rand, this.mats.glowAtlas.white());
          hallShell(M4, this, style, rand, this.loc.id);
          const hy = hs.range > 2 ? hs.lo + hs.range * 0.5 + 0.3 : hs.hi + 0.25;
          add(M4, hs, hy);
          const hc = Math.cos(hs.theta), hn = Math.sin(hs.theta);
          // walls block walkers; the front stays open
          this.rects.push({ x: hs.cx - hn * (HALL.d / 2 - 0.1), z: hs.cz - hc * (HALL.d / 2 - 0.1), hw: HALL.w / 2 + 0.3, hd: 0.3, c: hc, s: hn, role: 'hall', dock: dk });
          for (const sx of [-1, 1]) this.rects.push({ x: hs.cx + hc * sx * (HALL.w / 2), z: hs.cz - hn * sx * (HALL.w / 2), hw: 0.25, hd: HALL.d / 2, c: hc, s: hn, role: 'hall', dock: dk });
          this.hall = { cx: hs.cx, cz: hs.cz, y0: hy, theta: hs.theta };
          this.lights.push({ x: hs.cx + hn * 1.6, z: hs.cz + hc * 1.6, y: hy + 2.6 });
        }
      }
      this.lights.push({ x: dpos[0], z: dpos[1], y: y0 + 2.4 });
    });
    for (const [key, geos] of parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), this.mats.get(key));
      mesh.castShadow = key !== 'glass' && key !== 'glow';
      mesh.receiveShadow = key !== 'glow';
      mesh.layers.enable(1);
      mesh.userData.bucket = key;
      this.group.add(mesh);
    }
    for (const arr of parts.values()) arr.forEach((g2) => g2.dispose());
  }

  dockSpec(role, style, rand) {
    const f = style.floors || 1;
    if (role === 'marina') return { w: 12.5, d: 7.5, floors: Math.max(f, this.loc.id === 'chesapeake' || this.loc.id === 'cabo' || this.loc.id === 'keys' ? 2 : 1), porch: style.porch };
    if (role === 'bait') return { w: 7.4, d: 5.4, floors: 1, porch: style.porch ? { ...style.porch, rail: true } : null };
    return { w: 9.4, d: 6.4, floors: 1, porch: null };
  }

  // the shop building itself
  buildShop(M, role, st, spec, rand, found, text, dk, site) {
    const wcol = pick(rand, st.wcols);
    const piles = (st.piles && found < 3.4) || site.lo < 0.1 ? { depth: found + 0.6 } : null;
    const o = house(M, {
      w: spec.w, d: spec.d, floors: spec.floors, fh: 2.8, wall: st.wall, wcol, roof: role === 'buyer' && st.roof === 'gable' && rand() < 0.5 ? 'gable' : st.roof, rtex: st.rtex,
      rcol: pick(rand, st.rcols), trim: st.trim, pitch: st.pitch, over: st.over, found: piles ? 0 : found, ftex: st.ftex || 'stone', fcol: st.fcol ?? 0x9a948a, piles,
      chimney: role !== 'buyer' && st.chimney ? { ...st.chimney, x: -spec.w * 0.3 } : null, shutters: role === 'marina' ? null : st.shutters,
      porch: spec.porch ? { ...spec.porch, w: spec.w * 0.78, s: 0 } : null, lit: 0.62, door: st.door, doorS: role === 'buyer' ? spec.w * 0.22 : 0, attic: st.attic !== false && st.front === 'none',
    });
    const F = faceMap(spec.w, spec.d), hz = spec.d / 2, h = 2.8 * spec.floors;
    const t = text[role], bo = BOARDS[Math.floor(rand() * BOARDS.length)], font = FONTS[Math.floor(rand() * FONTS.length)];
    const mainRect = { text: t[0], sub: t[1], bg: bo.bg, fg: bo.fg, border: bo.border, fg2: bo.fg2, font };
    const pd = spec.porch ? 1.9 : 0;
    // a false front carries the name above the eaves (the old fish-house look); log and stilt buildings hang a board instead
    if (st.front !== 'none') {
      const bw = Math.min(spec.w + 0.1, 7.2), bh = 1.5, yb = h - 0.05;
      const col = st.front === 'step' ? 0xe6dfcc : st.wcols[0];
      M.box(`tex:${st.wall === 'stucco' ? 'stucco' : 'wood'}`, -spec.w / 2 - 0.08, spec.w / 2 + 0.08, yb, yb + 1.7, hz - 0.02, hz + 0.16, st.front === 'step' ? col : new THREE.Color(wcol).multiplyScalar(0.95), { sides: [1, 0, 1, 1, 1, 0] });
      M.box('tex:wood', -spec.w / 2 - 0.12, spec.w / 2 + 0.12, yb + 1.7, yb + 1.82, hz - 0.04, hz + 0.2, st.trim);
      this.board(M, F.front, 0, yb + 0.12, bw, 1.4, mainRect, 0.16);
    } else {
      const bw = Math.min(spec.w * 0.8, 5.2), by = spec.floors === 1 ? 2.34 : 2.3;
      const rect = this.signRect(mainRect);
      // board on posts in front of the building, facing the path
      const Fp = { p: (s, y, off) => F.front.p(s, y, off + pd + 0.5) };
      for (const sx of [-bw / 2 - 0.1, bw / 2 + 0.1]) M.box('tex:wood', sx - 0.07, sx + 0.07, 0, by + 1.6, hz + pd + 0.5, hz + pd + 0.64, 0x4a3a2c, { jit: 0.1 });
      this.board(M, Fp, 0, by, bw, 1.35, mainRect, 0.12);
      void rect;
    }
    // blade sign by the door, and a lit "open" sign in the front window at night
    const bt = { text: t[0].split(' ')[0].slice(0, 9), bg: bo.bg, fg: bo.fg, border: bo.border, font, wear: 1.2 };
    this.blade(M, F.front, -spec.w / 2 + 0.6, 1.5, 1.0, 0.55, bt);
    const nr = this.neonRect({ text: text.open, color: rand() < 0.5 ? '#ff4a3a' : '#42d6ff', font: '"Brush Script MT", "Segoe Script", cursive', size: 78 });
    const ns = spec.w * 0.28 * (rand() < 0.5 ? -1 : 1);
    M.quad('glow', F.front.p(ns - 0.55, 1.15, 0.07), F.front.p(ns + 0.55, 1.15, 0.07), F.front.p(ns + 0.55, 1.55, 0.07), F.front.p(ns - 0.55, 1.55, 0.07), new THREE.Color(1.6, 1.6, 1.6), { rect: nr, jit: 0, uo: 0, vo: 0 });
    // lamp over the door
    const dsx = o.doorS || 0;
    M.box('metal', dsx - 0.07, dsx + 0.07, 2.4, 2.62, hz + pd + 0.02, hz + pd + 0.16, 0x23262a);
    M.box('glow', dsx - 0.05, dsx + 0.05, 2.3, 2.4, hz + pd + 0.04, hz + pd + 0.14, new THREE.Color(1.8, 1.4, 0.9), { jit: 0, sides: [1, 1, 1, 1, 0, 1] });
    this.shopProps(M, role, st, spec, rand, pd, o);
    return o;
  }

  // things that live around a working shop: crates, ice chests, pots, drying racks, a bench
  shopProps(M, role, st, spec, rand, pd, o) {
    const hz = spec.d / 2, hw = spec.w / 2, cs = (this.loc.id === 'chesapeake'), fj = (this.loc.id === 'fjord');
    // ice chest and minnow tank by the door
    M.box('plain', hw * 0.45, hw * 0.45 + 1.1, 0.15, 0.95, hz + pd + 0.1, hz + pd + 0.6, 0xd2d6d8, { jit: 0.04 });
    M.box('plain', hw * 0.45 - 0.02, hw * 0.45 + 1.12, 0.95, 1.02, hz + pd + 0.08, hz + pd + 0.62, 0x2a5c8a);
    // crates, barrels
    for (let i = 0; i < 4; i++) crate(M, -hw + 0.8 + i * 0.7, 0, hz + pd + 0.7 + (i % 2) * 0.1, 0.55, [0x6a5238, 0x7a6244, 0x5a4a32][i % 3], (rand() - 0.5) * 0.4);
    crate(M, -hw + 1.15, 0.275, hz + pd + 0.72, 0.5, 0x7a6244, 0.1);
    barrel(M, hw + 0.8, 0, hz * 0.2, 0.3, 0.9, [0x2f5a8a, 0x8a2a24, 0x3a6a3a][Math.floor(rand() * 3)]);
    barrel(M, hw + 0.8, 0, hz * 0.2 + 0.75, 0.3, 0.9, 0x6a6e72);
    // bench by the wall
    M.box('tex:wood', -hw + 0.4, -hw + 2.0, 0.42, 0.48, hz + pd + 0.35, hz + pd + 0.7, 0x7a6a56);
    for (const sx of [-hw + 0.5, -hw + 1.9]) M.box('tex:wood', sx - 0.04, sx + 0.04, 0, 0.42, hz + pd + 0.4, hz + pd + 0.65, 0x5a4a38);
    // stacked pots / nets / drying racks by style
    if (cs) { for (let i = 0; i < 6; i++) pot(M, hw + 1.9 + (i % 3) * 0.95, Math.floor(i / 3) * 0.32, 0.6 + (i % 2) * 0.1, 0.9, 0x6a7468, (rand() - 0.5) * 0.4); }
    if (fj) {
      // a hjell: cod hung to dry on an A-frame beside the shop
      for (let k = 0; k < 3; k++) {
        const x = hw + 2.2 + k * 2.4, z = -hz * 0.3;
        M.beam('tex:wood', [x, 0, z - 0.8], [x, 3.0, z - 0.1], 0.1, 0x6a5a48); M.beam('tex:wood', [x, 0, z + 0.8], [x, 3.0, z + 0.1], 0.1, 0x6a5a48);
      }
      for (const yy of [2.2, 2.65, 3.0]) M.beam('tex:wood', [hw + 2.2, yy, -hz * 0.3], [hw + 2.2 + 4.8, yy, -hz * 0.3], 0.07, 0x5a4a38);
      for (let k = 0; k < 24; k++) { const x = hw + 2.45 + (k % 12) * 0.38, yy = k < 12 ? 2.1 : 2.55; M.box('plain', x - 0.09, x + 0.09, yy - 0.5, yy, -hz * 0.3 - 0.05, -hz * 0.3 + 0.05, 0xd9cdb0, { jit: 0.2 }); }
    }
    if (role === 'buyer') {
      // fish totes stacked at the loading bay, hoist beam over the door
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) M.box('plain', -hw + 0.4 + c * 0.62, -hw + 0.98 + c * 0.62, r * 0.32, r * 0.32 + 0.3, hz + 0.45, hz + 1.0, [0x2f6a8a, 0xc8c8c0, 0x2f6a8a][(r + c) % 3], { jit: 0.1 });
      M.beam('tex:wood', [hw * 0.45, 3.4, hz - 0.1], [hw * 0.45, 3.4, hz + 1.9], 0.14, 0x4a3a2c);
      M.beam('metal', [hw * 0.45, 3.4, hz + 1.75], [hw * 0.45, 2.5, hz + 1.75], 0.02, 0x2a2a2a);
    }
  }

  fuelPumps(M, st, text, rand) {
    const w = 6, d = 3.6, y = 3.2;
    M.box('tex:conc', -w / 2, w / 2, -0.4, 0.15, -d / 2, d / 2, 0x8a8a86, { sides: [1, 1, 1, 1, 1, 0] });
    for (const sx of [-w / 2 + 0.3, w / 2 - 0.3]) for (const sz of [-d / 2 + 0.3, d / 2 - 0.3]) M.prism('metal', sx, sz, 0.15, y, 0.1, 0.1, 6, 0xe4e0d4, false);
    M.box('tex:tin', -w / 2 - 0.2, w / 2 + 0.2, y, y + 0.22, -d / 2 - 0.2, d / 2 + 0.2, 0xe8e6e0);
    M.box('plain', -w / 2 - 0.22, w / 2 + 0.22, y + 0.02, y + 0.2, d / 2 + 0.18, d / 2 + 0.22, 0xc02a22);
    const rect = this.signRect({ text: text.fuel, bg: '#c02a22', fg: '#fff', border: '#fff', font: FONTS[0], wear: 0.5 });
    M.quad('sign', [-1.5, y + 0.02, d / 2 + 0.23], [1.5, y + 0.02, d / 2 + 0.23], [1.5, y + 0.2, d / 2 + 0.23], [-1.5, y + 0.2, d / 2 + 0.23], 0xffffff, { rect, jit: 0 });
    for (const sx of [-1.2, 1.2]) {
      M.box('plain', sx - 0.28, sx + 0.28, 0.15, 1.5, -0.25, 0.25, 0xe8e4d8, { jit: 0.04 });
      M.box('plain', sx - 0.22, sx + 0.22, 1.05, 1.35, 0.255, 0.27, 0x20262a);
      M.box('glow', sx - 0.16, sx + 0.16, 1.1, 1.3, 0.272, 0.28, new THREE.Color(0.9, 1.5, 0.9), { jit: 0, sides: [1, 0, 0, 0, 0, 0] });
      M.box('plain', sx - 0.3, sx + 0.3, 1.5, 1.62, -0.27, 0.27, [0xc02a22, 0x2a6a3a][sx > 0 ? 1 : 0]);
      M.beam('plain', [sx + 0.28, 1.0, 0.1], [sx + 0.48, 0.6, 0.35], 0.04, 0x1a1a1a);
    }
  }

  // dry-stack boats on cradles under a lean-to: the dealer's yard
  boatYard(M, st, rand, text) {
    const w = 9, d = 7;
    M.box('tex:conc', -w / 2, w / 2, -0.4, 0.08, -d / 2, d / 2, 0x8c8a84, { sides: [0, 0, 0, 0, 1, 0] });
    // open shed along the back
    const rc = pick(rand, st.rcols);
    for (const sx of [-w / 2 + 0.2, 0, w / 2 - 0.2]) M.prism('tex:wood', sx, -d / 2 + 0.3, 0, 3.4, 0.1, 0.1, 6, 0x5a4a38, false);
    M.quad(`tex:${st.rtex === 'thatch' ? 'tin' : st.rtex}`, [-w / 2 - 0.3, 3.1, -d / 2 - 0.5], [w / 2 + 0.3, 3.1, -d / 2 - 0.5], [w / 2 + 0.3, 3.7, -d / 2 + 2.6], [-w / 2 - 0.3, 3.7, -d / 2 + 2.6], rc, { jit: 0.04 });
    const hulls = [[-2.4, 0.6, 5.4, 0xe4e4dc, 0.2], [1.8, -0.4, 4.6, 0x9ab4c4, -0.35], [3.6, 1.8, 3.4, 0xc8a24a, 0.7]];
    for (const [x, z, len, col, yaw] of hulls) this.hull(M, x, z, len, col, yaw);
    const rect = { text: text.marina[0].split(' ')[0] === 'MARINA' ? 'BOAT SALES' : 'BOATS', sub: 'New · Used · Service', bg: '#16365a', fg: '#f4efe0', border: '#e8d9a8', font: FONTS[2] };
    this.board(M, { p: (s, y, off) => [s, y, -d / 2 + 0.3 + off] }, 0, 1.2, 3.6, 1.05, rect, 0.05);
  }

  // a planing hull on a trailer: sheered topsides, a cuddy or console, on stands
  hull(M, x, z, len, col, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), beam = len * 0.36, y = 0.5;
    const P = (a, b, yy) => [x + a * c - b * s, yy, z + a * s + b * c];
    const st = [[-0.5, 0.78, 0.0], [-0.25, 1.0, 0.0], [0.05, 1.0, 0.04], [0.35, 0.88, 0.14], [0.5, 0.0, 0.5]];
    const sec = st.map(([t, bw, rise]) => ({ a: t * len, hw: bw * beam / 2, keel: y + 0.1 + rise * len * 0.1, top: y + 0.78 + rise * 0.0 + (t > 0.2 ? (t - 0.2) * 1.0 : 0) }));
    for (let i = 0; i < sec.length - 1; i++) {
      const A = sec[i], B = sec[i + 1];
      for (const sd of [-1, 1]) {
        const q = [P(A.a, sd * A.hw, A.top), P(B.a, sd * B.hw, B.top), P(B.a, sd * B.hw * 0.5, B.keel), P(A.a, sd * A.hw * 0.5, A.keel)];
        if (sd > 0) M.quad('plain', q[3], q[2], q[1], q[0], col, { jit: 0.02 }); else M.quad('plain', q[0], q[1], q[2], q[3], col, { jit: 0.02 });
        M.quad('plain', P(A.a, sd * A.hw, A.top), P(B.a, sd * B.hw, B.top), P(B.a, sd * (B.hw - 0.05), B.top - 0.02), P(A.a, sd * (A.hw - 0.05), A.top - 0.02), 0xf2f0e8);
      }
      M.quad('plain', P(A.a, -A.hw * 0.5, A.keel), P(B.a, -B.hw * 0.5, B.keel), P(B.a, B.hw * 0.5, B.keel), P(A.a, A.hw * 0.5, A.keel), 0x2a3a4a);
      M.quad('plain', P(A.a, A.hw, A.top), P(B.a, B.hw, B.top), P(B.a, -B.hw, B.top), P(A.a, -A.hw, A.top), 0xd8d4c8, { jit: 0.03 });
    }
    M.quad('plain', P(sec[0].a, -sec[0].hw, sec[0].top), P(sec[0].a, sec[0].hw, sec[0].top), P(sec[0].a, sec[0].hw * 0.5, sec[0].keel), P(sec[0].a, -sec[0].hw * 0.5, sec[0].keel), col);
    const wsA = P(len * 0.05, -beam * 0.4, y + 0.78), wsB = P(len * 0.05, beam * 0.4, y + 0.78);
    M.quad('glass', wsA, wsB, [wsB[0], y + 1.35, wsB[2]], [wsA[0], y + 1.35, wsA[2]], 0x20303a, { jit: 0.1 });
    // trailer: axle, wheels and bunks
    for (const sd of [-1, 1]) { const w0 = P(-len * 0.1, sd * (beam * 0.5 + 0.2), 0.3); M.box('plain', w0[0] - 0.3, w0[0] + 0.3, 0, 0.62, w0[2] - 0.3, w0[2] + 0.3, 0x1c1c1e, { jit: 0.02 }); }
    M.beam('metal', P(-len * 0.1, -beam * 0.55, 0.3), P(-len * 0.1, beam * 0.55, 0.3), 0.06, 0x3a3e42);
    M.beam('metal', P(-len * 0.45, 0, 0.3), P(len * 0.62, 0, 0.35), 0.07, 0x3a3e42);
  }

  // ---- queries --------------------------------------------------------------------------
  blocks(x, z) {
    for (const r of this.rects) {
      const dx = x - r.x, dz = z - r.z, lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
      if (Math.abs(lx) < r.hw && Math.abs(lz) < r.hd) return true;
    }
    return false;
  }

  // the shop door within `reach` metres of a point (on foot), or null
  doorNear(x, z, reach = 5.5) {
    let best = null, bd = reach;
    for (const d of this.doors) { const k = Math.hypot(d.x - x, d.z - z); if (k < bd) { bd = k; best = d; } }
    return best;
  }

  colliders() { return this.circles.concat(this.scatter ? this.scatter.circles : []); }

  update(dt, night, pos) {
    this.night = night;
    this.mats.glow.color.setScalar(night > 0.03 ? Math.min(2.4, night * 2.6) : 0);
    this.mats.glow.visible = night > 0.03;
    let best = null, bd = Infinity;
    for (const l of this.lights) { const k = Math.hypot(l.x - pos.x, l.z - pos.z); if (k < bd) { bd = k; best = l; } }
    if (best) { this.light.position.set(best.x, best.y, best.z); this.light.intensity = night * (bd < 70 ? 260 : 0); }
    if (this.scatter) this.scatter.update(dt, night, pos);
  }
}

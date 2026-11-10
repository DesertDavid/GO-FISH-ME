import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES_BY_ID, MORPH_BY_ID } from './species.js';
import { LOCATIONS, LOCATION_ORDER } from './locations.js';
import { RODS, LURES } from './gear.js';
import { buildFish, fishLengthM } from './fishMesh.js';
import { CAPACITY, bestPerSpecies, bestPerWater, medalCounts, PLACE, HALL_SIGN } from './trophyData.js';
import * as U from './units.js';
import { FONTS } from './bldStyles.js';

// The trophy hall: an open-fronted shed beside the Marina office (built into the buildings' merged
// meshes by `hallShell`), with a plank wall of mounted fish and two instrument-style records boards.
// The shell is static and merged with the rest of the dock side; the contents (boards, the real fish
// models, plaques) are only built while you are within LOAD_R metres and dropped again beyond DROP_R.
export const HALL = { w: 10.4, d: 5.4, wallH: 3.5, frontH: 3.1 };
const LOAD_R = 90, DROP_R = 140;
const WALL_Z = -HALL.d / 2 + 0.2;            // face of the back wall (local, +z faces the walkway)
const SLOT_X = (i) => (i - 2.5) * 1.62;      // six across
const ROWS = [{ board: 2.5, plate: 1.93 }, { board: 1.42, plate: 0.85 }];

// ---- static shell, built with the dock-side Mesher ---------------------------------------------
export function hallShell(M, bld, st, rand, id) {
  const { w, d, wallH, frontH } = HALL, hx = w / 2, hz = d / 2;
  const wood = 0x5b4332, dark = 0x3b2c20, floor = 0x6a5238;
  M.box('tex:conc', -hx - 0.1, hx + 0.1, -0.6, 0.06, -hz - 0.1, hz + 0.5, 0x8a8782, { sides: [1, 1, 1, 1, 0, 0] });
  M.box('tex:wood', -hx, hx, 0.05, 0.14, -hz, hz + 0.4, floor, { jit: 0.1, sides: [0, 0, 0, 0, 1, 0] });
  // back wall (varnished boards) and two side walls (trapezoids, taller at the back)
  M.box('tex:wood', -hx, hx, 0.14, wallH + 0.1, -hz, -hz + 0.2, wood, { jit: 0.05 });
  for (const sx of [-1, 1]) {
    const xo = sx * (hx + 0.03), xi = sx * (hx - 0.03);   // outside and inside skins, apart so they cannot z-fight
    const quad = (x, col, flip) => {
      const A = [x, 0.14, -hz], B = [x, 0.14, hz], C = [x, frontH, hz], D = [x, wallH + 0.1, -hz];
      if (flip) M.quad('tex:wood', B, A, D, C, col, { jit: 0.06 }); else M.quad('tex:wood', A, B, C, D, col, { jit: 0.06 });
    };
    quad(xo, st.wcols ? st.wcols[0] : 0x8a7a64, sx > 0);
    quad(xi, dark, sx < 0);
  }
  // sloping roof with a deep front overhang, a fascia and corner posts
  const rtex = st.rtex === 'thatch' ? 'tin' : st.rtex || 'tin', rc = (st.rcols && st.rcols[0]) || 0x6a6e72;
  const ov = 0.55;
  M.quad(`tex:${rtex}`, [-hx - 0.3, wallH + 0.1, -hz - 0.2], [-hx - 0.3, frontH - 0.1, hz + ov], [hx + 0.3, frontH - 0.1, hz + ov], [hx + 0.3, wallH + 0.1, -hz - 0.2], rc, { jit: 0.04 });
  M.quad('tex:wood', [-hx - 0.3, wallH + 0.1, -hz - 0.2], [hx + 0.3, wallH + 0.1, -hz - 0.2], [hx + 0.3, frontH - 0.1, hz + ov], [-hx - 0.3, frontH - 0.1, hz + ov], dark, { jit: 0.04 });
  M.box('tex:wood', -hx - 0.3, hx + 0.3, frontH - 0.3, frontH - 0.1, hz + ov - 0.12, hz + ov, st.trim ?? 0xe8e4da);
  for (const sx of [-hx + 0.15, hx - 0.15]) M.prism('tex:wood', sx, hz + 0.3, 0.14, frontH - 0.1, 0.1, 0.1, 6, dark, false);
  M.beam('tex:wood', [-hx + 0.15, frontH - 0.4, hz + 0.3], [hx - 0.15, frontH - 0.4, hz + 0.3], 0.14, dark);
  // picture rail and a skirting board along the back wall
  M.box('tex:wood', -hx + 0.02, hx - 0.02, 3.05, 3.12, WALL_Z, WALL_Z + 0.05, 0x2a2018);
  M.box('tex:wood', -hx + 0.02, hx - 0.02, 0.14, 0.3, WALL_Z, WALL_Z + 0.05, 0x2a2018);
  // name board across the header
  const text = HALL_SIGN[id] || HALL_SIGN.default;
  const bo = { bg: '#1d2a22', fg: '#e8dcb4', border: '#b88a3a', fg2: '#cdbf90' };
  const F = { p: (s, y, off) => [s, y, hz + 0.3 + off] };
  bld.board(M, F, 0, frontH - 0.98, 4.2, 0.52, { text: text[0], sub: text[1], ...bo, font: FONTS[0] }, 0.1);
  // two warm lamps over the wall (glow material = lit at night), brass arms
  for (const sx of [-2.7, 2.7]) {
    M.box('metal', sx - 0.05, sx + 0.05, 3.0, 3.06, WALL_Z, WALL_Z + 0.5, 0x3a3226);
    M.box('glow', sx - 0.22, sx + 0.22, 2.94, 3.0, WALL_Z + 0.2, WALL_Z + 0.62, new THREE.Color(1.8, 1.4, 0.85), { jit: 0, sides: [1, 1, 1, 1, 0, 1] });
  }
  // a plain bench under the records boards would block the walkers' view: leave the floor clear
}

// ---- canvas helpers ----------------------------------------------------------------------------
const MONO = '"B612 Mono", ui-monospace, Consolas, monospace', SANS = '"B612", "Segoe UI", sans-serif';
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, aniso = 8) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }

function fit(g, text, max) { while (g.measureText(text).width > max && text.length > 4) text = text.slice(0, -2); return text; }

// engraved brass plate
function plaqueTexture(e) {
  const c = canvas(512, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 256);
  gr.addColorStop(0, '#c49a4e'); gr.addColorStop(0.5, '#a97f36'); gr.addColorStop(1, '#8a6626');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,235,180' : '60,40,10'},${Math.random() * 0.07})`; g.fillRect(Math.random() * 512, Math.random() * 256, 30 + Math.random() * 70, 1); }
  g.strokeStyle = 'rgba(50,32,8,0.7)'; g.lineWidth = 3; g.strokeRect(10, 10, 492, 236);
  g.strokeStyle = 'rgba(255,230,170,0.35)'; g.lineWidth = 1; g.strokeRect(14, 14, 484, 228);
  const sp = SPECIES_BY_ID[e.sp], m = MORPH_BY_ID[e.morph];
  const loc = e.loc && LOCATIONS[e.loc] ? LOCATIONS[e.loc].name : 'Unrecorded water';
  const rod = e.rod && RODS[e.rod] ? RODS[e.rod].name : '', lure = e.lure && LURES[e.lure] ? LURES[e.lure].name : '';
  const tag = e.tour ? `${e.tour}${e.place ? ', ' + PLACE[e.place - 1] : ''}` : (e.tags && e.tags[0]) || '';
  g.textAlign = 'center'; g.fillStyle = '#2c1c06';
  g.font = `600 17px ${MONO}`; g.fillText(fit(g, tag.toUpperCase(), 450), 256, 38);
  g.font = `700 34px ${SANS}`; g.fillText(fit(g, ((m && m.id !== 'normal' ? m.name + ' ' : '') + sp.name).toUpperCase(), 450), 256, 82);
  g.font = `600 28px ${MONO}`; g.fillText(`${U.force(e.lb, 1)}  ·  ${U.length(e.inches)}`, 256, 124);
  g.font = `500 21px ${SANS}`; g.fillText(fit(g, `${loc}  ·  Day ${e.day}`, 450), 256, 164);
  g.font = `500 19px ${SANS}`; g.fillText(fit(g, [rod, lure].filter(Boolean).join('  /  '), 450), 256, 204);
  return tex(c);
}

// records boards: dark slate, hairline frame, amber headings, mono numbers
function boardBase(title, sub, W = 640, H = 440) {
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#12181c'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#46555e'; g.lineWidth = 2; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = '#d8a54a'; g.font = `600 24px ${SANS}`; g.textAlign = 'left'; g.fillText(title.toUpperCase(), 28, 48);
  g.fillStyle = '#7d8c94'; g.font = `500 17px ${MONO}`; g.textAlign = 'right'; g.fillText(sub, W - 28, 48);
  g.strokeStyle = '#2d3a42'; g.beginPath(); g.moveTo(28, 64); g.lineTo(W - 28, 64); g.stroke();
  return { c, g, W, H };
}

function rowsBoard(title, sub, rows, empty) {
  const { c, g, W } = boardBase(title, sub);
  if (!rows.length) { g.fillStyle = '#7d8c94'; g.font = `500 20px ${SANS}`; g.textAlign = 'left'; g.fillText(empty, 28, 110); return tex(c); }
  rows.slice(0, 9).forEach((r, i) => {
    const y = 98 + i * 36;
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)'; g.fillRect(20, y - 24, W - 40, 34);
    g.textAlign = 'left'; g.fillStyle = '#d6dde0'; g.font = `500 21px ${SANS}`; g.fillText(fit(g, r[0], 270), 30, y);
    g.fillStyle = '#7d8c94'; g.font = `500 16px ${MONO}`; g.fillText(fit(g, r[1] || '', 150), 316, y);
    g.textAlign = 'right'; g.fillStyle = '#e8c070'; g.font = `600 21px ${MONO}`; g.fillText(r[2] || '', W - 30, y);
  });
  return tex(c);
}

function medalBoard(save) {
  const { c, g, W, H } = boardBase('Medals & badges', 'tournaments · daily board');
  const m = medalCounts(save), cols = ['#d8b04a', '#b9c2c8', '#b0723a'], names = ['1st', '2nd', '3rd'];
  m.forEach((n, i) => {
    const x = 100 + i * 150;
    g.fillStyle = cols[i]; g.beginPath(); g.arc(x, 150, 38, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x, 150, 28, 0, 7); g.stroke();
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.font = `700 30px ${MONO}`; g.fillText(String(n), x, 161);
    g.fillStyle = '#9aa8b0'; g.font = `500 16px ${MONO}`; g.fillText(names[i], x, 210);
  });
  const badges = save.badges || [];
  g.textAlign = 'left'; g.fillStyle = '#d8a54a'; g.font = `600 18px ${SANS}`; g.fillText(`DAILY BOARD  ${badges.length} DONE`, 28, 258);
  g.fillStyle = '#c7d0d4'; g.font = `500 17px ${SANS}`;
  badges.slice(-5).reverse().forEach((b, i) => { g.fillText(fit(g, `${b.text}`, 480), 28, 290 + i * 28); g.fillStyle = '#7d8c94'; g.textAlign = 'right'; g.font = `500 15px ${MONO}`; g.fillText(`d${b.day}`, W - 28, 290 + i * 28); g.textAlign = 'left'; g.fillStyle = '#c7d0d4'; g.font = `500 17px ${SANS}`; });
  if (!badges.length) { g.fillStyle = '#7d8c94'; g.fillText('No daily jobs finished yet.', 28, 290); }
  void H;
  return tex(c);
}

function tallyBoard(save) {
  const { c, g, W } = boardBase('Wall & log', 'count');
  const mounts = (save.mounts || []).length, sp = Object.keys(save.journal || {}).length;
  const lines = [['On the wall', `${mounts} / ${CAPACITY}`], ['Waiting to mount', String((save.cands || []).length)], ['Species logged', String(sp)], ['Waters with a best', String(Object.keys(save.locBest || {}).length)], ['Fish landed', String(save.stats?.caught ?? 0)], ['Heaviest', save.stats?.heaviest ? `${SPECIES_BY_ID[save.stats.heaviest.sp]?.name || ''} ${U.force(save.stats.heaviest.lb, 1)}` : '-']];
  lines.forEach(([a, b], i) => {
    const y = 108 + i * 52;
    g.textAlign = 'left'; g.fillStyle = '#9aa8b0'; g.font = `500 20px ${SANS}`; g.fillText(a, 30, y);
    g.textAlign = 'right'; g.fillStyle = '#e8c070'; g.font = `600 26px ${MONO}`; g.fillText(fit(g, b, 300), W - 30, y);
    g.strokeStyle = '#26323a'; g.beginPath(); g.moveTo(28, y + 16); g.lineTo(W - 28, y + 16); g.stroke();
  });
  return tex(c);
}

// ---- the dynamic contents --------------------------------------------------------------------------
export class TrophyHall {
  constructor(g, site) {
    this.g = g;
    this.site = site;               // { cx, cz, y0, theta }
    this.group = null;
    this.key = '';
    this.t = 0;
    this.near = false;
    this.fishCount = 0;
  }

  // world position of the hall's local point
  world(x, z) { const c = Math.cos(this.site.theta), s = Math.sin(this.site.theta); return { x: this.site.cx + x * c + z * s, z: this.site.cz - x * s + z * c }; }
  dist(p) { return Math.hypot(p.x - this.site.cx, p.z - this.site.cz); }
  // inside (or at the front of) the hall, for the key prompt
  inside(p) {
    const c = Math.cos(this.site.theta), s = Math.sin(this.site.theta), dx = p.x - this.site.cx, dz = p.z - this.site.cz;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) < HALL.w / 2 + 2.2 && lz > -HALL.d / 2 - 0.5 && lz < HALL.d / 2 + 3.5;
  }

  stateKey() {
    const s = this.g.save, u = U.units();
    let n = 0; for (const t of Object.values(s.locBest || {})) n += Object.keys(t).length;
    return [(s.mounts || []).map((m) => m.id).join(','), n, (s.badges || []).length, (s.trophies || []).length, (s.cands || []).length, s.stats?.caught, u.dist, u.weight].join('|');
  }

  update(dt, pos) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const d = this.dist(pos);
    if (!this.group && d < LOAD_R) this.build();
    else if (this.group && d > DROP_R) this.dispose();
    else if (this.group && this.key !== this.stateKey()) { this.dispose(); this.build(); }
  }

  build() {
    const g = this.g, save = g.save, key = this.stateKey();
    this.key = key;
    const grp = new THREE.Group();
    grp.name = 'trophyHall';
    grp.position.set(this.site.cx, this.site.y0, this.site.cz);
    grp.rotation.y = this.site.theta;
    this.group = grp;
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.75 });
    const boardGeos = [];
    const mats = [woodMat];
    const textures = [];
    const slots = save.mounts || [];
    this.fishCount = slots.length;
    slots.forEach((e, i) => {
      const row = Math.floor(i / 6), col = i % 6, R = ROWS[row] || ROWS[1];
      const x = SLOT_X(col), sp = SPECIES_BY_ID[e.sp], morph = MORPH_BY_ID[e.morph] || MORPH_BY_ID.normal;
      const tilt = (((i * 7919) % 13) / 13 - 0.5) * 0.1;
      // board: a rounded plank, slightly proud of the wall
      const bw = 1.5, bh = 0.7, sh = new THREE.Shape();
      const r = 0.12, x0 = -bw / 2, y0 = -bh / 2;
      sh.moveTo(x0 + r, y0); sh.lineTo(-x0 - r, y0); sh.quadraticCurveTo(-x0, y0, -x0, y0 + r); sh.lineTo(-x0, -y0 - r); sh.quadraticCurveTo(-x0, -y0, -x0 - r, -y0); sh.lineTo(x0 + r, -y0); sh.quadraticCurveTo(x0, -y0, x0, -y0 - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
      const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
      bg.rotateZ(tilt);
      bg.translate(x, R.board, WALL_Z + 0.02);
      boardGeos.push(bg);
      // the fish: real model (or the procedural body), flat on the board, swim wave off
      const { m } = fishLengthM(sp, e.lb);
      const len = Math.min(1.12, Math.max(0.36, m));
      const f = buildFish(sp, morph, { patchProp: g.patchProp });
      f.uniforms.uSwim.value.set(0, 0, 0);
      f.group.scale.set(len, len, len * 0.8);
      f.group.position.set(x, R.board + 0.01, WALL_Z + 0.02 + 0.06 + len * 0.05);
      f.group.rotation.z = tilt + (len > 1.0 ? 0.04 : 0);
      grp.add(f.group);
      f.group.userData.trophy = e.id;
      // plaque
      const pt = plaqueTexture(e); textures.push(pt);
      const pm = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.38, metalness: 0.7, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: 0.22 });
      mats.push(pm);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), pm);
      pl.position.set(x, R.plate, WALL_Z + 0.04);
      grp.add(pl);
    });
    if (boardGeos.length) {
      const merged = mergeGeometries(boardGeos);
      boardGeos.forEach((b) => b.dispose());
      const bm = new THREE.Mesh(merged, woodMat);
      bm.castShadow = true;
      grp.add(bm);
    }
    // an empty wall shows its screw holes: small brass plates mark free slots
    // records boards on the side walls (left: bests, right: medals + tally)
    const bests = bestPerSpecies(save).slice(0, 9).map((r) => [SPECIES_BY_ID[r.sp].name, r.loc ? LOCATIONS[r.loc].name : 'before logging', U.force(r.lb, 1)]);
    const water = bestPerWater(save).slice(0, 9).map((r) => [LOCATIONS[r.loc].name, SPECIES_BY_ID[r.sp].name, U.force(r.lb, 1)]);
    const panels = [
      { t: rowsBoard('Personal bests', 'by species, % of record', bests, 'No fish logged yet.'), side: -1, z: -0.9 },
      { t: rowsBoard('Best by water', 'heaviest fish in each', water, 'No water has a best yet.'), side: -1, z: 1.45 },
      { t: medalBoard(save), side: 1, z: -0.9 },
      { t: tallyBoard(save), side: 1, z: 1.45 },
    ];
    for (const p of panels) {
      textures.push(p.t);
      const mat = new THREE.MeshStandardMaterial({ map: p.t, roughness: 0.95, metalness: 0, emissive: 0xffffff, emissiveMap: p.t, emissiveIntensity: 0.8 });
      mats.push(mat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.375), mat);
      mesh.position.set(p.side * (HALL.w / 2 - 0.12), 1.75, p.z);
      mesh.rotation.y = p.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      grp.add(mesh);
      // frame
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 2.12), new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 0.7 }));
      fr.position.set(p.side * (HALL.w / 2 - 0.085), 1.75, p.z);
      mats.push(fr.material);
      grp.add(fr);
    }
    grp.userData = { textures, mats };
    this.g.buildings.group.add(grp);
    grp.updateMatrixWorld(true);
  }

  dispose() {
    const grp = this.group;
    if (!grp) return;
    this.group = null;
    grp.parent && grp.parent.remove(grp);
    grp.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of grp.userData.mats || []) m.dispose();
    for (const t of grp.userData.textures || []) t.dispose();
    // fish materials are per-instance clones for hero models; procedural ones are cached textures: leave those
    grp.traverse((o) => { if (o.isMesh && o.material && !(grp.userData.mats || []).includes(o.material) && o.material.dispose) o.material.dispose(); });
  }
}

export { LOCATION_ORDER };

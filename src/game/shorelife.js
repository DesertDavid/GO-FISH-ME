import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PlayerBoat, deckHeight } from './boats.js';

// Life on the shore: NPC anglers on docks, banks and anchored boats (low-poly, procedural, a
// rod and a real line to a bobber in the water, with casting / reeling / sipping / waving
// idles), boats tied up along the docks, boats at anchor, and a few visible schools of small
// fish in clear shallow water. Everything is placed from the real dock + terrain data, and is
// distance-culled so the cost stays tiny. Birds live in birds.js.

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

const _c = new THREE.Color();
// flat vertex colour, de-indexed and stripped to position/normal/colour so parts merge
export function paint(geo, hex, k = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  _c.set(hex);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r * k; a[i * 3 + 1] = _c.g * k; a[i * 3 + 2] = _c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _A = new THREE.Vector3(), _B = new THREE.Vector3();
export function limb(a, b, r0, r1, hex, seg = 7) {
  _A.set(...a); _B.set(...b);
  const len = _A.distanceTo(_B);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  _q.setFromUnitVectors(_up, _B.clone().sub(_A).normalize());
  g.applyQuaternion(_q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return paint(g, hex);
}

// ---- look: who is fishing where ---------------------------------------------------------
const SKIN = [0xe2b896, 0xc89270, 0x9a6a4c, 0x6e4a36, 0xf0d2b6];
const BOTTOMS = [0x3a4a62, 0x6a5c44, 0x2e3236, 0x7c7a62, 0x4a5240];
const TOPS = [0x7a8a62, 0xb4583c, 0x3e5a7a, 0xd6d0be, 0x6a6c70, 0xa89040, 0x4a6a5a, 0xc67a3a, 0x8a3a3a];
const PARKAS = [0xc4532a, 0x2e4a6a, 0x55604a, 0xc2a02c, 0x6a3a3a, 0x444a52];
const COLD = new Set(['fjord', 'bering', 'woods', 'tahoe', 'bigbear', 'columbia']);
const HOT = new Set(['keys', 'amazon', 'mekong', 'kariba', 'okeechobee', 'reef', 'cabo', 'gulf']);
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

function buildAngler(loc, rand, sit) {
  const cold = COLD.has(loc.id), hot = HOT.has(loc.id);
  const skin = pick(rand, SKIN), bottom = pick(rand, BOTTOMS);
  const top = cold ? pick(rand, PARKAS) : pick(rand, TOPS);
  const shorts = hot && rand() < 0.6, shortSleeve = !cold && (hot || rand() < 0.4);
  const hatKind = cold ? (rand() < 0.75 ? 'beanie' : 'cap') : pick(rand, hot ? ['straw', 'boonie', 'cap', 'cap', 'none'] : ['cap', 'cap', 'boonie', 'none']);
  const hatCol = pick(rand, [0x2e3a4a, 0x7a2a2a, 0xd6d0be, 0x4a5a3a, 0xc8a040, 0x222428, 0x8a5a2a]);
  const hipY = sit ? 0.5 : 0.88;
  const legs = [];
  for (const s of [-1, 1]) {
    const x = s * 0.1;
    if (sit) {
      legs.push(limb([x, hipY, 0], [x, hipY - 0.02, 0.42], 0.085, 0.07, bottom));
      legs.push(limb([x, hipY - 0.02, 0.42], [x, 0.09, 0.5], 0.07, shorts ? 0.05 : 0.055, shorts ? skin : bottom));
      legs.push(paint(new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(x, 0.04, 0.57), 0x2a2a2c));
    } else {
      legs.push(limb([x, hipY, 0], [x, 0.5, 0.02], 0.085, 0.07, bottom));
      legs.push(limb([x, 0.5, 0.02], [x, 0.1, 0], 0.07, 0.055, shorts ? skin : bottom));
      legs.push(paint(new THREE.BoxGeometry(0.1, 0.07, 0.25).translate(x, 0.04, 0.07), 0x2a2a2c));
    }
  }
  const tw = cold ? 1.18 : 1;
  const torso = paint(new THREE.CylinderGeometry(0.19 * tw, 0.175 * tw, 0.6, 8).scale(1, 1, 0.68).translate(0, hipY + 0.3, 0), top);
  const belt = paint(new THREE.CylinderGeometry(0.18 * tw, 0.18 * tw, 0.05, 8).scale(1, 1, 0.7).translate(0, hipY + 0.02, 0), 0x3a3026);
  // some wear a lighter vest / apron panel
  const parts = [...legs, torso, belt];
  if (!cold && rand() < 0.35) parts.push(paint(new THREE.BoxGeometry(0.34, 0.34, 0.015).translate(0, hipY + 0.32, 0.165), pick(rand, [0xc8b890, 0x6a7a52])));
  const body = new THREE.Mesh(mergeGeometries(parts));

  // head (own pivot so it can turn)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, hipY + 0.62, 0);
  const hp = [paint(new THREE.SphereGeometry(0.105, 8, 6).scale(0.95, 1.12, 1).translate(0, 0.15, 0.01), skin),
    paint(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 6).translate(0, 0.02, 0), skin)];
  if (rand() < 0.3) hp.push(paint(new THREE.BoxGeometry(0.11, 0.07, 0.05).translate(0, 0.09, 0.085), 0x3a2e24));   // beard
  const hair = pick(rand, [0x2a2220, 0x5a4030, 0x9a8a6a, 0xb0b0a8, 0x161412]);
  if (hatKind === 'none' || hatKind === 'cap') hp.push(paint(new THREE.SphereGeometry(0.108, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.45).translate(0, 0.165, -0.005), hatKind === 'cap' ? hatCol : hair));
  if (hatKind === 'cap') hp.push(paint(new THREE.BoxGeometry(0.15, 0.014, 0.1).translate(0, 0.17, 0.12), hatCol));
  if (hatKind === 'beanie') hp.push(paint(new THREE.SphereGeometry(0.118, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.15, 1.05).translate(0, 0.17, 0), hatCol));
  if (hatKind === 'boonie' || hatKind === 'straw') {
    const hc = hatKind === 'straw' ? 0xd2b676 : hatCol;
    hp.push(paint(new THREE.CylinderGeometry(0.235, 0.235, 0.012, 10).translate(0, 0.2, 0), hc));
    hp.push(paint(new THREE.CylinderGeometry(0.1, 0.115, 0.09, 8).translate(0, 0.24, 0), hc, 0.9));
  }
  headPivot.add(new THREE.Mesh(mergeGeometries(hp)));

  // arms hang from shoulder pivots; rotation.x < 0 lifts them forward
  const shoulderY = hipY + 0.55;
  const mkArm = (side) => {
    const pv = new THREE.Group();
    pv.position.set(side * 0.235 * tw, shoulderY, 0);
    pv.rotation.order = 'YXZ';
    const sl = shortSleeve ? 0.2 : 0.52;
    const ap = [limb([0, 0, 0], [0, -sl, 0], 0.062, 0.05, top)];
    if (sl < 0.5) ap.push(limb([0, -sl, 0], [0, -0.52, 0], 0.045, 0.04, skin));
    ap.push(paint(new THREE.SphereGeometry(0.045, 6, 5).translate(0, -0.55, 0), skin));
    const m = new THREE.Mesh(mergeGeometries(ap));
    pv.add(m);
    return pv;
  };
  const armR = mkArm(1), armL = mkArm(-1);
  const cup = new THREE.Mesh(mergeGeometries([paint(new THREE.CylinderGeometry(0.045, 0.036, 0.11, 8).translate(0, -0.55, 0.06), pick(rand, [0xe8e4da, 0xb84a30, 0x3a6a8a])),
    paint(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 8).translate(0, -0.605, 0.06), 0x2a2a2a)]));
  cup.visible = false;
  armL.add(cup);

  // the rod: cork handle, graphite blank tapering to the tip, a spinning reel under the grip
  const rodPivot = new THREE.Group();
  rodPivot.position.set(0.17, hipY + 0.18, 0.42);
  const len = 1.9 + rand() * 0.5;
  const rp = [limb([0, 0, -0.38], [0, 0, 0.12], 0.026, 0.022, 0xc4a070), limb([0, 0, 0.12], [0, 0, len], 0.014, 0.004, rand() < 0.5 ? 0x1d2022 : 0x3a4a3a),
    paint(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8).rotateX(Math.PI / 2).translate(0, -0.075, 0.1), 0x8a8e92)];
  rodPivot.add(new THREE.Mesh(mergeGeometries(rp)));
  rodPivot.rotation.x = -0.5;

  const root = new THREE.Group();
  root.add(body, headPivot, armR, armL, rodPivot);
  return { root, head: headPivot, armR, armL, rod: rodPivot, cup, tip: new THREE.Vector3(0, 0, len), hipY, sit, cold };
}

const mats = {};
function bodyMaterial(patchProp) {
  if (!mats.body) {
    mats.body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, flatShading: false });
    patchProp(mats.body);
  }
  return mats.body;
}

const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
const SEG = 8;

// ---- boats ------------------------------------------------------------------------------
const HULL = { jon: [3.8, 1.72, 0.55, 0.17, 0.42], bass: [6.2, 2.35, 0.78, 0.32, 0.18], skiff: [5.6, 2.1, 0.62, 0.3, 0.2], center: [8.6, 2.8, 1.35, 0.34, 0.75] };   // length, beam, depth, draft, deckDrop
const BOAT_SETS = { lake: ['jon', 'bass', 'skiff'], river: ['jon', 'skiff', 'skiff'], inshore: ['skiff', 'center', 'skiff'], offshore: ['center', 'skiff'] };
function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 8, 5).scale(0.17, 0.065, 0.045);
  const p = body.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(0x4a5e62), b = new THREE.Color(0xe4ece8), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { t.copy(b).lerp(a, clamp((p.getY(i) + 0.03) / 0.06, 0, 1)); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
  body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tail = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.07, 0.05), new THREE.Vector2(-0.06, 0), new THREE.Vector2(-0.07, -0.05)]));
  tail.translate(-0.075, 0, 0);
  const g = mergeGeometries([body.index ? body.toNonIndexed() : body, paint(tail, 0x6a7e80)].map((x) => { x.deleteAttribute('uv'); return x; }));
  return g;
}

export class ShoreLife {
  constructor(game) {
    this.g = game;
    this.loc = game.loc;
    this.group = new THREE.Group();
    this.group.name = 'shorelife';
    game.scene.add(this.group);
    this.anglers = [];
    this.boats = [];
    this.schools = [];
    this.blockers = [];
    this.time = 0;
    this.ripple = 4;
    this.rand = rng(hashStr(this.loc.id) + 11);
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xe6ece6, transparent: true, opacity: 0.55, depthWrite: false });
    this.bobMat = new THREE.MeshStandardMaterial({ color: 0xe05a34, roughness: 0.5 });
    game.patchProp(this.bobMat);
    this.bobGeo = new THREE.SphereGeometry(0.035, 7, 5);
  }

  async init() {
    const g = this.g, docks = g.docks;
    this.mat = bodyMaterial(g.patchProp);
    this.dockAnglers(docks);
    this.shoreAnglers();
    await this.boatsAndAnchors(docks);
    this.fishSchools(docks);
  }

  // ---- anglers -------------------------------------------------------------------------
  // place one angler: parent group, local position, yaw so +z faces the water, bobber target
  addAngler(parent, pos, yaw, sit, aim, kind = 'dock') {
    const rand = this.rand;
    const b = buildAngler(this.loc, rand, sit);
    b.root.traverse((o) => { if (o.isMesh) { o.material = this.mat; o.layers.enable(1); } });
    b.root.position.copy(pos);
    b.root.rotation.y = yaw;
    parent.add(b.root);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: SEG }, () => new THREE.Vector3())), this.lineMat);
    line.frustumCulled = false;
    const bob = new THREE.Mesh(this.bobGeo, this.bobMat);
    bob.layers.enable(1);
    this.group.add(line, bob);
    const a = Object.assign(b, {
      kind, line, bob, aim, state: 'wait', t: 0, dur: 6 + rand() * 14, waveCool: 8 + rand() * 20, phase: rand() * 10, lookYaw: 0,
      bx: aim.x, bz: aim.z, flying: false, parent, reelMax: 0.5, hide: this.anglers.length % 2, bite: 3 + rand() * 6, biteT: 0,
    });
    a.parent.updateMatrixWorld(true);
    const w = new THREE.Vector3(); b.root.getWorldPosition(w);
    a.wx = w.x; a.wz = w.z;
    // how far the bobber can be reeled in before it would be on land
    let k = 0.55;
    for (; k > 0.05; k -= 0.05) { const px = lerp(aim.x, w.x, k), pz = lerp(aim.z, w.z, k); if (this.g.heightAt(px, pz) < -0.5) break; }
    a.reelMax = k;
    this.anglers.push(a);
    if (kind !== 'boat') this.blockers.push({ x: w.x, z: w.z, r: 0.55 });
    return a;
  }

  // march seaward from a point until there is real water to put the bobber in
  waterAim(x, z, dx, dz, min = 5, max = 13) {
    const H = this.g.heightAt;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const r = this.rand;
    for (let t = min + r() * (max - min - min * 0.4); t < 40; t += 1) {
      const px = x + dx * t, pz = z + dz * t;
      if (H(px, pz) < -0.7) return { x: px + (r() - 0.5) * 2 * dz, z: pz - (r() - 0.5) * 2 * dx };
    }
    return null;
  }

  dockAnglers(docks) {
    const r = this.rand, V = new THREE.Vector3(), V2 = new THREE.Vector3();
    docks.list.forEach((d, di) => {
      const L = d.len, HEAD_D = 3.6, HEAD_W = 6;
      const spots = [
        { u: L + HEAD_D - 0.45, v: 0.5, face: [1, 0], sit: false, p: 0.9 },
        { u: L + HEAD_D - 0.45, v: 1.65, face: [1, 0], sit: false, p: 0.5 },
        { u: L + 1.4, v: -HEAD_W / 2 + 0.4, face: [0, -1], sit: false, p: 0.45 },
        { u: L + HEAD_D - 1.0, v: -HEAD_W / 2 + 1.2, face: [1, 0], sit: true, p: 0.8 },   // on the bench
      ];
      let n = 0;
      for (const s of spots) {
        if (n >= (di === 0 ? 3 : 2) || r() > s.p) continue;
        d.toWorld(s.u, s.v, V); d.toWorld(s.u + s.face[0], s.v + s.face[1], V2);
        const fx = V2.x - V.x, fz = V2.z - V.z;
        const aim = this.waterAim(V.x, V.z, fx, fz, s.sit ? 6 : 5, 13);
        if (!aim) continue;
        // bench sits at the bench's own height; the group is parented to the scene, deck y baked in
        const y = d.deck + (s.sit ? 0.41 : 0);
        this.addAngler(this.group, new THREE.Vector3(V.x, y, V.z), Math.atan2(fx, fz), s.sit, aim, 'dock');
        n++;
      }
    });
  }

  // bank anglers: dry ground right at the water's edge, a little away from any dock
  shoreAnglers() {
    const g = this.g, H = g.heightAt, r = this.rand, st = g.start;
    const want = this.loc.water === 'offshore' ? 1 : this.loc.water === 'river' ? 3 : 2;
    const circles = g.obstacles.list;
    let got = 0;
    for (let tries = 0; tries < 900 && got < want; tries++) {
      const ang = r() * Math.PI * 2, rad = 25 + r() * 330;
      const x = st.x + Math.cos(ang) * rad, z = st.z + Math.sin(ang) * rad;
      const h = H(x, z);
      if (h < 0.2 || h > 2.6) continue;
      const gx = H(x + 2, z) - H(x - 2, z), gz = H(x, z + 2) - H(x, z - 2), gl = Math.hypot(gx, gz);
      if (gl < 0.015 || gl > 1.2) continue;
      const dx = -gx / gl, dz = -gz / gl;
      // water within a few metres in front, solid footing behind, not on a dock ramp or among trees
      if (H(x + dx * 5, z + dz * 5) > -0.15 || H(x - dx * 3, z - dz * 3) < 0.1) continue;
      if (g.docks.list.some((d) => Math.hypot(d.x - x, d.z - z) < 12)) continue;
      if (this.anglers.some((o) => Math.hypot(o.wx - x, o.wz - z) < 30)) continue;
      if (circles.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.6)) continue;
      const aim = this.waterAim(x, z, dx, dz, 6, 12);
      if (!aim) continue;
      this.addAngler(this.group, new THREE.Vector3(x, h, z), Math.atan2(dx, dz), false, aim, 'shore');
      got++;
    }
  }

  // ---- boats ---------------------------------------------------------------------------
  // a real buoyant hull (same GLB + floater as the player's boat) that we pin in place each
  // frame, so it rides the swell properly instead of sitting at a fixed height
  async place(id, x, z, yaw) {
    const [len, beam, depth, draft] = HULL[id];
    const pb = await new PlayerBoat(id).create(this.g.e.floaters, this.g.patchProp, { x, z }, yaw);
    pb.body.keep = true;
    const grp = pb.body.object;
    return { id, pb, grp, len, beam, depth, draft, x, z, yaw, floor: deckHeight(id, -len * 0.1), phase: this.rand() * 10 };
  }

  async boatsAndAnchors(docks) {
    const r = this.rand, g = this.g, H = g.heightAt;
    const set = BOAT_SETS[this.loc.water] || BOAT_SETS.lake;
    // tied up along the walkway, fenders out, a bow and a stern line to the deck edge
    for (let di = 0; di < docks.list.length; di++) {
      const d = docks.list[di];
      const sides = r() < 0.5 ? [1, -1] : [-1, 1];
      const count = di === 0 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const side = sides[k];
        const id = set[Math.floor(r() * set.length)];
        const [len, beam] = HULL[id];
        const span = d.len - len - 3.5;
        if (span < 0) continue;
        const u = len / 2 + 2.5 + r() * span * (0.7), v = side * (0.9 + beam / 2 + 0.2);
        if (this.mooredOverlap(d, u, v, len)) continue;
        const p = d.toWorld(u, v);
        // water under the whole hull, not on a bank
        let ok = true;
        for (const du of [-len / 2, 0, len / 2]) for (const dv of [-beam / 2, beam / 2]) { const q = d.toWorld(u + du, v + dv); if (H(q.x, q.z) > -0.7) ok = false; }
        if (!ok) continue;
        const yaw = d.yaw + (r() < 0.6 ? Math.PI : 0);   // most are backed in, bow to shore
        const b = await this.place(id, p.x, p.z, yaw);
        b.dock = d; b.moor = { u, v, side };
        this.boats.push(b);
        // mooring lines: deck edge to the gunwale, bow and stern
        for (const du of [-len * 0.36, len * 0.36]) {
          const a = d.toWorld(u + du * 0.6, side * 0.92), c = d.toWorld(u + du, v - side * beam * 0.45);
          const dx = c.x - p.x, dz = c.z - p.z, cy = Math.cos(yaw), sy = Math.sin(yaw);
          const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
          const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, d.deck - 0.02, a.z), new THREE.Vector3(a.x, d.deck - 0.02, a.z), new THREE.Vector3(a.x, d.deck - 0.02, a.z)]), new THREE.LineBasicMaterial({ color: 0xb8a888 }));
          rope.frustumCulled = false;
          this.group.add(rope);
          (b.ropes ||= []).push({ rope, a: new THREE.Vector3(a.x, d.deck - 0.02, a.z), local: new THREE.Vector3(lx, deckHeight(id, lx) + 0.12, lz) });
        }
        for (let i = 0; i < 2; i++) { const q = d.toWorld(u + (i - 0.5) * len * 0.6, v); g.obstacles.add([{ x: q.x, z: q.z, r: beam * 0.5 + 0.1 }]); }
      }
    }
    // at anchor out on the water, some with an angler aboard
    const sites = docks.list.length ? docks.list.map((d) => d.end) : [g.start];
    const want = this.loc.water === 'offshore' && !docks.list.length ? 0 : 2 + (docks.list.length ? 1 : 0);
    let got = 0;
    for (let tries = 0; tries < 400 && got < want; tries++) {
      const s = sites[tries % sites.length];
      const a = r() * Math.PI * 2, rad = 40 + r() * 110;
      const x = s.x + Math.cos(a) * rad, z = s.z + Math.sin(a) * rad;
      if (Math.hypot(x - g.start.x, z - g.start.z) < 55) continue;
      if (docks.list.some((d) => Math.hypot(d.x - x, d.z - z) < 70 && Math.abs(d.toLocal(x, z)[1]) < 25)) continue;   // keep the dock approaches open
      if (this.boats.some((b) => Math.hypot(b.x - x, b.z - z) < 40)) continue;
      const dep = -H(x, z);
      if (dep < 2.5 || dep > 12) continue;
      let flat = true;
      for (const [ox, oz] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) if (H(x + ox, z + oz) > -1.5) flat = false;
      if (!flat) continue;
      const id = set[Math.floor(r() * set.length)];
      const b = await this.place(id, x, z, r() * Math.PI * 2);
      b.anchor = true; b.dep = dep;
      // anchor line from the bow down to the bottom
      const bow = new THREE.Vector3(b.len * 0.46, deckHeight(id, b.len * 0.46), 0);
      const pts = [bow.clone(), new THREE.Vector3(b.len * 0.46 + dep * 1.2 * 0.5, -dep * 0.5, 0), new THREE.Vector3(b.len * 0.46 + dep * 1.2, -dep, 0)];
      const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9a8f7a, transparent: true, opacity: 0.7 }));
      rope.frustumCulled = false;
      b.grp.add(rope);
      this.boats.push(b);
      g.obstacles.add([{ x, z, r: b.beam * 0.55 }, ...(b.len > 5 ? [{ x: x + Math.cos(b.yaw) * b.len * 0.28, z: z - Math.sin(b.yaw) * b.len * 0.28, r: b.beam * 0.5 }, { x: x - Math.cos(b.yaw) * b.len * 0.28, z: z + Math.sin(b.yaw) * b.len * 0.28, r: b.beam * 0.5 }] : [])]);
      got++;
      if (id !== 'center' && r() < 0.7) {   // an angler on the middle thwart, line over the side
        const side = r() < 0.5 ? 1 : -1;
        const aimDir = [side * Math.sin(b.yaw), side * Math.cos(b.yaw)];
        const aim = this.waterAim(x, z, aimDir[0], aimDir[1], 5, 10);
        if (aim && H(aim.x, aim.z) < -1) {
          // boat-local +x is the bow; facing a side means yaw 0 (z+) or pi (z-)
          b.angler = this.addAngler(b.grp, new THREE.Vector3(-b.len * 0.1, b.floor - 0.12, 0), side > 0 ? 0 : Math.PI, true, aim, 'boat');
        }
      }
    }
  }

  mooredOverlap(d, u, v, len) {
    return this.boats.some((b) => b.dock === d && Math.sign(b.moor.v) === Math.sign(v) && Math.abs(b.moor.u - u) < (b.len + len) / 2 + 0.6);
  }

  // ---- fish schools --------------------------------------------------------------------
  fishSchools(docks) {
    const g = this.g, H = g.heightAt, r = this.rand;
    if ((this.loc.waterLook?.turbidity ?? 0.2) > 0.12) return;
    const geo = fishGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35, side: THREE.DoubleSide });
    g.patchProp(mat);
    const centres = docks.list.length ? docks.list.map((d) => d.end) : [g.start];
    const want = 3;
    for (let tries = 0; tries < 400 && this.schools.length < want; tries++) {
      const s = centres[tries % centres.length];
      const a = r() * Math.PI * 2, rad = 18 + r() * 120;
      const x = s.x + Math.cos(a) * rad, z = s.z + Math.sin(a) * rad;
      const h = H(x, z);
      if (h > -1.4 || h < -4.5) continue;
      let ok = true;
      for (const [ox, oz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) { const q = H(x + ox, z + oz); if (q > -1.1 || q < -7) ok = false; }
      if (!ok) continue;
      const n = 46;
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.frustumCulled = false;
      mesh.layers.enable(1);
      this.group.add(mesh);
      this.schools.push({ mesh, x, z, vx: 0, vz: 0, heading: r() * 6.28, spread: 1, n, seed: r() * 100, size: 0.8 + r() * 0.8 });
    }
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._qq = new THREE.Quaternion(); this._e = new THREE.Euler();
  }

  // ---- per frame -----------------------------------------------------------------------
  update(dt, player, night) {
    this.time += dt;
    const t = this.time, g = this.g;
    const cam = g.camera.position;
    // anglers
    for (const a of this.anglers) {
      const d = Math.hypot(a.wx - cam.x, a.wz - cam.z);
      const show = d < 280 && !(night > 0.92 && a.hide && a.kind !== 'dock');
      if (!show) { if (a.root.visible) { a.root.visible = false; a.line.visible = false; a.bob.visible = false; } continue; }
      if (!a.root.visible) { a.root.visible = a.line.visible = a.bob.visible = true; }
      this.animate(a, dt, t, cam, d);
    }
    // boats: real floating hulls, held on their mooring / anchor each frame
    for (const b of this.boats) {
      const d = Math.hypot(b.x - cam.x, b.z - cam.z), body = b.pb.body;
      b.grp.visible = d < 700;
      if (!b.grp.visible || !body) continue;
      body.pos.x = b.x; body.pos.z = b.z; body.vel.x = 0; body.vel.z = 0;
      const want = b.yaw + (b.anchor ? Math.sin(t * 0.17 + b.phase) * 0.18 : 0);
      let diff = want - b.pb.heading(); diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      body.angVel.y += (diff * 2 - body.angVel.y) * Math.min(1, dt * 4);
      if (b.ropes) for (const q of b.ropes) q.rope.visible = d < 200;   // far ropes are never updated: hide them rather than draw them to the origin
      if (b.ropes && d < 200) for (const q of b.ropes) {
        const pos = q.rope.geometry.attributes.position;
        _B.copy(q.local).applyQuaternion(body.quat).add(body.pos);
        pos.setXYZ(2, _B.x, _B.y, _B.z);
        pos.setXYZ(1, (q.a.x + _B.x) / 2, Math.min(q.a.y, _B.y) - 0.18, (q.a.z + _B.z) / 2);
        pos.needsUpdate = true;
      }
    }
    this.fish(dt, t, cam, player);
    // fish rising near the banks: a ripple now and then, only where you can see it
    this.ripple -= dt;
    if (this.ripple <= 0) {
      this.ripple = 4 + this.rand() * 7;
      const s = this.pickNear(cam);
      if (s) g.splash(s.x, s.z, 0.025, 0.3);
    }
  }

  pickNear(cam) {
    const H = this.g.heightAt, r = this.rand;
    for (let k = 0; k < 6; k++) {
      const a = r() * Math.PI * 2, rad = 15 + r() * 60;
      const x = cam.x + Math.cos(a) * rad, z = cam.z + Math.sin(a) * rad, h = H(x, z);
      if (h < -0.6 && h > -6) return { x, z };
    }
    return null;
  }

  blocks(x, z) {
    for (const b of this.blockers) if ((b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) < 0.36) return true;
    return false;
  }

  animate(a, dt, t, cam, dist) {
    a.t += dt;
    a.waveCool -= dt;
    const root = a.root, rod = a.rod, armR = a.armR, armL = a.armL;
    root.updateMatrixWorld(true);
    // where the player is, in the angler's own frame (for looking and waving)
    const lp = _A.set(cam.x, cam.y, cam.z); root.worldToLocal(lp);
    const toYaw = clamp(Math.atan2(lp.x, lp.z), -1.1, 1.1), near = dist < 30 && lp.z > -4;
    let want = 0, rodX = -0.5, armX = -0.83, lX = -0.7, lY = 0.6, lZ = 0, sway = Math.sin(t * 0.7 + a.phase) * 0.012;
    a.cup.visible = false;

    if (a.state === 'wait') {
      a.bite -= dt;
      if (a.bite <= 0) { a.bite = 5 + this.rand() * 12; a.biteT = 1.2; if (dist < 140 && this.rand() < 0.4) this.g.splash(a.bx, a.bz, 0.02, 0.3); }
      if (near) want = toYaw * 0.8; else want = Math.sin(t * 0.2 + a.phase) * 0.5 * (Math.sin(t * 0.05 + a.phase) > 0.4 ? 1 : 0.15);
      if (a.biteT > 0) rodX += Math.sin(a.biteT * 14) * 0.03 * Math.min(1, a.biteT);
      if (a.waveCool <= 0 && dist < 36 && lp.z > 1) { a.state = 'wave'; a.t = 0; a.dur = 3.2; }
      else if (a.t > a.dur) {
        const q = this.rand();
        a.t = 0;
        if (q < 0.3) { a.state = 'sip'; a.dur = 3.4; }
        else if (q < 0.78) { a.state = 'reel'; a.dur = 4.5 + this.rand() * 3; }
        else { a.dur = 6 + this.rand() * 14; }
      }
    } else if (a.state === 'sip') {
      const k = Math.sin(clamp(a.t / a.dur, 0, 1) * Math.PI), s = clamp(k * 2.2, 0, 1);
      lX = lerp(-0.7, -2.15, s); lY = lerp(0.6, 0.15, s); a.cup.visible = s > 0.05;
      want = near ? toYaw * 0.6 : 0;
      rodX = -0.5 - s * 0.15;
      if (a.t > a.dur) { a.state = 'wait'; a.t = 0; a.dur = 8 + this.rand() * 14; }
    } else if (a.state === 'reel') {
      const k = clamp(a.t / a.dur, 0, 1), crank = a.t * 7;
      rodX = -0.7 - Math.sin(clamp(k * 3, 0, 1) * Math.PI) * 0.12;
      lX = -0.75 + Math.sin(crank) * 0.2; lZ = Math.cos(crank) * 0.12;
      const f = a.reelMax * sm(k, 0.1, 0.8);
      a.bx = lerp(a.aim.x, a.wx, f); a.bz = lerp(a.aim.z, a.wz, f);
      if (a.t > a.dur) { a.state = 'cast'; a.t = 0; a.dur = 2.7; a.cx0 = a.bx; a.cz0 = a.bz; a.cast = false; }
    } else if (a.state === 'cast') {
      const T = a.t;
      if (T < 0.8) rodX = lerp(-0.7, -1.95, sm(T, 0, 0.8));
      else if (T < 1.05) rodX = lerp(-1.95, -0.1, sm(T, 0.8, 1.05));
      else rodX = lerp(-0.1, -0.5, sm(T, 1.6, 2.7));
      armX = -0.83 + (rodX + 0.5) * 0.55; lX = -0.7 + (rodX + 0.5) * 0.4;
      if (T >= 1.05 && !a.cast) { a.cast = true; this.tipWorld(a, _B); a.rx = _B.x; a.ry = _B.y; a.rz = _B.z; }
      if (T >= 2.0 && a.flying) { a.flying = false; this.g.splash(a.aim.x, a.aim.z, 0.04, 0.35); }
      a.flying = T >= 1.05 && T < 2.0;
      if (a.flying) {
        const f = (T - 1.05) / 0.95;
        a.bx = lerp(a.rx, a.aim.x, f); a.bz = lerp(a.rz, a.aim.z, f); a.by = lerp(a.ry, 0.03, f) + Math.sin(f * Math.PI) * 3.2;
      } else if (T >= 2.0) { a.bx = a.aim.x; a.bz = a.aim.z; a.by = 0.03; }
      else if (T < 1.05) { this.tipWorld(a, _B); a.bx = _B.x; a.bz = _B.z; a.by = _B.y - 0.15; }
      if (a.t > a.dur) { a.state = 'wait'; a.t = 0; a.dur = 10 + this.rand() * 14; a.bite = 3 + this.rand() * 5; }
    } else if (a.state === 'wave') {
      const k = clamp(a.t / a.dur, 0, 1), s = clamp(Math.sin(k * Math.PI) * 3, 0, 1);
      lX = lerp(-0.7, -2.85, s); lY = lerp(0.6, 0.05, s); lZ = Math.sin(a.t * 7.5) * 0.45 * s;
      want = toYaw;
      if (a.t > a.dur) { a.state = 'wait'; a.t = 0; a.dur = 8 + this.rand() * 10; a.waveCool = 70 + this.rand() * 80; }
    }
    // bobber rides on the water except while a cast is in the air
    const inAir = a.state === 'cast' && a.t < 2.0;
    if (!inAir) a.by = 0.03 + Math.sin(t * 1.3 + a.phase) * 0.012 - (a.biteT > 0 ? Math.sin(a.biteT * 12) * 0.02 : 0);
    if (a.biteT > 0) a.biteT -= dt;
    a.lookYaw += (want - a.lookYaw) * Math.min(1, dt * 3);
    a.head.rotation.y = a.lookYaw;
    rod.rotation.x = rodX + sway;
    armR.rotation.set(armX + sway, -0.12, 0);
    armL.rotation.set(lX, lY, lZ);
    // line: tip to bobber with a gentle sag
    this.tipWorld(a, _B);
    a.bob.position.set(a.bx, a.by, a.bz);
    const pos = a.line.geometry.attributes.position, sag = inAir ? 0.35 : 0.12 + (a.state === 'reel' ? 0 : 0.1);
    const dx = a.bx - _B.x, dz = a.bz - _B.z, dy = a.by - _B.y;
    for (let i = 0; i < SEG; i++) {
      const f = i / (SEG - 1);
      pos.setXYZ(i, _B.x + dx * f, _B.y + dy * f - sag * 4 * f * (1 - f) * Math.min(3, Math.hypot(dx, dz) * 0.2), _B.z + dz * f);
    }
    pos.needsUpdate = true;
  }

  tipWorld(a, out) {
    out.copy(a.tip);
    a.rod.localToWorld(out);
    return out;
  }

  fish(dt, t, cam, player) {
    if (!this.schools.length) return;
    const H = this.g.heightAt, m = this._m, p = this._p, s = this._s, q = this._qq, e = this._e;
    for (const sc of this.schools) {
      const d = Math.hypot(sc.x - cam.x, sc.z - cam.z);
      sc.mesh.visible = d < 220;
      if (!sc.mesh.visible) continue;
      // drift, turn from shallows, scatter from a boat or walker that comes close
      const pd = Math.hypot(sc.x - player.x, sc.z - player.z);
      const flee = pd < 14 ? 1 : 0;
      sc.spread += ((flee ? 2.4 : 1) - sc.spread) * Math.min(1, dt * 1.5);
      const sp = flee ? 4.5 : 0.5 + Math.sin(t * 0.2 + sc.seed) * 0.15;
      if (flee) sc.heading = Math.atan2(-(sc.z - player.z), sc.x - player.x);
      else sc.heading += Math.sin(t * 0.13 + sc.seed) * dt * 0.25;
      const nx = sc.x + Math.cos(sc.heading) * sp * dt, nz = sc.z - Math.sin(sc.heading) * sp * dt;
      const h = H(nx, nz);
      if (h < -1.3 && h > -7) { sc.x = nx; sc.z = nz; } else sc.heading += Math.PI * 0.6;
      const bed = H(sc.x, sc.z);
      for (let i = 0; i < sc.n; i++) {
        const a = t * (0.35 + (i % 5) * 0.04) * (i % 2 ? 1 : -1) + i * 2.399 + sc.seed;
        const r = (0.7 + ((i * 37) % 17) * 0.14) * sc.spread * sc.size;
        const px = sc.x + Math.cos(a) * r, pz = sc.z + Math.sin(a) * r * 0.7;
        const py = clamp(-0.55 - ((i * 13) % 7) * 0.13 + Math.sin(a * 2) * 0.08, bed + 0.35, -0.35);
        // heading from the circle's tangent
        const dir = (i % 2 ? 1 : -1);
        e.set(0, Math.atan2(-Math.cos(a) * 0.7 * dir, -Math.sin(a) * dir) + Math.PI, Math.sin(t * 9 + i) * 0.05);
        q.setFromEuler(e);
        p.set(px, py, pz); s.setScalar(1.5);
        m.compose(p, q, s);
        sc.mesh.setMatrixAt(i, m);
      }
      sc.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

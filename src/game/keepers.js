import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, limb, rng, hashStr } from './shorelife.js';
import { KEEPERS, GENERIC, TIPS, CHOICES, LORE, ANGLER_HI, ANGLER_HI_LOC, TIERS } from './dialogue.js';
import { SPECIES_BY_ID } from './species.js';
import { LURES } from './gear.js';
import { fit, prefDepth, timeFit, weatherFit, LURE_KIND, KIND_LABEL } from './bait.js';
import { tournamentsFor } from './tournaments.js';

// Shopkeepers: a named person at each shop building (role by dock: marina / bait / buyer), built from
// the same low-poly parts as the shore anglers but dressed for the job and the place. They idle, turn
// their head to you, and talk through the panel in ui.js. The words are all in dialogue.js; the tips
// come from the real bite model (bait.js); the relationship is saved in save.rapport.

const SKIN = [0xe2b896, 0xc89270, 0x9a6a4c, 0x6e4a36, 0xf0d2b6];
const COLD = new Set(['fjord', 'bering', 'woods', 'tahoe', 'columbia']);
const HOT = new Set(['keys', 'amazon', 'mekong', 'kariba', 'okeechobee', 'reef', 'cabo', 'gulf']);
const clamp = THREE.MathUtils.clamp;
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

// ---- body ---------------------------------------------------------------------------------------
function buildKeeper(locId, role, d, rand) {
  const cold = COLD.has(locId), hot = HOT.has(locId);
  const ranger = d.kit === 'ranger';
  const skin = SKIN[d.skin ?? 0], hair = d.age === 'old' ? 0xb4b2aa : d.hair ?? 0x2a2220;
  const hipY = 0.9, tw = cold ? 1.16 : 1;
  const stoop = d.age === 'old' ? 0.08 : 0;
  let shirt, trousers, boots = 0x2a2a2c;
  if (ranger) { shirt = 0x66703f; trousers = 0x7a6a4a; }
  else if (role === 'marina') { shirt = hot ? 0xe8e6de : 0x1f2d44; trousers = 0x1c2230; }
  else if (role === 'bait') { shirt = pick(rand, hot ? [0x7a9a8a, 0xc67a3a, 0x8aa0b8, 0xb4583c] : [0x8a3a3a, 0x3a5a7a, 0x5a6a42, 0x6a5a48]); trousers = pick(rand, [0x3a4a62, 0x6a5c44, 0x4a5240]); }
  else { shirt = cold ? 0xd6d0be : 0xc8c4b0; trousers = 0x3a4a52; boots = 0x1d2a1f; }
  const legs = [];
  for (const s of [-1, 1]) {
    const x = s * 0.1;
    legs.push(limb([x, hipY, 0], [x, 0.5, 0.01], 0.088, 0.072, trousers));
    legs.push(limb([x, 0.5, 0.01], [x, 0.1, 0], 0.072, role === 'buyer' ? 0.07 : 0.056, trousers));
    legs.push(paint(new THREE.BoxGeometry(0.11, role === 'buyer' ? 0.3 : 0.08, 0.26).translate(x, role === 'buyer' ? 0.15 : 0.04, 0.06), boots));
  }
  const torsoY = hipY + 0.3;
  const parts = [...legs];
  // jacket / shirt
  const jacket = role === 'marina' && !hot && !ranger;
  parts.push(paint(new THREE.CylinderGeometry(0.19 * tw, 0.175 * tw, 0.6, 9).scale(1, 1, 0.7).translate(0, torsoY, 0), jacket ? 0x1f2d44 : shirt));
  parts.push(paint(new THREE.CylinderGeometry(0.18 * tw, 0.18 * tw, 0.05, 9).scale(1, 1, 0.72).translate(0, hipY + 0.02, 0), 0x3a3026));
  const fz = 0.175 * 0.7 * tw + 0.006;   // front of the chest
  if (role === 'bait') {   // canvas apron, neck strap, pocket
    const ap = pick(rand, [0x4a5a3a, 0x6a4a2a, 0x2e3a4a]);
    parts.push(paint(new THREE.BoxGeometry(0.33, 0.5, 0.02).translate(0, hipY + 0.18, fz + 0.005), ap));
    parts.push(paint(new THREE.BoxGeometry(0.2, 0.14, 0.025).translate(0, hipY + 0.1, fz + 0.02), ap, 0.8));
    parts.push(limb([-0.11, hipY + 0.42, fz], [0, hipY + 0.64, 0.02], 0.012, 0.012, ap));
    parts.push(limb([0.11, hipY + 0.42, fz], [0, hipY + 0.64, 0.02], 0.012, 0.012, ap));
  } else if (role === 'buyer') {   // oilskin bib overalls with straps
    const bib = pick(rand, [0xd6a21e, 0x2e4a6a, 0x4a6a3a]);
    parts.push(paint(new THREE.BoxGeometry(0.36, 0.6, 0.02).translate(0, hipY + 0.25, fz + 0.005), bib));
    parts.push(limb([-0.14, hipY + 0.55, fz], [-0.1, hipY + 0.64, -0.04], 0.018, 0.018, bib));
    parts.push(limb([0.14, hipY + 0.55, fz], [0.1, hipY + 0.64, -0.04], 0.018, 0.018, bib));
  } else if (ranger) {   // radio on the chest, badge, belt kit
    parts.push(paint(new THREE.BoxGeometry(0.07, 0.11, 0.04).translate(-0.1, hipY + 0.4, fz + 0.02), 0x1d1f22));
    parts.push(paint(new THREE.BoxGeometry(0.045, 0.05, 0.012).translate(0.1, hipY + 0.45, fz + 0.004), 0xc8a040));
    parts.push(paint(new THREE.BoxGeometry(0.1, 0.1, 0.06).translate(0.18, hipY + 0.02, 0.0), 0x2a2a28));
  } else {   // harbour master: collar, tie, gold epaulettes, name tab
    parts.push(paint(new THREE.BoxGeometry(0.12, 0.2, 0.012).translate(0, hipY + 0.5, fz + 0.002), 0xe8e6de));
    if (!hot) parts.push(paint(new THREE.BoxGeometry(0.03, 0.26, 0.012).translate(0, hipY + 0.4, fz + 0.012), 0x7a2a2a));
    for (const s of [-1, 1]) parts.push(paint(new THREE.BoxGeometry(0.1, 0.012, 0.07).translate(s * 0.17 * tw, hipY + 0.6, 0), 0xc8a040));
    parts.push(paint(new THREE.BoxGeometry(0.06, 0.02, 0.01).translate(0.09, hipY + 0.36, fz + 0.006), 0xd6d0be));
  }
  const body = new THREE.Mesh(mergeGeometries(parts));
  const torso = new THREE.Group();
  torso.position.y = 0;
  torso.add(body);

  // head
  const head = new THREE.Group();
  head.position.set(0, hipY + 0.64, 0.01);
  const darker = new THREE.Color(skin).multiplyScalar(0.88).getHex();
  const hp = [paint(new THREE.SphereGeometry(0.108, 9, 7).scale(0.95, 1.14, 1.0).translate(0, 0.15, 0.01), skin),
    paint(new THREE.CylinderGeometry(0.046, 0.052, 0.09, 7).translate(0, 0.03, 0), skin),
    paint(new THREE.BoxGeometry(0.026, 0.045, 0.045).translate(0, 0.135, 0.115), darker),
    paint(new THREE.BoxGeometry(0.02, 0.014, 0.01).translate(-0.04, 0.17, 0.1), 0x1a1614),
    paint(new THREE.BoxGeometry(0.02, 0.014, 0.01).translate(0.04, 0.17, 0.1), 0x1a1614),
    paint(new THREE.BoxGeometry(0.02, 0.05, 0.02).translate(-0.1, 0.15, 0.0), darker),
    paint(new THREE.BoxGeometry(0.02, 0.05, 0.02).translate(0.1, 0.15, 0.0), darker)];
  if (d.beard) hp.push(paint(new THREE.BoxGeometry(0.12, 0.08, 0.06).translate(0, 0.085, 0.075), hair, 0.9));
  const hat = role === 'marina' && d.hat === 'cap' ? 'peaked' : d.hat || 'none';
  const hatCol = ranger ? 0x7a6a4a : role === 'marina' ? 0x1c2230 : pick(rand, [0x2e3a4a, 0x7a2a2a, 0xd6d0be, 0x4a5a3a, 0x222428, 0x8a5a2a]);
  const hairCap = () => hp.push(paint(new THREE.SphereGeometry(0.113, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.46).translate(0, 0.17, -0.004), hair));
  if (hat === 'none') hairCap();
  else if (hat === 'cap') { hairCap(); hp.push(paint(new THREE.SphereGeometry(0.114, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.46).translate(0, 0.178, -0.004), hatCol)); hp.push(paint(new THREE.BoxGeometry(0.15, 0.014, 0.1).translate(0, 0.175, 0.125), hatCol)); }
  else if (hat === 'beanie') hp.push(paint(new THREE.SphereGeometry(0.122, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(1, 1.15, 1.05).translate(0, 0.172, 0), hatCol));
  else if (hat === 'peaked') {
    hp.push(paint(new THREE.CylinderGeometry(0.125, 0.12, 0.07, 10).translate(0, 0.235, 0), 0x1c2230));
    hp.push(paint(new THREE.CylinderGeometry(0.115, 0.125, 0.045, 10).translate(0, 0.205, 0), 0xe8e6de));
    hp.push(paint(new THREE.BoxGeometry(0.16, 0.012, 0.09).translate(0, 0.185, 0.13), 0x14171e));
    hp.push(paint(new THREE.BoxGeometry(0.04, 0.035, 0.012).translate(0, 0.22, 0.125), 0xc8a040));
  } else if (hat === 'ranger') {
    hp.push(paint(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 12).translate(0, 0.205, 0), 0x7a6a4a));
    hp.push(paint(new THREE.CylinderGeometry(0.095, 0.11, 0.1, 9).translate(0, 0.255, 0), 0x7a6a4a));
    hp.push(paint(new THREE.CylinderGeometry(0.111, 0.111, 0.02, 9).translate(0, 0.235, 0), 0x3a3426));
  } else if (hat === 'straw') {
    hp.push(paint(new THREE.CylinderGeometry(0.24, 0.24, 0.012, 11).translate(0, 0.2, 0), 0xd2b676));
    hp.push(paint(new THREE.CylinderGeometry(0.1, 0.115, 0.09, 9).translate(0, 0.24, 0), 0xd2b676, 0.9));
  } else if (hat === 'conical') {
    hp.push(paint(new THREE.ConeGeometry(0.27, 0.16, 12, 1, true).translate(0, 0.27, 0), 0xcfb272));
    hairCap();
  }
  head.add(new THREE.Mesh(mergeGeometries(hp)));

  // arms
  const sleeveLen = hot && !jacket && role !== 'buyer' ? 0.2 : 0.52;
  const sleeveCol = jacket ? 0x1f2d44 : role === 'buyer' && hot ? 0xc8c4b0 : shirt;
  const mkArm = (side) => {
    const pv = new THREE.Group();
    pv.position.set(side * 0.235 * tw, hipY + 0.55, 0);
    pv.rotation.order = 'YXZ';
    const ap = [limb([0, 0, 0], [0, -sleeveLen, 0], 0.062, 0.05, sleeveCol)];
    if (sleeveLen < 0.5) ap.push(limb([0, -sleeveLen, 0], [0, -0.52, 0], 0.046, 0.04, skin));
    ap.push(paint(new THREE.SphereGeometry(0.046, 7, 5).translate(0, -0.55, 0), skin));
    pv.add(new THREE.Mesh(mergeGeometries(ap)));
    return pv;
  };
  const armR = mkArm(1), armL = mkArm(-1);
  const root = new THREE.Group();
  const lean = new THREE.Group();
  lean.rotation.x = stoop;
  lean.add(torso, head, armR, armL);
  root.add(lean);
  return { root, lean, head, armR, armL, torso, role, ranger };
}

// ---- the manager --------------------------------------------------------------------------------
const _v = new THREE.Vector3();

export class Keepers {
  constructor(g) {
    this.g = g;
    this.loc = g.loc;
    this.list = [];
    this.talk = null;
    this.t = 0;
    this.angler = new WeakMap();   // shore angler -> next time (s) it may speak
    this.lastAng = -99;
    this.said = new Map();         // keeperKey -> Set of lore indexes told this visit-session
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0 });
    g.patchProp(mat);
    this.mat = mat;
    const set = KEEPERS[this.loc.id];
    if (!set) return;
    for (const door of g.buildings.doors) {
      const d = set[door.role];
      if (!d || door.kx === undefined) continue;
      const rand = rng(hashStr(this.loc.id + door.role) + 7);
      const b = buildKeeper(this.loc.id, door.role, d, rand);
      b.root.traverse((o) => { if (o.isMesh) o.material = mat; });
      // porch floor when it is within a step of the ground; on a dug-in or stilted site stand on the ground by the door
      const gy = g.heightAt(door.x, door.z);
      if (door.ky - gy > 1.3 || door.ky < gy - 0.2) {
        const sx = Math.sin(door.yaw), sz = Math.cos(door.yaw);
        door.kx = door.x - sx * 1.0; door.kz = door.z - sz * 1.0;
        door.ky = Math.max(g.heightAt(door.kx, door.kz), gy) + 0.02;
      }
      b.root.position.set(door.kx, door.ky, door.kz);
      b.root.rotation.y = door.yaw;
      g.buildings.group.add(b.root);
      this.list.push({ ...b, d, door, role: door.role, key: `${this.loc.id}.${door.role}`, look: 0, phase: rand() * 10, tNext: 4 + rand() * 6, gest: 0, gestKind: 0, talking: false, nod: 0 });
    }
  }

  nearest(x, z, reach = 5.6) {
    let best = null, bd = reach;
    for (const k of this.list) { const dd = Math.hypot(k.door.kx - x, k.door.kz - z); if (dd < bd) { bd = dd; best = k; } }
    return best;
  }

  who() { const g = this.g; const p = g.foot || g.boat?.body?.pos; return p ? this.nearest(p.x, p.z) : null; }   // the boat has no body while a new one loads (switchBoat)

  update(dt, pos, cam) {
    this.t += dt;
    const g = this.g;
    for (const k of this.list) {
      const dist = Math.hypot(k.door.kx - pos.x, k.door.kz - pos.z);
      k.root.visible = dist < 260;
      if (!k.root.visible || dist > 110) continue;
      this.animate(k, dt, cam, dist);
    }
    if (g.foot && !this.talk) this.greetAnglers(cam);
  }

  animate(k, dt, cam, dist) {
    const t = this.t + k.phase;
    k.root.updateMatrixWorld(true);
    const lp = _v.set(cam.x, cam.y, cam.z); k.root.worldToLocal(lp);
    const near = dist < 14 && lp.z > -2;
    const want = near ? clamp(Math.atan2(lp.x, Math.max(0.2, lp.z)), -1.15, 1.15) : Math.sin(t * 0.21) * 0.45 * (Math.sin(t * 0.07) > 0.3 ? 1 : 0.2);
    k.look += (want - k.look) * Math.min(1, dt * (near ? 4 : 1.5));
    k.head.rotation.y = k.look;
    k.head.rotation.x = (near ? clamp(Math.atan2(cam.y - (k.root.position.y + 1.6), dist) * -1, -0.2, 0.25) : 0.02) + k.nod * Math.sin(t * 7) * 0.05;
    k.lean.rotation.y = (k.look * 0.28);
    k.torso.position.y = Math.sin(t * 1.5) * 0.004;
    k.lean.rotation.z = Math.sin(t * 0.4) * 0.012;
    // arms: a resting pose per job, plus a small gesture now and then (and while talking)
    k.tNext -= dt;
    if (k.tNext <= 0) { k.gest = 1; k.gestKind = Math.floor(Math.random() * 2); k.tNext = 6 + Math.random() * 9; }
    if (k.gest > 0) k.gest = Math.max(0, k.gest - dt / 2.4);
    const gs = Math.sin(Math.PI * (1 - k.gest)) * (k.gest > 0 ? 1 : 0);
    const talk = k.talking ? 0.5 + 0.5 * Math.sin(t * 2.3) : 0;
    let rX, rZ, lX, lZ;
    if (k.role === 'buyer') { rX = -1.0; rZ = 0.55; lX = -1.0; lZ = -0.55; }   // arms folded
    else if (k.role === 'marina' && !k.ranger) { rX = 0.35; rZ = -0.12; lX = 0.35; lZ = 0.12; }   // hands behind the back
    else if (k.ranger) { rX = -0.25; rZ = 0.4; lX = -0.25; lZ = -0.4; }   // thumbs in the belt
    else { rX = -0.55; rZ = 0.1; lX = -0.55; lZ = -0.1; }   // hands near the apron
    if (k.role === 'bait') { rX += -0.25 * gs * Math.sin(t * 9); lX += -0.25 * gs * Math.sin(t * 9 + 1.2); }   // wiping hands
    else if (k.gestKind === 0) { rX += -0.7 * gs; rZ += 0.2 * gs; }
    else { lX += -0.7 * gs; lZ -= 0.2 * gs; }
    rX += -0.55 * talk; lX += -0.3 * talk * Math.sin(t * 1.7 + 1);
    k.armR.rotation.x += (rX - k.armR.rotation.x) * Math.min(1, dt * 6);
    k.armR.rotation.z += (-rZ - k.armR.rotation.z) * Math.min(1, dt * 6);
    k.armL.rotation.x += (lX - k.armL.rotation.x) * Math.min(1, dt * 6);
    k.armL.rotation.z += (-lZ - k.armL.rotation.z) * Math.min(1, dt * 6);
  }

  // ---- greeting from anglers on docks and banks --------------------------------------------------
  greetAnglers(cam) {
    const g = this.g;
    if (this.t - this.lastAng < 8 || g.ui.isOpen()) return;
    const list = g.shore?.anglers;
    if (!list) return;
    for (const a of list) {
      if (a.kind === 'boat' || !a.root.visible) continue;
      a.root.getWorldPosition(_v);
      if (Math.hypot(_v.x - cam.x, _v.z - cam.z) > 4.2) continue;
      if ((this.angler.get(a) || 0) > this.t) continue;
      this.angler.set(a, this.t + 120 + Math.random() * 90);
      this.lastAng = this.t;
      g.ui.say('Angler', this.anglerLine());
      return;
    }
  }

  anglerLine() {
    const g = this.g, h = g.hour(), wx = this.wx();
    const tags = new Set([h < 5.2 || h > 20.6 ? 'night' : h < 8.5 ? 'dawn' : h > 17.2 ? 'dusk' : 'day']);
    if (wx === 'rain' || wx === 'storm') tags.add('rain');
    if (COLD.has(this.loc.id)) tags.add('cold');
    if (HOT.has(this.loc.id)) tags.add('hot');
    const pool = ANGLER_HI.filter(([, need]) => !need || need.every((x) => tags.has(x))).map(([s]) => s);
    pool.push(...(ANGLER_HI_LOC[this.loc.id] || []), ...(ANGLER_HI_LOC[this.loc.id] || []));   // places weigh in more
    let s = pool[Math.floor(Math.random() * pool.length)];
    if (s === this.lastAngLine) s = pool[Math.floor(Math.random() * pool.length)];
    this.lastAngLine = s;
    return s;
  }

  wx() { const w = this.g.weather; return w?.L > 0.3 ? 'storm' : w?.id ?? 'partly'; }

  // ---- relationship ---------------------------------------------------------------------------------
  entry(k) { return (this.g.save.rapport || {})[k.key] || { visits: 0, deals: 0, day: 0 }; }
  tier(k) { const e = this.entry(k); let t = 0; TIERS.forEach((x, i) => { if (e.deals >= x.deals) t = i; }); return t; }
  discount(k) { return k ? TIERS[this.tier(k)].discount : 0; }
  // price at the shop you are standing at (tackle or marina keepers only)
  price(p) {
    const k = this.who();
    return k && k.role !== 'buyer' ? Math.max(1, Math.round(p * (1 - this.discount(k)))) : p;
  }
  deal() {
    const k = this.who();
    if (!k) return;
    const e = this.entry(k);
    this.save(k, { ...e, deals: e.deals + 1 });
  }
  save(k, e) { this.g.commit({ rapport: { ...(this.g.save.rapport || {}), [k.key]: e } }); }

  // ---- conversation ---------------------------------------------------------------------------------
  open(k) {
    const g = this.g, e = this.entry(k), day = g.save.day || 1;
    const first = e.visits === 0, tier = this.tier(k);
    if (e.day !== day || first) this.save(k, { ...e, visits: e.visits + 1, day });
    if (!this.said.has(k.key)) this.said.set(k.key, { lore: new Set(), tip: 0 });
    const line = tier >= 2 ? pick(Math.random, [...GENERIC.regular, k.d.back]) : first ? (k.d.hi || pick(Math.random, GENERIC.first[k.role])) : (k.d.back || pick(Math.random, GENERIC.back[k.role]));
    this.talk = { k, line, first };
    k.talking = false;
    return this.talk;
  }

  choices(k) { return CHOICES[k.role]; }

  reply(id) {
    const t = this.talk, k = t.k, st = this.said.get(k.key);
    let line;
    if (id === 'tip') line = this.tip(k, st);
    else if (id === 'lore') line = this.lore(k, st);
    else if (id === 'events') line = this.events();
    else line = pick(Math.random, GENERIC.deal);
    t.line = line;
    k.talking = true; k.nod = 1;
    clearTimeout(this._talkT);
    this._talkT = setTimeout(() => { k.talking = false; k.nod = 0; }, Math.min(5000, 1500 + line.length * 40));
    return line;
  }

  bye(k) { k.talking = false; return pick(Math.random, GENERIC.bye); }

  lore(k, st) {
    const all = (LORE[this.loc.id] || []).map((x, i) => [x, i]).filter(([[who]]) => who === k.role || who === '*');
    const fresh = all.filter(([, i]) => !st.lore.has(i));
    if (!fresh.length) return pick(Math.random, GENERIC.nothing);
    const [[, text], i] = fresh[Math.floor(Math.random() * fresh.length)];
    st.lore.add(i);
    return text;
  }

  events() {
    const g = this.g, loc = this.loc;
    const defs = tournamentsFor(loc, g.save.day || 1);
    const bits = [];
    if (g.tour && !g.tour.done) bits.push(`You are already in the ${g.tour.def.name}. Go and fish it.`);
    else bits.push(`Today there is the ${defs[0].name} ($${defs[0].fee}), the ${defs[1].name} ($${defs[1].fee}) and the ${defs[2].name} ($${defs[2].fee}).`);
    const ch = g.save.challenges;
    const open = ch ? ch.list.filter((c) => !c.done) : [];
    if (open.length) bits.push(`Locals also keep a board of small jobs: ${open.length} still open today, for $${open.reduce((s, c) => s + c.reward, 0).toLocaleString()} in total.`);
    else if (ch) bits.push('The board is clear for today. Come back tomorrow.');
    return bits.join(' ');
  }

  // a tip that is true: ranks this water's fish by how well they would feed right now (time, weather,
  // best lure at their own depth), then names the lure family and depth from the same model
  rank() {
    const g = this.g, hour = g.hour(), wx = this.wx(), owned = new Set(g.save.lures);
    const rows = [];
    for (const [id, w] of Object.entries(this.loc.pool)) {
      const sp = SPECIES_BY_ID[id];
      if (!sp) continue;
      const d = prefDepth(sp, hour);
      const depth = d.bottom ? 8 : d.c, bottom = d.bottom ? 8 : 60;
      let best = null, bestOwn = null;
      for (const lid of Object.keys(LURES)) {
        const lure = LURES[lid];
        const f = fit(sp, { lureId: lid, lure, depth, bottom, hour, wx }).total;
        if (!best || f > best.f) best = { id: lid, f };
        if (owned.has(lid) && (!bestOwn || f > bestOwn.f)) bestOwn = { id: lid, f };
      }
      rows.push({ sp, w, depth, d, best, bestOwn, score: w * best.f });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows;
  }

  describe(r) {
    const kindId = LURE_KIND[r.best.id];
    const kind = kindId && KIND_LABEL[kindId] ? KIND_LABEL[kindId].toLowerCase() : LURES[r.best.id].name.toLowerCase();
    const depth = r.d.bottom ? 'right on the bottom' : r.d.c < 1.3 ? 'in the top metre' : `about ${Math.round(r.d.c)} m down`;
    return { kind, depth, lure: LURES[r.best.id].name };
  }

  tip(k, st) {
    const g = this.g, tier = this.tier(k), rows = this.rank();
    const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, n) => o[n] ?? '');
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const step = st.tip++;
    if (!rows.length || rows[0].best.f < 0.05) return TIPS.none;
    const top = rows[0], dsc = this.describe(top);
    if (step === 0) {
      let s = cap(fill(pick(Math.random, TIPS.main), { sp: top.sp.name, kind: dsc.kind, depth: dsc.depth }));
      if (tier >= 2) {
        const own = top.bestOwn;
        if (own && own.f >= top.best.f * 0.7) s += ' ' + fill(pick(Math.random, TIPS.insider), { lure: LURES[own.id].name });
        else s += ' ' + fill(TIPS.noLure, { lure: dsc.lure });
      }
      return s;
    }
    if (step === 1 && rows[1] && rows[1].best.f >= 0.05) {
      const d2 = this.describe(rows[1]);
      return cap(fill(pick(Math.random, TIPS.second), { sp: rows[1].sp.name, kind: d2.kind, depth: d2.depth }));
    }
    if (step > 2) return pick(Math.random, GENERIC.nothing);
    // timing and weather, for the species at the top
    const hour = g.hour(), wx = this.wx();
    let bestH = 0, bestV = 0;
    for (let h = 0; h < 24; h += 0.5) { const v = timeFit(top.sp, h); if (v > bestV) { bestV = v; bestH = h; } }
    const now = timeFit(top.sp, hour);
    const out = [];
    if (now >= bestV * 0.9) out.push(TIPS.timeNow);
    else out.push(fill(TIPS.timeBetter, { when: bestH < 5.2 || bestH > 20.6 ? 'after dark' : bestH < 8.5 ? 'at dawn' : bestH > 17.2 ? 'at dusk' : 'in the middle of the day', now: 'Right now' }));
    const WXN = { clear: 'clear sky', partly: 'broken cloud', overcast: 'grey sky', rain: 'rain', storm: 'weather' };
    const wf = weatherFit(top.sp, wx);
    const wmax = Math.max(...['clear', 'partly', 'overcast', 'rain'].map((w) => weatherFit(top.sp, w)));
    if (wf < wmax * 0.7) out.push(fill(TIPS.wxBad, { wx: WXN[wx] }));
    else if (wf >= wmax * 0.98 && (wx === 'rain' || wx === 'overcast')) out.push(fill(TIPS.wxGood, { wx: WXN[wx] }));
    return out.join(' ');
  }
}

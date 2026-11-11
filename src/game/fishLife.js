import * as THREE from 'three';
import { SPECIES_BY_ID, rollMorph, rollWeight } from './species.js';
import { LURES } from './gear.js';
import { fit } from './bait.js';
import { buildFish, fishLengthM } from './fishMesh.js';
import { TUNE as T } from './fishTune.js';
import { BaitBalls } from './baitBalls.js';

// Visible fish. A handful of real fish models swim around the player (cap T.maxActors), as many as
// the water clarity lets you see. They cruise, notice the lure by species size / lure match, follow,
// inspect, nudge, turn away or strike (the strike hands over to Fishing as an ordinary bite), and
// spook from boat noise, fast walking, shadows and big splashes. Bait balls / boils: baitBalls.js.
// All numbers: fishTune.js. No per-frame allocations in the update paths.
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const ss = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
const rr = (r) => r[0] + Math.random() * (r[1] - r[0]);
const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const SCHOOL = new Set(T.schooling);

const traitCache = new Map();
function traits(sp) {
  let t = traitCache.get(sp.id);
  if (!t) {
    const hunts = [...T.predatorDiet].some((ch) => sp.diet.includes(ch)) && sp.lb[1] >= T.predatorMinLb;
    const aggr = clamp(0.28 + 0.45 * sp.fight + (/[mq]/.test(sp.diet) ? 0.15 : 0) + (hash01(sp.id + 'a') - 0.5) * 0.25, 0.1, 1);
    t = { aggr, hunts, school: SCHOOL.has(sp.body) && sp.lb[1] < 12, bottom: sp.depth === 'b', top: sp.depth === 's' };
    traitCache.set(sp.id, t);
  }
  return t;
}

export class FishLife {
  constructor(game) {
    this.g = game;
    this.loc = game.loc;
    this.cam = game.camera.position;
    this.actors = [];
    for (let i = 0; i < T.maxActors; i++) this.actors.push(this.blank());
    this.pool = [];
    let sum = 0;
    for (const [id, w] of Object.entries(this.loc.pool || {})) {
      const sp = SPECIES_BY_ID[id];
      if (!sp) continue;
      const ww = w / (1 + sp.lb[1] / T.spawn.sizeSoft);
      sum += ww;
      this.pool.push({ sp, w: ww, c: sum });
    }
    this.poolSum = sum;
    this.free = new Map();
    this.freeCount = 0;
    this.buildT = 0;
    this.spawnT = 1;
    this.time = 0;
    this.vis = 10;
    this.visT = 0;
    this.sea = 0;
    this.nEng = 0;
    this.focus = null;   // fish cam: { depth, x, z } of the camera while it hangs under the boat (fishcam.js)
    this.maxY = T.spawn.maxY;
    this.pendingTake = null;
    this.swirlT = 0;
    this.cond = { lureId: '', lure: null, depth: 0, bottom: 5, hour: 12, wx: 'partly' };
    this.L = { on: false, x: 0, y: 0, z: 0, px: 0, pz: 0, speed: 0, moving: false, still: 0, active: false, surface: false };
    this.group = new THREE.Group();
    this.group.name = 'fishlife';
    game.scene.add(this.group);
    this.balls = new BaitBalls(this);
  }

  blank() {
    return {
      on: false, id: 0, sp: null, morph: null, lb: 1, len: 0.3, tr: null, model: null, key: '',
      x: 0, y: -1, z: 0, hd: 0, speed: 0, vy: 0, state: 'cruise', st: 0, wander: 0, wantHd: 0, homeY: -1,
      leader: null, ox: 0, oz: 0, q: 0, qT: 0, cool: 0, intr: 0, gap: 1, mode: 'strike', nib: 0,
      flare: 0, shake: 0, nudge: 0, wary: 0, beat: 0, scale: 0, ht: null, hang: false, lungeT: 0, aware: 0, wasMoving: false,
    };
  }

  // ---- public hooks (Fishing / Game) ------------------------------------------------------
  engaged() { return this.nEng > 0; }
  consumeTake() { const t = this.pendingTake; this.pendingTake = null; return t; }
  boilNear(x, z, r = T.balls.hotRadius) { return this.balls.hot(x, z, r); }

  // splash / noise heard by fish near (x,z); loud = amp * size of the splash
  noise(x, z, loud) {
    if (!T.enabled || loud <= 0.004) return;
    const r = Math.min(T.spook.splashMax, T.spook.splashRadius * loud);
    for (const a of this.actors) {
      if (!a.on || a.state === 'mouth') continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < r * (1 - T.spook.bold * a.tr.aggr * 0.5) && (a.y > -T.spook.shadowDepth * 2 || loud > 0.05)) this.spook(a, x, z, 1);
    }
  }

  // cues from Fishing's bite sequence
  cue(a, what) {
    if (!a || !a.on) return;
    if (what === 'nudge') { a.nudge = 1; a.flare = 0.6; }
    else if (what === 'strike') { a.shake = 1; a.flare = 1; this.swirl(a.x, a.z, a.y > -0.7 ? 0.05 : 0.02, 0.4); }
    else if (what === 'hooked') this.release(a);
    else if (what === 'spit') { a.state = 'refuse'; a.st = 1.6; a.cool = rr(T.interest.refuseCool); a.hd += Math.PI * (0.7 + Math.random() * 0.3); a.flare = 0.8; this.nEngRecount(); }
    else if (what === 'spook') this.spook(a, a.x - Math.cos(a.hd), a.z + Math.sin(a.hd), 1);
  }

  // ---- per frame -------------------------------------------------------------------------
  update(dt, player) {
    if (!T.enabled) return;
    const g = this.g;
    this.time += dt;
    this.buildT -= dt;
    this.swirlT -= dt;
    this.visT -= dt;
    if (this.visT <= 0) { this.visT = 0.5; this.vis = this.visibility(); }
    this.lureTick(dt);
    this.maxY = Math.max(T.spawn.maxY, this.focus ? this.focus.depth + 14 : 0, this.L.on ? -this.L.y + 3 : 0);
    this.threatTick();
    // spawn
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = T.spawn.interval; this.trySpawn(); }
    let eng = 0;
    for (const a of this.actors) {
      if (!a.on) continue;
      this.step(a, dt, player);
      if (a.state === 'follow' || a.state === 'inspect' || a.state === 'lunge' || a.state === 'mouth') eng++;
    }
    this.nEng = eng;
    this.balls.update(dt, player);
  }

  visibility() {
    const g = this.g, wl = this.loc.waterLook || {};
    let v = lerp(T.vis.clear, T.vis.murky, ss(wl.turbidity ?? 0.2, T.vis.turbLo, T.vis.turbHi));
    v *= lerp(1, T.vis.night, clamp(g.nightLevel ? g.nightLevel() : 0, 0, 1));
    if (g.weather) {
      if (g.weather.ev?.kind === 'fog') v *= lerp(1, T.vis.fog, 0.8);
      if (g.weather.id === 'rain') v *= T.vis.rain;
    }
    return v;
  }

  // lure state from Fishing (cached numbers, no allocation)
  lureTick(dt) {
    const f = this.g.fishing, L = this.L, c = this.cond;
    const on = f.state === 'water' || f.state === 'bite';
    if (!on) { L.on = false; L.speed = 0; L.moving = false; return; }
    const gear = f.gear;
    this.sea = 0;
    const x = f.lure.x, z = f.lure.z, y = this.sea - f.depth;
    L.speed = L.on ? Math.hypot(x - L.px, z - L.pz) / Math.max(dt, 1e-3) : 0;
    L.px = x; L.pz = z; L.x = x; L.z = z; L.y = Math.min(y, -0.02);
    const moving = L.speed > 0.3;
    L.moving = moving;
    L.still = moving ? 0 : L.still + dt;
    L.on = true;
    L.active = !!gear.lure.active;
    L.surface = f.depth < 0.35 && !gear.lure.bobber;
    c.lureId = (f.gearOverride || this.g.save.equip).lure;
    c.lure = LURES[c.lureId] || gear.lure;
    c.depth = gear.lure.bobber ? Math.min(f.depth, 1.8) : f.depth;
    c.bottom = Math.max(0.3, -this.g.heightAt(x, z));
    c.hour = this.g.hour();
    c.wx = this.g.weather ? (this.g.weather.L > 0.3 ? 'storm' : this.g.weather.id) : 'partly';
  }

  // what is making noise / casting a shadow this frame
  threatTick() {
    const g = this.g, th = this.th || (this.th = { x: 0, z: 0, r: 0, shadow: 0, walk: 0 });
    const bp = g.foot ? g.footPos : g.boat.position;
    th.x = bp.x; th.z = bp.z;
    const sp = g.boatSpeed();
    th.r = sp > T.spook.boatMin ? Math.min(T.spook.boatRadiusMax, T.spook.boatNoise * sp * 3.2) * (g.boatSpec?.().quiet ?? 1) * (g.boat.engineOn === false ? 0.3 : 1) : 0;   // a paddled kayak barely disturbs fish
    th.shadow = g.foot ? 0.9 : g.boat.hull.length * T.spook.boatHullScale * 0.5;
    th.walk = g.foot && (g.foot.speed || 0) > T.spook.walkerSpeed ? T.spook.walkerRadius * Math.min(1.5, g.foot.speed / 3) : 0;
  }

  nEngRecount() { /* engaged count is rebuilt every frame */ }

  // ---- spawning --------------------------------------------------------------------------
  trySpawn() {
    if (!this.poolSum) return;
    let live = 0, free = null;
    for (const a of this.actors) { if (a.on) live++; else if (!free) free = a; }
    const want = Math.max(1, Math.round(T.spawn.countClear * clamp(this.vis / T.vis.clear, 0.12, 1)));
    if (!free || live >= Math.min(want, T.maxActors) || this.buildT > 0) return;
    const g = this.g, cam = this.cam, H = g.heightAt;
    if (this.focus) { this.trySpawnDeep(free); return; }
    // pick a species
    let r = Math.random() * this.poolSum, pick = this.pool[this.pool.length - 1];
    for (const p of this.pool) { if (r <= p.c) { pick = p; break; } }
    const sp = pick.sp, tr = traits(sp);
    const ring0 = T.spawn.ringMin, ring1 = Math.max(ring0 + 1, this.vis * T.spawn.ringFrac);
    for (let k = 0; k < 8; k++) {
      const ang = Math.random() * TAU, d = ring0 + Math.random() * (ring1 - ring0);
      const x = cam.x + Math.cos(ang) * d, z = cam.z + Math.sin(ang) * d;
      const bd = -H(x, z);
      if (bd < T.spawn.minWater) continue;
      if (tr.bottom && bd > T.spawn.bottomDwellerMax) continue;
      const n = tr.school && Math.random() < T.spawn.groupChance ? T.spawn.groupMin + Math.floor(Math.random() * (T.spawn.groupMax - T.spawn.groupMin + 1)) : 1;
      let leader = null;
      for (let i = 0; i < n; i++) {
        const a = i === 0 ? free : this.actors.find((o) => !o.on);
        if (!a) break;
        if (!this.init(a, sp, x + (Math.random() - 0.5) * (i ? 2.5 : 0), z + (Math.random() - 0.5) * (i ? 2.5 : 0), bd, leader)) { this.buildT = T.spawn.buildEvery; return; }
        if (i === 0) leader = a;
      }
      this.buildT = T.spawn.buildEvery;
      return;
    }
  }

  // fish cam hanging at depth d: species weighted by how well d suits them (bait.js depth factor + habitat band),
  // placed around the camera (or half of them around the lure when it is close), at about the camera's depth
  trySpawnDeep(free) {
    const g = this.g, H = g.heightAt, d = this.focus.depth, L = this.L;
    const useLure = L.on && Math.random() < 0.5 && Math.hypot(L.x - this.cam.x, L.z - this.cam.z) < this.vis * 1.2;
    const cx = useLure ? L.x : this.cam.x, cz = useLure ? L.z : this.cam.z, cy = useLure ? L.y : -d;
    const ring1 = Math.max(4, this.vis * 0.8);
    for (let k = 0; k < 8; k++) {
      const ang = Math.random() * TAU, r = (useLure ? 1.5 : 4) + Math.random() * ring1;
      const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r, bd = -H(x, z);
      if (bd < 1.5 || bd < -cy + 0.4) continue;
      const yy = clamp(cy + (Math.random() - 0.5) * Math.min(this.vis * 0.5, 8), -(bd - 0.4), -0.6);
      const cond = { lureId: 'jig', lure: LURES.jig, depth: -yy, bottom: bd, hour: g.hour(), wx: 'partly' };
      let sum = 0;
      const ws = this.deepW || (this.deepW = new Float32Array(this.pool.length));
      for (let i = 0; i < this.pool.length; i++) { const p = this.pool[i]; const df = fit(p.sp, cond).depth; ws[i] = p.w * df * df; sum += ws[i]; }
      if (sum <= 0) continue;
      let rr0 = Math.random() * sum, pick = this.pool[0];
      for (let i = 0; i < this.pool.length; i++) { rr0 -= ws[i]; if (rr0 <= 0) { pick = this.pool[i]; break; } }
      const sp = pick.sp, tr = traits(sp);
      if (tr.bottom && Math.abs(bd + yy) > 3) continue;
      const n = tr.school && Math.random() < T.spawn.groupChance ? T.spawn.groupMin + Math.floor(Math.random() * (T.spawn.groupMax - T.spawn.groupMin + 1)) : 1;
      let leader = null;
      for (let i = 0; i < n; i++) {
        const a = i === 0 ? free : this.actors.find((o) => !o.on);
        if (!a) break;
        if (!this.init(a, sp, x + (Math.random() - 0.5) * (i ? 2.5 : 0), z + (Math.random() - 0.5) * (i ? 2.5 : 0), bd, leader, undefined, yy)) { this.buildT = T.spawn.buildEvery; return; }
        if (i === 0) leader = a;
      }
      this.buildT = T.spawn.buildEvery;
      return;
    }
  }

  // set an actor up as a fresh fish of species sp at (x, z); false if the model could not be had yet
  init(a, sp, x, z, bd, leader, lbForce, yFix) {
    const morph = rollMorph(Math.random, 1);
    const model = this.acquire(sp, morph);
    if (!model) return false;
    const lb = lbForce || rollWeight(sp, Math.random, 1);
    const tr = traits(sp);
    Object.assign(a, this.blank(), { id: (a.id | 0) + 1 });
    a.on = true; a.sp = sp; a.morph = morph; a.lb = lb; a.tr = tr; a.model = model; a.key = sp.id + ':' + morph.id;
    a.len = fishLengthM(sp, lb).m;
    a.x = x; a.z = z; a.hd = Math.random() * TAU;
    const top = -0.5 - Math.random() * Math.max(0.2, Math.min(T.spawn.maxY, bd - 0.8, this.vis * 0.7));
    a.homeY = tr.bottom ? -bd + a.len * 0.4 : yFix !== undefined ? yFix : tr.top ? -0.3 - Math.random() * 0.8 : top;
    a.y = a.homeY;
    a.speed = a.len * T.swim.cruiseBL;
    a.wander = rr(T.swim.wander);
    a.leader = leader;
    if (leader) { a.ox = -(0.8 + Math.random() * 1.8) * Math.max(0.3, a.len * 2); a.oz = (Math.random() - 0.5) * 2.4; a.hd = leader.hd; a.y = leader.y + (Math.random() - 0.5) * 0.6; a.homeY = a.y; }
    model.group.rotation.order = 'YZX';
    model.group.visible = true;
    this.group.add(model.group);
    a.scale = 0;
    return true;
  }

  acquire(sp, morph) {
    const key = sp.id + ':' + morph.id;
    const list = this.free.get(key);
    if (list && list.length) { this.freeCount--; return list.pop(); }
    const m = buildFish(sp, morph, { patchProp: this.g.patchProp });
    m.key = key;
    m.group.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
    return m;
  }

  release(a) {
    if (!a.on) return;
    a.on = false;
    const m = a.model;
    if (!m) return;
    this.group.remove(m.group);
    m.group.visible = false;
    let list = this.free.get(m.key);
    if (!list) { list = []; this.free.set(m.key, list); }
    if (list.length < 2) { list.push(m); this.freeCount++; } else this.dispose(m);
    if (this.freeCount > 14) {
      for (const [k, l] of this.free) { if (l.length) { this.dispose(l.pop()); this.freeCount--; break; } if (!l.length) this.free.delete(k); }
    }
    a.model = null;
    if (this.pendingTake && this.pendingTake.a === a) this.pendingTake = null;
  }

  dispose(m) { m.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }

  // ---- spook ----------------------------------------------------------------------------
  spook(a, sx, sz, power, alarm = true) {
    if (a.state === 'spook') { a.st = Math.max(a.st, 0.6); return; }
    if (a.state === 'mouth' && this.g.fishing.state === 'bite') return;
    a.state = 'spook';
    a.st = rr(T.spook.time) * (0.6 + 0.4 * power);
    a.wantHd = Math.atan2(-(a.z - sz), a.x - sx) + (Math.random() - 0.5) * 0.8;
    a.wary = rr(T.spook.recover);
    a.flare = 0.4;
    a.speed = Math.max(a.speed, Math.min(T.swim.capMs * 1.4, a.len * T.spook.burstBL));
    if (a.y > -0.6) this.swirl(a.x, a.z, 0.02, 0.25);
    if (alarm) for (const o of this.actors) {
      if (o.on && o !== a && o.state !== 'spook' && o.state !== 'mouth' && Math.hypot(o.x - a.x, o.z - a.z) < T.spook.alarm && (o.leader === a || a.leader === o || o.leader === a.leader || Math.random() < 0.5)) this.spook(o, sx, sz, power * 0.8, false);
    }
  }

  swirl(x, z, amp, size) {
    if (this.swirlT > 0) return;
    this.swirlT = 0.12;
    const f = this.g.e.floaters;
    f.impacts.push({ x, z, t: f.time, amp, size });
    if (f.impacts.length > 8) f.impacts.shift();
  }

  // ---- lure interest quality -------------------------------------------------------------
  quality(a) {
    const total = fit(a.sp, this.cond).total;
    return ss(total, T.interest.fitPoor, T.interest.fitGood);
  }

  // ---- one fish -------------------------------------------------------------------------
  step(a, dt, player) {
    const g = this.g, L = this.L, I = T.interest, th = this.th;
    const dcx = a.x - this.cam.x, dcz = a.z - this.cam.z, dp = Math.hypot(dcx, dcz);
    // recycle fish that drifted out of sight (or out of the sim area)
    if (dp > T.simRadius || (a.state === 'cruise' && dp > this.vis * 1.3 && !a.leader)) { this.release(a); return; }
    // the fish cam changes which depth matters: swap fish that are not near the camera's depth for ones that are
    if (a.state === 'cruise' && !a.leader && (this.focus ? Math.abs(-a.y - this.focus.depth) > Math.max(7, this.vis * 0.55) : -a.y > this.maxY + 2)) { this.release(a); return; }
    a.cool -= dt; a.wary -= dt; a.qT -= dt;
    a.flare = Math.max(0, a.flare - dt * 2.2);
    a.shake = Math.max(0, a.shake - dt * 1.4);
    a.nudge = Math.max(0, a.nudge - dt * 3);
    // dead leader: carry on alone
    if (a.leader && !a.leader.on) a.leader = null;

    // threats (committed fish ignore them)
    if (a.state !== 'mouth' && a.state !== 'lunge') this.threats(a, dt);

    const f = g.fishing;
    let wantHd = a.wantHd, wantSpeed = a.len * T.swim.cruiseBL, turn = T.swim.turn, ty = a.homeY;
    let tx = 0, tz = 0, haveT = false;
    const lureOn = L.on && f.state === 'water';

    switch (a.state) {
      case 'cruise': {
        a.wander -= dt;
        if (a.wander <= 0) { a.wander = rr(T.swim.wander); a.wantHd = a.hd + (Math.random() - 0.5) * 1.6; a.homeY = clamp(a.homeY + (Math.random() - 0.5) * 0.6, -this.maxY, -0.35); if (a.tr.bottom) a.homeY = -(-g.heightAt(a.x, a.z)) + a.len * 0.4; }
        wantHd = a.wantHd;
        if (a.leader && a.leader.state !== 'spook') {
          const lh = a.leader.hd, cs = Math.cos(lh), sn = -Math.sin(lh);
          tx = a.leader.x + cs * a.ox + Math.sin(lh) * a.oz; tz = a.leader.z + sn * a.ox + Math.cos(lh) * a.oz;
          const d = Math.hypot(tx - a.x, tz - a.z);
          wantHd = d > 0.6 ? Math.atan2(-(tz - a.z), tx - a.x) : lh;
          wantSpeed = Math.max(a.leader.speed * 0.95, 0.1) + Math.min(1.5, d * 0.7);
          ty = a.leader.y + (a.oz * 0.15);
        }
        // is the lure worth a look?
        if (lureOn && a.cool <= 0 && a.wary <= 0 && !this.pendingTake) {
          if (a.qT <= 0) { a.q = this.quality(a); a.qT = I.fitRefresh; }
          const d3 = Math.hypot(L.x - a.x, L.z - a.z);
          if (d3 < this.interestRange(a) && Math.abs(L.y - a.y) < I.depthReach && Math.random() < dt * I.noticePerSec * (0.4 + a.q)) {
            a.state = 'follow'; a.st = 0; a.intr = 0; a.gap = lerp(I.followGap[1], I.followGap[0], a.tr.aggr) + a.len * 0.4; a.flare = 0.3; a.wasMoving = L.moving;
          }
        }
        break;
      }
      case 'follow': {
        if (!lureOn || this.pendingTake) { this.giveUp(a, false); break; }
        a.st += dt;
        if (a.qT <= 0) { a.q = this.quality(a); a.qT = I.fitRefresh; }
        const dx = a.x - L.x, dz = a.z - L.z, d = Math.hypot(dx, dz) + 1e-4, d3 = Math.hypot(d, a.y - L.y);
        // trail behind the lure on the side the fish is on
        tx = L.x + (dx / d) * a.gap; tz = L.z + (dz / d) * a.gap; haveT = true;
        ty = clamp(L.y, a.tr.bottom ? -(-g.heightAt(a.x, a.z)) + 0.1 : -this.maxY, -0.12);
        const maxV = Math.min(T.swim.capMs, a.len * T.swim.maxBL);
        wantSpeed = clamp(L.speed * 1.12 + 0.12 + (d - a.gap) * 0.9, a.len * 0.25, maxV);
        turn = T.swim.chaseTurn;
        a.intr += dt * (0.5 + a.q * 1.5) * (L.moving ? 1 : 0.6);
        if (d > this.interestRange(a) * 1.4 || (L.speed > maxV * 1.25 && a.tr.aggr * a.q < 0.5) || a.st > I.followLimit) { this.giveUp(a, true); break; }
        // bold fish that like it strike straight away
        if (a.tr.aggr * a.q > I.eager && d3 < 3 && a.st > 0.6 && Math.random() < dt * I.eagerPerSec) { this.decide(a, 'strike'); break; }
        const inspectAt = lerp(I.inspectAt[1], I.inspectAt[0], a.tr.aggr * a.q);
        if (d3 < a.gap * 1.6 + 0.4 && a.intr > inspectAt) { a.state = 'inspect'; a.st = rr(I.inspect) * lerp(1.2, 0.7, a.tr.aggr); a.wasMoving = L.moving; a.flare = 0.5; }
        break;
      }
      case 'inspect': {
        if (!lureOn || this.pendingTake) { this.giveUp(a, false); break; }
        a.st -= dt;
        // hang just off the lure, nose to it, a slow circle; a lure that starts moving can tip the verdict
        const ang = Math.atan2(-(L.z - a.z), L.x - a.x), d = Math.hypot(L.x - a.x, L.z - a.z);
        const hold = Math.max(0.28, a.len * 0.7);
        wantHd = ang; wantSpeed = clamp((d - hold) * 1.4, 0, a.len * 1.5); turn = T.swim.chaseTurn;
        ty = L.y;
        if (!a.wasMoving && L.moving && Math.random() < I.restartBonus) { this.decide(a, 'strike'); break; }
        a.wasMoving = L.moving;
        if (L.speed > a.len * T.swim.maxBL * 1.3 && a.tr.aggr < 0.7) { this.giveUp(a, true); break; }
        if (a.st <= 0) {
          const pTake = clamp(I.verdict.base + I.verdict.q * a.q + I.verdict.aggr * (a.tr.aggr - 0.5), 0.02, 0.97);
          if (Math.random() < pTake) this.decide(a, a.q > I.mode.strike && Math.random() < a.tr.aggr + 0.35 ? 'strike' : a.q > I.mode.tentative ? 'tentative' : 'halfhearted');
          else { a.state = 'refuse'; a.st = 1.4; a.cool = rr(I.refuseCool); a.wantHd = a.hd + Math.PI * (0.75 + Math.random() * 0.5); a.flare = 1; if (a.y > -0.9) this.swirl(a.x, a.z, 0.03, 0.35); a.speed = a.len * T.swim.strikeBL * 0.5; }
        }
        break;
      }
      case 'lunge': {
        if (!lureOn) { this.giveUp(a, false); break; }
        a.lungeT += dt;
        tx = L.x; tz = L.z; haveT = true; ty = L.y;
        wantSpeed = Math.min(T.swim.capMs * 1.2, a.len * T.swim.strikeBL); turn = 9;
        const d = Math.hypot(L.x - a.x, L.z - a.z), mouth = a.len * 0.5;
        if (d < mouth + 0.12) {
          // arrived: hand over to Fishing as a bite
          const F = T.interest;
          const nib = a.mode === 'strike' ? 1 : a.mode === 'tentative' ? Math.round(rr(F.nibbles)) : Math.round(rr(F.halfNibbles));
          this.pendingTake = { a, sp: a.sp, morph: a.morph, lb: a.lb, mode: a.mode, nibbles: Math.max(1, nib), t: a.mode === 'strike' ? 0.06 : 0.35 + Math.random() * 0.4 };
          a.state = 'mouth'; a.st = 0;
          if (L.surface || a.y > -0.5) this.swirl(L.x, L.z, a.mode === 'strike' ? 0.07 : 0.03, a.mode === 'strike' ? 0.6 : 0.3);
          a.flare = 1; a.shake = a.mode === 'strike' ? 0.8 : 0.3;
        } else if (a.lungeT > I.lungeTimeout) { this.giveUp(a, false); a.cool = rr(I.giveUpCool); }
        break;
      }
      case 'mouth': {
        if (f.state !== 'bite' && !this.pendingTake) { this.spook(a, a.x - Math.cos(a.hd), a.z + Math.sin(a.hd), 0.8); break; }
        a.speed *= 0.9;
        break;
      }
      case 'refuse': {
        a.st -= dt; wantHd = a.wantHd; wantSpeed = a.len * T.swim.strikeBL * 0.45 * Math.max(0.25, a.st); turn = T.swim.chaseTurn;
        if (a.st <= 0) { a.state = 'cruise'; a.wander = 0; }
        break;
      }
      case 'spook': {
        a.st -= dt; wantHd = a.wantHd; wantSpeed = Math.min(T.swim.capMs * 1.4, a.len * T.spook.burstBL) * Math.max(0.2, Math.min(1, a.st)); turn = 6;
        ty = a.homeY - T.spook.dive * Math.min(1, a.st) * 0.4;
        if (a.st <= 0) { a.state = 'cruise'; a.wander = 0; }
        break;
      }
      case 'hunt': {
        const b = a.ht;
        if (!b || !b.alive) { a.state = 'cruise'; break; }
        a.st += dt;
        tx = b.x; tz = b.z; haveT = true; ty = clamp(b.y, -this.maxY, -0.3);
        wantSpeed = Math.min(T.swim.capMs, a.len * T.swim.strikeBL * 0.8); turn = 6;
        if (Math.hypot(b.x - a.x, b.z - a.z) < 1.6 || a.st > 7) { if (Math.hypot(b.x - a.x, b.z - a.z) < 3.5) b.scatterNow(); a.state = 'cruise'; a.wander = 0; a.cool = 4; a.flare = 1; }
        break;
      }
      default: a.state = 'cruise';
    }

    // ---- steering and movement
    if (haveT) wantHd = Math.atan2(-(tz - a.z), tx - a.x);
    if (a.state !== 'mouth') {
      // shallows ahead: turn along the deeper side
      if (!a.tr.bottom || a.state === 'cruise') {
        const ah = a.len * 2 + 1.2, cs = Math.cos(a.hd), sn = -Math.sin(a.hd);
        const need = -a.y + 0.3;
        if (-g.heightAt(a.x + cs * ah, a.z + sn * ah) < need) {
          const l = -g.heightAt(a.x + Math.cos(a.hd + 1) * ah, a.z - Math.sin(a.hd + 1) * ah), r = -g.heightAt(a.x + Math.cos(a.hd - 1) * ah, a.z - Math.sin(a.hd - 1) * ah);
          wantHd = a.hd + (l > r ? 1.3 : -1.3); a.wantHd = wantHd; turn = Math.max(turn, 3.2); wantSpeed = Math.min(wantSpeed, a.len * 0.9);
          if (a.state === 'follow' || a.state === 'inspect' || a.state === 'lunge') { if (Math.max(l, r) < need) { this.giveUp(a, true); } }
        }
      }
      const dh = angDiff(wantHd, a.hd);
      a.hd += clamp(dh, -turn * dt, turn * dt);
      a.speed += (wantSpeed - a.speed) * Math.min(1, dt * (a.state === 'lunge' ? 9 : T.swim.accel));
      const nx = a.x + Math.cos(a.hd) * a.speed * dt, nz = a.z - Math.sin(a.hd) * a.speed * dt;
      if (-g.heightAt(nx, nz) > -a.y + 0.12) { a.x = nx; a.z = nz; } else { a.hd += Math.PI * 0.5; a.speed *= 0.5; }
      // depth
      const floor = -(-g.heightAt(a.x, a.z)) + a.len * 0.3 + 0.1;
      const topY = (a.state === 'lunge' && L.surface) ? -0.02 : -0.12;
      const yy = clamp(ty, Math.min(floor, topY), topY);
      const dy = clamp(yy - a.y, -1.4 * dt - a.speed * 0.4 * dt, 1.4 * dt + a.speed * 0.4 * dt);
      a.vy = dy / dt;
      a.y += dy;
    } else {
      // pinned to the lure, head on it
      const nx = L.x - Math.cos(a.hd) * a.len * 0.42 + Math.cos(a.hd) * -a.nudge * a.len * 0.35;
      const nz = L.z + Math.sin(a.hd) * a.len * 0.42 - Math.sin(a.hd) * -a.nudge * a.len * 0.35;
      a.x = nx; a.z = nz; a.y += (L.y - a.y) * Math.min(1, dt * 10); a.vy = 0;
      a.hd += Math.sin(this.time * 38) * 0.35 * a.shake * dt * 6;
    }
    this.draw(a, dt, dp);
  }

  // approach range for this fish and lure
  interestRange(a) {
    const I = T.interest, L = this.L;
    let m = (I.sizeLo + I.sizeHi * Math.min(1, a.len)) * (I.qLo + I.qHi * a.q);
    m *= L.moving ? I.movingMul : L.active ? I.stillActive : I.stillBait;
    if (L.speed > a.len * T.swim.maxBL) m *= I.fastMul;
    // bold species come from farther
    m *= 0.8 + 0.4 * a.tr.aggr;
    return clamp(I.base * m, I.min, I.max);
  }

  decide(a, mode) { a.state = 'lunge'; a.mode = mode; a.lungeT = 0; a.flare = 1; }

  giveUp(a, wander) {
    a.state = 'cruise'; a.wander = 0; a.cool = rr(T.interest.giveUpCool);
    if (wander) a.wantHd = a.hd + (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random());
  }

  // boat noise, shadows, walkers, thrashing fish
  threats(a, dt) {
    const th = this.th, S = T.spook;
    const bold = 1 - S.bold * a.tr.aggr, wary = a.wary > 0 ? 1.4 : 1;
    let r = th.r;
    const d = Math.hypot(a.x - th.x, a.z - th.z);
    if (th.shadow > 0 && a.y > -S.shadowDepth && d < th.shadow) r = Math.max(r, th.shadow);
    if (th.walk > r) r = th.walk;
    r *= bold * wary;
    if (r > 0 && d < r && Math.random() < dt * S.perSec) { this.spook(a, th.x, th.z, clamp(1 - d / r, 0.3, 1)); return; }
    const f = this.g.fishing;
    if (f.state === 'fight' && f.fish && f.fish.stamina < 0.4 && Math.hypot(a.x - f.fish.pos.x, a.z - f.fish.pos.z) < S.fightRadius && Math.random() < dt) this.spook(a, f.fish.pos.x, f.fish.pos.z, 0.6);
  }

  // ---- drawing --------------------------------------------------------------------------
  draw(a, dt, dp) {
    const m = a.model, G = m.group, u = m.uniforms.uSwim.value;
    const fade = a.scale = lerp(a.scale, dp > this.vis * (1 - T.fadeFrac) ? ss(this.vis - dp, 0, this.vis * T.fadeFrac) : 1, Math.min(1, dt * 3));
    const s = a.len * Math.max(0.001, fade);
    G.visible = fade > 0.02;
    if (!G.visible) return;
    G.position.set(a.x, a.y, a.z);
    const pitch = clamp(Math.atan2(a.vy, Math.max(0.3, a.speed)), -0.7, 0.7);
    G.rotation.set(m.body.flatfish ? -Math.PI / 2 : 0, a.hd, pitch);
    const fl = a.flare;
    G.scale.set(s, s * (1 + 0.06 * fl), s * (1 + 0.16 * fl));
    // tail beat follows speed in body lengths per second
    const bl = a.speed / Math.max(0.1, a.len);
    const f = clamp(T.swim.beat * (0.55 + bl * 0.55), 1.2, 11) + a.shake * 9;
    u.x += dt * TAU * f / u.z;
    u.y = lerp(T.swim.amp[0], T.swim.amp[1], clamp(bl / 5, 0, 1)) + a.shake * 0.05 + a.nudge * 0.03;
  }

  // ---- debug / testing -------------------------------------------------------------------
  // place a specific species ahead of the camera: game.fishLife.spawnAt('largemouth', 6)
  spawnAt(id, dist = 6, side = 0, lb) {
    const sp = SPECIES_BY_ID[id], cam = this.cam, g = this.g;
    const dir = g.camera.getWorldDirection(new THREE.Vector3());
    const x = cam.x + dir.x * dist - dir.z * side, z = cam.z + dir.z * dist + dir.x * side;
    const a = this.actors.find((o) => !o.on) || this.actors[0];
    if (a.on) this.release(a);
    this.buildT = 0;
    const ok = this.init(a, sp, x, z, Math.max(1.5, -g.heightAt(x, z)), null, lb);
    if (ok) a.hd = Math.atan2(-dir.z, dir.x);
    return ok ? a : null;
  }
}

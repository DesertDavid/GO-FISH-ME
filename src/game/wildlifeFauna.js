import * as THREE from 'three';
import { loadKinds, makeAnimal } from './wildlifeModels.js';

// Shore and shallow-water animals built from real models: ducks, hippos, moose, wolves, bears, perched pelicans and
// sea turtles, placed per location (see docs/asset-wishlist.md). They live around the player: anything that drifts
// more than FAR away is moved to a fresh spot, nothing beyond CULL is drawn or animated.
const FAR = 420, CULL = 300, NEAR_MIN = 30, NEAR_MAX = 230;

// kind -> [habitat, speed (m/s), clips, flee distance, size jitter]
const KIND = {
  duck: { hab: 'water', speed: 0.3, idle: 'loop', walk: 'loop', y: -0.05, jit: 0.1, group: 1 },
  duckwalk: { hab: 'land', speed: 0.4, idle: 'walk', walk: 'walk', jit: 0.1, group: 1 },
  turtle: { hab: 'deep', speed: 0.45, idle: 'swim', walk: 'swim', jit: 0.25 },
  hippo: { hab: 'shallow', speed: 0.0, idle: 'idle', jit: 0.12 },
  hippoland: { model: 'hippo', hab: 'land', speed: 0.7, idle: 'idle', walk: 'walk', jit: 0.1 },
  moose: { hab: 'land', speed: 0, jit: 0.1 },   // posed, not animated: its clips do not survive the export
  wolf: { hab: 'land', speed: 1.1, idle: 'idle', alt: 'idle2', walk: 'idle', run: 'idle', flee: 45, jit: 0.1 },
  bear: { hab: 'land', speed: 0, jit: 0.1 },
  pelican: { hab: 'land', speed: 0, jit: 0.1, face: 'water' },
  deer: { hab: 'land', speed: 0, jit: 0.1 },       // its one clip is an idle loop, so it stands and browses
  bluebird: { hab: 'land', speed: 0, idle: 'idle', jit: 0.1 },
  ray: { hab: 'bottom', speed: 0.6, idle: 'swim', walk: 'swim', jit: 0.25 },   // cruises just over a sandy bottom
};

// who lives where: [kind, count]
const SPAWN = {
  okeechobee: [['duck', 5], ['duckwalk', 2], ['deer', 2]],
  woods: [['duck', 5], ['duckwalk', 2], ['moose', 2], ['wolf', 1], ['bear', 1], ['deer', 2], ['bluebird', 2]],
  tahoe: [['duck', 4], ['duckwalk', 2], ['deer', 2], ['bluebird', 1]],
  bigbear: [['duck', 4], ['duckwalk', 2], ['deer', 3], ['bluebird', 2], ['bear', 1]],
  columbia: [['duck', 4], ['moose', 2], ['bear', 1], ['deer', 2]],
  chesapeake: [['duck', 5], ['duckwalk', 2], ['pelican', 3], ['deer', 1], ['bluebird', 2]],
  fjord: [['duck', 4], ['wolf', 1]],
  bering: [['duck', 4], ['moose', 1], ['wolf', 2], ['bear', 2]],
  kariba: [['hippo', 4], ['hippoland', 1]],
  keys: [['turtle', 3], ['pelican', 3], ['ray', 3]],
  reef: [['turtle', 3], ['ray', 3]],
  cabo: [['turtle', 2], ['pelican', 2], ['ray', 2]],
  gulf: [['turtle', 2], ['pelican', 2]],
};
const MODEL = (k) => KIND[k].model || k;
const rnd = (a, b) => a + Math.random() * (b - a);

export class Fauna {
  constructor(ctx) {
    this.ctx = ctx;
    this.list = [];
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
    this.t = 0;
    const plan = SPAWN[ctx.loc.id] || [];
    if (!plan.length) return;
    this.plan = plan;
    this.total = plan.reduce((n, [, c]) => n + c, 0);
    this.topT = 0;
    this.ready = false;
    loadKinds(plan.map(([k]) => MODEL(k))).then(() => { this.ready = true; this.populate(plan, ctx.camera.position); });
  }

  depthAt(x, z) { return -this.ctx.heightAt(x, z); }

  // is (x, z) good ground for this habitat?
  fits(hab, x, z) {
    const h = this.ctx.heightAt(x, z);
    if (hab === 'land') {
      if (h < 0.3 || h > 30) return false;
      return Math.abs(this.ctx.heightAt(x + 2, z) - h) < 1.8 && Math.abs(this.ctx.heightAt(x, z + 2) - h) < 1.8;
    }
    const d = -h;
    if (hab === 'water') return d > 0.5 && d < 8;
    if (hab === 'shallow') return d > 0.7 && d < 15;   // deeper than they can stand in: they float with the back awash
    if (hab === 'bottom') return d > 1.2 && d < 8;
    return d > 4;   // deep
  }

  // a spot near the player that fits; land animals must also be within ~50 m of water (shore, not the hills)
  pick(hab, c) {
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2, r = rnd(NEAR_MIN, NEAR_MAX * (1 + i / 150));   // widen the search if the close water is no good
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (!this.fits(hab, x, z)) continue;
      if (hab === 'land') {
        const want = 'water';
        let ok = false;
        for (let k = 0; k < 8 && !ok; k++) {
          const b = (k / 8) * Math.PI * 2;
          for (const dd of [12, 30, 55]) {
            const px = x + Math.cos(b) * dd, pz = z + Math.sin(b) * dd, h = this.ctx.heightAt(px, pz);
            if (want === 'water' ? h < -0.6 : h > 0.3) { ok = true; break; }
          }
        }
        if (!ok) continue;
      }
      return { x, z };
    }
    return null;
  }

  // add whatever is still missing of the plan (nothing fits near a mid-lake start, so it keeps trying as the player travels)
  populate(plan, c) {
    for (const [kind, n] of plan) {
      const cfg = KIND[kind];
      let home = null;
      const have = this.list.filter((e) => e.kind === kind).length;
      for (let i = have; i < n; i++) {
        const an = makeAnimal(MODEL(kind), this.ctx.patchProp);
        if (!an) break;
        // ducks, hippos and wolves keep company: the first of a kind picks the spot, the rest settle near it
        if (!home || !(cfg.group || kind === 'hippo' || kind === 'wolf' || kind === 'pelican' || kind === 'duckwalk')) home = this.pick(cfg.hab, c);
        if (!home) { break; }
        const s = 1 + rnd(-cfg.jit, cfg.jit);
        an.root.scale.setScalar(s);
        this.group.add(an.root);
        const e = { kind, cfg, an, x: home.x, z: home.z, heading: Math.random() * Math.PI * 2, vh: 0, state: 'idle', timer: rnd(2, 8), tx: 0, tz: 0, bob: Math.random() * 10 };
        const spread = rnd(0, kind === 'turtle' ? 0 : 7);
        const a = Math.random() * Math.PI * 2;
        const x = home.x + Math.cos(a) * spread, z = home.z + Math.sin(a) * spread;
        if (this.fits(cfg.hab, x, z)) { e.x = x; e.z = z; }
        if (cfg.face === 'water') this.faceWater(e);
        e.vh = e.heading;
        this.place(e);
        an.play(cfg.idle || '', 0);
        if (an.mixer) an.mixer.setTime(Math.random() * 3);
        this.list.push(e);
      }
    }
  }

  faceWater(e) {
    let best = e.heading;
    for (let k = 0; k < 16; k++) {
      const b = (k / 16) * Math.PI * 2;
      if (this.ctx.heightAt(e.x + Math.cos(b) * 15, e.z - Math.sin(b) * 15) < -0.5) { best = b; break; }
    }
    e.heading = best;
  }

  place(e) {
    const o = e.an.root, cfg = e.cfg;
    let y;
    if (cfg.hab === 'land') y = this.ctx.heightAt(e.x, e.z);
    else if (cfg.hab === 'shallow') y = Math.max(this.ctx.heightAt(e.x, e.z), -1.25) + Math.sin(this.t * 0.8 + e.bob) * 0.03;
    else if (cfg.hab === 'water') y = (cfg.y ?? -0.05) + Math.sin(this.t * 1.3 + e.bob) * 0.02;
    else if (cfg.hab === 'bottom') y = this.ctx.heightAt(e.x, e.z) + 0.45 + Math.sin(this.t * 0.5 + e.bob) * 0.05;
    else y = -(1.1 + 0.5 * Math.sin(this.t * 0.2 + e.bob));
    o.position.set(e.x, y, e.z);
    o.rotation.y = e.vh;
  }

  update(dt, center) {
    if (this.ready && this.list.length < this.total && (this.topT -= dt) <= 0) { this.topT = 6; this.populate(this.plan, center); }
    if (!this.list.length) return;
    this.t += dt;
    for (const e of this.list) {
      const dx = e.x - center.x, dz = e.z - center.z, d = Math.hypot(dx, dz);
      if (d > FAR && (e.relocT = (e.relocT || 0) - dt) <= 0) {   // the player moved on: find this animal a new home near them
        e.relocT = 4;
        const p = this.pick(e.cfg.hab, center);
        if (p) { e.x = p.x; e.z = p.z; e.state = 'idle'; e.timer = rnd(1, 4); }
      }
      const vis = d < CULL;
      e.an.root.visible = vis;
      if (!vis) continue;
      this.think(e, dt, d, dx, dz);
      let da = e.heading - e.vh;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      e.vh += da * Math.min(1, dt * 3);
      this.place(e);
      if (e.an.mixer) e.an.mixer.update(dt);
    }
  }

  think(e, dt, d, dx, dz) {
    const cfg = e.cfg;
    if (!cfg.speed) return;
    e.timer -= dt;
    // spooked: land animals bolt away from a boat or angler that gets close
    if (cfg.flee && d < cfg.flee && e.state !== 'flee') {
      e.state = 'flee'; e.timer = rnd(4, 8);
      e.heading = Math.atan2(-dz, dx) + rnd(-0.5, 0.5);
      e.an.play(cfg.run || cfg.walk, 0.25);
    }
    if (e.state === 'idle' && e.timer <= 0) {
      if (Math.random() < 0.5 && cfg.alt && e.an.clips.includes(cfg.alt)) { e.an.play(Math.random() < 0.5 ? cfg.alt : cfg.idle); e.timer = rnd(6, 14); return; }
      e.state = 'walk'; e.timer = rnd(4, 12);
      e.heading += rnd(-1.4, 1.4);
      e.an.play(cfg.walk || cfg.idle);
    } else if (e.state !== 'idle' && e.timer <= 0) {
      e.state = 'idle'; e.timer = rnd(4, 12);
      e.an.play(cfg.idle);
    }
    if (e.state === 'idle') return;
    const sp = (e.state === 'flee' ? cfg.speed * 4 : cfg.speed) * dt;
    const nx = e.x + Math.cos(e.heading) * sp, nz = e.z - Math.sin(e.heading) * sp;
    if (this.fits(cfg.hab, nx, nz)) {
      e.x = nx; e.z = nz;
      if ((cfg.hab === 'deep' || cfg.hab === 'bottom') && Math.random() < dt * 0.4) e.heading += rnd(-0.5, 0.5);
    } else {   // blocked by the shoreline: turn away and rest
      e.heading += Math.PI * rnd(0.6, 1.2);
      if (e.state === 'flee') { e.state = 'idle'; e.timer = rnd(3, 6); e.an.play(cfg.idle); }
    }
  }
}

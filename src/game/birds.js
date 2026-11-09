import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, hashStr, paint, limb } from './shorelife.js';

// Shore and sea birds. wildlife.js has no birds and scenery.js only has gulls circling the
// bait hotspots, so this adds what was missing, per location:
//  - herons / egrets wading the shallows: stand, stalk, strike (ripple), lift off when you
//    come close and settle somewhere else along the shore
//  - pelicans patrolling low over the water and plunge-diving on bait balls / surfacing fish
//  - gulls perched on dock lamps and pilings that scatter when you walk up, and (borrowed
//    from the scenery flocks) gulls that peel off a hotspot circle and dive on the bait.
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;

// who lives where
const WADERS = { okeechobee: ['egret', 'heron'], woods: ['heron'], tahoe: ['heron'], columbia: ['heron'], chesapeake: ['heron'], keys: ['egret', 'heron'], amazon: ['egret'], kariba: ['heron', 'egret'], mekong: ['egret', 'heron'], fjord: ['heron'] };
const PELICANS = { keys: 'brown', gulf: 'brown', cabo: 'brown', chesapeake: 'brown', okeechobee: 'white', reef: 'white' };
const NO_GULLS = new Set(['amazon', 'mekong', 'kariba']);

function ell(rx, ry, rz, at, top, belly) {
  const g = new THREE.SphereGeometry(1, 9, 6).scale(rx, ry, rz).translate(...at);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(top), b = new THREE.Color(belly), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { t.copy(b).lerp(a, clamp(((p.getY(i) - at[1]) / ry + 0.4) / 0.9, 0, 1)); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const n = g.toNonIndexed(); n.deleteAttribute('uv');
  return n;
}
function wingGeo(span, chord, hex, tipHex) {
  const mk = (pts, c) => { const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)))); g.rotateX(Math.PI / 2); return paint(g, c); };
  const root = mk([[chord * 0.45, 0], [-chord * 0.5, 0], [-chord * 0.7, span * 0.62], [chord * 0.05, span * 0.62]], hex);
  const tip = mk([[chord * 0.05, span * 0.6], [-chord * 0.7, span * 0.6], [-chord * 0.55, span], [-chord * 0.1, span * 1.02]], tipHex);
  return mergeGeometries([root, tip]);
}

const SPEC = {
  gull: { body: [0.22, 0.09, 0.085], top: 0x9ea8ae, belly: 0xf4f4f2, wing: [0.5, 0.17], wc: 0x9ea8ae, tip: 0x2a2a2e, stand: 0.07, beak: 0xe8b030, bl: 0.07, neck: 0.04, legs: 0.07, legc: 0xd08a70, size: 1 },
  heron: { body: [0.26, 0.1, 0.085], top: 0x7f8f9f, belly: 0xc6ccd0, wing: [0.86, 0.3], wc: 0x7f8f9f, tip: 0x2a3036, stand: 0.62, beak: 0xd6b048, bl: 0.17, neck: 0.45, legs: 0.6, legc: 0x8a7a50, size: 1 },
  egret: { body: [0.22, 0.085, 0.07], top: 0xf2f2ee, belly: 0xf6f6f2, wing: [0.7, 0.26], wc: 0xf2f2ee, tip: 0xe8e8e2, stand: 0.5, beak: 0xe6c040, bl: 0.13, neck: 0.38, legs: 0.5, legc: 0x26261e, size: 1 },
  brown: { body: [0.42, 0.16, 0.14], top: 0x6e6860, belly: 0x4c4842, wing: [1.05, 0.4], wc: 0x6e6860, tip: 0x35322e, stand: 0.1, beak: 0xa89470, bl: 0.4, neck: 0.3, legs: 0.08, legc: 0x3a3630, head: 0xf2edd0, size: 1 },
  white: { body: [0.42, 0.16, 0.14], top: 0xf4f2ec, belly: 0xf8f6f0, wing: [1.1, 0.4], wc: 0xf4f2ec, tip: 0x26262a, stand: 0.1, beak: 0xe2a860, bl: 0.42, neck: 0.3, legs: 0.08, legc: 0xe09860, head: 0xf8f6ee, size: 1 },
};

function buildBird(kind) {
  const s = SPEC[kind], root = new THREE.Group();
  const [rx, ry, rz] = s.body;
  root.add(new THREE.Mesh(mergeGeometries([ell(rx, ry, rz, [0, 0, 0], s.top, s.belly), ell(rx * 0.5, ry * 0.7, rz * 0.9, [-rx * 0.85, -0.01, 0], s.top, s.belly)])));   // body + rump/tail base
  const tailLen = s.wing[1] * 0.9;
  root.add(new THREE.Mesh(paint(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.03), new THREE.Vector2(-tailLen, 0.07), new THREE.Vector2(-tailLen, -0.02)])).translate(-rx * 1.2, 0, 0), s.tip === 0xe8e8e2 ? s.top : kind === 'gull' ? 0xf4f4f2 : s.tip)));
  // neck: an S-curve for herons/egrets, short and tucked back for gulls/pelicans
  const neck = new THREE.Group();
  neck.position.set(rx * 0.8, ry * 0.2, 0);
  const nl = s.neck, hc = s.head || s.top;
  let np;
  if (kind === 'heron' || kind === 'egret') np = [[0, 0, 0], [nl * 0.18, nl * 0.35, 0], [-nl * 0.02, nl * 0.65, 0], [nl * 0.22, nl * 0.95, 0]];
  else np = [[0, 0, 0], [nl * 0.2, nl * 0.35, 0], [nl * 0.4, nl * 0.5, 0]];
  const nParts = [];
  for (let i = 0; i < np.length - 1; i++) nParts.push(limb(np[i], np[i + 1], kind === 'brown' || kind === 'white' ? 0.06 : 0.04, 0.032, kind === 'heron' ? 0xb4b8bc : kind === 'brown' ? 0xf2edd0 : s.belly));
  const e = np[np.length - 1];
  nParts.push(paint(new THREE.SphereGeometry(kind === 'gull' ? 0.065 : 0.05, 7, 5).translate(e[0] + 0.02, e[1] + 0.01, 0), hc === s.top && kind === 'heron' ? 0xe8eaec : hc));
  nParts.push(limb([e[0] + 0.05, e[1], 0], [e[0] + 0.05 + s.bl, e[1] - 0.012, 0], 0.022, 0.006, s.beak));
  if (kind === 'brown' || kind === 'white') nParts.push(paint(new THREE.ConeGeometry(0.05, s.bl * 0.9, 6).rotateZ(Math.PI / 2).scale(1, 1, 1.3).translate(e[0] + 0.05 + s.bl * 0.45, e[1] - 0.045, 0), s.beak, 0.92));
  neck.add(new THREE.Mesh(mergeGeometries(nParts)));
  root.add(neck);
  // legs
  const legs = new THREE.Group();
  legs.position.set(-0.02, -ry * 0.6, 0);
  const lp = [];
  for (const z of [-0.04, 0.04]) { lp.push(limb([0, 0, z], [0.02, -s.legs, z], 0.011, 0.008, s.legc, 5)); lp.push(paint(new THREE.BoxGeometry(0.1 * (s.legs > 0.3 ? 1.3 : 1), 0.008, 0.02).translate(0.05, -s.legs, z), s.legc)); }
  legs.add(new THREE.Mesh(mergeGeometries(lp)));
  root.add(legs);
  // wings, hinged at the shoulders
  const wg = wingGeo(s.wing[0], s.wing[1], s.wc, s.tip);
  const wl = new THREE.Group(), wr = new THREE.Group();
  wl.position.set(rx * 0.25, ry * 0.5, rz * 0.6); wr.position.set(rx * 0.25, ry * 0.5, -rz * 0.6);
  wl.add(new THREE.Mesh(wg)); wr.add(new THREE.Mesh(wg)); wr.scale.z = -1;
  root.add(wl, wr);
  const sc = kind === 'brown' || kind === 'white' ? 1.15 : 1;
  root.scale.setScalar(sc);
  return { root, neck, legs, wl, wr, s, kind, scale: sc };
}

function flap(b, ph, amp, base = 0.1) { const a = -(Math.sin(ph) * amp + base * amp); b.wl.rotation.x = a; b.wr.rotation.x = -a; b.wl.scale.z = b.wr.scale.z = 1; b.wr.scale.z = -1; }
function fold(b) { b.wl.rotation.x = 1.35; b.wr.rotation.x = -1.35; b.wl.scale.z = 0.38; b.wr.scale.z = -0.38; }
const shortAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Birds {
  constructor(game) {
    this.g = game;
    this.loc = game.loc;
    this.group = new THREE.Group();
    this.group.name = 'birds';
    game.scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
    game.patchProp(this.mat);
    this.birds = [];
    this.time = 0;
    this.rand = rng(hashStr(this.loc.id) + 93);
    this.spots = [];
  }

  add(kind, x, y, z, heading) {
    const m = buildBird(kind);
    m.root.traverse((o) => { if (o.isMesh) { o.material = this.mat; o.layers.enable(1); } });
    m.root.rotation.order = 'YZX';
    this.group.add(m.root);
    const b = { m, kind, x, y, z, heading, pitch: 0, state: 'stand', t: 0, dur: 5, ph: this.rand() * 10, home: { x, y, z }, vis: true };
    fold(m);
    this.birds.push(b);
    return b;
  }

  init() {
    const g = this.g, H = g.heightAt, r = this.rand, id = this.loc.id, st = g.start;
    // wader spots: ankle-deep water at a shore edge, clear of docks, trees and the spawn point
    const kinds = WADERS[id] || [];
    if (kinds.length) {
      for (let tries = 0; tries < 1500 && this.spots.length < 12; tries++) {
        const a = r() * Math.PI * 2, rad = 25 + r() * 450;
        const x = st.x + Math.cos(a) * rad, z = st.z + Math.sin(a) * rad, h = H(x, z);
        if (h > -0.08 || h < -0.5) continue;
        let shore = false;
        for (let k = 0; k < 8 && !shore; k++) { const aa = k * Math.PI / 4; if (H(x + Math.cos(aa) * 9, z + Math.sin(aa) * 9) > 0.15) shore = true; }
        if (!shore) continue;
        if (g.docks.list.some((d) => Math.hypot(d.x - x, d.z - z) < 25)) continue;
        if (g.obstacles.list.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.5)) continue;
        this.spots.push({ x, z, y: h });
      }
      const n = Math.min(this.spots.length, id === 'fjord' ? 2 : 3 + (this.loc.water === 'river' ? 1 : 0));
      for (let i = 0; i < n; i++) {
        const s = this.spots[i], b = this.add(kinds[i % kinds.length], s.x, s.y, s.z, r() * Math.PI * 2);
        b.wader = true; b.spot = i; b.dur = 3 + r() * 8;
      }
    }
    // gulls (or egrets inland in the tropics) on dock lamps and corner pilings
    const perchKind = NO_GULLS.has(id) ? 'egret' : 'gull';
    g.docks.list.forEach((d, i) => {
      if (this.loc.water === 'offshore' && i > 0) return;
      const L = d.len, top = d.deck, spots = [];
      spots.push([d.lamp.x, top + 2.9, d.lamp.z, 0.04]);
      for (const v of [-3, 3]) { const p = d.toWorld(L + 3.5, v); spots.push([p.x, top + 0.63, p.z, 0.04]); }
      const n = r() < 0.5 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const s = spots[(i + k) % spots.length];
        const kd = perchKind === 'egret' ? 'egret' : 'gull';
        const hd = Math.atan2(-(s[2] - d.z), s[0] - d.x);   // facing out to sea
        const b = this.add(kd, s[0], s[1] + (kd === 'egret' ? 0.5 : 0.07), s[2], hd);
        b.perch = true; b.dur = 20 + r() * 30; b.lift = kd === 'egret' ? 0.5 : 0.07;
      }
    });
    // pelicans
    const pk = PELICANS[id];
    if (pk) for (let i = 0; i < (id === 'gulf' || id === 'reef' ? 2 : 3); i++) {
      const p = this.waterPoint(st.x, st.z, 80, 380, 3);
      if (!p) continue;
      const b = this.add(pk, p.x, 6, p.z, r() * 6.28);
      b.pelican = true; b.state = 'patrol'; b.tgt = this.waterPoint(p.x, p.z, 60, 220, 3) || p; b.alt = 5 + r() * 4; b.speed = 8 + r() * 2; b.t = 0;
      fold(b.m);
    }
    // gull flocks borrowed from the hotspots keep their own circles; we only add the dives
    this.hot = g.hotspots.spots;
    this.hot.forEach((sp) => { sp.dive = 4 + r() * 8; for (const gl of sp.gulls) gl.rotation.order = 'YZX'; });
  }

  waterPoint(cx, cz, rMin, rMax, minDepth) {
    const H = this.g.heightAt, r = this.rand;
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, rad = rMin + r() * (rMax - rMin), x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
      if (H(x, z) < -minDepth) return { x, z };
    }
    return null;
  }

  update(dt, player, night, camPos) {
    this.time += dt;
    const t = this.time;
    for (const b of this.birds) {
      const d = Math.hypot(b.x - camPos.x, b.z - camPos.z);
      const hide = d > (b.pelican ? 650 : 330) || (night > 0.75 && !b.pelican);
      if (hide !== !b.vis) { b.vis = !hide; b.m.root.visible = b.vis; }
      if (hide) { if (b.pelican && d > 650) this.recall(b, camPos); continue; }
      const pd = Math.hypot(b.x - player.x, b.z - player.z);
      if (b.pelican) this.pelican(b, dt, t, pd);
      else if (b.wader) this.wader(b, dt, t, pd);
      else this.perched(b, dt, t, pd);
      const m = b.m.root;
      m.position.set(b.x, b.y, b.z);
      m.rotation.set(0, b.heading, b.pitch);
    }
    this.gullDives(dt, camPos);
  }

  recall(b, cam) {
    const p = this.waterPoint(cam.x, cam.z, 150, 400, 3);
    if (p) { b.x = p.x; b.z = p.z; b.tgt = this.waterPoint(p.x, p.z, 60, 200, 3) || p; }
  }

  // ---- herons and egrets ---------------------------------------------------------------
  wader(b, dt, t, pd) {
    const m = b.m, r = this.rand, s = m.s;
    b.t += dt;
    const spot = this.spots[b.spot];
    if (b.state === 'stand' || b.state === 'stalk' || b.state === 'strike') {
      m.legs.rotation.z = 0; m.legs.visible = true; m.neck.rotation.z = 0; m.neck.scale.set(1, 1, 1);
      fold(m);
      b.y = this.g.heightAt(b.x, b.z) + s.stand + 0.02; b.pitch = 0.1;
      if (pd < 20) return this.takeoff(b);
      if (b.state === 'stand') {
        m.neck.rotation.z = Math.sin(t * 0.35 + b.ph) * 0.06;   // slow, wary
        b.heading += Math.sin(t * 0.11 + b.ph) * dt * 0.08;
        if (b.t > b.dur) { b.t = 0; const q = r(); if (q < 0.45) { b.state = 'stalk'; b.dur = 3 + r() * 3; } else if (q < 0.8) { b.state = 'strike'; b.dur = 0.9; b.hit = false; } else b.dur = 4 + r() * 8; }
      } else if (b.state === 'stalk') {
        // pick a foot up, set it down: a few slow steps through the shallows
        const nx = b.x + Math.cos(b.heading) * 0.16 * dt, nz = b.z - Math.sin(b.heading) * 0.16 * dt, h = this.g.heightAt(nx, nz);
        if (h < -0.08 && h > -0.5) { b.x = nx; b.z = nz; } else b.heading += 0.9;
        m.neck.rotation.z = -0.35; b.y += Math.sin(t * 2.2) * 0.012;
        if (b.t > b.dur) { b.t = 0; b.state = 'strike'; b.dur = 0.9; b.hit = false; }
      } else {
        const k = b.t / b.dur, lunge = Math.sin(clamp(k * 1.6, 0, 1) * Math.PI);
        m.neck.rotation.z = -1.15 * lunge; b.pitch = 0.1 + 0.4 * lunge;
        if (k > 0.35 && !b.hit) { b.hit = true; this.g.splash(b.x + Math.cos(b.heading) * 0.5, b.z - Math.sin(b.heading) * 0.5, 0.02, 0.25); }
        if (b.t > b.dur) { b.t = 0; b.state = 'stand'; b.dur = 5 + r() * 9; }
      }
    } else if (b.state === 'fly') {
      const k = clamp(b.t / b.dur, 0, 1);
      const nx = lerp(b.from.x, b.to.x, k), nz = lerp(b.from.z, b.to.z, k);
      b.heading = Math.atan2(-(b.to.z - b.from.z), b.to.x - b.from.x);
      const alt = Math.sin(k * Math.PI) * 6 + 0.2 + (1 - k) * b.from.y * 0.5 + k * (b.to.y);
      b.x = nx; b.z = nz; b.y = Math.max(alt, this.g.heightAt(nx, nz) + 0.5);
      b.pitch = k < 0.3 ? 0.3 : k > 0.75 ? 0.25 : 0;
      m.legs.visible = true; m.legs.rotation.z = lerp(-1.25, 0, sm(k, 0.7, 1));
      m.neck.scale.set(0.55, 0.55, 1); m.neck.rotation.z = -0.45;
      flap(m, t * 7 + b.ph, 0.75 + (k > 0.8 ? 0.1 : 0));
      if (k >= 1) { b.state = 'stand'; b.t = 0; b.dur = 4 + r() * 6; b.x = b.to.x; b.z = b.to.z; m.neck.scale.set(1, 1, 1); }
    }
  }

  takeoff(b) {
    // go to another shore spot well away from whoever spooked us
    const r = this.rand, from = { x: b.x, z: b.z, y: b.y };
    let best = null;
    for (let k = 0; k < 6; k++) { const sp = this.spots[Math.floor(r() * this.spots.length)]; if (sp && Math.hypot(sp.x - b.x, sp.z - b.z) > 60 && !this.birds.some((o) => o !== b && o.wader && Math.hypot(o.x - sp.x, o.z - sp.z) < 8)) { best = sp; break; } }
    if (!best) best = this.spots[b.spot];
    b.state = 'fly'; b.t = 0; b.from = from; b.to = { x: best.x, z: best.z, y: best.y + b.m.s.stand + 0.02 };
    b.dur = Math.max(3.5, Math.hypot(best.x - b.x, best.z - b.z) / 7);
    this.g.splash(b.x, b.z, 0.02, 0.3);
  }

  // ---- perched birds (dock lamps and pilings) ------------------------------------------
  perched(b, dt, t, pd) {
    const m = b.m, r = this.rand, h = b.home;
    b.t += dt;
    if (b.state === 'stand') {
      fold(m); m.legs.visible = true; m.legs.rotation.z = 0; m.neck.scale.set(1, 1, 1); m.neck.rotation.z = 0;
      b.x = h.x; b.z = h.z; b.y = h.y; b.pitch = 0.08;
      b.heading += Math.sin(t * 0.3 + b.ph) * dt * 0.15 + (b.t > b.dur && r() < 0.01 ? 0.8 : 0);
      if (pd < 12) { b.state = 'fly'; b.t = 0; b.dur = 25 + r() * 20; b.ang = b.heading; b.rad = 14 + r() * 10; b.hgt = 8 + r() * 6; b.dir = r() < 0.5 ? 1 : -1; }
    } else if (b.state === 'fly') {
      // circle over the water, then glide back to the post
      const k = b.t / b.dur, ph = t * 9 + b.ph;
      if (k < 1) {
        b.ang += dt * 0.45 * b.dir;
        const rad = b.rad, up = Math.min(1, b.t / 2.5);
        const tx = h.x + Math.cos(b.ang) * rad, tz = h.z + Math.sin(b.ang) * rad, ty = lerp(h.y, h.y + b.hgt, up) + Math.sin(t * 0.6 + b.ph) * 1.2;
        b.heading = Math.atan2(-(tz - b.z), tx - b.x);
        b.x += (tx - b.x) * Math.min(1, dt * 1.5); b.z += (tz - b.z) * Math.min(1, dt * 1.5); b.y += (ty - b.y) * Math.min(1, dt * 1.5);
        b.pitch = 0.1;
        flap(m, ph, Math.sin(t * 0.5 + b.ph) > 0.3 ? 0.15 : 0.7);
        m.legs.rotation.z = -1.3;
      } else {
        const f = clamp((b.t - b.dur) / 4, 0, 1), e = f * f * (3 - 2 * f);
        if (!b.fx) b.fx = { x: b.x, y: b.y, z: b.z };
        b.heading = Math.atan2(-(h.z - b.z), h.x - b.x);
        b.x = lerp(b.fx.x, h.x, e); b.z = lerp(b.fx.z, h.z, e); b.y = lerp(b.fx.y, h.y + 0.4, e) + (1 - f) * 1;
        b.pitch = -0.1;
        flap(m, ph, 0.55 * (1 - e) + 0.15); m.legs.rotation.z = lerp(-1.3, 0, e);
        if (f >= 1) { b.state = 'stand'; b.t = 0; b.dur = 15 + r() * 30; b.fx = null; }
      }
    }
  }

  // ---- pelicans ------------------------------------------------------------------------
  pelican(b, dt, t, pd) {
    const m = b.m, r = this.rand, H = this.g.heightAt;
    b.t += dt;
    const toward = (tx, tz, speed, turn = 1.6) => {
      const want = Math.atan2(-(tz - b.z), tx - b.x), diff = shortAng(want - b.heading);
      b.heading += clamp(diff, -turn * dt, turn * dt);
      b.x += Math.cos(b.heading) * speed * dt; b.z -= Math.sin(b.heading) * speed * dt;
      return Math.hypot(tx - b.x, tz - b.z);
    };
    m.legs.rotation.z = -1.4; m.neck.scale.set(0.8, 0.7, 1); m.neck.rotation.z = -0.35;
    if (b.state === 'patrol') {
      const cyc = (t + b.ph) % 7, flapping = cyc < 3.2;
      flap(m, t * 5.2 + b.ph, flapping ? 0.6 : 0.1, flapping ? 0.1 : 0.0);
      b.y += (b.alt + Math.sin(t * 0.7 + b.ph) * 0.6 + (flapping ? 0.3 : -0.4) - b.y) * Math.min(1, dt * 0.6);
      b.pitch = flapping ? 0.08 : -0.05;
      const d = toward(b.tgt.x, b.tgt.z, b.speed);
      // a bait school (or a rising fish) in range: go and dive on it
      if (b.t > 12 && !b.victim) {
        let best = null, bd = 260;
        for (const sp of this.hot) { const k = Math.hypot(sp.x - b.x, sp.z - b.z); if (k < bd && !this.birds.some((o) => o !== b && o.pelican && o.victim === sp)) { bd = k; best = sp; } }
        if (best) { b.victim = best; b.tgt = { x: best.x, z: best.z }; }
        else if (b.t > 50 && r() < 0.01) { const p = this.waterPoint(b.x, b.z, 30, 120, 2.5); if (p) { b.victim = { x: p.x, z: p.z, rise: true }; b.tgt = p; this.g.splash(p.x, p.z, 0.02, 0.3); } }
      }
      if (b.victim) {
        const v = b.victim; b.tgt = { x: v.x, z: v.z };
        if (d < 22) { b.state = 'plunge'; b.t = 0; b.y0 = b.y; }
      } else if (d < 20 || b.t > 40) { b.tgt = this.waterPoint(b.x, b.z, 80, 280, 3) || b.tgt; if (b.t > 40) b.t = 8; }
      if (H(b.x, b.z) > -0.5 && H(b.x + 30 * Math.cos(b.heading), b.z - 30 * Math.sin(b.heading)) > 0) { const p = this.waterPoint(b.x, b.z, 80, 200, 3); if (p) b.tgt = p; }
    } else if (b.state === 'plunge') {
      // wings back, neck folded, nose down onto the fish
      const v = b.victim, k = clamp(b.t / 1.1, 0, 1);
      fold(m); m.wl.scale.z = 0.7; m.wr.scale.z = -0.7; m.wl.rotation.x = -0.5; m.wr.rotation.x = 0.5;
      m.neck.rotation.z = -0.6;
      b.pitch = -1.15;
      toward(v.x, v.z, 8, 2.2);
      b.y = lerp(b.y0, 0.15, k * k);
      if (k >= 1) { this.g.splash(b.x, b.z, 0.09, 1.1); b.state = 'float'; b.t = 0; b.dur = 4 + r() * 3; b.y = 0.05; if (v.rise) b.victim = null; }
    } else if (b.state === 'float') {
      fold(m); m.legs.visible = false; m.neck.rotation.z = 0; m.neck.scale.set(1, 1, 1);
      b.pitch = Math.sin(t * 1.5 + b.ph) * 0.05; b.y = 0.04 + Math.sin(t * 1.3 + b.ph) * 0.03;
      if (b.t > b.dur) { b.state = 'lift'; b.t = 0; b.victim = null; m.legs.visible = true; }
    } else if (b.state === 'lift') {
      // running take-off: flap hard, climb away from the water
      const k = clamp(b.t / 4, 0, 1);
      flap(m, t * 6.5 + b.ph, 0.85);
      toward(b.x + Math.cos(b.heading) * 40, b.z - Math.sin(b.heading) * 40, 3 + k * 6);
      b.y = lerp(0.1, b.alt, sm(k, 0, 1)); b.pitch = 0.25 * (1 - k);
      if (k >= 1) { b.state = 'patrol'; b.t = 0; b.tgt = this.waterPoint(b.x, b.z, 80, 280, 3) || b.tgt; }
    }
  }

  // ---- diving gulls ---------------------------------------------------------------------
  gullDives(dt, cam) {
    const r = this.rand;
    for (const sp of this.hot) {
      if (!sp.gulls.length) continue;
      sp.dive -= dt;
      const d = Math.hypot(sp.x - cam.x, sp.z - cam.z);
      if (sp.dive <= 0 && d < 520) {
        sp.dive = 5 + r() * 9;
        const gl = sp.gulls[Math.floor(r() * sp.gulls.length)];
        if (!gl.userData.dive) gl.userData.dive = { t: 0, ox: (r() - 0.5) * 5, oz: (r() - 0.5) * 5, hit: false, T: 2.6 };
      }
      for (const gl of sp.gulls) {
        const u = gl.userData, dv = u.dive;
        if (!dv) continue;
        dv.t += dt;
        const p = dv.t / dv.T;
        if (p >= 1) { u.dive = null; gl.rotation.z = 0; continue; }
        const w = Math.pow(Math.sin(p * Math.PI), 1.4);
        gl.position.x = lerp(gl.position.x, sp.x + dv.ox, w);
        gl.position.z = lerp(gl.position.z, sp.z + dv.oz, w);
        gl.position.y = lerp(gl.position.y, 0.12, w);
        gl.rotation.z = -0.75 * Math.cos(p * Math.PI);
        if (w > 0.55) { u.l.rotation.x = 0.35; u.r.rotation.x = -0.35; }
        if (p >= 0.5 && !dv.hit) { dv.hit = true; this.g.splash(sp.x + dv.ox, sp.z + dv.oz, 0.04, 0.6); }
      }
    }
  }
}

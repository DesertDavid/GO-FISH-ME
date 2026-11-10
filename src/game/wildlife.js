import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadKinds, hasModel, makeAnimal } from './wildlifeModels.js';
import { Fauna } from './wildlifeFauna.js';

// Wildlife: dolphin pods arcing through the swell, whales that blow and fluke-dive, and
// gators/caimans cruising low in the water. Real models (wildlifeModels.js) when loaded, procedural lofts, vertex-coloured,
// as the fallback; shore animals (ducks, hippos, moose, ...) live in wildlifeFauna.js.

// Body along x (head at +x). r(t) -> [halfWidth, halfHeight, yOffset]; colours top -> belly.
function loft(length, r, top, belly, rings = 40, seg = 18) {
  const pos = [], col = [], idx = [];
  const ct = new THREE.Color(top), cb = new THREE.Color(belly), c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, [w, h, yc] = r(t);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(length / 2 - t * length, yc + ca * h, sa * w);
      c.copy(cb).lerp(ct, THREE.MathUtils.smoothstep(ca, -0.35, 0.35));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

function flat(pts, hex, rotX = 0, at = [0, 0, 0]) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), 4);
  g.rotateX(rotX);
  g.translate(...at);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

const sm = THREE.MathUtils.smoothstep;
function dolphinGeo() {
  const L = 2.5;
  const body = loft(L, (t) => {
    const beak = t < 0.1 ? 0.25 + 0.75 * sm(t, 0.03, 0.1) : 1;
    const s = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.02)), 0.7) * beak;
    return [0.24 * s + 0.02, 0.27 * s + 0.02, 0];
  }, 0x5a6672, 0xd8dde2);
  const dorsal = flat([[0, 0], [-0.25, 0.32], [-0.38, 0.3], [-0.3, 0]], 0x4a5560, 0, [0.05, 0.24, 0]);
  const fluke = flat([[0, 0], [-0.3, 0.32], [-0.38, 0.28], [-0.22, 0], [-0.38, -0.28], [-0.3, -0.32]], 0x4a5560, Math.PI / 2, [-L / 2 + 0.05, 0, 0]);
  const pecs = [1, -1].map((s) => flat([[0, 0], [-0.28, 0.08], [-0.3, 0.02]], 0x4a5560, s * 1.1, [0.45, -0.12, s * 0.18]));
  return mergeGeometries([body, dorsal, fluke, ...pecs]);
}

function whaleGeo() {
  const L = 13;
  const body = loft(L, (t) => {
    const s = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)), 0.55);
    return [1.45 * s + 0.1, 1.3 * s * (t < 0.3 ? 0.85 : 1) + 0.1, t < 0.25 ? -0.2 : 0];
  }, 0x23272c, 0x8f969c, 48, 22);
  const fin = flat([[0, 0], [-0.6, 0.5], [-0.9, 0.45], [-0.8, 0]], 0x23272c, 0, [-1.8, 1.1, 0]);
  const pecs = [1, -1].map((s) => flat([[0, 0], [-0.7, 0.35], [-4.0, 0.2], [-4.1, 0], [-0.5, -0.4]], 0xd8dcdf, s * 1.25, [2.5, -0.6, s * 1.1]));
  const fluke = flat([[0, 0], [-1.2, 2.2], [-1.9, 2.0], [-1.0, 0.2], [-1.9, -2.0], [-1.2, -2.2]], 0x23272c, Math.PI / 2, [-L / 2 + 0.3, 0, 0]);
  return mergeGeometries([body, fin, ...pecs, fluke]);
}

function gatorGeo() {
  const L = 3.4;
  const body = loft(L, (t) => {
    const snout = t < 0.18 ? 0.35 + 0.65 * (t / 0.18) : 1;
    const tail = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    return [0.32 * snout * (0.25 + 0.75 * tail), 0.13 * (0.4 + 0.6 * tail), 0];
  }, 0x2e3522, 0x8a8a62, 40, 16);
  const eyes = [1, -1].map((s) => {
    const g = new THREE.SphereGeometry(0.045, 8, 6).translate(L / 2 - 0.62, 0.12, s * 0.09);
    const c = new THREE.Color(0x6a6a30), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return g.toNonIndexed();
  });
  const ridges = [];
  for (let i = 0; i < 14; i++) {
    const x = L / 2 - 0.9 - i * 0.16;
    ridges.push(flat([[0, 0], [0.04, 0.07], [0.08, 0]], 0x262c1c, 0, [x, 0.1 - Math.max(0, i - 6) * 0.008, 0.06]));
    ridges.push(flat([[0, 0], [0.04, 0.07], [0.08, 0]], 0x262c1c, 0, [x, 0.1 - Math.max(0, i - 6) * 0.008, -0.06]));
  }
  return mergeGeometries([body, ...eyes, ...ridges]);
}

const KINDS = {
  gulf: ['dolphin', 'gator'], reef: ['dolphin'], keys: ['dolphin', 'gator'],
  bering: ['whale'], fjord: ['whale'],
  okeechobee: ['gator'], amazon: ['gator'],
  chesapeake: ['dolphin'], cabo: ['whale', 'dolphin'], kariba: ['gator'],   // Kariba's are Nile crocodiles
};

export class Wildlife {
  constructor(ctx) {
    this.ctx = ctx;
    this.kinds = KINDS[ctx.loc.id] || [];
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
    ctx.patchProp(this.mat);
    this.geo = {};
    this.events = [];
    this.timer = 8 + Math.random() * 10;
    this.gators = [];
    this.anims = [];
    this.fauna = new Fauna(ctx);
    loadKinds(this.kinds).finally(() => { if (this.kinds.includes('gator')) this.spawnGators(); });   // real models if they load, else the lofts
    this.spoutTex = this.makeSpoutTexture();
  }

  // a swimmer: the real model when it is loaded (clip 'swim'), else the procedural loft
  make(kind) {
    const an = hasModel(kind) ? makeAnimal(kind, this.ctx.patchProp) : null;
    if (!an) return new THREE.Mesh(this.geometry(kind), this.mat);
    an.play('swim', 0);
    if (an.mixer) an.mixer.setTime(Math.random() * 2);
    this.anims.push(an);
    return an.root;
  }

  geometry(kind) {
    if (!this.geo[kind]) this.geo[kind] = { dolphin: dolphinGeo, whale: whaleGeo, gator: gatorGeo }[kind]();
    return this.geo[kind];
  }

  makeSpoutTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  spawnGators() {
    const c = this.ctx;
    const want = this.kinds[0] === 'gator' ? 6 : 2;
    for (let i = 0, tries = 0; i < want && tries < 300; tries++) {
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 500;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const d = -c.heightAt(x, z);
      if (d < 0.6 || d > 4) continue;
      const m = this.make('gator');
      m.position.set(x, -0.06, z);
      m.scale.setScalar(0.7 + Math.random() * 0.6);
      this.group.add(m);
      this.gators.push({ m, heading: Math.random() * Math.PI * 2, sink: 0, t: Math.random() * 100 });
      i++;
    }
  }

  update(dt, center) {
    const c = this.ctx;
    this.fauna.update(dt, center);
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      if (!a.root.parent) this.anims.splice(i, 1); else if (a.mixer) a.mixer.update(dt);
    }
    // gators: drift slowly, slip under when the boat gets close
    for (const g of this.gators) {
      g.t += dt;
      const d = Math.hypot(g.m.position.x - center.x, g.m.position.z - center.z);
      g.sink += ((d < 14 ? 1 : 0) - g.sink) * dt * 0.8;
      g.heading += Math.sin(g.t * 0.1) * dt * 0.05;
      const nx = g.m.position.x + Math.cos(g.heading) * 0.25 * dt, nz = g.m.position.z - Math.sin(g.heading) * 0.25 * dt;
      if (-c.heightAt(nx, nz) > 0.5) { g.m.position.x = nx; g.m.position.z = nz; } else g.heading += Math.PI * 0.5;
      g.m.position.y = -0.06 - g.sink * 0.8 + Math.sin(g.t * 0.8) * 0.01;
      g.m.rotation.y = g.heading;
    }
    if (!this.kinds.length || this.kinds[0] === 'gator') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.kinds[0] === 'whale' ? 50 + Math.random() * 60 : 35 + Math.random() * 50;
      this.spawn(this.kinds[0], center);
    }
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      e.t += dt;
      // swimmers only follow their heading for a few seconds: leave before reaching shallows or land (they'd cut through the shore)
      { const sp = e.kind === 'whale' ? 1.6 : 6, d = e.t * sp + 8; if (-c.heightAt(e.x + Math.cos(e.heading) * d, e.z - Math.sin(e.heading) * d) < (e.kind === 'whale' ? 12 : 2.5)) e.t = e.life + 1; }
      if (e.t > e.life) { e.members.forEach((m) => this.group.remove(m.mesh)); if (e.spout) this.group.remove(e.spout); this.events.splice(i, 1); continue; }
      for (const m of e.members) this.animate(e, m, dt);
    }
  }

  spawn(kind, center) {
    const c = this.ctx;
    const a = Math.random() * Math.PI * 2, r = kind === 'whale' ? 90 + Math.random() * 150 : 45 + Math.random() * 70;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (-c.heightAt(x, z) < (kind === 'whale' ? 25 : 6)) return;
    const heading = Math.random() * Math.PI * 2;
    const e = { kind, t: 0, life: kind === 'whale' ? 24 : 18, x, z, heading, members: [] };
    const n = kind === 'whale' ? 1 : 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const mesh = this.make(kind);
      mesh.scale.setScalar(kind === 'whale' ? 0.85 + Math.random() * 0.3 : 0.85 + Math.random() * 0.35);
      this.group.add(mesh);
      e.members.push({ mesh, ox: (Math.random() - 0.5) * 10, oz: (Math.random() - 0.5) * 10, phase: Math.random() * 2, splashed: false });
    }
    if (kind === 'whale') {
      e.spout = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.spoutTex, transparent: true, depthWrite: false, opacity: 0 }));
      this.group.add(e.spout);
    }
    this.events.push(e);
  }

  animate(e, m, dt) {
    const c = this.ctx, speed = e.kind === 'whale' ? 1.6 : 6;
    const fx = Math.cos(e.heading), fz = -Math.sin(e.heading);
    const dist = e.t * speed;
    const px = e.x + fx * dist + m.ox, pz = e.z + fz * dist + m.oz;
    let y, pitch;
    if (e.kind === 'dolphin') {
      // porpoising: an arc out of the water every ~2.4 s
      const ph = ((e.t + m.phase) % 2.4) / 2.4;
      const air = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) : 0;
      y = -1.3 + (ph < 0.35 ? 1.3 + air * 1.1 : Math.sin(((ph - 0.35) / 0.65) * Math.PI) * -0.4);
      pitch = ph < 0.35 ? Math.cos((ph / 0.35) * Math.PI) * 0.7 : 0;
      if (ph > 0.3 && ph < 0.35 && !m.splashed) { c.splash(px, pz, 0.05, 0.5); m.splashed = true; }
      if (ph < 0.1) m.splashed = false;
    } else {
      // whale: rise, blow, roll the back, then lift the flukes and dive
      const t = e.t;
      if (t < 4) { y = -4 + t; pitch = 0.05; }
      else if (t < 14) { y = -0.9 + Math.sin(t * 0.8) * 0.15; pitch = 0; }
      else { const k = Math.min(1, (t - 14) / 6); y = -0.9 - k * 6; pitch = -k * 1.1; }
      if (e.spout && !m.blew && t > 4.5) { m.blew = true; c.audio?.blow(px + fx * 3.5, pz + fz * 3.5); }
      if (e.spout) {
        const s = t > 4.5 && t < 7 ? Math.sin(((t - 4.5) / 2.5) * Math.PI) : 0;
        e.spout.material.opacity = s * 0.75;
        e.spout.scale.set(3 + s * 2, 5 + s * 4, 1);
        e.spout.position.set(px + fx * 3.5, 2.5 + s * 1.5, pz + fz * 3.5);
      }
      if (t > 14 && t < 14.2) c.splash(px, pz, 0.1, 4);
    }
    m.mesh.position.set(px, y, pz);
    m.mesh.rotation.set(0, e.heading, pitch, 'YZX');   // heading, then nose up/down
  }
}

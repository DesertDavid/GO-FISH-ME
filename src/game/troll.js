import * as THREE from 'three';
import { SPECIES_BY_ID, rollMorph, rollWeight } from './species.js';
import { LURES, RODS } from './gear.js';
import { fit } from './bait.js';
import { loadRodClone } from './rodModel.js';

// Trolling spread: three boat rods (two off the outriggers, one off the transom) pulling
// skirted baits through the wake. Cruise at 2-5 m/s; when one goes off, click to take
// the rod and fight the fish on the boat's 80-class trolling tackle.
const PELAGIC = new Set(['tuna', 'billfish', 'swordfish', 'mahi', 'mackerel', 'jack', 'shark', 'cobia', 'barracuda', 'snook']);
export const TROLL_GEAR = { rod: 'standup', reel: 'twospeed50', line: 'mono80', lure: 'trollskirt' };
const BACK = [42, 58, 32, 50, 38];            // line out behind the boat (m); rods 4 and 5 come from rod-holder upgrades
const SIDE = [-9, 9, 0, -4.5, 4.5];
const ROD_NAME = ['Left', 'Right', 'Center', 'Port inner', 'Starboard inner'];

const _tb = new THREE.Vector3(), _td = new THREE.Vector3(), _ts = new THREE.Vector3(), _tl = new THREE.Vector3(), _tt = new THREE.Vector3(), _tq = new THREE.Quaternion(), _dirs = [];

export class Trolling {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = false;
    this.pending = null;   // { index, sp, morph, lb, t }
    this.lures = BACK.map(() => new THREE.Vector3());
    this.lines = BACK.map(() => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xd8e8f0, transparent: true, opacity: 0.7 }));
      l.frustumCulled = false;
      l.visible = false;
      ctx.scene.add(l);
      return l;
    });
    this.skipT = 0;
    this.rods = [];            // real rod models standing in the holders (rodModel.js), made on first use
    this.rodsLoading = false;
    this.rodT = 0;
  }

  // the visible rods: each stands in its holder and points at its tip (the line starts there); the blank bows toward the bait
  ensureRods() {
    if (this.rods.length || this.rodsLoading) return;
    this.rodsLoading = true;
    const id = TROLL_GEAR.rod;
    Promise.all(BACK.map(() => loadRodClone(RODS[id].model))).then((ms) => {
      this.rods = ms.map((m) => { const g = new THREE.Group(); g.add(m.root); g.visible = false; this.ctx.scene.add(g); return { m, g }; });
    }).catch((e) => { console.warn('troll rod models failed', e); }).finally(() => { this.rodsLoading = false; });
  }

  placeRods(tips, n, dt) {
    this.rodT += dt;
    const c = this.ctx, boat = c.boat;
    const back = _tb.set(-1, 0, 0).applyQuaternion(boat.quaternion).setY(0).normalize();
    for (let i = 0; i < this.rods.length; i++) {
      const { m, g } = this.rods[i];
      const show = this.active && i < n && !(c.boat.id === 'sport' && i < 2);   // outrigger tips are poles on the sportfisher, no rod there
      g.visible = show;
      if (!show) continue;
      // direction: aft and up, a little outboard
      const out = i === 0 ? -0.18 : i === 1 ? 0.18 : 0;
      _td.set(0, 0, 0).addScaledVector(back, 0.62).addScaledVector(_ts.set(-back.z, 0, back.x), out).setY(0.78).normalize();
      const tip = tips[i];
      g.position.copy(tip).addScaledVector(_td, -m.tipZ);
      g.lookAt(_tl.copy(g.position).add(_td));
      // bow toward the bait; a hooked-up rod doubles over and shakes
      const hit = this.pending && this.pending.index === i;
      const toLine = _tt.subVectors(this.lures[i], tip).normalize();
      const bow = (hit ? 0.9 + Math.sin(this.rodT * 38) * 0.05 : 0.16 + Math.sin(this.rodT * 1.3 + i) * 0.03);
      for (let k = 1; k <= 28; k++) {
        const s = k / 28;
        (_dirs[k] || (_dirs[k] = new THREE.Vector3())).copy(_td).lerp(toLine, Math.min(0.95, bow * Math.pow(s, 1.8) * 1.2)).normalize();
      }
      g.updateMatrixWorld(true);
      m.pose(_tq.copy(g.quaternion).invert(), _dirs, 28);
      if (m.crank) m.crank.rotation.x = hit ? this.rodT * 25 : 0;
      g.updateMatrixWorld(true);
    }
  }

  get n() { return Math.min(BACK.length, this.ctx.boatMods?.().trollRods || 3); }

  available() {
    const w = this.ctx.loc.water;
    return w === 'offshore' || w === 'inshore';
  }

  toggle() {
    const c = this.ctx;
    if (!this.available()) { c.ui.toast('Trolling is a salt-water job: the Keys, the Gulf, the reef.', 'info'); return; }
    if (c.fishingBusy()) { c.ui.toast('Reel in first.', 'info'); return; }
    if (c.boatSpec().net) { c.ui.toast('Net boats don\'t carry a trolling spread.', 'info'); return; }
    this.active = !this.active;
    this.pending = null;
    c.ui.toast(this.active ? 'Lines out. Hold 2-5 m/s (4-10 kn) and watch the rod tips.' : 'Spread cleared.', 'info');
    this.lines.forEach((l, i) => { l.visible = this.active && i < this.n; });
    if (this.active) this.ensureRods();
    else this.placeRods([], 0, 0);
  }

  // rod tips in boat-local coordinates: outriggers on the sportfisher, transom corners otherwise
  tips() {
    const b = this.ctx.boat, h = b.hull;
    const inner = [new THREE.Vector3(-h.length * 0.3, h.depth * 0.5 + 1.5, -h.beam * 0.4), new THREE.Vector3(-h.length * 0.3, h.depth * 0.5 + 1.5, h.beam * 0.4)];   // gunwale rod holders
    if (b.id === 'sport') return [new THREE.Vector3(-2.4, 9.8, -7), new THREE.Vector3(-2.4, 9.8, 7), new THREE.Vector3(-h.length / 2, 1.6, 0), ...inner];
    return [new THREE.Vector3(-h.length / 2, h.depth * 0.6, -h.beam * 0.4), new THREE.Vector3(-h.length / 2, h.depth * 0.6, h.beam * 0.4), new THREE.Vector3(-h.length / 2 + 0.5, h.depth * 0.8, 0), ...inner];
  }

  update(dt) {
    if (!this.active) return;
    const c = this.ctx, boat = c.boat, speed = c.boatSpeed();
    const back = new THREE.Vector3(-1, 0, 0).applyQuaternion(boat.quaternion).setY(0).normalize();
    const side = new THREE.Vector3(-back.z, 0, back.x);
    const tips = this.tips().map((t) => boat.toWorld(t, new THREE.Vector3()));
    const surf = c.waterHeightApprox();
    const n = this.n;
    this.lines.forEach((l, i) => { l.visible = i < n; });
    this.placeRods(tips, n, dt);
    tips.forEach((tp, i) => { const r = this.rods[i]; if (r && r.g.visible) r.m.tip.getWorldPosition(tp); });   // the line leaves the real rod tip
    BACK.slice(0, n).forEach((d, i) => {
      const off = SIDE[i];
      const target = boat.position.clone().addScaledVector(back, d).addScaledVector(side, off);
      // baits lag behind on turns and sink a little when the boat stops
      this.lures[i].lerp(target, Math.min(1, dt * 1.5));
      this.lures[i].y = surf - (speed < 1.5 ? 1.2 : 0.05);
      if (this.pending && this.pending.index === i) this.lures[i].y = surf - 0.3;
      const arr = this.lines[i].geometry.attributes.position.array;
      const a = tips[i], b = this.lures[i];
      for (let k = 0; k < 24; k++) {
        const s = k / 23;
        arr[k * 3] = a.x + (b.x - a.x) * s;
        arr[k * 3 + 1] = a.y + (b.y - a.y) * s - Math.sin(Math.PI * s) * (2 + d * 0.04);
        arr[k * 3 + 2] = a.z + (b.z - a.z) * s;
      }
      this.lines[i].geometry.attributes.position.needsUpdate = true;
    });
    // baits skipping in the wake
    this.skipT -= dt;
    if (speed > 1.5 && this.skipT <= 0) {
      this.skipT = 0.9;
      const l = this.lures[Math.floor(Math.random() * this.n)];
      c.splash(l.x, l.z, 0.02, 0.2);
    }
    if (this.pending) {
      this.pending.t -= dt;
      c.ui.lureMarker(this.lures[this.pending.index].clone().setY(surf + 0.5), c.camera, '', 'strike');
      if (this.pending.t <= 0) { c.ui.toast('Too slow. It got off the bait.', 'bad'); c.ui.lureMarker(null); this.pending = null; }
      return;
    }
    const trolling = speed > 1.8 && speed < 6;
    if (!trolling) return;
    const hot = c.hotspots.near(boat.position.x, boat.position.z, 120);
    const rate = 0.02 * (this.n / 3) * (1 + hot * 3) * c.weatherBite();
    if (Math.random() < rate * dt) this.strike();
  }

  strike() {
    const c = this.ctx;
    // trolled skirts near the surface: weight by how well time, weather and lure suit each species
    const cond = { lureId: 'trollskirt', lure: LURES.trollskirt, depth: 0.3, bottom: 100, hour: c.hour(), wx: c.weatherId ? c.weatherId() : 'partly' };
    const pool = Object.entries(c.loc.pool).map(([id, w]) => [SPECIES_BY_ID[id], SPECIES_BY_ID[id] ? w * fit(SPECIES_BY_ID[id], cond).weight : w]).filter(([sp]) => sp && PELAGIC.has(sp.body) && sp.depth !== 'b');
    if (!pool.length) return;
    let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0), sp = pool[0][0];
    for (const [s, w] of pool) { r -= w; if (r <= 0) { sp = s; break; } }
    const big = 1.2 * (c.boatSpec().bigGame || 1);
    this.pending = { index: Math.floor(Math.random() * this.n), sp, morph: rollMorph(), lb: rollWeight(sp, Math.random, big), t: 8 };
    c.splash(this.lures[this.pending.index].x, this.lures[this.pending.index].z, 0.12, 1.2);
    c.audio.play('scream');
    c.ui.toast(`Fish on the ${ROD_NAME[this.pending.index].toLowerCase()} rod. Click to take it.`, 'good');
  }

  // the player grabs the bent rod: clear the other lines and hand over to the fight
  take() {
    const c = this.ctx, p = this.pending;
    if (!p) return;
    const lure = this.lures[p.index].clone();
    this.pending = null;
    this.active = false;
    this.placeRods([], 0, 0);
    this.lines.forEach((l) => { l.visible = false; });
    c.ui.lureMarker(null);
    c.startTrollFight(p, lure);
  }
}

import * as THREE from 'three';
import { SPECIES_BY_ID, rollMorph, rollWeight } from './species.js';
import { LURES } from './gear.js';
import { fit } from './bait.js';

// Trolling spread: three boat rods (two off the outriggers, one off the transom) pulling
// skirted baits through the wake. Cruise at 2-5 m/s; when one goes off, click to take
// the rod and fight the fish on the boat's 80-class trolling tackle.
const PELAGIC = new Set(['tuna', 'billfish', 'swordfish', 'mahi', 'mackerel', 'jack', 'shark', 'cobia', 'barracuda', 'snook']);
export const TROLL_GEAR = { rod: 'standup', reel: 'twospeed50', line: 'mono80', lure: 'trollskirt' };
const BACK = [42, 58, 32];

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
  }

  available() {
    const w = this.ctx.loc.water;
    return w === 'offshore' || w === 'inshore';
  }

  toggle() {
    const c = this.ctx;
    if (!this.available()) { c.ui.toast('Trolling works in salt water - try the Keys, the Gulf or the reef.', 'info'); return; }
    if (c.fishingBusy()) { c.ui.toast('Reel in first.', 'info'); return; }
    if (c.boatSpec().net) { c.ui.toast('Net boats don\'t carry a trolling spread.', 'info'); return; }
    this.active = !this.active;
    this.pending = null;
    c.ui.toast(this.active ? 'Lines out! Cruise at 2-5 m/s (4-10 kn) and watch the rods.' : 'Spread cleared.', 'info');
    this.lines.forEach((l) => { l.visible = this.active; });
  }

  // rod tips in boat-local coordinates: outriggers on the sportfisher, transom corners otherwise
  tips() {
    const b = this.ctx.boat, h = b.hull;
    if (b.id === 'sport') return [new THREE.Vector3(-2.4, 9.8, -7), new THREE.Vector3(-2.4, 9.8, 7), new THREE.Vector3(-h.length / 2, 1.6, 0)];
    return [new THREE.Vector3(-h.length / 2, h.depth * 0.6, -h.beam * 0.4), new THREE.Vector3(-h.length / 2, h.depth * 0.6, h.beam * 0.4), new THREE.Vector3(-h.length / 2 + 0.5, h.depth * 0.8, 0)];
  }

  update(dt) {
    if (!this.active) return;
    const c = this.ctx, boat = c.boat, speed = c.boatSpeed();
    const back = new THREE.Vector3(-1, 0, 0).applyQuaternion(boat.quaternion).setY(0).normalize();
    const side = new THREE.Vector3(-back.z, 0, back.x);
    const tips = this.tips().map((t) => boat.toWorld(t, new THREE.Vector3()));
    const surf = c.waterHeightApprox();
    BACK.forEach((d, i) => {
      const off = [-9, 9, 0][i];
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
      const l = this.lures[Math.floor(Math.random() * 3)];
      c.splash(l.x, l.z, 0.02, 0.2);
    }
    if (this.pending) {
      this.pending.t -= dt;
      c.ui.lureMarker(this.lures[this.pending.index].clone().setY(surf + 0.5), c.camera, '', 'strike');
      if (this.pending.t <= 0) { c.ui.toast('Too slow - it pulled free of the bait.', 'bad'); c.ui.lureMarker(null); this.pending = null; }
      return;
    }
    const trolling = speed > 1.8 && speed < 6;
    if (!trolling) return;
    const hot = c.hotspots.near(boat.position.x, boat.position.z, 120);
    const rate = 0.02 * (1 + hot * 3) * c.weatherBite();
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
    this.pending = { index: Math.floor(Math.random() * 3), sp, morph: rollMorph(), lb: rollWeight(sp, Math.random, big), t: 8 };
    c.splash(this.lures[this.pending.index].x, this.lures[this.pending.index].z, 0.12, 1.2);
    c.audio.play('scream');
    c.ui.toast(`FISH ON! ${['Left', 'Right', 'Center'][this.pending.index]} rod is screaming - click to grab it!`, 'good');
  }

  // the player grabs the bent rod: clear the other lines and hand over to the fight
  take() {
    const c = this.ctx, p = this.pending;
    if (!p) return;
    const lure = this.lures[p.index].clone();
    this.pending = null;
    this.active = false;
    this.lines.forEach((l) => { l.visible = false; });
    c.ui.lureMarker(null);
    c.startTrollFight(p, lure);
  }
}

import { PlayerBoat } from './boats.js';

// Other anglers: a few boats that run between spots, sit and fish a while, and keep clear
// of the player. They use the same buoyant hulls and drive forces as the player's boat.
const FLEET = {
  lake: ['bass', 'jon', 'skiff', 'bass'],
  river: ['bass', 'jon', 'skiff'],
  inshore: ['skiff', 'center', 'skiff'],
  offshore: ['center', 'sport', 'trawler'],
};

export class AIBoats {
  constructor(ctx, floaters, patchProp, start) {
    this.ctx = ctx;
    this.floaters = floaters;
    this.patchProp = patchProp;
    this.start = start;
    this.boats = [];
  }

  async spawn(count = 3) {
    const types = FLEET[this.ctx.loc.water] || FLEET.lake;
    for (let i = 0; i < count; i++) {
      const p = this.randomSpot(150, 700);
      if (!p) continue;
      const boat = await new PlayerBoat(types[i % types.length]).create(this.floaters, this.patchProp, p, Math.random() * Math.PI * 2);
      boat.speed = 0;
      this.boats.push({ boat, target: this.randomSpot(100, 800), mode: 'run', t: 0, stuck: 0 });
    }
  }

  randomSpot(rMin, rMax) {
    const h = this.ctx.heightAt;
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const x = this.start.x + Math.cos(a) * r, z = this.start.z + Math.sin(a) * r;
      if (h(x, z) < -3 && h(x + 15, z) < -2 && h(x - 15, z) < -2 && h(x, z + 15) < -2 && h(x, z - 15) < -2) return { x, z };
    }
    return null;
  }

  update(dt, player) {
    for (const a of this.boats) {
      const b = a.boat, c = b.control, p = b.position;
      b.update(dt, this.floaters, this.ctx.loc.current);
      a.t += dt;
      if (a.mode === 'fish') {
        c.throttle = 0; c.steer = 0;
        if (a.t > a.fishFor) { a.mode = 'run'; a.t = 0; a.target = this.randomSpot(100, 800) || a.target; }
        continue;
      }
      if (!a.target) { a.mode = 'fish'; a.fishFor = 60; a.t = 0; continue; }
      let dx = a.target.x - p.x, dz = a.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      // keep clear of the player
      const px = p.x - player.x, pz = p.z - player.z, pd = Math.hypot(px, pz);
      if (pd < 35) { dx += (px / pd) * 60; dz += (pz / pd) * 60; }
      const want = Math.atan2(-dz, dx);
      let diff = want - b.heading();
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      c.steer = Math.max(-1, Math.min(1, -diff * 1.8));
      c.throttle = dist < 40 ? 0.25 : Math.abs(diff) > 0.8 ? 0.3 : 0.65;
      if (dist < 18) { a.mode = 'fish'; a.t = 0; a.fishFor = 40 + Math.random() * 80; }
      // stuck on a bank: pick somewhere else
      a.stuck = Math.abs(b.speed) < 0.4 ? a.stuck + dt : 0;
      if (a.stuck > 8) { a.stuck = 0; a.target = this.randomSpot(100, 800) || a.target; }
    }
  }
}

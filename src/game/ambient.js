import * as THREE from 'three';
import { SPECIES_BY_ID, MORPHS } from './species.js';
import { buildFish, fishLengthM } from './fishMesh.js';

// A few fish cruising near the boat, seen through the water (refraction + absorption do the rest).
export class AmbientFish {
  constructor(ctx, max = 7) {
    this.ctx = ctx;
    this.max = max;
    this.fish = [];
    this.spawnT = 0;
    const pool = Object.entries(ctx.loc.pool);
    this.pool = pool;
    this.sum = pool.reduce((a, [, w]) => a + w, 0);
  }

  pick() {
    let r = Math.random() * this.sum;
    for (const [id, w] of this.pool) { r -= w; if (r <= 0) return SPECIES_BY_ID[id]; }
    return SPECIES_BY_ID[this.pool[0][0]];
  }

  update(dt, center) {
    const c = this.ctx;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.fish.length < this.max) {
      this.spawnT = 0.8;
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 22;
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      const bottom = -c.heightAt(x, z);
      if (bottom > 1.6) {
        const sp = this.pick();
        const lb = sp.lb[0] + (sp.lb[1] - sp.lb[0]) * Math.random();
        const { m } = fishLengthM(sp, Math.min(lb, 60));
        const model = buildFish(sp, MORPHS[0], { patchProp: c.patchProp });
        model.group.scale.setScalar(m);
        const depth = Math.min(bottom - 0.4, 1.2 + Math.random() * 3);
        model.group.position.set(x, -depth, z);
        c.scene.add(model.group);
        this.fish.push({ model, heading: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.6, turn: 0, depth, t: Math.random() * 10 });
      }
    }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i], g = f.model.group;
      f.t += dt;
      f.turn += (Math.random() - 0.5) * dt * 2;
      f.turn *= 0.98;
      f.heading += f.turn * dt;
      const nx = g.position.x + Math.cos(f.heading) * f.speed * dt, nz = g.position.z - Math.sin(f.heading) * f.speed * dt;
      if (-c.heightAt(nx, nz) < f.depth + 0.4) f.heading += Math.PI * dt * 2;
      else g.position.set(nx, -f.depth + Math.sin(f.t * 0.7) * 0.15, nz);
      g.rotation.set(0, f.heading, 0);
      if (f.model.body.flatfish) g.rotation.x = -Math.PI / 2;
      f.model.uniforms.uSwim.value.x += dt;
      if (Math.hypot(g.position.x - center.x, g.position.z - center.z) > 45) {
        c.scene.remove(g);
        g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
        this.fish.splice(i, 1);
      }
    }
  }

  // fish near a point for the fish finder
  near(x, z, r) {
    return this.fish.filter((f) => Math.hypot(f.model.group.position.x - x, f.model.group.position.z - z) < r).map((f) => f.depth);
  }
}

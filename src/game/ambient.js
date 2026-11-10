import * as THREE from 'three';
import { SPECIES_BY_ID, MORPHS } from './species.js';
import { buildFish, fishLengthM } from './fishMesh.js';
import { holdDepth, bandFit } from './bait.js';

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

  // pool pick, weighted by whether this water's depth suits a bottom species (cod in a 200 m hole, not walleye)
  pick(bottom = 5) {
    const w = this.pool.map(([id, n]) => (SPECIES_BY_ID[id] ? n * Math.max(0.03, bandFit(SPECIES_BY_ID[id], bottom)) : 0));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return SPECIES_BY_ID[this.pool[i][0]]; }
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
        const sp = this.pick(bottom);
        const lb = sp.lb[0] + (sp.lb[1] - sp.lb[0]) * Math.random();
        // hold where this species likes to be at this hour (so the fish finder hints at the right depth)
        const depth = holdDepth(sp, bottom, c.hour ? c.hour() : 12);
        let model;
        if (depth > 32) {
          // too deep to be seen through the water: a bare marker keeps the sonar honest, no mesh to build
          model = { group: new THREE.Group(), body: {}, uniforms: { uSwim: { value: { x: 0 } } } };
        } else {
          const { m } = fishLengthM(sp, Math.min(lb, 60));
          model = buildFish(sp, MORPHS[0], { patchProp: c.patchProp });
          model.group.scale.setScalar(m);
          c.scene.add(model.group);
        }
        model.group.position.set(x, -depth, z);
        this.fish.push({ sp, lb, model, heading: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.6, turn: 0, depth, t: Math.random() * 10 });
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
    return this.fish.filter((f) => Math.hypot(f.model.group.position.x - x, f.model.group.position.z - z) < r).map((f) => ({ d: f.depth, s: Math.min(1, Math.log10(1 + f.lb) / 2.2) }));
  }
}

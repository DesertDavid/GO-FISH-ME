import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TUNE } from './fishTune.js';

// Bait balls: a few tight balls of small silver fish near the player. Now and then a predator
// hunts one (a real hunter fish when one is close, else an unseen one): the ball tightens and
// rises, "nervous water" patters on the surface, then it explodes, fish leap, the surface boils,
// pelicans come in, and the water is a hotspot (bite-rate boost via FishLife.boilNear) for a while.
// Any predator fish crossing a ball also scatters it. Numbers: fishTune.js `balls`.
const B = TUNE.balls;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const ss = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
const rr = (r) => r[0] + Math.random() * (r[1] - r[0]);

function baitGeometry() {
  const body = new THREE.SphereGeometry(0.5, 7, 5).scale(0.3, 0.1, 0.07);
  const p = body.attributes.position, col = new Float32Array(p.count * 3);
  const top = new THREE.Color(0x4f6a70), belly = new THREE.Color(0xe8f0ee), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { t.copy(belly).lerp(top, clamp((p.getY(i) + 0.03) / 0.06, 0, 1)); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
  body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tail = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.1, 0.07), new THREE.Vector2(-0.08, 0), new THREE.Vector2(-0.1, -0.07)]));
  tail.translate(-0.13, 0, 0);
  const tc = new Float32Array(tail.attributes.position.count * 3).fill(0.55);
  tail.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  const parts = [body.toNonIndexed(), tail.toNonIndexed()];
  parts.forEach((g) => { g.deleteAttribute('uv'); });
  return mergeGeometries(parts);
}

export class BaitBalls {
  constructor(life) {
    this.life = life;
    this.g = life.g;
    this.balls = [];
    this.m = new THREE.Matrix4(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YZX');
    this.t = 0;
    if (!B.count) return;
    const geo = baitGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide });
    this.g.patchProp(mat);
    for (let k = 0; k < B.count; k++) {
      const mesh = new THREE.InstancedMesh(geo, mat, B.fish);
      mesh.frustumCulled = false;
      mesh.layers.enable(1);
      mesh.visible = false;
      life.group.add(mesh);
      const th = new Float32Array(B.fish), ph = new Float32Array(B.fish), rd = new Float32Array(B.fish);
      for (let i = 0; i < B.fish; i++) { th[i] = Math.random() * 6.283; ph[i] = Math.random(); rd[i] = 0.3 + 0.7 * Math.sqrt(Math.random()); }
      const b = {
        mesh, th, ph, rd, x: 0, y: -2, z: 0, vx: 0, vz: 0, placed: false, alive: true, state: 'school', t: 0, huntT: rr([4, 14]) + k * 9,
        rot: Math.random() * 6, feedT: 0, boilT: 0, nerveT: 0, hunter: null, hx: 0, hz: 0, hdx: 0, hdz: 0, att: { x: 0, z: 0, on: false }, attT: 0,
        scatterNow: null,
      };
      b.scatterNow = () => this.scatter(b);
      this.balls.push(b);
    }
  }

  // register the pelican attractors once birds exist
  attachBirds(birds) { if (birds && birds.attract) for (const b of this.balls) birds.attract.push(b.att); }

  hot(x, z, r) {
    let best = 0;
    for (const b of this.balls) if (b.feedT > 0 && b.placed) best = Math.max(best, 1 - Math.min(1, Math.hypot(x - b.x, z - b.z) / r));
    return best;
  }

  place(b) {
    const cam = this.life.cam, H = this.g.heightAt;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * 6.283, d = B.spawnMin + Math.random() * (B.spawnMax - B.spawnMin);
      const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
      if (-H(x, z) < B.minWater) continue;
      // keep two balls apart
      if (this.balls.some((o) => o !== b && o.placed && Math.hypot(o.x - x, o.z - z) < 25)) continue;
      b.x = x; b.z = z; b.y = -Math.min(2.2, -H(x, z) * 0.5) - 0.3; b.placed = true; b.state = 'school'; b.t = 0; b.huntT = rr(B.huntEvery) * 0.5; b.feedT = 0; b.boilT = 0; b.att.on = false;
      const v = 0.25 + Math.random() * 0.3, h = Math.random() * 6.283; b.vx = Math.cos(h) * v; b.vz = Math.sin(h) * v;
      return true;
    }
    b.placed = false;
    return false;
  }

  scatter(b) {
    if (b.state === 'scatter') return;
    b.state = 'scatter'; b.t = 0; b.boilT = B.boilTime; b.feedT = B.feedTime; b.att.on = true; b.attT = B.birdTime;
    b.att.x = b.x; b.att.z = b.z;
    if (b.hunter && b.hunter.state === 'hunt') b.hunter.state = 'cruise';
    b.hunter = null;
    this.impact(b.x, b.z, 0.09, 1.0);
  }

  impact(x, z, amp, size) {
    const f = this.g.e.floaters;
    f.impacts.push({ x, z, t: f.time, amp, size });
    if (f.impacts.length > 8) f.impacts.shift();
  }

  update(dt, player) {
    const life = this.life, cam = life.cam, H = this.g.heightAt;
    this.t += dt;
    for (const b of this.balls) {
      if (!b.placed || Math.hypot(b.x - cam.x, b.z - cam.z) > B.keep) { if (!this.place(b)) { b.mesh.visible = false; continue; } }
      b.t += dt;
      b.rot += dt * 0.7;
      b.feedT = Math.max(0, b.feedT - dt);
      b.boilT = Math.max(0, b.boilT - dt);
      if (b.att.on) { b.attT -= dt; b.att.x = b.x; b.att.z = b.z; if (b.attT <= 0) b.att.on = false; }
      // drift, away from shallows
      const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
      if (-H(nx, nz) > B.minWater) { b.x = nx; b.z = nz; } else { b.vx *= -1; b.vz *= -1; }
      if (b.state === 'school') {
        b.huntT -= dt;
        // a predator fish swimming through scatters it
        for (const a of life.actors) {
          if (a.on && a.tr.hunts && a.state !== 'spook' && Math.hypot(a.x - b.x, a.z - b.z) < B.passRadius && Math.abs(a.y - b.y) < 2.5) { this.scatter(b); break; }
        }
        if (b.state === 'school' && b.huntT <= 0) this.startHunt(b);
      } else if (b.state === 'warn') {
        b.nerveT -= dt;
        if (b.nerveT <= 0) { b.nerveT = 0.3 + Math.random() * 0.25; this.impact(b.x + (Math.random() - 0.5) * 2.4, b.z + (Math.random() - 0.5) * 2.4, 0.012, 0.22); }
        b.y += (-0.45 - b.y) * Math.min(1, dt * 0.8);
        for (const a of life.actors) {
          if (a.on && a.tr.hunts && a.state !== 'spook' && Math.hypot(a.x - b.x, a.z - b.z) < B.passRadius) { this.scatter(b); break; }
        }
        if (b.state === 'warn') {
          if (!b.hunter) {
            // unseen hunter: its line sweeps through the ball at the end of the warning
            b.hx += b.hdx * dt; b.hz += b.hdz * dt;
            if (b.t >= B.warn) this.scatter(b);
          } else if (b.t > B.warn + 5) this.scatter(b);
        }
      } else if (b.state === 'scatter') {
        if (b.boilT > 0) {
          b.nerveT -= dt;
          if (b.nerveT <= 0) { b.nerveT = 0.18 + Math.random() * 0.25; this.impact(b.x + (Math.random() - 0.5) * 5, b.z + (Math.random() - 0.5) * 5, 0.05 + Math.random() * 0.04, 0.5 + Math.random() * 0.4); }
        }
        if (b.t > B.scatter + B.regroup) { b.state = 'school'; b.huntT = rr(B.huntEvery); b.y = -Math.min(2.2, -H(b.x, b.z) * 0.5) - 0.3; }
        else b.y += (-1.2 - b.y) * Math.min(1, dt * 0.3);
      }
      // draw
      const d = Math.hypot(b.x - cam.x, b.z - cam.z);
      const show = d < B.visible && (life.vis > 6 || b.state === 'scatter');
      b.mesh.visible = show;
      if (show) this.draw(b);
    }
  }

  startHunt(b) {
    const life = this.life;
    b.state = 'warn'; b.t = 0; b.nerveT = 0.1; b.att.on = true; b.attT = B.birdTime; b.att.x = b.x; b.att.z = b.z;
    let best = null, bd = B.hunterRange;
    for (const a of life.actors) {
      if (!a.on || !a.tr.hunts || a.state !== 'cruise') continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) { best.state = 'hunt'; best.ht = b; best.st = 0; b.hunter = best; best.flare = 0.6; }
    else {
      b.hunter = null;
      const ang = Math.random() * 6.283;
      b.hx = b.x + Math.cos(ang) * 14; b.hz = b.z + Math.sin(ang) * 14;
      b.hdx = -Math.cos(ang) * 14 / B.warn; b.hdz = -Math.sin(ang) * 14 / B.warn;
    }
  }

  draw(b) {
    const m = this.m, p = this.p, s = this.s, q = this.q, e = this.e, n = B.fish;
    let tight = 1, mult = 1, scat = 0;
    if (b.state === 'warn') tight = lerp(1, 0.6, ss(b.t, 0, B.warn));
    else if (b.state === 'scatter') {
      if (b.t < B.scatter) { scat = Math.sin((b.t / B.scatter) * 1.5708); mult = 1 + scat * 3.4; }
      else { const k = ss(b.t - B.scatter, 0, B.regroup); mult = lerp(4.4, 1, k); }
      tight = 0.9;
    }
    const R = B.radius * tight * mult, flat = b.state === 'scatter' ? 0.45 : 0.9;
    const fs = B.size * 0.55;
    for (let i = 0; i < n; i++) {
      const dir = i & 1 ? 1 : -1;
      const a = b.th[i] + b.rot * (0.7 + 0.12 * (i & 3)) * dir;
      const rad = R * b.rd[i];
      const px = b.x + Math.cos(a) * rad, pz = b.z + Math.sin(a) * rad * 0.8;
      let py = b.y + (b.ph[i] - 0.5) * B.radius * tight * 1.3 * (b.state === 'scatter' ? 0.6 : 1) * flat;
      let hd;
      if (scat > 0.02 && scat < 1.01 && b.t < B.scatter) hd = Math.atan2(-(pz - b.z), px - b.x);
      else hd = Math.atan2(-Math.cos(a) * 0.8 * dir, -Math.sin(a) * dir);
      let pitch = 0;
      // some leap clear of the water as the ball bursts
      if (b.state === 'scatter' && b.boilT > 0 && i % 5 === 0) {
        const u = (b.t * 1.1 + i * 0.173) % 1.6;
        if (u < 0.9 && b.t < 3) { const k = u / 0.9; py = Math.max(py, -0.1 + Math.sin(k * Math.PI) * (0.35 + (i % 3) * 0.12)); pitch = (0.5 - k) * 1.1; }
      }
      py = Math.min(py, py > 0 ? py : -0.1);
      e.set(0, hd, pitch);
      q.setFromEuler(e);
      p.set(px, py, pz);
      s.setScalar(fs);
      m.compose(p, q, s);
      b.mesh.setMatrixAt(i, m);
    }
    b.mesh.instanceMatrix.needsUpdate = true;
  }
}

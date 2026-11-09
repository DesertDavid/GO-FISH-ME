import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Wooden fishing docks on the real shoreline of each location: a plank walkway on pilings out
// to fishable water, a T-head with a bench, cleats, a swim ladder and a lamp that comes on at
// night. Sites are found from the heightfield, so they sit where the coast actually is.
const DECK_Y = 0.95;      // deck top above the still-water line
const WALK_W = 1.8;
const HEAD_W = 6.0, HEAD_D = 3.6;
const RAMP = 3.0;         // shore ramp length
const MAX_DOCKS = 3;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// weathered plank grain: long streaks, a few knots, silvered by the sun
function woodTexture() {
  const W = 1024, H = 256, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), rand = rng(77);
  g.fillStyle = '#8a7a66';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const y = rand() * H, l = 80 + rand() * 600, x = rand() * W;
    const dark = rand() < 0.55;
    g.strokeStyle = dark ? `rgba(52,40,30,${0.08 + rand() * 0.16})` : `rgba(196,186,170,${0.05 + rand() * 0.1})`;
    g.lineWidth = 0.6 + rand() * 1.8;
    g.beginPath();
    g.moveTo(x, y);
    const wob = (rand() - 0.5) * 6;
    g.bezierCurveTo(x + l * 0.33, y + wob, x + l * 0.66, y - wob, x + l, y + (rand() - 0.5) * 3);
    g.stroke();
  }
  // knots with the grain flowing round them
  for (let k = 0; k < 7; k++) {
    const x = rand() * W, y = rand() * H, r = 4 + rand() * 7;
    for (let i = 5; i >= 0; i--) {
      g.strokeStyle = `rgba(48,34,24,${0.12 + i * 0.05})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, y, r * (1 + i * 0.9) * 2.2, r * (1 + i * 0.35), 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,28,20,0.7)';
    g.beginPath(); g.ellipse(x, y, r * 1.6, r * 0.8, 0, 0, Math.PI * 2); g.fill();
  }
  // fine checking and grime
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(30,24,18,0.14)' : 'rgba(220,214,200,0.08)';
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// colour every vertex (tone x per-part jitter), and lay the grain along the part's long axis
function part(geo, hex, rand, jitter = 0.18, uvScale = [1, 1]) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  const k = 1 + (rand() - 0.5) * jitter;
  for (let i = 0; i < n; i++) { col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uv = geo.attributes.uv, du = rand(), dv = rand();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0] + du, uv.getY(i) * uvScale[1] + dv);
  return geo.index ? geo.toNonIndexed() : geo;
}

// a box whose grain runs along local x
const plankX = (lx, ly, lz, hex, rand) => part(new THREE.BoxGeometry(lx, ly, lz), hex, rand, 0.22, [lx / 3, 0.25]);
const plankZ = (lx, ly, lz, hex, rand) => part(new THREE.BoxGeometry(lz, ly, lx).rotateY(Math.PI / 2), hex, rand, 0.22, [lz / 3, 0.25]);

export class Docks {
  constructor(loc, heightAt, patchProp, start) {
    this.heightAt = heightAt;
    this.group = new THREE.Group();
    this.group.name = 'docks';
    this.list = this.findSites(loc, heightAt, start);
    if (!this.list.length) return;
    const tex = woodTexture();
    this.wood = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.88 });
    patchProp(this.wood);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0x8a8478 });
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
    patchProp(this.glassMat);
    this.list.forEach((d, i) => this.group.add(this.build(d, rng(1000 + i * 97 + loc.id.length))));
    // one lamp light, parked at the nearest dock (keeps the light count fixed for the shaders)
    this.light = new THREE.PointLight(0xffc98a, 0, 24, 2);
    this.group.add(this.light);
  }

  // Walk the coast outward from the start and pick spots where a dock reaches 1.8 m+ of water
  // within 60 m without crossing land. Steep shores get a taller dock (deck up to 2.4 m).
  findSites(loc, H, start) {
    const out = [];
    const sx = start.x, sz = start.z;
    const maxR = Math.min(2400, loc.size * 0.5);
    for (let r = 30; r < maxR && out.length < MAX_DOCKS; r += 10) {
      const step = 14 / r;
      for (let a = 0; a < Math.PI * 2 && out.length < MAX_DOCKS; a += step) {
        const cx = sx + Math.cos(a) * r, cz = sz + Math.sin(a) * r;
        const h = H(cx, cz);
        if (h < -9 || h > 1.5) continue;
        if (out.some((d) => Math.hypot(d.x - cx, d.z - cz) < 220)) continue;
        const gx = H(cx + 2, cz) - H(cx - 2, cz), gz = H(cx, cz + 2) - H(cx, cz - 2), gl = Math.hypot(gx, gz);
        if (gl < 0.02) continue;
        const dx = -gx / gl, dz = -gz / gl;
        // find the waterline: that's where the dock starts (rocky shores drop off steeply)
        let x = cx, z = cz, found = false;
        const sgn = h > 0 ? 1 : -1;   // on land: walk seaward to the edge; in water: walk landward
        for (let t = 0; t < 12; t += 0.5) {
          const px = cx + dx * t * sgn, pz = cz + dz * t * sgn;
          if ((H(px, pz) > 0) === (sgn < 0)) { x = px; z = pz; found = true; break; }
        }
        if (!found) continue;
        if (sgn > 0) { x -= dx * 0.5; z -= dz * 0.5; }
        // solid land behind, but not a sheer wall
        const back = H(x - dx * RAMP, z - dz * RAMP);
        if (H(x - dx * 6, z - dz * 6) < 0.3 || back > 6) continue;
        const deck = THREE.MathUtils.clamp(back * 0.75, DECK_Y, 2.4);
        // march out to fishable water
        let len = 0;
        for (let t = 2; t <= 60; t += 1) {
          const px = x + dx * t, pz = z + dz * t;
          const c = H(px, pz), sl = H(px - dz * 3, pz + dx * 3), sr = H(px + dz * 3, pz - dx * 3);
          if (c > 0.2 || sl > 0.4 || sr > 0.4) break;
          if (c < -1.8 && t >= 10) { len = t; break; }
        }
        if (!len) continue;
        // the head needs open water all round
        const ex = x + dx * (len + HEAD_D), ez = z + dz * (len + HEAD_D);
        if (H(ex, ez) > -1.2 || H(ex - dz * HEAD_W * 0.6, ez + dx * HEAD_W * 0.6) > -0.8 || H(ex + dz * HEAD_W * 0.6, ez - dx * HEAD_W * 0.6) > -0.8) continue;
        out.push({ x, z, dx, dz, len, deck, yaw: Math.atan2(-dz, dx) });
      }
    }
    out.forEach((d) => {
      const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
      d.toWorld = (u, v, o = new THREE.Vector3()) => o.set(d.x + u * c + v * s, 0, d.z - u * s + v * c);
      d.toLocal = (x, z) => { const ox = x - d.x, oz = z - d.z; return [ox * c - oz * s, ox * s + oz * c]; };
      d.end = d.toWorld(d.len + HEAD_D * 0.5, 0);
      d.lamp = d.toWorld(d.len + HEAD_D - 0.25, HEAD_W / 2 - 0.25);
      d.lamp.y = d.deck + 2.55;
    });
    return out;
  }

  // Dock geometry in its own frame: u (x) runs from the shore out to sea, v (z) across.
  build(d, rand) {
    const parts = [];
    const ground = (u, v) => { const p = d.toWorld(u, v); return this.heightAt(p.x, p.z); };
    const L = d.len, top = d.deck, th = 0.045;
    const plankTone = () => (rand() < 0.12 ? 0x9a8c78 : rand() < 0.5 ? 0xb4a690 : 0xa89880);
    // walkway planks run across the dock, small gaps, the odd one a touch skewed
    for (let u = -0.1; u < L; u += 0.165) {
      const g = plankZ(0.15, th, WALK_W + 0.08, plankTone(), rand);
      g.rotateY((rand() - 0.5) * 0.012).translate(u + 0.075, top - th / 2 + (rand() - 0.5) * 0.006, (rand() - 0.5) * 0.02);
      parts.push(g);
    }
    // the T-head: planks the other way
    for (let v = -HEAD_W / 2; v < HEAD_W / 2 - 0.05; v += 0.165) {
      const g = plankX(HEAD_D, th, 0.15, plankTone(), rand);
      g.translate(L + HEAD_D / 2, top - th / 2 + (rand() - 0.5) * 0.006, v + 0.075);
      parts.push(g);
    }
    // shore ramp: planks down to the ground
    const g0 = ground(-RAMP, 0) + 0.05;
    for (let u = -RAMP; u < -0.1; u += 0.165) {
      const t = (u + RAMP) / RAMP, y = g0 + (top - g0) * t;
      const g = plankZ(0.15, th, WALK_W + 0.08, plankTone(), rand);
      g.rotateZ(Math.atan2(top - g0, RAMP)).translate(u + 0.075, y - th / 2, 0);
      parts.push(g);
    }
    // stringers and the head's rim joists
    const joist = 0x6e604e;
    for (const v of [-0.72, 0, 0.72]) parts.push(plankX(L + 0.1, 0.2, 0.08, joist, rand).translate(L / 2, top - th - 0.1, v));
    for (const v of [-HEAD_W / 2 + 0.04, HEAD_W / 2 - 0.04]) parts.push(plankX(HEAD_D, 0.24, 0.08, joist, rand).translate(L + HEAD_D / 2, top - th - 0.12, v));
    for (const u of [L + 0.04, L + HEAD_D - 0.04]) parts.push(plankZ(0.08, 0.24, HEAD_W, joist, rand).translate(u, top - th - 0.12, 0));
    for (let v = -HEAD_W / 2 + 0.8; v < HEAD_W / 2; v += 0.8) parts.push(plankX(HEAD_D, 0.2, 0.07, joist, rand).translate(L + HEAD_D / 2, top - th - 0.1, v));
    // pilings: weathered above, dark and weedy below the waterline
    const pile = (u, v, extra = 0.0, r = 0.12) => {
      const bed = Math.min(-0.3, ground(u, v) - 0.4), wl = 0.12, topY = top + extra;
      const lower = new THREE.CylinderGeometry(r * 1.06, r * 1.12, wl - bed, 9).translate(u, (wl + bed) / 2, v);
      parts.push(part(lower, 0x2e3426, rand, 0.2, [1, (wl - bed) / 2]));
      const upper = new THREE.CylinderGeometry(r, r * 1.04, topY - wl, 9).translate(u, (topY + wl) / 2, v);
      parts.push(part(upper, 0x8a7c68, rand, 0.25, [1, (topY - wl) / 2]));
      if (extra > 0.1) parts.push(part(new THREE.CylinderGeometry(r * 0.75, r, 0.06, 9).translate(u, topY + 0.03, v), 0x7a6c5a, rand));
    };
    for (let u = 1.5; u < L - 0.5; u += 3) { pile(u, -WALK_W / 2 - 0.04); pile(u, WALK_W / 2 + 0.04); }
    for (const u of [L + 0.1, L + HEAD_D - 0.1]) for (const v of [-HEAD_W / 2, -WALK_W / 2 - 0.04, WALK_W / 2 + 0.04, HEAD_W / 2]) {
      const corner = Math.abs(v) > 2 && u > L + 1;
      pile(u, v, corner ? 0.55 : 0, corner ? 0.14 : 0.12);
    }
    // cross bracing between the head's outer pilings
    for (const v of [-HEAD_W / 2, HEAD_W / 2]) {
      const b = plankX(Math.hypot(HEAD_D - 0.2, 1.0), 0.12, 0.05, joist, rand);
      b.rotateZ(Math.atan2(1.0, HEAD_D - 0.2)).translate(L + HEAD_D / 2, top - 0.75, v + Math.sign(v) * 0.13);
      parts.push(b);
    }
    // bench on the head, facing out to sea
    const bu = L + HEAD_D - 1.0, bv = -HEAD_W / 2 + 1.2;
    for (const o of [-0.17, 0, 0.17]) parts.push(plankZ(0.15, 0.04, 1.6, 0xa8987e, rand).translate(bu + o, top + 0.44, bv));
    for (const s of [-0.7, 0.7]) for (const o of [-0.16, 0.16]) parts.push(plankX(0.07, 0.44, 0.07, 0x7a6a56, rand).translate(bu + o, top + 0.22, bv + s));
    parts.push(plankZ(0.04, 0.16, 1.6, 0xa8987e, rand).translate(bu - 0.3, top + 0.72, bv), plankZ(0.04, 0.16, 1.6, 0xa8987e, rand).translate(bu - 0.3, top + 0.9, bv));
    for (const s of [-0.7, 0.7]) parts.push(plankX(0.05, 0.52, 0.06, 0x7a6a56, rand).rotateZ(0.12).translate(bu - 0.27, top + 0.68, bv + s));
    // cleats along the head's sea edge
    const steel = 0x3c3e40;
    for (const v of [-1.8, 1.8]) {
      parts.push(part(new THREE.BoxGeometry(0.06, 0.06, 0.28), steel, rand, 0.1).translate(L + HEAD_D - 0.12, top + 0.06, v));
      parts.push(part(new THREE.BoxGeometry(0.05, 0.05, 0.06), steel, rand, 0.1).translate(L + HEAD_D - 0.12, top + 0.025, v));
    }
    // swim ladder off the end
    const lv = 1.1;
    for (const s of [-0.22, 0.22]) {
      parts.push(part(new THREE.CylinderGeometry(0.022, 0.022, top + 1.2, 6), 0x9aa0a6, rand, 0.05).translate(L + HEAD_D + 0.05, (top - 0.3) / 2, lv + s));
      parts.push(part(new THREE.TorusGeometry(0.2, 0.022, 5, 8, Math.PI).rotateY(Math.PI / 2).rotateZ(-Math.PI / 2), 0x9aa0a6, rand, 0.05).translate(L + HEAD_D - 0.15, top + 0.45, lv + s));
    }
    for (let k = 0; top - 0.25 - k * 0.32 > -0.6; k++) parts.push(part(new THREE.BoxGeometry(0.05, 0.03, 0.44), 0x9aa0a6, rand, 0.05).translate(L + HEAD_D + 0.05, top - 0.25 - k * 0.32, lv));
    // lamp post at the head's far corner
    const lu = L + HEAD_D - 0.25, lvv = HEAD_W / 2 - 0.25;
    parts.push(plankX(0.12, 2.4, 0.12, 0x6a5c4a, rand).translate(lu, top + 1.2, lvv));
    parts.push(part(new THREE.BoxGeometry(0.34, 0.05, 0.34), 0x2c2e30, rand, 0.05).translate(lu, top + 2.82, lvv));
    parts.push(part(new THREE.BoxGeometry(0.26, 0.04, 0.26), 0x2c2e30, rand, 0.05).translate(lu, top + 2.4, lvv));
    // a cooler and a bait bucket left on the deck
    parts.push(part(new THREE.BoxGeometry(0.62, 0.38, 0.4), 0xc8c4bc, rand, 0.05).translate(L + 0.7, top + 0.19, HEAD_W / 2 - 0.6));
    parts.push(part(new THREE.BoxGeometry(0.64, 0.06, 0.42), 0x2a5c8a, rand, 0.05).translate(L + 0.7, top + 0.41, HEAD_W / 2 - 0.6));
    parts.push(part(new THREE.CylinderGeometry(0.15, 0.13, 0.34, 12, 1, true), 0xd06a20, rand, 0.05).translate(L + 1.5, top + 0.17, HEAD_W / 2 - 0.5));

    const mesh = new THREE.Mesh(mergeGeometries(parts), this.wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(1);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.22), this.glassMat);
    glass.position.set(lu, top + 2.6, lvv);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this.bulbMat);
    bulb.position.set(lu, top + 2.6, lvv);
    glass.layers.enable(1); bulb.layers.enable(1);
    const grp = new THREE.Group();
    grp.add(mesh, glass, bulb);
    grp.position.set(d.x, 0, d.z);
    grp.rotation.y = d.yaw;
    return grp;
  }

  // deck height under a point, or null when it isn't on a dock
  deckAt(x, z) {
    for (const d of this.list) {
      const [u, v] = d.toLocal(x, z);
      if (u >= -0.1 && u <= d.len + 0.05 && Math.abs(v) <= WALK_W / 2) return d.deck;
      if (u > d.len && u <= d.len + HEAD_D && Math.abs(v) <= HEAD_W / 2) return d.deck;
      if (u >= -RAMP && u < -0.1 && Math.abs(v) <= WALK_W / 2) {
        const p = d.toWorld(-RAMP, 0), g0 = this.heightAt(p.x, p.z) + 0.05;
        return g0 + (d.deck - g0) * ((u + RAMP) / RAMP);
      }
    }
    return null;
  }

  // nearest dock and the closest standing spot on it
  nearest(x, z) {
    let best = null;
    for (const d of this.list) {
      const [u, v] = d.toLocal(x, z);
      // clamp to the T-head first, then the walkway
      const cu = THREE.MathUtils.clamp(u, d.len + 0.3, d.len + HEAD_D - 0.3), cv = THREE.MathUtils.clamp(v, -HEAD_W / 2 + 0.3, HEAD_W / 2 - 0.3);
      const wu = THREE.MathUtils.clamp(u, 0, d.len), wv = THREE.MathUtils.clamp(v, -WALK_W / 2 + 0.3, WALK_W / 2 - 0.3);
      for (const [pu, pv] of [[cu, cv], [wu, wv]]) {
        const dist = Math.hypot(u - pu, v - pv);
        if (!best || dist < best.dist) best = { dock: d, dist, point: d.toWorld(pu, pv), centre: Math.hypot(x - d.end.x, z - d.end.z) };
      }
    }
    return best;
  }

  update(night, pos) {
    if (!this.list.length) return;
    let best = this.list[0], bd = Infinity;
    for (const d of this.list) { const k = Math.hypot(d.lamp.x - pos.x, d.lamp.z - pos.z); if (k < bd) { bd = k; best = d; } }
    this.light.position.copy(best.lamp);
    this.light.intensity = night * 400;
    this.bulbMat.color.setRGB(0.54 + night * 7, 0.52 + night * 4.8, 0.47 + night * 2.4);
  }
}

import * as THREE from 'three';

// Solid things standing in the water (drowned trees, rig legs, docks) as circles on the water
// plane. The player's boat is treated as a capsule along its keel and pushed back out of any
// circle it overlaps, losing the speed it had into the obstacle.
const _f = new THREE.Vector3();

export class Obstacles {
  constructor() { this.list = []; }

  add(circles) { for (const c of circles) this.list.push(c); }

  // returns the speed of the hardest hit this step (0 if nothing was touched)
  resolve(body, length, beam) {
    const pos = body.pos, vel = body.vel;
    _f.set(1, 0, 0).applyQuaternion(body.quat);
    const fl = Math.hypot(_f.x, _f.z) || 1, fx = _f.x / fl, fz = _f.z / fl;
    const half = length * 0.45, rad = beam * 0.45, reach = half + rad;
    let hit = 0;
    for (const o of this.list) {
      const dx = o.x - pos.x, dz = o.z - pos.z;
      if (Math.abs(dx) > reach + o.r || Math.abs(dz) > reach + o.r) continue;
      const t = Math.max(-half, Math.min(half, dx * fx + dz * fz));
      let qx = pos.x + fx * t - o.x, qz = pos.z + fz * t - o.z;
      const d = Math.hypot(qx, qz), R = rad + o.r;
      if (d >= R) continue;
      if (d < 1e-4) { qx = -fz; qz = fx; } else { qx /= d; qz /= d; }
      pos.x += qx * (R - d);
      pos.z += qz * (R - d);
      const vn = vel.x * qx + vel.z * qz;
      if (vn < 0) {
        vel.x -= qx * vn * 1.25;
        vel.z -= qz * vn * 1.25;
        hit = Math.max(hit, -vn);
      }
    }
    if (hit > 0.3) body.angVel.multiplyScalar(0.7);
    return hit;
  }
}

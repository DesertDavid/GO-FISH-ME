import * as THREE from 'three';

// A forked lightning bolt drawn in the sky for a split second. Jagged by midpoint
// displacement with a couple of side branches; additive HDR lines so bloom and the
// exposure kick make it glare. One instance, re-rolled for every strike.
const MAX_SEG = 600;

export class LightningBolt {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_SEG * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.LineBasicMaterial({ color: new THREE.Color(5, 5.4, 7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.mesh = new THREE.LineSegments(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.n = 0;
  }

  seg(a, b) {
    if (this.n >= MAX_SEG) return;
    const p = this.pos, k = this.n++ * 6;
    p[k] = a.x; p[k + 1] = a.y; p[k + 2] = a.z; p[k + 3] = b.x; p[k + 4] = b.y; p[k + 5] = b.z;
  }

  bolt(a, b, off, depth, branch) {
    if (depth === 0) { this.seg(a, b); return; }
    const m = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    m.x += (Math.random() - 0.5) * off; m.z += (Math.random() - 0.5) * off; m.y += (Math.random() - 0.5) * off * 0.3;
    this.bolt(a, m, off * 0.5, depth - 1, branch);
    this.bolt(m, b, off * 0.5, depth - 1, branch);
    if (branch && depth > 2 && Math.random() < 0.28) {
      const e = new THREE.Vector3((Math.random() - 0.5) * off * 3, -off * (1 + Math.random() * 2), (Math.random() - 0.5) * off * 3).add(m);
      this.bolt(m, e, off * 0.6, depth - 2, false);
    }
  }

  // cloud-to-ground strike `dist` m from `origin` towards azimuth `az` (xz angle, radians)
  strike(origin, az, dist, groundY = 0) {
    this.n = 0;
    const top = new THREE.Vector3(origin.x + Math.cos(az) * dist, 620 + Math.random() * 300, origin.z + Math.sin(az) * dist);
    const bot = new THREE.Vector3(top.x + (Math.random() - 0.5) * 120, groundY, top.z + (Math.random() - 0.5) * 120);
    this.bolt(top, bot, 160 + dist * 0.02, 6, true);
    // a sheet of sideways cloud-lightning at the top
    const side = new THREE.Vector3(top.x + (Math.random() - 0.5) * 700, top.y + 30, top.z + (Math.random() - 0.5) * 700);
    this.bolt(top, side, 90, 4, false);
    const g = this.mesh.geometry;
    g.setDrawRange(0, this.n * 2);
    g.attributes.position.needsUpdate = true;
    this.mesh.visible = true;
  }

  set opacity(v) {
    this.mat.opacity = v;
    this.mesh.visible = v > 0.01 && this.n > 0;
  }
}

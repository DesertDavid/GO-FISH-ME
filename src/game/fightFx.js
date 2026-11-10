import * as THREE from 'three';
import { FEEL } from './fightFeel.js';

// Small world-space effects for the fight: spray, drips, foam (point particles) and the whipping
// line / flying lure when a line parts or a hook lets go. Everything is pooled; one draw call for
// the particles, one line + one mesh for the snap.
const MAX = 360;
const _v = new THREE.Vector3();

export class FightFx {
  constructor(scene) {
    this.scene = scene;
    this.n = 0;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.max = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.sz = new Float32Array(MAX);
    this.drift = new Float32Array(MAX);   // foam: stays on the surface
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, aSize * uScale / max(0.2, -mv.z)); vA = aAlpha; }`,
      fragmentShader: `varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0;
        float a = smoothstep(1.0, 0.35, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(0.93, 0.97, 1.0, a); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // the line whipping back after a snap, and the lure that comes with it
    this.whip = null;
    this.whipGeo = new THREE.BufferGeometry();
    this.whipGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(26 * 3), 3));
    this.whipMat = new THREE.LineBasicMaterial({ color: 0xe8f0f0, transparent: true, opacity: 0.9 });
    this.whipLine = new THREE.Line(this.whipGeo, this.whipMat);
    this.whipLine.frustumCulled = false;
    this.whipLine.visible = false;
    this.flyLure = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 6).scale(2.2, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe86020, roughness: 0.3, metalness: 0.4 }));
    this.flyLure.visible = false;
    scene.add(this.whipLine, this.flyLure);
  }

  // kind: 'spray' (fine mist off the line), 'drop' (heavy drip), 'foam' (flat on the surface), 'splash' (burst)
  emit(kind, p, v = null, scale = 1) {
    if (this.n >= MAX) return;
    const i = this.n++, k = i * 3;
    this.pos[k] = p.x; this.pos[k + 1] = p.y; this.pos[k + 2] = p.z;
    const r = Math.random;
    const fine = kind === 'spray', foam = kind === 'foam';
    const sp = foam ? 0.12 : fine ? 0.9 : 1.6 * scale;
    this.vel[k] = (v ? v.x : 0) + (r() - 0.5) * sp;
    this.vel[k + 1] = foam ? 0 : (v ? v.y : 0) + (kind === 'drop' ? 0 : r() * sp * (kind === 'splash' ? 1.8 : 0.9));
    this.vel[k + 2] = (v ? v.z : 0) + (r() - 0.5) * sp;
    this.max[i] = this.life[i] = foam ? 0.9 + r() * 0.8 : fine ? 0.35 + r() * 0.3 : 0.5 + r() * 0.5;
    this.grav[i] = foam ? 0 : fine ? 2.5 : 9.8;
    this.sz[i] = (foam ? 0.12 + r() * 0.12 : fine ? 0.012 + r() * 0.012 : 0.016 + r() * 0.018) * (foam ? scale : 1);
    this.drift[i] = foam ? 1 : 0;
  }

  burst(kind, p, n, v, scale) { for (let i = 0; i < n; i++) this.emit(kind, p, v, scale); }

  // line parts / hook pulls: the line whips from the fish end back toward the rod tip
  snap(tip, end, lureColor = null) {
    const pts = [];
    for (let i = 0; i < 26; i++) {
      const s = i / 25, p = new THREE.Vector3().lerpVectors(tip, end, s);
      // the free end moves fastest toward the tip; a little side curl so it whips
      const toTip = _v.subVectors(tip, p).normalize();
      const v = toTip.clone().multiplyScalar(FEEL.flyBack.speed * (0.35 + 0.65 * s) * (0.8 + Math.random() * 0.4));
      v.x += (Math.random() - 0.5) * 3 * s; v.y += (Math.random() - 0.2) * 3 * s; v.z += (Math.random() - 0.5) * 3 * s;
      pts.push({ p, v });
    }
    this.whip = { pts, t: 0, tip: tip.clone() };
    if (lureColor != null) { this.flyLure.material.color.setHex(lureColor); this.flyLure.visible = true; }
    this.whipLine.visible = true;
  }

  update(dt, camera, tip) {
    this.mat.uniforms.uScale.value = innerHeight * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const pa = this.geo.attributes.position.array, sa = this.geo.attributes.aSize.array, aa = this.geo.attributes.aAlpha.array;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;   // swap in the last live particle
        if (j !== i) {
          for (let c = 0; c < 3; c++) { this.pos[i * 3 + c] = this.pos[j * 3 + c]; this.vel[i * 3 + c] = this.vel[j * 3 + c]; }
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.grav[i] = this.grav[j]; this.sz[i] = this.sz[j]; this.drift[i] = this.drift[j];
        }
        i--;
        continue;
      }
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    for (let i = 0; i < this.n; i++) {
      const k = i * 3, f = this.life[i] / this.max[i];
      pa[k] = this.pos[k]; pa[k + 1] = this.pos[k + 1]; pa[k + 2] = this.pos[k + 2];
      sa[i] = this.sz[i] * (this.drift[i] ? 1 + (1 - f) * 2 : 1);
      aa[i] = this.drift[i] ? 0.5 * f : Math.min(1, f * 2) * 0.8;
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.aSize.needsUpdate = this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.setDrawRange(0, this.n);

    const w = this.whip;
    if (w) {
      w.t += dt;
      const arr = this.whipGeo.attributes.position.array;
      const life = FEEL.flyBack.life;
      for (let i = 0; i < w.pts.length; i++) {
        const { p, v } = w.pts[i];
        v.y -= 6 * dt;
        v.multiplyScalar(Math.exp(-dt * 1.8));
        p.addScaledVector(v, dt);
        arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
      }
      // the anchored end stays at the rod tip
      if (tip) w.tip.copy(tip);
      arr[0] = w.tip.x; arr[1] = w.tip.y; arr[2] = w.tip.z;
      this.whipGeo.attributes.position.needsUpdate = true;
      this.whipMat.opacity = 0.9 * Math.max(0, 1 - w.t / life);
      if (this.flyLure.visible) { const e = w.pts[w.pts.length - 1].p; this.flyLure.position.copy(e); this.flyLure.rotation.z += dt * 14; }
      if (w.t > life) { this.whip = null; this.whipLine.visible = false; this.flyLure.visible = false; }
    }
  }
}

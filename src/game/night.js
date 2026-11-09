import * as THREE from 'three';

// Night dressing: a starfield, the boat's white anchor light (a real point light, so the deck
// and nearby props pick it up) and a glowing bobber tip. Everything scales with the night
// level from Game.nightLevel().
const STARS = 2600;

export class NightFX {
  constructor(ctx) {
    this.ctx = ctx;
    // stars on a big dome, denser and brighter toward the zenith
    const pos = new Float32Array(STARS * 3), col = new Float32Array(STARS * 3);
    let seed = 1234567;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < STARS; i++) {
      const u = rand(), v = Math.pow(rand(), 0.7);
      const az = u * Math.PI * 2, el = Math.asin(0.04 + 0.96 * v);
      const R = 30000;
      pos[i * 3] = Math.cos(el) * Math.cos(az) * R;
      pos[i * 3 + 1] = Math.sin(el) * R;
      pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * R;
      const b = 0.35 + Math.pow(rand(), 3) * 1.6, warm = rand();
      col[i * 3] = b * (0.85 + 0.15 * warm); col[i * 3 + 1] = b * 0.92; col[i * 3 + 2] = b * (1 - 0.12 * warm);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    this.stars.layers.enable(1);   // reflected in calm water
    ctx.scene.add(this.stars);

    // anchor light: a bulb on a short mast plus the light itself
    this.light = new THREE.PointLight(0xfff1dc, 0, 28, 2);
    this.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) }));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x9a9da2, metalness: 0.8, roughness: 0.35 }));
    pole.position.y = -0.78;
    this.bulb.add(pole);
    ctx.scene.add(this.light, this.bulb);
  }

  update(n, camera) {
    const c = this.ctx;
    this.stars.position.copy(camera.position);
    this.starMat.opacity = n * (1 - 0.8 * (c.cloudCover ? c.cloudCover() : 0));
    this.stars.visible = this.starMat.opacity > 0.01;
    // anchor light on its pole at the far end of the boat from where the angler stands
    const boat = c.boat;
    if (boat?.body) {
      const h = boat.hull, end = (boat.spec.eye || 0) < 0 ? 1 : -1;
      boat.toWorld(new THREE.Vector3(end * h.length * 0.44, h.depth * 0.5 + 1.5, 0), this.bulb.position);
      this.bulb.quaternion.copy(boat.body.quat);
      this.light.position.copy(this.bulb.position);
    }
    this.light.intensity = n * 9;
    this.bulb.visible = n > 0.05;
    // the bobber's red top glows (a night float)
    const top = c.rod?.bobber?.children[0];
    if (top) {
      top.material.emissive.setRGB(1, 0.12, 0.05);
      top.material.emissiveIntensity = n * 2.5;
    }
  }
}

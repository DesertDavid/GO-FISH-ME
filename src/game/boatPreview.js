import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyCustom } from './boatVisual.js';

// The turntable in the customization screen: its own small renderer, the boat on a plinth, drag to turn.
const loader = new GLTFLoader();
const cache = new Map();
const load = (id) => { if (!cache.has(id)) cache.set(id, loader.loadAsync(`${import.meta.env.BASE_URL}models/boats/${id}.glb`)); return cache.get(id); };

export class BoatPreview {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'yardCanvas';
    this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(-6, 9, 5); this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xcfe6f2, 0x20303a, 0.6));
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 400);
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
    this.plinth = new THREE.Group(); this.scene.add(this.plinth);
    this.yaw = -0.75; this.pitch = 0.22; this.auto = true; this.running = false;
    this.id = null; this.model = null; this.fx = null; this.token = 0;
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY }; this.auto = false; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (!this.drag) return; this.yaw -= (e.clientX - this.drag.x) * 0.008; this.pitch = Math.max(0.02, Math.min(0.7, this.pitch + (e.clientY - this.drag.y) * 0.004)); this.drag = { x: e.clientX, y: e.clientY }; });
    c.addEventListener('pointerup', () => { this.drag = null; this.idle = 0; });
  }

  async show(id, cfg, up) {
    const tok = ++this.token;
    if (id !== this.id) {
      const gltf = await load(id);
      if (tok !== this.token) return;
      if (this.model) this.pivot.remove(this.model);
      this.model = gltf.scene.clone(true);
      this.model.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
      this.pivot.add(this.model);
      this.id = id;
      this.frame(id);
    }
    this.fx = applyCustom(this.model, id, cfg, up);
  }

  // refresh paint / name / parts without reloading
  update(cfg, up) { if (this.model) this.fx = applyCustom(this.model, this.id, cfg, up); }

  frame(id) {
    const box = new THREE.Box3().setFromObject(this.model), size = box.getSize(new THREE.Vector3()), L = size.x;
    this.model.position.set(0, 0.28 * Math.max(0.4, L / 8), 0);
    this.pivot.position.set(0, 0, 0);
    this.dist = Math.max(L * 1.02, size.y * 2.7);
    this.target = new THREE.Vector3(0, size.y * 0.42 + this.model.position.y, 0);
    // plinth: a low steel disc with two keel blocks
    this.plinth.clear();
    const R = L * 0.62, base = this.model.position.y;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, 0.1 * Math.max(0.5, L / 8), 64), new THREE.MeshStandardMaterial({ color: 0x20282e, roughness: 0.55, metalness: 0.5 }));
    disc.position.y = -0.05 * Math.max(0.5, L / 8);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.96, 0.012 * Math.max(0.5, L / 8), 6, 96), new THREE.MeshStandardMaterial({ color: 0xe9b25b, emissive: 0xe9b25b, emissiveIntensity: 0.5 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.002;
    this.plinth.add(disc, ring);
    for (const x of [-L * 0.22, L * 0.18]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(L * 0.14, base, Math.max(0.3, size.z * 0.14)), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 }));
      b.position.set(x, base / 2, 0); this.plinth.add(b);
    }
  }

  resize() {
    const w = this.canvas.clientWidth || 640, h = this.canvas.clientHeight || 360;
    if (this.canvas.width !== Math.round(w * this.r.getPixelRatio())) { this.r.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }

  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
      if (!this.canvas.isConnected) { this.running = false; return; }   // the screen was closed or redrawn elsewhere
      if (!this.model) return;
      this.resize();
      if (!this.auto && !this.drag) { this.idle = (this.idle || 0) + dt; if (this.idle > 3) this.auto = true; }
      if (this.auto) this.yaw += dt * 0.35;
      this.pivot.rotation.y = 0;
      const d = this.dist, p = this.pitch;
      this.camera.position.set(Math.sin(this.yaw) * Math.cos(p) * d, this.target.y + Math.sin(p) * d, Math.cos(this.yaw) * Math.cos(p) * d);
      this.camera.lookAt(this.target);
      this.r.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}

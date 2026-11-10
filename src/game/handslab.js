// Dev page: the first-person rod with either set of hands, from a free camera, for tuning poses and
// taking the comparison shots. ?hands=1|2  Hook: window.__lab.shot({ view, hold, spin, holster, load })
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rod } from './rod.js';
import { RODS } from './gear.js';
import { T } from './hands2.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.setClearColor(0x6f8ea6);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), overlay = new THREE.Scene();
scene.background = new THREE.Color(0x6f8ea6);
overlay.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6); sun.position.set(-1, 2, 1.5);
overlay.add(sun, new THREE.HemisphereLight(0xcfe3ff, 0x6a5a48, 0.9));
const rod = new Rod(overlay, scene);
const key = Object.keys(RODS)[1];
rod.setGear(RODS[key], { color: 0xe8f0f0 }, { color: 0xe86020 });
const fp = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.02, 60);   // the angler's eye (drives the rod)
fp.updateMatrixWorld();
const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 60);
const handsReady = rod.hands.ready || Promise.resolve();

function shot(o = {}) {
  const h = rod.hands;
  h.right.visible = o.only !== 'L'; h.left.visible = o.only !== 'R'; h.arm.visible = !o.only || o.only === 'L';
  rod.holster = o.holster ?? 0;
  rod.reelSpin = o.spin ?? 0;
  rod.load = o.load ?? 0;
  for (let i = 0; i < 40; i++) rod.update(0.016, fp, { side: 0, lift: 0.3, tension: 0, reeling: false, load: o.load ?? 0 });
  rod.reelSpin = o.spin ?? 0;
  rod.update(0.016, fp, { side: 0, lift: 0.3, tension: (o.load ?? 0) * 40, reeling: false, load: o.load ?? 0 });
  rod.group.updateMatrixWorld(true);
  if (o.pos) {
    const H = rod.handle;
    const P = (a) => (o.rel ? H.localToWorld(new THREE.Vector3(...a)) : new THREE.Vector3(...a));
    cam.position.copy(P(o.pos));
    cam.up.copy(o.rel ? new THREE.Vector3(...(o.up || [0, 1, 0])).transformDirection(H.matrixWorld) : new THREE.Vector3(...(o.up || [0, 1, 0])));
    cam.lookAt(P(o.look || [0, 0, 0.07]));
    cam.fov = o.fov || 35;
  } else {   // the real first-person view
    cam.position.copy(fp.position); cam.quaternion.copy(fp.quaternion); cam.fov = 60;
  }
  cam.updateProjectionMatrix();
  renderer.render(overlay, cam);
}
window.__lab = { rod, T, shot, ready: handsReady.then(() => true), THREE, overlay, renderer, cam };
handsReady.then(() => { shot({}); document.title = 'ready'; });

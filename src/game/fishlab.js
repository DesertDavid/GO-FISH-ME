// Dev page: a grid of procedural fish for checking models and skins. ?morph=albino&start=0
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SPECIES, MORPH_BY_ID } from './species.js';
import { buildFish } from './fishMesh.js';

const args = new URLSearchParams(location.search);
const morph = MORPH_BY_ID[args.get('morph') || 'normal'];
const start = +(args.get('start') || 0), count = +(args.get('n') || 30);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2630);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(1, 2, 3); scene.add(sun);
const cols = +(args.get('cols') || 6);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, +(args.get('dist') || 13));
const fish = [];
// ?ids=pike,mako,halibut picks specific species instead of a range
const list = args.get('ids') ? args.get('ids').split(',').map((id) => SPECIES.find((s) => s.id === id)).filter(Boolean) : SPECIES.slice(start, start + count);
list.forEach((sp, i) => {
  const f = buildFish(sp, morph);
  const rows = Math.ceil(count / cols);
  f.group.position.set((i % cols - (cols - 1) / 2) * 1.35, -(Math.floor(i / cols) - (rows - 1) / 2) * 1.1, 0);
  if (!f.body.flatfish) f.group.rotation.y = +(args.get('ry') ?? -0.35);
  f.group.rotation.x += +(args.get('rx') || 0);
  scene.add(f.group);
  fish.push(f);
});
renderer.setAnimationLoop((t) => {
  for (const f of fish) f.uniforms.uSwim.value.x = t / 1000;
  renderer.render(scene, camera);
});

// dev: render one frame at a fixed size and POST it to a local receiver (for reviewing models)
window.__shot = async (name, w = 1600, h = 1000, url = 'http://127.0.0.1:5300/') => {
  const [ow, oh] = [innerWidth, innerHeight];
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const data = renderer.domElement.toDataURL('image/png');
  renderer.setSize(ow, oh);
  camera.aspect = ow / oh;
  camera.updateProjectionMatrix();
  const r = await fetch(url + name, { method: 'POST', body: data });
  return r.ok;
};

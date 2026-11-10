// Dev page: every real wildlife model in a row with its clips playing. ?kinds=duck,moose&clip=walk&dist=14
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadKinds, makeAnimal } from './wildlifeModels.js';

const args = new URLSearchParams(location.search);
const kinds = (args.get('kinds') || 'dolphin,turtle,duck,duckwalk,hippo,moose,wolf,bear,pelican,gator,whale').split(',');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6d7f8c);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 400);
await loadKinds(kinds);
const out = [];
let x = 0;
for (const k of kinds) {
  const an = makeAnimal(k);
  if (!an) { out.push(k + ': FAILED'); continue; }
  const w = { whale: 16, gator: 4.2, hippo: 4, moose: 3.4, bear: 2.4, dolphin: 3, turtle: 1.6 }[k] || 1.4;   // (Box3 of a skinned mesh is its bind pose, not what is drawn)
  x += w / 2;
  an.root.position.set(x, k === 'dolphin' || k === 'whale' || k === 'gator' || k === 'turtle' ? 1.5 : 0, 0);
  an.root.rotation.y = +(args.get('ry') ?? -0.5);
  x += w / 2;
  scene.add(an.root);
  const per = (args.get('clips') || '').split(',')[kinds.indexOf(k, 0) === kinds.lastIndexOf(k) ? 0 : out.length] ;
  const want = per || args.get('clip');
  const clip = want && an.clips.includes(want) ? want : an.clips[0];
  if (clip) an.play(clip, 0);
  if (an.mixer) an.mixer.setTime(1.0);
  out.push(`${k}: clips [${an.clips}]`);
  scene.userData[k] = an;
}
scene.children.forEach((c) => { if (c.isGroup) c.position.x -= x / 2; });
camera.position.set(0, +(args.get('h') || 1.8), +(args.get('dist') || x * 1.1));
camera.lookAt(0, +(args.get('ly') || 1), 0);
window.__wild = { out, scene };
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = (now - last) / 1000; last = now;
  for (const a of Object.values(scene.userData)) a.mixer?.update(dt);
  renderer.render(scene, camera);
});

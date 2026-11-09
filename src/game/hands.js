import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// First-person hands, modelled in Blender (tools/blender/build_hands.py). The model is built in
// the rod handle's frame (+z along the rod toward the tip, +y up, +x to the angler's left):
// HandR wraps the grip with the reel stem between its middle and ring fingers, HandL closes
// round the crank knob (its origin is the knob centre) and circles with it.
const loader = new GLTFLoader();

function dress(node) {
  node.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material?.name || '';
    if (name.startsWith('Skin')) {
      o.material = new THREE.MeshPhysicalMaterial({
        vertexColors: !!o.geometry.attributes.color,
        color: o.geometry.attributes.color ? 0xe0d2c8 : 0xb47c5e,
        roughness: 0.55,
        sheen: 0.12, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xd06048),   // a little warm scatter at the edges
        envMapIntensity: 0.6,
      });
    } else if (name.startsWith('Nail')) {
      o.material = new THREE.MeshStandardMaterial({ color: 0xb98272, roughness: 0.5, envMapIntensity: 0.25 });
    } else if (name.startsWith('Sleeve')) {
      o.material = new THREE.MeshStandardMaterial({ color: 0x1f5f6a, roughness: 0.88 });
    }
    o.frustumCulled = false;
  });
  return node;
}

export class Hands {
  constructor(rod) {
    this.rod = rod;
    this.right = new THREE.Group();
    this.left = new THREE.Group();
    rod.handle.add(this.right);
    rod.group.add(this.left);
    this.knob = new THREE.Vector3();
    loader.loadAsync(`${import.meta.env.BASE_URL}models/hands.glb`).then((gltf) => {
      const r = gltf.scene.getObjectByName('HandR'), l = gltf.scene.getObjectByName('HandL');
      if (r) this.right.add(dress(r));
      if (l) this.left.add(dress(l));
    });
  }

  // left hand follows the crank knob, keeping the handle's orientation
  update() {
    const rod = this.rod;
    rod.handle.updateMatrixWorld(true);
    rod.knob.getWorldPosition(this.knob);
    this.left.position.copy(this.knob);
    this.left.quaternion.copy(rod.handle.quaternion);
  }
}

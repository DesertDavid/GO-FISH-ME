import * as THREE from 'three';
import { loadJelly, Jelly, rodHandTargets } from './jelly.js';

// First-person "jellybean" arms: the stylised angler's two arms (capsule limbs, rolled knit cuffs, ball hands) reaching
// from just below the eye onto the rod's grip and the real crank knob. Same public surface as Hands/Hands2:
// left, right, arm, update(camera). The ball on the grip swallows the handle; the ball on the knob rides the crank circle,
// pulled down and shaken under load (fightFeel.js), and everything follows the rod when it is put away.
const FP_SCALE = 1.0;           // same size as the model; shoulders are far apart and low so the arms come up from the bottom corners
const SHOULDER_DROP = 0.30;     // shoulders sit this far under the eye (camera space)
const SHOULDER_BACK = -0.06;
const _cq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _y = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const _v = new THREE.Vector3(), _R = new THREE.Vector3(), _L = new THREE.Vector3(), _po = new THREE.Vector3();

export class Hands3 {
  constructor(rod) {
    this.rod = rod;
    this.right = new THREE.Group();   // kept for the shared interface (landing.js looks at left.children[0])
    this.left = new THREE.Group();
    this.arm = new THREE.Group();
    this.jelly = null;
    this.ready = loadJelly().then((src) => {
      this.jelly = new Jelly(src);
      this.jelly.armsOnly(true, 0.22);
      this.jelly.root.scale.setScalar(FP_SCALE);
      rod.group.add(this.jelly.root);
    });
  }

  setVisible(v) { if (this.jelly) this.jelly.root.visible = v; }

  // a ball hand for the landing animation (landing.js clones left.children[0] for v1/v2; here it asks for this)
  cloneLeft() {
    if (!this.jelly) return null;
    const src = this.jelly.j.arm_hand_L;
    const g = new THREE.Group();
    const geo = src.geometry.clone();
    const c = new THREE.Vector3().copy(this.jelly.j.HandBall_L.position);   // ball centre relative to the wrist, y only matters
    geo.computeBoundingBox();
    geo.boundingBox.getCenter(_v);
    geo.translate(-_v.x, -_v.y, -_v.z);
    g.add(new THREE.Mesh(geo, src.material));
    return g;
  }

  update(camera) {
    const J = this.jelly, rod = this.rod;
    if (!J || !camera) return;
    camera.updateMatrixWorld();
    camera.getWorldQuaternion(_cq);
    // root so the shoulder midpoint is at (0, -SHOULDER_DROP, -SHOULDER_BACK) in camera space; the model faces +Z, the camera -Z
    _rq.copy(_cq).multiply(_y);
    J.root.quaternion.copy(_rq);
    _v.set(0, -SHOULDER_DROP, SHOULDER_BACK).applyQuaternion(_cq).add(camera.position);
    J.root.position.copy(_v).addScaledVector(_po.set(0, 1.15 * FP_SCALE, 0).applyQuaternion(_rq), -1);
    J.root.updateMatrixWorld(true);
    rodHandTargets(rod, _R, _L);
    // elbows bend outward and down (camera space)
    J.solveArm('R', _R, _po.set(0.55, -1, 0.35).applyQuaternion(_cq));
    J.solveArm('L', _L, _po.set(-0.55, -1, 0.35).applyQuaternion(_cq));
  }
}

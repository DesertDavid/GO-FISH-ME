import * as THREE from 'three';
import { makeHands } from './hands.js';
import { RODS } from './gear.js';
import { FEEL } from './fightFeel.js';

// First-person rod (overlay scene, drawn over the world with its own depth) + fishing line
// and terminal tackle (main scene). The blank is a tapered tube rebuilt every frame along a
// progressive bend toward the line.
const N = 28, RING = 7;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

export class Rod {
  constructor(overlayScene, scene) {
    this.overlay = overlayScene;
    this.scene = scene;
    this.points = Array.from({ length: N + 1 }, () => new THREE.Vector3());
    this.tip = new THREE.Vector3();
    this.butt = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, -1);
    this.reelSpin = 0;
    this.twitch = 0;
    this.castAnim = 0;
    this.holster = 0;   // 0 held .. 1 lowered out of view (set by the game)
    // bend spring (see fightFeel.js): x = how far the blank is loaded, v = its speed
    this.bendX = 0;
    this.bendV = 0;
    this.flex = FEEL.rodDefault;
    this.load = 0;       // 0..1 line load, read by the hands (crank resistance)
    this.shake = new THREE.Vector3();   // hand tremor offset in camera space (m)
    this.shakeT = 0;

    // blank
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * RING * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((N + 1) * RING * 3), 3));
    const idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < RING; j++) {
      const a = i * RING + j, b = i * RING + ((j + 1) % RING), c = a + RING, d = b + RING;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    this.blankMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.25, metalness: 0.4 });
    this.blank = new THREE.Mesh(g, this.blankMat);
    this.blank.frustumCulled = false;

    // handle + reel (built along +z, oriented each frame)
    this.handle = new THREE.Group();
    const cork = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 });
    const black = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4, metalness: 0.5 });
    const alu = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 1 });
    this.reelMat = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.3, metalness: 0.7 });
    const cyl = (r1, r2, len, mat, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 16).rotateX(Math.PI / 2), mat);
      m.position.z = z;
      return m;
    };
    this.handle.add(cyl(0.016, 0.014, 0.3, cork, -0.12), cyl(0.013, 0.012, 0.09, black, 0.075), cyl(0.012, 0.011, 0.12, cork, 0.18));
    this.reel = new THREE.Group();
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.03), black);
    foot.position.set(0, -0.04, 0.07);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12).scale(1, 1, 1.2), this.reelMat);
    body.position.set(0, -0.085, 0.07);
    this.spool = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.035, 20).rotateX(Math.PI / 2), alu);
    this.spool.position.set(0, -0.085, 0.115);
    const lineOnSpool = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.022, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8f0f0, roughness: 0.6 }));
    lineOnSpool.position.copy(this.spool.position).add(new THREE.Vector3(0, 0, 0.004));
    this.lineOnSpool = lineOnSpool;
    this.crank = new THREE.Group();
    this.crank.position.set(0.042, -0.085, 0.07);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.06, 0.008), alu);
    arm.position.y = 0.03;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.025, 10).rotateZ(Math.PI / 2), black);
    knob.position.set(0.015, 0.06, 0);
    this.knob = knob;
    this.crank.add(arm, knob);
    this.reel.add(foot, body, this.spool, lineOnSpool, this.crank);
    this.handle.add(this.reel);
    this.group = new THREE.Group();
    this.group.add(this.blank, this.handle);
    this.guides = [];
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008 - i * 0.0009, 0.0014, 5, 10), alu);
      this.guides.push(ring);
      this.group.add(ring);
    }
    overlayScene.add(this.group);
    this.hands = makeHands(this);

    // line (main scene)
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xe8f0f0, transparent: true, opacity: 0.85 });
    this.line = new THREE.Line(this.lineGeo, this.lineMat);
    this.line.frustumCulled = false;
    scene.add(this.line);
    // overlay copy of the first few metres so the line meets the tip cleanly
    this.nearLineGeo = new THREE.BufferGeometry();
    this.nearLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    this.nearLine = new THREE.Line(this.nearLineGeo, this.lineMat);
    this.nearLine.frustumCulled = false;
    overlayScene.add(this.nearLine);

    // bobber + lure (main scene)
    this.bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe02020, roughness: 0.35 }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.35 }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0xe02020 }));
    stem.position.y = 0.08;
    this.bobber.add(top, bot, stem);
    this.lureMat = new THREE.MeshStandardMaterial({ color: 0xe86020, roughness: 0.3, metalness: 0.4 });
    this.lure = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8).scale(2.2, 1, 1), this.lureMat);
    scene.add(this.bobber, this.lure);
    this.bobber.visible = this.lure.visible = false;
    this.lineVisible = false;
  }

  setGear(rod, line, lure) {
    this.blankMat.color.setHex(rod.color);
    this.lineMat.color.setHex(line.color);
    this.lineOnSpool.material.color.setHex(line.color);
    this.lureMat.color.setHex(lure.color);
    this.length = rod.len;
    this.power = rod.power;
    const id = Object.keys(RODS).find((k) => RODS[k] === rod);
    this.flex = FEEL.rods[id] || FEEL.rodDefault;
  }

  // a snap or a hook coming out: the rod loses its load at once and whips past straight
  kick(amount) { this.bendV -= amount * 6; }

  // pose: { side -1..1, lift 0..1, tension lb, target (Vector3|null), reeling bool }
  update(dt, camera, pose) {
    const L = this.length || 2;
    this.castAnim = Math.max(0, this.castAnim - dt * 3);
    this.twitch *= Math.exp(-dt * 8);
    // butt in the right hand, low; rod raised and swung by pose
    const h = this.holster;
    this.butt.set(0.15 + pose.side * 0.08 - h * 0.1, -0.22 - h * 0.85, -0.4 + h * 0.15).applyMatrix4(camera.matrixWorld);
    if (pose.shakeAmp) {
      this.shakeT += dt * FEEL.cam.freq;
      const a = pose.shakeAmp;
      this.shake.set(Math.sin(this.shakeT * 1.3) * a, Math.sin(this.shakeT * 1.9 + 1) * a * 0.7, Math.sin(this.shakeT * 0.9 + 2) * a * 0.5);
      this.butt.add(_d.copy(this.shake).applyQuaternion(camera.quaternion));
    } else this.shake.set(0, 0, 0);
    const back = pose.charge || 0;
    const local = _a.set(0.12 + pose.side * 0.7, 0.42 + pose.lift * 0.75 + back * 1.6 - this.castAnim * 0.4 - this.twitch - h * 1.5, -1).normalize();
    this.dir.copy(local).transformDirection(camera.matrixWorld);
    // bend toward the line: a damped spring on the load. Tip-loaded (act), stiffer per rod tier, and it
    // overshoots (whips) when the load goes away
    const fx = this.flex, B = FEEL.bend;
    const target = Math.min(B.max, ((pose.tension || 0) / Math.max(1, this.power)) * B.gain * fx.soft + this.twitch * 0.6);
    const w = fx.hz * 2 * Math.PI / Math.sqrt(Math.max(0.6, L / 1.9)), z2 = 2 * fx.zeta * w;
    for (let n = Math.max(1, Math.ceil(dt / 0.008)), i = 0, h = dt / n; i < n; i++) {
      this.bendV += (w * w * (target - this.bendX) - z2 * this.bendV) * h;
      this.bendX += this.bendV * h;
    }
    this.bendX = Math.max(-B.whip, Math.min(B.max + 0.2, this.bendX));
    const bend = this.bendX;
    const toLine = pose.target ? _b.subVectors(pose.target, this.butt).normalize() : _b.copy(this.dir).setY(this.dir.y - 0.6).normalize();
    const p = this.points;
    p[0].copy(this.butt).addScaledVector(this.dir, 0.24);
    const seg = (L - 0.24) / N;
    for (let i = 1; i <= N; i++) {
      const s = i / N;
      const k = Math.max(-0.7, Math.min(0.97, bend * Math.pow(s, fx.act) * 1.15));
      _c.copy(this.dir).lerp(toLine, k).normalize();
      // gravity sag on long soft tips
      _c.y -= 0.04 * s * s;
      p[i].copy(p[i - 1]).addScaledVector(_c.normalize(), seg);
    }
    this.tip.copy(p[N]);
    this.buildBlank();

    // handle frame: z along rod, y roughly world up
    const z = this.dir, x = _c.crossVectors(new THREE.Vector3(0, 1, 0), z).normalize(), y = _d.crossVectors(z, x);
    _m.makeBasis(x, y, z);
    this.handle.quaternion.setFromRotationMatrix(_m);
    this.handle.position.copy(this.butt);
    this.load = pose.load || 0;
    if (pose.reeling) this.reelSpin += dt * 14 * (pose.reelRate ?? 1);
    this.crank.rotation.x = this.reelSpin;
    this.spool.rotation.z = pose.lineOut ? -this.reelSpin * 0.3 : 0;

    for (let i = 0; i < this.guides.length; i++) {
      const k = Math.round(((i + 1) / (this.guides.length + 0.6)) * N);
      const a = p[k], b = p[Math.min(N, k + 1)];
      const g = this.guides[i];
      g.position.copy(a).addScaledVector(y, -0.008);
      g.lookAt(b);
    }
    this.hands.update();
  }

  buildBlank() {
    const pos = this.blank.geometry.attributes.position, nrm = this.blank.geometry.attributes.normal;
    const p = this.points;
    const up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      t.subVectors(p[Math.min(N, i + 1)], p[Math.max(0, i - 1)]).normalize();
      n1.crossVectors(t, up).normalize();
      n2.crossVectors(n1, t).normalize();
      const r = THREE.MathUtils.lerp(0.0085, 0.0016, i / N) * (0.8 + Math.min(1, (this.power || 12) / 60) * 0.6);
      for (let j = 0; j < RING; j++) {
        const a = (j / RING) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const nx = n1.x * c + n2.x * s, ny = n1.y * c + n2.y * s, nz = n1.z * c + n2.z * s;
        const k = (i * RING + j) * 3;
        pos.array[k] = p[i].x + nx * r; pos.array[k + 1] = p[i].y + ny * r; pos.array[k + 2] = p[i].z + nz * r;
        nrm.array[k] = nx; nrm.array[k + 1] = ny; nrm.array[k + 2] = nz;
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
  }

  // line from the tip to `end` (world), sagging by `slack` (0 tight .. 1 loose). surfaceY: the
  // line runs straight down from where it enters the water.
  updateLine(end, slack, entry) {
    const arr = this.lineGeo.attributes.position.array;
    const a = this.tip, n = 64;
    const mid = entry || end;
    const span = a.distanceTo(mid);
    const sag = Math.min(span * 0.18, 0.05 + slack * span * 0.12);
    const above = entry ? 52 : 64;
    for (let i = 0; i < above; i++) {
      const s = i / (above - 1);
      _a.lerpVectors(a, mid, s);
      _a.y -= Math.sin(Math.PI * s) * sag;
      arr[i * 3] = _a.x; arr[i * 3 + 1] = _a.y; arr[i * 3 + 2] = _a.z;
    }
    if (entry) {
      for (let i = above; i < n; i++) {
        const s = (i - above + 1) / (n - above);
        _a.lerpVectors(entry, end, s);
        arr[i * 3] = _a.x; arr[i * 3 + 1] = _a.y; arr[i * 3 + 2] = _a.z;
      }
    }
    this.lineGeo.attributes.position.needsUpdate = true;
    this.lineGeo.setDrawRange(0, n);
    const near = this.nearLineGeo.attributes.position.array;
    near[0] = a.x; near[1] = a.y; near[2] = a.z;
    _b.set(arr[3 * 3], arr[3 * 3 + 1], arr[3 * 3 + 2]);
    near[3] = _b.x; near[4] = _b.y; near[5] = _b.z;
    this.nearLineGeo.attributes.position.needsUpdate = true;
    this.line.visible = this.nearLine.visible = true;
  }

  hideLine() {
    this.line.visible = this.nearLine.visible = false;
    this.bobber.visible = this.lure.visible = false;
  }

  setVisible(v) {
    this.group.visible = v;
    if (!v) this.nearLine.visible = false;
  }
}

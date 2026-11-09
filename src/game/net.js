import * as THREE from 'three';
import { SPECIES_BY_ID, rollMorph } from './species.js';

// Commercial nets. Trawl: tow the net at 1-4 m/s through schools. Seine: run a circle of
// cork line around a school, then purse it (press N). Fish fill the net by weight.
export class NetFishing {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'stowed';   // stowed | deploying | fishing | hauling
    this.t = 0;
    this.lbs = {};
    this.total = 0;
    this.path = [];
    this.turned = 0;
    this.lastHeading = null;
    this.torn = false;
    // visuals: warp lines + net bag (trawl), cork line (seine)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2a2a });
    this.warps = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
    this.warps.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    this.warps.frustumCulled = false;
    const bagGeo = new THREE.CylinderGeometry(0.3, 4.5, 26, 14, 8, true).rotateZ(Math.PI / 2);
    this.bagMat = new THREE.MeshStandardMaterial({ color: 0x24402c, wireframe: true, transparent: true, opacity: 0.55 });
    ctx.patchProp(this.bagMat);
    this.bag = new THREE.Mesh(bagGeo, this.bagMat);
    this.corkGeo = new THREE.SphereGeometry(0.22, 8, 6).scale(1.4, 0.7, 1);
    this.corkMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
    this.corks = new THREE.InstancedMesh(this.corkGeo, this.corkMat, 400);
    this.corks.count = 0;
    this.corks.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.warps, this.bag, this.corks);
    this.group.visible = false;
    ctx.scene.add(this.group);
  }

  get type() { return this.ctx.boatSpec().net; }
  get cap() { return this.ctx.boatSpec().netCap || 0; }

  toggle() {
    const c = this.ctx;
    if (!this.type) { c.ui.toast('This boat has no net. Buy a trawler or seiner at the marina.', 'info'); return; }
    if (!c.loc.net) { c.ui.toast('No commercial stocks here. Net fishing works offshore and inshore saltwater.', 'info'); return; }
    if (this.state === 'stowed') {
      if (Math.abs(c.boatSpeed()) > 4) { c.ui.toast('Slow down below 4 m/s to shoot the net.', 'info'); return; }
      this.state = 'deploying'; this.t = 4; this.lbs = {}; this.total = 0; this.path = []; this.turned = 0; this.lastHeading = null; this.torn = false;
      c.ui.toast(this.type === 'trawl' ? 'Shooting the trawl... tow at 1-4 m/s through the schools.' : 'Shooting the seine... circle a school, then press N to purse.', 'info');
      c.audio.play('winch');
      this.group.visible = true;
    } else if (this.state === 'fishing') {
      this.state = 'hauling'; this.t = 5;
      if (this.type === 'seine') this.purse();
      c.ui.toast('Hauling back...', 'info');
      c.audio.play('winch');
    }
  }

  purse() {
    const c = this.ctx;
    // a closed circle around a school pays off big
    const closed = this.turned > Math.PI * 1.7 && this.path.length > 10 && this.path[0].distanceTo(this.path[this.path.length - 1]) < 90;
    if (!closed) { c.ui.toast('The circle wasn\'t closed - most of the school escaped.', 'bad'); return; }
    let cx = 0, cz = 0;
    for (const p of this.path) { cx += p.x; cz += p.z; }
    cx /= this.path.length; cz /= this.path.length;
    const hot = c.hotspots.near(cx, cz, 120);
    if (hot > 0) { this.addCatch(this.cap * (0.35 + 0.6 * hot) * (0.7 + Math.random() * 0.3)); c.ui.toast('Pursed around the school!', 'good'); }
    else c.ui.toast('Closed the net on empty water.', 'bad');
  }

  addCatch(lb) {
    const pool = this.ctx.loc.net;
    const sum = Object.values(pool).reduce((a, b) => a + b, 0);
    for (const [id, w] of Object.entries(pool)) {
      const share = lb * (w / sum) * (0.7 + Math.random() * 0.6);
      this.lbs[id] = (this.lbs[id] || 0) + share;
      this.total += share;
    }
    if (this.total > this.cap) {
      const k = this.cap / this.total;
      for (const id in this.lbs) this.lbs[id] *= k;
      this.total = this.cap;
    }
  }

  update(dt) {
    const c = this.ctx;
    if (this.state === 'stowed') { this.group.visible = false; return; }
    const boat = c.boat;
    const speed = c.boatSpeed();
    const stern = boat.toWorld(new THREE.Vector3(-boat.hull.length * 0.5, boat.hull.depth * 0.4, 0), new THREE.Vector3());
    const back = new THREE.Vector3(-1, 0, 0).applyQuaternion(boat.quaternion).setY(0).normalize();
    const side = new THREE.Vector3(-back.z, 0, back.x);
    if (this.state === 'deploying') { this.t -= dt; if (this.t <= 0) this.state = 'fishing'; }
    if (this.state === 'hauling') {
      this.t -= dt;
      if (this.t <= 0) { this.finish(); return; }
    }
    const deployed = this.state === 'fishing' ? 1 : this.state === 'deploying' ? 1 - this.t / 4 : this.t / 5;
    if (this.type === 'trawl') {
      const bagPos = stern.clone().addScaledVector(back, 18 + 40 * deployed).setY(-4 - 10 * deployed);
      const a = this.warps.geometry.attributes.position.array;
      const set = (i, v) => { a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; };
      set(0, stern.clone().addScaledVector(side, 2.4)); set(1, bagPos.clone().addScaledVector(side, 4));
      set(2, stern.clone().addScaledVector(side, -2.4)); set(3, bagPos.clone().addScaledVector(side, -4));
      this.warps.geometry.attributes.position.needsUpdate = true;
      this.bag.visible = true;
      this.bag.position.copy(bagPos).addScaledVector(back, 13);
      this.bag.rotation.set(0, Math.atan2(back.z, -back.x), 0);
      this.warps.visible = true;
      this.bag.scale.setScalar(0.4 + 0.6 * deployed);
      this.corks.count = 0;
      if (this.state === 'fishing') {
        if (speed > 5.5 && !this.torn) { this.torn = true; this.total *= 0.4; for (const id in this.lbs) this.lbs[id] *= 0.4; c.ui.toast('Towing too fast - the net tore and fish spilled out!', 'bad'); }
        const tow = speed > 0.8 && speed < 5 ? Math.min(1, speed / 2.5) : 0;
        const hot = c.hotspots.near(bagPos.x, bagPos.z, 70);
        const rate = (12 + 900 * hot) * tow * (this.torn ? 0.3 : 1);
        if (rate > 0 && this.total < this.cap) this.addCatch(rate * dt);
      }
    } else {
      // seine: cork line follows the boat's track while shooting
      this.bag.visible = false;
      this.warps.visible = false;
      if (this.state === 'fishing' || this.state === 'deploying') {
        const last = this.path[this.path.length - 1];
        if (!last || last.distanceTo(stern) > 4) this.path.push(stern.clone().setY(0));
        const h = boat.heading();
        if (this.lastHeading != null) {
          let d = h - this.lastHeading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          this.turned += Math.abs(d);
        }
        this.lastHeading = h;
        if (this.path.length > 400) this.path.shift();
      }
      const m = new THREE.Matrix4();
      const n = Math.min(this.path.length, 400);
      for (let i = 0; i < n; i++) {
        const p = this.path[i];
        m.makeTranslation(p.x, c.waterHeightApprox() + 0.05 - (1 - deployed) * 0.5, p.z);
        this.corks.setMatrixAt(i, m);
      }
      this.corks.count = n;
      this.corks.instanceMatrix.needsUpdate = true;
    }
    c.ui.netTick(this.state, this.total, this.cap, this.type, this.turned);
  }

  finish() {
    const c = this.ctx;
    this.state = 'stowed';
    this.group.visible = false;
    c.ui.netTick('stowed');
    const rows = Object.entries(this.lbs).filter(([, lb]) => lb > 1).map(([id, lb]) => {
      const sp = SPECIES_BY_ID[id];
      return { sp, lb, value: lb * sp.price * 0.7, count: Math.max(1, Math.round(lb / sp.lb[1])) };
    }).sort((a, b) => b.lb - a.lb);
    if (!rows.length) { c.ui.toast('Empty net. Tow through the schools (look for diving gulls).', 'bad'); return; }
    // a few fish from every haul get logged (and might be a rare colour)
    const morphs = [];
    for (const r of rows) {
      const tries = Math.min(40, r.count);
      for (let i = 0; i < tries; i++) {
        const mo = rollMorph(Math.random, 0.25);
        if (mo.id !== 'normal') { morphs.push({ sp: r.sp, morph: mo }); break; }
      }
    }
    c.onHaul(rows, morphs);
  }
}

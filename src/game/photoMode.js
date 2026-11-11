// Photo mode: a camera for composing shots, a shutter, and the album they go into (photoData.js / photoStore.js).
//   Eye   the normal first-person view with the HUD hidden (the rod is optional); the held fish stays in hand.
//   Free  a camera cut loose from the head, limited to RANGE metres around you, so the jellybean angler is in the shot.
// Controls while it is on: mouse wheel zooms, right-drag looks, the move keys fly the free camera (Space/E up, Q/Ctrl down,
// Shift faster), the View key swaps Eye/Free, the Shutter key (default Enter) or a click on the picture takes the shot,
// and the Photo key leaves. Everything else is swallowed so the game does not run while you frame a picture.
// Depth of field, exposure and the film looks are done in the post pass (engine.photoFx); frames and the caption are drawn on
// the 2D copy of the picture. Nothing here writes to the save in a developer session (photoStore.js is memory-only then).
import * as THREE from 'three';
import './photo.css';
import { LOOKS, LOOK_BY_ID, FRAMES, PHOTO_MAX, newPhotoId, captionFor, addPhoto, hhmm } from './photoData.js';
import * as store from './photoStore.js';
import { WEATHER } from './weather.js';
import { keyLabel } from './keys.js';
import { isFrozen } from './save.js';
import { BOATS } from './gear.js';

const RANGE = 28, SPEED = 4.5, MAXSIDE = 2560;
const TIMES = [['Normal', 1], ['Slow', 0.12], ['Still', 0.02]];
const $ = (id) => document.getElementById(id);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _m = new THREE.PerspectiveCamera(), _c = new THREE.Vector3();   // _m is a camera so lookAt aims -z

export class PhotoMode {
  constructor(g) {
    this.g = g;
    this.active = false; this.free = false; this.catchMode = false;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
    this.s = { fov: 60, ap: 0, af: true, focus: 8, ev: 0, look: 'natural', frame: 'none', grid: false, time: 0, rod: false };
    this.shot = null; this.busy = false; this.msg = ''; this.prev = null; this.panel = null;
    this.vel = new THREE.Vector3();
    store.init();
  }

  // ---------------------------------------------------------------- entering and leaving
  get fx() { return this.g.e.photoFx; }
  // game clock multiplier while the mode is on (Settings are in the panel: Normal / Slow / Still)
  scale() { return this.active ? TIMES[this.s.time][1] : 1; }
  holdsKeys() { return this.active && this.free; }   // the move keys fly the camera, not the boat

  enter(opts = {}) {
    const g = this.g;
    if (this.active) return true;
    if (g.dev.fly) { g.ui.toast('The developer fly camera is on; turn it off for photo mode.', 'info'); return false; }
    if (g.view === 'under') { g.ui.toast('Photo mode works from the helm or the bank. Pull the underwater view back first.', 'info'); return false; }
    if (['fight', 'charging', 'landing', 'bite'].includes(g.fishing.state)) { g.ui.toast('Land the fish first. Then the camera.', 'info'); return false; }
    if (g.ui.isOpen() && !opts.catch) return false;
    this.prev = { view: g.view, tp: g.tp, photo: g.photo };
    this.catchMode = !!opts.catch;
    this.s.fov = g.settings.fov || 60;
    this.s.ap = 0; this.s.ev = 0; this.s.time = 0; this.s.af = true; this.msg = '';
    this.s.look = 'natural';
    this.s.frame = this.catchMode ? 'plate' : 'none';
    if (this.catchMode) { this.s.ap = 0.5; this.s.fov = g.tp ? 42 : Math.min(this.s.fov, 55); }
    if (this.catchMode) g.ui.stash();
    this.active = true;
    this.fx.on = true;
    g.photo = true;
    document.getElementById('hud').style.visibility = 'hidden';
    g.freePointer?.();
    this.vel.set(0, 0, 0);
    g.camera.updateMatrixWorld();
    const wantFree = this.catchMode ? !!g.tp : !!(g.tp || g.view === 'third');
    if (wantFree) this.goFree(this.catchMode); else this.goEye();
    this.build();
    this.sync();
    return true;
  }

  exit() {
    const g = this.g;
    if (!this.active) return;
    this.active = false; this.free = false;
    const p = this.prev || { view: 'first', tp: false, photo: false };
    g.view = p.view === 'photo' ? 'first' : p.view;
    g.tp = p.tp; g.photo = false; g.rodInShot = false;
    document.getElementById('hud').style.visibility = '';
    const fx = this.fx; fx.on = false; fx.dof = 0; fx.ev = 0; fx.grade = null;
    g.e.setQuality(g.settings);   // puts the field of view back
    this.panel?.remove(); this.panel = null; $('phGrid')?.remove(); $('phPrev')?.remove(); $('phFlash')?.remove();
    if (this.catchMode) g.ui.unstash();
    else g.grabPointer?.();
    this.catchMode = false; this.shot = null;
  }

  toggle() { if (this.active) this.exit(); else this.enter(); }

  // ---------------------------------------------------------------- the two views
  subject() { const A = this.g.angler; return _a.set(A.position.x, A.position.y - 0.5, A.position.z); }
  front(dist, side, lift) {   // a point in front of the angler (the way it faces), for the selfie / catch framing
    const A = this.g.angler;
    _f.set(0, 0, -1).applyQuaternion(A.quaternion); _f.y = 0; _f.normalize();
    _r.set(1, 0, 0).applyQuaternion(A.quaternion); _r.y = 0; _r.normalize();
    return _b.copy(A.position).addScaledVector(_f, dist).addScaledVector(_r, side).add(_c.set(0, lift, 0));
  }
  aimAt(target) {
    _m.position.copy(this.pos); _m.lookAt(target);
    _e.setFromQuaternion(_m.quaternion, 'YXZ');
    this.yaw = _e.y; this.pitch = _e.x;
  }
  goFree(catching) {
    const g = this.g;
    this.free = true;
    this.pos.copy(this.front(catching ? 3.0 : 3.3, catching ? 0.9 : 0.7, catching ? -0.1 : -0.35));
    this.aimAt(this.subject());
    g.view = 'photo';
    this.clampPos();
  }
  goEye() {
    const g = this.g;
    this.free = false;
    g.view = 'first';
    if (this.prev) this.prev.view = this.prev.view === 'photo' ? 'first' : this.prev.view;
  }
  swapView() { if (this.free) this.goEye(); else this.goFree(false); this.sync(); }

  look(dx, dy) {
    const k = 0.0035 * this.g.settings.lookSpeed * Math.max(0.35, this.s.fov / 60);   // finer aim when zoomed in
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k * (this.g.settings.invertY ? -1 : 1), -1.5, 1.5);
  }
  wheel(dy) { this.s.fov = THREE.MathUtils.clamp(this.s.fov * (dy < 0 ? 0.92 : 1.09), 18, 100); this.sync(); }

  // keep the free camera inside RANGE of the angler, above the water and the ground
  clampPos() {
    const g = this.g, A = g.angler.position, p = this.pos;
    const dx = p.x - A.x, dz = p.z - A.z, d = Math.hypot(dx, dz);
    if (d > RANGE) { p.x = A.x + (dx / d) * RANGE; p.z = A.z + (dz / d) * RANGE; }
    const floor = Math.max((g.water[0] || 0) + 0.3, g.groundAt(p.x, p.z) + 0.35);
    p.y = THREE.MathUtils.clamp(p.y, floor, Math.max(floor + 1, A.y + 16));
  }

  // where a fish being held is drawn: at the angler's chest while the free camera looks at them (null = the usual spot at the lens)
  heldAt() {
    if (!this.active || !this.free) return null;
    return this.front(0.5, 0.05, -0.72).clone();
  }

  // called by Game.updateCamera while view === 'photo'
  place(cam) {
    cam.position.copy(this.pos);
    cam.quaternion.setFromEuler(_e.set(this.pitch, this.yaw, 0, 'YXZ'));
    cam.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- per frame (real time, before the camera is placed)
  update(dt) {
    const g = this.g;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { const f = $('phFlash'); if (f) f.classList.remove('on'); } }
    if (!this.active) return;
    const s = this.s;
    if (this.free) {
      const k = (a) => g.keys.has(g.binds.map[a]);
      const fw = (k('forward') ? 1 : 0) - (k('back') ? 1 : 0), sd = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
      const up = (g.keys.has('e') || g.keys.has('space') ? 1 : 0) - (g.keys.has('q') || g.keys.has('control') ? 1 : 0);
      _q.setFromEuler(_e.set(this.pitch, this.yaw, 0, 'YXZ'));
      _f.set(0, 0, -1).applyQuaternion(_q);
      _r.set(1, 0, 0).applyQuaternion(_q).setY(0).normalize();
      _a.set(0, up, 0).addScaledVector(_f, fw).addScaledVector(_r, sd);
      if (_a.lengthSq() > 1) _a.normalize();
      _a.multiplyScalar(SPEED * (g.keys.has('shift') ? 3 : 1) * Math.max(0.5, s.fov / 60));
      this.vel.lerp(_a, 1 - Math.exp(-dt * 9));
      this.pos.addScaledVector(this.vel, dt);
      this.clampPos();
    }
    const cam = g.camera;
    if (Math.abs(cam.fov - s.fov) > 1e-3) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
    // autofocus: the subject is the angler in the free view, the held fish in the eye view
    if (s.af) {
      const target = this.free ? this.subject() : _b.copy(cam.position).addScaledVector(_f.set(0, 0, -1).applyQuaternion(cam.quaternion), g.fishing.state === 'caught' ? 0.7 : 6);
      const d = Math.max(0.5, cam.position.distanceTo(target));
      this.focusNow = this.focusNow ? this.focusNow + (d - this.focusNow) * Math.min(1, dt * 6) : d;
      this.fx.focus = g.fishing.state === 'caught' && !this.free ? 4 : this.focusNow;   // a held fish is drawn on top, sharp
    } else this.fx.focus = s.focus;
    this.fx.dof = s.ap; this.fx.ev = s.ev;
    const look = LOOK_BY_ID[s.look];
    this.fx.grade = look && look.id !== 'natural' ? look : null;
  }

  // ---------------------------------------------------------------- keys and clicks (called first by Game's handlers)
  key(ev, k) {
    if (!this.active) return false;
    const g = this.g, b = g.binds.map;
    ev.preventDefault();
    if (k === 'escape' || k === 'tab' || k === b.photo) { this.exit(); g.keys.clear(); return true; }
    if (ev.repeat) return true;
    if (k === b.shutter) { this.shutter(); return true; }
    if (k === b.view) { this.swapView(); return true; }
    if (k === 'h') { this.panel?.classList.toggle('away'); return true; }
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) g.keys.add(k);   // the move keys read g.keys
    return true;
  }
  keyup() { /* Game's own keyup clears g.keys */ }

  // ---------------------------------------------------------------- the shutter
  shutter() {
    const g = this.g;
    if (this.busy || this.shot) return;
    if ((g.save.photos || []).length >= PHOTO_MAX) { this.say(`The album is full (${PHOTO_MAX}). Delete a few in the Journal, Photos tab.`, true); return; }
    this.shot = { kind: this.catchMode ? 'catch' : 'photo' };
    this.flash();
    g.audio.play('shutter');
  }
  flash() {
    let f = $('phFlash');
    if (!f) { f = document.createElement('div'); f.id = 'phFlash'; document.body.appendChild(f); }
    f.classList.add('on'); this.flashT = 0.09;
  }

  // The fish cam (fishcam.js) and photo mode share one pipeline. ctx = { kind, depth }.
  request(ctx) { this.shot = ctx; }

  // called by main.js right after the frame is drawn (the canvas can be read back then)
  capture(canvas) {
    if (!this.shot) return;
    const ctx = this.shot; this.shot = null;
    const g = this.g;
    try {
      const k = Math.min(1, MAXSIDE / Math.max(canvas.width, canvas.height));
      const w = Math.round(canvas.width * k), h = Math.round(canvas.height * k);
      const base = document.createElement('canvas'); base.width = w; base.height = h;
      base.getContext('2d').drawImage(canvas, 0, 0, w, h);
      const meta = this.metaFor(ctx);
      meta.look = this.active ? this.s.look : 'natural';
      meta.frame = ctx.kind === 'cam' ? 'none' : (this.active ? this.s.frame : 'none');
      const out = this.decorate(base, meta);
      meta.w = out.width; meta.h = out.height;
      const th = document.createElement('canvas'); const tk = 320 / out.width;
      th.width = 320; th.height = Math.max(1, Math.round(out.height * tk));
      th.getContext('2d').drawImage(out, 0, 0, th.width, th.height);
      this.busy = true;
      Promise.all([blob(out, 'image/jpeg', 0.9), blob(th, 'image/jpeg', 0.78)]).then(async ([full, thumb]) => {
        if (!full || !thumb) throw new Error('encode failed');
        const onDisk = await store.put(meta.id, full, thumb);
        g.save = addPhoto(g.save, meta);
        g.commit({ photos: g.save.photos });
        this.busy = false;
        const n = g.save.photos.length;
        this.after(meta, onDisk, n);
      }).catch(() => { this.busy = false; this.say('The photo could not be saved.', true); g.ui.toast('The photo could not be saved.', 'bad'); });
    } catch { this.busy = false; this.say('The photo could not be saved.', true); g.ui.toast('The photo could not be saved.', 'bad'); }
  }

  after(meta, onDisk, n) {
    const g = this.g;
    const warn = !onDisk && !isFrozen() ? ' This browser would not store it; it will be gone when you close the game.' : '';
    const text = `Saved. Photo ${n} of ${PHOTO_MAX}, in the Journal.${warn}`;
    if (this.active) { this.say(text, !!warn); this.preview(meta); } else g.ui.toast(text, warn ? 'bad' : 'good');
  }

  metaFor(ctx) {
    const g = this.g, w = g.weather;
    const wx = w ? (w.L > 0.3 ? 'Squall' : w.F > 0.3 ? 'Fog' : WEATHER[w.id]?.name || '') : '';
    const day = g.save.day || 1, hour = g.save.hour;
    const info = { loc: g.loc.id, day, hour, wx, boat: g.save.boat, kind: ctx.kind, depth: ctx.depth };
    const meta = { id: newPhotoId(), t: Date.now(), day, hour, loc: g.loc.id, wx, boat: BOATS[g.save.boat] ? g.save.boat : null, kind: ctx.kind, cap: '', fav: false, w: 1, h: 1, look: 'natural', frame: 'none' };
    const f = ctx.kind === 'catch' ? g.pendingCatch?.f : null;
    if (f) { meta.sp = f.sp.id; meta.morph = f.morph.id; meta.lb = f.lb; meta.lure = g.save.equip.lure; Object.assign(info, { sp: f.sp.id, morph: f.morph.id, lb: f.lb, lure: g.save.equip.lure }); }
    meta.cap = captionFor(info);
    return meta;
  }

  // frame styles, drawn on the 2D copy (never in the 3D scene)
  decorate(src, meta) {
    const w = src.width, h = src.height, st = meta.frame;
    if (st === 'none') return src;
    const unit = Math.max(w, h) / 100;
    const mk = (cw, ch) => { const c = document.createElement('canvas'); c.width = Math.round(cw); c.height = Math.round(ch); return [c, c.getContext('2d')]; };
    if (st === 'matte') {
      const m = unit * 3.2, [c, x] = mk(w + m * 2, h + m * 2.6);
      x.fillStyle = '#ece6d6'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(src, m, m);
      x.strokeStyle = 'rgba(40,34,20,0.35)'; x.lineWidth = Math.max(1, unit * 0.1); x.strokeRect(m - 0.5, m - 0.5, w + 1, h + 1);
      return c;
    }
    if (st === 'film') {
      const m = unit * 2.4, [c, x] = mk(w + m * 2, h + m * 2);
      x.fillStyle = '#0c0c0b'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(src, m, m);
      x.font = `600 ${Math.round(unit * 1.7)}px "IBM Plex Mono", monospace`; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#e8a24a'; x.fillText(`DAY ${meta.day}  ${hhmm(meta.hour)}`, c.width - m * 1.4, c.height - m * 1.6 + 0);
      x.fillStyle = 'rgba(232,162,74,0.55)'; x.textAlign = 'left'; x.fillText(String(meta.id).toUpperCase().slice(0, 5), m * 1.4, c.height - m * 1.6);
      return c;
    }
    // plate: the picture over a dark strip with the caption, set like a brass-and-ink instrument plate
    const fs = Math.round(unit * 1.9), pad = unit * 2.2, lines = wrap(this.measureCtx(fs), meta.cap, w - pad * 2 - unit * 4);
    const strip = pad * 2 + lines.length * fs * 1.34;
    const [c, x] = mk(w, h + strip);
    x.fillStyle = '#101214'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0);
    x.fillStyle = '#c99a4a'; x.fillRect(0, h, w, Math.max(2, unit * 0.18));
    x.font = `500 ${fs}px "IBM Plex Sans", "Segoe UI", sans-serif`; x.textBaseline = 'top'; x.textAlign = 'left';
    x.fillStyle = '#ece8dc';
    lines.forEach((l, i) => x.fillText(l, pad + unit * 2, h + pad + i * fs * 1.34));
    return c;
  }
  measureCtx(fs) { const c = this._mc || (this._mc = document.createElement('canvas').getContext('2d')); c.font = `500 ${fs}px "IBM Plex Sans", "Segoe UI", sans-serif`; return c; }

  // ---------------------------------------------------------------- the panel
  build() {
    this.panel?.remove();
    const el = document.createElement('div');
    el.id = 'photoPanel';
    const K = (a) => keyLabel(this.g.binds.map[a]);
    el.innerHTML = `
      <div class="ph-head"><b>Photo</b><span id="phSub"></span></div>
      <div class="ph-seg" data-k="view"><button data-v="eye">Eye</button><button data-v="free">Free camera</button></div>
      <div class="ph-row"><label for="phFov">Zoom</label><input id="phFov" type="range" min="18" max="100" step="1"><output id="phFovO"></output></div>
      <div class="ph-row"><label for="phAp">Blur</label><input id="phAp" type="range" min="0" max="1.5" step="0.05"><output id="phApO"></output></div>
      <div class="ph-row"><label>Focus</label><div class="ph-seg" data-k="af"><button data-v="1">Subject</button><button data-v="0">Manual</button></div></div>
      <div class="ph-row" id="phFocusRow"><label for="phFocus">Distance</label><input id="phFocus" type="range" min="0" max="100" step="1"><output id="phFocusO"></output></div>
      <div class="ph-row"><label for="phEv">Exposure</label><input id="phEv" type="range" min="-2" max="2" step="0.1"><output id="phEvO"></output></div>
      <div class="ph-lab">Look</div><div class="ph-chips" data-k="look">${LOOKS.map((l) => `<button data-v="${l.id}">${l.name}</button>`).join('')}</div>
      <div class="ph-lab">Frame</div><div class="ph-chips" data-k="frame">${FRAMES.map((f) => `<button data-v="${f.id}">${f.name}</button>`).join('')}</div>
      <div class="ph-lab">Time</div><div class="ph-chips" data-k="time">${TIMES.map((t, i) => `<button data-v="${i}">${t[0]}</button>`).join('')}</div>
      <div class="ph-row two"><label><input id="phGridT" type="checkbox"> Thirds grid</label><label id="phRodRow"><input id="phRodT" type="checkbox"> Rod in shot</label></div>
      <div class="ph-btns"><button class="ph-shot" id="phShot">Take photo <small>${K('shutter')}</small></button><button id="phDone">Done <small>${K('photo')}</small></button></div>
      <div id="phMsg"></div>
      <div class="ph-keys"><span><kbd>Wheel</kbd> zoom</span><span><kbd>Right-drag</kbd> look</span><span><kbd>${K('view')}</kbd> eye / free</span><span><kbd>${K('forward')}${K('left')}${K('back')}${K('right')}</kbd> move</span><span><kbd>Space</kbd>/<kbd>Q</kbd> up / down</span><span><kbd>H</kbd> hide this</span></div>`;
    document.body.appendChild(el);
    this.panel = el;
    let grid = $('phGrid');
    if (!grid) { grid = document.createElement('div'); grid.id = 'phGrid'; document.body.appendChild(grid); }
    const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));
    const num = (id, key, map = (v) => v) => $(id).addEventListener('input', (ev) => { this.s[key] = map(+ev.target.value); if (key === 'focus') this.s.af = false; this.sync(); });
    num('phFov', 'fov'); num('phAp', 'ap'); num('phEv', 'ev');
    // focus distance on a log scale: 0..100 -> 0.6 m .. 300 m
    $('phFocus').addEventListener('input', (ev) => { this.s.focus = 0.6 * Math.pow(500, +ev.target.value / 100); this.s.af = false; this.sync(); });
    on('.ph-chips button', 'click', (ev) => { const b = ev.currentTarget, k = b.parentNode.dataset.k; this.s[k] = k === 'time' ? +b.dataset.v : b.dataset.v; this.sync(); });
    on('.ph-seg button', 'click', (ev) => {
      const b = ev.currentTarget, k = b.parentNode.dataset.k;
      if (k === 'af') { this.s.af = b.dataset.v === '1'; if (!this.s.af) this.s.focus = this.fx.focus || this.s.focus; }
      if (k === 'view') { if ((b.dataset.v === 'free') !== this.free) this.swapView(); }
      this.sync();
    });
    $('phGridT').addEventListener('change', (ev) => { this.s.grid = ev.target.checked; this.sync(); });
    $('phRodT').addEventListener('change', (ev) => { this.s.rod = ev.target.checked; this.sync(); });
    $('phShot').addEventListener('click', () => this.shutter());
    $('phDone').addEventListener('click', () => this.exit());
    el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    el.addEventListener('wheel', (ev) => ev.stopPropagation());
  }

  sync() {
    const el = this.panel, s = this.s;
    if (!el) return;
    $('phFov').value = s.fov; $('phFovO').textContent = `${Math.round(s.fov)}°`;
    $('phAp').value = s.ap; $('phApO').textContent = s.ap < 0.02 ? 'off' : s.ap.toFixed(2);
    $('phEv').value = s.ev; $('phEvO').textContent = `${s.ev > 0 ? '+' : ''}${s.ev.toFixed(1)} EV`;
    const fd = s.af ? this.fx.focus || 8 : s.focus;
    $('phFocus').value = Math.round((Math.log(Math.max(0.6, fd) / 0.6) / Math.log(500)) * 100);
    $('phFocusO').textContent = s.af ? 'auto' : `${fd.toFixed(fd < 10 ? 1 : 0)} m`;
    $('phFocusRow').classList.toggle('dim', s.af);
    $('phGridT').checked = s.grid; $('phRodT').checked = s.rod;
    $('phRodRow').style.display = this.free ? 'none' : '';
    this.g.rodInShot = s.rod;
    $('phGrid').classList.toggle('on', s.grid);
    el.querySelectorAll('[data-k]').forEach((grp) => {
      const k = grp.dataset.k, cur = k === 'view' ? (this.free ? 'free' : 'eye') : k === 'af' ? (s.af ? '1' : '0') : String(s[k]);
      grp.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === cur));
    });
    $('phSub').textContent = this.catchMode ? 'with the catch' : this.free ? 'free camera, 28 m around you' : 'eye view';
    $('phMsg').textContent = this.msg;
    $('phMsg').classList.toggle('bad', !!this.bad);
  }

  say(text, bad = false) { this.msg = text; this.bad = bad; if ($('phMsg')) { $('phMsg').textContent = text; $('phMsg').classList.toggle('bad', bad); } }

  preview(meta) {
    store.thumbURL(meta.id).then((url) => {
      if (!url || !this.active) return;
      let p = $('phPrev');
      if (!p) { p = document.createElement('img'); p.id = 'phPrev'; document.body.appendChild(p); }
      p.src = url; p.classList.remove('on'); void p.offsetWidth; p.classList.add('on');
    });
  }
}

const blob = (canvas, type, q) => new Promise((res) => { try { canvas.toBlob((b) => res(b), type, q); } catch { res(null); } });

// greedy word wrap for the caption plate
function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out.slice(0, 4);
}

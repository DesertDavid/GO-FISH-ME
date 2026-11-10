import * as THREE from 'three';
import * as U from './units.js';
import { keyLabel } from './keys.js';

// Fish cam: an underwater camera on a cable, lowered from the boat or dock. Wheel / W / S (or hold the
// mouse to crank it up) set the cable length; the mouse looks around. The normal underwater render
// (UnderwaterPass: Beer-Lambert absorption by the water's own colour, shafts, marine snow, the wavy
// ceiling seen from below) does the look; this adds a lamp, an instrument HUD, a housing vignette,
// sighting tags (species once you hold the view on a fish) and a photo button.
// The fish are the ordinary FishLife fish (fishLife.focus tells it the camera's depth), so what you
// see here is what follows, inspects and strikes your lure. No catching through the camera.
// Numbers in TUNE below.
export const TUNE = {
  maxLen: 160,            // longest cable (m); also limited by the bottom
  startLen: 2,
  wheelStep: 0.06,        // fraction of the cable per wheel notch (min 0.5 m)
  speed: [2.2, 0.05],     // keys: m/s + this * cable length
  crank: 3.5,             // hold the mouse: hauls up at this m/s
  bottomGap: 0.4,
  usableDepth: 2.5,       // water needed under the boat or dock
  lag: 0.5,               // how slowly the camera follows a moving boat (1/s)
  shake: 0.0035,          // camera shake from the boat (rad)
  lamp: { on: true, intensity: 2.2 },   // brightness of the cable-end lamp (terrain.js uLamp; falls off with distance squared)
  sight: { hold: 1.0, cone: 0.11, range: 20, tags: 3 },   // hold the view this long (cone = radians^2-ish) on a fish within range
};

const CSS = `
#fishcam{position:fixed;inset:0;pointer-events:none;z-index:4;font:600 12px "IBM Plex Mono",monospace;color:#e8e4d8;display:none}
#fishcam.on{display:block}
#fishcam .vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 52%,rgba(2,10,16,.38) 78%,rgba(0,4,8,.78) 100%)}
#fishcam .glass{position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.06) 0,rgba(255,255,255,0) 22%,rgba(255,255,255,0) 70%,rgba(255,255,255,.035) 100%);mix-blend-mode:screen}
#fishcam .ring{position:absolute;inset:14px;border:1px solid rgba(232,228,216,.1);border-radius:26px}
#fishcam .panel{position:absolute;left:22px;top:84px;min-width:176px;padding:8px 10px 9px;background:rgba(28,34,39,.82);border:1px solid rgba(232,228,216,.16);border-radius:3px}
#fishcam .panel h5{margin:0 0 6px;font:700 11px "IBM Plex Mono",monospace;letter-spacing:.14em;color:#e8b030}
#fishcam .panel div{display:flex;justify-content:space-between;gap:14px;line-height:1.55}
#fishcam .panel b{font-weight:600;color:#fff}
#fishcam .panel .big{font-size:20px;line-height:1.25}
#fishcam .panel .warn{color:#ff7a1a}
#fishcam .rec{position:absolute;right:26px;top:84px;color:#ff5a3a;letter-spacing:.12em}
#fishcam .rec i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5a3a;margin-right:6px;animation:fcblink 1.4s steps(2) infinite}
@keyframes fcblink{50%{opacity:.15}}
#fishcam .keys{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:92vw;padding:6px 12px;background:rgba(28,34,39,.72);border-radius:3px;font-size:11px}
#fishcam .keys kbd{display:inline-block;margin-right:5px;padding:0 5px;border:1px solid rgba(232,228,216,.35);border-radius:2px;color:#e8b030;font:inherit}
#fishcam .cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:1px solid rgba(232,228,216,.35);border-radius:50%}
#fishcam .tag{position:absolute;transform:translate(14px,-50%);padding:3px 7px 4px;background:rgba(28,34,39,.86);border-left:2px solid #e8b030;white-space:nowrap;display:none}
#fishcam .tag small{display:block;font-weight:500;font-size:10px;color:#9fb0b8}
#fishcam .shot{position:absolute;left:50%;top:50%;width:0;height:0;box-shadow:0 0 0 200vmax #fff;opacity:0;transition:opacity .35s}
#fishcam .shot.on{opacity:.55;transition:none}
#shoreHint kbd.fc{}
`;

export class FishCam {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.len = TUNE.startLen;
    this.maxLen = TUNE.maxLen;
    this.lampOn = TUNE.lamp.on;
    this.follow = false;
    this.pos = new THREE.Vector3();
    this.ax = 0; this.az = 0;
    this.baseYaw = 0;
    this.t = 0;
    this.touchBottom = false;
    this.hold = new Map();   // fish id -> seconds in view
    this.tagged = [];
    this.shotPending = false;
    this.lastShot = null;
    this.sightedNow = new Set();
    this.lampLevel = 0;
    this.U = game.e.terrain.uniforms;   // the lamp is a term in the shared terrain/prop shader (terrain.js uLamp), not a scene light
    this._v = new THREE.Vector3(); this._f = new THREE.Vector3(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._q = new THREE.Quaternion();
    this.build();
  }

  build() {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    const el = document.createElement('div');
    el.id = 'fishcam';
    el.innerHTML = '<div class="vig"></div><div class="glass"></div><div class="ring"></div><div class="cross"></div>'
      + '<div class="panel"><h5>FISH CAM</h5><div><span>CABLE</span><b class="big" data-f="len">0.0 m</b></div><div><span>BOTTOM</span><b data-f="btm">-</b></div><div><span>LAMP</span><b data-f="lamp">ON</b></div><div><span>MODE</span><b data-f="mode">MANUAL</b></div></div>'
      + '<div class="rec"><i></i>REC <span data-f="clock"></span></div><div class="keys" data-f="keys"></div><div class="shot"></div>';
    for (let i = 0; i < TUNE.sight.tags; i++) { const t = document.createElement('div'); t.className = 'tag'; el.appendChild(t); }
    document.body.appendChild(el);
    this.el = el;
    this.f = {};
    el.querySelectorAll('[data-f]').forEach((n) => { this.f[n.dataset.f] = n; });
    this.tagEls = [...el.querySelectorAll('.tag')];
    this.flash = el.querySelector('.shot');
  }

  // ---- state -----------------------------------------------------------------------------
  anchor() { const g = this.g; return g.foot ? g.footPos : g.boat.position; }

  // water under the boat or dock deep enough, and nothing else holding the camera
  usable() {
    const g = this.g;
    if (g.dev?.fly || g.ui.isOpen() || g.view !== 'first' || g.holsteredBusy?.()) return false;
    if (g.fishing.state === 'fight' || g.fishing.state === 'landing' || g.fishing.state === 'caught') return false;
    const a = this.anchor();
    let best = -g.heightAt(a.x, a.z);
    if (g.foot) {
      // from a dock or the bank: the water the rod points over
      const yaw = g.look.yaw;
      for (const d of [2.5, 4, 6]) best = Math.max(best, -g.heightAt(a.x + Math.cos(yaw) * d, a.z - Math.sin(yaw) * d));
    }
    return best >= TUNE.usableDepth;
  }

  toggle() {
    const g = this.g;
    if (this.active) { this.exit(); return; }
    if (!this.usable()) { g.ui.toast('Fish cam needs water under the boat or dock (2.5 m or more).', 'info'); return; }
    this.enter();
  }

  enter() {
    const g = this.g, a = this.anchor();
    this.active = true;
    this.ax = a.x; this.az = a.z;
    if (g.foot) {
      // dangle it a few metres out from the dock edge, in the direction you face
      const yaw = g.look.yaw;
      for (const d of [6, 4, 2.5]) { const x = a.x + Math.cos(yaw) * d, z = a.z - Math.sin(yaw) * d; if (-g.heightAt(x, z) >= TUNE.usableDepth) { this.ax = x; this.az = z; break; } }
    }
    this.len = Math.min(TUNE.startLen, Math.max(1, -g.heightAt(this.ax, this.az) - TUNE.bottomGap));
    this.follow = false;
    this._e.setFromQuaternion(g.camera.quaternion, 'YXZ');
    this.baseYaw = this._e.y;
    g.look.yaw = 0; g.look.pitch = 0.05;
    g.view = 'cam';
    g.underInit = false;
    this.el.classList.add('on');
    this.hold.clear();
    this.sightedNow.clear();
    this.setKeys();
    document.getElementById('hud')?.classList.add('fishcam-on');
    this.pos.set(this.ax, (g.water[0] || 0) - this.len, this.az);
    g.fishLife.focus = { depth: this.len, x: this.ax, z: this.az };
  }

  exit() {
    const g = this.g;
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('on');
    this.lampLevel = 0; this.U.uLamp.value.w = 0;
    for (const t of this.tagEls) t.style.display = 'none';
    g.fishLife.focus = null;
    if (g.view === 'cam') { g.view = 'first'; g.restoreLook(); }
    document.getElementById('hud')?.classList.remove('fishcam-on');
    g.grabPointer?.();   // like closing a menu: keep the mouse grabbed
  }

  toggleLamp() { if (!this.active) return; this.lampOn = !this.lampOn; this.g.ui.toast(this.lampOn ? 'Camera lamp on' : 'Camera lamp off', 'info'); }
  toggleFollow() {
    if (!this.active) return;
    const f = this.g.fishing;
    if (!this.follow && f.state !== 'water' && f.state !== 'bite') { this.g.ui.toast('Cast first - tracking follows your lure.', 'info'); return; }
    this.follow = !this.follow;
    if (!this.follow) this.g.look.yaw = 0;
  }
  wheel(dy) { if (this.active) { this.follow = false; this.len += Math.sign(dy) * Math.max(0.5, this.len * TUNE.wheelStep); } }

  // the HUD key strip (labels follow the player's bindings)
  setKeys() {
    const g = this.g, K = (a) => keyLabel(g.binds.map[a]);
    this.f.keys.innerHTML = `<span><kbd>Wheel</kbd>/<kbd>${K('forward')}</kbd><kbd>${K('back')}</kbd> cable</span><span><kbd>Hold mouse</kbd>crank up</span><span><kbd>${K('camLamp')}</kbd>lamp</span><span><kbd>${K('camFollow')}</kbd>track lure</span><span><kbd>${K('photo')}</kbd>photo</span><span><kbd>${K('fishcam')}</kbd>bring it up</span>`;
  }

  // ---- per frame (called from Game.update before the camera) -------------------------------
  update(dt) {
    if (!this.active) return;
    const g = this.g, f = g.fishing, k = (a) => g.keys.has(g.binds.map[a]);
    this.t += dt;
    if (g.ui.isOpen() || g.dev?.fly) { this.exit(); return; }
    // cable
    const sp = TUNE.speed[0] + TUNE.speed[1] * this.len;
    if (k('back')) { this.len += sp * dt; this.follow = false; }
    if (k('forward')) { this.len -= sp * dt; this.follow = false; }
    if (g.mouse.down) { this.len -= TUNE.crank * dt * (1 + this.len * 0.02); this.follow = false; }
    const lure = f.state === 'water' || f.state === 'bite';
    if (this.follow && !lure) this.follow = false;
    if (this.follow) this.len += (Math.max(1, f.depth) - this.len) * Math.min(1, dt * 2.5);
    // the camera swings behind a moving boat on its cable
    const a = this.anchor(), kk = 1 - Math.exp(-dt * TUNE.lag);
    if (!g.foot) { this.ax += (a.x - this.ax) * kk; this.az += (a.z - this.az) * kk; }
    const bottom = -g.heightAt(this.ax, this.az);
    this.maxLen = Math.max(0.6, Math.min(TUNE.maxLen, bottom - TUNE.bottomGap));
    this.touchBottom = this.len > this.maxLen;
    this.len = THREE.MathUtils.clamp(this.len, 0.4, this.maxLen);
    // tracking points the camera at the lure
    if (this.follow) {
      const want = Math.atan2(-(f.lure.z - this.az), f.lure.x - this.ax);
      const base = want - Math.PI / 2;
      let d = Math.atan2(Math.sin(base - this.baseYaw - g.look.yaw), Math.cos(base - this.baseYaw - g.look.yaw));
      g.look.yaw += d * Math.min(1, dt * 3);
      const horiz = Math.hypot(f.lure.x - this.ax, f.lure.z - this.az);
      g.look.pitch += (Math.atan2(-(f.depth - this.len), Math.max(1, horiz)) - g.look.pitch) * Math.min(1, dt * 3);
    }
    const fl = g.fishLife;
    if (fl.focus) { fl.focus.depth = this.len; fl.focus.x = this.ax; fl.focus.z = this.az; }
    this.hud();
  }

  // set the render camera (Game.updateCamera calls this while view === 'cam')
  placeCamera(dt) {
    const g = this.g, cam = g.camera, e = this._e;
    const surf = g.water[0] || 0;
    const bob = Math.sin(this.t * 0.9) * 0.05 + Math.sin(this.t * 1.7 + 1) * 0.02 + (g.boat?.rough || 0) * Math.sin(this.t * 2.3) * 0.08;
    this.pos.set(this.ax, surf - this.len + bob, this.az);
    this.pos.y = Math.max(this.pos.y, g.heightAt(this.ax, this.az) + 0.3);
    cam.position.copy(this.pos);
    const k = (g.settings?.reduceMotion ? 0 : TUNE.shake) * (1 + (g.boat?.rough || 0) * 3);
    this.sw = this.sw || { x: 0, y: 0, z: 0 };
    const t = this.t;
    e.set(g.look.pitch + Math.sin(t * 1.9) * k, this.baseYaw + g.look.yaw + Math.sin(t * 2.4 + 1) * k * 0.7, Math.sin(t * 1.3 + 2) * k * 1.4);
    cam.quaternion.setFromEuler(e);
    cam.updateMatrixWorld();
    // lamp just ahead of the lens: warm and short, brighter the deeper it is (the daylight is gone down there)
    const L = TUNE.lamp;
    this._f.set(0.18, -0.12, -0.5).applyQuaternion(cam.quaternion).add(cam.position);
    const night = g.nightLevel ? g.nightLevel() : 0;
    const dark = THREE.MathUtils.clamp(this.len / 40 + night * 0.5, 0.15, 1);
    const comp = 1 / Math.max(0.06, g.e.deepDim ?? 1);   // the exposure is turned down with depth; the lamp must beat that
    this.lampLevel += ((this.lampOn ? L.intensity * (0.4 + dark) * comp : 0) - this.lampLevel) * Math.min(1, dt * 8);
    this.U.uLamp.value.set(this._f.x, this._f.y, this._f.z, this.lampLevel);
    this.sights(dt, cam);
  }

  // ---- sightings: hold the view on a fish -------------------------------------------------
  sights(dt, cam) {
    const g = this.g, fl = g.fishLife, S = TUNE.sight;
    const fwd = this._f.set(0, 0, -1).applyQuaternion(cam.quaternion), v = this._v;
    let n = 0;
    for (const a of fl.actors) {
      if (!a.on || a.scale < 0.5) continue;
      v.set(a.x - cam.position.x, a.y - cam.position.y, a.z - cam.position.z);
      const d = v.length();
      const inView = d < Math.min(S.range, fl.vis * 0.95) && d > 0.5 && v.dot(fwd) / d > 1 - S.cone;
      const h = (this.hold.get(a.id + ':' + a.key) || 0) + (inView ? dt : -dt * 2);
      const key = a.id + ':' + a.key;
      if (h <= 0) this.hold.delete(key); else this.hold.set(key, Math.min(h, S.hold + 1));
      if (inView && h >= S.hold && n < this.tagEls.length) {
        this.tag(this.tagEls[n++], a, cam, d);
        if (!this.sightedNow.has(a.sp.id)) this.sighted(a);
      }
    }
    for (; n < this.tagEls.length; n++) this.tagEls[n].style.display = 'none';
  }

  tag(el, a, cam, d) {
    const v = this._v.set(a.x, a.y, a.z).project(cam);
    if (v.z > 1) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    const inches = a.len / 0.0254;
    const html = `${a.sp.name.toUpperCase()}<small>${U.length(inches)} · ${U.depth(-a.y, 0)} · ${U.dist(d)}</small>`;
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
  }

  // first sighting of a species goes in the journal (separate from catches)
  sighted(a) {
    const g = this.g, id = a.sp.id;
    this.sightedNow.add(id);
    const s = g.save.sighted || {};
    const first = !s[id];
    g.commit({ sighted: { ...s, [id]: { n: (s[id]?.n || 0) + 1, loc: g.loc.id, day: g.save.day || 1, first: s[id]?.first ?? (g.save.day || 1) } } });
    if (first) g.ui.toast(`Sighted: ${a.sp.name}${g.save.journal[id] ? '' : ' (new in your journal)'}`, 'good');
  }

  // ---- HUD / photo -------------------------------------------------------------------------
  hud() {
    const g = this.g, f = this.f;
    this._hudT = (this._hudT || 0) - 1;
    if (this._hudT > 0) return;
    this._hudT = 4;
    const bottom = -g.heightAt(this.ax, this.az);
    f.len.textContent = U.depth(this.len, 1);
    f.btm.textContent = this.touchBottom ? 'ON BOTTOM' : U.depth(Math.max(0, bottom - this.len), 1);
    f.btm.className = this.touchBottom ? 'warn' : '';
    f.lamp.textContent = this.lampOn ? 'ON' : 'OFF';
    f.mode.textContent = this.follow ? 'TRACK LURE' : 'MANUAL';
    const h = g.save.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    f.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // called from main.js right after the frame is drawn (the canvas can be read back then)
  capture(canvas) {
    if (!this.shotPending) return;
    this.shotPending = false;
    try {
      const url = canvas.toDataURL('image/png');
      this.lastShot = url;
      const a = document.createElement('a');
      a.href = url;
      a.download = `fishcam-${this.g.loc.id}-${Math.round(this.len)}m-${Date.now()}.png`;
      document.body.appendChild(a);
      if (!navigator.webdriver) a.click();
      a.remove();
    } catch { this.g.ui.toast('Could not save the photo.', 'bad'); }
  }
  photo() {
    if (!this.active) return false;
    this.shotPending = true;
    this.flash.classList.add('on');
    setTimeout(() => this.flash.classList.remove('on'), 80);
    this.g.ui.toast('Photo saved to your downloads', 'good');
    return true;
  }
}

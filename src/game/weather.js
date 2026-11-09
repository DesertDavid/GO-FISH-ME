import * as THREE from 'three';

// Weather: clouds, light, wind/waves, fog, rain and lightning, and how it changes the bite.
// Changes every couple of game hours and eases in over ~20 s.
export const WEATHER = {
  clear: { name: 'Clear', icon: '☀', clouds: 0.18, sun: 9, windMul: 0.8, fogMul: 1, rain: 0, bite: 0.9 },
  partly: { name: 'Partly cloudy', icon: '⛅', clouds: 0.45, sun: 9, windMul: 1, fogMul: 1, rain: 0, bite: 1 },
  overcast: { name: 'Overcast', icon: '☁', clouds: 0.85, sun: 6, windMul: 1.1, fogMul: 1.8, rain: 0, bite: 1.25 },
  rain: { name: 'Rain', icon: '🌧', clouds: 0.95, sun: 4, windMul: 1.25, fogMul: 3, rain: 0.6, bite: 1.4 },
  storm: { name: 'Storm', icon: '⛈', clouds: 1, sun: 2.5, windMul: 1.7, fogMul: 4, rain: 1, bite: 0.75 },
};

const CLIMATE = {
  default: { clear: 3, partly: 4, overcast: 2, rain: 1.2 },
  amazon: { partly: 3, overcast: 2, rain: 3.5 },
  fjord: { partly: 2, overcast: 4, rain: 2, storm: 0.6 },
  bering: { partly: 1, overcast: 4, rain: 2, storm: 2 },
  gulf: { clear: 4, partly: 3, overcast: 1, rain: 1, storm: 0.5 },
  reef: { clear: 4, partly: 3, overcast: 1, rain: 1, storm: 0.4 },
  keys: { clear: 4, partly: 3, overcast: 1, rain: 1, storm: 0.3 },
  cabo: { clear: 6, partly: 3, overcast: 0.5, rain: 0.2, storm: 0.2 },
  kariba: { clear: 5, partly: 3, overcast: 0.8, rain: 0.6 },
  mekong: { partly: 3, overcast: 2, rain: 3 },
  chesapeake: { clear: 3, partly: 4, overcast: 2.5, rain: 1.5 },
};

const DROPS = 5000, BOX = 70, HEIGHT = 34;

export class Weather {
  constructor(engine, loc, saved, ui, audio) {
    this.e = engine;
    this.loc = loc;
    this.ui = ui;
    this.audio = audio;
    this.id = saved && WEATHER[saved] ? saved : this.roll();
    this.cur = { ...WEATHER[this.id] };
    this.nextChange = 1.5 + Math.random() * 2;   // game hours
    this.stepT = 0;
    this.flashT = 30 + Math.random() * 30;
    this.flash = document.createElement('div');
    Object.assign(this.flash.style, { position: 'fixed', inset: '0', background: '#dfe8ff', opacity: '0', pointerEvents: 'none', transition: 'opacity 0.08s' });
    document.body.appendChild(this.flash);
    // rain streaks around the camera
    const pos = new Float32Array(DROPS * 6);
    this.drops = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * BOX;
      this.drops[i * 3 + 1] = Math.random() * HEIGHT;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.6, 0.68), transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    engine.scene.add(this.rain);
    this.applyLook(true);
  }

  roll() {
    const w = CLIMATE[this.loc.id] || CLIMATE.default;
    // storms only at sea
    const entries = Object.entries(w).filter(([id]) => id !== 'storm' || this.loc.water === 'offshore');
    let r = Math.random() * entries.reduce((a, [, v]) => a + v, 0);
    for (const [id, v] of entries) { r -= v; if (r <= 0) return id; }
    return 'partly';
  }

  get bite() { return this.cur.bite; }

  applyLook() {
    this.e.setWeatherLook({ clouds: this.cur.clouds, sun: this.cur.sun, windMul: this.cur.windMul, fogMul: this.cur.fogMul });
    this.ui.weather(WEATHER[this.id], this.cur.bite);
    this.audio.setRain?.(this.cur.rain);
  }

  update(dt, gameHoursPassed, camera) {
    this.nextChange -= gameHoursPassed;
    if (this.nextChange <= 0) {
      const next = this.roll();
      this.nextChange = 1.5 + Math.random() * 2;
      if (next !== this.id) {
        this.id = next;
        this.ui.toast(`Weather turning: ${WEATHER[next].name.toLowerCase()}${WEATHER[next].bite > 1.1 ? ' - fish love this' : ''}`, 'info');
      }
    }
    // ease toward the target a step at a time (each step re-bakes sky and waves)
    this.stepT -= dt;
    if (this.stepT <= 0) {
      this.stepT = 2;
      const t = WEATHER[this.id];
      let changed = false;
      for (const k of ['clouds', 'sun', 'windMul', 'fogMul', 'rain', 'bite']) {
        const d = t[k] - this.cur[k];
        if (Math.abs(d) > 1e-3) { this.cur[k] += d * 0.2; changed = true; if (Math.abs(t[k] - this.cur[k]) < 0.01) this.cur[k] = t[k]; }
      }
      if (changed) this.applyLook();
    }
    // rain
    const rain = this.cur.rain;
    this.rainMat.opacity = rain * 0.65;
    this.rain.visible = rain > 0.02;
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position.array, d = this.drops, cp = camera.position;
      const fall = 11 * dt, n = Math.floor(DROPS * Math.min(1, rain + 0.2));
      const slant = 0.12 * this.cur.windMul;
      for (let i = 0; i < DROPS; i++) {
        d[i * 3 + 1] -= fall;
        if (d[i * 3 + 1] < 0) d[i * 3 + 1] += HEIGHT;
        // drops live in a box that travels with the camera
        const x = cp.x + d[i * 3], z = cp.z + d[i * 3 + 2], y = cp.y - 6 + d[i * 3 + 1];
        const k = i * 6;
        if (i >= n) { p[k] = p[k + 3] = x; p[k + 1] = p[k + 4] = -999; p[k + 2] = p[k + 5] = z; continue; }
        p[k] = x; p[k + 1] = y; p[k + 2] = z;
        p[k + 3] = x - slant; p[k + 4] = y - 0.55; p[k + 5] = z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    // lightning in storms
    if (this.id === 'storm') {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flashT = 12 + Math.random() * 25;
        this.flash.style.opacity = '0.55';
        setTimeout(() => { this.flash.style.opacity = '0'; }, 90);
        setTimeout(() => { this.flash.style.opacity = '0.3'; }, 180);
        setTimeout(() => { this.flash.style.opacity = '0'; }, 260);
        setTimeout(() => this.audio.play('thunder'), 600 + Math.random() * 2500);
      }
    }
  }
}

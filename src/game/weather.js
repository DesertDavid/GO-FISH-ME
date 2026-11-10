import * as THREE from 'three';
import { LightningBolt } from './lightning.js';
import { GFX } from './gfx.js';

// Weather: clouds, light, wind/waves, fog, rain, and how it changes the bite.
// The base state changes every couple of game hours and eases in over ~20 s. On top of it run
// rarer, per-location "events": fog banks, squalls (wind, rain, big seas, lightning and thunder),
// and tides at the coast. Events never persist: a fresh load starts without one.
export const WEATHER = {
  clear: { name: 'Clear', icon: '☀', clouds: 0.18, sun: 9, windMul: 0.8, fogMul: 1, rain: 0, bite: 0.9 },
  partly: { name: 'Partly cloudy', icon: '⛅', clouds: 0.45, sun: 9, windMul: 1, fogMul: 1, rain: 0, bite: 1 },
  overcast: { name: 'Overcast', icon: '☁', clouds: 0.85, sun: 6, windMul: 1.1, fogMul: 1.8, rain: 0, bite: 1.25 },
  rain: { name: 'Rain', icon: '🌧', clouds: 0.95, sun: 4, windMul: 1.25, fogMul: 3, rain: 0.6, bite: 1.4 },
};

const CLIMATE = {
  default: { clear: 3, partly: 4, overcast: 2, rain: 1.2 },
  amazon: { partly: 3, overcast: 2, rain: 3.5 },
  fjord: { partly: 2, overcast: 4, rain: 2 },
  bering: { partly: 1, overcast: 4, rain: 2 },
  gulf: { clear: 4, partly: 3, overcast: 1, rain: 1 },
  reef: { clear: 4, partly: 3, overcast: 1, rain: 1 },
  keys: { clear: 4, partly: 3, overcast: 1, rain: 1 },
  cabo: { clear: 6, partly: 3, overcast: 0.5, rain: 0.2 },
  kariba: { clear: 5, partly: 3, overcast: 0.8, rain: 0.6 },
  mekong: { partly: 3, overcast: 2, rain: 3 },
  chesapeake: { clear: 3, partly: 4, overcast: 2.5, rain: 1.5 },
};

// Event odds per location (relative weights per roll). `pm` = afternoon convective storms
// (peak ~15:30), otherwise squalls come any time. Fog favours the small hours to mid-morning.
const EVENTS = {
  default: { fog: 0.3, squall: 0.4 },
  fjord: { fog: 2, squall: 0.7 },
  bering: { fog: 2.5, squall: 1.2 },
  chesapeake: { fog: 1.6, squall: 0.6, pm: 1 },
  woods: { fog: 0.8, squall: 0.5, pm: 1 },
  tahoe: { fog: 0.15, squall: 0.3 },
  columbia: { fog: 1, squall: 0.3 },
  okeechobee: { fog: 0.6, squall: 1.2, pm: 1 },
  keys: { fog: 0.1, squall: 1, pm: 1 },
  amazon: { fog: 0.8, squall: 1.6, pm: 1 },
  mekong: { fog: 0.9, squall: 1.4, pm: 1 },
  kariba: { fog: 0.5, squall: 0.6, pm: 1 },
  gulf: { fog: 0.4, squall: 1, pm: 1 },
  reef: { fog: 0.1, squall: 0.7, pm: 1 },
  cabo: { fog: 0.5, squall: 0.1 },
};

// Tides exist only at the coast (lakes and rivers have none). Half-range in metres, kept
// modest so the docks stay usable; the Gulf offshore site is too far out for a visible tide.
const TIDE_AMP = { keys: 0.3, chesapeake: 0.22, cabo: 0.45, reef: 0.5, fjord: 0.5, bering: 0.4 };
const TIDE_PERIOD = 12.42;   // hours (semi-diurnal)

// species that react to the tide
const RISING = new Set(['bonefish', 'permit', 'redfish', 'snook', 'seatrout', 'tarpon', 'stripedbass', 'blackdrum', 'croaker', 'spotcroaker', 'whiteperch']);
const FALLING = new Set(['flounder', 'summerflounder', 'halibut', 'pacifichalibut', 'sheepshead', 'cod', 'saithe', 'haddock', 'ling']);
const MOVING = new Set(['bluefish', 'stripedbass', 'crevalle', 'barracuda', 'cobia', 'mangrovesnapper', 'queenfish', 'gt', 'sierra', 'mackerel', 'kingmackerel']);

const DROPS = 5000, BOX = 70, HEIGHT = 34;
const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h / 9973; };
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// xz angle (x = cos, z = sin; north is -z) -> compass point the thing lies towards
const compassPoint = (az) => POINTS[Math.round(((Math.atan2(Math.cos(az), -Math.sin(az)) * 180 / Math.PI + 360) % 360) / 45) % 8];
const clock12 = (h) => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };

export class Weather {
  constructor(engine, loc, saved, ui, audio) {
    this.e = engine;
    this.loc = loc;
    this.ui = ui;
    this.audio = audio;
    this.severe = true;                      // Settings: squalls and lightning
    this.id = saved && WEATHER[saved] ? saved : this.roll();
    this.cur = { ...WEATHER[this.id] };
    this.nextChange = 1.5 + Math.random() * 2;   // game hours
    this.stepT = 0;
    this.clock = { hour: 12, day: 1 };
    // events
    this.ev = null;                          // { kind, t, ... }
    this.eventWait = 1.5 + Math.random() * 3;   // game hours until the first roll
    this.afterT = 0;                         // post-storm bite window, game hours left
    this.L = 0;                              // squall level 0..1 (0.3 = approaching, 1 = on top of you)
    this.F = 0;                              // fog level 0..1
    this.rainLvl = 0;
    this.hornT = 8 + Math.random() * 12;
    this.strikeT = 8;
    this.thunder = [];                       // pending { t, dist }
    this.boltT = 99; this.boltPow = 0;
    this.tideApplied = 0;
    this.tideAmp = loc.water === 'lake' || loc.water === 'river' ? 0 : (TIDE_AMP[loc.id] || 0);
    this.tidePhase = hash(loc.id) * TIDE_PERIOD;
    this.tideRate = 0; this.tideFlow = 0;
    this.flash = document.createElement('div');
    Object.assign(this.flash.style, { position: 'fixed', inset: '0', background: '#dfe8ff', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(this.flash);
    this.bolt = new LightningBolt(engine.scene);
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
    const entries = Object.entries(w);
    let r = Math.random() * entries.reduce((a, [, v]) => a + v, 0);
    for (const [id, v] of entries) { r -= v; if (r <= 0) return id; }
    return 'partly';
  }

  // ---- derived values used by the rest of the game ------------------------------------
  get bite() { return this.cur.bite * this.eventBite() * (0.92 + 0.16 * this.tideFlow); }

  // 0..1 how rough it is for the boat (squall on top of you)
  get rough() { return ss((this.L - 0.3) / 0.7); }

  // unit vector (x, z) the squall wind blows towards
  get gust() { return this.ev?.kind === 'squall' ? { x: -Math.cos(this.ev.az), z: -Math.sin(this.ev.az) } : { x: 0, z: 0 }; }

  // species reaction to the tide (1 = none)
  tideMul(id) {
    if (!this.tideAmp) return 1;
    const f = this.tideFlow, rising = this.tideRate > 0;
    let m = f < 0.12 ? 0.8 : 1;   // slack water: everyone is sluggish
    if (RISING.has(id)) m *= rising ? 1 + 0.7 * f : 1 - 0.25 * f;
    else if (FALLING.has(id)) m *= rising ? 1 - 0.25 * f : 1 + 0.6 * f;
    else if (MOVING.has(id)) m *= 1 + 0.5 * f;
    return m;
  }

  eventBite() {
    const ev = this.ev;
    if (!ev) return 1 + 0.35 * ss(this.afterT / 1.5);   // fish gorge after the front has passed
    if (ev.kind === 'fog') return 1 + 0.15 * this.F;
    if (ev.fading) return 0.35 + 0.95 * (1 - this.L / Math.max(ev.fadeFrom, 0.01));
    const t = ev.t, a = ev.warn, b = a + ev.rise, c = b + ev.hold;
    if (t < a) return 1 + 0.7 * ss(t / a);                  // the bite turns on before it arrives
    if (t < b) return 1.7 - 1.35 * ss((t - a) / ev.rise);
    if (t < c) return 0.35;
    return 0.35 + 0.95 * ss((t - c) / ev.fade);              // and comes back as it clears
  }

  // ---- events -------------------------------------------------------------------------
  startEvent(kind, quiet = false) {
    if (this.ev) return false;
    if (kind === 'squall') {
      this.ev = { kind, t: 0, warn: 0.7, rise: 0.45, hold: 0.5 + Math.random() * 0.5, fade: 0.9, az: Math.random() * Math.PI * 2 };
      if (!quiet) this.ui.toast(`Dark line on the horizon to the ${compassPoint(this.ev.az)} - a squall is building. Fish are feeding hard before it hits.`, 'info');
    } else {
      this.ev = { kind: 'fog', t: 0, warn: 0, rise: 0.6, hold: 1.2 + Math.random() * 2, fade: 0.9, peak: 0.75 + Math.random() * 0.25 };
      if (!quiet) this.ui.toast('Fog is rolling in.', 'info');
    }
    return true;
  }

  // dev/QA: weather.force('fog' | 'squall' | 'clear')
  force(kind) {
    if (kind === 'clear') { this.endEarly(); return; }
    this.ev = null;
    this.startEvent(kind, true);
    this.eventWait = 6;
  }

  endEarly() {
    const ev = this.ev;
    if (!ev || ev.fading) return;
    ev.fading = true; ev.fadeFrom = ev.kind === 'squall' ? this.L : this.F; ev.ft = 0; ev.fdur = 0.5;
  }

  eventLevel(ev) {
    if (ev.fading) return ev.fadeFrom * (1 - ss(ev.ft / ev.fdur));
    const t = ev.t;
    if (ev.kind === 'fog') {
      const a = ev.rise, b = a + ev.hold;
      return t < a ? ss(t / a) : t < b ? 1 : 1 - ss((t - b) / ev.fade);
    }
    const a = ev.warn, b = a + ev.rise, c = b + ev.hold;
    if (t < a) return 0.3 * ss(t / a);
    if (t < b) return 0.3 + 0.7 * ss((t - a) / ev.rise);
    if (t < c) return 1;
    return 1 - ss((t - c) / ev.fade);
  }

  rollEvent(hour) {
    const w = EVENTS[this.loc.id] || EVENTS.default;
    // fog likes the small hours to mid-morning; afternoon thunderstorms peak near 15:30
    const dh = ((hour - 6.5 + 36) % 24) - 12;
    const fog = w.fog * (0.25 + 1.5 * Math.exp(-dh * dh / 18));
    const squall = this.severe ? w.squall * (w.pm ? 0.1 + 2 * Math.exp(-((hour - 15.5) ** 2) / 12) : 1) : 0;
    const total = fog + squall;
    if (Math.random() > 0.8 * (1 - Math.exp(-total * 0.7))) return;
    this.startEvent(Math.random() * total < fog ? 'fog' : 'squall');
  }

  updateEvents(gh) {
    if (!this.severe && this.ev?.kind === 'squall') this.endEarly();
    if (!this.ev) {
      if (this.afterT > 0) this.afterT = Math.max(0, this.afterT - gh);
      this.eventWait -= gh;
      if (this.eventWait <= 0) {
        this.eventWait = 2 + Math.random() * 4;
        this.rollEvent(this.clock.hour);
      }
    } else {
      const ev = this.ev;
      if (this.devLevel != null && !ev.fading) ev.t = ev.kind === 'squall' ? ev.warn + ev.rise * 0.5 : ev.rise + 0.01;   // dev panel: hold the event at devLevel
      else if (ev.fading) ev.ft += gh; else ev.t += gh;
      const done = ev.fading ? ev.ft >= ev.fdur : ev.t >= ev.warn + ev.rise + ev.hold + ev.fade;
      if (done) {
        if (ev.kind === 'squall') { this.afterT = 1.5; this.ui.toast('The squall has passed - skies clearing.', 'good'); }
        else this.ui.toast('The fog is lifting.', 'info');
        this.ev = null;
        this.eventWait = 3 + Math.random() * 4;   // a quiet spell
      }
    }
    const ev = this.ev;
    const lv = ev ? (this.devLevel != null && !ev.fading ? this.devLevel : this.eventLevel(ev)) : 0;
    this.L = ev?.kind === 'squall' ? lv : 0;
    this.F = ev?.kind === 'fog' ? lv : 0;
    if (ev?.kind === 'squall') {
      const clearing = ev.fading || ev.t >= ev.warn + ev.rise + ev.hold;
      if (clearing) this.ui.alert('Squall easing', 'fog');
      else this.ui.alert(ev.t < ev.warn ? `⚠ Squall approaching from the ${compassPoint(ev.az)}` : '⚠ Squall - ride it out or head in');
    } else if (ev?.kind === 'fog' && this.F > 0.25) this.ui.alert('Fog - visibility low', 'fog');
    else this.ui.alert('');
  }

  // ---- looks --------------------------------------------------------------------------
  look() {
    const c = this.cur, L = this.L, F = this.F;
    const look = { clouds: c.clouds, sun: c.sun, windMul: c.windMul, fogMul: c.fogMul, fog: 0, fogBank: 0, waves: 1, gloom: 0 };
    if (L > 0) {
      const w = Math.max(c.windMul, 12 / this.loc.wind);   // ~12 m/s at the peak: rough, but a jon boat still floats
      look.clouds = THREE.MathUtils.lerp(c.clouds, 1, Math.min(1, L * 1.5));
      look.sun = THREE.MathUtils.lerp(c.sun, 1.2, Math.min(1, L * 1.3));
      look.windMul = THREE.MathUtils.lerp(c.windMul, w, ss(L));
      look.fogMul = c.fogMul + 3 * L;
      look.waves = 1 + 0.35 * ss((L - 0.2) / 0.8);
      look.gloom = 0.5 * ss(L);
    }
    if (F > 0) {
      look.clouds = THREE.MathUtils.lerp(look.clouds, 0.92, F);
      look.sun = THREE.MathUtils.lerp(look.sun, Math.min(look.sun, 3), F);
      look.windMul *= 1 - 0.45 * F;
      look.waves = 1 - 0.2 * F;
      look.fog = 0.016 * F;
      look.fogBank = F;
    }
    return look;
  }

  applyLook() {
    this.e.setWeatherLook(this.look());
    const label = this.L > 0.3 ? { name: 'Squall' } : this.F > 0.3 ? { name: 'Fog' } : WEATHER[this.id];
    this.ui.weather(label, this.bite);
    this.audio.setMuffle?.(this.F, this.L);
  }

  // ---- tide ---------------------------------------------------------------------------
  absHour() { return this.clock.hour + 24 * ((this.clock.day || 1) - 1); }

  tideAt(h) {
    const spring = 1 + 0.22 * Math.cos((2 * Math.PI * h) / (24 * 14.77));   // springs / neaps
    return this.tideAmp * spring * Math.sin((2 * Math.PI * (h - this.tidePhase)) / TIDE_PERIOD);
  }

  tideText() {
    if (this.devTide != null) return `Tide ${this.devTide > 0 ? 'high' : 'low'} (held by the dev panel)`;
    const h = this.absHour(), rate = (a) => this.tideAt(a + 0.05) - this.tideAt(a - 0.05);
    const up = rate(h) > 0;
    let t = h;
    for (let i = 0; i < 80; i++) { t += 0.1; if ((rate(t) > 0) !== up) break; }
    return `Tide ${up ? 'rising' : 'falling'} · ${up ? 'high' : 'low'} ${clock12(t - h + this.clock.hour)}`;
  }

  updateTide() {
    if (!this.tideAmp) return;
    const h = this.absHour(), lvl = this.devTide != null ? this.tideAmp * this.devTide : this.tideAt(h);   // devTide (dev panel): +1 high water, -1 low water, held
    this.tideRate = this.devTide != null ? 0 : (this.tideAt(h + 0.05) - this.tideAt(h - 0.05)) / 0.1;   // m per game hour
    this.tideFlow = Math.min(1, Math.abs(this.tideRate) / (this.tideAmp * 1.2 * 2 * Math.PI / TIDE_PERIOD));
    if (Math.abs(lvl - this.tideApplied) > 0.008) { this.tideApplied = lvl; this.e.setTide(lvl); }
  }

  // ---- lightning ----------------------------------------------------------------------
  strike(camera) {
    const ev = this.ev, approach = ev.t < ev.warn && !ev.fading;
    const dist = approach ? 4500 + Math.random() * 5000 : 500 + Math.pow(Math.random(), 1.6) * 5500;
    const az = approach ? ev.az + (Math.random() - 0.5) * 1.2 : Math.random() * Math.PI * 2;
    this.bolt.strike(camera.position, az, dist, 0);
    this.boltT = 0;
    this.boltPow = THREE.MathUtils.clamp(1.15 - dist / 7000, 0.1, 1);
    this.thunder.push({ t: dist / 600, dist });   // the sound lags the flash (speed of sound, a bit compressed)
  }

  updateLightning(dt, camera) {
    if (this.ev?.kind === 'squall' && this.L > 0.12) {
      this.strikeT -= dt;
      if (this.strikeT <= 0) {
        this.strike(camera);
        const on = this.L > 0.8;
        this.strikeT = (on ? 3 : 8) + Math.random() * (on ? 7 : 12);
      }
    }
    // flash envelope: two quick strokes then a fade
    let env = 0;
    if (this.boltT < 0.5) {
      this.boltT += dt;
      const t = this.boltT;
      env = t < 0.08 ? 1 : t < 0.14 ? 0.15 : t < 0.26 ? 0.85 : Math.max(0, 0.4 * (1 - (t - 0.26) / 0.24));
    }
    this.bolt.opacity = env;
    const p = this.boltPow * env;
    this.e.setLightning?.(0.55 * p);
    this.flash.style.opacity = String(0.22 * p * p * (GFX.reduceFlash ? 0.2 : 1));
    for (let i = this.thunder.length - 1; i >= 0; i--) {
      this.thunder[i].t -= dt;
      if (this.thunder[i].t <= 0) { this.audio.thunder?.(this.thunder[i].dist); this.thunder.splice(i, 1); }
    }
  }

  update(dt, gameHoursPassed, camera, clock) {
    if (clock) this.clock = clock;
    this.nextChange -= gameHoursPassed;
    if (this.nextChange <= 0) {
      const next = this.roll();
      this.nextChange = 1.5 + Math.random() * 2;
      if (next !== this.id) {
        this.id = next;
        this.ui.toast(`Weather turning: ${WEATHER[next].name.toLowerCase()}${WEATHER[next].bite > 1.1 ? ' - fish love this' : ''}`, 'info');
      }
    }
    this.updateEvents(gameHoursPassed);
    this.updateTide();
    // ease toward the target a step at a time (each step re-bakes sky and waves)
    this.stepT -= dt;
    if (this.stepT <= 0) {
      this.stepT = this.ev ? 3 : 2;
      const t = WEATHER[this.id];
      let changed = !!this.ev || this.lastEv || this.afterT > 0;
      for (const k of ['clouds', 'sun', 'windMul', 'fogMul', 'rain', 'bite']) {
        const d = t[k] - this.cur[k];
        if (Math.abs(d) > 1e-3) { this.cur[k] += d * 0.2; changed = true; if (Math.abs(t[k] - this.cur[k]) < 0.01) this.cur[k] = t[k]; }
      }
      this.lastEv = !!this.ev;   // one more apply after an event ends so the look settles
      if (changed) this.applyLook();
      this.ui.tide(this.tideAmp ? this.tideText() : '');
    }
    this.updateLightning(dt, camera);
    // foghorn out in the murk
    if (this.F > 0.4) {
      this.hornT -= dt;
      if (this.hornT <= 0) { this.hornT = 22 + Math.random() * 25; this.audio.foghorn?.(0.35 + 0.3 * this.F); }
    }
    // rain: the base weather or a squall, eased so it builds and fades
    const rainTarget = this.devRain != null ? this.devRain : Math.max(this.cur.rain, this.L > 0.25 ? ss((this.L - 0.25) / 0.6) : 0) * (1 - 0.5 * this.F);
    this.rainLvl += (rainTarget - this.rainLvl) * Math.min(1, dt * 0.6);
    const rain = this.rainLvl;
    this.audio.setRain?.(rain);
    this.rainMat.opacity = rain * 0.65;
    this.rain.visible = rain > 0.02;
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position.array, d = this.drops, cp = camera.position;
      const fall = 11 * dt * (1 + this.L * 0.6), n = Math.floor(DROPS * Math.min(1, rain + 0.2) * GFX.weatherFx);
      const slant = 0.12 * this.cur.windMul + 0.5 * this.L;
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
  }
}

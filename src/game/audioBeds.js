import { AMB } from './audioLife.js';

// Looping beds: engine, hull rush, water wash, wind, rain, insects, machinery. Built once per location (the page reloads
// on travel), all parameters eased every ~50 ms. Boat beds go through engIn (sfx volume), the rest through ambIn.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;

// per boat: fundamental range (Hz, firing rate), low-pass range, whine (outboard), gain, chug depth
const ENG = {
  jon: { w: 'sawtooth', idle: 62, max: 190, cut: [480, 2300], whine: [2500, 5200], wg: 0.03, g: 0.075, thrum: 0.15 },
  bass: { w: 'sawtooth', idle: 46, max: 150, cut: [400, 1700], whine: [1700, 3400], wg: 0.024, g: 0.085, thrum: 0.2 },
  skiff: { w: 'sawtooth', idle: 50, max: 160, cut: [420, 1800], whine: [1900, 3700], wg: 0.026, g: 0.08, thrum: 0.2 },
  center: { w: 'sawtooth', idle: 40, max: 135, cut: [380, 1500], whine: [1500, 3000], wg: 0.02, g: 0.1, thrum: 0.25, twin: 1 },
  sport: { w: 'sawtooth', idle: 30, max: 105, cut: [300, 950], whine: [900, 1800], wg: 0.008, g: 0.11, thrum: 0.5 },
  trawler: { w: 'sawtooth', idle: 21, max: 40, cut: [190, 460], whine: [600, 900], wg: 0.004, g: 0.13, thrum: 0.9 },
  seiner: { w: 'sawtooth', idle: 18, max: 34, cut: [160, 380], whine: [500, 800], wg: 0.003, g: 0.14, thrum: 0.9 },
  kayak: { paddle: true, w: 'sine', idle: 20, max: 20, cut: [200, 200], whine: [1000, 1000], wg: 0, g: 0, thrum: 0 },
  pontoon: { w: 'sawtooth', idle: 38, max: 118, cut: [360, 1400], whine: [1300, 2600], wg: 0.016, g: 0.08, thrum: 0.3 },
  bay: { w: 'sawtooth', idle: 34, max: 128, cut: [420, 1700], whine: [1500, 3100], wg: 0.022, g: 0.1, thrum: 0.3 },
  yacht: { w: 'sawtooth', idle: 24, max: 72, cut: [220, 640], whine: [700, 1200], wg: 0.004, g: 0.12, thrum: 0.75, twin: 1 },
};

export class Beds {
  constructor(A, locId) {
    this.A = A; this.cfg = AMB[locId] || {};
    this.acc = 0; this.idleT = 0; this.on = true; this.r = 0; this.startAt = 0;
    this.rain = 0; this.fog = 0; this.storm = 0;
    const c = A.ctx, cfg = this.cfg;
    const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const filt = (type, f, q = 0.7, to) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; };
    const src = (buf, off = 0) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, off); A.live++; return s; };
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); A.live++; return o; };
    this.k = { gain, filt, src, osc };

    // ---- water wash and whitecap hiss
    this.washG = gain(0.05, A.ambIn); this.wash = filt('lowpass', 400, 0.5, this.washG);
    src(A.pink, 0.3).connect(this.wash);
    // ---- hull rush (speed through the water)
    this.rushG = gain(0, A.engIn); this.rush = filt('bandpass', 600, 0.7, this.rushG);
    src(A.pink, 1.7).connect(this.rush);
    // ---- wind: broadband + gusts + a thin howl for the strong stuff
    this.gustG = gain(0.7); this.windG = gain(0.05, A.ambIn); this.wind = filt('bandpass', 320, 0.6);
    src(A.pink, 2.4).connect(this.wind); this.wind.connect(this.gustG); this.gustG.connect(this.windG);
    for (const [hz, d] of [[0.071, 0.22], [0.19, 0.1]]) { const o = osc('sine', hz); o.connect(gain(d, this.gustG.gain)); }
    this.howlG = gain(0, A.ambIn); this.howl = filt('bandpass', 600, 16, this.howlG);
    src(A.pink, 3.1).connect(this.howl);
    { const o = osc('sine', 0.13); o.connect(gain(35, this.howl.frequency)); }
    // ---- rain: hiss on the water, patter, a roar when it is heavy, drumming on the hull
    this.rainG = gain(0, A.ambIn); src(A.white, 0.2).connect(filt('highpass', 2500, 0.7, this.rainG));
    this.patG = gain(0, A.ambIn); src(A.crackle, 0.9).connect(filt('bandpass', 1900, 0.6, this.patG));
    this.roarG = gain(0, A.ambIn); src(A.pink, 2.9).connect(filt('lowpass', 900, 0.6, this.roarG));
    this.hullG = gain(0, A.engIn); src(A.crackle, 2.2).connect(filt('bandpass', 520, 0.9, this.hullG));
    // ---- engine
    const e = ENG.jon;
    this.engG = gain(0, A.engIn);
    this.engLp = filt('lowpass', 500, 1.2, this.engG);
    this.am = gain(1 - e.thrum * 0.5, this.engLp);
    this.o1 = osc('sawtooth', 60); this.o2 = osc('square', 30); this.o3 = osc('sawtooth', 60.5);
    this.o1.connect(gain(0.5, this.am)); this.o2.connect(gain(0.35, this.am)); this.o3.connect(gain(0.3, this.am));
    this.chug = osc('sine', 15); this.chugG = gain(0.07, this.am.gain); this.chug.connect(this.chugG);
    this.whineG = gain(0, A.engIn); this.whine = filt('bandpass', 3000, 6, this.whineG);
    src(A.white, 1.1).connect(this.whine);
    this.engBoat = null;
    // ---- insects (tropics, ponds): crickets at night, a day-time drone
    if (cfg.crickets) {
      this.crickG = gain(0, A.ambIn);
      this.crickets = [4300, 4750, 5200].map((f, i) => {
        const car = osc('sine', f), pulse = gain(0.5), gate = gain(0.5);
        const lfo = osc('square', 30 + i * 3), lg = gain(0.5, pulse.gain); lfo.connect(lg);
        const slow = osc('square', 1.6 + i * 0.37), sg = gain(0.5, gate.gain); slow.connect(sg);
        car.connect(pulse); pulse.connect(gate); gate.connect(this.crickG);
        return car;
      });
    }
    if (cfg.insects) {
      this.cicG = gain(0, A.ambIn);
      const nz = src(A.pink, 0.6), bp = filt('bandpass', 5200, 7), am = gain(0.5), sw = gain(0.9);
      nz.connect(bp); bp.connect(am); am.connect(sw); sw.connect(this.cicG);
      const l = osc('sine', 88), lg = gain(0.5, am.gain); l.connect(lg);
      const so = osc('sine', 0.09); so.connect(gain(0.1, sw.gain));        // slow swell: +-10% of its own level
    }
    // ---- machinery: the Gulf rig, marina generators and compressors
    if (cfg.rig || cfg.marina) {
      this.machG = gain(0, A.ambIn);
      const lp = filt('lowpass', 260, 0.7, this.machG);
      osc('sawtooth', cfg.rig ? 50 : 60).connect(gain(0.5, lp));
      osc('sine', cfg.rig ? 100.4 : 120.3).connect(gain(0.3, lp));
      src(A.pink, 0.5).connect(gain(0.8, lp));
      if (cfg.rig) { const b = filt('bandpass', 1300, 9, this.machG); src(A.white, 2).connect(gain(0.025, b)); }
    }
  }

  setRain(v) { this.rain = v; }
  setFog(f, storm = 0) { this.fog = f; this.storm = storm; }

  update(dt, S) {
    this.acc += dt;
    if (this.acc < 0.05) return;
    const step = this.acc; this.acc = 0;
    const A = this.A, now = A.ctx.currentTime, cfg = this.cfg;
    const set = (p, v, tau = 0.15) => p.setTargetAtTime(v, now, tau);
    const day = 1 - S.night, foot = S.foot;
    // ---- water
    const vis = foot ? 0.55 : 1;
    set(this.wash.frequency, 240 + 520 * S.waveH + 80 * S.speed);
    set(this.washG.gain, (0.03 + 0.075 * S.waveH + 0.05 * Math.min(1, S.current * 2)) * vis * (S.nearShore || !foot ? 1 : 0.5), 0.4);
    const sp = clamp(S.speed / S.maxSpeed, 0, 1.2);
    set(this.rush.frequency, 450 + S.speed * 140);
    set(this.rushG.gain, foot ? 0 : 0.17 * Math.pow(sp, 1.3) * (0.6 + 0.4 * Math.min(1, S.waveH)), 0.25);
    // ---- wind
    const w = S.wind, wb = cfg.wind ?? 1;
    set(this.wind.frequency, 280 + w * 28);
    set(this.windG.gain, (0.012 + 0.4 * Math.pow(w / 16, 1.6)) * wb * (foot && !S.nearShore ? 0.7 : 1), 0.6);
    set(this.howlG.gain, clamp((w * wb - 8) / 10, 0, 1) * 0.045, 0.8);
    set(this.howl.frequency, 520 + w * 18, 1);
    // ---- rain
    const rn = this.rain, hullK = foot ? 0.3 : 1;
    set(this.rainG.gain, rn * 0.15, 0.5);
    set(this.patG.gain, rn * 0.1, 0.5);
    set(this.roarG.gain, rn * rn * 0.2, 0.5);
    set(this.hullG.gain, rn * 0.12 * hullK, 0.5);
    // ---- engine: cuts out after a few idle seconds, when anchored, and on foot
    const moving = Math.abs(S.thr) > 0.05 || S.speed > 0.6;
    if (ENG[S.boatId]?.paddle) {            // the kayak has no engine: a paddle stroke every second or two while pushing
      this.padT = (this.padT || 0) - step;
      if (!foot && !S.anchored && !S.engOff && Math.abs(S.thr) > 0.05 && this.padT <= 0) { A.play('paddle', 0.55 + 0.45 * Math.abs(S.thr)); this.padT = 1.9 - 0.95 * Math.abs(S.thr); }
    } else if (!foot && !S.anchored && !S.engOff && moving) {
      this.idleT = 0;
      if (!this.on) { this.on = true; this.startAt = now + 0.9; A.play('engineStart'); }
    } else this.idleT += step;
    if (this.on && (foot || S.anchored || S.engOff || this.idleT > 6)) this.on = false;
    const e = ENG[S.boatId] || ENG.jon;
    if (this.engBoat !== S.boatId) {
      this.engBoat = S.boatId;
      this.o1.type = e.w; this.o3.type = e.w;
      set(this.whine.Q, 6, 0.01);
    }
    const run = this.on && now >= this.startAt;
    const rT = this.on ? clamp(0.1 + 0.7 * Math.abs(S.thr) + 0.2 * sp, 0, 1) : 0;
    this.r += (rT - this.r) * (1 - Math.exp(-step / 0.5));
    const f = lerp(e.idle, e.max, this.r);
    set(this.o1.frequency, f, 0.06); set(this.o2.frequency, f * 0.5, 0.06); set(this.o3.frequency, f * (e.twin ? 1.012 : 1.004) + 0.3, 0.06);
    set(this.chug.frequency, Math.max(4, f * 0.5), 0.06);
    set(this.chugG.gain, e.thrum * 0.5, 0.2); set(this.am.gain, 1 - e.thrum * 0.5, 0.2);
    set(this.engLp.frequency, lerp(e.cut[0], e.cut[1], this.r), 0.1);
    set(this.engG.gain, run ? e.g * (0.35 + 0.65 * this.r) : 0, run ? 0.25 : 0.6);
    set(this.whine.frequency, lerp(e.whine[0], e.whine[1], this.r), 0.1);
    set(this.whineG.gain, run ? e.wg * this.r * this.r : 0, 0.2);
    // ---- insects
    if (this.crickG) set(this.crickG.gain, cfg.crickets * clamp((S.night - 0.15) / 0.55, 0, 1) * 0.02 * (1 - S.rain), 1.5);
    if (this.cicG) { set(this.cicG.gain, cfg.insects * Math.pow(day, 1.5) * 0.03 * (1 - S.rain * 0.8) * (1 - S.fog * 0.3), 1.5); }
    if (this.machG) {
      let k;
      if (cfg.rig) k = clamp(1 - Math.hypot(S.px - 260, S.pz + 420) / 800, 0, 1);
      else k = clamp(1 - S.dockDist / 160, 0, 1);
      set(this.machG.gain, (cfg.rig ? 0.012 + 0.07 * k * k : 0.035 * (cfg.marina || 1) * k), 1);
    }
  }
}

// Synthesised sound (Web Audio): ambient water/wind, engine, reel clicks, screaming drag,
// splashes and line snaps. Starts on the first user gesture.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.reeling = false;
    this.dragRate = 0;
    this.nextClick = 0;
    this.nextDrag = 0;
    this.muted = false;
    this.vol = { master: 0.7, sfx: 1, amb: 1, ui: 1 };
    this.fogMul = 1;
    this.focused = true;
    this.muteBlur = false;
    this.cur = null;     // bus the current play() call writes to (null = effects)
  }

  start() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch (err) {
      console.warn('audio unavailable', err);
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    // buses under the master: effects, ambience (water, wind, rain, thunder) and UI clicks
    this.sfxBus = c.createGain(); this.ambBus = c.createGain(); this.uiBus = c.createGain();
    for (const b of [this.sfxBus, this.ambBus, this.uiBus]) b.connect(this.master);
    this.applyVolumes();
    // noise buffer shared by every noisy sound
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 + w * 0.05; }
    // ambient lapping water + wind
    const amb = c.createBufferSource();
    amb.buffer = this.noise; amb.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    this.ambGain = c.createGain(); this.ambGain.gain.value = 0.25;
    this.ambLp = lp;
    amb.connect(lp).connect(this.ambGain).connect(this.ambBus);
    amb.start();
    this.lfo = c.createOscillator(); this.lfo.frequency.value = 0.18;
    const lfoGain = c.createGain(); lfoGain.gain.value = 250;
    this.lfo.connect(lfoGain).connect(lp.frequency);
    this.lfo.start();
    // engine: two detuned saws through a lowpass
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    const eLp = c.createBiquadFilter(); eLp.type = 'lowpass'; eLp.frequency.value = 400;
    this.eng = [c.createOscillator(), c.createOscillator()];
    this.eng.forEach((o, i) => { o.type = 'sawtooth'; o.frequency.value = 40 + i * 1.5; o.connect(eLp); o.start(); });
    eLp.connect(this.engGain).connect(this.sfxBus);
    // rain hiss
    const rain = c.createBufferSource();
    rain.buffer = this.noise; rain.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    this.rainGain = c.createGain(); this.rainGain.gain.value = this.pendingRain || 0;
    rain.connect(hp).connect(this.rainGain).connect(this.ambBus);
    rain.start();
  }

  setAmbient(wind) { if (this.ctx) this.ambGain.gain.value = 0.15 + Math.min(0.5, wind / 30); }

  // fog and storms muffle / swell the world: wind howls up, everything else drops a little
  setMuffle(fog, storm = 0) {
    this.pendingFog = fog;
    if (!this.ctx) return;
    this.fogMul = 1 - 0.3 * fog;
    this.applyVolumes(1.5);
    this.ambGain.gain.setTargetAtTime(0.25 * (1 - 0.35 * fog) + storm * 0.3, this.ctx.currentTime, 1.5);
  }

  // thunder arriving after the flash: dist in metres. Near = a hard crack then a long roll; far = a low muffled rumble.
  thunder(dist = 2000) {
    if (!this.ctx || this.muted) return;
    this.cur = this.ambBus;
    try { this.thunderSounds(dist); } finally { this.cur = null; }
  }

  thunderSounds(dist) {
    const near = Math.max(0, 1 - dist / 3500), far = 1 - near;
    if (near > 0.25) this.burst(0.25, 2600, 0.8, 0.9 * near, 'highpass');   // the crack
    this.burst(2.5 + far * 4, 90 + near * 220, 0.7, 0.35 + 0.7 * near);
    this.burst(1.6 + far * 2.5, 60 + near * 120, 0.6, 0.45, 'lowpass', 0.25 + Math.random() * 0.5);
    this.burst(1.2, 140, 0.8, 0.25 * far + 0.1, 'lowpass', 1.2 + Math.random());
  }

  // one blast of a low two-tone foghorn
  foghorn(gain = 0.5) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    for (const [f, g] of [[92, 1], [138, 0.6], [185, 0.25]]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const v = c.createGain();
      v.gain.setValueAtTime(0, t);
      v.gain.linearRampToValueAtTime(gain * 0.12 * g, t + 0.35);
      v.gain.setValueAtTime(gain * 0.12 * g, t + 1.9);
      v.gain.linearRampToValueAtTime(0, t + 2.6);
      o.connect(lp).connect(v).connect(this.ambBus);
      o.start(t); o.stop(t + 2.7);
    }
  }

  // Settings > Audio: { master, sfx, amb, ui } 0..1
  setVolumes(v) {
    Object.assign(this.vol, v);
    this.volume = this.vol.master;
    this.applyVolumes();
  }

  setVolume(v) { this.setVolumes({ master: v }); }

  // "mute when the window is not in focus"
  setFocus(focused, muteBlur) {
    this.focused = focused; this.muteBlur = muteBlur;
    this.applyVolumes();
  }

  applyVolumes(smooth = 0.05) {
    this.volume = this.vol.master;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, mute = this.muteBlur && !this.focused ? 0 : 1;
    this.master.gain.setTargetAtTime(this.vol.master * this.fogMul * mute, t, smooth);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.amb, t, 0.05);
    this.uiBus.gain.setTargetAtTime(this.vol.ui, t, 0.05);
  }

  setRain(level) {
    this.pendingRain = level * 0.5;
    if (this.ctx) this.rainGain.gain.setTargetAtTime(level * 0.5, this.ctx.currentTime, 1);
  }

  engine(throttle, speed) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rev = 38 + Math.abs(throttle) * 50 + Math.abs(speed) * 2.5;
    this.eng[0].frequency.setTargetAtTime(rev, t, 0.2);
    this.eng[1].frequency.setTargetAtTime(rev * 1.01 + 1.5, t, 0.2);
    this.engGain.gain.setTargetAtTime(0.02 + Math.abs(throttle) * 0.07, t, 0.25);
  }

  burst(dur, freq, q, gain, type = 'lowpass', delay = 0) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.cur || this.sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  tone(freq, dur, gain, type = 'sine', slide = 0, delay = 0) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type;
    const g = c.createGain();
    const t = c.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.cur || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name, p = 1) {
    if (!this.ctx || this.muted) return;
    this.cur = name === 'ui' ? this.uiBus : null;
    this.playSound(name, p);
    this.cur = null;
  }

  playSound(name, p) {
    switch (name) {
      case 'cast': this.burst(0.35, 900 + p * 1500, 0.8, 0.25, 'bandpass'); break;
      case 'plop': this.burst(0.25, 500, 1.5, 0.5); this.tone(380, 0.12, 0.12, 'sine', -200); break;
      case 'splash': this.burst(0.7, 1400, 0.6, 0.6); this.burst(0.4, 300, 1, 0.5, 'lowpass', 0.05); break;
      case 'tick': this.tone(1800, 0.04, 0.1, 'square'); break;
      case 'strike': this.tone(660, 0.12, 0.18, 'triangle'); this.tone(880, 0.16, 0.18, 'triangle', 0, 0.1); break;
      case 'hookset': this.burst(0.15, 2500, 2, 0.4, 'bandpass'); this.tone(140, 0.25, 0.25, 'sine', -60); break;
      case 'snap': this.tone(2400, 0.08, 0.3, 'square', -1800); this.burst(0.2, 3000, 3, 0.3, 'highpass'); break;
      case 'miss': this.tone(300, 0.3, 0.15, 'triangle', -150); break;
      case 'landed': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 0.14, 'triangle', 0, i * 0.08)); break;
      case 'cash': [1318, 1760].forEach((f, i) => this.tone(f, 0.18, 0.12, 'square', 0, i * 0.07)); break;
      case 'winch': this.tone(90, 1.5, 0.12, 'sawtooth', 40); break;
      case 'ui': this.tone(900, 0.05, 0.06, 'sine'); break;
      case 'thunder': this.cur = this.ambBus; this.thunderSounds(p > 1 ? p : 1800); break;
      case 'thrash': this.burst(0.25, 1800, 0.8, 0.3); break;
      case 'bump': this.tone(70 + 30 * Math.random(), 0.35, 0.2 * p + 0.1, 'sine', -30); this.burst(0.18, 450, 1.2, 0.25 * p + 0.1); break;
      case 'scream': for (let i = 0; i < 70; i++) this.tone(3300 + (i % 3) * 120, 0.01, 0.09, 'square', 0, i * 0.028); break;
      default: break;
    }
  }

  reel(on) { this.reeling = on; }
  drag(rate) { this.dragRate = rate; }

  update(dt, ratio = 5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.reeling && t > this.nextClick) { this.tone(2600 + Math.random() * 300, 0.015, 0.035, 'square'); this.nextClick = t + 0.9 / (ratio * 4); }
    if (this.dragRate > 0.05 && t > this.nextDrag) {
      this.tone(3200 + Math.random() * 400, 0.012, 0.07, 'square');
      this.nextDrag = t + Math.max(0.012, 0.09 / (1 + this.dragRate * 2));
    }
  }
}

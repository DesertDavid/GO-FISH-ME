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
    this.master.gain.value = this.volume ?? 0.7;
    this.master.connect(c.destination);
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
    amb.connect(lp).connect(this.ambGain).connect(this.master);
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
    eLp.connect(this.engGain).connect(this.master);
    // rain hiss
    const rain = c.createBufferSource();
    rain.buffer = this.noise; rain.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    this.rainGain = c.createGain(); this.rainGain.gain.value = this.pendingRain || 0;
    rain.connect(hp).connect(this.rainGain).connect(this.master);
    rain.start();
  }

  setAmbient(wind) { if (this.ctx) this.ambGain.gain.value = 0.15 + Math.min(0.5, wind / 30); }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
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
    src.connect(f).connect(g).connect(this.master);
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
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name, p = 1) {
    if (!this.ctx || this.muted) return;
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
      case 'thunder': this.burst(3.5, 120, 0.7, 0.9); this.burst(1.2, 400, 0.5, 0.4, 'lowpass', 0.1); break;
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

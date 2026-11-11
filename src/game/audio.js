import * as THREE from 'three';
import { SOUNDS } from './audioSynth.js';
import { Beds } from './audioBeds.js';
import { Life } from './audioLife.js';

// Synthesised sound (Web Audio). Everything is procedural; nothing is loaded.
//
// Graph:  one-shots and beds -> sfxBus / ambBus (Settings volumes) -> world low-pass (pause + underwater muffle)
//         -> compressor ->  master -> soft clip (never above -0.2 dBFS) -> speakers;  uiBus joins at the compressor
//         (UI beeps stay clear when the world is muffled).  Beds and events that should sit under loud events
//         go through ambIn / engIn, which the ducker dips for thunder, line snaps, big splashes.
//
// Files: audioSynth.js = every one-shot (SOUNDS), audioBeds.js = looping beds (engine, water, wind, rain, insects, ...),
//        audioLife.js = stochastic events placed in the world (gulls, frogs, lapping, surf, creaks, fog bell, ...).
//
// Public API for other systems (fight code etc.): play(name, p, {x,z,delay}), playDrag(load 0..1), playSnap(),
// playNetScoop(), playBite(), playSplash(size), playFlop(size), playLivewell(), playCoin(n), playPing(depth),
// plus the older reel(on) / drag(rate) / engine(throttle, speed) / setRain / setMuffle / thunder / foghorn.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const _v = new THREE.Vector3();

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.reeling = false;
    this.nextClick = 0;
    this.muted = false;
    this.vol = { master: 0.7, sfx: 1, amb: 1, ui: 1 };
    this.fogMul = 1;
    this.focused = true;
    this.muteBlur = false;
    this.live = 0;                   // sources currently running (leak check: see stats())
    this.vb = {};                    // voice budgets: category -> end times
    this.last = {};                  // per-sound last start, for cool-downs
    this.lureSize = 1; this.hullLen = 5; this.boatId = 'jon';
    this.thr = 0; this.spd = 0;
    this.pendingRain = 0; this.pendingFog = 0;
    this.dragLoad = 0; this.dragVoice = null; this.dragIdle = 0;
    this.S = { atDock: false };      // world state, refreshed by update(dt, ratio, game)
    this.queue = [];                 // splashes waiting for the end of the frame
    this.paused = false; this.under = false;
    this.beds = null; this.life = null;
    this.scanT = 0; this.stepD = 0; this.lastPanel = null; this.pingT = 2; this.prevAnchor = false;
    this.ownT = -1;
  }

  // ctx: pass an OfflineAudioContext to render sounds for level checks
  start(ctx, loc) {
    if (this.ctx) return;
    try { this.ctx = ctx || new AudioContext(); } catch (err) { console.warn('audio unavailable', err); return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.clip = c.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.1) * 0.97; }   // never above ~ -0.3 dBFS
    this.clip.curve = curve; this.clip.oversample = '2x';
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 12; this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.25;
    this.comp.connect(this.master); this.master.connect(this.clip); this.clip.connect(c.destination);
    // the world path (muffles when paused or underwater) and the UI path
    this.world = c.createBiquadFilter(); this.world.type = 'lowpass'; this.world.frequency.value = 20000; this.world.Q.value = 0.5;
    this.world.connect(this.comp);
    this.sfxBus = c.createGain(); this.ambBus = c.createGain(); this.uiBus = c.createGain();
    this.sfxBus.connect(this.world); this.ambBus.connect(this.world); this.uiBus.connect(this.comp);
    // ducked inputs for beds
    this.ambIn = c.createGain(); this.ambIn.connect(this.ambBus);
    this.engIn = c.createGain(); this.engIn.connect(this.sfxBus);
    this.applyVolumes();
    // shared noise: pink (most things), white (rain, hiss), crackle (droplets); all loop seamlessly
    const sr = c.sampleRate;
    this.pink = this.noiseBuf(4 * sr, true); this.white = this.noiseBuf(4 * sr, false); this.crackle = this.crackleBuf(4 * sr);
    if (loc) this.build(loc);
  }

  // beds and life depend on the water; the game hands its id over on the first frame (the page reloads on travel)
  build(loc) {
    if (this.beds) return;
    this.loc = loc;
    this.beds = new Beds(this, loc);
    this.life = new Life(this, loc);
    this.beds.setRain(this.pendingRain); this.beds.setFog(this.pendingFog);
  }

  noiseBuf(n, pink) {
    const c = this.ctx, X = Math.floor(n * 0.05), r = new Float32Array(n + X);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < r.length; i++) {
      const w = Math.random() * 2 - 1;
      if (pink) { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; r[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; } else r[i] = w * 0.7;
    }
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = r[i];
    for (let i = 0; i < X; i++) { const k = i / X; d[i] = r[i] * Math.sin(k * Math.PI / 2) + r[n + i] * Math.cos(k * Math.PI / 2); }   // equal-power loop seam
    return buf;
  }

  crackleBuf(n) {
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    const rate = 1100 / this.ctx.sampleRate;
    for (let i = 0; i < n; i++) if (Math.random() < rate) d[i] = (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? 1 : -1);
    for (let i = 1; i < n; i++) d[i] = d[i] + d[i - 1] * 0.5;   // a touch of body on each drop (impulses wrap, so no seam)
    return buf;
  }

  // ---------------------------------------------------------------- building blocks
  env(p, t, a, hold, d, peak) {
    d = Math.max(0.012, d);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) p.setValueAtTime(peak, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    p.linearRampToValueAtTime(0, t + a + hold + d + 0.012);
  }

  track(src, nodes) {
    this.live++;
    src.onended = () => { this.live--; try { src.disconnect(); for (const n of nodes) n.disconnect(); } catch { /* already gone */ } };
  }

  // a shaped noise burst
  nz(t, o) {
    const c = this.ctx, a = Math.max(0.003, o.a ?? 0.004), hold = o.hold || 0, d = o.d ?? 0.2;
    const src = c.createBufferSource(); src.buffer = o.white ? this.white : this.pink; src.loop = true;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + a + hold + Math.max(0.012, d));
    const g = c.createGain(); this.env(g.gain, t, a, hold, d, o.g ?? 0.2);
    src.connect(f); f.connect(g); g.connect(o.out || this.sfxBus);
    const end = t + a + hold + Math.max(0.012, d) + 0.03;
    src.start(t, Math.random() * 3); src.stop(end);
    this.track(src, [f, g]);
    return end;
  }

  // a shaped tone: o.vib = [Hz, depth in Hz], o.lp = low-pass cutoff
  os(t, o) {
    const c = this.ctx, a = Math.max(0.003, o.a ?? 0.004), hold = o.hold || 0, d = o.d ?? 0.2;
    const osc = c.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + a + hold + Math.max(0.012, d));
    const g = c.createGain(); this.env(g.gain, t, a, hold, d, o.g ?? 0.1);
    const nodes = [g];
    let head = osc;
    if (o.lp) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = 0.7; head.connect(lp); head = lp; nodes.push(lp); }
    head.connect(g); g.connect(o.out || this.sfxBus);
    const end = t + a + hold + Math.max(0.012, d) + 0.03;
    osc.start(t); osc.stop(end);
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(osc.frequency);
      l.start(t); l.stop(end); nodes.push(lg); this.track(l, [lg]);
    }
    this.track(osc, nodes);
    return end;
  }

  // voice budget: false when `cat` already has `max` sounds playing (no stacking)
  claim(cat, max, end) {
    const now = this.ctx.currentTime, a = this.vb[cat] || (this.vb[cat] = []);
    for (let i = a.length - 1; i >= 0; i--) if (a[i] < now) a.splice(i, 1);
    if (a.length >= max) return false;
    a.push(end);
    return true;
  }

  // a node that places whatever is connected to it at (x, z) in the world, with air absorption
  spat(out, x, z, ref = 8) {
    const c = this.ctx, S = this.S;
    const p = c.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = 3000;
    p.positionX.value = x; p.positionY.value = 0; p.positionZ.value = z;
    const d = Math.hypot(x - (S.cx || 0), z - (S.cz || 0));
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(17000 / (1 + d / 80), 1500, 17000);
    lp.connect(p); p.connect(out);
    return lp;
  }

  busNode(name) { return name === 'ui' ? this.uiBus : name === 'amb' ? this.ambBus : this.sfxBus; }

  // ---------------------------------------------------------------- one-shots
  // play('name', intensity, { x, z (world position), delay })
  play(name, p = 1, o = null) {
    if (!this.ctx || this.muted) return;
    const S = SOUNDS[name];
    if (!S) return;
    const c = this.ctx, now = c.currentTime;
    if (S.cd && now - (this.last[name] ?? -9) < S.cd) return;
    this.last[name] = now;
    if (name === 'splash' || name === 'plop' || name === 'thrash') this.ownT = now;
    let out = this.busNode(S.bus);
    if (o && o.x !== undefined) out = this.spat(out, o.x, o.z, o.ref || 8);
    S.fn(this, now + 0.006 + ((o && o.delay) || 0), p, out);
    if (S.duck) this.duck(...S.duck);
  }

  duck(amt, hold = 0.3, rel = 0.8) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const g of [this.ambIn.gain, this.engIn.gain]) {
      g.cancelScheduledValues(t); g.setTargetAtTime(1 - amt, t, 0.02); g.setTargetAtTime(1, t + hold, rel / 3);
    }
  }

  playSnap() { this.play('snap'); }
  playBite() { this.play('strike'); }
  playNetScoop() { this.play('scoop'); }
  playSplash(size = 1, at) { this.play('splash', size, at); }
  playFlop(size = 1) { this.play('flop', size); }
  playLivewell() { this.play('livewell'); }
  playCoin(n = 2) { this.play('coin', n); }
  playPing(depth = 10) { this.play('ping', depth); }
  playHookset() { this.play('hookset'); }
  playCast(power = 0.5) { this.play('cast', power); }
  playLand() { this.play('landed'); }

  // a splash somewhere in the world (wildlife, other anglers, the fish you hooked): placed and attenuated by distance
  splashAt(x, z, amp, size) {
    if (!this.ctx || this.muted || amp * size < 0.012) return;
    if (this.queue.length < 8) this.queue.push({ x, z, s: Math.min(3, amp * size * 6) });
  }
  blow(x, z) { this.play('blow', 1, { x, z, ref: 14 }); }

  // ---------------------------------------------------------------- the old simple API (still called around the game)
  reel(on) { this.reeling = on; }
  engine(throttle, speed) { this.thr = throttle; this.spd = speed; }
  setAmbient() { /* wind now follows the weather itself (audioBeds) */ }
  drag(rate) { this.playDrag(rate > 0.02 ? 1 - Math.exp(-rate * 0.7) : 0); }

  // line coming off a slipping drag: 0 = off .. 1 = screaming. Call every frame while it slips (0 releases).
  playDrag(load) {
    if (!this.ctx) return;
    this.dragLoad = clamp(load, 0, 1);
  }

  setRain(level) {
    this.pendingRain = level;
    this.beds?.setRain(level);
  }

  // fog and storms muffle / swell the world
  setMuffle(fog, storm = 0) {
    this.pendingFog = fog;
    if (!this.ctx) return;
    this.fogMul = 1 - 0.3 * fog;
    this.applyVolumes(1.5);
    this.beds?.setFog(fog, storm);
  }

  thunder(dist = 2000) { this.play('thunder', dist); }
  foghorn(gain = 0.5) {
    if (!this.ctx) return;
    const S = this.S, a = (this.hornAng ??= Math.random() * 6.28);
    this.play('foghorn', gain, { x: (S.cx || 0) + Math.cos(a) * 420, z: (S.cz || 0) + Math.sin(a) * 420, ref: 40 });
  }

  // Settings > Audio: { master, sfx, amb, ui } 0..1
  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  setVolume(v) { this.setVolumes({ master: v }); }
  setFocus(focused, muteBlur) { this.focused = focused; this.muteBlur = muteBlur; this.applyVolumes(); }

  applyVolumes(smooth = 0.05) {
    this.volume = this.vol.master;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, mute = this.muteBlur && !this.focused ? 0 : 1;
    this.master.gain.setTargetAtTime(this.vol.master * 1.4 * this.fogMul * mute, t, smooth);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.amb, t, 0.05);
    this.uiBus.gain.setTargetAtTime(this.vol.ui, t, 0.05);
  }

  // headless leak check: nodes should stay bounded
  stats() { return { live: this.live, ctx: this.ctx ? this.ctx.state : 'none', time: this.ctx ? this.ctx.currentTime : 0 }; }

  // ---------------------------------------------------------------- per frame
  update(dt, ratio = 5, g = null) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    // reel clicks, scheduled ahead of the frame so they stay even
    if (this.reeling) {
      if (this.nextClick < now) this.nextClick = now;
      let n = 0;
      while (this.nextClick < now + 0.06 && n++ < 4) { SOUNDS.reelClick.fn(this, this.nextClick, 1, this.sfxBus); this.nextClick += (0.9 / (ratio * 4)) * (0.9 + Math.random() * 0.2); }
    }
    this.updateDrag(dt);
    if (!g) return;
    this.build(g.loc.id);
    this.sense(dt, g);
    const S = this.S;
    // pause menu / underwater: the world goes behind a low-pass, UI beeps stay clear
    const want = S.paused ? 650 : S.under ? 520 : 20000;
    if (want !== this.worldF) { this.worldF = want; this.world.frequency.setTargetAtTime(want, now, S.paused ? 0.07 : 0.15); }
    // listener
    const l = c.listener;
    if (l.positionX) {
      l.positionX.value = S.cx; l.positionY.value = 0; l.positionZ.value = S.cz;
      l.forwardX.value = S.fx; l.forwardY.value = 0; l.forwardZ.value = S.fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
    // splashes queued during the frame; the ones you caused yourself already played
    for (const q of this.queue) {
      if (now - this.ownT < 0.15 && Math.hypot(q.x - (S.lureX ?? 1e9), q.z - (S.lureZ ?? 1e9)) < 6) continue;
      if (Math.hypot(q.x - S.cx, q.z - S.cz) < 2.5) continue;
      this.play('splash', q.s, { x: q.x, z: q.z, ref: 6 });
    }
    this.queue.length = 0;
    this.beds.update(dt, S);
    this.life.update(dt, S, g);
    // panel open/close beeps, livewell lid, sonar ping, footsteps, anchor
    if (g.ui.panel !== this.lastPanel) {
      if (g.ui.panel && !this.lastPanel) this.play(g.ui.panel === 'livewell' ? 'livewell' : 'uiOpen');
      else if (!g.ui.panel && this.lastPanel) this.play('uiClose');
      this.lastPanel = g.ui.panel;
    }
    if (g.settings.sonar && g.settings.sonarPing !== false && !g.foot && !S.paused) {
      this.pingT -= dt;
      if (this.pingT <= 0) { this.pingT = clamp(2 + S.depth / 12, 2.5, 6); this.play('ping', S.depth); }
    }
    const anch = !!g.boat?.anchored;
    if (anch !== this.prevAnchor) { this.prevAnchor = anch; if (this.firstFrame) this.play(anch ? 'anchorDown' : 'anchorUp'); }
    this.firstFrame = true;
  }

  updateDrag(dt) {
    const c = this.ctx, now = c.currentTime, L = this.dragLoad;
    if (L > 0.02 && !this.dragVoice && !this.muted) this.dragVoice = this.makeDrag();
    const v = this.dragVoice;
    if (!v) return;
    if (L > 0.02) this.dragIdle = 0; else this.dragIdle += dt;
    const f = 760 + 1900 * Math.pow(L, 0.8) + (Math.random() - 0.5) * 90 * L;      // pitch climbs with the drag load
    v.saw.frequency.setTargetAtTime(f, now, 0.04);
    v.bp.frequency.setTargetAtTime(f * 1.4, now, 0.05);
    v.lfo.frequency.setTargetAtTime(18 + 38 * L, now, 0.05);                           // the clicker chatters faster
    v.out.gain.setTargetAtTime(L > 0.02 ? 0.025 + 0.11 * L : 0, now, L > 0.02 ? 0.04 : 0.06);
    if (this.dragIdle > 0.8) { this.disposeDrag(); }
  }

  makeDrag() {
    const c = this.ctx, v = {};
    v.saw = c.createOscillator(); v.saw.type = 'sawtooth';
    v.bp = c.createBiquadFilter(); v.bp.type = 'bandpass'; v.bp.Q.value = 3;
    v.am = c.createGain(); v.am.gain.value = 0.55;
    v.lfo = c.createOscillator(); v.lfo.type = 'square'; v.lfo.frequency.value = 20;
    v.lg = c.createGain(); v.lg.gain.value = 0.45;
    v.out = c.createGain(); v.out.gain.value = 0;
    v.n = c.createBufferSource(); v.n.buffer = this.white; v.n.loop = true;
    v.hp = c.createBiquadFilter(); v.hp.type = 'highpass'; v.hp.frequency.value = 2400;
    v.ng = c.createGain(); v.ng.gain.value = 0.25;
    v.lfo.connect(v.lg); v.lg.connect(v.am.gain);
    v.saw.connect(v.bp); v.bp.connect(v.am); v.am.connect(v.out);
    v.n.connect(v.hp); v.hp.connect(v.ng); v.ng.connect(v.out);
    v.out.connect(this.sfxBus);
    v.saw.start(); v.lfo.start(); v.n.start();
    this.live += 3;
    return v;
  }

  disposeDrag() {
    const v = this.dragVoice; this.dragVoice = null;
    if (!v) return;
    try { v.saw.stop(); v.lfo.stop(); v.n.stop(); } catch { /* stopped */ }
    this.live -= 3;
    v.n.onended = () => { for (const k in v) try { v[k].disconnect(); } catch { /* gone */ } };
  }

  // gather what the world sounds depend on (cheap; the heavier scans run a few times a second)
  sense(dt, g) {
    const S = this.S, cam = g.camera.position, loc = g.loc, boat = g.boat;
    S.cx = cam.x; S.cz = cam.z;
    const fw = _v.set(0, 0, -1).applyQuaternion(g.camera.quaternion);
    const fl = Math.hypot(fw.x, fw.z) || 1; S.fx = fw.x / fl; S.fz = fw.z / fl;
    S.foot = !!g.foot; S.boatId = boat?.id || 'jon';
    this.boatId = S.boatId; this.hullLen = boat?.hull?.length || 5;
    S.speed = Math.abs(boat?.speed || 0); S.maxSpeed = (boat?.spec?.speed || 8) * (boat?.mods?.speed || 1);
    S.thr = this.thr; S.anchored = !!boat?.anchored; S.engOff = boat ? boat.engineOn === false : false;
    S.paused = g.ui.isOpen(); S.under = g.view === 'under';
    S.hour = g.save.hour; S.night = g.nightLevel();
    S.loc = loc.id;
    const w = g.weather;
    S.rain = this.pendingRain; S.fog = w.F || 0; S.squall = w.L || 0;
    const cur = w.cur, mul = cur.windMul;
    S.wind = loc.wind * (S.squall > 0 ? mul + (Math.max(mul, 12 / loc.wind) - mul) * Math.min(1, S.squall) : mul) * (1 - 0.45 * S.fog);
    // wave height 0..~1.5 from fetch/wind/swell and squalls
    S.waveH = clamp((loc.waveScale ?? 1) * (0.25 + S.wind / 14) + (loc.swell || 0) * 0.6 + S.squall * 0.5, 0, 2);
    S.rough = clamp(S.waveH * 0.6 + S.squall, 0, 1.4);
    S.current = loc.current ? Math.hypot(loc.current[0], loc.current[1]) : 0;
    S.lure = g.fishing?.lure;
    if (S.lure) { S.lureX = S.lure.x; S.lureZ = S.lure.z; } else { S.lureX = undefined; S.lureZ = undefined; }
    const lu = g.save.equip?.lure;
    this.lureSize = lu === 'nightcrawler' || lu === 'minnow' || lu === 'shrimp' ? 0.6 : 1.1;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5;
      const bp = g.foot ? g.footPos : boat.position;
      S.px = bp.x; S.pz = bp.z;
      // shoreline: how much land lies around, and which way
      let land = 0, nearLand = 0, ax = 0, az = 0, n = 0;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        for (const r of [12, 32, 70]) {
          const h = g.heightAt(bp.x + ca * r, bp.z + sa * r);
          if (h > -0.1) { const wt = r === 12 ? 1.6 : r === 32 ? 1 : 0.6; land += wt; if (r <= 32) nearLand += 1; ax += ca * wt * r; az += sa * wt * r; n++; break; }
        }
      }
      S.shore = clamp(land / 10, 0, 1); S.nearShore = nearLand > 0;
      const m = Math.hypot(ax, az) || 1; S.shoreX = ax / m; S.shoreZ = az / m;
      S.depth = Math.max(0.5, -g.heightAt(bp.x, bp.z));
      const dk = g.docks.list.length ? g.docks.nearest(bp.x, bp.z) : null;
      S.dockDist = dk ? dk.dist : 999; S.atDock = !!dk && dk.dist < 7;
      S.dockX = dk?.dock?.x ?? bp.x; S.dockZ = dk?.dock?.z ?? bp.z;
      S.fauna = g.wildlife?.fauna?.list || null;
      this.atDock = S.atDock;
    }
    // footsteps: planks on a dock, soft ground elsewhere
    if (g.foot) {
      this.stepD += (g.foot.speed || 0) * dt;
      if (this.stepD > 0.78) { this.stepD = 0; this.play('step', S.atDock ? 1 : 0); }
    } else this.stepD = 0.5;
  }
}

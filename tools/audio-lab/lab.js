// Headless test page for src/game/audio*.js (driven by run.py): offline renders of key sounds for level checks,
// and a real-time run against a fake game to watch node counts and errors.
import * as THREE from 'three';
import { GameAudio } from '../../src/game/audio.js';
import { SOUNDS } from '../../src/game/audioSynth.js';

const SR = 44100;

function fakeGame(loc = {}) {
  const cam = new THREE.PerspectiveCamera();
  return {
    camera: cam, loc: { id: 'okeechobee', wind: 6, waveScale: 0.6, swell: 0, ...loc },
    boat: { id: 'jon', speed: 0, spec: { speed: 9 }, mods: { speed: 1 }, hull: { length: 3.8 }, position: new THREE.Vector3(0, 0, 0), anchored: null },
    ui: { panel: null, isOpen() { return !!this.panel; } }, view: 'first', save: { hour: 12, equip: { lure: 'minnow' } },
    nightLevel() { const h = this.save.hour; return h > 20 || h < 5 ? 1 : 0; },
    weather: { F: 0, L: 0, cur: { windMul: 1 } }, heightAt: (x) => (x > 60 ? 2 : -8),
    docks: { list: [], nearest: () => null },
    wildlife: { fauna: { list: [{ kind: 'duck', x: 20, z: 10, an: { root: { visible: true } } }, { kind: 'hippo', x: -30, z: 20, an: { root: { visible: true } } }] } },
    settings: { sonar: true }, foot: null, footPos: new THREE.Vector3(), fishing: { lure: null },
  };
}

function wav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, out = new Int16Array(n * ch);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i * ch + c] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))); }
  const b = new Uint8Array(44 + out.length * 2), v = new DataView(b.buffer);
  const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + out.length * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, out.length * 2, true);
  new Uint8Array(b.buffer, 44).set(new Uint8Array(out.buffer));
  let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin);
}

function stats(buf, a, b) {
  let pk = 0, sum = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = Math.floor(a * buf.sampleRate); i < Math.min(d.length, Math.floor(b * buf.sampleRate)); i++) { const x = Math.abs(d[i]); if (x > pk) pk = x; sum += x * x; n++; }
  }
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -200);
  return { peakDb: +db(pk).toFixed(1), rmsDb: +db(Math.sqrt(sum / Math.max(1, n))).toFixed(1) };
}

// items: [name, intensity, seconds] one after another ('bed:xxx' items set world state instead of playing a sound)
window.renderOffline = async (items, world = {}) => {
  const gap = 1, total = items.reduce((a, [, , d]) => a + (d || 3) + gap, 2);
  const ctx = new OfflineAudioContext(2, Math.ceil(total * SR), SR);
  const A = new GameAudio();
  A.vol = { master: 1, sfx: 1, amb: 1, ui: 1 };
  A.start(ctx, world.loc || 'okeechobee');
  const S = A.S;
  Object.assign(S, { cx: 0, cz: 0, fx: 0, fz: -1, wind: 6, waveH: 0.5, rough: 0.3, speed: 0, maxSpeed: 9, thr: 0, night: 0, hour: 12, rain: 0, fog: 0, squall: 0, current: 0, shore: 0.3, nearShore: true, depth: 12, dockDist: 999, px: 0, pz: 0, boatId: 'jon' }, world.S || {});
  A.beds.on = !!world.engineOn; A.beds.idleT = 0;
  A.beds.setRain(S.rain);
  const marks = [];
  let t = 1;
  for (const [name, p, d] of items) {
    const at = t; t += (d || 3) + gap; marks.push({ name, p: typeof p === 'object' ? JSON.stringify(p) : p, at, end: t - gap });
    ctx.suspend(Math.floor(at * SR / 128) * 128 / SR).then(() => {
      if (name.startsWith('bed:')) { Object.assign(S, p); A.beds.rain = S.rain; A.beds.on = true; A.beds.update(1, S); } else A.play(name, p);
      ctx.resume();
    });
  }
  A.beds.update(1, S);
  const buf = await ctx.startRendering();
  return { res: marks.map((m) => ({ ...m, ...stats(buf, m.at, m.end) })), all: stats(buf, 0, total), wav: wav(buf) };
};

// real-time run with a fake game: samples live node counts, collects errors
window.realtime = async (seconds) => {
  const A = new GameAudio();
  const errs = []; addEventListener('error', (e) => errs.push(String(e.message)));
  const g = fakeGame();
  A.start(null, 'okeechobee');
  await A.ctx.resume();
  A.setVolumes({ master: 1, sfx: 1, amb: 1, ui: 1 });
  window.A = A; window.g = g;
  const out = []; let last = performance.now(), t = 0;
  const script = [
    [5, () => { g.boat.speed = 6; A.engine(0.8, 6); }], [15, () => { A.reel(true); }], [18, () => { A.playDrag(0.7); }], [22, () => { A.playDrag(0); A.reel(false); }],
    [24, () => { g.weather.F = 0.8; A.setMuffle(0.8); g.save.hour = 23; }],
    [34, () => { g.weather.F = 0; A.setMuffle(0); g.weather.L = 1; A.setRain(0.6); g.weather.cur.windMul = 1.8; }],
    [44, () => { g.ui.panel = 'tackle'; }],
    [47, () => { g.ui.panel = null; g.weather.L = 0; A.setRain(0); g.boat.anchored = { depth: 5 }; A.engine(0, 0); g.boat.speed = 0; }],
    [52, () => { g.boat.anchored = null; g.foot = { speed: 2 }; g.footPos.set(10, 0, 5); }],
    [58, () => { g.foot = null; A.thunder(900); A.foghorn(); A.play('landed'); A.playCoin(3); A.playNetScoop(); A.play('scream'); A.play('winch', 4); A.playSnap(); }],
  ];
  let si = 0, nextSample = 0;
  await new Promise((resolve) => {
    const id = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      while (si < script.length && t >= script[si][0]) script[si++][1]();
      g.boat.position.x += g.boat.speed * dt;
      g.camera.position.copy(g.boat.position); g.camera.updateMatrixWorld();
      try { A.update(dt, 5, g); } catch (e) { errs.push(e.stack || String(e)); }
      if (t >= nextSample) { nextSample += 5; out.push({ t: +t.toFixed(0), ...A.stats(), voices: Object.values(A.vb).reduce((a, v) => a + v.length, 0) }); }
      if (t >= seconds) { clearInterval(id); resolve(); }
    }, 16);
  });
  return { samples: out, errs, count: Object.keys(SOUNDS).length };
};

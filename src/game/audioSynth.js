// One-shot sounds, all procedural. Every entry is { bus, cd, duck, fn(A, t, p, out) }:
//   A = GameAudio (A.nz / A.os / A.claim helpers), t = start time, p = intensity / size, out = node to write to.
// Kept free of game state so the same code renders offline (tools/audio-render) for level checks.
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// a soft instrument beep: pure tone plus a faint octave, slow-ish attack so it never clicks
const beep = (A, t, out, f, g = 0.045, d = 0.05, delay = 0) => {
  A.os(t + delay, { f, g, a: 0.006, d, out });
  A.os(t + delay, { f: f * 2, g: g * 0.16, a: 0.006, d: d * 0.7, out });
};
// metal ping with inharmonic partials (coins, bells, halyards, chain)
const ring = (A, t, out, f, g, d, parts = [[1, 1, 1], [2.76, 0.55, 0.55], [5.4, 0.3, 0.3]]) => {
  for (const [r, a, dd] of parts) A.os(t, { f: f * r, g: g * a, a: 0.003, d: d * dd, out });
};

export const SOUNDS = {};
const def = (name, bus, fn, extra = {}) => { SOUNDS[name] = { bus, fn, cd: 0, ...extra }; };

// ------------------------------------------------------------ UI: instrument beeps, not game chimes
def('ui', 'ui', (A, t, p, out) => beep(A, t, out, p > 1 ? 2100 : 1850, 0.04, 0.04), { cd: 0.03 });
def('uiOpen', 'ui', (A, t, p, out) => { beep(A, t, out, 1500, 0.04, 0.05); beep(A, t, out, 2000, 0.04, 0.06, 0.075); }, { cd: 0.1 });
def('uiClose', 'ui', (A, t, p, out) => { beep(A, t, out, 2000, 0.035, 0.045); beep(A, t, out, 1500, 0.035, 0.06, 0.07); }, { cd: 0.1 });
def('ping', 'ui', (A, t, depth, out) => {
  // fish finder transducer: a short ping, then the bottom echo; the echo is stylised, later when it is deeper
  A.os(t, { f: 1750, g: 0.035, a: 0.005, d: 0.06, out });
  A.os(t + clamp(depth / 45, 0.1, 0.7), { f: 1700, g: 0.012, a: 0.01, d: 0.12, out });
}, { cd: 1 });

// the fish has taken the lure: two quick alert beeps
def('strike', 'ui', (A, t, p, out) => { beep(A, t, out, 2300, 0.06, 0.07); beep(A, t, out, 2300, 0.06, 0.07, 0.13); }, { cd: 0.2 });
def('miss', 'ui', (A, t, p, out) => { beep(A, t, out, 1300, 0.04, 0.08); beep(A, t, out, 950, 0.04, 0.12, 0.1); });
def('landed', 'sfx', (A, t, p, out) => {
  A.os(t, { f: 120, f2: 62, g: 0.2, a: 0.004, d: 0.14, out });                 // fish hits the deck
  A.nz(t, { f: 600, q: 0.8, g: 0.12, d: 0.1, out });
  A.os(t + 0.04, { f: 1700, g: 0.032, a: 0.006, d: 0.06, out: A.uiBus });         // confirm beep pair
  A.os(t + 0.14, { f: 2250, g: 0.032, a: 0.006, d: 0.08, out: A.uiBus });
}, { duck: [0.2, 0.2, 0.6] });
def('coin', 'ui', (A, t, p, out) => {
  const n = clamp(Math.round(p), 1, 5);
  for (let i = 0; i < n; i++) {
    const tt = t + i * rnd(0.055, 0.085), f = rnd(2300, 2900);
    ring(A, tt, out, f, 0.05, 0.22);
    A.nz(tt, { f: 5000, q: 2, type: 'highpass', g: 0.02, d: 0.015, out });
  }
}, { cd: 0.05 });
def('cash', 'ui', (A, t, p, out) => SOUNDS.coin.fn(A, t, 2, out), { cd: 0.1 });

// ------------------------------------------------------------ fishing
def('cast', 'sfx', (A, t, p, out) => {
  const pw = clamp(p, 0.2, 1);
  A.nz(t, { f: 500, f2: 900 + pw * 2400, q: 1.1, g: 0.1 + pw * 0.16, a: 0.06, d: 0.32, out });         // rod whoosh
  A.nz(t + 0.03, { f: 4800, f2: 6200, q: 7, g: 0.025 + pw * 0.02, a: 0.05, d: 0.3, out });              // line zing off the spool
  A.os(t + 0.05, { f: 2900, f2: 3500, g: 0.012, a: 0.06, d: 0.25, out });
}, { cd: 0.2 });
// kayak paddle: blade enters with a small slap, a pull of running water, a drip train as it lifts out
def('paddle', 'sfx', (A, t, p, out) => {
  const s = clamp(p, 0.3, 1);
  A.nz(t, { f: 1900, f2: 700, q: 0.9, g: 0.05 + 0.05 * s, a: 0.004, d: 0.1, out });
  A.os(t, { f: 150, f2: 70, g: 0.04 + 0.03 * s, a: 0.005, d: 0.12, out });
  A.nz(t + 0.09, { f: 900, f2: 500, q: 0.6, g: 0.05 * s, a: 0.12, d: 0.35, out });
  const n = 2 + Math.round(s * 2);
  for (let i = 0; i < n; i++) { const f = rnd(900, 1900); A.os(t + 0.42 + i * rnd(0.06, 0.14), { f, f2: f * 0.7, g: 0.016, a: 0.002, d: 0.04, out }); }
}, { cd: 0.4 });
def('plop', 'sfx', (A, t, size, out) => SOUNDS.splash.fn(A, t, 0.3 * clamp(A.lureSize || 1, 0.5, 1.8), out), { cd: 0.08 });
def('splash', 'sfx', (A, t, p, out) => {
  const s = clamp(p, 0.15, 3);
  if (!A.claim('splash', 4, t + 0.6)) return;
  A.os(t, { f: 170 / (0.6 + s * 0.5), f2: 55, g: 0.12 + 0.12 * Math.min(1, s), a: 0.004, d: 0.1 + 0.05 * s, out });
  A.nz(t, { f: 1500 / (0.7 + s * 0.4), f2: 400, q: 0.7, g: 0.1 + 0.2 * Math.min(1, s), a: 0.005, d: 0.18 + 0.2 * s, out });
  A.nz(t + 0.02, { f: 3600, type: 'highpass', q: 0.5, g: 0.04 * Math.min(1, s), a: 0.005, d: 0.14, out });
  const n = Math.min(6, 2 + Math.round(s * 2));                                                           // bubbles popping after
  for (let i = 0; i < n; i++) { const f = rnd(450, 1300); A.os(t + 0.08 + i * rnd(0.03, 0.07), { f, f2: f * 1.5, g: 0.018, a: 0.004, d: 0.04, out }); }
}, { duck: null });
def('thrash', 'sfx', (A, t, p, out) => {
  if (!A.claim('splash', 4, t + 0.5)) return;
  A.nz(t, { f: 1800, f2: 700, q: 0.8, g: 0.16, a: 0.008, d: 0.22, out });
  A.nz(t + 0.08, { f: 1300, q: 0.8, g: 0.1, a: 0.008, d: 0.16, out });
}, { cd: 0.15 });
def('hookset', 'sfx', (A, t, p, out) => {
  A.nz(t, { f: 3000, q: 1.5, type: 'highpass', g: 0.14, a: 0.003, d: 0.07, out });
  A.os(t, { f: 150, f2: 80, g: 0.22, a: 0.004, d: 0.2, out });
  A.os(t + 0.01, { f: 520, f2: 330, g: 0.04, a: 0.004, d: 0.25, out });                                  // rod loads up: a taut-line twang
}, { duck: [0.2, 0.15, 0.5] });
def('snap', 'sfx', (A, t, p, out) => {
  A.nz(t, { f: 3800, q: 0.7, type: 'highpass', g: 0.28, a: 0.002, d: 0.05, out });
  A.os(t, { f: 2600, f2: 700, g: 0.07, a: 0.002, d: 0.22, out });
  A.os(t + 0.02, { f: 1800, f2: 900, g: 0.04, a: 0.002, d: 0.3, out, vib: [30, 60] });
  A.nz(t + 0.05, { f: 500, f2: 200, q: 0.8, g: 0.1, a: 0.01, d: 0.25, out });
}, { duck: [0.3, 0.15, 0.7] });
def('tick', 'sfx', (A, t, p, out) => {
  A.os(t, { f: 880, f2: 620, g: 0.08, a: 0.002, d: 0.045, out });
  A.nz(t, { f: 1500, q: 1.5, g: 0.06, a: 0.002, d: 0.03, out });
}, { cd: 0.05 });
def('bump', 'sfx', (A, t, p, out) => {
  const alu = A.boatId === 'jon' || A.boatId === 'bass' || A.boatId === 'skiff' || A.boatId === 'pontoon';
  const s = clamp(p, 0.1, 1);
  A.os(t, { f: rnd(70, 100), f2: 42, g: 0.12 + 0.22 * s, a: 0.004, d: 0.3, out });
  A.nz(t, { f: 450, q: 1.2, g: 0.1 + 0.2 * s, a: 0.003, d: 0.14, out });
  if (alu) ring(A, t, out, rnd(190, 240), 0.05 * s, 0.35, [[1, 1, 1], [2.4, 0.5, 0.6], [4.1, 0.25, 0.3]]);   // aluminium hull rings
  A.os(t + 0.03, { f: rnd(260, 340), f2: 190, g: 0.03 * s, a: 0.02, d: 0.35, out, lp: 900, vib: [13, 25] });   // a creak as it settles
}, { cd: 0.2 });
def('flop', 'sfx', (A, t, p, out) => {
  // fish flapping on the deck: a few slaps, slowing down
  let tt = t, gap = 0.1;
  const n = clamp(Math.round(2 + p * 3), 2, 6);
  for (let i = 0; i < n; i++) {
    const k = 1 - i / (n + 1);
    A.nz(tt, { f: 650, f2: 350, q: 0.9, g: 0.13 * k, a: 0.004, d: 0.06, out });
    A.os(tt, { f: 125, f2: 70, g: 0.1 * k, a: 0.004, d: 0.09, out });
    gap *= rnd(1.2, 1.6); tt += gap;
  }
}, { cd: 0.3 });
def('scoop', 'sfx', (A, t, p, out) => {
  A.nz(t, { f: 500, f2: 1500, q: 0.8, g: 0.14, a: 0.08, d: 0.4, out });                                    // net through the surface
  A.nz(t + 0.25, { f: 2200, q: 0.6, type: 'highpass', g: 0.05, a: 0.02, d: 0.3, out });                    // streaming water
  A.os(t + 0.5, { f: 110, f2: 70, g: 0.1, a: 0.004, d: 0.12, out });                                       // frame on the gunwale
  for (let i = 0; i < 6; i++) A.os(t + 0.5 + i * rnd(0.08, 0.18), { f: rnd(900, 2000), g: 0.012, a: 0.003, d: 0.03, out });   // drips
}, { cd: 0.4 });
def('livewell', 'sfx', (A, t, p, out) => {
  A.nz(t, { f: 260, q: 0.9, g: 0.1, a: 0.004, d: 0.12, out });                                             // lid
  A.os(t, { f: 95, f2: 60, g: 0.12, a: 0.004, d: 0.14, out });
  A.nz(t + 0.12, { f: 700, f2: 1100, q: 1.4, type: 'bandpass', g: 0.05, a: 0.2, d: 0.7, out });            // pump + water
  for (let i = 0; i < 8; i++) { const f = rnd(500, 1500); A.os(t + 0.2 + i * rnd(0.05, 0.12), { f, f2: f * 1.6, g: 0.014, a: 0.004, d: 0.04, out }); }
}, { cd: 1 });
def('winch', 'sfx', (A, t, dur, out) => {
  const d = clamp(dur > 1 ? dur : 4.5, 1, 8);
  A.os(t, { type: 'sawtooth', f: 60, f2: 98, g: 0.07, a: 0.3, hold: d - 0.6, d: 0.4, out, lp: 380 });      // hydraulic motor
  A.os(t, { f: 230, f2: 360, g: 0.015, a: 0.3, hold: d - 0.6, d: 0.4, out });
  for (let i = 0; i < d / 0.11; i++) A.nz(t + 0.2 + i * 0.11, { f: 1800, q: 4, g: 0.035, a: 0.002, d: 0.025, out });   // ratchet
}, { cd: 0.5, duck: [0.15, 0.3, 0.5] });
def('scream', 'sfx', (A, t, p, out) => {
  // trolling rod: line pulled off the clicker, rising then falling
  const d = 2.2;
  A.os(t, { type: 'sawtooth', f: 1100, f2: 2100, g: 0.05, a: 0.05, hold: 1.2, d: 0.9, out, lp: 3200, vib: [26, 120] });
  A.nz(t, { f: 3500, q: 2, g: 0.04, a: 0.05, hold: 1.2, d: 0.9, out });
  for (let i = 0; i < d / 0.035; i++) A.nz(t + i * 0.035, { f: 2800 + (i % 3) * 200, q: 5, g: 0.03, a: 0.002, d: 0.015, out });
}, { cd: 1, duck: [0.2, 0.5, 0.8] });
def('reelClick', 'sfx', (A, t, p, out) => {
  if (!A.claim('click', 8, t + 0.03)) return;
  A.nz(t, { f: rnd(2400, 3000), q: 3, g: 0.04, a: 0.002, d: 0.014, out });
  A.os(t, { f: rnd(1500, 1900), g: 0.012, a: 0.002, d: 0.012, out });
});
def('anchorDown', 'sfx', (A, t, p, out) => {
  // chain running out, faster and faster, then the anchor hits the water
  let tt = t, gap = 0.16;
  for (let i = 0; i < 22; i++) { ring(A, tt, out, rnd(1500, 2400), 0.03, 0.09, [[1, 1, 1], [1.6, 0.6, 0.6]]); A.nz(tt, { f: 3000, q: 1, type: 'highpass', g: 0.02, a: 0.002, d: 0.03, out }); gap = Math.max(0.035, gap * 0.9); tt += gap; }
  SOUNDS.splash.fn(A, tt, 1.1, out);
  A.nz(tt + 0.2, { f: 400, q: 0.7, g: 0.06, a: 0.1, d: 0.6, out });
}, { cd: 1 });
def('anchorUp', 'sfx', (A, t, p, out) => {
  A.os(t, { type: 'sawtooth', f: 70, f2: 90, g: 0.05, a: 0.2, hold: 1.8, d: 0.3, out, lp: 330 });
  for (let i = 0; i < 14; i++) ring(A, t + 0.2 + i * 0.15, out, rnd(1400, 2100), 0.025, 0.08, [[1, 1, 1], [1.6, 0.6, 0.6]]);
  A.os(t + 2.3, { f: 100, f2: 55, g: 0.2, a: 0.004, d: 0.18, out });                                       // anchor seats
  A.nz(t + 2.3, { f: 600, q: 1, g: 0.12, a: 0.003, d: 0.12, out });
}, { cd: 1 });
def('engineStart', 'sfx', (A, t, p, out) => {
  A.os(t, { type: 'sawtooth', f: 55, f2: 150, g: 0.05, a: 0.05, hold: 0.45, d: 0.25, out, lp: 520, vib: [18, 12] });   // starter
  for (let i = 0; i < 5; i++) A.nz(t + 0.6 + i * rnd(0.05, 0.09), { f: 160, q: 1, type: 'lowpass', g: 0.1, a: 0.004, d: 0.07, out });   // it catches
}, { cd: 3 });
def('step', 'sfx', (A, t, kind, out) => {
  if (kind === 1) {                                                // dock planks
    A.os(t, { f: 150, f2: 85, g: 0.1, a: 0.003, d: 0.09, out });
    A.nz(t, { f: 520, q: 1, g: 0.08, a: 0.003, d: 0.07, out });
    if (Math.random() < 0.15) A.os(t + 0.02, { f: rnd(300, 420), f2: 240, g: 0.015, a: 0.01, d: 0.2, out, lp: 800, vib: [14, 20] });
  } else {                                                          // ground
    A.nz(t, { f: 900, q: 0.6, type: 'lowpass', g: 0.09, a: 0.004, d: 0.09, out });
    A.nz(t + 0.015, { f: 2200, q: 0.8, type: 'highpass', g: 0.02, a: 0.003, d: 0.05, out });
  }
}, { cd: 0.2 });

// ------------------------------------------------------------ boat and water
def('hullSlap', 'sfx', (A, t, p, out) => {
  if (!A.claim('slap', 4, t + 0.3)) return;
  const s = clamp(p, 0.05, 1), size = clamp((A.hullLen || 5) / 26, 0, 1);
  A.os(t, { f: 125 - 60 * size, f2: 50, g: 0.05 + 0.15 * s, a: 0.004, d: 0.16, out });
  A.nz(t, { f: 900 - 500 * size, q: 0.7, type: 'lowpass', g: 0.05 + 0.18 * s, a: 0.004, d: 0.12, out });
  A.nz(t + 0.03, { f: 600, q: 0.9, g: 0.04 * s, a: 0.03, d: 0.3, out });
}, { cd: 0.05 });
def('lap', 'amb', (A, t, p, out) => {
  if (!A.claim('lap', 4, t + 1.5)) return;
  const s = clamp(p, 0.05, 1.5), dock = A.S.atDock;
  A.nz(t, { f: dock ? 380 : 520, q: 0.8, type: 'lowpass', g: 0.04 + 0.07 * s, a: 0.2, d: rnd(0.5, 0.9), out });
  const n = 1 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) { const f = rnd(500, 1200); A.os(t + 0.15 + i * rnd(0.05, 0.14), { f, f2: f * 1.6, g: 0.01 * s, a: 0.004, d: 0.04, out }); }
  if (dock) A.os(t + 0.1, { f: 210, f2: 260, g: 0.02 * s, a: 0.01, d: 0.16, out, lp: 600 });               // hollow glup under the planks
}, { cd: 0.2 });
def('surf', 'amb', (A, t, p, out) => {
  if (!A.claim('surf', 3, t + 7)) return;
  const s = clamp(p, 0.1, 1.5);
  A.nz(t, { f: 650, q: 0.5, type: 'lowpass', g: 0.14 * s, a: 2.2, d: 3.8, out });
  A.nz(t + 0.4, { f: 2600, q: 0.6, type: 'highpass', g: 0.04 * s, a: 2.2, d: 3.4, out });
  A.nz(t + 3.2, { f: 1100, q: 0.5, type: 'bandpass', g: 0.05 * s, a: 0.6, d: 3, out });                    // the backwash
}, { cd: 3 });
def('creak', 'sfx', (A, t, p, out) => {
  if (!A.claim('creak', 2, t + 1)) return;
  const big = clamp((A.hullLen || 5) / 26, 0, 1), f = rnd(180, 360) - big * 90, s = clamp(p, 0.2, 1);
  A.os(t, { type: 'sawtooth', f, f2: f * rnd(0.75, 1.35), g: 0.03 + 0.03 * s, a: 0.08, d: rnd(0.35, 0.8), out, lp: 700, vib: [rnd(10, 20), 30] });
  A.nz(t, { f: f * 1.5, q: 6, g: 0.03 * s, a: 0.08, d: 0.4, out });
}, { cd: 0.6 });
def('bilge', 'sfx', (A, t, p, out) => {
  if (!A.claim('bilge', 1, t + 3)) return;
  A.os(t, { type: 'square', f: 94, g: 0.03, a: 0.12, hold: 1.4, d: 0.25, out, lp: 380 });
  A.os(t, { f: 188, g: 0.012, a: 0.12, hold: 1.4, d: 0.25, out });
  A.nz(t + 0.2, { f: 700, q: 3, g: 0.03, a: 0.3, hold: 1, d: 0.5, out });
  A.nz(t + 1.9, { f: 1500, q: 1, g: 0.05, a: 0.02, d: 0.35, out });                                          // spits it overboard
}, { cd: 20 });
def('halyard', 'amb', (A, t, p, out) => {
  if (!A.claim('ting', 3, t + 0.5)) return;
  const f = rnd(1300, 2300);
  ring(A, t, out, f, 0.07, 0.3, [[1, 1, 1], [2.3, 0.5, 0.5], [3.9, 0.25, 0.3]]);
  if (Math.random() < 0.5) ring(A, t + rnd(0.15, 0.4), out, f * rnd(0.9, 1.1), 0.05, 0.25, [[1, 1, 1], [2.3, 0.5, 0.5]]);
}, { cd: 0.2 });

// ------------------------------------------------------------ weather
def('thunder', 'amb', (A, t, dist, out) => {
  // loudness and brightness both fall with distance; near = hard crack then a long roll
  const d = dist > 1 ? dist : 1800, near = clamp(1 - d / 3500, 0, 1), far = 1 - near;
  const air = 2600 / (1 + d / 600), lvl = 0.5 + 0.7 * near;
  if (near > 0.25) A.nz(t, { f: 2200, q: 0.8, type: 'highpass', g: 0.5 * near, a: 0.003, d: 0.22, out });
  A.nz(t, { f: air * 0.9, q: 0.7, type: 'lowpass', g: 0.34 * lvl, a: 0.05, d: 2.4 + far * 4, out });
  A.nz(t + rnd(0.25, 0.75), { f: air * 0.5, q: 0.6, type: 'lowpass', g: 0.32 * lvl, a: 0.15, d: 1.6 + far * 2.5, out });
  A.nz(t + rnd(1.2, 2.2), { f: air * 0.35, q: 0.8, type: 'lowpass', g: 0.2 * lvl, a: 0.3, d: 1.5 + far, out });
  A.os(t, { f: 48, f2: 32, g: 0.16 * lvl, a: 0.1, d: 2 + far * 2, out });
}, { duck: [0.45, 0.5, 1.6], cd: 0.3 });
def('foghorn', 'amb', (A, t, gain, out) => {
  const g = clamp(gain || 0.5, 0.1, 1) * 0.12;
  for (const [f, k] of [[92, 1], [138, 0.6], [185, 0.25], [230, 0.1]]) {
    A.os(t, { type: 'sawtooth', f: f * 1.06, f2: f, g: g * k, a: 0.35, hold: 1.55, d: 0.7, out, lp: 520 });
  }
}, { cd: 3 });
def('bell', 'amb', (A, t, p, out) => {
  // bell buoy: struck by the swell, one to three irregular clangs
  const base = rnd(470, 560), n = 1 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const tt = t + i * rnd(0.45, 0.9), k = 1 - i * 0.15;
    ring(A, tt, out, base, 0.1 * k, 2.4, [[1, 1, 1], [2.01, 0.6, 0.75], [2.76, 0.4, 0.55], [4.07, 0.25, 0.4], [5.43, 0.12, 0.3]]);
    A.nz(tt, { f: 1500, q: 1, g: 0.05 * k, a: 0.002, d: 0.04, out });
  }
}, { cd: 2 });
def('blow', 'amb', (A, t, p, out) => {
  A.nz(t, { f: 1700, f2: 900, q: 0.8, g: 0.16, a: 0.06, d: 0.9, out });
  A.nz(t + 0.05, { f: 400, q: 0.6, type: 'lowpass', g: 0.1, a: 0.08, d: 0.8, out });
}, { cd: 4 });

// ------------------------------------------------------------ calls (placed in the world by audioLife.js)
def('gull', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 1)) return;
  const f = rnd(1500, 1900), n = pick([2, 3, 3, 4]);
  for (let i = 0; i < n; i++) {
    const tt = t + i * rnd(0.2, 0.32), k = i === 0 ? 1 : 0.8;
    A.os(tt, { type: 'sawtooth', f: f * (i ? 1.3 : 1.15), f2: f * (i === n - 1 ? 0.8 : 1.45), g: 0.07 * k, a: 0.03, d: rnd(0.14, 0.26), out, lp: 3200, vib: [28, 70] });
  }
}, { cd: 0.5 });
def('songbird', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 1)) return;
  const base = rnd(2400, 3800), n = pick([3, 4, 5, 6]);
  for (let i = 0; i < n; i++) { const f = base * rnd(0.8, 1.3); A.os(t + i * rnd(0.07, 0.13), { f, f2: f * rnd(0.8, 1.35), g: 0.035, a: 0.008, d: rnd(0.04, 0.08), out }); }
}, { cd: 0.5 });
def('owl', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 1.6)) return;
  const f = rnd(330, 400);
  A.os(t, { f: f * 1.08, f2: f, g: 0.1, a: 0.07, d: 0.4, out });
  A.os(t + 0.7, { f: f * 1.06, f2: f * 0.98, g: 0.09, a: 0.05, d: 0.18, out });
  A.os(t + 0.98, { f: f * 1.06, f2: f * 0.96, g: 0.09, a: 0.05, d: 0.32, out });
}, { cd: 2 });
def('loon', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 2)) return;
  A.os(t, { f: 520, f2: 880, g: 0.07, a: 0.2, hold: 0.4, d: 0.5, out });
  A.os(t, { f: 1040, f2: 1760, g: 0.02, a: 0.2, hold: 0.4, d: 0.5, out });
  A.os(t + 1.3, { f: 620, f2: 600, g: 0.05, a: 0.1, hold: 0.5, d: 0.5, out, vib: [11, 40] });                  // the tremolo
}, { cd: 4 });
def('frogBull', 'amb', (A, t, p, out) => {
  if (!A.claim('frog', 5, t + 0.8)) return;
  const f = rnd(110, 150);
  for (let i = 0; i < 3; i++) A.os(t + i * 0.17, { type: 'sawtooth', f: f * (i === 1 ? 1.25 : 1), f2: f * 0.7, g: 0.09, a: 0.012, d: 0.13, out, lp: 650, vib: [40, 10] });
}, { cd: 0.4 });
def('frogTree', 'amb', (A, t, p, out) => {
  if (!A.claim('frog', 5, t + 0.6)) return;
  const f = rnd(2300, 3000), n = pick([4, 5, 7]);
  for (let i = 0; i < n; i++) A.os(t + i * 0.075, { f, f2: f * 1.2, g: 0.018, a: 0.006, d: 0.03, out });
}, { cd: 0.3 });
def('howler', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 5)) return;
  A.os(t, { type: 'sawtooth', f: 62, f2: 88, g: 0.07, a: 1.2, hold: 1.6, d: 1.6, out, lp: 420, vib: [17, 6] });
  A.nz(t, { f: 320, q: 1.2, g: 0.05, a: 1.2, hold: 1.6, d: 1.6, out });
}, { cd: 8 });
def('seal', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 1)) return;
  for (let i = 0; i < pick([2, 3, 4]); i++) {
    A.os(t + i * 0.32, { type: 'sawtooth', f: rnd(260, 320), f2: 170, g: 0.1, a: 0.02, d: 0.22, out, lp: 900, vib: [30, 25] });
    A.nz(t + i * 0.32, { f: 600, q: 1, g: 0.04, a: 0.02, d: 0.2, out });
  }
}, { cd: 1 });
def('hippo', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 3)) return;
  for (let i = 0; i < 4; i++) A.os(t + i * 0.5, { type: 'sawtooth', f: 95 - i * 4, f2: 58, g: 0.13, a: 0.03, d: 0.38, out, lp: 340, vib: [26, 12] });
  A.nz(t, { f: 250, q: 0.8, type: 'lowpass', g: 0.05, a: 0.05, hold: 1.5, d: 0.5, out });
}, { cd: 4 });
def('wolf', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 4)) return;
  const f = rnd(380, 470);
  A.os(t, { f, f2: f * 1.5, g: 0.06, a: 0.7, hold: 0.3, d: 0, out, vib: [5, 8] });
  A.os(t + 1.0, { f: f * 1.5, f2: f * 1.15, g: 0.06, a: 0.01, hold: 1.2, d: 1.2, out, vib: [5.5, 10] });
  A.os(t, { f: f * 3, f2: f * 4.5, g: 0.012, a: 0.7, hold: 1.5, d: 1.2, out });
}, { cd: 10 });
def('duck', 'amb', (A, t, p, out) => {
  if (!A.claim('bird', 4, t + 1)) return;
  for (let i = 0; i < pick([2, 3, 4]); i++) A.os(t + i * 0.17, { type: 'square', f: 520 - i * 25, f2: 360, g: 0.045, a: 0.01, d: 0.1, out, lp: 1400, vib: [60, 30] });
}, { cd: 1 });
def('distantEngine', 'amb', (A, t, p, out) => {
  if (!A.claim('far', 1, t + 14)) return;
  A.os(t, { type: 'sawtooth', f: rnd(48, 70), g: 0.05, a: 4, hold: 3, d: 6, out, lp: 220 });
  A.nz(t, { f: 160, q: 0.8, type: 'lowpass', g: 0.06, a: 4, hold: 3, d: 6, out });
}, { cd: 12 });
def('truck', 'amb', (A, t, p, out) => {
  if (!A.claim('far', 1, t + 9)) return;
  A.nz(t, { f: 140, f2: 190, q: 0.7, type: 'lowpass', g: 0.08, a: 3.5, hold: 0.5, d: 5, out });
  A.os(t, { type: 'sawtooth', f: 38, f2: 52, g: 0.025, a: 3.5, hold: 0.5, d: 5, out, lp: 160 });
}, { cd: 15 });
def('clank', 'amb', (A, t, p, out) => {
  // somewhere across the water: a hammer on steel, a lid dropped
  if (!A.claim('ting', 3, t + 0.5)) return;
  ring(A, t, out, rnd(420, 900), 0.08, 0.28, [[1, 1, 1], [2.6, 0.5, 0.5]]);
  A.nz(t, { f: 2000, q: 1, g: 0.04, a: 0.002, d: 0.03, out });
}, { cd: 1 });

// Pure fight core: the fish-behaviour chooser, the force balance (pull vs drag vs line), stamina,
// line overload and the lose / land decisions, plus the bite-rate formula. No three.js, no audio,
// no UI, no camera: scene-coupled inputs arrive as plain numbers and randomness as an injected
// rng() (default Math.random) so the same code can be replayed from a seed and ported to Unreal
// (unreal/golden). fishing.js owns the scene side and calls these in the original order.
import { FEEL } from './fightFeel.js';

// mulberry32: the shared PRNG (C++ port in unreal ReelSim uses the identical integer steps).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function chooseBehavior(f, rng = Math.random) {
  const sp = f.sp, P = f.pers, T = f.stamina;
  const opts = [['run', 0.38], ['circle', 0.24], ['dive', sp.depth === 'b' ? 0.25 : 0.1], ['rest', 0.1 + (1 - T) * 0.3], ['charge', 0.08],
    ['surge', P.surge * (0.4 + T)], ['headshake', P.headshake], ['sound', P.sound * (0.5 + T)]];
  if (sp.jump > 0 && f.jumps < P.jumpMax) opts.push(['jump', sp.jump * 0.28 * (0.4 + T) * (P.jump ? 1.6 : 1)]);
  if (P.thrash && T < 0.75) opts.push(['thrash', P.thrash * (1.2 - T)]);
  let sum = opts.reduce((a, o) => a + o[1], 0), r = rng() * sum;
  for (const [name, w] of opts) { r -= w; if (r <= 0) { f.behavior = name; break; } }
  const rnd = ([lo, hi]) => lo + rng() * (hi - lo);
  f.bT = 1.5 + rng() * 3.5;
  f.dir = rng() < 0.5 ? -1 : 1;
  f.power = { run: 1, circle: 0.65, dive: 0.85, rest: 0.25, charge: 0.35, jump: 0.7, surge: FEEL.surge.power, headshake: FEEL.headshake.power, sound: FEEL.sound.power, thrash: FEEL.thrash.power }[f.behavior];
  if (f.behavior === 'jump') { f.jumpT = 0; f.jumps++; f.bT = 1.4; }
  else if (f.behavior === 'surge') f.bT = rnd(FEEL.surge.t);
  else if (f.behavior === 'headshake') f.bT = rnd(FEEL.headshake.t);
  else if (f.behavior === 'sound') f.bT = rnd(FEEL.sound.t);
  else if (f.behavior === 'thrash') f.bT = rnd(FEEL.thrash.t);
}

// One step of the force balance. S is the fight state (the Fishing instance in the game; any object in
// tests) holding lineOut, overload, slackT and drag-side outputs slip, runWarn, reelStall, load, warn, tension.
//   f = fish, gear = { rod, reel, line }, p = { D (drag setting), steerMul, chair }, input = { down }.
// Returns the loss kind ('snap' | 'snapFrayed' | 'wound' | 'rod' | 'spooled' | 'pull') or null.
// wearLine is the current line wear 0..1 (only picks 'snapFrayed' vs 'snap').
export function fightForces(S, f, gear, p, dt, input, rng = Math.random, wearLine = 0) {
  const { rod, reel, line } = gear, sp = f.sp, D = p.D;
  f.time += dt;
  f.bT -= dt;
  if (f.bT <= 0) chooseBehavior(f, rng);
  const hs = f.behavior === 'headshake' || f.behavior === 'thrash';
  f.shake = hs ? Math.abs(Math.sin(f.time * 16)) * FEEL.headshake.shake * (0.5 + 0.5 * Math.min(1, f.lb / 20))
    : Math.max(0, Math.sin(f.time * 9) * Math.sin(f.time * 2.3)) * (sp.fight > 0.7 ? 0.22 : 0.12);
  const P = Math.max(0.3, 2.5 * Math.pow(f.lb, 0.75) * sp.fight * (0.22 + 0.78 * f.stamina) * f.power * (1 + f.shake));
  const speed = (1 + Math.pow(f.lb, 0.33) * 0.9) * (0.5 + sp.fight) * f.power * (0.3 + 0.7 * f.stamina);
  f.speedNow = speed;
  const radial = { run: 0.9, circle: 0.15, dive: 0.3, rest: 0, charge: -0.9, jump: 0.3, surge: FEEL.surge.radial, headshake: 0, sound: 0.25, thrash: 0 }[f.behavior];
  const tang = { run: 0.4, circle: 1, dive: 0.2, rest: 0.1, charge: 0.2, jump: 0.3, surge: 0.3, headshake: 0.05, sound: 0.1, thrash: 0.5 }[f.behavior] * f.dir;
  f.tangNow = tang;
  const reeling = input.down;
  const retrieve = reel.ratio * 0.36;
  let T, reelStall = false;
  S.slip = 0;
  f.r = Math.min(f.r, S.lineOut);
  S.runWarn = false;
  if (radial > 0) {
    const want = speed * radial;
    if (P > D) {
      const out = want * (1 - D / P) + 0.15 * want;
      S.lineOut += out * dt;
      T = D;
      // cranking while the drag slips gains nothing and twists the line toward breaking
      if (reeling) { T = D * 1.3; S.overload += dt * 0.25; S.runWarn = true; }
      S.slip = Math.min(1.5, out);
      reelStall = reeling;
    } else {
      T = P;
      if (reeling) { S.lineOut -= retrieve * (1 - P / D) * dt; T = Math.min(D, P + 0.3 * D); }
    }
    f.r = S.lineOut;
  } else {
    f.r = Math.max(1, f.r + speed * radial * dt);
    if (reeling) S.lineOut = Math.max(f.r, S.lineOut - retrieve * dt * (radial < 0 ? 1.6 : 1));
    const slack = S.lineOut - f.r;
    if (slack > 0.5) T = Math.max(0, P * 0.15 - slack * 0.2);
    else { T = reeling ? Math.min(D, P + 0.3 * D) : P * 0.8; S.lineOut = Math.min(S.lineOut, f.r + 0.2); if (reeling && P < D) { S.lineOut -= retrieve * (1 - P / D) * dt; f.r = S.lineOut; } }
  }
  // a rough drag lets go in jerks: the cheaper the reel, the harder it hits the line
  if (radial > 0 && P > D) T *= 1 + (1 - reel.smooth) * 0.35 * Math.max(0, Math.sin(f.time * 17));
  S.reelStall = reelStall;
  S.load = Math.min(1.3, T / line.test);
  // tension warning: loaded close to the line's limit, or the overload clock is running
  S.warn = S.load > FEEL.warnLoad || S.overload > FEEL.warnOverload;
  // stamina
  const strength = 2.5 * Math.pow(f.lb, 0.75) * sp.fight + 1;
  // bigger fish tire proportionally slower: a bass takes ~30 s, a 400 lb marlin a few minutes
  f.stamina -= dt * (T / strength) * 0.055 * Math.sqrt(rod.lift) * p.steerMul * p.chair / (1 + f.lb / 150);
  if (radial > 0 && P > D) f.stamina -= dt * 0.012;
  if (T < P * 0.3) f.stamina += dt * 0.015;
  f.stamina = clamp(f.stamina, 0, 1);
  // line strength: stretchy mono soaks up head shakes, braid doesn't
  const spike = T * (1 + f.shake * (1 - line.stretch * 3));
  if (spike > line.test) S.overload += dt * ((spike / line.test - 1) * 6 + 0.4);
  else if (!S.runWarn) S.overload = Math.max(0, S.overload - dt * 0.15);
  S.tension = T;
  f.P = P;
  if (S.overload >= 1) return S.runWarn ? 'wound' : wearLine > 0.5 ? 'snapFrayed' : 'snap';
  if (T > rod.power * 3) return 'rod';
  if (S.lineOut > reel.cap) return 'spooled';
  // slack line lets a fish throw the hook
  if (T < P * 0.12 && !f.thrown) S.slackT += dt; else S.slackT = Math.max(0, S.slackT - dt * 2);
  if (S.slackT > 2.4) return 'pull';
  return null;
}

// a jumping fish may throw the hook while it is in the air under load
export function jumpThrows(f, T, test, rng = Math.random) {
  return !f.thrown && f.jumpT > 0.3 && T > test * 0.65 && rng() < 0.45;
}

// fish inside landing range: 'land' when tired enough, otherwise it bolts (state reset to a run). null if out of range.
export function nearBoat(f, land, rng = Math.random) {
  if (f.r >= land) return null;
  if (f.stamina < FEEL.land.stamina) return 'land';
  if (f.behavior !== 'run') { f.behavior = 'run'; f.bT = 2.5; f.power = 1; f.dir = rng() < 0.5 ? 1 : -1; f.theta += Math.PI * 0.2; return 'bolt'; }
  return null;
}

// per-second bite rate (before the dt roll): lure activity x hotspot x time of day x weather x species match
export function biteRate({ lureActive, moving, fly, rodFly, hot, hour, weather = 1, matchRate }) {
  let activity = lureActive ? (moving ? 1 : 0.3) : (moving ? 0.5 : 1);
  if (fly && rodFly) activity *= 1.35;
  // dawn and dusk are best overall; per-species time/weather/depth/lure taste is in the match model
  const isNight = hour < 5.2 || hour > 20.6;
  const tod = isNight ? 0.95 : hour < 8.5 || hour > 17.5 ? 1.4 : hour > 11 && hour < 15 ? 0.85 : 1;
  return 0.07 * activity * (1 + hot * 3.5) * tod * weather * matchRate;
}

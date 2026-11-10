import { SPECIES_BY_ID } from './species.js';
import { LURES } from './gear.js';
import {
  TUNING, LURE_KIND, KINDS, KIND_LABEL, BODY_KIND, BODY_TIME, TIME_DEFAULT, NIGHT_FEEDERS, NIGHT_PROFILE,
  WX_ORDER, WX_DEFAULT, BODY_WX, COL_CLASSES, BODY_COL, OVERRIDES,
} from './baitData.js';

// Bait & lure matching model. Pure functions (no three.js) so it can run headless.
// Every species gets a profile derived from its family/diet/size/depth class, with hand overrides
// (baitData.js OVERRIDES). A "fit" is the product of lure x depth x time x weather x colour factors;
// each factor is floored (TUNING.floor) so a bad match is slower, never impossible.

const NIGHT_SET = new Set(NIGHT_FEEDERS);
const T = TUNING;

function hash01(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const profiles = new Map();
export function profileOf(sp) {
  let p = profiles.get(sp.id);
  if (p) return p;
  const ov = OVERRIDES[sp.id] || {};
  const typ = sp.lb[1];
  // time of day [dawn, day, dusk, night]
  let time = ov.time || (NIGHT_SET.has(sp.id) ? NIGHT_PROFILE : BODY_TIME[sp.body] || TIME_DEFAULT);
  // weather [clear..storm]
  const wx = ov.wx || BODY_WX[sp.body] || WX_DEFAULT;
  // depth: bottom fish hug the bottom; others get a per-species centre (size, hash, hand range)
  let depth;
  if (sp.depth === 'b') depth = { bottom: true, gap: T.depth.bottomGap * (0.8 + hash01(sp.id + 'g') * 0.5), band: ov.band || [0, T.depth.bandHi] };
  else if (ov.dep) depth = { c: (ov.dep[0] + ov.dep[1]) / 2, s: Math.max(0.8, (ov.dep[1] - ov.dep[0]) / 2) };
  else if (sp.depth === 's') depth = { c: T.depth.surfaceC + hash01(sp.id + 's') * 0.5, s: T.depth.surfaceSigma };
  else depth = { c: clamp(T.depth.midC + Math.log10(Math.max(1, typ)) * T.depth.sizeShift + (hash01(sp.id + 'm') - 0.5) * 2 * T.depth.jitter, T.depth.midMin, T.depth.midMax), s: T.depth.midSigma };
  // lure kinds: family table x hand override, plus size sanity
  const fam = BODY_KIND[sp.body] || {};
  const kind = {};
  for (const k of KINDS) kind[k] = (ov.kind && ov.kind[k] != null ? ov.kind[k] : fam[k] ?? 1);
  const col = BODY_COL[sp.body] || [1, 1, 1];
  p = { time, wx, depth, kind, lureOv: ov.lure || null, col };
  profiles.set(sp.id, p);
  return p;
}

// ---- factors ----------------------------------------------------------------------------------
export function lureClass(lure) {
  const c = lure.color ?? 0x808080, r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  if (s > 0.55 && l > 0.4) return 'bright';
  if (l < 0.33) return 'dark';
  return 'natural';
}

export function lureFit(sp, lureId, lure = LURES[lureId]) {
  const p = profileOf(sp);
  const diet = [...(lure.diet || '')].some((ch) => sp.diet.includes(ch)) ? T.dietHit : T.dietMiss;
  const kind = LURE_KIND[lureId] || 'other';
  let m = kind === 'other' ? 1 : p.kind[kind];
  if (p.lureOv && p.lureOv[lureId] != null) m = p.lureOv[lureId];
  // big predators want big offerings, small fish ignore giant skirts and swimbaits
  const typ = sp.lb[1], size = lure.size || 1;
  let sz = 1;
  if (typ >= 40) sz = 0.9 + (size - 1) * 2;
  else if (typ < 2 && size > 1.1) sz = 0.6;
  if (typ < 5 && kind === 'skirt') sz *= 0.5;
  return clamp(diet * m * sz, T.floor.lure, T.lureCap);
}

// interpolate the 4-anchor day profile around the clock
export function timeFit(sp, hour) {
  const w = profileOf(sp).time, H = T.hours;
  const a = [[H.night, w[3]], [H.dawn, w[0]], [H.day, w[1]], [H.dusk, w[2]], [H.night + 24, w[3]]];
  const h = hour < H.night ? hour + 24 : hour;
  let v = w[3];
  for (let i = 0; i < a.length - 1; i++) if (h >= a[i][0] && h <= a[i + 1][0]) { const u = (h - a[i][0]) / (a[i + 1][0] - a[i][0]); v = a[i][1] + (a[i + 1][1] - a[i][1]) * u; break; }
  return clamp(v, T.floor.time, 1);
}

export function weatherFit(sp, wxId) {
  const i = WX_ORDER.indexOf(wxId);
  return clamp(profileOf(sp).wx[i < 0 ? 1 : i], T.floor.wx, 1);
}

function isNightHour(h) { return h < 5.2 || h > 20.6; }

// preferred depth centre/sigma for the current hour (non-bottom fish come up at night, sink at noon)
export function prefDepth(sp, hour) {
  const d = profileOf(sp).depth;
  if (d.bottom) return d;
  const mul = isNightHour(hour) ? T.depth.nightShallow : hour > 10 && hour < 15 ? T.depth.sunDeep : 1;
  return { c: d.c * mul, s: d.s };
}

// how well the bottom depth (m) suits a bottom species' habitat band: 1 inside, falling off outside
export function bandFit(sp, bottom) {
  const d = profileOf(sp).depth;
  if (!d.bottom) return 1;
  const [lo, hi] = d.band;
  const z = bottom < lo ? (lo - bottom) / (0.4 * lo + 1) : bottom > hi ? (bottom - hi) / (0.35 * hi + 1) : 0;
  return Math.exp(-0.5 * z * z);
}

export function depthFit(sp, depth, bottom, hour) {
  const d = prefDepth(sp, hour);
  const z = d.bottom ? (bottom - depth) / d.gap : (depth - d.c) / d.s;
  return clamp(Math.exp(-0.5 * z * z) * (d.bottom ? Math.max(0.12, bandFit(sp, bottom)) : 1), T.floor.depth * (d.bottom ? 0.5 : 1), 1);
}

export function colorFit(sp, lure, hour, wxId) {
  const cls = lureClass(lure), i = COL_CLASSES.indexOf(cls);
  let v = profileOf(sp).col[i];
  if (isNightHour(hour)) v *= cls === 'dark' ? 1.1 : cls === 'bright' ? 0.9 : 1;
  else if (wxId === 'overcast' || wxId === 'rain') v *= cls === 'bright' ? 1.08 : 1;
  else if (wxId === 'clear') v *= cls === 'natural' ? 1.06 : 1;
  return clamp(v, T.floor.col, T.colMax);
}

// cond: { lureId, lure, depth, bottom, hour, wx }
export function fit(sp, cond) {
  const lure = lureFit(sp, cond.lureId, cond.lure);
  const depth = depthFit(sp, cond.depth, cond.bottom, cond.hour);
  const time = timeFit(sp, cond.hour);
  const wx = weatherFit(sp, cond.wx);
  const col = colorFit(sp, cond.lure, cond.hour, cond.wx);
  return { lure, depth, time, wx, col, total: (lure / T.lureCap) * depth * time * wx * col, weight: Math.pow(lure * depth * time * wx * col, T.pickSharpness) };
}

// the pool of a location under the given conditions: per-species weights, average fit, bite-rate multiplier
export function poolFit(pool, cond) {
  const entries = [];
  let sum = 0, fitSum = 0, wSum = 0;
  for (const [id, w] of Object.entries(pool)) {
    const sp = SPECIES_BY_ID[id];
    if (!sp) continue;
    const f = fit(sp, cond);
    const wt = w * f.weight;
    entries.push([sp, wt, f]);
    sum += wt; fitSum += w * f.total; wSum += w;
  }
  const avg = wSum ? fitSum / wSum : 0;
  const rate = clamp(T.rate.base + T.rate.gain * Math.sqrt(avg), T.rate.min, T.rate.max);
  return { entries, sum, avg, rate, ticks: T.quality.reduce((n, q) => n + (rate >= q ? 1 : 0), 0) };
}

export function pickFrom(info, rand = Math.random) {
  let r = rand() * info.sum;
  for (const [sp, wt] of info.entries) { r -= wt; if (r <= 0) return sp; }
  return info.entries.length ? info.entries[info.entries.length - 1][0] : null;
}

// ---- journal hints / sonar ---------------------------------------------------------------------
// what a species likes, independent of the current spot: top lure kinds + the lures you own/shop sells
export function hintFor(sp) {
  const p = profileOf(sp);
  const typ = sp.lb[1];
  const kinds = KINDS.map((k) => {
    let m = p.kind[k];
    // size sanity as in lureFit, using a representative lure of the kind
    const rep = Object.entries(LURES).find(([id]) => LURE_KIND[id] === k);
    const dietOk = rep ? [...(rep[1].diet || '')].some((ch) => sp.diet.includes(ch)) : true;
    if (!dietOk) m *= T.dietMiss;
    if (typ < 5 && k === 'skirt') m *= 0.5;
    return [k, m];
  }).sort((a, b) => b[1] - a[1]).filter(([, m]) => m >= 0.9).slice(0, 3).map(([k]) => k);
  const d = profileOf(sp).depth;
  const depth = d.bottom ? { bottom: true, band: d.band } : { lo: Math.max(0, d.c - d.s), hi: d.c + d.s, c: d.c };
  const sh = (v) => Math.round(v * 100) / 100;
  return { kinds, labels: kinds.map((k) => KIND_LABEL[k]), depth, time: p.time.map(sh), wx: p.wx.map(sh), color: COL_CLASSES[p.col.indexOf(Math.max(...p.col))] };
}

// depth an ambient fish of this species holds at (for the fish finder), with a little spread
export function holdDepth(sp, bottom, hour, rand = Math.random) {
  const d = prefDepth(sp, hour);
  const gauss = (rand() + rand() + rand() - 1.5) * 0.8;   // roughly N(0, ~0.4)
  const v = d.bottom ? bottom - 0.3 - Math.abs(gauss) * d.gap * 0.6 : d.c + gauss * d.s * (T.sonarSpread * 2.5);
  return clamp(v, 0.4, Math.max(0.5, bottom - 0.4));
}

export { LURE_KIND, KIND_LABEL };

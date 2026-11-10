// Player settings (kept apart from game progress so resetting progress keeps them).
// Stored as one JSON object in localStorage `reelworld-settings-v1`. Version 2 added the tabs
// (controls, graphics, audio, display, accessibility); every version-1 key keeps its name and
// meaning, so an old save simply gets the new keys at their defaults. See migrate().
import { cleanBinds } from './keys.js';
const KEY = 'reelworld-settings-v1';
export const SETTINGS_VERSION = 2;

const num = (def, min, max) => ({ def, min, max });
const bool = (def) => ({ def, bool: true });
const one = (def, list) => ({ def, list });

export const SPEC = {
  // gameplay
  mouseLock: bool(true), severeWeather: bool(true), biteQuality: bool(false), hands: one('1', ['1', '2', '3']), devTools: bool(false),
  // controls
  lookSpeed: num(1, 0.3, 2.5), invertY: bool(false),
  // graphics
  preset: one('high', ['low', 'medium', 'high', 'ultra', 'custom']),
  resolution: num(1, 0.5, 1.5), reflections: bool(true), reflectionRes: num(0.5, 0.25, 1),
  msaa: one(4, [0, 2, 4, 8]), shadows: one(4096, [1024, 2048, 4096]),
  fft: one(256, [128, 256, 512]), meshDetail: one(384, [256, 320, 384, 512]),
  bloom: num(0.05, 0, 0.15), droplets: bool(true),
  drawDistance: num(1, 0.4, 1.5), vegetation: num(1, 0.1, 1), buildings: num(1, 0, 1),
  wildlife: num(1, 0, 1), fishCount: num(1, 0.2, 1), weatherFx: num(1, 0, 1),
  fov: num(60, 45, 100), fps: bool(false),
  // audio ('volume' is the master level, as it always was)
  volume: num(0.7, 0, 1), sfxVol: num(1, 0, 1), ambVol: num(1, 0, 1), uiVol: num(1, 0, 1), muteBlur: bool(false), sonarPing: bool(true),
  // display / HUD
  sonar: bool(true), compass: bool(true), depthReadout: bool(true), hints: bool(true),
  unitDist: one('m', ['m', 'ft']), unitWeight: one('lb', ['lb', 'kg']), unitSpeed: one('kn', ['kn', 'mph', 'kmh']),
  hudScale: num(1, 0.8, 1.4), hudOpacity: num(1, 0.3, 1),
  // accessibility
  reduceMotion: bool(false), reduceFlash: bool(false), safeColors: bool(false), bigText: bool(false),
};

// what each quality preset sets (High is the look the game always had)
export const GFX_KEYS = ['resolution', 'reflections', 'reflectionRes', 'msaa', 'shadows', 'fft', 'meshDetail', 'bloom', 'droplets', 'drawDistance', 'vegetation', 'buildings', 'wildlife', 'fishCount', 'weatherFx'];
export const PRESETS = {
  low: { resolution: 0.7, reflections: false, reflectionRes: 0.35, msaa: 2, shadows: 1024, fft: 128, meshDetail: 256, bloom: 0, droplets: false, drawDistance: 0.6, vegetation: 0.4, buildings: 0.5, wildlife: 0.5, fishCount: 0.4, weatherFx: 0.5 },
  medium: { resolution: 0.85, reflections: true, reflectionRes: 0.35, msaa: 2, shadows: 2048, fft: 256, meshDetail: 320, bloom: 0.03, droplets: true, drawDistance: 0.8, vegetation: 0.7, buildings: 0.75, wildlife: 0.75, fishCount: 0.7, weatherFx: 0.75 },
  high: { resolution: 1, reflections: true, reflectionRes: 0.5, msaa: 4, shadows: 4096, fft: 256, meshDetail: 384, bloom: 0.05, droplets: true, drawDistance: 1, vegetation: 1, buildings: 1, wildlife: 1, fishCount: 1, weatherFx: 1 },
  ultra: { resolution: 1.25, reflections: true, reflectionRes: 0.75, msaa: 8, shadows: 4096, fft: 512, meshDetail: 512, bloom: 0.06, droplets: true, drawDistance: 1.5, vegetation: 1, buildings: 1, wildlife: 1, fishCount: 1, weatherFx: 1 },
};

export const DEFAULT_SETTINGS = Object.freeze({
  v: SETTINGS_VERSION,
  ...Object.fromEntries(Object.entries(SPEC).map(([k, s]) => [k, s.def])),
  binds: {},
});

// which preset (if any) the graphics values add up to
export function detectPreset(s) {
  for (const [id, p] of Object.entries(PRESETS)) if (GFX_KEYS.every((k) => Math.abs((s[k] ?? 0) - p[k]) < 1e-6 || s[k] === p[k])) return id;
  return 'custom';
}

function valid(spec, v) {
  if (spec.bool) return typeof v === 'boolean';
  if (spec.list) return spec.list.includes(v);
  return typeof v === 'number' && Number.isFinite(v);
}

// anything unknown, missing or out of range falls back to the default / the nearest limit
export function sanitize(raw) {
  const out = { v: SETTINGS_VERSION, binds: cleanBinds(raw && raw.binds) };
  for (const [k, spec] of Object.entries(SPEC)) {
    const v = raw ? raw[k] : undefined;
    out[k] = !valid(spec, v) ? spec.def : spec.list || spec.bool ? v : Math.min(spec.max, Math.max(spec.min, v));
  }
  return out;
}

// Version 1 had no `v`, no `preset` and only: volume, resolution, reflections, lookSpeed, invertY,
// mouseLock, sonar, compass, biteQuality, severeWeather. All keep their meaning. A player who had
// changed the resolution slider or turned reflections off gets "custom" (their values are kept);
// everyone else is on "high", which is what v1 always rendered.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return sanitize({});
  if (raw.v >= SETTINGS_VERSION) return sanitize(raw);
  const s = sanitize(raw);
  s.preset = detectPreset(s);
  return s;
}

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    const s = migrate(raw);
    if (raw && raw.v !== SETTINGS_VERSION) saveSettings(s);   // write the upgraded shape back once
    return s;
  } catch {
    return sanitize({});
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

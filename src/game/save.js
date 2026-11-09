// Player progress in localStorage. Every change goes through update() so callers get a new object.
import { SAVE_VERSION, upgradeSave } from './progress.js';
const KEY = 'reelworld-save-v1';   // key name kept for compatibility; the data carries its own version (v)

export const DEFAULT_SAVE = Object.freeze({
  cash: 250,
  location: 'okeechobee',
  boat: 'jon',
  boats: ['jon'],
  rods: ['medium'],
  reels: ['spin2500'],
  lines: ['mono8'],
  lures: ['nightcrawler', 'crank'],
  equip: { rod: 'medium', reel: 'spin2500', line: 'mono8', lure: 'nightcrawler' },
  unlocked: ['okeechobee'],
  journal: {},
  stats: { caught: 0, released: 0, earned: 0, heaviest: null },
  hour: 6.5,
  seenHelp: false,
  day: 1,
  challenges: null,
  livewell: [],      // kept fish: { id, sp, morph, lb, health, iced }
  waypoints: {},     // { locationId: [{ id, x, z, name }] }
  market: null,     // { day, loc, sold: { speciesId: count } }
  played: 0,        // seconds of play time
  v: SAVE_VERSION,  // save format version (progress.js upgradeSave brings older saves up)
  xp: 0,            // angler experience; level is derived (progress.js)
  wear: { line: 0, hook: 0, lost: [] },   // line/hook wear 0..1, lures lost to snags (restock at the shop)
  permits: { okeechobee: { until: 78.5 } },   // { locationId: { until: absolute game hours } }; new anglers start with 3 days at the home lake
  rapport: {},      // shopkeeper standing: { 'locId.role': { visits, deals, day } } (optional; dialogue.js TIERS)
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const data = JSON.parse(raw);
    const merged = { ...structuredClone(DEFAULT_SAVE), ...data, equip: { ...DEFAULT_SAVE.equip, ...(data.equip || {}) }, stats: { ...DEFAULT_SAVE.stats, ...(data.stats || {}) } };
    // old saves have no version: strip the defaults the merge just filled in so the upgrade sees what was really saved
    if ((data.v || 1) < SAVE_VERSION) { delete merged.xp; delete merged.wear; delete merged.permits; merged.v = 1; }
    return upgradeSave(merged);
  } catch (err) {
    console.warn('save load failed, starting fresh', err);
    return structuredClone(DEFAULT_SAVE);
  }
}

// frozen = never write the autosave: while loading another save, and on ?loc=<id> preview pages
let frozen = typeof location !== 'undefined' && new URLSearchParams(location.search).has('loc');
export function freezeSaves() { frozen = true; }
export function writeRaw(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; }
}
export function readRaw() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

export function writeSave(save) {
  if (frozen) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (err) {
    console.warn('save write failed', err);
  }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

// Record a catch in the journal; returns { save, isNewSpecies, isNewMorph, isRecord }.
// `how` ({lure, depth, hour}) is optional; the first catch of a species stores it as journal hint data.
export function logCatch(save, speciesId, morphId, lb, how) {
  const prev = save.journal[speciesId] || { caught: 0, best: 0, morphs: {} };
  const entry = {
    caught: prev.caught + 1,
    best: Math.max(prev.best, lb),
    morphs: { ...prev.morphs, [morphId]: (prev.morphs[morphId] || 0) + 1 },
  };
  const first = prev.how || (how && how.lure ? how : null);
  if (first) entry.how = first;
  const next = { ...save, journal: { ...save.journal, [speciesId]: entry } };
  return { save: next, isNewSpecies: !save.journal[speciesId], isNewMorph: !prev.morphs[morphId], isRecord: prev.caught > 0 && lb > prev.best };
}

export function catalogCount(save) {
  let n = 0;
  for (const e of Object.values(save.journal)) n += Object.keys(e.morphs).length;
  return n;
}

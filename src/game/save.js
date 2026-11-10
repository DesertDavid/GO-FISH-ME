// Player progress in localStorage. Every change goes through update() so callers get a new object.
import { SAVE_VERSION, upgradeSave } from './progress.js';
import { sanitizeCustom } from './boatCustom.js';
import { RODS, REELS, LINES, LURES, BOATS } from './gear.js';
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
  hold: [],          // net-boat hold stacks: { sp, lb, count, health } (livewell.js; optional)
  waypoints: {},     // { locationId: [{ id, x, z, name }] }
  market: null,     // { day, loc, sold: { speciesId: count } }
  played: 0,        // seconds of play time
  v: SAVE_VERSION,  // save format version (progress.js upgradeSave brings older saves up)
  xp: 0,            // angler experience; level is derived (progress.js)
  wear: { line: 0, hook: 0, lost: [] },   // line/hook wear 0..1, lures lost to snags (restock at the shop)
  custom: {},         // boat customization per boat id { paint, name, registration, upgrades } (boatCustom.js); optional, filled when you use the boat yard
  permits: { okeechobee: { until: 78.5 } },   // { locationId: { until: absolute game hours } }; new anglers start with 3 days at the home lake
  mounts: [],       // trophy wall: mounted catches (trophyData.js; optional)
  cands: [],        // catches measured for mounting
  locBest: {},      // personal best per species per water
  badges: [],       // completed daily challenges
  sighted: {},      // species seen on the fish cam: { speciesId: { n, loc, day, first } } (fishcam.js; separate from caught)
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
    merged.custom = sanitizeCustom(data.custom);
    // boat ids from a newer or hand-edited file that this build does not know: fall back to the starter boat
    if (Array.isArray(merged.boats)) merged.boats = merged.boats.filter((id) => BOATS[id]);
    if (!BOATS[merged.boat]) merged.boat = 'jon';
    if (!Array.isArray(merged.boats) || !merged.boats.includes(merged.boat)) merged.boats = [merged.boat, ...(merged.boats || [])];
    // gear ids that no longer exist (renamed/removed rods, a hand-edited file): fall back to the starter pieces
    for (const [k, own, table] of [['rod', 'rods', RODS], ['reel', 'reels', REELS], ['line', 'lines', LINES], ['lure', 'lures', LURES]]) {
      if (Array.isArray(merged[own])) merged[own] = merged[own].filter((id) => table[id]);
      if (!table[merged.equip[k]]) merged.equip[k] = DEFAULT_SAVE.equip[k];
      if (Array.isArray(merged[own]) && !merged[own].includes(merged.equip[k])) merged[own].push(merged.equip[k]);
    }
    return upgradeSave(merged);
  } catch (err) {
    console.warn('save load failed, starting fresh', err);
    return structuredClone(DEFAULT_SAVE);
  }
}

// frozen = never write the autosave: while loading another save, and on ?loc=<id> preview pages
// (a ?dev=1 session is frozen from the start; the developer tools freeze it the first time they are used: dev.js)
let frozen = typeof location !== 'undefined' && ['loc', 'dev'].some((k) => new URLSearchParams(location.search).has(k));
export function freezeSaves() { frozen = true; }
export const isFrozen = () => frozen;
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

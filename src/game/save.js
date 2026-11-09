// Player progress in localStorage. Every change goes through update() so callers get a new object.
const KEY = 'reelworld-save-v1';

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
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_SAVE), ...data, equip: { ...DEFAULT_SAVE.equip, ...(data.equip || {}) }, stats: { ...DEFAULT_SAVE.stats, ...(data.stats || {}) } };
  } catch (err) {
    console.warn('save load failed, starting fresh', err);
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(save) {
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
export function logCatch(save, speciesId, morphId, lb) {
  const prev = save.journal[speciesId] || { caught: 0, best: 0, morphs: {} };
  const entry = {
    caught: prev.caught + 1,
    best: Math.max(prev.best, lb),
    morphs: { ...prev.morphs, [morphId]: (prev.morphs[morphId] || 0) + 1 },
  };
  const next = { ...save, journal: { ...save.journal, [speciesId]: entry } };
  return { save: next, isNewSpecies: !save.journal[speciesId], isNewMorph: !prev.morphs[morphId], isRecord: prev.caught > 0 && lb > prev.best };
}

export function catalogCount(save) {
  let n = 0;
  for (const e of Object.values(save.journal)) n += Object.keys(e.morphs).length;
  return n;
}

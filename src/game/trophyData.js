// Trophy room: pure data and save helpers (no three.js), plus all the words on the plaques.
// Save fields (all optional, old saves just have none):
//   mounts   [{ id, sp, morph, lb, inches, day, loc, rod, lure, tags[], tour?, place? }]  fish on the wall (max CAPACITY)
//   cands    same shape, catches the harbour master took measurements of and will mount for a fee
//   locBest  { locId: { speciesId: { lb, day, morph } } }  personal best per species per water
//   badges   [{ text, day, loc }]  completed daily challenges (newest last, capped)
// Medals are the existing `save.trophies` (tournament podiums: { name, loc, place, day }).
import { SPECIES_BY_ID, MORPHS } from './species.js';
import { LOCATIONS } from './locations.js';
import { RODS, LURES } from './gear.js';

export const CAPACITY = 12;       // two rows of six on the wall
export const CAND_MAX = 10;
export const BADGE_MAX = 60;

// fee at the harbour master: a replica is cast and painted from your measurements and a photograph
export const mountFee = (lb) => Math.max(20, Math.round((15 + 7 * Math.sqrt(Math.max(0, lb))) / 5) * 5);

const id36 = () => Math.random().toString(36).slice(2, 8);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

// one entry from a landed fish; `how` names are resolved at plaque time so renamed gear never breaks
export function makeEntry(save, f, inches, tags) {
  return {
    id: id36(), sp: f.sp.id, morph: f.morph.id, lb: Math.round(f.lb * 100) / 100, inches: Math.round(inches * 10) / 10,
    day: save.day || 1, loc: save.location, rod: save.equip.rod, lure: save.equip.lure, tags: [...tags],
  };
}

// valid entry or null (unknown species/morph/water ids fall back or drop, so a hand-edited file cannot crash the hall)
export function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !SPECIES_BY_ID[e.sp]) return null;
  const o = {
    id: typeof e.id === 'string' ? e.id.slice(0, 12) : id36(), sp: e.sp, morph: MORPHS.some((m) => m.id === e.morph) ? e.morph : 'normal',
    lb: Math.min(5000, Math.max(0.01, num(e.lb, 1))), inches: Math.min(400, Math.max(1, num(e.inches, 10))),
    day: Math.max(1, Math.round(num(e.day, 1))), loc: LOCATIONS[e.loc] ? e.loc : null, rod: RODS[e.rod] ? e.rod : null, lure: LURES[e.lure] ? e.lure : null,
    tags: Array.isArray(e.tags) ? e.tags.filter((t) => typeof t === 'string').slice(0, 4).map((t) => t.slice(0, 40)) : [],
  };
  if (typeof e.tour === 'string') o.tour = e.tour.slice(0, 40);
  if (num(e.place, 0) >= 1 && e.place <= 3) o.place = Math.round(e.place);
  return o;
}

// bring the optional fields of any save to a valid shape (runs from upgradeSave: slot loads, imports, old saves)
export function cleanTrophies(s) {
  const out = {};
  out.mounts = (Array.isArray(s.mounts) ? s.mounts : []).map(cleanEntry).filter(Boolean).slice(0, CAPACITY);
  out.cands = (Array.isArray(s.cands) ? s.cands : []).map(cleanEntry).filter((c) => c && (!c.tour || c.place || c.tags.length)).slice(-CAND_MAX);
  const lb = {};
  if (s.locBest && typeof s.locBest === 'object') {
    for (const [loc, tab] of Object.entries(s.locBest)) {
      if (!LOCATIONS[loc] || !tab || typeof tab !== 'object') continue;
      for (const [sp, r] of Object.entries(tab)) {
        if (!SPECIES_BY_ID[sp] || !r || !(num(r.lb) > 0)) continue;
        (lb[loc] ||= {})[sp] = { lb: r.lb, day: Math.max(1, Math.round(num(r.day, 1))), morph: MORPHS.some((m) => m.id === r.morph) ? r.morph : 'normal' };
      }
    }
  }
  out.locBest = lb;
  out.badges = (Array.isArray(s.badges) ? s.badges : []).filter((b) => b && typeof b.text === 'string').slice(-BADGE_MAX)
    .map((b) => ({ text: b.text.slice(0, 80), day: Math.max(1, Math.round(num(b.day, 1))), loc: LOCATIONS[b.loc] ? b.loc : null }));
  return out;
}

// a landed fish: update the per-water records and queue a mount candidate when it earned one.
// info: { f, inches, isNewSpecies, isRecord, tour: { key, name } | null }
export function noteCatch(save, info) {
  const { f } = info, loc = save.location, day = save.day || 1;
  const locBest = { ...(save.locBest || {}) };
  const tab = { ...(locBest[loc] || {}) };
  const prev = tab[f.sp.id];
  const hereBest = !prev || f.lb > prev.lb;
  if (hereBest) tab[f.sp.id] = { lb: Math.round(f.lb * 100) / 100, day, morph: f.morph.id };
  locBest[loc] = tab;
  const tags = [];
  if (info.isNewSpecies) tags.push('First of its kind');
  else if (info.isRecord) tags.push('Personal best');
  let cands = [...(save.cands || [])];
  let entry = null;
  if (tags.length) entry = makeEntry(save, f, info.inches, tags);
  if (info.tour) {
    // only the heaviest fish of an event is worth casting: replace this event's earlier candidate
    const same = cands.find((c) => c.tourKey === info.tour.key);
    if (!same || f.lb > same.lb) {
      cands = cands.filter((c) => c.tourKey !== info.tour.key);
      entry = entry || makeEntry(save, f, info.inches, []);
      entry.tour = info.tour.name; entry.tourKey = info.tour.key;
    }
  }
  if (entry) {
    cands.push(entry);
    while (cands.length > CAND_MAX) cands.shift();
  }
  return { ...save, locBest, cands };
}

// the event is over: a podium finish tags its candidate, anything else drops the event-only candidate
export function settleTournament(save, key, place) {
  let cands = (save.cands || []).map((c) => (c.tourKey === key && place <= 3 ? { ...c, place } : c));
  cands = cands.filter((c) => c.tourKey !== key || c.place || c.tags.length);
  return { ...save, cands };
}

export function addBadge(save, text, loc) {
  return { ...save, badges: [...(save.badges || []), { text, day: save.day || 1, loc }].slice(-BADGE_MAX) };
}

// ---- actions (each returns { save, msg } or { err }) ---------------------------------------------
export function mountCand(save, id, replaceId) {
  const c = (save.cands || []).find((x) => x.id === id);
  if (!c) return { err: 'That catch is no longer on the list.' };
  const fee = mountFee(c.lb);
  if (save.cash < fee) return { err: `The mount costs $${fee}. You have $${Math.floor(save.cash)}.` };
  let mounts = [...(save.mounts || [])];
  if (mounts.length >= CAPACITY) {
    if (!replaceId || !mounts.some((m) => m.id === replaceId)) return { err: 'The wall is full. Pick one to take down first.' };
    mounts = mounts.filter((m) => m.id !== replaceId);
  }
  const { tourKey, ...clean } = c;   // eslint-disable-line no-unused-vars
  mounts.push(clean);
  return { save: { ...save, cash: save.cash - fee, mounts, cands: save.cands.filter((x) => x.id !== id) }, fee, entry: clean };
}

export function takeDown(save, id) {
  const m = (save.mounts || []).find((x) => x.id === id);
  if (!m) return { err: 'Nothing by that name on the wall.' };
  return { save: { ...save, mounts: save.mounts.filter((x) => x.id !== id) }, entry: m };
}

// ---- summaries for the records board -------------------------------------------------------------
// best weight per species over every water (journal best for old saves that predate per-water records)
export function bestPerSpecies(save) {
  const rows = new Map();
  for (const [loc, tab] of Object.entries(save.locBest || {})) {
    for (const [sp, r] of Object.entries(tab)) {
      const cur = rows.get(sp);
      if (!cur || r.lb > cur.lb) rows.set(sp, { sp, lb: r.lb, loc, day: r.day, morph: r.morph });
    }
  }
  for (const [sp, e] of Object.entries(save.journal || {})) {
    if (!SPECIES_BY_ID[sp] || !(e.best > 0)) continue;
    const cur = rows.get(sp);
    if (!cur || e.best > cur.lb + 0.001) rows.set(sp, { sp, lb: e.best, loc: null, day: null, morph: 'normal' });
  }
  return [...rows.values()].sort((a, b) => b.lb / SPECIES_BY_ID[b.sp].lb[2] - a.lb / SPECIES_BY_ID[a.sp].lb[2]);
}

// heaviest fish in each water
export function bestPerWater(save) {
  const out = [];
  for (const [loc, tab] of Object.entries(save.locBest || {})) {
    let top = null;
    for (const [sp, r] of Object.entries(tab)) if (!top || r.lb > top.lb) top = { sp, ...r };
    if (top) out.push({ loc, n: Object.keys(tab).length, ...top });
  }
  return out.sort((a, b) => b.lb - a.lb);
}

export function medalCounts(save) {
  const m = [0, 0, 0];
  for (const t of save.trophies || []) if (t && t.place >= 1 && t.place <= 3) m[t.place - 1]++;
  return m;
}

export const trophyCount = (save) => (save.mounts || []).length;

// ---- the words (a fisherman's logbook, not a game) ----------------------------------------------
export const PLACE = ['1st', '2nd', '3rd'];
export function dayText(day) { return `Day ${day}`; }

// short note under the catch card when the fish earned a mount
export function mountNote(tags, tour) {
  const bits = [...tags];
  if (tour) bits.push(tour);
  return `Measured and photographed for the wall (${bits.join(', ').toLowerCase()}). The harbour master mounts it from your numbers, for a fee.`;
}

// harbour-master lines for the trophy panel
export const SAY = {
  none: 'Nothing on the wall yet. Land something worth hanging.',
  empty: 'Nothing waiting to be mounted. Firsts, personal bests and event winners get measured on the spot.',
  full: 'The wall holds twelve. Take one down to make room.',
  hung: ['Hung. Hope the nail holds.', 'Up on the wall. It looks bigger from here.', 'On the board. The plaque will want a polish.'],
  down: ['Taken down and wrapped. It was a good one.', 'Off the wall. I will wrap it in newspaper.'],
};

// hall name board (a few waters get the local word)
export const HALL_SIGN = {
  default: ['TROPHY ROOM', 'Harbour master'],
  fjord: ['TROFERUM', 'Havnefogden'],
  cabo: ['SALA DE TROFEOS', 'Capitania'],
  amazon: ['SALA DE TROFEUS', 'Capitania'],
  keys: ['TROPHY ROOM', 'Conch harbour'],
};

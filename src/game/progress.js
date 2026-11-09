// Progression: angler level / XP, level gates for gear, boats and waters, line and hook wear,
// fishing permits, and the save upgrade (v1 -> v2). All formulas are documented in NOTES.md.
// Gate tables live here (not in gear.js / locations.js) so those files stay free for other work.
import { RODS, REELS, LINES, LURES, BOATS } from './gear.js';
import { LOCATIONS } from './locations.js';

export const SAVE_VERSION = 2;
export const MAX_LEVEL = 25;

// ---------------------------------------------------------------- level / XP
// cumulative XP needed to reach level L
export const xpAt = (L) => (L <= 1 ? 0 : Math.round(80 * Math.pow(L - 1, 1.6)));

export function levelOf(xp) {
  let L = 1;
  while (L < MAX_LEVEL && xp >= xpAt(L + 1)) L++;
  return L;
}

// { level, into, need, frac } for the XP bar
export function levelInfo(xp) {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, frac: 1 };
  const lo = xpAt(level), hi = xpAt(level + 1);
  return { level, into: xp - lo, need: hi - lo, frac: (xp - lo) / (hi - lo) };
}

// XP for one landed fish. info: { isNewSpecies, isNewMorph, isRecord }
export function catchXp(sp, morph, lb, info = {}) {
  const size = Math.min(70, 6 + 5 * Math.sqrt(lb));
  const rarity = Math.log2(1 + sp.price) * 2;
  const colour = morph.id === 'normal' ? 0 : (morph.value - 1) * 8;
  const parts = { size, rarity, colour, species: info.isNewSpecies ? 40 : 0, variant: info.isNewMorph && morph.id !== 'normal' ? 20 : 0, record: info.isRecord ? 15 : 0, trophy: lb > sp.lb[2] * 0.7 ? 25 : 0 };
  return { xp: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)), parts };
}
export const challengeXp = (reward) => 15 + Math.round(reward / 8);
export const tournamentXp = (place) => [250, 150, 90][place - 1] || 30;

// ---------------------------------------------------------------- level gates
// minimum angler level to buy / own (existing saves keep what they have)
export const GATES = {
  rods: { medium: 1, ultralight: 1, flyrod: 4, flipping: 4, mhcasting: 3, inshore: 5, surf: 7, standup: 11, biggame: 16 },
  reels: { spin2500: 1, finesse1000: 1, baitcast73: 3, flyreel: 4, spin4000: 5, spin8000: 8, conv30: 11, twospeed50: 14, biggame80: 18 },
  lines: { mono8: 1, mono12: 1, fluoro15: 3, braid30: 4, braid50: 6, mono80: 9, mono130: 12, braid200: 16 },
  boats: { jon: 1, bass: 4, skiff: 6, center: 10, trawler: 13, sport: 15, seiner: 19 },
  locs: { okeechobee: 1, woods: 3, tahoe: 5, columbia: 6, chesapeake: 6, keys: 7, mekong: 8, amazon: 9, kariba: 10, fjord: 12, gulf: 13, cabo: 14, reef: 16, bering: 18 },
};
export const gateLevel = (kind, id) => (GATES[kind] && GATES[kind][id]) || 1;   // lures and anything unlisted: level 1
export const meets = (save, kind, id) => levelOf(save.xp || 0) >= gateLevel(kind, id);

// what a level opens, for the milestone list
export function unlocksAt(level) {
  const out = [];
  const names = { rods: RODS, reels: REELS, lines: LINES, boats: BOATS, locs: LOCATIONS };
  const label = { rods: 'Rod', reels: 'Reel', lines: 'Line', boats: 'Boat', locs: 'Waters' };
  for (const [kind, table] of Object.entries(GATES)) for (const [id, L] of Object.entries(table)) if (L === level && level > 1 && names[kind][id]) out.push({ kind: label[kind], name: names[kind][id].name });
  return out;
}
export const MILESTONES = [3, 5, 8, 10, 13, 16, 19];   // levels worth calling out in the log

// ---------------------------------------------------------------- reel smoothness
// how evenly the drag lets go (0..1). A rough drag jerks the line at the start of a run.
export const REEL_SMOOTH = { spin2500: 0.6, finesse1000: 0.7, baitcast73: 0.72, flyreel: 0.82, spin4000: 0.78, spin8000: 0.86, conv30: 0.9, twospeed50: 0.95, biggame80: 0.98 };
export const reelSmooth = (id) => REEL_SMOOTH[id] ?? 0.8;

// ---------------------------------------------------------------- wear
export const WEAR_DEFAULT = Object.freeze({ line: 0, hook: 0, lost: [] });
// frayed line breaks below its rating: up to 45 % weaker when fully worn
export const effectiveTest = (test, wear) => test * (1 - 0.45 * Math.pow(Math.min(1, Math.max(0, wear)), 1.5));
// line wear while a fish pulls: ratio = tension / rating
export const fightWear = (dt, ratio) => dt * (0.0008 + 0.0022 * ratio * ratio);
export const CAST_WEAR = 0.003;
export const HOOK_WEAR_PER_FISH = 0.04;
// thinner line casts farther
export const lineCastMul = (test) => Math.min(1.05, Math.max(0.8, 1.08 - test / 400));
export const hookMul = (hookWear) => 1 - 0.4 * hookWear;
export function snagChance(lure, moving) {   // per second
  if (lure.bobber || !moving) return 0;
  return lure.depth === 'b' ? 0.006 : lure.depth === 'm' ? 0.0015 : 0;
}
export const respoolCost = (lineDef) => Math.max(3, Math.round(lineDef.price * 0.35));
export const SHARPEN_COST = 4;
export const restockCost = (lureDef) => Math.max(5, Math.round(lureDef.price * 0.5));
export const wearWord = (w) => (w < 0.25 ? 'Fresh' : w < 0.5 ? 'Used' : w < 0.75 ? 'Worn' : 'Frayed');

// ---------------------------------------------------------------- permits
// absolute game hours: day 1, 0:00 = 0
export const absHours = (save) => ((save.day || 1) - 1) * 24 + (save.hour || 0);
export const PERMIT_OPTIONS = [{ id: 'd1', days: 1, label: '1-day', mul: 1 }, { id: 'd3', days: 3, label: '3-day', mul: 2.4 }, { id: 'd7', days: 7, label: '7-day', mul: 4.5 }];
export function permitPrice(loc, opt) {
  const base = 8 + Math.sqrt(loc.price) * 0.6;
  return Math.max(5, Math.round((base * opt.mul) / 5) * 5);
}
export const permitLeft = (save, locId) => Math.max(0, ((save.permits || {})[locId]?.until ?? 0) - absHours(save));
export const hasPermit = (save, locId) => permitLeft(save, locId) > 0;
export function permitText(hours) {
  if (hours <= 0) return 'none';
  return hours >= 24 ? `${Math.ceil(hours / 24)} d left` : `${Math.ceil(hours)} h left`;
}

// ---------------------------------------------------------------- save upgrade
// Brings any older save (no version) up to v2 without losing anything; safe to run twice.
export function upgradeSave(s) {
  if (!s || typeof s !== 'object') return s;
  const out = { ...s };
  out.wear = { ...WEAR_DEFAULT, ...(s.wear || {}), lost: Array.isArray(s.wear?.lost) ? s.wear.lost.filter((id) => LURES[id]) : [] };
  out.permits = s.permits && typeof s.permits === 'object' ? s.permits : {};
  // shopkeeper relationships (optional field; old saves just start with strangers)
  out.rapport = {};
  if (s.rapport && typeof s.rapport === 'object') for (const [k, e] of Object.entries(s.rapport)) if (/^[a-z0-9]+\.(marina|bait|buyer)$/.test(k) && e && typeof e === 'object') out.rapport[k] = { visits: Math.max(0, Math.min(9999, Math.floor(+e.visits) || 0)), deals: Math.max(0, Math.min(99999, Math.floor(+e.deals) || 0)), day: Math.max(0, Math.floor(+e.day) || 0) };
  if ((s.v || 1) < SAVE_VERSION || typeof s.xp !== 'number') {
    const journal = s.journal || {};
    const species = Object.keys(journal).length;
    let morphs = 0;
    for (const e of Object.values(journal)) morphs += Object.keys(e?.morphs || {}).length;
    let xp = (s.stats?.caught || 0) * 22 + species * 40 + morphs * 15;
    // never below what the player already owns: they keep their gear, boats and waters
    let floor = 1;
    for (const [kind, key] of [['rods', 'rods'], ['reels', 'reels'], ['lines', 'lines'], ['boats', 'boats'], ['locs', 'unlocked']]) for (const id of s[key] || []) floor = Math.max(floor, gateLevel(kind, id));
    xp = Math.max(xp, xpAt(Math.min(floor, MAX_LEVEL)));
    out.xp = Math.round(xp);
    // a welcome-back 3-day permit where they are, and at the home lake
    const until = absHours(s) + 72;
    for (const id of new Set([s.location, 'okeechobee'])) if (LOCATIONS[id] && !out.permits[id]) out.permits = { ...out.permits, [id]: { until } };
  }
  out.v = SAVE_VERSION;
  return out;
}

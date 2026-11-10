import { SPECIES_BY_ID, MORPHS } from './species.js';
import { mods } from './boatCustom.js';

// Livewell and fish market. Kept fish ride in the boat's livewell (big pelagics go on ice) and
// lose condition over time; a tired or dead fish sells for less. The market at the docks posts
// new prices each day, pays a premium for the fish of the day, and pays less for a species the
// more of it you sell the same day.

const WELL_SLOTS = { jon: 4, kayak: 2, skiff: 6, bass: 8, pontoon: 12, bay: 10, center: 10, sport: 16, yacht: 22, trawler: 20, seiner: 20 };
export const wellSlots = (boatId, save) => Math.round((WELL_SLOTS[boatId] || 6) * (save ? mods(save, boatId).wellMul : 1));

// condition lost per game hour (one game hour = one real minute)
const HARDY = new Set(['catfish', 'carp', 'gar', 'bowfin', 'eel', 'sturgeon', 'arapaima', 'arowana', 'drum', 'piranha', 'bass', 'panfish', 'crappie', 'perch', 'pike', 'grouper', 'flat']);
const DELICATE = new Set(['trout', 'salmon', 'herring', 'mackerel']);
const ICED = new Set(['tuna', 'billfish', 'swordfish', 'shark', 'mahi']);
const decay = (sp, iced) => (iced ? 0.02 : HARDY.has(sp.body) ? 0.025 : DELICATE.has(sp.body) ? 0.1 : 0.05);

const MORPH_BY_ID = Object.fromEntries(MORPHS.map((m) => [m.id, m]));
const BUYER_CUT = 0.85;    // the buyer boat, where there's no dock to sell at

// small stable hash -> [0, 1)
function hash(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function keepFish(f) {
  const iced = ICED.has(f.sp.body) || f.lb > 60;
  return { id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, sp: f.sp.id, morph: f.morph.id, lb: f.lb, health: 1, iced };
}

export function condition(k) {
  if (k.iced) return k.health > 0.6 ? 'On ice' : 'On ice, softening';
  if (k.health <= 0) return 'Dead';
  if (k.health > 0.7) return 'Lively';
  if (k.health > 0.35) return 'Tired';
  return 'Weak';
}

// price multiplier for the fish's condition
const conditionMul = (k) => (k.iced ? 0.6 + 0.3 * k.health : k.health <= 0 ? 0.5 : 0.6 + 0.4 * k.health);

export class Market {
  constructor(loc) { this.loc = loc; }

  // today's price swing for a species at this location: 0.75x to 1.35x
  dayFactor(day, spId) { return 0.75 + 0.6 * hash(this.loc.id, day, spId); }

  // one well-stocked species from this location gets a premium each day
  fishOfDay(day) {
    const ids = Object.entries(this.loc.pool || {}).filter(([id, w]) => w >= 3 && SPECIES_BY_ID[id]).map(([id]) => id);
    if (!ids.length) return null;
    return ids[Math.floor(hash('fotd', this.loc.id, day) * ids.length)];
  }

  // sold-today counts reset with the day
  soldToday(save) {
    const m = save.market;
    return m && m.day === (save.day || 1) && m.loc === this.loc.id ? m.sold : {};
  }

  // dollars per lb today for one species (normal colouring, perfect condition)
  perLb(save, spId) {
    const sp = SPECIES_BY_ID[spId], day = save.day || 1;
    const n = this.soldToday(save)[spId] || 0;
    return sp.price * this.dayFactor(day, spId) * (spId === this.fishOfDay(day) ? 1.75 : 1) * Math.max(0.55, 1 - 0.07 * n);
  }

  value(save, k, buyerBoat = false) {
    const morph = MORPH_BY_ID[k.morph] || MORPHS[0];
    return Math.max(1, k.lb * this.perLb(save, k.sp) * morph.value * conditionMul(k) * (buyerBoat ? BUYER_CUT : 1));
  }

  // record a sale; returns the patched market state
  recordSale(save, spId, n = 1) {
    const sold = { ...this.soldToday(save) };
    sold[spId] = (sold[spId] || 0) + n;
    return { day: save.day || 1, loc: this.loc.id, sold };
  }
}

// lose condition over dtHours; returns the fish that just died (for a toast)
export function ageWell(well, dtHours, slow = 1) {
  const died = [];
  for (const k of well) {
    if (k.health <= 0) continue;
    const sp = SPECIES_BY_ID[k.sp];
    if (!sp) continue;
    k.health = Math.max(0, k.health - decay(sp, k.iced) * dtHours * slow);
    if (k.health === 0 && !k.iced) died.push(k);
  }
  return died;
}

// ---------------------------------------------------------------- net boat hold
// Net hauls go into the hold as one stack per species (count, total weight, one condition for the
// stack) instead of paying out at sea. The hold is chilled seawater and ice, so fish keep better
// than loose in a livewell but still soften by the hour; the market pays by condition.
// save.hold = [{ sp, lb, count, health }] (optional field).
const HOLD_ROOM = 1.5;   // hold = this x the net's bag size (x livewell upgrade)
export const holdCap = (boatSpec, save, boatId) => Math.round((boatSpec?.netCap || 0) * HOLD_ROOM * (save && boatId ? mods(save, boatId).wellMul : 1));
export const holdLb = (hold) => (hold || []).reduce((a, s) => a + s.lb, 0);
export const holdCount = (hold) => (hold || []).reduce((a, s) => a + s.count, 0);

const holdDecay = (sp) => (ICED.has(sp.body) ? 0.012 : HARDY.has(sp.body) ? 0.025 : DELICATE.has(sp.body) ? 0.07 : 0.04);   // per game hour

export function holdCondition(s) {
  if (s.health <= 0) return 'Spoiled';
  if (s.health > 0.7) return 'Fresh on ice';
  if (s.health > 0.35) return 'Going soft';
  return 'Poor';
}
export const holdTone = (s) => (s.health <= 0 ? 'dead' : s.health < 0.35 ? 'low' : s.health < 0.7 ? 'mid' : 'ice');
const holdMul = (s) => 0.35 + 0.65 * s.health;
// wholesale: every ~25 fish of one species moves the day's price as one retail fish does
const UNIT = 25;

// merge a haul's stacks into the hold (weighted condition); returns a new array
export function stowStacks(hold, stacks) {
  const out = (hold || []).map((s) => ({ ...s }));
  for (const n of stacks) {
    const cur = out.find((s) => s.sp === n.sp);
    if (cur) {
      cur.health = (cur.health * cur.lb + 1 * n.lb) / (cur.lb + n.lb);
      cur.lb += n.lb; cur.count += n.count;
    } else out.push({ sp: n.sp, lb: n.lb, count: n.count, health: 1 });
  }
  return out;
}

// which rows fit in `room` lb: best $/lb first; the last one may be taken in part.
// rows: [{ id, lb, count, value, keep }] -> [{ id, lb, count }] (lb 0 = left behind)
export function planHaul(rows, room) {
  const order = rows.map((r, i) => i).sort((a, b) => rows[b].value / rows[b].lb - rows[a].value / rows[a].lb);
  const take = rows.map((r) => ({ id: r.id, lb: 0, count: 0 }));
  let left = Math.max(0, room);
  for (const i of order) {
    const r = rows[i];
    if (!r.keep || left <= 0) continue;
    const f = Math.min(1, left / r.lb);
    take[i] = { id: r.id, lb: r.lb * f, count: Math.max(1, Math.round(r.count * f)) };
    left -= take[i].lb;
  }
  return take;
}

export function ageHold(hold, dtHours, slow = 1) {
  const died = [];
  for (const s of hold || []) {
    if (s.health <= 0) continue;
    const sp = SPECIES_BY_ID[s.sp];
    if (!sp) continue;
    s.health = Math.max(0, s.health - holdDecay(sp) * dtHours * slow);
    if (s.health === 0) died.push(s);
  }
  return died;
}

// price of a stack (or the part `frac` of it) at today's market; buyer boat takes its cut
export function holdValue(market, save, s, buyerBoat = false, frac = 1) {
  return Math.max(0, s.lb * frac * market.perLb(save, s.sp) * holdMul(s) * (buyerBoat ? BUYER_CUT : 1));
}
export const holdUnits = (s) => Math.max(1, Math.round(s.count / UNIT));

// sanitise a hold from a save file (old saves have none)
export function cleanHold(h) {
  if (!Array.isArray(h)) return [];
  const seen = new Set(), out = [];
  for (const s of h) {
    if (!s || !SPECIES_BY_ID[s.sp] || seen.has(s.sp)) continue;
    const lb = +s.lb, count = Math.floor(+s.count);
    if (!(lb > 0) || !(count > 0)) continue;
    seen.add(s.sp);
    out.push({ sp: s.sp, lb: Math.min(1e6, lb), count: Math.min(1e7, count), health: Math.max(0, Math.min(1, Number.isFinite(+s.health) ? +s.health : 1)) });
  }
  return out;
}

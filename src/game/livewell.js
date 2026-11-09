import { SPECIES_BY_ID, MORPHS } from './species.js';
import { mods } from './boatCustom.js';

// Livewell and fish market. Kept fish ride in the boat's livewell (big pelagics go on ice) and
// lose condition over time; a tired or dead fish sells for less. The market at the docks posts
// new prices each day, pays a premium for the fish of the day, and pays less for a species the
// more of it you sell the same day.

const WELL_SLOTS = { jon: 4, skiff: 6, bass: 8, center: 10, sport: 16, trawler: 20, seiner: 20 };
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
  recordSale(save, spId) {
    const sold = { ...this.soldToday(save) };
    sold[spId] = (sold[spId] || 0) + 1;
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

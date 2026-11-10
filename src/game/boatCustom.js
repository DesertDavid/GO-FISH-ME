// Boat customization: data only (no three.js), so save.js / saveSlots.js / ui.js can use it.
// Paint, boat name and registration are cosmetic; upgrades have real effects (see `mods`).
// Visuals live in boatVisual.js. All prices and level gates are in this file.
import { BOATS } from './gear.js';

// ---- palettes: realistic marine colours (gelcoat / topside paint / powder coat / canvas) ----
const P = (list) => list.map(([id, name, hex]) => ({ id, name, hex }));
export const PALETTES = {
  hull: P([
    ['white', 'Ice White', 0xf1f1ec], ['oyster', 'Oyster', 0xddd6c0], ['buff', 'Buff', 0xd8c79a], ['sand', 'Beach Sand', 0xb79f74],
    ['fog', 'Fog Blue', 0x8fa9b8], ['haze', 'Haze Grey', 0x9aa2a6], ['charcoal', 'Charcoal', 0x3a3f44], ['black', 'Jet Black', 0x16181a],
    ['navy', 'Navy', 0x1a2c4e], ['royal', 'Royal Blue', 0x244f94], ['teal', 'Deep Teal', 0x1b6a6c], ['forest', 'Forest Green', 0x1f4733],
    ['burgundy', 'Burgundy', 0x5b1e2a], ['red', 'Flag Red', 0xa6231d], ['orange', 'Sunset Orange', 0xd2581e], ['yellow', 'Chrome Yellow', 0xdbb42c],
  ]),
  stripe: P([
    ['white', 'White', 0xf4f4f0], ['silver', 'Silver', 0xb8bec2], ['gold', 'Gold', 0xd9a521], ['yellow', 'Chrome Yellow', 0xe6c030],
    ['orange', 'Orange', 0xd8601e], ['red', 'Red', 0xb3221c], ['burgundy', 'Burgundy', 0x6a2230], ['navy', 'Navy', 0x14284a],
    ['sky', 'Sky Blue', 0x6fa8c8], ['teal', 'Teal', 0x1f7a78], ['green', 'Racing Green', 0x2f6b45], ['black', 'Black', 0x181a1c],
  ]),
  trim: P([
    ['stainless', 'Stainless', 0xa9b1b8], ['black', 'Black anodised', 0x24262a], ['bronze', 'Bronze', 0x8a6a3c],
    ['white', 'White powder-coat', 0xe6e6e2], ['gunmetal', 'Gunmetal', 0x5d646b],
  ]),
  bottom: P([
    ['black', 'Black antifoul', 0x1a1b1d], ['navy', 'Navy antifoul', 0x14233f], ['red', 'Red antifoul', 0x8a2a1e],
    ['green', 'Green antifoul', 0x1f4a35], ['grey', 'Grey barrier coat', 0x6b7377], ['blue', 'Blue antifoul', 0x2c5f8a],
  ]),
  canopy: P([
    ['navy', 'Navy', 0x1c2a4a], ['black', 'Black', 0x1a1a1c], ['forest', 'Forest', 0x24412f], ['toast', 'Toast', 0xb49a70],
    ['white', 'White', 0xe6e4dc], ['burgundy', 'Burgundy', 0x5a1a28], ['grey', 'Grey', 0x6d7378],
  ]),
};
PALETTES.house = PALETTES.hull;

// Which named glb materials each colour slot tints (names come from tools/blender/build_boats.py).
export const SLOTS = {
  jon: { hull: ['jon_paint'], stripe: ['cowl_stripe'], trim: ['jon_grey_dk'], house: ['jon_grey'] },
  bass: { hull: ['metalflake_red'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'] },
  skiff: { hull: ['topside'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'] },
  center: { hull: ['topside'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'] },
  sport: { hull: ['topside'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'] },
  trawler: { hull: ['steel_blue'], stripe: ['funnel'], trim: ['trim'], bottom: ['bottom'], house: ['house_white'] },
  seiner: { hull: ['steel_navy'], stripe: ['crane_yellow'], trim: ['trim'], bottom: ['bottom'], house: ['house_white'] },
  kayak: { hull: ['topside'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'] },
  pontoon: { hull: ['fence_panel'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'], house: ['seat_vinyl'] },
  bay: { hull: ['topside'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'], house: ['deck_nonskid'] },
  yacht: { hull: ['topside'], stripe: ['stripe'], trim: ['trim'], bottom: ['bottom'], house: ['house_white'] },
};
export const SLOT_LABEL = { hull: 'Hull', stripe: 'Stripe / accent', trim: 'Trim and rails', bottom: 'Bottom paint', house: 'Wheelhouse', canopy: 'Canopy' };
export const SLOT_LABEL_BOAT = {
  jon: { stripe: 'Outboard stripe', house: 'Interior' }, trawler: { stripe: 'Funnel' }, seiner: { stripe: 'Crane' },
  kayak: { hull: 'Deck', stripe: 'Side band', bottom: 'Underside' },
  pontoon: { hull: 'Fence panels', stripe: 'Fence stripe', bottom: 'Tubes', house: 'Seat vinyl' },
  bay: { hull: 'Gelcoat', stripe: 'Cove stripe', house: 'Deck' },
  yacht: { stripe: 'Gold cove', house: 'Superstructure' },
};
export const WEAR_NAMES = ['Fresh', 'Used', 'Worn', 'Weathered'];

export const DEFAULT_NAMES = { jon: 'Tin Lizzie', bass: 'Bad Habit', skiff: 'Skinny Water', center: 'Second Wind', sport: 'Hooked Up', trawler: 'Northern Star', seiner: 'Harvest Moon', kayak: 'Low Profile', pontoon: 'Lazy Susan', bay: 'Knot Today', yacht: 'Reel Therapy' };
export const NAME_MAX = 20;
export const cleanName = (s) => String(s ?? '').replace(/[^A-Za-z0-9 '&.!-]/g, '').replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, NAME_MAX);
export const finalName = (s, id) => cleanName(s).trim() || DEFAULT_NAMES[id] || 'Reel World';

// Registration: "RW 4821 KF", stable per boat unless re-rolled.
export function makeReg(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const n = String(1000 + (h % 9000)), a = 'ABCDEFGHJKLMNPRSTUVWXY';
  return `RW ${n} ${a[(h >>> 8) % a.length]}${a[(h >>> 14) % a.length]}`;
}
export const cleanReg = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 12).trim();

// ---- upgrades ----
// tiers: [{ name, price (before boat factor), lvl }]. `boats`: where it can be fitted. `seen`: tiers that show on the model.
const BIG = ['jon', 'bass', 'skiff', 'pontoon', 'bay', 'center', 'sport', 'trawler', 'seiner', 'yacht'];   // everything with an engine and a deck to fit out
const ALL = [...BIG, 'kayak'];
export const UPGRADES = {
  sonar: { name: 'Fish finder', boats: ALL, tiers: [
    { name: 'CHIRP sonar', price: 300, lvl: 2, text: 'Sees fish 22 m around the boat (stock 14 m).' },
    { name: 'CHIRP + side imaging', price: 900, lvl: 8, text: 'Sees fish 34 m around the boat; screen on a bracket.', seen: true },
  ] },
  gps: { name: 'GPS and chart plotter', boats: ALL, tiers: [
    { name: 'GPS receiver', price: 250, lvl: 3, text: 'Waypoint memory 12 -> 30 per water.', seen: true },
    { name: 'Plotter + VHF', price: 700, lvl: 9, text: 'Waypoints 40; the chart plots bait schools.', seen: true },
  ] },
  engine: { name: 'Engine', boats: BIG, tiers: [
    { name: 'Tuned and re-propped', price: 1200, lvl: 5, text: 'Top speed +12%, quicker off the mark (+20%).', seen: true },
    { name: 'High-output power', price: 3200, lvl: 12, text: 'Top speed +25%, acceleration +45%.', seen: true },
  ] },
  holders: { name: 'Rod holders', boats: ['jon', 'bass', 'skiff', 'pontoon', 'bay', 'center', 'sport', 'yacht'], tiers: [
    { name: 'Gunwale pair', price: 150, lvl: 2, text: 'Trolling spread gets a 4th rod (more strikes).', seen: true },
    { name: 'Four holders', price: 350, lvl: 6, text: 'Trolling spread gets a 5th rod.', seen: true },
  ] },
  livewell: { name: 'Livewell', boats: BIG, tiers: [
    { name: 'Aerated tank', price: 300, lvl: 3, text: 'Livewell capacity +25%.', seen: true },
    { name: 'Recirculating tank', price: 800, lvl: 8, text: 'Livewell capacity +50%; fish tire a little slower.', seen: true },
  ] },
  shade: { name: 'Bimini top', boats: ['jon', 'bass', 'skiff', 'pontoon'], tiers: [
    { name: 'Folding bimini', price: 260, lvl: 2, text: 'Shade over the fish box: kept fish tire 25% slower.', seen: true },
  ] },
  lights: { name: 'Lights', boats: ALL, tiers: [
    { name: 'Running lights', price: 180, lvl: 4, text: 'Red and green navigation lights glow at night.', seen: true },
    { name: 'Spotlight', price: 420, lvl: 7, text: 'Bow spotlight lights the water ahead at night.', seen: true },
  ] },
  winch: { name: 'Anchor winch', boats: BIG, tiers: [
    { name: 'Manual windlass', price: 350, lvl: 3, text: 'I drops the anchor to hold position in water up to 30 m deep.', seen: true },
    { name: 'Power windlass', price: 1100, lvl: 10, text: 'I anchors in water up to 90 m deep, holds in current.', seen: true },
  ] },
};
export const UPGRADE_ORDER = ['sonar', 'gps', 'engine', 'holders', 'livewell', 'shade', 'lights', 'winch'];
// bigger boats cost more to fit out
const SIZE_FACTOR = { kayak: 0.2, jon: 0.35, skiff: 0.8, bass: 1, pontoon: 1.2, bay: 1.5, center: 1.8, sport: 3.5, trawler: 3, seiner: 4.5, yacht: 6.5 };
export const upgradePrice = (boatId, upId, tier) => Math.max(15, Math.round((UPGRADES[upId].tiers[tier].price * (SIZE_FACTOR[boatId] || 1)) / 5) * 5);
export const upgradeLevel = (upId, tier) => UPGRADES[upId].tiers[tier].lvl;
export const upgradesFor = (boatId) => UPGRADE_ORDER.filter((u) => UPGRADES[u].boats.includes(boatId));
// a paint job (any colour change) costs a little against the boat's value; the jon is a few dollars of rattle-can
export const paintCost = (boatId) => (BOATS[boatId].price ? Math.round((40 + BOATS[boatId].price * 0.006) / 5) * 5 : 25);

// ---- per-boat settings kept in save.custom[boatId] ----
const paletteHas = (slot, id) => PALETTES[slot].some((p) => p.id === id);
export function defaultCustom(boatId) {
  return { hull: null, stripe: null, trim: null, bottom: null, house: null, canopy: 'navy', wear: 0, name: DEFAULT_NAMES[boatId] || 'Reel World', reg: makeReg(boatId), up: {} };
}
export function sanitizeCustom1(boatId, c) {
  const d = defaultCustom(boatId);
  if (!c || typeof c !== 'object') return d;
  const out = { ...d };
  for (const slot of ['hull', 'stripe', 'trim', 'bottom', 'house']) out[slot] = SLOTS[boatId][slot] && paletteHas(slot, c[slot]) ? c[slot] : null;
  out.canopy = paletteHas('canopy', c.canopy) ? c.canopy : 'navy';
  out.wear = Number.isFinite(c.wear) ? Math.max(0, Math.min(3, Math.round(c.wear))) : 0;
  out.name = typeof c.name === 'string' ? (cleanName(c.name).trim() || d.name) : d.name;
  out.reg = typeof c.reg === 'string' && cleanReg(c.reg) ? cleanReg(c.reg) : d.reg;
  const up = {};
  const avail = upgradesFor(boatId);
  if (c.up && typeof c.up === 'object') for (const [u, t] of Object.entries(c.up)) if (avail.includes(u) && Number.isFinite(t)) up[u] = Math.max(0, Math.min(UPGRADES[u].tiers.length, Math.round(t)));
  out.up = up;
  return out;
}
export function sanitizeCustom(all, boats) {
  const out = {};
  if (!all || typeof all !== 'object') return out;
  for (const id of Object.keys(all)) if (BOATS[id]) out[id] = sanitizeCustom1(id, all[id]);
  return out;
}
// the settings for a boat, always complete (old saves have no `custom`)
export const customOf = (save, boatId) => sanitizeCustom1(boatId, save?.custom?.[boatId]);
export const tierOf = (save, boatId, upId) => customOf(save, boatId).up[upId] || 0;

// ---- gameplay numbers derived from the owned upgrades ----
const SONAR_R = [14, 22, 34], WP_CAP = [12, 30, 40], SPEED = [1, 1.12, 1.25], ACCEL = [1, 1.2, 1.45], WELL = [1, 1.25, 1.5], DEPTH_MAX = [0, 30, 90];
export function mods(save, boatId) {
  const t = customOf(save, boatId).up, g = (k) => t[k] || 0;
  return {
    sonarRange: SONAR_R[g('sonar')], waypoints: WP_CAP[g('gps')], plotsBait: g('gps') >= 2,
    speed: SPEED[g('engine')], accel: ACCEL[g('engine')], trollRods: 3 + g('holders'),
    wellMul: WELL[g('livewell')], wellSlow: g('livewell') >= 2 ? 0.88 : 1, shade: g('shade') > 0,
    lights: g('lights'), anchorDepth: DEPTH_MAX[g('winch')], holdsInCurrent: g('winch') >= 2,
  };
}

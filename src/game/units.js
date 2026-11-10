// Unit-aware formatting for every readout. The game keeps metres, pounds, inches and m/s
// internally; Settings > Display picks what the player sees.
const S = { dist: 'm', weight: 'lb', speed: 'kn' };
export const setUnits = (dist, weight, speed) => { S.dist = dist; S.weight = weight; S.speed = speed; };
export const units = () => ({ ...S });
const FT = 3.28084, KG = 0.45359237, MI = 1609.344;

// distance along the water: m / km, or ft / mi
export function dist(m) {
  if (S.dist === 'ft') return m >= MI ? `${(m / MI).toFixed(m >= MI * 10 ? 0 : 1)} mi` : `${Math.round(m * FT)} ft`;
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}
// depth / line length / small lengths, with a chosen number of decimals
export function depth(m, dec = 1) { return S.dist === 'ft' ? `${(m * FT).toFixed(dec)} ft` : `${m.toFixed(dec)} m`; }
export const depthN = (m, dec = 0) => (S.dist === 'ft' ? (m * FT) : m).toFixed(dec);
export const distUnit = () => (S.dist === 'ft' ? 'ft' : 'm');
// fish weight
export function weight(lb) {
  if (S.weight === 'kg') { const kg = lb * KG; return kg < 1 ? `${Math.round(kg * 1000)} g` : kg < 100 ? `${kg.toFixed(2)} kg` : `${Math.round(kg).toLocaleString()} kg`; }
  return lb < 1 ? `${Math.round(lb * 16)} oz` : lb < 100 ? `${lb.toFixed(2)} lb` : `${Math.round(lb).toLocaleString()} lb`;
}
// a force / line rating (tension, drag, line test): one decimal by default
export function force(lb, dec = 1) { return S.weight === 'kg' ? `${(lb * KG).toFixed(dec)} kg` : `${lb.toFixed(dec)} lb`; }
export const forceN = (lb, dec = 1) => (S.weight === 'kg' ? lb * KG : lb).toFixed(dec);
export const forceUnit = () => S.weight;
// fish length from inches
export function length(inches) {
  if (S.weight === 'kg') { const cm = inches * 2.54; return cm < 100 ? `${cm.toFixed(1)} cm` : `${(cm / 100).toFixed(2)} m`; }
  return inches < 48 ? `${inches.toFixed(1)}"` : `${Math.floor(inches / 12)}' ${Math.round(inches % 12)}"`;
}
// speed from m/s -> { v, u }
export function speed(mps) {
  const a = Math.abs(mps);
  if (S.speed === 'mph') return { v: a * 2.23694, u: 'mph' };
  if (S.speed === 'kmh') return { v: a * 3.6, u: 'km/h' };
  return { v: a * 1.94384, u: 'knots' };
}

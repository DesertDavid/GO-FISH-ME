import { SPECIES_BY_ID, rollWeight } from './species.js';

// Tournaments: timed events at a location with an entry fee, AI rivals and a live
// leaderboard. Formats: biggest single fish, best five-fish bag, or a species shootout.
// Time is game minutes (one real second each).
const RIVALS = ['Hank "Hooks" Dalton', 'Rosa Vega', 'Big Earl', 'Mai Tran', 'Duke Callahan', 'Priya Shah', 'Lars Eriksen', 'Tommy Boudreaux', 'Kaia Mahoe', 'Dee Whitfield'];

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tournamentsFor(loc, day) {
  const rand = rng([...loc.id].reduce((h, ch) => h * 33 + ch.charCodeAt(0), day * 131) | 0);
  const scale = 1 + loc.price / 4000;
  const pool = Object.entries(loc.pool).sort((a, b) => b[1] - a[1]);
  const target = pool[Math.floor(rand() * Math.min(3, pool.length))][0];
  const fee = (base) => Math.round((base * scale) / 5) * 5;
  return [
    { id: 'big', name: 'Big Fish Classic', format: 'big', minutes: 90, fee: fee(100), text: 'Heaviest single fish of any species wins.' },
    { id: 'bag', name: 'Five-Fish Bag Derby', format: 'bag', minutes: 120, fee: fee(150), text: 'Total weight of your best five fish.' },
    { id: 'species', name: `${SPECIES_BY_ID[target].name} Shootout`, format: 'species', species: target, minutes: 60, fee: fee(80), text: `Heaviest ${SPECIES_BY_ID[target].name} wins. Other fish don't count.` },
  ];
}

// payouts as multiples of the entry fee, by finishing place
const PAYOUT = [8, 4, 2];

export class Tournament {
  constructor(def, loc) {
    this.def = def;
    this.loc = loc;
    this.left = def.minutes;
    this.mine = [];   // weights of the player's qualifying fish
    const n = 7;
    this.rivals = Array.from({ length: n }, (_, i) => ({ name: RIVALS[(i * 3 + loc.id.length) % RIVALS.length], skill: 0.65 + Math.random() * 0.55, fish: [], next: 4 + Math.random() * 12 }));
    this.pool = Object.entries(loc.pool).map(([id, w]) => [SPECIES_BY_ID[id], w]).filter(([sp]) => sp);
  }

  // a weight that counts for this format, or null
  qualifies(sp, lb) {
    if (this.def.format === 'species' && sp.id !== this.def.species) return null;
    return lb;
  }

  score(list) {
    if (!list.length) return 0;
    if (this.def.format === 'bag') return [...list].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
    return Math.max(...list);
  }

  record(sp, lb) {
    const w = this.qualifies(sp, lb);
    if (w == null) return false;
    this.mine.push(w);
    return true;
  }

  rivalCatch(r) {
    let sp;
    if (this.def.format === 'species') sp = SPECIES_BY_ID[this.def.species];
    else {
      let x = Math.random() * this.pool.reduce((a, [, w]) => a + w, 0);
      for (const [s, w] of this.pool) { x -= w; if (x <= 0) { sp = s; break; } }
      sp = sp || this.pool[0][0];
    }
    r.fish.push(rollWeight(sp, Math.random, 0.8 + r.skill * 0.25));
  }

  // advance by game minutes; returns true when it just ended
  tick(minutes) {
    if (this.done) return false;
    this.left -= minutes;
    for (const r of this.rivals) {
      r.next -= minutes;
      if (r.next <= 0) {
        if (Math.random() < 0.35 + r.skill * 0.35) this.rivalCatch(r);
        r.next = (6 + Math.random() * 14) / r.skill * (this.def.format === 'species' ? 1.6 : 1);
      }
    }
    if (this.left <= 0) { this.done = true; return true; }
    return false;
  }

  standings() {
    const rows = this.rivals.map((r) => ({ name: r.name, score: this.score(r.fish), you: false }));
    rows.push({ name: 'You', score: this.score(this.mine), you: true });
    return rows.sort((a, b) => b.score - a.score);
  }

  result() {
    const rows = this.standings();
    const place = rows.findIndex((r) => r.you) + 1;
    const mult = rows[place - 1].score > 0 ? PAYOUT[place - 1] || 0 : 0;
    return { place, prize: mult * this.def.fee, rows };
  }
}

export const PAYOUT_TABLE = PAYOUT;

import { SPECIES_BY_ID } from './species.js';

// Daily challenges: three goals per location per game day, paid in cash. Generated from a
// seed of (location, day) so they stay the same if you reload.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roundNice = (x) => (x < 2 ? Math.round(x * 2) / 2 : x < 20 ? Math.round(x) : Math.round(x / 5) * 5);

export function makeChallenges(loc, day) {
  const rand = rng([...loc.id].reduce((h, c) => h * 31 + c.charCodeAt(0), day * 977) | 0);
  const pool = Object.entries(loc.pool).sort((a, b) => b[1] - a[1]);
  const common = pool.slice(0, Math.max(3, Math.ceil(pool.length / 2)));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const scale = 1 + Math.sqrt(loc.price) / 40;   // pricier waters pay more
  const out = [];
  const [cid] = pick(common);
  const csp = SPECIES_BY_ID[cid];
  out.push({ type: 'species', id: cid, need: 2 + Math.floor(rand() * 3), have: 0, text: '', reward: 0 });
  out[0].text = `Catch ${out[0].need} ${csp.name}`;
  out[0].reward = Math.round(60 * out[0].need * scale);

  const [bid] = pick(pool.slice(0, Math.max(4, pool.length)));
  const bsp = SPECIES_BY_ID[bid];
  const lb = roundNice(bsp.lb[1] * (1.1 + rand() * 0.5));
  out.push({ type: 'big', id: bid, lb, need: 1, have: 0, text: `Land a ${bsp.name} over ${lb} lb`, reward: Math.round(220 * scale) });

  const third = pick(['variety', 'variety', 'rare', 'total']);
  if (third === 'variety') {
    const n = Math.min(pool.length, 3 + Math.floor(rand() * 2));
    out.push({ type: 'variety', need: n, have: 0, seen: [], text: `Catch ${n} different species`, reward: Math.round(180 * scale) });
  } else if (third === 'rare') {
    out.push({ type: 'rare', need: 1, have: 0, text: 'Catch any rare colour variant', reward: Math.round(600 * scale) });
  } else {
    const n = 6 + Math.floor(rand() * 5);
    out.push({ type: 'total', need: n, have: 0, text: `Catch ${n} fish of any kind`, reward: Math.round(30 * n * scale) });
  }
  return { loc: loc.id, day, list: out };
}

// Apply one catch; returns { state, completed: [challenge...] } without mutating the input.
export function recordCatch(state, sp, morph, lb) {
  const completed = [];
  const list = state.list.map((c) => {
    if (c.done) return c;
    const n = { ...c, seen: c.seen ? [...c.seen] : undefined };
    if (c.type === 'species' && sp.id === c.id) n.have++;
    if (c.type === 'big' && sp.id === c.id && lb >= c.lb) n.have = 1;
    if (c.type === 'rare' && morph.id !== 'normal') n.have = 1;
    if (c.type === 'total') n.have++;
    if (c.type === 'variety' && !n.seen.includes(sp.id)) { n.seen.push(sp.id); n.have = n.seen.length; }
    if (n.have >= n.need) { n.done = true; completed.push(n); }
    return n;
  });
  return { state: { ...state, list }, completed };
}

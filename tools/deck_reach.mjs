// Offline reachability check of every boat's deck layout (boatDeck.js is pure): flood-fill the walkable grid from the
// helm on each level and report the reachable x range, whether every seat and ladder can be reached, and how much of the deck is open.
import { DECKS, standable } from '../src/game/boatDeck.js';
import { BOATS } from '../src/game/gear.js';
const STEP = 0.1;
for (const id of Object.keys(DECKS)) {
  const D = DECKS[id];
  if (D.walk === false) { console.log(id.padEnd(8), 'seated only'); continue; }
  const eye = BOATS[id].eye, out = [];
  const reach = D.levels.map(() => new Set());
  const key = (x, z) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`;
  const fill = (li, x0, z0) => {
    const q = [[x0, z0]], seen = reach[li];
    while (q.length) {
      const [x, z] = q.pop(); const k = key(x, z);
      if (seen.has(k)) continue;
      if (!standable(id, li, x, z)) continue;
      seen.add(k);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.push([x + dx * STEP, z + dz * STEP]);
    }
  };
  // the helm spot may sit inside a blocker: start from the nearest standable point
  let sx = eye, sz = 0, best = 1e9;
  for (let x = D.levels[0].x0; x <= D.levels[0].x1; x += STEP) for (let z = -4; z <= 4; z += STEP) if (standable(id, 0, x, z)) { const d = Math.hypot(x - eye, z); if (d < best) { best = d; sx = x; sz = z; } }
  fill(0, sx, sz);
  for (const c of D.climbs || []) if (c.level === 0 && [...reach[0]].some((k) => { const [a, b] = k.split(',').map(Number); return Math.hypot(a * STEP - c.x, b * STEP - c.z) < c.r; })) fill(c.to[0], c.to[1], c.to[2]);
  D.levels.forEach((L, li) => {
    const pts = [...reach[li]].map((k) => k.split(',').map(Number)), xs = pts.map((p) => p[0] * STEP);
    let total = 0; for (let x = L.x0; x <= L.x1; x += STEP) for (let z = -5; z <= 5; z += STEP) if (standable(id, li, x, z)) total++;
    out.push(`L${li} x ${xs.length ? Math.min(...xs).toFixed(1) : '-'}..${xs.length ? Math.max(...xs).toFixed(1) : '-'} (deck ${L.x0}..${L.x1}) open ${total ? Math.round(100 * pts.length / total) : 0}%`);
  });
  const near = (li, x, z, r) => [...reach[li]].some((k) => { const [a, b] = k.split(',').map(Number); return Math.hypot(a * STEP - x, b * STEP - z) < r; });
  const seats = D.seats.map((s) => `${near(s.level || 0, s.x, s.z, 1.15) ? 'ok' : 'UNREACHABLE'}:${s.label}`);
  console.log(id.padEnd(8), out.join(' | '), '| seats', seats.length ? seats.join(', ') : 'none');
}

// Walkable decks, seats and ladders for every boat, in boat-local metres (x bow, z starboard, y up).
// Numbers come from tools/blender/build_boats.py and boats_*.py (Blender y = -z here). The player walks as a point of
// radius PLAYER inside a level's outline, outside its blockers (consoles, cabins, drums...). The eye height follows the
// real deck (`deckHeight` in boats.js) plus a level / bump offset, so the player rides the boat as it pitches and rolls.

export const PLAYER = 0.22;
export const EYE_STAND = 1.68;

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// hull plan: half width at the gunwale (hull_profile in build_boats.py)
const PLAN = {
  bass: { L: 6.2, B: 2.35, tw: 0.88, bp: 1.6, fl: 0.04 }, skiff: { L: 5.6, B: 2.1, tw: 0.9, bp: 1.7, fl: 0.05 },
  center: { L: 8.6, B: 2.8, tw: 0.86, bp: 1.7, fl: 0.06 }, sport: { L: 14, B: 4.6, tw: 0.9, bp: 1.6, fl: 0.07 },
  trawler: { L: 20, B: 6.4, tw: 0.82, bp: 1.5, fl: 0.08 }, seiner: { L: 26, B: 8, tw: 0.8, bp: 1.4, fl: 0.08 },
  bay: { L: 6.9, B: 2.5, tw: 0.86, bp: 1.7, fl: 0.06 }, yacht: { L: 18.4, B: 5.5, tw: 0.88, bp: 1.5, fl: 0.11 },
};
export function halfWidth(id, x) {
  if (id === 'jon') {
    const L = 3.8, B = 1.72 / 2, t = Math.min(1, Math.max(0, (x + L / 2) / L));
    return t < 0.5 ? B * (0.93 + 0.07 * Math.sin(t / 0.5 * Math.PI / 2)) : B * (0.05 + 0.95 * Math.pow(1 - Math.pow((t - 0.5) / 0.5, 1.6), 0.85));
  }
  if (id === 'pontoon') { const u = (x - 2.55) / 0.8; return x < 2.55 ? 1.2 : u >= 1 ? 0 : 1.2 * Math.sqrt(1 - u * u); }
  if (id === 'kayak') return 0.2;
  const p = PLAN[id], t = Math.min(1, Math.max(0, (x + p.L / 2) / p.L));
  let b = t < 0.55 ? p.tw + (1 - p.tw) * Math.sin(t / 0.55 * Math.PI / 2) : Math.max(0.02, Math.pow(1 - Math.pow((t - 0.55) / 0.45, p.bp), 0.62));
  return (p.B / 2) * b * (1 + p.fl);
}

// blockers are [x0, x1, z0, z1]. level.up = metres above the normal deck. bumps raise parts of a level (casting decks).
// seats: eye = eye height above the floor when sitting, yaw = which way to face (boat-relative look yaw, 0 = bow).
// climbs: stand within r of (x, z) on `from` and press the key to arrive at `to` ([level, x, z]).
const rect = (xc, zc, sx, sz) => [xc - sx / 2, xc + sx / 2, zc - sz / 2, zc + sz / 2];

export const DECKS = {
  jon: {
    levels: [{ up: 0, x0: -1.85, x1: 1.35, inset: 0.28, blockers: [] }],
    seats: [{ x: -1.22, z: 0, eye: 1.1, yaw: 0, label: 'the stern bench' }, { x: -0.12, z: 0, eye: 1.1, yaw: 0, label: 'the middle bench' }, { x: 0.98, z: 0, eye: 1.1, yaw: 0, label: 'the bow bench' }],
  },
  kayak: { walk: false, levels: [{ up: 0, x0: -0.2, x1: 0.2, inset: 0, blockers: [] }], seats: [{ x: -0.12, z: 0, eye: 0, yaw: 0, label: 'the seat', fixed: true }] },
  bass: {
    levels: [{ up: 0, x0: -2.85, x1: 2.75, inset: 0.25, blockers: [rect(0.2, 0, 0.55, 0.55)] }],
    seats: [{ x: -0.5, z: 0.42, eye: 1.2, yaw: 0, label: 'the starboard seat' }, { x: -0.5, z: -0.42, eye: 1.2, yaw: 0, label: 'the port seat' }, { x: -2.3, z: 0, eye: 1.2, yaw: 0, label: 'the rear seat' }, { x: 2.2, z: 0, eye: 1.2, yaw: 0, label: 'the front casting seat' }],
  },
  skiff: {
    levels: [{ up: 0, x0: -2.5, x1: 2.4, inset: 0.2, blockers: [rect(0, 0, 0.6, 0.85)] }],
    seats: [{ x: 0.6, z: 0, eye: 1.15, yaw: 0, label: 'the cooler seat' }],
  },
  pontoon: {
    levels: [{ up: 0, x0: -3.1, x1: 3.3, inset: 0.18, blockers: [rect(0.55, 0.76, 0.75, 0.75), rect(-2.75, 0, 0.7, 2.3), rect(-1.2, -0.95, 2.3, 0.5), rect(-1.35, 0, 0.7, 0.7), rect(0.95, -0.72, 0.65, 0.5), rect(-0.15, 0.76, 0.55, 0.55)] }],
    seats: [{ x: -0.15, z: 0.76, eye: 1.2, yaw: 0, label: "the captain's chair" }, { x: -2.6, z: 0, eye: 1.15, yaw: 0, label: 'the stern couch' }, { x: -1.2, z: -0.75, eye: 1.15, yaw: -1.57, label: 'the port couch' },
      { x: 1.85, z: 0.58, eye: 1.2, yaw: 0, label: 'a bow fishing chair' }, { x: 1.85, z: -0.58, eye: 1.2, yaw: 0, label: 'a bow fishing chair' }],
  },
  bay: {
    levels: [{ up: 0, x0: -3.2, x1: 3.15, inset: 0.28, bumps: [{ x0: 1.55, x1: 3.3, up: 0.3 }], blockers: [rect(-0.05, 0, 1.15, 0.84), rect(-0.95, 0, 0.5, 0.85), rect(-2.15, 0, 0.85, 0.75), rect(-0.2, 0, 0.1, 0.1)] }],
    seats: [{ x: -0.95, z: 0.55, eye: 1.5, yaw: 0, label: 'the leaning post' }, { x: -3.0, z: 0.62, eye: 1.15, yaw: 0, label: 'a jump seat' }, { x: -3.0, z: -0.62, eye: 1.15, yaw: 0, label: 'a jump seat' }],
  },
  center: {
    levels: [{ up: 0, x0: -4.1, x1: 4.0, inset: 0.3, blockers: [rect(0.4, 0, 1.0, 1.15), rect(-0.6, 0, 0.6, 0.8)] }],
    seats: [{ x: -0.85, z: 0, eye: 1.5, yaw: 0, label: 'the leaning post' }, { x: 3.0, z: 0, eye: 1.2, yaw: 0, label: 'the bow seat' }],
  },
  sport: {
    levels: [
      { up: 0, x0: -6.6, x1: 6.7, inset: 0.15, blockers: [rect(0.2, 0, 4.0, 3.4), rect(2.8, 0, 1.8, 2.6), rect(4.0, 0, 1.6, 1.6), rect(-4.5, 0, 0.5, 0.5)] },
      { up: 3.0, x0: -1.0, x1: 2.8, inset: 0.4, blockers: [], hw: 1.6 },
    ],
    seats: [{ x: -4.5, z: 0, eye: 1.3, yaw: Math.PI, label: 'the fighting chair' }, { x: 0.1, z: 0.8, eye: 1.2, yaw: 0, level: 1, label: 'the flybridge helm seat' }],
    climbs: [{ level: 0, x: -2.1, z: 1.4, r: 1.1, to: [1, -0.6, 1.2], label: 'climb to the flybridge' }, { level: 1, x: -0.6, z: 1.2, r: 1.0, to: [0, -2.1, 1.4], label: 'climb down' }],
  },
  trawler: {
    levels: [{ up: 0, x0: -7.7, x1: 9.4, inset: 0.1, blockers: [rect(3.5, 0, 3.0, 4.5), rect(5.7, 0, 1.6, 3.4), rect(-5.5, 0, 2.2, 4.4), rect(-3.0, 1.6, 3.0, 0.7), rect(-3.0, -1.6, 3.0, 0.7)] }],
    seats: [],
  },
  seiner: {
    levels: [{ up: 0, x0: -9.4, x1: 12.4, inset: 0.1, blockers: [rect(5.0, 0, 3.0, 5.4), rect(7.4, 0, 2.2, 3.8), rect(8.9, 0, 1.2, 2.6), rect(-7.0, 0, 5.0, 4.6), rect(-11.6, 0, 3.2, 2.4)] }],
    seats: [],
  },
  yacht: {
    levels: [
      { up: 0, x0: -9.0, x1: 9.0, inset: 0.3, blockers: [rect(0.1, 0, 7.0, 3.7), rect(-4.95, 0, 0.9, 1.8), rect(-4.0, 0, 0.7, 3.0), rect(-8.55, 0, 0.9, 1.1)] },
      { up: 2.33, x0: -3.4, x1: 2.2, inset: 0.3, blockers: [rect(1.55, 0, 1.3, 1.9), rect(-1.0, 0, 0.8, 1.8)], hw: 1.75 },
    ],
    seats: [{ x: -6.8, z: 0, eye: 1.35, yaw: Math.PI, label: 'the fighting chair' }, { x: -4.0, z: 0.9, eye: 1.25, yaw: Math.PI, label: 'the mezzanine seat' }, { x: -1.0, z: 0.6, eye: 1.2, yaw: 0, level: 1, label: 'the flybridge settee' }, { x: 0.7, z: 0.5, eye: 1.2, yaw: 0, level: 1, label: 'a flybridge chair' }, { x: 5.0, z: 0.0, eye: 0.9, yaw: 0, label: 'the foredeck sun pad' }],
    climbs: [{ level: 0, x: -3.6, z: 2.0, r: 1.3, to: [1, -3.0, 1.2], label: 'climb to the flybridge' }, { level: 1, x: -3.0, z: 1.2, r: 1.0, to: [0, -3.6, 2.0], label: 'climb down' }],
  },
};

const lvlOf = (id, i) => DECKS[id].levels[i];

// is (x, z) standable on this level?
export function standable(id, li, x, z, r = PLAYER) {
  const L = lvlOf(id, li);
  if (x < L.x0 || x > L.x1) return false;
  const hw = (L.hw ?? halfWidth(id, x)) - (L.inset ?? 0.3);
  if (Math.abs(z) > hw) return false;
  for (const [x0, x1, z0, z1] of L.blockers) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
  return true;
}

// step from (x, z) by (dx, dz) sliding along obstacles; returns the new point
export function stepOn(id, li, x, z, dx, dz) {
  if (!standable(id, li, x, z) ) { return { x: x + dx, z: z + dz };    // stuck inside something: let them walk out
  }
  if (standable(id, li, x + dx, z + dz)) return { x: x + dx, z: z + dz };
  if (standable(id, li, x + dx, z)) return { x: x + dx, z };
  if (standable(id, li, x, z + dz)) return { x, z: z + dz };
  return { x, z };
}

// height of the floor above the normal deck line at (x, z) on this level
export function floorUp(id, li, x) {
  const L = lvlOf(id, li);
  let up = L.up;
  for (const b of L.bumps || []) up += b.up * sm(b.x0 - 0.15, b.x0 + 0.15, x);
  return up;
}

export const nearSeat = (id, li, x, z, reach = 1.15) => {
  let best = null, bd = reach;
  for (const s of DECKS[id].seats) { if ((s.level || 0) !== li) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
};
export const nearClimb = (id, li, x, z) => (DECKS[id].climbs || []).find((c) => c.level === li && Math.hypot(c.x - x, c.z - z) < c.r) || null;

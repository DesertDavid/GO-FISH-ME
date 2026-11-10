// Fight feel: every tunable number for hooking, fighting and landing lives here, plus the pure
// helpers that turn a species into a fight personality and pick a landing method.
// (fishing.js uses these; rod.js reads FEEL.rods; fightFx.js / landing.js read the cue numbers.)

export const FEEL = {
  // ---- rod bend: a damped spring on the load, so the blank loads smoothly, bounces on release
  // soft: bend per unit of (tension / rod power); act: curve exponent along the blank (higher = tip loads
  // first, lower = the whole blank takes it); zeta: damping (low = whippy springback); hz: spring speed.
  bend: { gain: 0.95, max: 1.35, whip: 0.55 },
  rods: {
    ultralight: { soft: 1.25, act: 2.8, zeta: 0.2, hz: 4.2 },
    medium: { soft: 1.05, act: 2.3, zeta: 0.24, hz: 3.8 },
    flyrod: { soft: 1.2, act: 1.7, zeta: 0.17, hz: 2.6 },
    mhcasting: { soft: 0.95, act: 2.2, zeta: 0.27, hz: 3.8 },
    flipping: { soft: 0.82, act: 2.8, zeta: 0.32, hz: 4.4 },
    inshore: { soft: 1.0, act: 2.1, zeta: 0.25, hz: 3.4 },
    surf: { soft: 0.95, act: 1.9, zeta: 0.25, hz: 3.0 },
    standup: { soft: 0.8, act: 1.5, zeta: 0.34, hz: 3.8 },
    biggame: { soft: 0.7, act: 1.4, zeta: 0.4, hz: 3.4 },
  },
  rodDefault: { soft: 1, act: 2.2, zeta: 0.25, hz: 3.6 },

  // ---- warning / consequence
  warnLoad: 0.82,          // tension / test above which the gauge warns (amber)
  warnOverload: 0.22,      // overload (0..1 snaps at 1) above which it warns hard
  snapKick: 1.5,           // rod springback kick on a snap
  releaseKick: 0.9,        // ...on a hook pull-out or a thrown hook
  flyBack: { life: 0.9, speed: 9 },

  // ---- behaviour weights: added on top of the base table in fishing.chooseBehavior
  surge: { power: 1.4, radial: 1.15, t: [0.8, 1.5] },
  headshake: { power: 0.6, t: [0.7, 1.5], shake: 0.6 },   // shake amp (the base fight shake is 0.12-0.22)
  sound: { power: 0.95, t: [3, 5.5], depthFrac: 0.92 },
  thrash: { power: 0.7, t: [1.2, 2.4], splashEvery: [0.22, 0.5] },
  roll: 0.9,                // radians a worn-out fish rolls onto its side

  // ---- screen / hand cues (all zero with Settings > Reduce motion, except the crank resistance)
  cam: { shake: 0.0042, freq: 11, lbRef: 60 },   // rad of camera shake at full load on a heavy fish
  hand: { shake: 0.006, pull: 0.035, crankDrag: 0.62, slipStall: 0.2 },

  // ---- landing: net up to netMaxLb, gaff for big/toothy fish from a boat, the rest by hand
  land: {
    netMaxLb: 18, gaffMinLb: 40, glide: 0.9, scoop: 0.7, lift: 0.8,
    stamina: 0.32,          // a fish this tired inside the landing range is landed
    toothy: ['pike', 'shark', 'barracuda', 'billfish', 'swordfish', 'gar', 'piranha', 'tuna'],
  },
};

const BODY = {
  jumper: ['billfish', 'swordfish', 'tarpon', 'bass', 'mahi', 'salmon', 'trout', 'snook', 'arowana'],
  sounder: ['grouper', 'sturgeon', 'cod', 'catfish', 'snapper', 'arapaima', 'drum', 'eel', 'carp', 'flat'],
  thrasher: ['pike', 'gar', 'barracuda', 'shark', 'bowfin', 'piranha', 'cobia'],
  runner: ['tuna', 'mackerel', 'jack', 'bonefish', 'herring', 'parrot'],
};

// species + size -> how it fights. Weights are relative picks (0 = never).
export function personality(sp, lb) {
  const b = sp.body, big = Math.min(1, lb / 40);
  const p = { jump: 0, sound: 0.08, headshake: 0.12, surge: 0.1, thrash: 0, jumpMax: 6 };
  if (BODY.jumper.includes(b)) { p.jump = 1; p.headshake += 0.1; p.surge += 0.12; }
  if (BODY.sounder.includes(b)) { p.sound = 0.55; p.headshake += 0.08; p.jump = 0; }
  if (BODY.thrasher.includes(b)) { p.headshake += 0.45; p.thrash = 0.35; p.surge += 0.1; }
  if (BODY.runner.includes(b)) { p.surge += 0.45; p.sound += 0.05; }
  if (b === 'billfish' || b === 'swordfish') { p.jumpMax = 9; p.surge += 0.15; }
  if (sp.depth === 'b') p.sound += 0.2;
  // tiny fish just wriggle; bigger ones have more to show
  p.sound *= 0.4 + big;
  p.surge *= 0.5 + big * 0.7;
  p.headshake *= 0.7 + 0.6 * big;
  return p;
}

export function landKind(sp, lb, onBoat, bigGame) {
  const L = FEEL.land;
  if (lb <= L.netMaxLb && !(bigGame && lb > 8)) return 'net';
  if (onBoat && (lb >= L.gaffMinLb || L.toothy.includes(sp.body))) return 'gaff';
  return 'hand';
}

// Dry, short. Picked at random per event.
export const LOST = {
  snap: ['The line went. So did the fish.', 'Line parted. It kept the lure.', 'Snapped. That was more fish than line.', 'Gone. The line gave up before it did.'],
  snapFrayed: ['The line parted at the worn stretch. You were warned by the shop.', 'Frayed line, as advertised. Fish lost.'],
  rod: ['The rod gave all it had. Fish lost.', 'Rod ran out of bend. The fish did not.'],
  spooled: ['Spooled. It took every metre.', 'Out of line. It is still swimming.'],
  wound: ['You wound against a running fish. Line parted.', 'Cranking on a running fish: the line disagreed.'],
  pull: ['The hook let go. It had never really been in.', 'Hook pulled. It was not that interested.', 'Slack line, hook out. The fish thanks you.'],
  thrown: ['It threw the hook on the jump. Show of force.', 'Shook the hook in mid-air. Fair play.'],
};
export const pickLine = (k) => { const a = LOST[k]; return a[Math.floor(Math.random() * a.length)]; };

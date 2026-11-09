// Bait & lure matching: EVERY tunable number of the model lives in this file (logic is in bait.js).
// A multiplier of 1 = decent, >1 = favourite, <1 = poor. Nothing is ever zero: a bad match is only slower.

export const TUNING = {
  // how well each factor must match; the floor is the worst case (never 0, so the game stays fun)
  floor: { lure: 0.12, depth: 0.22, time: 0.25, wx: 0.35, col: 0.8 },
  dietMiss: 0.14,          // lure's diet letters don't hit the species' diet: this multiplier
  dietHit: 1,
  lureCap: 1.8,            // max lure multiplier (kind x size); also the divisor that normalises "perfect"
  // overall bite rate multiplier from the pool's average fit: base + gain * sqrt(avgFit), then clamped
  rate: { base: 0.38, gain: 1.35, min: 0.38, max: 1.55 },
  // which species shows up: selection weight = pool weight * lure * depth * time * wx * col
  // exponent flattens (<1) or sharpens (>1) the bias; 1 = straight product
  pickSharpness: 1,
  // 4 time-of-day anchors (hours), interpolated linearly around the clock
  hours: { night: 1.5, dawn: 6.5, day: 12.5, dusk: 19 },
  // retrieve depth: a mid-water lure that is not being reeled sinks deeper (m per second, max extra m)
  sink: { rate: 0.5, max: 5, fall: 2.0 },
  // depth model (metres below the surface)
  depth: {
    surfaceC: 0.3, surfaceSigma: 1.5,
    midC: 2.6, midSigma: 2.2, midMin: 1.4, midMax: 7,
    sizeShift: 0.8,          // + log10(typical lb) * this to the mid-water centre (bigger fish sit lower)
    jitter: 0.9,             // +- metres of per-species variety, hashed from the id
    bottomGap: 0.9,          // bottom fish: tolerance (m) above the bottom
    nightShallow: 0.7,       // non-bottom fish come up at night (x)
    sunDeep: 1.2,            // and sit a little deeper in bright midday (x)
  },
  // lure colour class vs conditions (weak effect): multiplier range is floor.col..colMax
  colMax: 1.15,
  // journal hint tiers: catches needed to reveal each line
  hints: { bait: 1, depth: 2, time: 3, weather: 4 },
  // fish-finder arches: ambient fish choose a depth around the species' preferred one
  sonarSpread: 0.35,
  // bite-quality ticks (optional HUD): avg-rate thresholds for 1, 2, 3 ticks
  quality: [0.55, 0.85, 1.15],
  // refresh interval for the cached pool fit (seconds)
  cacheT: 0.4,
};

// each lure's behaviour class (unlisted/new lures fall back to 'other' = neutral, diet match only)
export const LURE_KIND = {
  nightcrawler: 'live', minnow: 'live', shrimp: 'live', livebait: 'live',
  cutbait: 'cut', dough: 'dough', squid: 'strip',
  crank: 'crank', spinner: 'spinner', plasticworm: 'worm', popper: 'popper', jig: 'jig', spoon: 'spoon',
  dryfly: 'fly', bucktail: 'bucktail', swimbait: 'swimbait', diamondjig: 'diamond', trollskirt: 'skirt',
};
export const KINDS = ['live', 'cut', 'dough', 'strip', 'crank', 'spinner', 'worm', 'popper', 'jig', 'spoon', 'fly', 'bucktail', 'swimbait', 'diamond', 'skirt'];
export const KIND_LABEL = {
  live: 'Live bait', cut: 'Cut bait', dough: 'Dough / corn', strip: 'Strip bait', crank: 'Crankbaits', spinner: 'Spinners',
  worm: 'Plastic worms', popper: 'Topwater', jig: 'Jigs', spoon: 'Spoons', fly: 'Flies', bucktail: 'Bucktails', swimbait: 'Swimbaits',
  diamond: 'Diamond jigs', skirt: 'Trolled skirts',
};

// kind multipliers per body family (species.body); omitted kinds = 1
export const BODY_KIND = {
  bass: { crank: 1.5, worm: 1.6, jig: 1.3, spinner: 1.25, popper: 1.2, swimbait: 1.3, cut: 0.4, dough: 0.3, fly: 0.5, skirt: 0.4, bucktail: 0.8, diamond: 0.5 },
  panfish: { live: 1.5, fly: 1.3, spinner: 1.1, dough: 1.1, crank: 0.5, swimbait: 0.3, skirt: 0.2, popper: 0.5, diamond: 0.3, spoon: 0.6 },
  crappie: { live: 1.6, spinner: 1.3, jig: 1.3, crank: 0.6, fly: 0.9, swimbait: 0.3, skirt: 0.2, dough: 0.4, cut: 0.3 },
  perch: { jig: 1.5, live: 1.4, crank: 1.3, spoon: 1.2, worm: 1.1, spinner: 1.1, skirt: 0.4, popper: 0.5, fly: 0.5, dough: 0.5 },
  pike: { spoon: 1.5, spinner: 1.5, swimbait: 1.5, crank: 1.3, popper: 1.1, live: 1.1, jig: 0.9, worm: 0.5, fly: 0.4, dough: 0.2, cut: 0.4 },
  trout: { fly: 1.7, spinner: 1.5, spoon: 1.3, live: 1.1, crank: 0.9, jig: 0.8, swimbait: 0.5, dough: 0.7, skirt: 0.3, cut: 0.4 },
  salmon: { spoon: 1.5, spinner: 1.2, skirt: 1.4, bucktail: 1.2, fly: 1.2, live: 1.0, crank: 0.9, popper: 0.6, dough: 0.2 },
  catfish: { cut: 1.9, live: 1.2, dough: 1.2, strip: 1.1, crank: 0.4, spinner: 0.4, popper: 0.2, fly: 0.2, skirt: 0.2, worm: 1.0, jig: 0.8 },
  carp: { dough: 2.0, live: 0.8, worm: 0.7, fly: 0.4, crank: 0.25, spinner: 0.25, popper: 0.2, cut: 0.3, jig: 0.3, skirt: 0.1 },
  sturgeon: { cut: 1.5, live: 1.3, worm: 1.0, dough: 0.5, crank: 0.2, spinner: 0.2, popper: 0.15, fly: 0.15, jig: 0.5, skirt: 0.2 },
  gar: { live: 1.4, crank: 1.2, swimbait: 1.1, spoon: 1.1, popper: 1.1, cut: 0.8, dough: 0.15, fly: 0.3 },
  bowfin: { live: 1.4, crank: 1.2, swimbait: 1.2, spoon: 1.2, cut: 1.3, popper: 1.2, jig: 1.0, dough: 0.2 },
  snook: { live: 1.4, jig: 1.3, popper: 1.3, spoon: 1.2, swimbait: 1.2, bucktail: 1.2, crank: 1.1, fly: 1.0, dough: 0.2, skirt: 0.6, worm: 0.6 },
  drum: { live: 1.5, cut: 1.4, jig: 1.2, strip: 1.1, bucktail: 1.1, crank: 0.6, spinner: 0.5, popper: 0.5, dough: 0.5, fly: 0.4, skirt: 0.3 },
  snapper: { cut: 1.5, jig: 1.4, live: 1.4, diamond: 1.4, strip: 1.3, bucktail: 1.2, spoon: 0.8, skirt: 0.7, crank: 0.35, spinner: 0.3, popper: 0.6, dough: 0.15, fly: 0.3 },
  grouper: { live: 1.5, cut: 1.5, jig: 1.4, diamond: 1.4, bucktail: 1.2, strip: 1.2, swimbait: 1.1, crank: 0.4, spinner: 0.3, popper: 0.3, dough: 0.1, skirt: 0.5 },
  tuna: { skirt: 2.0, popper: 1.3, diamond: 1.2, live: 1.3, strip: 1.1, spoon: 0.9, crank: 0.5, spinner: 0.4, fly: 0.3, dough: 0.1, worm: 0.2, cut: 0.7 },
  billfish: { skirt: 2.0, live: 1.5, strip: 1.1, popper: 0.8, swimbait: 0.8, diamond: 0.4, crank: 0.3, spinner: 0.2, dough: 0.05, worm: 0.1, cut: 0.4 },
  mahi: { skirt: 1.8, popper: 1.3, live: 1.4, strip: 1.1, spoon: 1.0, crank: 0.5, diamond: 0.7, dough: 0.1 },
  mackerel: { skirt: 1.7, spoon: 1.4, live: 1.4, popper: 1.0, strip: 1.1, diamond: 1.1, crank: 0.8, spinner: 0.6, dough: 0.1, cut: 0.7 },
  jack: { popper: 1.4, diamond: 1.3, jig: 1.2, skirt: 1.2, live: 1.2, spoon: 1.1, swimbait: 1.1, crank: 0.9, dough: 0.1, worm: 0.3 },
  shark: { cut: 1.8, live: 1.4, strip: 1.2, skirt: 0.9, popper: 0.4, swimbait: 0.8, jig: 0.6, crank: 0.25, spinner: 0.1, dough: 0.1, fly: 0.1 },
  cod: { jig: 1.4, diamond: 1.3, cut: 1.3, strip: 1.2, live: 1.0, bucktail: 1.2, crank: 0.3, spinner: 0.2, popper: 0.15, dough: 0.2, fly: 0.15, skirt: 0.3 },
  flat: { jig: 1.4, bucktail: 1.3, cut: 1.3, live: 1.3, strip: 1.2, diamond: 1.1, crank: 0.35, spinner: 0.25, popper: 0.15, dough: 0.1, fly: 0.2, skirt: 0.2 },
  eel: { cut: 1.6, live: 1.4, strip: 1.2, jig: 1.0, crank: 0.4, popper: 0.2, dough: 0.2, fly: 0.15, skirt: 0.2 },
  barracuda: { popper: 1.5, spoon: 1.4, skirt: 1.3, live: 1.4, swimbait: 1.3, crank: 1.1, diamond: 0.9, dough: 0.1 },
  tarpon: { live: 1.5, swimbait: 1.3, popper: 1.2, fly: 1.3, jig: 1.0, crank: 0.8, skirt: 0.8, cut: 0.7, dough: 0.1 },
  bonefish: { live: 1.4, jig: 1.4, fly: 1.6, bucktail: 1.3, crank: 0.2, spinner: 0.2, popper: 0.2, skirt: 0.1, spoon: 0.3, cut: 0.6, dough: 0.1 },
  piranha: { cut: 1.6, live: 1.2, crank: 1.0, spinner: 1.0, worm: 0.6, popper: 0.7, dough: 0.3, skirt: 0.4 },
  herring: { live: 0.5, fly: 0.7, spinner: 0.5, dough: 0.3, crank: 0.15, jig: 0.2, skirt: 0.05, popper: 0.1, swimbait: 0.05, spoon: 0.3 },
  arowana: { fly: 1.5, popper: 1.4, live: 1.2, spinner: 1.0, crank: 0.9, worm: 0.8, dough: 0.3 },
  arapaima: { live: 1.5, swimbait: 1.3, crank: 1.0, popper: 0.9, skirt: 0.7, cut: 1.0, dough: 0.1 },
  parrot: { dough: 1.3, live: 0.6, jig: 0.5, crank: 0.2, popper: 0.2, skirt: 0.1 },
  cobia: { live: 1.6, jig: 1.4, swimbait: 1.3, bucktail: 1.3, strip: 1.1, popper: 1.0, skirt: 1.0, crank: 0.6, dough: 0.1 },
  swordfish: { strip: 1.6, live: 1.4, skirt: 0.9, cut: 0.6, jig: 0.2, crank: 0.1, popper: 0.05 },
};

// time-of-day weights [dawn, day, dusk, night] per body family (default: flat-ish)
export const BODY_TIME = {
  bass: [1, 0.55, 1, 0.45], pike: [1, 0.6, 1, 0.4], trout: [1, 0.65, 1, 0.35], salmon: [1, 0.7, 0.9, 0.35], perch: [0.9, 0.6, 1, 0.55],
  crappie: [1, 0.55, 1, 0.5], panfish: [0.8, 1, 0.8, 0.3], carp: [0.7, 0.9, 1, 0.5], sturgeon: [0.7, 0.8, 1, 0.8],
  catfish: [0.5, 0.35, 0.8, 1], eel: [0.4, 0.35, 0.8, 1], shark: [0.7, 0.5, 0.9, 1], gar: [0.8, 1, 0.8, 0.35], bowfin: [0.9, 0.8, 0.9, 0.7],
  tuna: [0.9, 1, 0.8, 0.25], billfish: [0.8, 1, 0.8, 0.2], mahi: [0.8, 1, 0.8, 0.2], mackerel: [1, 1, 0.8, 0.25], jack: [1, 0.9, 1, 0.35],
  barracuda: [0.9, 1, 0.8, 0.3], tarpon: [0.85, 0.75, 1, 0.85], snook: [0.9, 0.55, 1, 0.95], drum: [0.9, 0.6, 1, 0.8],
  snapper: [0.8, 0.55, 1, 0.9], grouper: [0.8, 0.8, 1, 0.8], flat: [0.8, 0.55, 0.9, 0.9], cod: [0.8, 0.9, 0.8, 0.7], bonefish: [0.8, 1, 0.8, 0.15],
  herring: [0.9, 1, 0.9, 0.5], piranha: [0.8, 1, 0.8, 0.4], arowana: [0.9, 0.7, 1, 0.5], swordfish: [0.2, 0.15, 0.7, 1],
};
export const TIME_DEFAULT = [0.9, 0.8, 0.9, 0.5];
// species that feed mostly after dark (forced to this time profile on top of the family value)
export const NIGHT_FEEDERS = ['channelcat', 'bluecat', 'flathead', 'walleye', 'sauger', 'burbot', 'redtail', 'piraiba', 'snook', 'tarpon', 'mangrovesnapper', 'swordfish', 'lemonshark', 'blacktip', 'nurseshark', 'tigershark', 'ling', 'wolffish', 'sablefish', 'pacifichalibut', 'barramundi', 'mangrovejack', 'trairao'];
export const NIGHT_PROFILE = [0.6, 0.35, 0.9, 1];

// weather weights [clear, partly, overcast, rain, storm] per body family (storm is bad for nearly everyone)
export const WX_ORDER = ['clear', 'partly', 'overcast', 'rain', 'storm'];
export const WX_DEFAULT = [0.85, 0.95, 1, 0.95, 0.5];
export const BODY_WX = {
  bass: [0.75, 0.9, 1, 1, 0.45], pike: [0.75, 0.9, 1, 1, 0.45], trout: [0.7, 0.9, 1, 1, 0.45], salmon: [0.7, 0.9, 1, 1, 0.45], perch: [0.8, 0.95, 1, 1, 0.5],
  catfish: [0.7, 0.85, 1, 1, 0.7], eel: [0.7, 0.85, 1, 1, 0.7], shark: [0.8, 0.9, 1, 1, 0.7], sturgeon: [0.8, 0.9, 1, 1, 0.6],
  tuna: [1, 1, 0.85, 0.7, 0.35], billfish: [1, 1, 0.85, 0.7, 0.35], mahi: [1, 1, 0.85, 0.7, 0.35], mackerel: [1, 1, 0.85, 0.75, 0.35], jack: [1, 1, 0.9, 0.75, 0.35],
  tarpon: [1, 1, 0.8, 0.65, 0.3], snook: [0.9, 1, 0.9, 0.8, 0.35], bonefish: [1, 1, 0.7, 0.5, 0.2],
  snapper: [0.95, 1, 0.95, 0.8, 0.4], grouper: [0.95, 1, 0.95, 0.8, 0.4], carp: [0.9, 1, 1, 0.9, 0.5], panfish: [0.9, 1, 1, 0.9, 0.5],
};

// lure colour class vs conditions. Class from the lure's colour; the species pick a favourite per family
export const COL_CLASSES = ['natural', 'bright', 'dark'];
export const BODY_COL = {
  bass: [1, 0.9, 1], pike: [0.9, 1, 0.9], trout: [1, 0.85, 0.85], salmon: [0.9, 1, 0.8], catfish: [0.8, 0.9, 1], carp: [1, 0.85, 0.85],
  tuna: [1, 0.9, 0.85], billfish: [0.85, 1, 1], mahi: [0.8, 1, 0.8], snapper: [1, 0.95, 0.85], grouper: [1, 0.95, 0.9], snook: [1, 0.9, 0.9],
  shark: [0.85, 0.9, 1], eel: [0.8, 0.9, 1],
};

// hand-written overrides for the famous ones. kind: multipliers per lure kind, lure: per lure id,
// time: [dawn, day, dusk, night], wx: [clear..storm], dep: [minM, maxM] preferred retrieve depth
export const OVERRIDES = {
  largemouth: { kind: { worm: 1.8, crank: 1.6 }, dep: [1.2, 4] },
  smallmouth: { kind: { jig: 1.4, crank: 1.5, worm: 1.2 }, dep: [2, 5] },
  spotted: { kind: { worm: 1.5, jig: 1.4 } },
  peacock: { kind: { popper: 1.6, swimbait: 1.3, live: 1.2 }, dep: [0.2, 2.5], time: [1, 1, 0.9, 0.2] },
  rainbow: { kind: { fly: 1.8, spinner: 1.7 }, dep: [0.3, 4] },
  brown: { kind: { fly: 1.5, spinner: 1.6, crank: 1.2 }, time: [1, 0.5, 1, 0.8] },
  brook: { kind: { fly: 1.9, spinner: 1.5 } },
  cutthroat: { kind: { fly: 1.8, spinner: 1.5 } },
  laketrout: { kind: { spoon: 1.7, diamond: 1.5, jig: 1.4 } },
  kokanee: { kind: { spinner: 1.5, fly: 1.2, live: 1.3 }, dep: [4, 12] },
  walleye: { kind: { jig: 1.7, live: 1.5, crank: 1.4 } },
  muskie: { kind: { swimbait: 1.8, spinner: 1.5, crank: 1.4 } },
  pike: { kind: { spoon: 1.7, spinner: 1.6 } },
  carp: { kind: { dough: 2.2 }, wx: [1, 1, 0.85, 0.7, 0.4] },
  channelcat: { kind: { cut: 2.0, dough: 1.3 } },
  bluecat: { kind: { cut: 2.0 } },
  flathead: { kind: { live: 1.8, cut: 1.5 } },
  stripedbass: { kind: { live: 1.5, swimbait: 1.4, spoon: 1.2, bucktail: 1.3 }, time: [1, 0.5, 1, 0.8] },
  bonefish: { kind: { fly: 1.8, live: 1.6, jig: 1.5 }, dep: [0.3, 2], wx: [1, 1, 0.65, 0.4, 0.15] },
  permit: { kind: { live: 1.7, fly: 1.3, jig: 1.2 }, wx: [1, 1, 0.7, 0.5, 0.2] },
  tarpon: { kind: { live: 1.6, swimbait: 1.3 }, dep: [0.3, 3] },
  snook: { kind: { live: 1.5, jig: 1.3, popper: 1.4 } },
  redfish: { kind: { cut: 1.5, live: 1.5, spoon: 1.3 } },
  yellowfin: { kind: { skirt: 2.2 }, dep: [0.3, 3] },
  bluefin: { kind: { skirt: 1.9, live: 1.6 }, time: [1, 1, 0.9, 0.5] },
  bluemarlin: { kind: { skirt: 2.4, live: 1.3 }, dep: [0.2, 2.5] },
  blackmarlin_r: { kind: { skirt: 2.4 }, dep: [0.2, 2.5] },
  sailfish: { kind: { skirt: 2.0, live: 1.7 }, dep: [0.2, 2] },
  mahi: { kind: { skirt: 1.9, live: 1.4 }, dep: [0.2, 2] },
  wahoo: { kind: { skirt: 2.2, spoon: 1.4 }, dep: [0.5, 3.5] },
  swordfish: { kind: { strip: 1.8, live: 1.4 } },
  halibut: { kind: { cut: 1.5, jig: 1.3, diamond: 1.3 } },
  pacifichalibut: { kind: { cut: 1.5, jig: 1.3, diamond: 1.3 } },
  cod: { kind: { jig: 1.5, cut: 1.4, diamond: 1.3 } },
  piranha: { kind: { cut: 1.9 } },
  gt: { kind: { popper: 1.7, diamond: 1.4 } },
  barramundi: { kind: { swimbait: 1.4, crank: 1.3, live: 1.4 } },
  tigerfish: { kind: { spinner: 1.5, spoon: 1.4, crank: 1.3 } },
  yellowtail: { kind: { diamond: 1.5, popper: 1.3, live: 1.4 } },
  atlsalmon: { kind: { fly: 1.6, spinner: 1.3 } },
};

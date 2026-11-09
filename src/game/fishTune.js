// Fish behaviour tuning: every number for visible fish, lure interest, spooking and bait balls.
// Lengths in metres, speeds in m/s (or body lengths per second, "BL"), times in seconds.
// Logic lives in fishLife.js / baitBalls.js; change feel here only.
export const TUNE = {
  enabled: true,
  maxActors: 10,            // simulated + drawn fish near the player (hard cap)
  simRadius: 80,            // fish farther than this from the player are recycled, not simulated

  // how far you can see a fish: clear water long, murky water short (waterLook.turbidity 0.02 .. 0.32)
  vis: { clear: 24, murky: 3.2, turbLo: 0.02, turbHi: 0.3, night: 0.5, fog: 0.65, rain: 0.85 },
  fadeFrac: 0.3,            // fish shrink away over the last 30% of the visibility range

  spawn: {
    interval: 0.35,         // seconds between spawn attempts
    ringMin: 6, ringFrac: 0.9,   // spawn ring: ringMin .. vis * ringFrac
    countClear: 8,          // wanted fish in the clearest water (scales with visibility)
    groupChance: 0.5,       // chance a schooling species spawns as a group
    groupMin: 3, groupMax: 5,
    minWater: 0.9,          // water depth needed under a fish (m)
    maxY: 8,                // deepest a free-swimming fish is placed (m)
    bottomDwellerMax: 9,    // bottom species only appear where the water is this shallow or less
    sizeSoft: 40,           // species weight / (1 + typicalLb / sizeSoft): big fish are rarer sights
    buildEvery: 0.4,        // at most one new fish model built per this many seconds (texture painting cost)
  },
  // bodies that travel in groups
  schooling: ['herring', 'mackerel', 'jack', 'tuna', 'bonefish', 'snapper', 'mahi', 'panfish', 'crappie', 'drum'],

  swim: {
    cruiseBL: 0.9,          // lazy cruise
    maxBL: 6,               // fastest sustained chase (cap in m/s below)
    strikeBL: 9,            // lunge at a lure
    capMs: 7,
    turn: 2.4,              // rad/s while cruising
    chaseTurn: 5,           // rad/s while following / striking
    accel: 2.5,             // speed smoothing (1/s)
    wander: [3, 8],         // seconds between course changes
    beat: 3.2,              // tail beat cycles/s at cruise; scaled up with speed
    amp: [0.03, 0.08],      // tail amplitude at rest / flat out (uSwim.y)
  },

  // interest in the lure
  interest: {
    base: 6.5,              // metres of notice range for a mid-size fish with a middling lure
    sizeLo: 0.55, sizeHi: 0.9,    // range multiplier = sizeLo + sizeHi * min(1, length)
    qLo: 0.35, qHi: 0.9,    // ...times qLo + qHi * match quality
    movingMul: 1.3, stillActive: 0.7, stillBait: 1.0,   // moving lure / still lure that should move / still bait
    fastMul: 0.5,           // lure ripping past faster than the fish can swim
    min: 1.5, max: 14,
    depthReach: 2.2,        // m above/below its comfort band the fish will still come to a lure
    noticePerSec: 0.9,      // notice chance per second inside the range, times (0.4 + quality)
    fitPoor: 0.03, fitGood: 0.3,   // bait.js fit.total mapped to quality 0..1
    fitRefresh: 0.6,
    followGap: [0.55, 1.5], // trailing distance behind the lure (long for shy fish, short for bold ones)
    followLimit: 9,         // gives up after this long without a verdict
    inspectAt: [1.2, 3.2],  // follow time before it commits to inspecting (bold+good .. shy+poor)
    inspect: [0.9, 2.2],    // inspect duration
    eager: 0.55,            // aggression x quality above this strikes without inspecting
    eagerPerSec: 1.1,
    restartBonus: 0.35,     // lure that starts moving while a fish inspects: extra take chance
    verdict: { base: 0.12, q: 0.85, aggr: 0.35 },    // chance to take (vs turn away) at the verdict
    mode: { strike: 0.62, tentative: 0.28 },         // quality above which the take is aggressive / tentative; below = half-hearted
    refuseCool: [10, 20],   // ignores the lure this long after turning away
    giveUpCool: [3, 6],
    nibbles: [1, 3],        // tentative takes: taps before the strike
    halfNibbles: [1, 3],    // half-hearted takes: taps then it spits the lure
    lungeTimeout: 1.3,
  },

  // spooking (shallow fish especially)
  spook: {
    boatNoise: 0.9,         // spook radius = boatNoise * boatSpeed (m/s) * (1 + planing) ...
    boatMin: 0.6,           // slower than this is quiet
    boatRadiusMax: 30,
    boatHullScale: 0.7,     // shadow radius = this * hull length (fish near the surface)
    walkerRadius: 6, walkerSpeed: 1.4,
    splashRadius: 200,      // spook radius = splashRadius * amp*size  (cast splash ~2.5 m, whale ~80 m)
    splashMax: 40,
    shadowDepth: 2.5,       // only fish shallower than this care about shadows
    alarm: 6,               // spooked fish alarm group-mates within this distance
    perSec: 2.5,            // chance/s inside a radius (they don't all bolt at once)
    time: [3, 6], recover: [5, 9],
    burstBL: 10, dive: 1.6, // flight speed and dive rate
    bold: 0.5,              // aggression reduces spook radius by up to this fraction
    fightRadius: 7,         // a thrashing hooked fish alarms fish this close
    castDist: 2.0,          // lure landing this close spooks (extra to splash size)
  },

  // bait balls, predators and boils
  balls: {
    count: 2, fish: 64, radius: 1.5, size: 1.0,
    spawnMin: 22, spawnMax: 70, minWater: 3.5, keep: 140,
    huntEvery: [16, 40],
    warn: 2.2,              // seconds of nervous water before the strike
    scatter: 1.4, regroup: 5,
    boilTime: 6, feedTime: 14,   // surface boil / hot spot lasts this long after the strike
    leapFrac: 0.2,
    visible: 60,            // instances drawn only inside this range
    hunterRange: 30,        // a real fish this close joins the hunt
    passRadius: 2.2,        // any predator crossing this close scatters the ball
    birdTime: 22,
    hotRadius: 28,          // bite-rate boost for a lure near a feeding boil (like a hotspot)
  },
  predatorDiet: 'mq',       // species with these diet letters are hunters of baitfish
  predatorMinLb: 1.5,
};

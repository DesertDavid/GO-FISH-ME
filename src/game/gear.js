// Tackle and boats. Rods: power = line class it's built for (lb), cast = max cast (m),
// sens = bite sensitivity (longer strike window), lift = how hard it tires a fish. model = real GLB in
// public/models/rods (rodModel.js, built by tools/blender/rod_mode.py); tiers without one use the procedural rod in rod.js.
export const RODS = {
  medium: { name: 'Starter Spinning Combo 6\'6"', model: 'kit', price: 0, power: 12, cast: 48, sens: 0.6, lift: 1, len: 1.98, color: 0x2a2f36 },
  ultralight: { name: 'Ultralight Spinning 5\'6"', price: 70, power: 6, cast: 36, sens: 0.95, lift: 0.8, len: 1.68, color: 0xd8c8a0 },
  flyrod: { name: '9\' 8-Weight Fly Rod', price: 420, power: 12, cast: 32, sens: 1, lift: 0.9, len: 2.74, color: 0x3a2a20, fly: true },
  mhcasting: { name: 'Medium-Heavy Casting 7\'', price: 190, power: 20, cast: 58, sens: 0.75, lift: 1.15, len: 2.13, color: 0x1a1a1a },
  flipping: { name: 'Heavy Flipping Stick 7\'6"', price: 260, power: 30, cast: 45, sens: 0.7, lift: 1.3, len: 2.29, color: 0x3a0a0a },
  inshore: { name: 'Inshore Spinning 7\'6"', price: 240, power: 25, cast: 62, sens: 0.8, lift: 1.2, len: 2.29, color: 0x0d3a5a },
  surf: { name: 'Surf Spinning 9\'', model: 'surf', price: 380, power: 40, cast: 78, sens: 0.65, lift: 1.3, len: 2.74, color: 0x2a4a2a },
  standup: { name: 'Offshore Conventional Stand-Up 5\'6"', model: 'standup', price: 650, power: 80, cast: 34, sens: 0.55, lift: 1.7, len: 1.68, color: 0xb0b8c0 },
  biggame: { name: '130-Class Big Game', price: 1900, power: 130, cast: 26, sens: 0.5, lift: 2.1, len: 1.83, color: 0xd0a030 },
};

// Reels: drag = max drag (lb), ratio = gear ratio (retrieve speed), cap = line capacity (m).
export const REELS = {
  spin2500: { name: 'Spinning 2500', price: 0, drag: 9, ratio: 5.2, cap: 180 },
  finesse1000: { name: 'Finesse Spinning 1000', price: 85, drag: 6, ratio: 6.2, cap: 140 },
  flyreel: { name: 'Large-Arbor Fly Reel', price: 260, drag: 12, ratio: 3.2, cap: 200 },
  baitcast73: { name: 'Baitcaster 7.3:1', price: 230, drag: 15, ratio: 7.3, cap: 150 },
  spin4000: { name: 'Spinning 4000', price: 190, drag: 20, ratio: 5.8, cap: 230 },
  spin8000: { name: 'Saltwater Spinning 8000', price: 460, drag: 35, ratio: 5.6, cap: 320 },
  conv30: { name: 'Conventional 30', price: 720, drag: 40, ratio: 6.2, cap: 520 },
  twospeed50: { name: 'Two-Speed 50W', price: 1250, drag: 60, ratio: 6.0, cap: 720 },
  biggame80: { name: 'Big Game 80W', price: 2600, drag: 95, ratio: 4.1, cap: 950 },
};

// Line: test = breaking strength (lb). stretch softens shock spikes; braid helps sensitivity.
export const LINES = {
  mono8: { name: '8 lb Monofilament', price: 0, test: 8, stretch: 0.18, braid: false, color: 0xe8f0f0 },
  mono12: { name: '12 lb Monofilament', price: 12, test: 12, stretch: 0.18, braid: false, color: 0xe8f0f0 },
  fluoro15: { name: '15 lb Fluorocarbon', price: 28, test: 15, stretch: 0.12, braid: false, color: 0xd8f0f8 },
  braid30: { name: '30 lb Braid', price: 45, test: 30, stretch: 0.03, braid: true, color: 0x48a848 },
  braid50: { name: '50 lb Braid', price: 70, test: 50, stretch: 0.03, braid: true, color: 0xe8e840 },
  mono80: { name: '80 lb Monofilament', price: 95, test: 80, stretch: 0.2, braid: false, color: 0x60c8e8 },
  mono130: { name: '130 lb Monofilament', price: 160, test: 130, stretch: 0.2, braid: false, color: 0xe8a040 },
  braid200: { name: '200 lb Braid', price: 240, test: 200, stretch: 0.03, braid: true, color: 0xe85030 },
};

// Lures/bait: diet letters must match the fish (see species.js), depth s/m/b,
// active = must be retrieved or trolled to get bites. size biases toward bigger fish.
export const LURES = {
  nightcrawler: { name: 'Nightcrawler (bobber)', price: 0, diet: 'w', depth: 'm', active: false, bobber: true, color: 0xb05a50 },
  minnow: { name: 'Live Minnow', price: 15, diet: 'm', depth: 'm', active: false, bobber: true, color: 0xc0c8c8 },
  shrimp: { name: 'Live Shrimp', price: 20, diet: 'c', depth: 'm', active: false, bobber: true, color: 0xe8b0a0, salt: true },
  cutbait: { name: 'Cut Bait (bottom rig)', price: 15, diet: 'b', depth: 'b', active: false, color: 0x8a3030 },
  dough: { name: 'Dough Ball / Corn', price: 10, diet: 'p', depth: 'b', active: false, color: 0xf0d040 },
  squid: { name: 'Squid Strip', price: 25, diet: 'q', depth: 'm', active: false, color: 0xf0e0e8, salt: true },
  crank: { name: 'Crankbait', price: 30, diet: 'm', depth: 'm', active: true, color: 0xe86020 },
  spinner: { name: 'Spinnerbait', price: 25, diet: 'mi', depth: 'm', active: true, color: 0xf0f040 },
  plasticworm: { name: 'Texas-rigged Worm', price: 15, diet: 'w', depth: 'b', active: true, color: 0x4a1a6a },
  popper: { name: 'Topwater Popper', price: 30, diet: 'mi', depth: 's', active: true, color: 0x40c040 },
  jig: { name: 'Football Jig', price: 20, diet: 'cm', depth: 'b', active: true, color: 0x6a4a20 },
  spoon: { name: 'Casting Spoon', price: 25, diet: 'm', depth: 'm', active: true, color: 0xd0d8e0 },
  dryfly: { name: 'Dry Fly', price: 20, diet: 'i', depth: 's', active: true, color: 0xc89060, fly: true },
  bucktail: { name: 'Bucktail Jig', price: 30, diet: 'mc', depth: 'b', active: true, color: 0xf8f8f0, salt: true },
  swimbait: { name: 'Big Swimbait', price: 45, diet: 'm', depth: 'm', active: true, size: 1.15, color: 0x8aa0b0 },
  diamondjig: { name: 'Diamond Jig', price: 50, diet: 'mq', depth: 'b', active: true, size: 1.1, color: 0xe0e8f0, salt: true },
  livebait: { name: 'Live Mullet / Ballyhoo', price: 60, diet: 'm', depth: 'm', active: false, size: 1.2, color: 0x9aa8b0, salt: true },
  trollskirt: { name: 'Trolling Skirt', price: 90, diet: 'qm', depth: 's', active: true, size: 1.25, color: 0xe040a0, salt: true },
};

// Boats: model = GLB in public/models/boats. waters it can reach, top speed (m/s),
// eye = where you stand (x along the boat, +x bow). net: null | 'trawl' | 'seine'.
export const BOATS = {
  jon: { name: '12\' Jon Boat', price: 0, waters: ['lake', 'river', 'inshore'], speed: 7, accel: 2.2, turn: 1.1, eye: -0.9, net: null, blurb: 'Flat-bottom aluminum with a tiller outboard. Ponds, lakes, rivers.' },
  bass: { name: '20\' Bass Boat', price: 3500, waters: ['lake', 'river'], speed: 24, accel: 5, turn: 0.75, eye: 2.0, net: null, blurb: 'Metal-flake glitter, 250 hp, casting decks. Fast on any lake or river.' },
  skiff: { name: '18\' Flats Skiff', price: 5000, waters: ['lake', 'river', 'inshore'], speed: 15, accel: 3.5, turn: 0.85, eye: 1.6, net: null, blurb: 'Poling platform and shallow draft for the flats.' },
  center: { name: '28\' Center Console', price: 15000, waters: ['lake', 'river', 'inshore', 'offshore'], speed: 21, accel: 4, turn: 0.6, eye: -2.6, face: Math.PI / 2, net: null, blurb: 'Twin outboards and a T-top. Goes anywhere, including blue water.' },
  sport: { name: '45\' Sportfisher', price: 60000, waters: ['inshore', 'offshore'], speed: 16, accel: 2.4, turn: 0.38, eye: -4.6, face: Math.PI, net: null, bigGame: 1.25, blurb: 'Flybridge, outriggers, fighting chair. Built for marlin and giant tuna.' },
  trawler: { name: '65\' Stern Trawler', price: 30000, waters: ['inshore', 'offshore'], speed: 6, accel: 0.9, turn: 0.22, eye: -3.0, eyeUp: 0.5, face: Math.PI, net: 'trawl', netCap: 6000, blurb: 'Commercial trawl net and drum. Drag the net through schools at 2-4 knots.' },
  seiner: { name: '85\' Purse Seiner', price: 85000, waters: ['offshore'], speed: 7, accel: 0.8, turn: 0.2, eye: 0.5, eyeUp: 0.8, face: Math.PI / 2, net: 'seine', netCap: 25000, blurb: 'Encircles whole schools with a purse seine. Biggest hauls in the game.' },
};

export const BOAT_ORDER = ['jon', 'bass', 'skiff', 'center', 'sport', 'trawler', 'seiner'];

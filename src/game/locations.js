import { fbm, ridged } from '../scene/noise.js';
import { tropicalIsland } from '../scene/tropicalIsland.js';

// Fishing locations based on real places. Each has its own heightfield (y = 0 is the water
// line), water optics, waves, sky, scenery and fish. Heights in metres.
const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Water colour presets (per-channel absorption 1/m, deep scatter colour, thin-foam tint, underwater haze)
const WATER = {
  murkyGreen: { absorption: [0.75, 0.32, 0.95], scatter: [0.025, 0.05, 0.022], foam: [0.75, 0.78, 0.6], turbidity: 0.18 },
  tea: { absorption: [0.6, 0.28, 0.42], scatter: [0.02, 0.035, 0.03], foam: [0.78, 0.76, 0.66], turbidity: 0.08 },
  alpine: { absorption: [0.42, 0.045, 0.022], scatter: [0.0, 0.04, 0.09], foam: [0.66, 0.8, 0.86], turbidity: 0.02 },
  river: { absorption: [0.5, 0.13, 0.22], scatter: [0.012, 0.05, 0.042], foam: [0.72, 0.8, 0.76], turbidity: 0.07 },
  amazon: { absorption: [0.55, 0.7, 1.1], scatter: [0.06, 0.045, 0.02], foam: [0.82, 0.74, 0.58], turbidity: 0.3 },
  tropical: { absorption: [0.36, 0.045, 0.06], scatter: [0.0, 0.085, 0.085], foam: [0.66, 0.86, 0.84], turbidity: 0.02 },
  deepBlue: { absorption: [0.45, 0.06, 0.028], scatter: [0.0, 0.028, 0.075], foam: [0.66, 0.78, 0.86], turbidity: 0.025 },
  northSea: { absorption: [0.62, 0.15, 0.12], scatter: [0.004, 0.02, 0.028], foam: [0.72, 0.78, 0.8], turbidity: 0.06 },
};

const base = {
  size: 3000, wind: 6, windDir: 20, fetch: 30, waveScale: 1, swell: 0, swellDir: -15, chop: 0.85,
  shoreWave: 0, sky: { turbidity: 2.5, clouds: 0.4 }, fog: 1 / 14000, current: [0, 0], heroRock: false,
  trees: [], hotspots: 6, birds: true,
};

export const LOCATIONS = {
  okeechobee: {
    ...base, id: 'okeechobee', name: 'Lake Okeechobee', region: 'Florida, USA', water: 'lake', price: 0,
    blurb: 'Big shallow lake. Bass and panfish in the grass, gators optional.',
    wind: 4, fetch: 8, waveScale: 0.55, waterLook: WATER.murkyGreen, sky: { turbidity: 3.2, clouds: 0.45 },
    trees: [['cypress', 900, 0.4, 6], ['palm', 260, 0.6, 5], ['reed', 2600, -0.4, 0.9]],
    height(x, z) {
      const n = fbm(x * 0.008 + 2, z * 0.008 - 5, 3, 5);
      const coast = -(x * 0.8 + z * 0.6) - 700 + 160 * fbm(x * 0.002, z * 0.002, 3, 2);
      let h = -3.0 - 1.4 * (0.5 + fbm(x * 0.01, z * 0.01, 3, 9));
      const island = sm(0.28, 0.4, n) * sm(140, 260, Math.hypot(x, z));
      h = h + (0.6 + (n - 0.28) * 5 - h) * island;
      const land = sm(-40, 60, coast);
      return h + (0.8 + coast * 0.004 + 1.2 * fbm(x * 0.02, z * 0.02, 3, 4) - h) * land;
    },
    pool: { largemouth: 30, bluegill: 22, redear: 10, blackcrappie: 10, channelcat: 8, bluecat: 3, flathead: 2, bowfin: 5, longnosegar: 4, tilapia: 6, pickerel: 3, pumpkinseed: 5, spotted: 2, carp: 2, alligatorgar: 0.5 },
    net: null,
  },
  woods: {
    ...base, id: 'woods', name: 'Lake of the Woods', region: 'Minnesota / Ontario', water: 'lake', price: 1500,
    blurb: '14,000 rocky islands. Walleye capital, with pike and muskie lurking.',
    wind: 6, fetch: 10, waveScale: 0.6, waterLook: WATER.tea, sky: { turbidity: 2, clouds: 0.5 },
    trees: [['pine', 9000, 1.2, 30], ['birch', 2200, 1.2, 25]],
    height(x, z) {
      const r = Math.hypot(x, z);
      let n = fbm(x * 0.0045 + 3, z * 0.0045 - 7, 5, 11) + 0.25 * fbm(x * 0.015, z * 0.015, 3, 3);
      n -= 0.45 * Math.exp(-((r / 240) ** 2));
      if (n < 0.08) return -1.2 - 15 * sm(0.07, -0.3, n);
      return 0.4 + Math.min(14, (n - 0.08) * 70) + 3 * ridged(x * 0.02, z * 0.02, 3, 6) * sm(0.1, 0.25, n);
    },
    pool: { walleye: 25, pike: 18, smallmouth: 14, yellowperch: 18, muskie: 3, blackcrappie: 7, lakesturgeon: 2, whitefish: 6, burbot: 3, laketrout: 2 },
    net: null,
  },
  tahoe: {
    ...base, id: 'tahoe', name: 'Lake Tahoe', region: 'California / Nevada', water: 'lake', price: 3000, size: 4400,
    blurb: 'Gin-clear alpine water 500 m deep, ringed by the Sierra Nevada.',
    wind: 5, fetch: 20, waveScale: 0.6, waterLook: WATER.alpine, sky: { turbidity: 1.6, clouds: 0.3 }, fog: 1 / 22000, snowLine: 260, rockLine: 140, rockTint: [0.9, 0.85, 0.8],
    trees: [['pine', 3600, 2, 180]],
    height(x, z) {
      const w = fbm(x * 0.0012, z * 0.0012, 3, 4);
      const R = 1350 * (1 + 0.18 * w);
      const r = Math.hypot(x, z * 1.25);
      if (r < R) return -6 - 100 * sm(R * 0.98, R * 0.7, r) + 4 * fbm(x * 0.02, z * 0.02, 2, 1);
      const m = sm(R + 60, R + 1000, r);
      return 0.5 + (r - R) * 0.12 + m * 520 * (0.55 + 0.7 * ridged(x * 0.0022, z * 0.0022, 5, 9));
    },
    pool: { laketrout: 25, rainbow: 20, brown: 15, kokanee: 20, cutthroat: 6, smallmouth: 8, whitefish: 6 },
    net: null,
  },
  columbia: {
    ...base, id: 'columbia', name: 'Columbia River Gorge', region: 'Oregon / Washington', water: 'river', price: 4000, size: 3600,
    blurb: 'Salmon and steelhead runs, and white sturgeon bigger than your boat.',
    wind: 7, windDir: 90, fetch: 15, waveScale: 0.55, waterLook: WATER.river, current: [0, 0.6], sky: { turbidity: 2.4, clouds: 0.55 }, rockLine: 300, rockTint: [0.5, 0.45, 0.42],
    trees: [['pine', 8000, 3, 320], ['birch', 2200, 1.5, 120]],
    height(x, z) {
      const cx = 140 * Math.sin(z * 0.0017) + 40 * fbm(z * 0.004, 1, 2, 3);
      const d = Math.abs(x - cx), W = 270;
      if (d < W) return -1 - 15 * (1 - (d / W) ** 2) + 1.5 * fbm(x * 0.03, z * 0.03, 2, 2);
      return (d - W) * 0.1 + 260 * sm(W + 120, W + 650, d) * (0.6 + 0.6 * ridged(x * 0.003, z * 0.003, 5, 2));
    },
    pool: { chinook: 18, coho: 12, steelhead: 14, whitesturgeon: 6, shad: 14, walleye: 10, smallmouth: 12, channelcat: 4, sockeye: 6 },
    net: null,
  },
  amazon: {
    ...base, id: 'amazon', name: 'Amazon River', region: 'Amazonas, Brazil', water: 'river', price: 9000, size: 3600,
    blurb: 'Peacock bass, piranha, and the air-breathing giant arapaima.',
    wind: 3, fetch: 6, waveScale: 0.45, waterLook: WATER.amazon, current: [0, 0.35], sky: { turbidity: 4.5, clouds: 0.6 }, fog: 1 / 9000,
    trees: [['jungle', 16000, 1.2, 14], ['palm', 1800, 1.2, 10]],
    height(x, z) {
      const cx = 220 * Math.sin(z * 0.0011);
      const d = Math.abs(x - cx), W = 430;
      if (d < W) return -1 - 11 * (1 - (d / W) ** 2);
      return 1.2 + (d - W) * 0.012 + 2.2 * fbm(x * 0.01, z * 0.01, 3, 5);
    },
    pool: { peacock: 22, piranha: 22, pacu: 8, payara: 6, redtail: 8, piraiba: 2, arowana: 10, arapaima: 4, trairao: 10 },
    net: null,
  },
  keys: {
    ...base, id: 'keys', name: 'Florida Keys Flats', region: 'Florida, USA', water: 'inshore', price: 6000,
    blurb: 'Turquoise flats and mangroves: bonefish, permit and silver-king tarpon.',
    wind: 7, fetch: 40, waveScale: 0.5, swell: 0.15, waterLook: WATER.tropical, shoreWave: 0.12, sky: { turbidity: 2.2, clouds: 0.35 },
    trees: [['mangrove', 2400, 0.3, 2.5], ['palm', 500, 0.6, 3]],
    height(x, z) {
      let h = -1.3 + 0.7 * fbm(x * 0.01, z * 0.01, 3, 2);
      const ch = Math.abs(fbm(x * 0.0025, z * 0.0025, 3, 4));
      h -= 4.5 * sm(0.07, 0.0, ch);
      const m = fbm(x * 0.004 + 9, z * 0.004, 4, 8);
      const isl = sm(0.2, 0.3, m) * sm(150, 300, Math.hypot(x, z));
      return h + (0.5 + (m - 0.2) * 8 - h) * isl;
    },
    pool: { bonefish: 14, tarpon: 8, permit: 5, redfish: 12, snook: 10, seatrout: 12, barracuda: 10, crevalle: 8, mangrovesnapper: 10, muttonsnapper: 4, sheepshead: 6, lemonshark: 3, blacktip: 3, nurseshark: 2, cobia: 2, flounder: 4 },
    net: { menhaden: 50, sardine: 25, anchovy: 20, mangrovesnapper: 3, seatrout: 2 },
  },
  gulf: {
    ...base, id: 'gulf', name: 'Gulf of Mexico Offshore', region: '60 mi south of Louisiana', water: 'offshore', price: 15000,
    blurb: 'Blue water around the oil rigs: tuna, mahi, wahoo and blue marlin.',
    wind: 8, fetch: 300, swell: 0.5, waterLook: WATER.deepBlue, sky: { turbidity: 2.2, clouds: 0.35 }, fog: 1 / 30000, rig: true,
    height: () => -300,
    pool: { yellowfin: 12, blackfin: 12, mahi: 16, wahoo: 7, kingmackerel: 12, redsnapper: 12, amberjack: 8, gag: 6, redgrouper: 6, sailfish: 4, bluemarlin: 1.5, whitemarlin: 2, swordfish: 1.5, mako: 1.5, hammerhead: 1, tigershark: 1, skipjack: 10, cobia: 4, goliath: 1, bluefin: 0.4 },
    net: { menhaden: 45, sardine: 20, anchovy: 20, skipjack: 8, redsnapper: 4, kingmackerel: 3 },
  },
  reef: {
    ...base, id: 'reef', name: 'Great Barrier Reef', region: 'Queensland, Australia', water: 'offshore', price: 20000, size: 2400,
    blurb: 'Coral cays and reef edges: coral trout, giant trevally and black marlin.',
    wind: 8, fetch: 120, swell: 0.5, waterLook: WATER.tropical, shoreWave: 0.6, heroRock: true, sky: { turbidity: 2, clouds: 0.38 },
    trees: [['palm', 700, 1.5, 40]],
    height: tropicalIsland,
    start: { x: 520, z: -420, yaw: 2.4 },
    pool: { coraltrout: 14, gt: 8, redemperor: 10, sweetlips: 10, barramundi: 6, mangrovejack: 8, queenfish: 8, dogtooth: 3, parrotfish: 10, spangled: 10, spanishmackerel: 8, blackmarlin_r: 1.5, blacktip: 4, tigershark: 1, mahi: 4 },
    net: { sardine: 50, anchovy: 35, spanishmackerel: 5, queenfish: 5 },
  },
  fjord: {
    ...base, id: 'fjord', name: 'Lofoten Fjords', region: 'Nordland, Norway', water: 'offshore', price: 12000, size: 4400,
    blurb: 'Cold, deep fjords under granite walls: cod, halibut and saithe.',
    wind: 8, windDir: 0, fetch: 40, swell: 0.3, waterLook: WATER.northSea, sky: { turbidity: 2.8, clouds: 0.72 }, fog: 1 / 11000, snowLine: 320, rockLine: 70, rockTint: [0.75, 0.75, 0.78],
    trees: [['pine', 900, 2, 120], ['cabin', 40, 1.5, 6]],
    height(x, z) {
      const cz = 160 * Math.sin(x * 0.0011);
      const d = Math.abs(z - cz), W = 330;
      if (d < W) return -6 - 80 * (1 - (d / W) ** 1.6);
      return (d - W) * 0.9 + 560 * sm(W + 40, W + 600, d) * (0.55 + 0.75 * ridged(x * 0.0025, z * 0.0025, 5, 13));
    },
    pool: { cod: 28, saithe: 20, haddock: 14, halibut: 4, ling: 8, wolffish: 6, atlsalmon: 5, mackerel: 14, monkfish: 4, porbeagle: 1, goldenredfish: 6 },
    net: { herring: 40, mackerel: 25, cod: 15, saithe: 10, haddock: 10, capelin: 15 },
  },
  bering: {
    ...base, id: 'bering', name: 'Bering Sea', region: 'Off Dutch Harbor, Alaska', water: 'offshore', price: 25000,
    blurb: 'Big seas, cold spray and the richest fishing grounds on Earth.',
    wind: 12, fetch: 600, swell: 1.2, swellDir: 40, chop: 1, waterLook: WATER.northSea, sky: { turbidity: 3.5, clouds: 0.88 }, fog: 1 / 8000,
    height: () => -200,
    pool: { pacificcod: 25, pacifichalibut: 12, sablefish: 10, chum: 10, alaskapollock: 20, chinook: 6, coho: 6, pacificherring: 6 },
    net: { alaskapollock: 40, pacificherring: 25, pacificcod: 15, capelin: 15, sablefish: 5, chum: 5 },
  },
};

export const LOCATION_ORDER = ['okeechobee', 'woods', 'tahoe', 'columbia', 'keys', 'amazon', 'fjord', 'gulf', 'reef', 'bering'];

// A start point in open water near the origin (spiral search).
export function findStart(loc) {
  if (loc.start) return loc.start;
  for (let r = 0; r < 1200; r += 15) {
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (loc.height(x, z) < -2.5 && loc.height(x + 20, z) < -2 && loc.height(x - 20, z) < -2 && loc.height(x, z + 20) < -2 && loc.height(x, z - 20) < -2) {
        return { x, z, yaw: 0 };
      }
    }
  }
  return { x: 0, z: 0, yaw: 0 };
}

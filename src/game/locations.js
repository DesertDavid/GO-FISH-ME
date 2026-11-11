import { fbm, ridged } from '../scene/noise.js';
import { tropicalIsland } from '../scene/tropicalIsland.js';
import { BBG, BBD } from './bigbearData.js';

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
  brackish: { absorption: [0.7, 0.3, 0.72], scatter: [0.03, 0.05, 0.032], foam: [0.76, 0.78, 0.68], turbidity: 0.22 },
  bigbear: { absorption: [0.5, 0.1, 0.16], scatter: [0.004, 0.044, 0.04], foam: [0.72, 0.8, 0.8], turbidity: 0.06 },
  kariba: { absorption: [0.6, 0.25, 0.48], scatter: [0.016, 0.04, 0.034], foam: [0.76, 0.8, 0.72], turbidity: 0.1 },
  mekong: { absorption: [0.5, 0.62, 0.95], scatter: [0.07, 0.055, 0.03], foam: [0.82, 0.76, 0.62], turbidity: 0.32 },
  pacific: { absorption: [0.45, 0.055, 0.03], scatter: [0.0, 0.034, 0.07], foam: [0.68, 0.8, 0.86], turbidity: 0.025 },
};

const base = {
  size: 3000, wind: 6, windDir: 20, fetch: 30, waveScale: 1, swell: 0, swellDir: -15, chop: 0.85,
  shoreWave: 0, sky: { turbidity: 2.5, clouds: 0.4 }, fog: 1 / 14000, current: [0, 0], heroRock: false,
  trees: [], hotspots: 6, birds: true,
};

// north = -z, east = +x. Landings sit on the rim; islands are marsh/grass patches inside it.
const OKEE_LANDINGS = [
  { name: 'Clewiston', x: -250, z: 1015 }, { name: 'Pahokee', x: 880, z: 520 }, { name: 'Moore Haven', x: -930, z: 520 },
  { name: 'Port Mayaca', x: 960, z: -380 }, { name: 'Buckhead Ridge', x: -740, z: -760 }, { name: 'Canal Point', x: 1020, z: 120 }, { name: 'Okeechobee', x: 40, z: -1040 },
];
const OKEE_ISLANDS = [[-440, -430, 150], [230, -740, 120], [-340, 470, 150], [640, 560, 120], [150, 850, 140]];   // Horse, Hog, Observation, Kreamer, Ritta
const OKEE_ROUTE = [[960, -330], [1000, 200], [820, 560], [520, 790], [100, 930], [-250, 960]];   // Okeechobee Waterway, Port Mayaca to Clewiston
const OKEE_KISS = [[260, -1090], [190, -900], [150, -760]];   // the Kissimmee River's mouth
const segDist = (px, pz, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t); };
const pathDist = (x, z, P) => { let m = 1e9; for (let i = 0; i < P.length - 1; i++) m = Math.min(m, segDist(x, z, P[i], P[i + 1])); return m; };

// ---- Big Bear Lake ------------------------------------------------------------------------
// Built from real data (see docs/big-bear-research.md): the shoreline is the OpenStreetMap outline
// (traced from aerial imagery), the lake bed is the BBMWD multibeam hydrographic survey read off
// its colour chart and fitted onto that outline, the land is a 30 m SRTM elevation grid sampled
// every 200 m. Everything is drawn at 0.4 of real size in x and z (the lake is ~4.1 km long here,
// 10.2 km in life) with real depths and 0.8 of real relief. x east, z south (north = -z), the dam
// at the west end (x = -2040); the map centre is the middle of the lake's bounding box.
const BB_LANDINGS = [
  { name: 'Pine Knot Marina', x: 390, z: 300 }, { name: "Holloway's Marina", x: 190, z: 405 }, { name: 'Fawnskin (Grout Bay)', x: -755, z: -454 },
  { name: 'West Public Ramp', x: -1087, z: -191 }, { name: 'East Public Ramp', x: 1226, z: -366 }, { name: 'Boulder Bay', x: -1170, z: 568 },
  { name: 'Metcalf Bay', x: -612, z: 356 }, { name: "Gray's Landing", x: -1440, z: 70 },
];
const BB_ISLAND = { x: -1818, z: 478, r: 10, h: 4.5 };   // Garstin ("Treasure" / "China") Island, by the dam
let bbSdf = null;
function bbInit() {
  if (bbSdf) return;
  const { nx, nz, sd, cell } = BBG, INF = 1e9, d = new Float32Array(nx * nz);
  for (let i = 0; i < d.length; i++) d[i] = sd[i] <= 0 ? 0 : INF;
  const D1 = cell, D2 = cell * 1.4142;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let v = d[j * nx + i];
    if (i > 0) v = Math.min(v, d[j * nx + i - 1] + D1);
    if (j > 0) { v = Math.min(v, d[(j - 1) * nx + i] + D1); if (i > 0) v = Math.min(v, d[(j - 1) * nx + i - 1] + D2); if (i < nx - 1) v = Math.min(v, d[(j - 1) * nx + i + 1] + D2); }
    d[j * nx + i] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    let v = d[j * nx + i];
    if (i < nx - 1) v = Math.min(v, d[j * nx + i + 1] + D1);
    if (j < nz - 1) { v = Math.min(v, d[(j + 1) * nx + i] + D1); if (i < nx - 1) v = Math.min(v, d[(j + 1) * nx + i + 1] + D2); if (i > 0) v = Math.min(v, d[(j + 1) * nx + i - 1] + D2); }
    d[j * nx + i] = v;
  }
  bbSdf = d;
}
function bbBil(F, nx, nz, gx, gz) {
  const i = Math.max(0, Math.min(nx - 2, Math.floor(gx))), j = Math.max(0, Math.min(nz - 2, Math.floor(gz))), u = Math.max(0, Math.min(1, gx - i)), v = Math.max(0, Math.min(1, gz - j));
  const a = F[j * nx + i], b = F[j * nx + i + 1], c = F[(j + 1) * nx + i], e = F[(j + 1) * nx + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
}
function bbHeight(x, z) {
  bbInit();
  const { nx, nz, x0, z0, cell, q, sd } = BBG;
  const gx = (x - x0) / cell, gz = (z - z0) / cell;
  const cx = Math.max(0, Math.min(nx - 1.001, gx)), cz = Math.max(0, Math.min(nz - 1.001, gz));
  const out = Math.hypot(gx - cx, gz - cz) * cell;
  // signed distance to the real shoreline (+ land, - water): exact inside +-127 m, the coarse chamfer beyond
  let sdv = bbBil(sd, nx, nz, cx, cz);
  if (sdv > 120) sdv = Math.max(sdv, bbBil(bbSdf, nx, nz, cx, cz));
  sdv += out;
  const dsh = sdv;
  // the lake bed: the survey depth, easing up to the waterline over the first few metres
  let h = 0;
  if (sdv < 0) {
    const d = Math.min(bbBil(q, nx, nz, cx, cz) * 0.1, 0.5 * -sdv);
    h = -d;
    if (d > 0.6) h += 0.1 * Math.sin(x * 0.07) * Math.sin(z * 0.06) * Math.min(1, d / 3);   // faint ripple so the bed is not a plane
  }
  if (dsh >= 0) {
    // land: a short beach, then the real relief (SRTM) the further from the water
    const E = BBD.n, gxd = x / BBD.step + 30, gzd = z / BBD.step + 30;
    const dem = Math.max(0, bbBil(BBD.e, E, E, Math.max(0, Math.min(E - 1.001, gxd)), Math.max(0, Math.min(E - 1.001, gzd)))) * 0.8;
    const b = 0.1 + 0.05 * Math.min(dsh, 36);
    h = b + Math.max(0, dem - b) * sm(14, 110, dsh);
    h += (0.8 + 0.035 * h) * fbm(x * 0.021, z * 0.021, 3, 7) * sm(15, 90, dsh) + 0.05 * h * ridged(x * 0.006, z * 0.006, 4, 21) * sm(60, 400, dsh);
    // the valley closes beyond the map's ends
    h += sm(2120, 2380, Math.abs(x)) * (110 + 90 * ridged(x * 0.002 + 5, z * 0.002, 4, 11)) + sm(2150, 2390, Math.abs(z)) * 90;
    // Garstin Island: the little granite knoll left when the dam was raised
    const di = Math.hypot(x - BB_ISLAND.x, z - BB_ISLAND.z);
    if (di < BB_ISLAND.r * 2) h = Math.max(h, BB_ISLAND.h * Math.max(0, 1 - (di / (BB_ISLAND.r * 1.5)) ** 2) * (0.85 + 0.3 * fbm(x * 0.2, z * 0.2, 2, 9)) - 0.0);
  } else {
    const di = Math.hypot(x - BB_ISLAND.x, z - BB_ISLAND.z);
    if (di < BB_ISLAND.r * 1.6) h = Math.max(h, BB_ISLAND.h * Math.max(0, 1 - (di / (BB_ISLAND.r * 1.5)) ** 2) - 0.6);
  }
  return h;
}

export const LOCATIONS = {
  okeechobee: {
    ...base, id: 'okeechobee', name: 'Lake Okeechobee', region: 'Florida, USA', water: 'lake', price: 0,
    blurb: 'Big shallow lake. Bass and panfish in the grass, gators optional.',
    wind: 4, fetch: 8, waveScale: 0.55, waterLook: WATER.murkyGreen, sky: { turbidity: 3.2, clouds: 0.45 },
    marsh: true,
    // low flats of tall water grass (about 0.2-0.8 m up) with ragged edges, open water and winding
    // boat trails between them, a continuous marsh blanket toward the far shore, and the trees
    // only on a few hammocks and along the far tree line
    trees: [['cypress', 360, 1.25, 7], ['palm', 140, 1.15, 6], ['sawgrass', 80000, -0.35, 1.0, 1150], ['bulrush', 6000, -0.9, 0.7, 1150], ['lily', 9000, -1.5, -0.4, 1150]],
    landings: OKEE_LANDINGS,
    height(x, z) {
      const mix = (a, b, t) => a + (b - a) * t;

      const r = Math.hypot(x, z), th = Math.atan2(z, x);
      const Rth = 1040 + 70 * Math.sin(2 * th + 0.6) + 45 * Math.sin(3 * th + 2.0) + 60 * fbm(Math.cos(th) * 1.5 + 4, Math.sin(th) * 1.5 - 2, 3, 71);
      const d = r - Rth;
      const west = Math.max(0, Math.cos(th + 2.6)), south = Math.max(0, Math.cos(th - 1.45));
      const W = 90 + 330 * Math.pow(west, 1.3) + 160 * south * south;   // width of the littoral marsh
      let lc = 0; for (const L of OKEE_LANDINGS) lc = Math.max(lc, sm(190, 70, Math.hypot(x - L.x, z - L.z)));
      const lake0 = -2.6 - 1.1 * (0.5 + fbm(x * 0.01, z * 0.01, 3, 9));
      const lake = mix(lake0, -1.2, sm(-240, -10, d) * (1 - lc));
      const dd = fbm(x * 0.035 + 7, z * 0.035 - 3, 3, 11);
      let e = fbm(x * 0.0042 + 2, z * 0.0042 - 5, 4, 5) + 0.16 * dd + 0.05 * fbm(x * 0.12, z * 0.12, 2, 19);
      e += 0.38 * sm(-W - 120, -W * 0.5, d) - 0.37;
      for (const [cx, cz, rad] of OKEE_ISLANDS) e += 0.6 * Math.exp(-(((x - cx) ** 2 + (z - cz) ** 2) / (rad * rad)));
      const THR = 0.05, clear = sm(110, 430, r);
      const isl = sm(THR - 0.02, THR + 0.05, e) * clear * (1 - lc);
      const shelf = sm(THR - 0.2, THR, e) * clear * (1 - lc);
      const tr = Math.abs(fbm(x * 0.0058 - 3, z * 0.0058 + 8, 3, 23)), tr2 = Math.abs(fbm(x * 0.011 + 5, z * 0.011 - 9, 3, 29));
      const trail = Math.max(1 - sm(0.016, 0.05, tr), (1 - sm(0.012, 0.036, tr2)) * 0.9);
      let h = mix(lake, -1.0 + 0.25 * dd, shelf);
      h = mix(h, 0.38 + 0.4 * dd, isl);
      h = mix(h, -0.9, sm(0.5, 0.62, fbm(x * 0.028 + 50, z * 0.028 + 20, 3, 37)) * isl);
      h += 0.9 * sm(0.30, 0.42, fbm(x * 0.007 + 40, z * 0.007 - 11, 3, 61)) * isl;
      h = mix(h, -1.8 + 0.3 * dd, trail * sm(0.05, 0.4, shelf));
      // the Okeechobee Waterway and the Kissimmee's mouth: dredged channels through the grass
      const wd = pathDist(x, z, OKEE_ROUTE), kd = pathDist(x, z, OKEE_KISS);
      h = Math.min(h, mix(h, -3.0, 1 - sm(14, 34, wd)) , mix(h, -2.4, 1 - sm(10, 26, kd)));
      // rim: marsh margin, the rim canal, the levee, then flat farmland
      const landA = sm(-25 + 17 * lc, 40 - 26 * lc, d);
      if (landA > 0) {
        let m = 0.4 + 0.45 * dd;
        m = mix(m, -0.9, sm(0.42, 0.55, fbm(x * 0.02 + 90, z * 0.02 - 30, 3, 41)) * (1 - sm(60, 130, d)) * (1 - lc));
        m = mix(m, -1.7, Math.max(1 - sm(0.016, 0.05, tr), 1 - sm(0.012, 0.036, tr2)) * (1 - sm(60, 120, d)) * sm(0, 30, d) * (1 - lc));
        m = mix(m, -2.4, 1 - sm(10, 24, Math.abs(d - 128)));                          // rim canal
        m += 3.3 * Math.exp(-(((d - 215) / 40) ** 2));                               // levee
        m += sm(250, 340, d) * (1.6 + 0.5 * fbm(x * 0.01, z * 0.01, 3, 4));         // farmland behind
        m = Math.max(m, mix(0.4, 0.9, lc) * (1 - sm(40, 100, d)) * lc + m * (1 - lc));  // firm banks at the landings
        h = mix(h, m, landA);
      }
      return h;
    },
    pool: { largemouth: 30, bluegill: 22, redear: 10, blackcrappie: 10, channelcat: 8, bluecat: 3, flathead: 2, bowfin: 5, longnosegar: 4, tilapia: 6, pickerel: 3, pumpkinseed: 5, spotted: 2, carp: 2, alligatorgar: 0.5, warmouth: 5, floridagar: 5, oscar: 3, americaneel: 1.5 },
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
    pool: { walleye: 25, pike: 18, smallmouth: 14, yellowperch: 18, muskie: 3, blackcrappie: 7, lakesturgeon: 2, whitefish: 6, burbot: 3, laketrout: 2, redhorse: 6, rockbass: 7, cisco: 6 },
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
    pool: { laketrout: 25, rainbow: 20, brown: 15, kokanee: 20, cutthroat: 6, smallmouth: 8, whitefish: 6, tahoesucker: 6 },
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
    pool: { chinook: 18, coho: 12, steelhead: 14, whitesturgeon: 6, shad: 14, walleye: 10, smallmouth: 12, channelcat: 4, sockeye: 6, pink: 8, bulltrout: 3, pikeminnow: 9, redhorse: 4 },
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
    pool: { peacock: 22, piranha: 22, pacu: 8, payara: 6, redtail: 8, piraiba: 2, arowana: 10, arapaima: 4, trairao: 10, tambaqui: 8, surubim: 6, oscar: 8 },
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
    pool: { bonefish: 14, tarpon: 8, permit: 5, redfish: 12, snook: 10, seatrout: 12, barracuda: 10, crevalle: 8, mangrovesnapper: 10, muttonsnapper: 4, sheepshead: 6, lemonshark: 3, blacktip: 3, nurseshark: 2, cobia: 2, flounder: 4, ladyfish: 8, hogfish: 4, southernray: 5, angelfish: 3, triggerfish: 4 },
    net: { menhaden: 50, sardine: 25, anchovy: 20, mangrovesnapper: 3, seatrout: 2 },
  },
  gulf: {
    ...base, id: 'gulf', name: 'Gulf of Mexico Offshore', region: '60 mi south of Louisiana', water: 'offshore', price: 15000,
    blurb: 'Blue water around the oil rigs: tuna, mahi, wahoo and blue marlin.',
    wind: 8, fetch: 300, swell: 0.5, waterLook: WATER.deepBlue, sky: { turbidity: 2.2, clouds: 0.35 }, fog: 1 / 30000, rig: true,
    height(x, z) {
      // open Gulf: 150-300 m, with salt-dome banks that come up to ~40 m (one under the rig)
      const base = 170 + 130 * sm(-0.35, 0.55, fbm(x * 0.0006 + 3, z * 0.0006 - 8, 4, 31));
      const bank = sm(0.3, 0.62, fbm(x * 0.0017 + 7, z * 0.0017, 3, 33));
      const rig = Math.exp(-(((x - 260) ** 2 + (z + 420) ** 2) / 380 ** 2));
      const up = Math.max(bank * 0.9, rig);
      return -(base + (46 - base) * up) + 4 * fbm(x * 0.02, z * 0.02, 2, 35) * up;
    },
    pool: { yellowfin: 12, blackfin: 12, mahi: 16, wahoo: 7, kingmackerel: 12, redsnapper: 12, amberjack: 8, gag: 6, redgrouper: 6, sailfish: 4, bluemarlin: 1.5, whitemarlin: 2, swordfish: 1.5, mako: 1.5, hammerhead: 1, tigershark: 1, skipjack: 10, cobia: 4, goliath: 1, bluefin: 0.4, triggerfish: 8, redporgy: 8, angelfish: 3 },
    net: { menhaden: 45, sardine: 20, anchovy: 20, skipjack: 8, redsnapper: 4, kingmackerel: 3 },
  },
  reef: {
    ...base, id: 'reef', name: 'Great Barrier Reef', region: 'Queensland, Australia', water: 'offshore', price: 20000, size: 2400,
    blurb: 'Coral cays and reef edges: coral trout, giant trevally and black marlin.',
    wind: 8, fetch: 120, swell: 0.5, waterLook: WATER.tropical, shoreWave: 0.6, heroRock: true, sky: { turbidity: 2, clouds: 0.38 },
    trees: [['palm', 700, 1.5, 40]],
    height: tropicalIsland,
    start: { x: 520, z: -420, yaw: 2.4 },
    pool: { coraltrout: 14, gt: 8, redemperor: 10, sweetlips: 10, barramundi: 6, mangrovejack: 8, queenfish: 8, dogtooth: 3, parrotfish: 10, spangled: 10, spanishmackerel: 8, blackmarlin_r: 1.5, blacktip: 4, tigershark: 1, mahi: 4, maori: 1.5, longtail: 6 },
    net: { sardine: 50, anchovy: 35, spanishmackerel: 5, queenfish: 5, longtail: 3 },
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
    pool: { cod: 28, saithe: 20, haddock: 14, halibut: 4, ling: 8, wolffish: 6, atlsalmon: 5, mackerel: 14, monkfish: 4, porbeagle: 1, goldenredfish: 6, greenland: 1.2, tusk: 6 },
    net: { herring: 40, mackerel: 25, cod: 15, saithe: 10, haddock: 10, capelin: 15 },
  },
  bering: {
    ...base, id: 'bering', name: 'Bering Sea', region: 'Off Dutch Harbor, Alaska', water: 'offshore', price: 25000,
    blurb: 'Big seas, cold spray and the richest fishing grounds on Earth.',
    wind: 12, fetch: 600, swell: 1.2, swellDir: 40, chop: 1, waterLook: WATER.northSea, sky: { turbidity: 3.5, clouds: 0.88 }, fog: 1 / 8000,
    height(x, z) {
      // outer shelf: 70-130 m on the flats, gullies and a shelf break dropping toward 220 m
      const f = fbm(x * 0.0008 + 1, z * 0.0008 + 9, 4, 41);
      const gully = Math.abs(fbm(x * 0.0021 + 4, z * 0.0021, 3, 43));
      return -(78 + 40 * (0.5 + f) + 60 * sm(0.05, -0.3, f) + 55 * sm(0.14, 0.0, gully) + 25 * sm(-300, 1400, x * 0.7 + z * 0.7));
    },
    pool: { pacificcod: 25, pacifichalibut: 12, sablefish: 10, chum: 10, alaskapollock: 20, chinook: 6, coho: 6, pacificherring: 6, dollyvarden: 6, lingcod: 6, yelloweye: 4, pink: 5 },
    net: { alaskapollock: 40, pacificherring: 25, pacificcod: 15, capelin: 15, sablefish: 5, chum: 5 },
  },
  chesapeake: {
    ...base, id: 'chesapeake', name: 'Chesapeake Bay', region: 'Maryland, USA', water: 'inshore', price: 5000,
    blurb: 'Brackish bay, marsh shores and the shipping channel. Stripers, blues and croaker.',
    wind: 7, windDir: 200, fetch: 45, waveScale: 0.6, swell: 0.1, waterLook: WATER.brackish, shoreWave: 0.1, sky: { turbidity: 2.8, clouds: 0.45 },
    trees: [['reed', 3600, -0.3, 1.0], ['birch', 2600, 1.4, 20], ['pine', 1800, 1.5, 20], ['cabin', 30, 1.0, 6]],
    height(x, z) {
      // open bay to the east, a low marsh shore to the west cut by tidal creeks
      const c = x + 520 + 200 * fbm(z * 0.0012, x * 0.0004 + 3, 3, 2);
      let h;
      if (c > 0) {
        h = -0.6 - 2.6 * sm(0, 90, c) - 4.5 * sm(60, 800, c) - 0.8 * fbm(x * 0.01, z * 0.01, 2, 3);
        h -= 10 * Math.exp(-(((x - 950 - 120 * fbm(z * 0.002, 1, 2, 5)) / 170) ** 2));   // shipping channel
      } else {
        h = 0.5 + 0.3 * sm(0, -80, c) + 8 * sm(-60, -700, c) * (0.6 + fbm(x * 0.006, z * 0.006, 3, 4));
        const creek = Math.abs(fbm(x * 0.0028 + 5, z * 0.0028, 3, 7));
        h += (-2.4 - h) * sm(0.07, 0.0, creek) * sm(-1100, -100, c);
      }
      // a low marsh island out in the bay
      const r = Math.hypot(x - 380, z + 700) * (1 + 0.4 * fbm(x * 0.008, z * 0.008, 2, 9));
      return h + (0.6 + 1.5 * sm(130, 40, r) - h) * sm(240, 130, r);
    },
    pool: { stripedbass: 24, bluefish: 14, croaker: 16, spotcroaker: 12, whiteperch: 14, seatrout: 8, summerflounder: 8, blackdrum: 5, redfish: 5, cobia: 2, bluecat: 3, channelcat: 3, scup: 10, tautog: 6, americaneel: 4, weakfish: 8 },
    net: { menhaden: 55, spotcroaker: 15, croaker: 12, shad: 10, bluefish: 4, stripedbass: 2, scup: 6 },
  },
  mekong: {
    ...base, id: 'mekong', name: 'Mekong River', region: 'Si Phan Don, Laos', water: 'river', price: 8000, size: 3600,
    blurb: 'The four thousand islands. Giant catfish, Siamese carp and snakeheads in brown water.',
    wind: 3, fetch: 8, waveScale: 0.45, waterLook: WATER.mekong, current: [0, 0.5], sky: { turbidity: 4, clouds: 0.55 }, fog: 1 / 9500,
    trees: [['jungle', 9000, 1.0, 22], ['palm', 2600, 0.8, 12], ['stilt', 45, 0.6, 3]],
    height(x, z) {
      const cx = 240 * Math.sin(z * 0.0009) + 50 * fbm(z * 0.003, 2, 2, 1);
      const d = Math.abs(x - cx), W = 640;
      if (d < W) {
        const h = -1.6 - 13 * (1 - (d / W) ** 2) + 1.2 * fbm(x * 0.02, z * 0.02, 2, 8);
        const isl = fbm(x * 0.005 + 4, z * 0.005, 4, 12);
        const m = sm(0.2, 0.3, isl) * sm(W * 0.98, W * 0.75, d) * sm(180, 320, Math.hypot(x - cx, z));
        return h + (0.7 + (isl - 0.2) * 10 - h) * m;
      }
      return 1.1 + (d - W) * 0.012 + 2.2 * fbm(x * 0.01, z * 0.01, 3, 5);
    },
    pool: { stripedcatfish: 18, giantsnakehead: 12, soldierbarb: 16, giantgourami: 10, julliensbarb: 8, siamesecarp: 4, mekongcat: 1.5, tilapia: 8, wallago: 6, featherback: 5, hampala: 8, giantsalmoncarp: 1, silvercarp: 5 },
    net: null,
  },
  kariba: {
    ...base, id: 'kariba', name: 'Lake Kariba', region: 'Zimbabwe / Zambia', water: 'lake', price: 10000, size: 4000,
    blurb: 'A drowned valley full of dead trees. Tigerfish, vundu and crocodiles.',
    wind: 5, windDir: 120, fetch: 25, waveScale: 0.65, waterLook: WATER.kariba, sky: { turbidity: 3.4, clouds: 0.28 }, fog: 1 / 12000, rockLine: 45, rockTint: [0.85, 0.66, 0.5],
    trees: [['snag', 1600, -7, -1.2], ['acacia', 3200, 1, 70]],
    height(x, z) {
      const r = Math.hypot(x, z);
      let n = fbm(x * 0.0014 + 1, z * 0.0014 - 4, 4, 21) + 0.15 * fbm(x * 0.007, z * 0.007, 3, 6);
      n -= 0.55 * Math.exp(-((r / 700) ** 2));
      if (n < 0.1) return -0.6 - 30 * sm(0.1, -0.4, n) ** 1.3;
      return 0.6 + (n - 0.1) * 45 + 110 * sm(0.16, 0.5, n) * (0.45 + 0.7 * ridged(x * 0.004, z * 0.004, 4, 3));
    },
    pool: { tigerfish: 22, threespot: 16, karibatilapia: 14, sharptooth: 12, nembwe: 10, vundu: 5, nkupe: 8, bottlenose: 6, kapenta: 4 },
    net: null,
  },
  cabo: {
    ...base, id: 'cabo', name: 'Cabo San Lucas', region: 'Baja California Sur, Mexico', water: 'offshore', price: 18000,
    blurb: 'Desert cliffs drop straight into deep blue. Striped marlin, roosterfish and dorado.',
    wind: 7, windDir: 300, fetch: 200, swell: 0.6, swellDir: 200, waterLook: WATER.pacific, shoreWave: 0.55, sky: { turbidity: 2, clouds: 0.2 }, fog: 1 / 26000,
    rockLine: 6, rockTint: [0.86, 0.74, 0.62],
    trees: [['cactus', 1400, 2, 140]],
    // granite sea stacks off Land's End: [x, z, radius, height above water]
    stacks: [[-300, -55, 13, 30], [-262, -18, 10, 22], [-215, -42, 8, 16], [-332, -10, 6, 11], [-240, -70, 5, 7]],
    height(x, z) {
      // the cape runs east-west with land to the north; Land's End juts south at x = -260
      const point = Math.exp(-(((x + 260) / 150) ** 2));
      const d = -420 + 120 * fbm(x * 0.0018, 7, 3, 4) + 330 * point - z;   // > 0 on land
      const bay = sm(80, 300, x) * sm(1000, 700, x);                        // sandy beach east of the point
      let h;
      if (d > 0) {
        h = 0.7 + Math.min(d, 40) * (0.05 + 0.9 * (1 - bay)) + Math.max(0, d - 40) * 0.2;
        h += 190 * sm(60, 900, d) * (0.45 + 0.75 * ridged(x * 0.003, z * 0.003, 5, 17));
      } else {
        const w = -d;
        h = -(0.5 + 2.5 * (1 - bay)) - 4 * sm(0, 60, w) - 60 * sm(40, 400, w) - 230 * sm(300, 1100, w);
      }
      return h;
    },
    pool: { stripedmarlin: 6, bluemarlin: 1, blackmarlin: 0.8, sailfish: 3, mahi: 14, yellowfin: 10, wahoo: 6, skipjack: 8, roosterfish: 8, sierra: 12, yellowtail: 10, pargo: 8, cabrilla: 8, mako: 1, bonito: 10 },
    net: { sardine: 50, anchovy: 28, skipjack: 10, sierra: 6, yellowtail: 3, bonito: 6 },
  },
  bigbear: {
    ...base, id: 'bigbear', name: 'Big Bear Lake', region: 'California, USA', water: 'lake', price: 0, size: 4800,
    blurb: 'A seven-mile mountain reservoir at 6,750 ft in the San Bernardino Mountains: stocked trout, bass in the coves, pines to the water.',
    wind: 5, fetch: 12, waveScale: 0.35, waterLook: WATER.bigbear, sky: { turbidity: 1.5, clouds: 0.25 }, fog: 1 / 22000, rockLine: 320, rockTint: [0.97, 0.91, 0.84], grassTint: [0.98, 0.9, 0.66], start: { x: 330, z: 170, yaw: 2.4 },
    // forest by slope and side (the north shore faces south: dry, oak/juniper/chaparral; the south shore faces north: cool, fir and cedar); heights are metres above the lake
    trees: [
      ['jeffrey', 9000, 1.5, 420, 2300], ['whitefir', 4200, 25, 520, 2300, (x, z, h) => z > -150 || h > 120], ['cedar', 1400, 4, 260, 2300, (x, z) => z > -100],
      ['lodgepole', 1400, 220, 560, 2300], ['aspen', 260, 1.2, 40, 2300], ['alder', 500, 0.6, 9, 2300], ['willow', 380, 0.5, 6, 2300],
      ['oak', 1700, 2, 200, 2300, (x, z, h) => z < 100 || h < 40], ['juniper', 2200, 1.5, 190, 2300, (x, z) => x > -200 && z < 500], ['chaparral', 4200, 1.2, 230, 2300, (x, z, h) => (z < -50 || x > 300) && h < 230],
    ],
    landings: BB_LANDINGS,
    height: bbHeight,
    pool: { rainbow: 34, brown: 6, largemouth: 14, smallmouth: 6, channelcat: 10, bluegill: 14, pumpkinseed: 6, blackcrappie: 10, carp: 8 },
    net: null,
  },
};

// ---- bathymetry --------------------------------------------------------------------------
// The shapes above set each water's outline and shallows. This pass deepens only what is under
// the waterline: depth <= knee is untouched (shores, docks, flats stay put) and deeper water is
// stretched from the old maximum (ref) to the real-world-inspired max, with holes and humps from
// noise. See docs/water-depths.md for the scale and the sources.
const deepen = (h, x, z, o) => {
  if (h > -o.knee) return h;
  const t = Math.max(0, (-h - o.knee) / (o.ref - o.knee));
  const shape = Math.pow(t, o.pow);
  const n = fbm(x * o.fs + o.seed, z * o.fs - o.seed, 3, o.seed | 0);               // -1..1: slow swells in the floor
  const m = fbm(x * o.fs * 2.7 - o.seed, z * o.fs * 2.7 + 3, 3, (o.seed | 0) + 5);  // finer: holes and humps
  let d = o.knee + (o.max - o.knee) * shape * (1 + o.feat * n);
  d += (o.hole || 0) * sm(0.35, 0.75, m) * Math.min(1, shape * 2);                  // deep holes / scours
  d -= (o.hump || 0) * sm(0.35, 0.75, -m) * Math.min(1, shape * 2) * Math.min(1, d / o.max); // humps and ledges
  return -Math.max(o.knee, d);
};
const DEEP = {
  woods: { knee: 4, ref: 16, max: 54, pow: 2.0, feat: 0.2, fs: 0.0016, seed: 3, hole: 6, hump: 7 },
  tahoe: { knee: 6, ref: 110, max: 225, pow: 0.85, feat: 0.12, fs: 0.0012, seed: 5, hole: 10, hump: 14 },
  columbia: { knee: 4, ref: 17, max: 52, pow: 1.1, feat: 0.3, fs: 0.003, seed: 7, hole: 10, hump: 6 },
  amazon: { knee: 4, ref: 12, max: 48, pow: 1.1, feat: 0.3, fs: 0.003, seed: 9, hole: 10, hump: 5 },
  mekong: { knee: 4, ref: 16, max: 62, pow: 1.9, feat: 0.25, fs: 0.003, seed: 11, hole: 14, hump: 8 },
  kariba: { knee: 4, ref: 31, max: 95, pow: 1.35, feat: 0.15, fs: 0.002, seed: 13, hole: 8, hump: 14 },
  chesapeake: { knee: 5, ref: 18, max: 48, pow: 1.5, feat: 0.2, fs: 0.003, seed: 15, hole: 5, hump: 4 },
  keys: { knee: 2.8, ref: 6, max: 16, pow: 1.0, feat: 0.2, fs: 0.003, seed: 17, hole: 3 },
  fjord: { knee: 6, ref: 86, max: 220, pow: 0.8, feat: 0.12, fs: 0.002, seed: 19, hole: 20, hump: 25 },
  reef: { knee: 6, ref: 42, max: 190, pow: 0.9, feat: 0.1, fs: 0.002, seed: 21, hole: 10, hump: 8 },
  cabo: { knee: 7, ref: 300, max: 400, pow: 1.0, feat: 0.1, fs: 0.0016, seed: 23, hole: 30, hump: 20 },
};
for (const [id, o] of Object.entries(DEEP)) {
  const L = LOCATIONS[id], raw = L.height;
  L.rawHeight = raw;
  L.height = (x, z) => deepen(raw(x, z), x, z, o);
}

export const LOCATION_ORDER = ['bigbear', 'okeechobee', 'woods', 'tahoe', 'columbia', 'chesapeake', 'keys', 'mekong', 'amazon', 'kariba', 'fjord', 'gulf', 'cabo', 'reef', 'bering'];

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

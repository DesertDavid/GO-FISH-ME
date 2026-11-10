const { LOCATIONS, LOCATION_ORDER } = await import(process.argv[2] || './src/game/locations.js');
for (const id of LOCATION_ORDER) {
  const L = LOCATIONS[id], R = L.size / 2, ds = [];
  for (let x = -R; x <= R; x += R / 60) for (let z = -R; z <= R; z += R / 60) { const h = L.height(x, z); if (h < -0.5) ds.push(-h); }
  ds.sort((a, b) => a - b);
  const q = (p) => ds.length ? ds[Math.floor(p * (ds.length - 1))].toFixed(0) : '-';
  console.log(id.padEnd(11), 'wet%', (100 * ds.length / 61 / 61).toFixed(0).padStart(3), 'p50', q(0.5), 'p90', q(0.9), 'max', q(1));
}

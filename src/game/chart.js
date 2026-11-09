// Local chart (key C): a north-up map of the current water drawn from the real heightfield,
// with your boat/position and the dock services (fish market, tackle & bait, boat dealer).
// The terrain layer is rendered once per location window and cached; markers redraw live.
import { bearingTo, fmtDist } from './compass.js';
const N = 560;                        // terrain raster size (px)
const MIN_HALF = 420;                  // never zoom in tighter than +-420 m
const cache = new Map();

export const SERVICE_INFO = {
  sell: { label: 'Fish market' },
  tackle: { label: 'Bait & tackle' },
  boats: { label: 'Boat dealer' },
};

// who does what: the first dock (nearest the start) is the full marina, the second sells
// tackle too, any others just buy fish
export function dockProfile(i) {
  if (i === 0) return { name: 'Marina', services: ['sell', 'tackle', 'boats'] };
  if (i === 1) return { name: 'Bait shop', services: ['sell', 'tackle'] };
  return { name: 'Fish buyer', services: ['sell'] };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WATER_RAMP = [[0, [112, 168, 178]], [1.5, [76, 138, 160]], [5, [44, 100, 134]], [15, [24, 64, 98]], [45, [12, 36, 62]], [120, [6, 18, 36]]];
const LAND_LO = [150, 146, 118], LAND_HI = [176, 168, 148];

function ramp(stops, v) {
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}

const dirText = (dx, dz) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8];

export class Chart {
  constructor(game) {
    this.g = game;
    this.win = null;
    this.timer = 0;
  }

  // every point of interest on this map: [{ x, z, kind, name, services }]
  places() {
    const out = [];
    (this.g.docks.list || []).forEach((d, i) => {
      const p = dockProfile(i);
      d.profile = p;
      out.push({ x: d.end.x, z: d.end.z, dock: d, name: p.name, services: p.services });
    });
    return out;
  }

  playerPos() {
    const g = this.g;
    return g.foot ? { x: g.foot.x, z: g.foot.z } : { x: g.boat.position.x, z: g.boat.position.z };
  }

  // square window (centre + half-size) covering the start, docks and the player
  window() {
    const g = this.g, pts = [g.start, ...this.places(), ...g.compass.list(), this.playerPos(), { x: g.boat.position.x, z: g.boat.position.z }];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const half = clamp(Math.max(x1 - x0, z1 - z0) * 0.5 * 1.3 + 120, MIN_HALF, Math.min(2200, g.loc.size * 0.5));
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, half };
  }

  // does the cached raster still cover everything of interest?
  usable(w) {
    const pts = [...this.places(), ...this.g.compass.list(), this.playerPos(), { x: this.g.boat.position.x, z: this.g.boat.position.z }];
    return pts.every((p) => Math.abs(p.x - w.cx) < w.half * 0.94 && Math.abs(p.z - w.cz) < w.half * 0.94);
  }

  base() {
    const id = this.g.loc.id;
    let hit = cache.get(id);
    if (hit && this.usable(hit.win)) return hit;
    const win = this.window();
    const H = this.g.loc.height;
    const S = N + 1, step = (win.half * 2) / N, hs = new Float32Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) hs[j * S + i] = H(win.cx - win.half + i * step, win.cz - win.half + j * step);
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
    const sun = [-0.55, -0.6];       // light from the north-west
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const h = hs[j * S + i];
        const gx = (hs[j * S + i + 1] - hs[j * S + Math.max(0, i - 1)]) / (2 * step), gz = (hs[(j + 1) * S + i] - hs[Math.max(0, j - 1) * S + i]) / (2 * step);
        let c;
        if (h > 0) {
          const shade = clamp(1 + (gx * sun[0] + gz * sun[1]) * 6, 0.55, 1.35);
          c = mix(LAND_LO, LAND_HI, clamp(h / 40, 0, 1)).map((v) => v * shade);
        } else {
          c = ramp(WATER_RAMP, -h);
          // depth contours every 5 m (shallow) / 20 m (deep) as faint lines
          const m = h > -20 ? 5 : 20, f = (-h) % m;
          const edge = Math.abs(gx) + Math.abs(gz);
          if (f < Math.max(0.12, edge * step * 0.7)) c = mix(c, [150, 205, 215], 0.22);
        }
        // the shoreline itself: a crisp pale line
        const k = (j * N + i) * 4;
        if ((h > 0) !== (hs[j * S + i + 1] > 0) || (h > 0) !== (hs[(j + 1) * S + i] > 0)) c = [236, 238, 226];
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    hit = { win, cv };
    cache.set(id, hit);
    return hit;
  }

  // ---- UI hookup
  html() {
    return `<div class="chart"><div class="chart-map"><canvas id="chartCv" width="${N}" height="${N}"></canvas></div><div class="chart-side" id="chartSide"></div></div>`;
  }

  mount() {
    clearInterval(this.timer);
    this.cv = document.getElementById('chartCv');
    if (!this.cv) return;
    this.cv.style.cursor = 'crosshair';
    this.cv.onclick = (ev) => this.click(ev);
    this.draw();
    this.timer = setInterval(() => {
      if (this.g.ui.panel !== 'chart' || !document.getElementById('chartCv')) { clearInterval(this.timer); return; }
      this.cv = document.getElementById('chartCv');
      this.draw();
    }, 120);
  }

  // click the chart: on a waypoint removes it, on a dock sets a waypoint there, anywhere else
  // sets one at that spot
  click(ev) {
    const r = this.cv.getBoundingClientRect(), win = this.view;
    if (!win) return;
    const k = this.cv.width / r.width, sx = (ev.clientX - r.left) * k, sy = (ev.clientY - r.top) * k;
    const sc = this.cv.width / (win.half * 2);
    const toPx = (x, z) => [(x - (win.cx - win.half)) * sc, (z - (win.cz - win.half)) * sc];
    const near = (x, z, rad) => { const [a, b] = toPx(x, z); return Math.hypot(a - sx, b - sy) < rad; };
    const comp = this.g.compass;
    const hit = comp.list().find((w) => near(w.x, w.z, 14));
    if (hit) { comp.remove(hit.id); this.g.ui.toast(`Waypoint removed: ${hit.name}`, 'info'); this.draw(); return; }
    const dock = this.places().find((p) => near(p.x, p.z, 20));
    if (dock) comp.add(dock.x, dock.z, dock.name);
    else comp.add(win.cx - win.half + sx / sc, win.cz - win.half + sy / sc);
    this.draw();
  }

  // metres in view -> canvas px
  draw() {
    const g = this.g, { win, cv: terrain } = this.base();
    this.view = win;
    const ctx = this.cv.getContext('2d'), W = this.cv.width;
    const sc = W / (win.half * 2);
    const px = (x) => (x - (win.cx - win.half)) * sc, pz = (z) => (z - (win.cz - win.half)) * sc;
    ctx.clearRect(0, 0, W, W);
    ctx.drawImage(terrain, 0, 0, W, W);
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    // range grid
    const gridStep = win.half > 1400 ? 500 : win.half > 700 ? 250 : 100;
    ctx.strokeStyle = 'rgba(232,228,216,0.16)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(232,228,216,0.6)';
    for (let x = Math.ceil((win.cx - win.half) / gridStep) * gridStep; x < win.cx + win.half; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(px(x) + 0.5, 0); ctx.lineTo(px(x) + 0.5, W); ctx.stroke();
    }
    for (let z = Math.ceil((win.cz - win.half) / gridStep) * gridStep; z < win.cz + win.half; z += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, pz(z) + 0.5); ctx.lineTo(W, pz(z) + 0.5); ctx.stroke();
    }
    // scale bar
    const bar = gridStep * sc;
    ctx.fillStyle = 'rgba(8,16,24,0.72)'; ctx.fillRect(10, W - 34, bar + 20 + 52, 24);
    ctx.strokeStyle = '#e8e4d8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, W - 18); ctx.lineTo(20 + bar, W - 18); ctx.moveTo(20, W - 22); ctx.lineTo(20, W - 14); ctx.moveTo(20 + bar, W - 22); ctx.lineTo(20 + bar, W - 14); ctx.stroke();
    ctx.fillStyle = '#e8e4d8'; ctx.fillText(`${gridStep} m`, 28 + bar, W - 14);
    // north arrow
    ctx.fillStyle = 'rgba(8,16,24,0.72)'; ctx.fillRect(W - 44, 10, 34, 40);
    ctx.fillStyle = '#e8e4d8'; ctx.textAlign = 'center'; ctx.fillText('N', W - 27, 26);
    ctx.beginPath(); ctx.moveTo(W - 27, 30); ctx.lineTo(W - 33, 44); ctx.lineTo(W - 27, 40); ctx.lineTo(W - 21, 44); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left';

    // places
    const me = this.playerPos();
    const rows = [];
    for (const p of this.places()) {
      const x = px(p.x), y = pz(p.z);
      // pier: walkway line from the shore to the head
      const d = p.dock;
      ctx.strokeStyle = '#2a1e12'; ctx.lineWidth = 5; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(px(d.x), pz(d.z)); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = '#d8b878'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px(d.x), pz(d.z)); ctx.lineTo(x, y); ctx.stroke();
      this.badge(ctx, x, y, p);
      rows.push({ p, dist: Math.hypot(p.x - me.x, p.z - me.z), dir: dirText(p.x - me.x, p.z - me.z) });
    }
    // waypoints: amber diamonds with a bearing line from you
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    for (const w of g.compass.list()) {
      const x = px(w.x), y = pz(w.z);
      ctx.strokeStyle = 'rgba(233,178,91,0.45)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(px(me.x), pz(me.z)); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e9b25b'; ctx.strokeStyle = '#0a121a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.fillStyle = '#f2efe8'; ctx.textAlign = 'left'; ctx.fillText(w.name, x + 9, y - 6);
    }
    // your boat (always) and you on foot
    const bp = g.boat.position, bh = g.boat.heading();
    this.boatArrow(ctx, px(bp.x), pz(bp.z), -bh + Math.PI / 2, !!g.foot);
    if (g.foot) {
      const dir = g.camera.getWorldDirection(new (g.camera.position.constructor)());
      this.person(ctx, px(g.foot.x), pz(g.foot.z), Math.atan2(dir.x, -dir.z));
    }
    this.side(rows);
  }

  // marker badge: dark disc, amber ring, glyph for the best service plus its name
  badge(ctx, x, y, p) {
    ctx.save();
    ctx.translate(x, y);
    const r = 15;
    ctx.fillStyle = 'rgba(10,18,26,0.92)'; ctx.strokeStyle = '#e9b25b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f2efe8'; ctx.fillStyle = '#f2efe8'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const s = p.services;
    if (s.length === 3) {
      // marina: anchor
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.moveTo(-4, -3); ctx.lineTo(4, -3); ctx.moveTo(-8, 2); ctx.quadraticCurveTo(-7, 9, 0, 9); ctx.quadraticCurveTo(7, 9, 8, 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -8, 1.8, 0, Math.PI * 2); ctx.stroke();
    } else if (s.includes('tackle')) {
      // hook
      ctx.beginPath(); ctx.moveTo(1, -9); ctx.lineTo(1, 4); ctx.arc(-3, 4, 4, 0, Math.PI * 0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7.4, 1.6); ctx.lineTo(-5.2, 3.2); ctx.stroke();
    } else {
      // fish
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-1, -7, 6, 0); ctx.quadraticCurveTo(-1, 7, -8, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(10, -4); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.font = '700 12px "IBM Plex Sans", sans-serif';
    const label = p.name;
    const w = ctx.measureText(label).width + 12, lx = clamp(x - w / 2, 4, ctx.canvas.width - w - 4), ly = y + 20;
    ctx.fillStyle = 'rgba(10,18,26,0.85)'; ctx.fillRect(lx, ly, w, 18);
    ctx.fillStyle = '#f2efe8'; ctx.fillText(label, lx + 6, ly + 13);
  }

  boatArrow(ctx, x, y, rot, parked) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = parked ? 'rgba(242,239,232,0.55)' : '#f2efe8'; ctx.strokeStyle = '#0a121a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8, 9); ctx.lineTo(0, 5); ctx.lineTo(-8, 9); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    if (!parked) { ctx.fillStyle = '#e9b25b'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }

  person(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(233,178,91,0.35)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 30, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9b25b'; ctx.strokeStyle = '#0a121a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  side(rows) {
    const el = document.getElementById('chartSide');
    if (!el) return;
    const g = this.g;
    let html;
    if (!rows.length) {
      html = `<h5>No docks on this water</h5><p class="small">A buyer boat on the radio takes your catch for a cut, and the tackle shop and marina are reachable from anywhere.</p>`;
    } else {
      const here = g.dockHere();
      html = '<h5>Services</h5>' + rows.map(({ p, dist, dir }) => {
        const on = here && here.dock === p.dock;
        return `<div class="svc ${on ? 'here' : ''}"><b>${p.name}${on ? ' · you are here' : ''}</b><span class="small">${p.services.map((s) => SERVICE_INFO[s].label).join(' · ')}</span><span class="d">${Math.round(dist)} m ${dir}</span></div>`;
      }).join('');
    }
    const wps = g.compass.list(), me = this.playerPos();
    html += '<h5>Waypoints</h5>' + (wps.length ? wps.map((w) => `<div class="svc"><b>${w.name}</b><span class="d">${fmtDist(Math.hypot(w.x - me.x, w.z - me.z))} · ${String(Math.round(bearingTo(me, w.x, w.z)) % 360).padStart(3, '0')}°</span></div>`).join('') : '<p class="small">None yet.</p>') +
      '<p class="small">Click the chart to set a waypoint (on a dock marker for that dock); click a waypoint to remove it. Z drops one at your position, Shift+Z clears all. They show on the compass bar.</p>';
    html += `<p class="small legend"><span class="k boat"></span>Your boat &nbsp; <span class="k you"></span>You on foot</p>${rows.length ? '<p class="small">Sell fish (L), buy tackle (B) and boats (Y) at the docks marked here.</p>' : ''}`;
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  }
}

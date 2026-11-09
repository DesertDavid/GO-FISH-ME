// Compass bar along the top of the screen: a thin heading tape in the same clear-screen
// marine-electronics style as the rest of the HUD. Heading is read from the camera itself
// (north = -z, the same north-up as the chart), so it is right in every view and on foot.
// Waypoints (per location, kept in the save) ride the tape at their bearing with the distance,
// and clamp to the ends with an arrow when they are outside the view.
const W = 640, H = 58;
const PX_PER_DEG = 4.4;                 // tape scale: ~145 degrees in view

const CARD = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
const AMBER = '#e9b25b', TEXT = '#f2efe8';

export const wrap360 = (d) => ((d % 360) + 360) % 360;
export const wrap180 = (d) => ((d + 540) % 360) - 180;
export const bearingTo = (from, x, z) => wrap360((Math.atan2(x - from.x, -(z - from.z)) * 180) / Math.PI);
export const cardinal = (deg) => CARD[(Math.round(wrap360(deg) / 45) % 8) * 45];
export const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`);

// ---- waypoint store (save.waypoints = { [locationId]: [{ id, x, z, name }] })
export function waypointsOf(save, loc) { return (save.waypoints && save.waypoints[loc]) || []; }

export class Compass {
  constructor(game, canvas) {
    this.g = game;
    this.c = canvas;
    this.c.width = W * 2; this.c.height = H * 2;      // drawn at 2x for crisp ticks
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(2, 2);
    this.heading = 0;
  }

  list() { return waypointsOf(this.g.save, this.g.loc.id); }

  add(x, z, name) {
    const l = this.list();
    const cap = this.g.boatMods().waypoints;
    if (l.length >= cap) { this.g.ui.toast(`Waypoint limit (${cap}) reached - clear one first${cap < 40 ? ', or fit a better GPS at the marina' : ''}.`, 'info'); return null; }
    if (l.some((w) => Math.hypot(w.x - x, w.z - z) < 8)) { this.g.ui.toast('There is already a waypoint here.', 'info'); return null; }
    let n = 1; while (l.some((w) => w.name === `WPT ${n}`)) n++;
    const w = { id: Date.now().toString(36) + Math.floor(Math.random() * 99), x: Math.round(x), z: Math.round(z), name: name || `WPT ${n}` };
    this.store([...l, w]);
    this.g.ui.toast(`Waypoint set: ${w.name}`, 'good');
    return w;
  }

  remove(id) { this.store(this.list().filter((w) => w.id !== id)); }
  clear() { this.store([]); }

  store(list) {
    this.g.commit({ waypoints: { ...(this.g.save.waypoints || {}), [this.g.loc.id]: list } });
  }

  // drop a waypoint where you are (boat, or on foot)
  here() {
    const g = this.g, p = g.foot ? g.foot : g.boat.position;
    return this.add(p.x, p.z);
  }

  pos() {
    const g = this.g;
    return g.foot ? { x: g.foot.x, z: g.foot.z } : { x: g.boat.position.x, z: g.boat.position.z };
  }

  // camera heading in degrees (0 = north, clockwise)
  readHeading() {
    const e = this.g.camera.matrixWorld.elements;      // third column = camera +z; view dir = -z
    const dx = -e[8], dz = -e[10];
    return wrap360((Math.atan2(dx, -dz) * 180) / Math.PI);
  }

  update() {
    const show = this.g.settings.compass !== false;
    this.c.style.display = show ? '' : 'none';
    if (!show) return;
    this.g.camera.updateMatrixWorld();
    // light smoothing so wave-roll jitter doesn't shimmer the tape
    const h = this.readHeading();
    this.heading = wrap360(this.heading + wrap180(h - this.heading) * 0.55);
    this.draw();
  }

  draw() {
    const ctx = this.ctx, cx = W / 2, hd = this.heading;
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    // faint scrim fading out at both ends so the tape melts into the view
    const fade = ctx.createLinearGradient(0, 0, W, 0);
    fade.addColorStop(0, 'rgba(8,14,20,0)'); fade.addColorStop(0.18, 'rgba(8,14,20,0.34)');
    fade.addColorStop(0.82, 'rgba(8,14,20,0.34)'); fade.addColorStop(1, 'rgba(8,14,20,0)');
    ctx.fillStyle = fade; ctx.fillRect(0, 14, W, 28);

    const span = W / PX_PER_DEG;
    const xAt = (deg) => cx + wrap180(deg - hd) * PX_PER_DEG;
    const edgeA = (x) => 1 - Math.min(1, Math.max(0, (Math.abs(x - cx) - W * 0.34) / (W * 0.16)));   // fade near the ends

    // ticks
    const from = Math.floor((hd - span / 2) / 5) * 5, to = hd + span / 2;
    ctx.lineWidth = 1; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    for (let d = from; d <= to; d += 5) {
      const deg = wrap360(d), x = cx + (d - hd) * PX_PER_DEG, a = edgeA(x);
      const major = deg % 45 === 0, mid = deg % 15 === 0 || deg % 10 === 0;
      ctx.strokeStyle = `rgba(242,239,232,${(major ? 0.9 : mid ? 0.6 : 0.35) * a})`;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 42); ctx.lineTo(Math.round(x) + 0.5, 42 - (major ? 11 : mid ? 7 : 4)); ctx.stroke();
      if (major) {
        const n = CARD[deg];
        ctx.fillStyle = n === 'N' ? `rgba(239,107,87,${a})` : `rgba(242,239,232,${a})`;
        ctx.font = `${n.length === 1 ? 700 : 600} ${n.length === 1 ? 14 : 12}px "IBM Plex Sans", sans-serif`;
        ctx.fillText(n, x, 25);
      } else if (deg % 15 === 0) {
        ctx.fillStyle = `rgba(242,239,232,${0.55 * a})`;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.fillText(String(deg).padStart(3, '0'), x, 25);
      }
    }
    ctx.strokeStyle = 'rgba(242,239,232,0.22)';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.4, 42.5); ctx.lineTo(cx + W * 0.4, 42.5); ctx.stroke();

    // waypoints
    const me = this.pos(), half = span / 2 - 4;
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    for (const w of this.list()) {
      const dist = Math.hypot(w.x - me.x, w.z - me.z), brg = bearingTo(me, w.x, w.z), rel = wrap180(brg - hd);
      const off = Math.abs(rel) > half, x = cx + Math.max(-half, Math.min(half, rel)) * PX_PER_DEG;
      ctx.fillStyle = AMBER; ctx.strokeStyle = 'rgba(8,14,20,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (off) {   // arrow pointing off the end of the tape
        const s = rel > 0 ? 1 : -1;
        ctx.moveTo(x + s * 6, 36); ctx.lineTo(x - s * 3, 30); ctx.lineTo(x - s * 3, 42);
      } else {     // diamond sitting on the tape
        ctx.moveTo(x, 30); ctx.lineTo(x + 5, 36); ctx.lineTo(x, 42); ctx.lineTo(x - 5, 36);
      }
      ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.fillStyle = off ? 'rgba(233,178,91,0.8)' : AMBER;
      ctx.textAlign = 'center';
      const label = off ? fmtDist(dist) : `${w.name} ${fmtDist(dist)}`, lw = ctx.measureText(label).width / 2 + 2;
      ctx.fillText(label, Math.max(lw, Math.min(W - lw, x)), 54);
    }

    // centre pointer (lubber line) + numeric readout
    ctx.fillStyle = AMBER;
    ctx.beginPath(); ctx.moveTo(cx, 44); ctx.lineTo(cx - 5, 51); ctx.lineTo(cx + 5, 51); ctx.closePath(); ctx.fill();
    const deg = Math.round(hd) % 360;
    ctx.textAlign = 'center'; ctx.fillStyle = TEXT; ctx.font = '700 15px "IBM Plex Mono", monospace';
    ctx.strokeStyle = 'rgba(8,14,20,0.9)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    const txt = `${String(deg).padStart(3, '0')}°`;
    ctx.strokeText(txt, cx - 14, 12); ctx.fillText(txt, cx - 14, 12);
    ctx.fillStyle = AMBER; ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'left';
    ctx.strokeText(cardinal(hd), cx + 18, 12); ctx.fillText(cardinal(hd), cx + 18, 12);
  }
}

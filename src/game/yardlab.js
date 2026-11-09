// Dev page: the boat-yard turntable full-window, for checking paint, lettering and fitted parts.
// ?boat=bass&yaw=2.2&pitch=0.2&dist=7&name=Bad%20Habit&hull=navy&stripe=gold&trim=black&bottom=red&wear=2&up=gps:2,lights:2
import { BoatPreview } from './boatPreview.js';
import { customOf } from './boatCustom.js';

const q = new URLSearchParams(location.search);
const id = q.get('boat') || 'bass';
const cfg = customOf({}, id);
for (const k of ['hull', 'stripe', 'trim', 'bottom', 'house', 'canopy']) if (q.get(k)) cfg[k] = q.get(k);
if (q.get('name')) cfg.name = q.get('name');
if (q.get('wear')) cfg.wear = +q.get('wear');
const up = {};
for (const p of (q.get('up') || '').split(',')) { const [k, v] = p.split(':'); if (k) up[k] = +v || 1; }
cfg.up = up;
const pv = new BoatPreview();
document.body.appendChild(pv.canvas);
window.pv = pv;
pv.show(id, cfg, up).then(() => {
  pv.auto = false;
  pv.yaw = +(q.get('yaw') ?? 2.2); pv.pitch = +(q.get('pitch') ?? 0.2);
  if (q.get('dist')) pv.dist = +q.get('dist');
  if (q.get('ty')) pv.target.y = +q.get('ty');
  pv.start();
  window.ready = true;
});

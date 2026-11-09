// Named save slots, file export/import and the optional on-disk backup.
// The live game still autosaves to `reelworld-save-v1` (save.js); slots are snapshots of it.
import { LOCATIONS, LOCATION_ORDER } from './locations.js';
import { DEFAULT_SAVE, readRaw, writeRaw } from './save.js';
import { CATALOG_SIZE } from './species.js';
import { BOATS, RODS, REELS, LINES, LURES } from './gear.js';
import { upgradeSave, levelOf } from './progress.js';
import { sanitizeCustom } from './boatCustom.js';
const clamp01 = (n) => (typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

const SLOTS_KEY = 'reelworld-slots-v1';
export const SLOT_COUNT = 4;
export const FILE_FORMAT = 'reelworld-save';
export const FILE_VERSION = 2;   // 2: angler xp, wear, permits (older files still import; upgradeSave fills them in)

// ---- storage ----
function readSlots() {
  try {
    const d = JSON.parse(localStorage.getItem(SLOTS_KEY) || 'null');
    if (d && typeof d === 'object' && d.slots) return d;
  } catch { /* corrupt: start over */ }
  return null;
}

function writeSlots(d) {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(d)); return true; } catch { return false; }
}

// First run with slots: an existing autosave is copied into slot 1 (the autosave itself is untouched).
export function migrateSaves() {
  if (readSlots()) return;
  const d = { v: 1, slots: {} };
  const old = readRaw();
  if (old && typeof old === 'object' && old.cash !== undefined) d.slots['1'] = { savedAt: Date.now(), data: old, note: 'Your earlier progress' };
  writeSlots(d);
}

export function listSlots() {
  migrateSaves();
  const d = readSlots() || { slots: {} };
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const e = d.slots[String(i + 1)];
    return { n: i + 1, entry: e && e.data ? e : null };
  });
}

export function putSlot(n, data) {
  migrateSaves();
  const d = readSlots() || { v: 1, slots: {} };
  d.slots[String(n)] = { savedAt: Date.now(), data: JSON.parse(JSON.stringify(data)) };
  const ok = writeSlots(d);
  if (ok) backupToDisk(`slot-${n}`, d.slots[String(n)]);
  return ok;
}

export function deleteSlot(n) {
  const d = readSlots() || { v: 1, slots: {} };
  delete d.slots[String(n)];
  return writeSlots(d);
}

// ---- summaries for the list ----
export function summarize(data) {
  const loc = LOCATIONS[data.location];
  let caught = 0;
  for (const e of Object.values(data.journal || {})) caught += Object.keys(e.morphs || {}).length;
  return {
    location: loc ? loc.name : 'Unknown water',
    cash: data.cash || 0,
    level: levelOf(typeof data.xp === 'number' ? data.xp : upgradeSave(data).xp),
    places: `${(data.unlocked || []).length} of ${LOCATION_ORDER.length} waters`,
    catalog: `${caught} of ${CATALOG_SIZE} in journal`,
    day: data.day || 1,
    played: data.played || 0,
  };
}

export function fmtPlayed(sec) {
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `today ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })} ${time}`;
}

// ---- validation: returns a clean save or throws an Error with a friendly message ----
export function sanitizeSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This file does not hold a Reel World save.');
  if (typeof raw.cash !== 'number' || !isFinite(raw.cash)) throw new Error('The save is missing its money.');
  if (!Array.isArray(raw.unlocked) || !Array.isArray(raw.boats) || !raw.equip || typeof raw.equip !== 'object') throw new Error('The save is incomplete (gear or waters missing).');
  if (!LOCATIONS[raw.location]) throw new Error(`The save is set at a place this version does not have (${String(raw.location).slice(0, 30)}).`);
  if (raw.journal !== undefined && (typeof raw.journal !== 'object' || raw.journal === null)) throw new Error('The save journal is damaged.');
  const def = structuredClone(DEFAULT_SAVE);
  const up = upgradeSave(raw);   // v1 files get xp / permits / wear derived from their progress
  const out = { ...def, ...up, equip: { ...def.equip, ...raw.equip }, stats: { ...def.stats, ...(raw.stats || {}) }, unlocked: raw.unlocked.filter((id) => LOCATIONS[id]) };
  if (typeof out.xp !== 'number' || !isFinite(out.xp) || out.xp < 0) out.xp = 0;
  out.wear = { line: clamp01(out.wear.line), hook: clamp01(out.wear.hook), lost: out.wear.lost.filter((id) => LURES[id]) };
  const permits = {};
  for (const [id, p] of Object.entries(out.permits || {})) if (LOCATIONS[id] && p && isFinite(p.until)) permits[id] = { until: +p.until };
  out.permits = permits;
  // anything the game indexes by id must exist, or loading would crash on a hand-edited / newer file
  if (!BOATS[out.boat]) out.boat = 'jon';
  out.boats = out.boats.filter((id) => BOATS[id]);
  if (!out.boats.includes(out.boat)) out.boats.unshift(out.boat);
  for (const [k, table] of [['rod', RODS], ['reel', REELS], ['line', LINES], ['lure', LURES]]) if (!table[out.equip[k]]) out.equip[k] = def.equip[k];
  if (typeof out.hour !== 'number' || !isFinite(out.hour)) out.hour = def.hour;
  // journal entries need their morph table; waypoints must be { place: [{x,z,...}] }
  if (!out.journal || typeof out.journal !== 'object') out.journal = {};
  for (const [id, e] of Object.entries(out.journal)) if (!e || typeof e !== 'object' || !e.morphs || typeof e.morphs !== 'object') delete out.journal[id];
  const wp = {};
  if (out.waypoints && typeof out.waypoints === 'object') {
    for (const [loc, list] of Object.entries(out.waypoints)) {
      if (!LOCATIONS[loc] || !Array.isArray(list)) continue;
      wp[loc] = list.filter((w) => w && isFinite(w.x) && isFinite(w.z)).slice(0, 40).map((w, i) => ({ id: String(w.id ?? `i${i}`), x: +w.x, z: +w.z, name: String(w.name ?? `WPT ${i + 1}`).slice(0, 24) }));
    }
  }
  out.waypoints = wp;
  out.custom = sanitizeCustom(raw.custom);
  return out;
}

// ---- files ----
export function makeFile(data) {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, game: 'Reel World', exportedAt: new Date().toISOString(), save: data }, null, 1);
}

export function parseFile(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('That file is not readable as a Reel World save (not valid JSON).'); }
  if (!obj || obj.format !== FILE_FORMAT) throw new Error('That is not a Reel World save file.');
  if (typeof obj.version !== 'number' || obj.version > FILE_VERSION) throw new Error('That save is from a newer version of the game.');
  return sanitizeSave(obj.save);
}

export function downloadFile(data, label) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `reelworld-${label}-${stamp}.reelworld`;
  const blob = new Blob([makeFile(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}

export function pickFile() {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.reelworld,.json,application/json';
    inp.style.display = 'none';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) { resolve(null); return; }
      if (f.size > 8 * 1024 * 1024) { reject(new Error('That file is far too big to be a save.')); return; }
      f.text().then(resolve, () => reject(new Error('Could not read that file.')));
    });
    document.body.appendChild(inp);
    inp.click();
  });
}

// ---- load a snapshot as the live save, then restart on it ----
export function installAsLive(data) {
  return writeRaw(data);
}

// ---- optional disk backup (dev server middleware in vite.config.js; silent if absent) ----
let lastAuto = 0;
export function backupToDisk(name, payload) {
  try {
    fetch(`/__reelworld/backup/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
  } catch { /* no server support */ }
}
export function autoBackup(data) {
  if (new URLSearchParams(location.search).has('loc')) return;   // preview pages never write
  const now = Date.now();
  if (now - lastAuto < 60000) return;
  lastAuto = now;
  backupToDisk('autosave', { savedAt: now, data });
}
export async function diskBackup() {
  try {
    const r = await fetch('/__reelworld/backup/autosave', { cache: 'no-store' });
    if (r.status !== 200) return null;
    const j = await r.json();
    return j && j.data ? j : null;
  } catch { return null; }
}

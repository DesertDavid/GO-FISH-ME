// The pictures behind the photo album. The save only holds each photo's small metadata (photoData.js);
// the images (full-size JPEG + a 320 px thumbnail) live in IndexedDB so they never touch localStorage's ~5 MB.
// Never throws: if IndexedDB is missing or refuses (private window, quota), photos stay in memory for the
// session and `state.mode` says so, so the UI can tell the player. Dev sessions (saving paused) are memory-only too.
import { isFrozen } from './save.js';

const DB = 'reelworld-photos', STORE = 'img';
export const state = { mode: 'init', lastError: '' };   // 'idb' | 'memory' | 'init'
const mem = new Map();        // id -> { full: Blob, thumb: Blob }     (session copies; also the cache for IDB reads)
const urls = new Map();       // id -> { thumb, full } object URLs, revoked on remove
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE, { keyPath: 'id' }); };
      rq.onsuccess = () => { state.mode = 'idb'; resolve(rq.result); };
      rq.onerror = rq.onblocked = () => { state.mode = 'memory'; state.lastError = String(rq.error || 'blocked'); resolve(null); };
    } catch (err) { state.mode = 'memory'; state.lastError = String(err); resolve(null); }
  });
  return dbp;
}

const tx = (db, mode, fn) => new Promise((resolve) => {
  try {
    const t = db.transaction(STORE, mode);
    let out;
    const r = fn(t.objectStore(STORE));
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out === undefined ? true : out);
    t.onerror = t.onabort = () => { state.lastError = String(t.error || 'failed'); resolve(null); };
  } catch (err) { state.lastError = String(err); resolve(null); }
});

// Store one photo. Resolves true when it is safely on disk, false when it only exists in memory.
export async function put(id, full, thumb) {
  mem.set(id, { full, thumb });
  if (isFrozen()) return false;
  const db = await open();
  if (!db) return false;
  const ok = await tx(db, 'readwrite', (s) => s.put({ id, full, thumb, at: Date.now() }));
  if (!ok) state.mode = 'memory';   // quota or a failed write: tell the player once, keep going
  return !!ok;
}

async function get(id) {
  const m = mem.get(id);
  if (m) return m;
  const db = await open();
  if (!db) return null;
  const rec = await tx(db, 'readonly', (s) => s.get(id));
  if (rec && rec.full) { mem.set(id, { full: rec.full, thumb: rec.thumb }); return mem.get(id); }
  return null;
}

// object URLs for <img>; null when the picture is not on this device (an imported save, cleared site data)
export function cachedThumb(id) { return urls.get(id)?.thumb || null; }
export async function thumbURL(id) {
  const c = urls.get(id);
  if (c?.thumb) return c.thumb;
  const r = await get(id);
  if (!r) return null;
  const u = urls.get(id) || {};
  u.thumb = URL.createObjectURL(r.thumb || r.full);
  urls.set(id, u);
  return u.thumb;
}
export async function fullURL(id) {
  const r = await get(id);
  if (!r) return null;
  const u = urls.get(id) || {};
  if (!u.full) u.full = URL.createObjectURL(r.full);
  urls.set(id, u);
  return u.full;
}
export async function fullBlob(id) { return (await get(id))?.full || null; }

// referenced = Set of ids some save (live or a slot) still lists; others are kept so loading an older slot still shows its pictures
export async function remove(id, referenced) {
  if (referenced && referenced.has(id)) return;
  const u = urls.get(id);
  if (u) { if (u.thumb) URL.revokeObjectURL(u.thumb); if (u.full) URL.revokeObjectURL(u.full); urls.delete(id); }
  mem.delete(id);
  if (isFrozen()) return;
  const db = await open();
  if (db) await tx(db, 'readwrite', (s) => s.delete(id));
}

// drop stored pictures that no save refers to any more (called once at start, quietly)
export async function gc(referenced) {
  if (isFrozen()) return 0;
  const db = await open();
  if (!db) return 0;
  const keys = await tx(db, 'readonly', (s) => s.getAllKeys());
  if (!Array.isArray(keys)) return 0;
  let n = 0;
  for (const k of keys) if (!referenced.has(k)) { await tx(db, 'readwrite', (s) => s.delete(k)); n++; }
  return n;
}

export async function usage() {
  const db = await open();
  if (!db) return { n: mem.size, bytes: 0 };
  const all = await tx(db, 'readonly', (s) => s.getAll());
  if (!Array.isArray(all)) return { n: mem.size, bytes: 0 };
  return { n: all.length, bytes: all.reduce((a, r) => a + (r.full?.size || 0) + (r.thumb?.size || 0), 0) };
}

export const init = () => open().then(() => state.mode);

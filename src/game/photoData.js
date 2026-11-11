// Photo album: pure data (no three.js, no DOM) and the words on the captions.
// Save fields (optional; old saves just have none):
//   photos     [{ id, t, day, hour, loc, wx, boat, kind, sp?, morph?, lb?, lure?, cap, fav, w, h, look, frame }]  newest last, max PHOTO_MAX
//   postcards  { locId: photoId }   the photo shown on that water's card in the Travel menu
// The pictures themselves are NOT in the save: they live in IndexedDB (photoStore.js), keyed by `id`.
import { SPECIES_BY_ID, MORPHS } from './species.js';
import { LOCATIONS } from './locations.js';
import { BOATS, LURES } from './gear.js';
import * as U from './units.js';

export const PHOTO_MAX = 60;
export const CAP_MAX = 200;

// restrained film-like looks: s saturation, c contrast, lift (raised blacks), tS / tH shadow and highlight tint,
// amt tint strength, grain, vig (extra vignette). 'natural' leaves the picture alone.
export const LOOKS = [
  { id: 'natural', name: 'Natural', s: 1, c: 1, lift: 0, tS: [0, 0, 0], tH: [0, 0, 0], amt: 0, grain: 0, vig: 0 },
  { id: 'faded', name: 'Faded film', s: 0.8, c: 0.92, lift: 0.045, tS: [0.0, 0.02, 0.03], tH: [0.04, 0.025, 0.0], amt: 1, grain: 0.03, vig: 0.12 },
  { id: 'slide', name: 'Warm slide', s: 1.08, c: 1.06, lift: 0.0, tS: [0.0, 0.0, 0.0], tH: [0.045, 0.02, -0.03], amt: 1, grain: 0.015, vig: 0.1 },
  { id: 'cool', name: 'Cool roll', s: 0.86, c: 1.04, lift: 0.015, tS: [-0.02, 0.012, 0.045], tH: [-0.01, 0.0, 0.02], amt: 1, grain: 0.025, vig: 0.1 },
  { id: 'silver', name: 'Silver print', s: 0, c: 1.14, lift: 0.01, tS: [0, 0, 0.004], tH: [0.006, 0.004, 0], amt: 1, grain: 0.04, vig: 0.18 },
  { id: 'old', name: 'Old print', s: 0.12, c: 1.0, lift: 0.04, tS: [0.03, 0.015, 0.0], tH: [0.07, 0.045, 0.0], amt: 1, grain: 0.045, vig: 0.28 },
];
export const LOOK_BY_ID = Object.fromEntries(LOOKS.map((l) => [l.id, l]));

export const FRAMES = [
  { id: 'none', name: 'No frame' },
  { id: 'matte', name: 'Matte border' },
  { id: 'plate', name: 'Caption plate' },
  { id: 'film', name: 'Film edge' },
];
export const FRAME_IDS = FRAMES.map((f) => f.id);

const id36 = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
export const newPhotoId = id36;

// valid meta or null; unknown ids fall back so a hand-edited file cannot crash the journal
export function cleanPhoto(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !/^[a-z0-9]{3,24}$/.test(p.id)) return null;
  const o = {
    id: p.id, t: num(p.t, 0), day: Math.max(1, Math.floor(num(p.day, 1))), hour: Math.min(24, Math.max(0, num(p.hour, 12))),
    loc: LOCATIONS[p.loc] ? p.loc : null, wx: typeof p.wx === 'string' ? p.wx.slice(0, 24) : '', boat: BOATS[p.boat] ? p.boat : null,
    kind: ['photo', 'catch', 'cam'].includes(p.kind) ? p.kind : 'photo', cap: typeof p.cap === 'string' ? p.cap.slice(0, CAP_MAX) : '',
    fav: !!p.fav, w: Math.max(1, Math.min(8192, Math.floor(num(p.w, 1)))), h: Math.max(1, Math.min(8192, Math.floor(num(p.h, 1)))),
    look: LOOK_BY_ID[p.look] ? p.look : 'natural', frame: FRAME_IDS.includes(p.frame) ? p.frame : 'none',
  };
  if (SPECIES_BY_ID[p.sp]) {
    o.sp = p.sp;
    o.morph = MORPHS.some((m) => m.id === p.morph) ? p.morph : 'normal';
    o.lb = Math.max(0, num(p.lb, 0));
    if (LURES[p.lure]) o.lure = p.lure;
  }
  return o;
}

export function cleanPhotos(s) {
  const seen = new Set();
  const photos = (Array.isArray(s.photos) ? s.photos : []).map(cleanPhoto).filter((p) => p && !seen.has(p.id) && seen.add(p.id)).slice(-PHOTO_MAX);
  const postcards = {};
  if (s.postcards && typeof s.postcards === 'object') for (const [loc, id] of Object.entries(s.postcards)) if (LOCATIONS[loc] && seen.has(id)) postcards[loc] = id;
  return { photos, postcards };
}

export const photoCount = (save) => (save.photos || []).length;
export const photosOf = (save, spId) => (save.photos || []).filter((p) => p.sp === spId);

export const addPhoto = (save, meta) => ({ ...save, photos: [...(save.photos || []), meta].slice(-PHOTO_MAX) });
export const patchPhoto = (save, id, patch) => ({ ...save, photos: (save.photos || []).map((p) => (p.id === id ? { ...p, ...patch } : p)) });
export function dropPhoto(save, id) {
  const postcards = Object.fromEntries(Object.entries(save.postcards || {}).filter(([, v]) => v !== id));
  return { ...save, photos: (save.photos || []).filter((p) => p.id !== id), postcards };
}
export const setPostcard = (save, loc, id) => ({ ...save, postcards: { ...(save.postcards || {}), [loc]: id } });

// ---- words ----
export const hhmm = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const partOfDay = (h) => (h < 4.5 ? 'night' : h < 7 ? 'first light' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 17.5 ? 'afternoon' : h < 20 ? 'evening' : 'night');

const PLAIN = [
  'Nothing on the line. Taking the view.',
  'No fish in this one. The water was worth it.',
  'For the record: the place, as found.',
  'Taken between casts.',
  'Not a keeper. Kept the picture.',
];
const CAUGHT = [
  (s) => `${s}. Held up for the camera.`,
  (s) => `${s}. It did not stay still.`,
  (s) => `${s}. Logged and photographed.`,
];
const CAM = ['Below the boat, on the cable.', 'Seen from the camera on the cable.', 'The view from down the line.'];
const pick = (arr, h) => arr[Math.abs(Math.floor(h * 97)) % arr.length];

// info: { loc, day, hour, wx, boat, kind, sp, morph, lb, lure, depth }
export function captionFor(info) {
  const loc = LOCATIONS[info.loc], boat = BOATS[info.boat];
  const sp = SPECIES_BY_ID[info.sp], morph = MORPHS.find((m) => m.id === info.morph);
  const head = `Day ${info.day}, ${hhmm(info.hour)}. ${loc ? loc.name : 'Open water'}${info.wx ? `, ${info.wx.toLowerCase()}` : ''}.`;
  let body;
  if (sp) {
    const what = `${morph && morph.id !== 'normal' ? `${morph.name} ` : ''}${sp.name}, ${U.weight(info.lb || sp.lb[1])}${info.lure && LURES[info.lure] ? `, on the ${LURES[info.lure].name.toLowerCase()}` : ''}`;
    body = pick(CAUGHT, info.hour)(what);
  } else if (info.kind === 'cam') {
    body = `${pick(CAM, info.hour)}${info.depth > 0 ? ` ${U.depth(info.depth, 1)} down.` : ''}`;
  } else body = pick(PLAIN, info.hour);
  const tail = boat ? ` ${boat.name}, ${partOfDay(info.hour)}.` : ` ${partOfDay(info.hour)[0].toUpperCase()}${partOfDay(info.hour).slice(1)}.`;
  return `${head} ${body}${tail}`.replace(/\s+/g, ' ').slice(0, CAP_MAX);   // generated lines stay well under the limit
}

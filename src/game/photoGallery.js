// The Photos tab of the Journal: a grid of thumbnails, a full-size viewer (favourite, caption, postcard, PNG, delete),
// the little strips on a species' page and the postcard on a water's card in Travel. Pictures come from photoStore.js
// (IndexedDB); everything here tolerates a picture that is not on this device (an imported save, cleared site data).
import { SPECIES_BY_ID, MORPHS } from './species.js';
import { LOCATIONS } from './locations.js';
import { BOATS } from './gear.js';
import { PHOTO_MAX, LOOK_BY_ID, FRAMES, hhmm, photosOf } from './photoData.js';
import * as store from './photoStore.js';
import { isFrozen } from './save.js';
import * as U from './units.js';
import { keyLabel } from './keys.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = (p) => `Day ${p.day}, ${hhmm(p.hour)}`;
const place = (p) => (LOCATIONS[p.loc] ? LOCATIONS[p.loc].name : 'Open water');

// <img> that fills itself from the store after the panel is drawn (src from the cache when there is one)
const img = (id, cls = '') => `<img class="${cls}" data-pid="${id}" alt="" draggable="false"${store.cachedThumb(id) ? ` src="${store.cachedThumb(id)}"` : ''}>`;

export function photosTab(ui) {
  const g = ui.g, s = g.save, list = [...(s.photos || [])].reverse();
  const tiles = list.map((p) => `<button class="ph-tile" data-act="ph-open" data-id="${p.id}" title="${esc(p.cap)}">${img(p.id)}<span class="ph-t">${p.fav ? '<i class="fav">&#9733;</i>' : ''}${esc(p.sp ? SPECIES_BY_ID[p.sp].name : p.kind === 'cam' ? 'Fish cam' : place(p))}</span><span class="ph-d">${when(p)}</span></button>`).join('');
  const note = isFrozen() ? 'Developer session: photos are kept in memory only and are gone on reload.'
    : store.state.mode === 'memory' ? 'This browser is not storing photos (storage blocked or full), so they last until you close the game.' : '';
  return `<div class="ph-sum"><span>Photos <b>${list.length} / ${PHOTO_MAX}</b></span><span>Favourites <b>${list.filter((p) => p.fav).length}</b></span><span>Caught on camera <b>${new Set(list.filter((p) => p.sp).map((p) => p.sp)).size}</b></span></div>`
    + (list.length ? `<div class="ph-grid">${tiles}</div>` : `<p class="tips">${esc(`No photographs yet. Press ${keyLabel(g.binds.map.photo)} for photo mode, or ${keyLabel(g.binds.map.fishcam)} to lower the fish cam. A fish in hand gets a "Photo" button on its card.`)}</p>`)
    + `<p class="tips">${note ? `<b class="warn">${esc(note)}</b> ` : ''}The album keeps ${PHOTO_MAX} pictures per save. Pictures are stored in this browser, not in the save file, so an exported save carries the captions only.</p>`;
}

export function viewer(ui) {
  const g = ui.g, s = g.save, list = s.photos || [];
  const i = list.findIndex((p) => p.id === ui.pv?.id);
  if (i < 0) { ui.pv = null; return photosTab(ui); }
  const p = list[i], sp = SPECIES_BY_ID[p.sp], look = LOOK_BY_ID[p.look], fr = FRAMES.find((f) => f.id === p.frame);
  const armed = ui.pv.arm === 'del';
  const bits = [place(p), when(p), p.wx || '', p.boat && BOATS[p.boat] ? BOATS[p.boat].name : '', sp ? `${p.morph && p.morph !== 'normal' ? `${MORPHS.find((m) => m.id === p.morph)?.name} ` : ''}${sp.name}, ${U.weight(p.lb)}` : '', look && look.id !== 'natural' ? look.name : '', fr && fr.id !== 'none' ? fr.name : ''].filter(Boolean);
  const card = s.postcards?.[p.loc] === p.id;
  return `<div class="pv"><div class="pv-nav"><button class="btn" data-act="ph-back">All photos</button><span>${i + 1} of ${list.length}</span><span><button class="btn" data-act="ph-step" data-d="-1" ${i === 0 ? 'disabled' : ''}>&#9664;</button> <button class="btn" data-act="ph-step" data-d="1" ${i === list.length - 1 ? 'disabled' : ''}>&#9654;</button></span></div>
    <div class="pv-pic"><img id="pvImg" alt="${esc(p.cap)}" draggable="false"${store.cachedThumb(p.id) ? ` src="${store.cachedThumb(p.id)}"` : ''}><div class="pv-missing" id="pvMiss" hidden>This picture is not on this device: the save came from another browser, or the site data was cleared. The caption is still yours.</div></div>
    <label class="pv-cap"><span>Caption</span><input type="text" maxlength="200" data-ph-cap="${p.id}" value="${esc(p.cap)}"></label>
    <div class="pv-meta">${bits.map(esc).join(' · ')}</div>
    <div class="actions"><button class="btn ${p.fav ? 'gold' : ''}" data-act="ph-fav" data-id="${p.id}">${p.fav ? '&#9733; Favourite' : '&#9734; Favourite'}</button>
      ${LOCATIONS[p.loc] ? `<button class="btn ${card ? 'gold' : ''}" data-act="ph-card" data-id="${p.id}">${card ? 'Postcard for ' : 'Use as postcard for '}${esc(LOCATIONS[p.loc].name)}</button>` : ''}
      <button class="btn" data-act="ph-png" data-id="${p.id}">Download PNG</button>
      <button class="btn ${armed ? 'gold' : ''}" data-act="ph-del" data-id="${p.id}">${armed ? 'Really delete?' : 'Delete'}</button></div></div>`;
}

// a strip of up to four of this species' photos for its journal row
export function speciesStrip(ui, spId) {
  const l = photosOf(ui.g.save, spId);
  if (!l.length) return '';
  return `<div class="sp-photos">${l.slice(-4).reverse().map((p) => `<button data-act="ph-open" data-id="${p.id}" title="${esc(p.cap)}">${img(p.id)}</button>`).join('')}${l.length > 4 ? `<span>+${l.length - 4}</span>` : ''}</div>`;
}

// the postcard on a water's card in the Travel menu (falls back to the stock picture)
export const postcardId = (save, loc) => save.postcards?.[loc] || null;

// after a render: fill in the <img>s asynchronously
export function fill(ui) {
  const root = document.getElementById('modalCard');
  for (const el of root.querySelectorAll('img[data-pid]')) {
    if (el.getAttribute('src') && !el.dataset.keep) continue;   // data-keep: a postcard over the stock picture
    const id = el.dataset.pid;
    store.thumbURL(id).then((u) => { if (!el.isConnected) return; if (u) el.src = u; else if (!el.dataset.keep) el.closest('button')?.remove(); });
  }
  const big = root.querySelector('#pvImg');
  if (big && ui.pv) {
    const id = ui.pv.id;
    store.fullURL(id).then((u) => {
      if (ui.pv?.id !== id || !big.isConnected) return;
      if (u) big.src = u; else if (!big.getAttribute('src')) { big.remove(); const m = root.querySelector('#pvMiss'); if (m) m.hidden = false; }
    });
  }
}

export async function downloadPng(id, name) {
  const blob = await store.fullBlob(id);
  if (!blob) return false;
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  const png = await new Promise((res) => c.toBlob(res, 'image/png'));
  if (!png) return false;
  const url = URL.createObjectURL(png);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  if (!navigator.webdriver) a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

// click and input handling for the tab; returns true when it took the action
export function galleryAction(ui, act, d) {
  const g = ui.g;
  switch (act) {
    case 'ph-open': ui.tab.journal = 'photos'; ui.pv = { id: d.id }; ui.render(); return true;
    case 'ph-back': ui.pv = null; ui.render(); return true;
    case 'ph-step': { const l = g.save.photos, i = l.findIndex((p) => p.id === ui.pv.id) + +d.d; if (l[i]) ui.pv = { id: l[i].id }; ui.render(); return true; }
    case 'ph-fav': g.photoPatch(d.id, { fav: !g.save.photos.find((p) => p.id === d.id)?.fav }); ui.render(); return true;
    case 'ph-card': g.photoPostcard(d.id); ui.render(); return true;
    case 'ph-png': {
      const p = g.save.photos.find((q) => q.id === d.id);
      downloadPng(d.id, `reelworld-${p?.loc || 'photo'}-day${p?.day || 0}-${d.id}.png`).then((ok) => ui.toast(ok ? 'PNG saved to your downloads.' : 'That picture is not on this device.', ok ? 'good' : 'bad'));
      return true;
    }
    case 'ph-del':
      if (ui.pv.arm === 'del') {
        const l = g.save.photos, i = l.findIndex((p) => p.id === d.id), next = l[i + 1] || l[i - 1];
        g.photoDelete(d.id);
        ui.pv = next ? { id: next.id } : null;
      } else ui.pv.arm = 'del';
      ui.render();
      return true;
    default: return false;
  }
}

// The developer panel (dev.js owns the state and the actions): plain HTML in the same style as the other screens.
import { BOATS, BOAT_ORDER, RODS, LURES } from './gear.js';
import { LOCATIONS, LOCATION_ORDER } from './locations.js';
import { SPECIES, MORPHS } from './species.js';
import { levelOf, MAX_LEVEL } from './progress.js';
import { keyLabel } from './keys.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => '$' + Math.round(n).toLocaleString();

export function hourText(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

const btn = (act, label, attrs = '', cls = '') => `<button class="btn ${cls}" data-act="${act}" ${attrs}>${label}</button>`;
const seg = (act, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-act="${act}" data-id="${v}">${l}</button>`).join('')}</div>`;
const tgl = (act, on) => `<button class="tgl ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-act="${act}"><i></i><span>${on ? 'On' : 'Off'}</span></button>`;
const row = (label, desc, ctl) => `<div class="dv-row"><div class="dv-t"><b>${label}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="dv-c">${ctl}</div></div>`;
const slider = (name, min, max, step, val, out) => `<input type="range" data-dev="${name}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${out}</output>`;
const chips = (items) => `<div class="dv-chips">${items.join('')}</div>`;
const chip = (act, label, on, attrs, note = '') => `<button class="dv-chip ${on ? 'on' : ''}" data-act="${act}" ${attrs}>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</button>`;

const TABS = [['view', 'View'], ['boat', 'Boats'], ['world', 'World'], ['gear', 'Gear'], ['fish', 'Fish'], ['go', 'Teleport'], ['player', 'Player']];

export function renderDev(dev) {
  const g = dev.g, B = g.binds.map, tab = dev.tab;
  const head = `<div class="m-head"><h2>Developer tools</h2><span>saving is paused · nothing here is saved<span class="x" data-act="close">Back</span></span></div>`;
  const tabs = `<div class="tabs">${TABS.map(([id, l]) => `<button class="${id === tab ? 'on' : ''}" data-act="dev-tab" data-id="${id}">${l}</button>`).join('')}</div>`;
  const body = { view, boat, world, gear, fish, go, player }[tab](dev, g, B);
  return `${head}${tabs}<div class="dv">${body}</div>
    <div class="actions"><button class="btn primary" data-act="close">Close</button><button class="btn" data-act="dev-exit">Leave the dev session (reloads the normal game)</button></div>`;
}

function view(dev, g, B) {
  const cur = g.view === 'third' ? 'boat' : g.tp ? 'tp' : 'first';
  return [
    row('Free-fly camera', `Flies through terrain and water; the boat and angler stay where they are. Key [${keyLabel(B.fly)}]. WASD move, Space/E up, Q/Ctrl down, Shift faster, wheel changes speed. (Ctrl+W closes a browser tab, so use Q to go down.)`, btn('dev-fly', dev.fly ? 'Stop flying' : 'Start flying', '', dev.fly ? 'gold' : 'primary')),
    row('Fly speed', 'Scroll in the world changes it too.', slider('speed', 0, 3.4, 0.05, Math.log10(dev.speed), `${Math.round(dev.speed)} m/s`)),
    row('Boat follows the camera', 'Over water the boat tags along beneath the camera. Off: it stays put.', tgl('dev-follow', dev.follow)),
    row('Camera', 'Shoulder: over the shoulder, with the jellybean angler body. Overview: orbit the boat.', seg('dev-view', [['first', 'First person'], ['tp', 'Shoulder'], ['boat', 'Overview']], cur)),
    row('Frame-rate counter', '', tgl('dev-fps', dev.fps)),
    row('Stats overlay', 'Frame time, draw calls, triangles, fish, GPU memory, position.', tgl('dev-stats', dev.stats)),
    row('Fish finder', '', tgl('dev-sonar', dev.sonar ?? g.settings.sonar)),
  ].join('');
}

function boat(dev, g) {
  const cards = BOAT_ORDER.map((id) => {
    const b = BOATS[id], inUse = g.save.boat === id, ok = b.waters.includes(g.loc.water);
    return `<div class="dv-card ${inUse ? 'on' : ''}"><b>${esc(b.name)}</b><span>${b.waters.join(' · ')}${ok ? '' : ' (not usually here)'}</span><span>${Math.round(b.speed * 1.944)} kn${b.net ? ` · ${b.net} net` : ''}</span>${btn('dev-boat', inUse ? 'Respawn' : 'Spawn', `data-id="${id}"`, inUse ? '' : 'primary')}</div>`;
  }).join('');
  return `${row('Fit every upgrade', 'Sonar, engine, holders, livewell, lights, winch... on whichever boat you spawn (the saved ones come back when you turn it off).', tgl('dev-up', dev.maxUp))}
    <h5 class="board-h">Spawn a boat (not bought, not unlocked: your money, level and save are untouched). Flying over water: it appears under the camera.</h5>
    <div class="dv-cards">${cards}</div>`;
}

function world(dev, g) {
  const w = g.weather;
  const wx = w.ev ? w.ev.kind : w.nextChange > 1e8 ? w.id : 'auto';
  const locs = chips(LOCATION_ORDER.map((id) => chip('dev-loc', LOCATIONS[id].name, id === g.loc.id, `data-id="${id}"`, LOCATIONS[id].water)));
  const tide = w.tideAmp ? seg('dev-tide', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], w.devTide == null ? 'auto' : w.devTide > 0 ? 'high' : 'low') : '<span class="small">no tide on this water</span>';
  return [
    `<h5 class="board-h">Location (reloads the page; the save is not touched, like ?loc=)</h5>${locs}`,
    row('Time of day', 'The sun and sky follow at once.', `<div class="dv-sl">${slider('hour', 0, 23.99, 0.05, g.save.hour, hourText(g.save.hour))}</div>`),
    row('Clock', 'Paused: the hour, tides and weather timers stand still.', tgl('dev-pause', dev.paused)),
    row('Weather', 'Held where you put it. Auto hands it back to the game.', seg('dev-wx', [['auto', 'Auto'], ['clear', 'Clear'], ['partly', 'Partly'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['fog', 'Fog bank'], ['squall', 'Squall']], wx)),
    row('Intensity', 'Strength of the rain, fog bank or squall.', `<div class="dv-sl">${slider('wxlevel', 0, 1, 0.05, dev.wxLevel, `${Math.round(dev.wxLevel * 100)}%`)}</div>`),
    row('Lightning', 'Starts a squall if there is none, and strikes.', btn('dev-bolt', 'Strike now')),
    row('Tide', 'Held at high or low water (coastal waters).', tide),
  ].join('');
}

function gear(dev, g) {
  const e = g.save.equip;
  const rods = chips(Object.entries(RODS).map(([id, r]) => chip('dev-rod', r.name, e.rod === id, `data-id="${id}"`)));
  const lures = chips(Object.entries(LURES).map(([id, l]) => chip('dev-lure', l.name, e.lure === id, `data-id="${id}"`)));
  return [
    row('Free fishing permit', 'A year-long permit for this water.', tgl('dev-permit', dev.permit)),
    row('Every rod, reel, line and lure', 'Puts all of it in the tackle box (T) for this session.', btn('dev-allgear', 'Loan all tackle')),
    `<h5 class="board-h">Rods (loaned, equipped at once)</h5>${rods}`,
    `<h5 class="board-h">Lures and bait</h5>${lures}`,
  ].join('');
}

function fish(dev, g) {
  const sel = dev.fishSpecies(), pool = Object.keys(g.loc.pool || {}).filter((id) => SPECIES.some((s) => s.id === id));
  const opt = (s) => `<option value="${s.id}" ${s.id === sel.id ? 'selected' : ''}>${esc(s.name)}</option>`;
  const here = pool.map((id) => SPECIES.find((s) => s.id === id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const all = [...SPECIES].sort((a, b) => a.name.localeCompare(b.name));
  const speciesSel = `<select data-dev="species"><optgroup label="This water">${here.map(opt).join('')}</optgroup><optgroup label="Every species">${all.map(opt).join('')}</optgroup></select>`;
  const morphSel = `<select data-dev="morph">${MORPHS.map((m) => `<option value="${m.id}" ${m.id === dev.fishSel.morph ? 'selected' : ''}>${esc(m.name || m.id)}</option>`).join('')}</select>`;
  return [
    row('Species', `Record about ${sel.lb[2]} lb.`, speciesSel),
    row('Colour variant', '', morphSel),
    row('Size', 'From a minnow-size fish up to just over the record.', `<div class="dv-sl">${slider('fishlb', 0, 1, 0.01, dev.fishSel.t, dev.fishWeight())}</div>`),
    row('Hook it', 'Closes this panel and puts that fish on your line, in front of the boat, so the fight starts now.', btn('dev-hook', 'Hook it', '', 'primary')),
    row('Land it', 'Straight to the catch card (keep / sell / release).', btn('dev-land', 'Land it', '', 'gold')),
  ].join('');
}

function go(dev) {
  const spots = dev.spots();
  return `<h5 class="board-h">${dev.fly ? 'The flying camera moves above the spot' : 'Boats go to the dock; doors and the trophy hall put you on foot there'}</h5>
    ${chips(spots.map((s, i) => chip('dev-tp', s.label, false, `data-i="${i}"`)))}`;
}

function player(dev, g) {
  const lv = levelOf(g.save.xp || 0);
  return [
    row('Money', `Now ${money(g.save.cash)}. Session only.`, `<div class="seg">${[[250, '$250'], [10000, '$10k'], [1000000, '$1M'], [100000000, '$100M']].map(([n, l]) => `<button data-act="dev-cash" data-v="${n}">${l}</button>`).join('')}</div>`),
    row('Angler level', 'Opens gear, boats and waters by level. Session only.', `<div class="dv-sl">${slider('level', 1, MAX_LEVEL, 1, lv, `Lv ${lv}`)}</div>`),
    `<p class="tips">The first time you use the developer tools the game writes your real progress once and then stops saving until you reload. Money, level, loaned tackle, spawned boats and weather set here are never written: the autosave, the save slots and the disk backup all stay as they were.</p>`,
  ].join('');
}

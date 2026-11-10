// The Settings screen: tabs (Gameplay, Controls, Graphics, Audio, Display, Accessibility),
// sliders / switches / segmented selectors with a one-line description each, key rebinding,
// per-tab and overall reset. Everything applies live through Game.applySettings (which saves).
// Mouse and keyboard: Up/Down move between rows, Left/Right change a value (or switch tab from
// the tab bar), Enter/Space toggles or starts a rebind, PageUp/PageDown change tab, Esc closes.
import './settings.css';
import { DEFAULT_SETTINGS, PRESETS, GFX_KEYS } from './settings.js';
import { ACTIONS, GROUPS, DEFAULT_BINDS, resolveBinds, keyName, keyLabel, reservedReason, assign, ACTION } from './keys.js';
import { BOOT } from '../engine/gfxBoot.js';
import { handsVersion } from './hands.js';
const HANDS_BOOT = String(handsVersion());   // the hands this page was loaded with
import { writeSave } from './save.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(v * 100)}%`;
const times = (v) => `${v.toFixed(2).replace(/0$/, '')}x`;

// type: slider {min,max,step,fmt} | toggle | seg {opts:[[value,label]]} ; reload = needs a page reload
const OPTS = {
  gameplay: [
    { k: 'mouseLock', t: 'toggle', label: 'Mouse look', desc: 'Click the view once to lock the mouse; it then looks around with no button held. Off: hold the right button and drag.' },
    { k: 'severeWeather', t: 'toggle', label: 'Severe weather', desc: 'Squalls with strong wind, big seas and lightning. Fog banks still roll in when this is off.' },
    { k: 'hands', t: 'seg', label: 'First-person hands', desc: 'Jellybean (default): the stylised angler with capsule sleeves and round rubber-glove hands, the same figure you see in third person. Classic: the original modelled hands. Realistic: a textured hand with nails, knuckles and a rolled flannel sleeve (credit in the pause menu).', opts: [['3', 'Jellybean'], ['1', 'Classic'], ['2', 'Realistic']], reload: true },
    { k: 'biteQuality', t: 'toggle', label: 'Bite-quality ticks', desc: 'Three small ticks on the lure marker show how well the lure, depth and time of day suit the fish.' },
    { k: 'devTools', t: 'toggle', label: 'Developer tools', desc: 'Turns on the developer panel and the free-fly camera (keys under Controls > Developer). Using either pauses saving until you reload, and nothing you do with them is ever saved. Also available as ?dev=1 in the address.' },
  ],
  graphics: [
    { k: 'preset', t: 'seg', label: 'Quality preset', desc: 'Sets everything below at once. Changing any single option switches this to Custom. High is the original look.', opts: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['custom', 'Custom']], preset: true },
    { h: 'Image' },
    { k: 'resolution', t: 'slider', label: 'Render scale', desc: 'Resolution the 3D view is drawn at. Lower is faster; above 100% sharpens by supersampling.', min: 0.5, max: 1.5, step: 0.05, fmt: pct },
    { k: 'msaa', t: 'seg', label: 'Edge smoothing (MSAA)', desc: 'Anti-aliasing samples. Higher removes jagged edges but costs GPU time.', opts: [[2, '2x'], [4, '4x'], [8, '8x']] },
    { k: 'fov', t: 'slider', label: 'Field of view', desc: 'How wide the camera sees. The rod and hands keep their own fixed view.', min: 45, max: 100, step: 1, fmt: (v) => `${Math.round(v)}°` },
    { k: 'shadows', t: 'seg', label: 'Shadow detail', desc: 'Sharpness of shadows from the sun and moon.', opts: [[1024, 'Low'], [2048, 'Medium'], [4096, 'High']] },
    { k: 'bloom', t: 'slider', label: 'Bloom', desc: 'Soft glow around bright lights, the sun and lightning.', min: 0, max: 0.15, step: 0.01, fmt: (v) => (v < 0.005 ? 'Off' : `${Math.round(v / 0.05 * 100)}%`) },
    { k: 'droplets', t: 'toggle', label: 'Lens droplets', desc: 'Water drops on the lens when you come up from underwater.' },
    { h: 'Water' },
    { k: 'reflections', t: 'toggle', label: 'Water reflections', desc: 'Real reflections of the shore and sky on the water. Costs about a second scene pass.' },
    { k: 'reflectionRes', t: 'slider', label: 'Reflection detail', desc: 'Resolution of the reflection image relative to the screen.', min: 0.25, max: 1, step: 0.05, fmt: pct, needs: 'reflections' },
    { k: 'fft', t: 'seg', label: 'Wave resolution (FFT)', desc: 'Size of the wave simulation grid: finer ripples and swell detail.', opts: [[128, '128'], [256, '256'], [512, '512']], reload: true },
    { k: 'meshDetail', t: 'seg', label: 'Wave mesh detail', desc: 'How many points the water surface is built from around you.', opts: [[256, 'Low'], [320, 'Medium'], [384, 'High'], [512, 'Max']], reload: true },
    { h: 'World' },
    { k: 'drawDistance', t: 'slider', label: 'Draw distance', desc: 'How far buildings, villages and birds stay drawn.', min: 0.4, max: 1.5, step: 0.05, fmt: pct },
    { k: 'vegetation', t: 'slider', label: 'Vegetation density', desc: 'Share of trees, reeds and bushes drawn.', min: 0.1, max: 1, step: 0.05, fmt: pct },
    { k: 'buildings', t: 'slider', label: 'Background building density', desc: 'Share of the distant villages, farms and industry drawn. Dock shops always stay.', min: 0, max: 1, step: 0.05, fmt: pct },
    { k: 'wildlife', t: 'slider', label: 'Bird density', desc: 'Share of the herons, gulls, egrets and pelicans around the water.', min: 0, max: 1, step: 0.05, fmt: pct },
    { k: 'fishCount', t: 'slider', label: 'Fish in the water', desc: 'How many fish swim around you, and on the fish finder.', min: 0.2, max: 1, step: 0.05, fmt: pct },
    { k: 'weatherFx', t: 'slider', label: 'Rain density', desc: 'Number of rain streaks in the air.', min: 0, max: 1, step: 0.05, fmt: pct },
    { h: 'Info' },
    { k: 'fps', t: 'toggle', label: 'Frame-rate counter', desc: 'Shows frames per second in the top-left corner.' },
  ],
  audio: [
    { k: 'volume', t: 'slider', label: 'Master volume', desc: 'Everything at once.', min: 0, max: 1, step: 0.05, fmt: pct },
    { k: 'sfxVol', t: 'slider', label: 'Effects', desc: 'Casting, splashes, reel clicks, drag, the engine and bumps.', min: 0, max: 1, step: 0.05, fmt: pct },
    { k: 'ambVol', t: 'slider', label: 'Ambience', desc: 'Water and wind, rain, thunder and the foghorn.', min: 0, max: 1, step: 0.05, fmt: pct },
    { k: 'uiVol', t: 'slider', label: 'Interface', desc: 'Menu clicks.', min: 0, max: 1, step: 0.05, fmt: pct },
    { k: 'sonarPing', t: 'toggle', label: 'Fish finder ping', desc: 'A soft ping every few seconds while the fish finder panel is showing.' },
    { k: 'muteBlur', t: 'toggle', label: 'Mute when unfocused', desc: 'Silence the game while the window is in the background or minimised.' },
  ],
  display: [
    { h: 'On screen' },
    { k: 'compass', t: 'toggle', label: 'Compass bar and waypoints', desc: 'Heading tape along the top; waypoints ride it with their distance.' },
    { k: 'sonar', t: 'toggle', label: 'Fish finder panel', desc: 'The sonar panel at the bottom right (hidden on foot either way).' },
    { k: 'depthReadout', t: 'toggle', label: 'Depth and line readouts', desc: 'The depth on the fish finder, the distance and depth on the lure marker, and line out while fighting.' },
    { k: 'hints', t: 'toggle', label: 'Hint prompts', desc: 'Key prompts at the bottom of the screen and the mouse-look hint.' },
    { k: 'hudScale', t: 'slider', label: 'HUD size', desc: 'Scales the on-screen text and panels.', min: 0.8, max: 1.4, step: 0.05, fmt: pct },
    { k: 'hudOpacity', t: 'slider', label: 'HUD opacity', desc: 'Fades the on-screen text and panels so the water shows through.', min: 0.3, max: 1, step: 0.05, fmt: pct },
    { h: 'Units' },
    { k: 'unitDist', t: 'seg', label: 'Distance and depth', desc: 'Metres or feet for depth, line out, cast range and chart distances.', opts: [['m', 'Metres'], ['ft', 'Feet']] },
    { k: 'unitWeight', t: 'seg', label: 'Weight and fish length', desc: 'Pounds and inches, or kilograms and centimetres, for catches, tension and drag.', opts: [['lb', 'lb / in'], ['kg', 'kg / cm']] },
    { k: 'unitSpeed', t: 'seg', label: 'Boat speed', desc: 'Knots, miles per hour or kilometres per hour.', opts: [['kn', 'Knots'], ['mph', 'mph'], ['kmh', 'km/h']] },
  ],
  access: [
    { k: 'reduceMotion', t: 'toggle', label: 'Reduce motion', desc: 'The camera stays level on the swell and no longer bobs as you walk.' },
    { k: 'reduceFlash', t: 'toggle', label: 'Reduce flashes', desc: 'Softens the full-screen lightning flash to a faint pulse.' },
    { k: 'safeColors', t: 'toggle', label: 'Colour-safe markers', desc: 'Swaps the red and green warning colours (line tension, strike marker, good/bad) for blue and magenta that stay distinct for colour-blind players.' },
    { k: 'bigText', t: 'toggle', label: 'Larger text', desc: 'Bigger HUD text and menus (on top of the HUD size slider).' },
  ],
};
const TABS = [['gameplay', 'Gameplay'], ['controls', 'Controls'], ['graphics', 'Graphics'], ['audio', 'Audio'], ['display', 'Display'], ['access', 'Accessibility']];
const TAB_KEYS = {
  gameplay: ['mouseLock', 'severeWeather', 'biteQuality', 'devTools'],
  controls: ['lookSpeed', 'invertY', 'binds'],
  graphics: ['preset', ...GFX_KEYS, 'fov', 'fps'],
  audio: ['volume', 'sfxVol', 'ambVol', 'uiVol', 'sonarPing', 'muteBlur'],
  display: ['compass', 'sonar', 'depthReadout', 'hints', 'hudScale', 'hudOpacity', 'unitDist', 'unitWeight', 'unitSpeed'],
  access: ['reduceMotion', 'reduceFlash', 'safeColors', 'bigText'],
};
const FIXED_KEYS = [['Esc / Tab', 'Open and close the menus'], ['1 - 9', 'Tie on the lure in that tackle-box slot'], ['Left mouse', 'Cast (hold to power, release), reel, set the hook'], ['Mouse wheel', 'Drag setting (boat overview: zoom)'], ['Right-drag', 'Look around when Mouse look is off']];

export class SettingsPanel {
  constructor(ui) {
    this.ui = ui;
    this.cap = null;        // action being rebound
    this.pending = null;    // { id, key, other } waiting for Swap / Cancel
    this.msg = null;        // [text, kind]
    this.armed = null;      // two-click reset in progress
    this.row = -2;          // keyboard focus: -2 none, -1 tab bar, 0.. rows
  }

  get g() { return this.ui.g; }
  opened() { this.cap = null; this.pending = null; this.msg = null; this.armed = null; this.row = -2; }
  closed() { this.cap = null; this.pending = null; this.armed = null; }
  get capturing() { return !!this.cap; }
  get tabId() { return this.ui.tab.settings || 'gameplay'; }

  // ---------------------------------------------------------------- render
  render() {
    const s = this.g.settings, tab = this.tabId;
    const tabs = `<div class="tabs st-tabs">${TABS.map(([id, label]) => `<button class="${id === tab ? 'on' : ''}" data-act="st-tab" data-id="${id}">${label}</button>`).join('')}</div>`;
    const body = tab === 'controls' ? this.controls(s) : this.options(OPTS[tab], s);
    const reload = this.needsReload(s) ? `<div class="st-reload"><span>Wave resolution, mesh detail or hands changed: they only take effect when the world is rebuilt.</span><button class="btn gold" data-act="st-reload">Restart now</button></div>` : '';
    const danger = tab === 'gameplay' ? `<div class="st-danger"><button class="btn" data-act="reset">Reset all progress</button><span>Erases your save (settings are kept).</span></div>` : '';
    const armedTab = this.armed === 'tab', armedAll = this.armed === 'all';
    return `<div class="m-head"><h2>Settings</h2><span>Saved as you change them<span class="x" data-act="close">Back</span></span></div>
      ${tabs}<div class="st-body">${body}</div>${reload}${danger}
      <div class="actions st-actions"><button class="btn primary" data-act="close">Done</button>
        <button class="btn ${armedTab ? 'gold' : ''}" data-act="st-reset-tab">${armedTab ? 'Click again to reset this tab' : 'Reset this tab'}</button>
        <button class="btn ${armedAll ? 'gold' : ''}" data-act="st-reset-all">${armedAll ? 'Click again to reset everything' : 'Reset all settings'}</button>
        <span class="st-keys">←→ change · ↑↓ move · PgUp/PgDn tabs</span></div>`;
  }

  needsReload(s) { return s.fft !== BOOT.fft || s.meshDetail !== BOOT.meshDetail || String(s.hands) !== HANDS_BOOT; }

  options(list, s) {
    let i = 0;
    return `<div class="st-list">${list.map((o) => {
      if (o.h) return `<h5 class="st-h">${esc(o.h)}</h5>`;
      return this.row_(o, s, i++);
    }).join('')}</div>`;
  }

  row_(o, s, i) {
    const v = s[o.k], dim = o.needs && !s[o.needs] ? ' dim' : '';
    let ctl;
    if (o.t === 'slider') ctl = `<input type="range" data-set="${o.k}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}"><output>${o.fmt(v)}</output>`;
    else if (o.t === 'toggle') ctl = `<button class="tgl ${v ? 'on' : ''}" role="switch" aria-checked="${!!v}" data-act="st-toggle" data-k="${o.k}"><i></i><span>${v ? 'On' : 'Off'}</span></button>`;
    else ctl = `<div class="seg ${o.preset ? 'preset' : ''}">${o.opts.map(([val, label]) => `<button class="${val === v ? 'on' : ''}" data-act="st-seg" data-k="${o.k}" data-v="${val}">${label}</button>`).join('')}</div>`;
    return `<div class="st-row${dim}" data-row="${i}" data-k="${o.k}"><div class="st-text"><b>${esc(o.label)}${o.reload ? '<em>needs reload</em>' : ''}</b><span>${esc(o.desc)}</span></div><div class="st-ctl t-${o.t}">${ctl}</div></div>`;
  }

  controls(s) {
    const { map } = resolveBinds(s.binds);
    let i = 0;
    const top = [
      { k: 'lookSpeed', t: 'slider', label: 'Mouse sensitivity', desc: 'How far the view turns per mouse movement.', min: 0.3, max: 2.5, step: 0.05, fmt: times },
      { k: 'invertY', t: 'toggle', label: 'Invert look up / down', desc: 'Push the mouse forward to look down.' },
    ].map((o) => this.row_(o, s, i++)).join('');
    const note = this.pending
      ? `<div class="st-msg bad"><b>${esc(keyLabel(this.pending.key))}</b> is already <b>${esc(ACTION[this.pending.other].label)}</b>.<button class="btn gold" data-act="st-swap">Swap keys</button><button class="btn" data-act="st-cancel">Cancel</button></div>`
      : this.cap ? `<div class="st-msg">Press the new key for <b>${esc(ACTION[this.cap].label)}</b>. Esc cancels.${this.msg && this.msg[1] === 'bad' ? ` <span class="bad">${esc(this.msg[0])}</span>` : ''}</div>`
      : this.msg ? `<div class="st-msg ${this.msg[1] || ''}">${esc(this.msg[0])}</div>` : '<div class="st-msg faint">Click an action, then press the key you want. Taken keys can be swapped.</div>';
    const groups = GROUPS.map((gr) => `<div class="kb-group"><h5 class="st-h">${gr}</h5>${ACTIONS.filter((a) => a[2] === gr).map(([id, label]) => {
      const k = map[id], custom = k !== DEFAULT_BINDS[id], capt = this.cap === id;
      return `<div class="st-row kb-row" data-row="${i++}" data-id="${id}"><div class="st-text"><b>${esc(label)}</b></div><div class="st-ctl"><button class="kb ${capt ? 'capture' : ''} ${custom ? 'custom' : ''}" data-act="st-bind" data-id="${id}" title="${custom ? 'Default: ' + esc(keyLabel(DEFAULT_BINDS[id])) : 'Default key'}">${capt ? 'press a key' : esc(keyLabel(k))}</button></div></div>`;
    }).join('')}</div>`).join('');
    const fixed = `<div class="kb-group"><h5 class="st-h">Fixed</h5>${FIXED_KEYS.map(([k, d]) => `<div class="st-row fixed"><div class="st-text"><b>${esc(d)}</b></div><div class="st-ctl"><span class="kb locked">${k}</span></div></div>`).join('')}</div>`;
    return `<div class="st-list">${top}</div>${note}<div class="kb-grid">${groups}${fixed}</div>`;
  }

  // paint (keeping the scroll position and keyboard focus)
  draw() {
    const card = document.getElementById('modalCard'), top = card.scrollTop;
    card.innerHTML = this.render();
    card.scrollTop = top;
    this.focusRow();
  }

  // ---------------------------------------------------------------- change values
  set(patch) { this.armed = null; this.g.applySettings(patch); }

  // sliders: update in place (re-rendering would drop the drag)
  onInput(e) {
    const t = e.target.closest('[data-set]');
    if (!t) return false;
    const k = t.dataset.set, o = this.find(k);
    this.set({ [k]: +t.value });
    const out = t.parentElement.querySelector('output');
    if (out && o) out.textContent = o.fmt(this.g.settings[k]);
    this.syncPreset();
    return true;
  }

  // the preset selector follows slider edits live
  syncPreset() {
    const p = this.g.settings.preset;
    document.querySelectorAll('[data-k="preset"] .seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === p));
    document.querySelectorAll('#modalCard [data-act="st-seg"][data-k="preset"]').forEach((b) => b.classList.toggle('on', b.dataset.v === p));
    const card = document.getElementById('modalCard'), need = this.needsReload(this.g.settings);
    if (!!card.querySelector('.st-reload') !== need) this.draw();
  }

  find(k) {
    for (const list of Object.values(OPTS)) for (const o of list) if (o.k === k) return o;
    return null;
  }

  // ---------------------------------------------------------------- clicks
  click(act, d) {
    const g = this.g;
    if (this.cap && act !== 'st-bind') { this.cap = null; this.msg = null; }
    switch (act) {
      case 'st-tab': this.ui.tab.settings = d.id; this.cap = null; this.pending = null; this.msg = null; this.armed = null; this.row = -2; this.draw(); break;
      case 'st-toggle': this.set({ [d.k]: !g.settings[d.k] }); this.draw(); break;
      case 'st-seg': {
        const o = this.find(d.k), raw = o.opts.find(([v]) => String(v) === d.v)[0];
        this.set(d.k === 'hands' ? { hands: raw, handsPicked: true } : { [d.k]: raw });
        this.draw();
        break;
      }
      case 'st-bind': this.cap = d.id; this.pending = null; this.msg = null; this.draw(); break;
      case 'st-swap': this.applyBind(this.pending.id, this.pending.key, true); break;
      case 'st-cancel': this.pending = null; this.msg = ['Left as it was.', '']; this.draw(); break;
      case 'st-reset-tab': case 'st-reset-all': {
        const which = act === 'st-reset-tab' ? 'tab' : 'all';
        if (this.armed !== which) { this.armed = which; this.draw(); break; }
        const keys = which === 'all' ? Object.keys(DEFAULT_SETTINGS).filter((k) => k !== 'v') : TAB_KEYS[this.tabId];
        const patch = {};
        for (const k of keys) patch[k] = k === 'binds' ? {} : DEFAULT_SETTINGS[k];
        if (which === 'all' || this.tabId === 'graphics') Object.assign(patch, PRESETS.high, { preset: 'high' });
        this.cap = null; this.pending = null; this.msg = [which === 'all' ? 'All settings are back to their defaults.' : 'This tab is back to its defaults.', 'ok'];
        this.set(patch);
        this.draw();
        break;
      }
      case 'st-reload': writeSave(g.save); location.reload(); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- rebinding
  capture(ev) {
    ev.preventDefault(); ev.stopPropagation();
    if (ev.repeat) return;
    const k = keyName(ev), id = this.cap;
    if (k === 'escape') { this.cap = null; this.msg = ['Cancelled.', '']; this.draw(); return; }
    const why = reservedReason(k);
    if (why) { this.msg = [why, 'bad']; this.draw(); return; }   // keep listening
    this.applyBind(id, k, false);
  }

  applyBind(id, key, swap) {
    const res = assign(this.g.settings.binds, id, key, swap);
    this.cap = null;
    if (res.conflict) { this.pending = { id, key, other: res.conflict }; this.msg = null; this.draw(); return; }
    this.pending = null;
    this.msg = [res.swapped ? `${ACTION[id].label} is now ${keyLabel(key)}; ${ACTION[res.swapped].label} took ${keyLabel(resolveBinds(res.overrides).map[res.swapped])}.` : `${ACTION[id].label} is now ${keyLabel(key)}.`, 'ok'];
    this.set({ binds: res.overrides });
    this.draw();
  }

  // ---------------------------------------------------------------- keyboard
  rows() { return [...document.querySelectorAll('#modalCard .st-row[data-row]')]; }

  focusRow() {
    document.querySelectorAll('#modalCard .st-row.focus, #modalCard .st-tabs.focus').forEach((el) => el.classList.remove('focus'));
    if (this.row === -1) document.querySelector('#modalCard .st-tabs')?.classList.add('focus');
    else if (this.row >= 0) { const el = this.rows()[this.row]; if (el) { el.classList.add('focus'); el.scrollIntoView({ block: 'nearest' }); } }
  }

  // returns true when the key was used
  key(ev, k) {
    const tabIds = TABS.map((t) => t[0]), ti = tabIds.indexOf(this.tabId);
    const go = (id) => { this.ui.tab.settings = id; this.cap = null; this.pending = null; this.msg = null; this.armed = null; this.draw(); };
    if (k === 'pagedown') { go(tabIds[(ti + 1) % tabIds.length]); return true; }
    if (k === 'pageup') { go(tabIds[(ti + tabIds.length - 1) % tabIds.length]); return true; }
    const rows = this.rows();
    if (k === 'arrowdown') { this.row = Math.min(rows.length - 1, this.row + 1); this.focusRow(); return true; }
    if (k === 'arrowup') { this.row = Math.max(-1, this.row - 1); this.focusRow(); return true; }
    if (this.row === -1 && (k === 'arrowleft' || k === 'arrowright')) { go(tabIds[(ti + (k === 'arrowright' ? 1 : tabIds.length - 1)) % tabIds.length]); return true; }
    const el = rows[this.row];
    if (!el) return false;
    const dir = k === 'arrowright' ? 1 : k === 'arrowleft' ? -1 : 0;
    const range = el.querySelector('input[type=range]');
    if (range && dir) {
      const step = +range.step, v = Math.min(+range.max, Math.max(+range.min, +range.value + dir * step * (ev.shiftKey ? 5 : 1)));
      range.value = v; this.onInput({ target: range }); return true;
    }
    const seg = el.querySelector('.seg');
    if (seg && dir) {
      const btns = [...seg.querySelectorAll('button')], cur = btns.findIndex((b) => b.classList.contains('on'));
      const nxt = btns[Math.min(btns.length - 1, Math.max(0, cur + dir))];
      if (nxt && nxt !== btns[cur]) this.click('st-seg', nxt.dataset);
      return true;
    }
    const sw = el.querySelector('.tgl');
    if (sw && (dir || k === 'enter' || k === 'space')) { this.click('st-toggle', sw.dataset); return true; }
    const kb = el.querySelector('.kb[data-act]');
    if (kb && (k === 'enter' || k === 'space')) { this.click('st-bind', kb.dataset); return true; }
    return false;
  }
}

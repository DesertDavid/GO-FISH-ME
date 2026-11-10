import { RODS, REELS, LINES, LURES, BOATS, BOAT_ORDER } from './gear.js';
import { LOCATIONS, LOCATION_ORDER } from './locations.js';
import { SPECIES, SPECIES_BY_ID, MORPHS, CATALOG_SIZE } from './species.js';
import { hintFor } from './bait.js';
import { TUNING as BAIT } from './baitData.js';
import { catalogCount } from './save.js';
import { wellSlots, holdCap, holdLb, holdCount, holdCondition, holdTone, holdValue, holdUnits, planHaul } from './livewell.js';
import { PALETTES, SLOTS, SLOT_LABEL, SLOT_LABEL_BOAT, WEAR_NAMES, UPGRADES, upgradesFor, upgradePrice, upgradeLevel, paintCost, customOf, cleanName, makeReg, NAME_MAX } from './boatCustom.js';
import { BoatPreview } from './boatPreview.js';
import { levelInfo, gateLevel, meets, unlocksAt, MAX_LEVEL, xpAt, GATES, reelSmooth, lineCastMul, permitLeft, permitText, permitPrice, PERMIT_OPTIONS, respoolCost, SHARPEN_COST, restockCost, wearWord, effectiveTest, WEAR_DEFAULT } from './progress.js';
import { freezeSaves, writeSave } from './save.js';
import { TIERS } from './dialogue.js';
import { listSlots, putSlot, deleteSlot, summarize, fmtPlayed, fmtWhen, parseFile, downloadFile, pickFile, installAsLive, diskBackup } from './saveSlots.js';
import { MODEL_CREDITS } from './creditsData.js';
import { SettingsPanel } from './settingsUi.js';
import { ACTION_IDS, ACTION, keyLabel, rewriteKeys } from './keys.js';
import * as U from './units.js';
import { CAPACITY, trophyCount, bestPerSpecies, bestPerWater, medalCounts, PLACE, SAY } from './trophyData.js';

const $ = (id) => document.getElementById(id);
const DEAL_ACTS = new Set(['buy', 'buyboat', 'permit', 'service', 'sellone', 'sellall', 'sellhold', 'sellspecies', 'unlock']);
const money = (n) => '$' + Math.round(n).toLocaleString();
const money2 = (n) => '$' + n.toFixed(2);
const lbs = (lb) => U.weight(lb);       // fish weight in the player's units (Settings > Display)
const inches = (i) => U.length(i);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MORPH_COLORS = { normal: '#9fb4bd', golden: '#f0c040', albino: '#fff2ee', leucistic: '#e8eef0', melanistic: '#222', piebald: 'linear-gradient(90deg,#fff 50%,#556 50%)', calico: 'linear-gradient(90deg,#e86a18 33%,#111 33% 66%,#fff 66%)', blue: '#4a7ac0', ghost: 'rgba(230,240,245,0.5)', copper: '#c87a40', tiger: 'repeating-linear-gradient(90deg,#8a7 0 3px,#222 3px 5px)', spotted: 'radial-gradient(#111 30%,#c8a050 32%)', rose: '#f08aa8', emerald: '#1a9a5a', chrome: 'linear-gradient(135deg,#fff,#8a929a)', sunset: 'linear-gradient(#5a1a6a,#f06020,#ffd040)' };

export class UI {
  constructor(game) {
    this.g = game;
    this.panel = null;
    this.tab = {};
    this.catchInfo = null;
    this.settingsPanel = new SettingsPanel(this);
    document.querySelectorAll('#topRight [data-open]').forEach((b) => b.addEventListener('click', () => this.open(b.dataset.open)));
    $('modal').addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (t) { this.g.audio.play('ui'); this.action(t.dataset.act, t.dataset); return; }
      if (e.target.id === 'modal' && this.panel !== 'catch' && this.panel !== 'haul') this.close();
    });
    // settings sliders/toggles apply live
    $('modal').addEventListener('input', (e) => {
      const cu = e.target.closest('[data-cu]');
      if (cu && this.yard?.draft) {
        const v = cleanName(cu.value);
        if (v !== cu.value) cu.value = v;
        this.yard.draft.name = v;
        clearTimeout(this.yardT); this.yardT = setTimeout(() => this.yardView(), 140);
        this.yardButtons();
        return;
      }
      this.settingsPanel.onInput(e);
    });
  }

  get capturing() { return this.settingsPanel.capturing; }

  renderSettings() { return this.settingsPanel.render(); }

  isOpen() { return !!this.panel; }

  loading(p, text) {
    $('ldBar').style.width = `${Math.round(p * 100)}%`;
    if (text) $('ldText').textContent = text;
  }

  ready() {
    $('loading').hidden = true;
    $('hud').hidden = false;
  }

  toast(msg, kind = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = this.g.binds ? rewriteKeys(msg, this.g.binds.map) : msg;
    $('toasts').prepend(el);
    setTimeout(() => el.remove(), kind === 'bad' ? 3800 : 3000);
    while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
  }

  strike(on) { $('strike').hidden = !on; }

  fpsShow(on) {
    let el = $('fps');
    if (!el && on) { el = document.createElement('div'); el.id = 'fps'; $('hud').appendChild(el); }
    if (el) el.hidden = !on;
  }

  fpsText(t) { const el = $('fps'); if (el && el.textContent !== t) el.textContent = t; }

  lookHint(show) {
    let el = $('lookHint');
    if (show && this.g.settings && !this.g.settings.hints) show = false;
    if (!el) {
      el = document.createElement('div');
      el.id = 'lookHint';
      el.textContent = 'Click the water to look around with the mouse · Esc frees the mouse';
      $('hud').appendChild(el);
    }
    el.hidden = !show;
  }

  // key prompts at the bottom of the screen: [[key, text], ...]
  shoreHint(hints) {
    if (this.g.settings && !this.g.settings.hints) hints = [];   // Settings > Display > Hint prompts
    let el = $('shoreHint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shoreHint';
      $('hud').appendChild(el);
    }
    const t = JSON.stringify(hints);
    if (el.dataset.t === t) return;
    el.dataset.t = t;
    el.hidden = !hints.length;
    el.innerHTML = hints.map(([k, text]) => `<span><kbd>${k}</kbd>${esc(text)}</span>`).join('');
  }

  leaderboard(t) {
    const el = $('leaderboard');
    if (!t) { el.hidden = true; return; }
    el.hidden = false;
    const left = Math.max(0, Math.ceil(t.left));
    const rows = t.standings().slice(0, 6);
    const mine = t.standings().findIndex((r) => r.you) + 1;
    const unit = (s) => (s ? U.force(s, 2) : '-');
    el.innerHTML = `<h5>${esc(t.def.name)}</h5><div class="lb-time">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left · you're #${mine}</div>`
      + rows.map((r, i) => `<div class="lb-row ${r.you ? 'you' : ''}"><span>${i + 1}. ${esc(r.name)}</span><b>${unit(r.score)}</b></div>`).join('')
      + (mine > 6 ? `<div class="lb-row you"><span>${mine}. You</span><b>${unit(t.standings()[mine - 1].score)}</b></div>` : '');
  }

  renderEvents() {
    const g = this.g, active = g.tour;
    const items = g.tournaments().map((t) => {
      const btn = active ? (active.def.id === t.id ? '<span class="small" style="color:var(--accent)">In progress</span>' : '<span class="small">One at a time</span>')
        : `<button class="btn gold" data-act="enter" data-id="${t.id}" ${g.save.cash < t.fee ? 'disabled' : ''}>Enter ${money(t.fee)}</button>`;
      return `<div class="item"><h4>${esc(t.name)}</h4><div class="stats">${esc(t.text)}</div><div class="stats">${t.minutes} min · 8 rivals · prizes <b>${money(t.fee * 8)}</b> / <b>${money(t.fee * 4)}</b> / <b>${money(t.fee * 2)}</b></div><div class="foot"><span class="price">Entry ${money(t.fee)}</span>${btn}</div></div>`;
    }).join('');
    const trophies = (g.save.trophies || []).filter((x) => x.place <= 3).length;
    return this.head('Tournaments', `${trophies} podium finish${trophies === 1 ? '' : 'es'}`) + `<div class="grid">${items}</div><p class="tips">Every fish you land during the event is weighed at the boat, kept or released. New events every game day. Travelling forfeits a running tournament.</p>`;
  }

  renderTourResult() {
    const r = this.g.tourResult;
    return `<div class="m-head"><h2>${esc(r.def.name)}: ${r.place}${['st', 'nd', 'rd'][r.place - 1] || 'th'} place</h2><span>${r.prize ? money(r.prize) : ''}</span></div>
      <table class="haul"><tr><th>Angler</th><th>Score</th></tr>${r.rows.map((x, i) => `<tr${x.you ? ' style="color:var(--orange)"' : ''}><td>${i + 1}. ${esc(x.name)}</td><td>${x.score ? U.force(x.score, 2) : '-'}</td></tr>`).join('')}</table>
      <p class="tips">${r.prize ? `Prize money: <b>${money(r.prize)}</b>` : 'No prize this time - top three get paid.'} <b>+${r.xp} xp</b></p>
      <div class="actions"><button class="btn primary" data-act="close">Back to fishing</button></div>`;
  }

  // challenges live in the Esc menu now; the HUD only hears about them through messages
  challenges() {
    $('challenges').hidden = true;
  }

  weather(w, biteFactor) {
    $('hWeather').textContent = w.name;
    const label = biteFactor > 1.3 ? 'fish are biting hard' : biteFactor > 1.05 ? 'good bite' : biteFactor < 0.85 ? 'slow bite' : '';
    $('hBite').textContent = label;
  }

  // tide line (coastal only) and the one-line warning for fog / squalls; text null hides it
  tide(text) {
    $('hTide').textContent = text || '';
    $('hTideRow').hidden = !text;
  }

  alert(text, kind = '') {
    if (text === this._alert && kind === this._alertKind) return;
    this._alert = text; this._alertKind = kind;
    const el = $('hAlert');
    el.hidden = !text;
    if (text) el.textContent = text;
    el.className = kind;
  }

  // ring + label over the lure/bobber; pos null hides it
  lureMarker(pos, camera, label, mode) {
    const el = $('lureMarker');
    if (!pos) { if (!el.hidden) el.hidden = true; return; }
    const p = pos.clone().project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) { el.hidden = true; return; }
    el.hidden = false;
    el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    el.className = mode;
    const span = el.lastChild;
    const text = mode === 'strike' ? 'Strike' : mode === 'nibble' ? 'Nibble' : label;
    if (span.textContent !== text) span.textContent = text;
  }

  power(p) {
    $('power').hidden = p == null;
    if (p != null) $('power').querySelector('i').style.width = `${p * 100}%`;
  }

  fight(on, fish) {
    $('fightPanel').hidden = !on;
    $('crosshair').hidden = on;
    if (on) $('fpFish').textContent = 'Fish on';
  }

  // line-tension instrument: a half-circle scale in tens of percent of the line's rating, needle, a red
  // mark at the breaking strength and a small pointer where the drag is set (slip starts there)
  drawDial(s) {
    const cv = $('fpDial'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const cx = W / 2, cy = H - 14, R = H - 38, max = 1.25;
    g.clearRect(0, 0, W, H);
    const ang = (f) => Math.PI + Math.PI * Math.min(1, Math.max(0, f / max));
    const load = s.tension / s.test;
    const col = load > 1 ? '#ef6b57' : s.warn ? '#e9b25b' : '#f2efe8';
    g.lineCap = 'butt';
    // scale: 5% ticks, a long tick every 25%
    for (let i = 0; i <= 25; i++) {
      const f = i * 0.05, a = ang(f), long = i % 5 === 0, red = Math.abs(f - 1) < 0.01;
      g.strokeStyle = red ? '#ef6b57' : f <= load ? col : 'rgba(242,239,232,0.7)';
      g.lineWidth = red ? 5 : long ? 3 : 2;
      const r0 = R - (long || red ? 16 : 9);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
    }
    // the load, as a thin arc inside the ticks
    g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R - 24, Math.PI, ang(load)); g.stroke();
    // drag pointer (outside the scale)
    const da = ang(s.drag / s.test), d0 = R + 4, d1 = R + 16;
    g.fillStyle = s.slip > 0 ? '#e9b25b' : 'rgba(242,239,232,0.75)';
    g.beginPath(); g.moveTo(cx + Math.cos(da) * d0, cy + Math.sin(da) * d0);
    g.lineTo(cx + Math.cos(da - 0.045) * d1, cy + Math.sin(da - 0.045) * d1); g.lineTo(cx + Math.cos(da + 0.045) * d1, cy + Math.sin(da + 0.045) * d1); g.fill();
    // needle
    const na = ang(load);
    g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx + Math.cos(na) * (R - 40), cy + Math.sin(na) * (R - 40)); g.lineTo(cx + Math.cos(na) * (R - 4), cy + Math.sin(na) * (R - 4)); g.stroke();
    // scale labels in the line's own units: half and full rating
    g.fillStyle = 'rgba(242,239,232,0.8)'; g.font = '20px "B612 Mono", monospace'; g.textAlign = 'center';
    for (const f of [0, 0.5, 1]) { const a = ang(f), r = R - 36; g.fillText(U.forceN(s.test * f, 0), cx + Math.cos(a) * r, cy + Math.sin(a) * r + (f === 0.5 ? 2 : -2)); }
  }

  fightTick(s) {
    this.drawDial(s);
    $('fpTen').textContent = U.forceN(s.tension);
    $('fpUnit').textContent = U.forceUnit();
    $('fpSlip').classList.toggle('on', s.slip > 0);
    $('fpWarn').classList.toggle('on', !!s.warn);
    $('fpDial').parentElement.classList.toggle('warn', !!s.warn);
    $('fpStamina').style.width = `${s.stamina * 100}%`;
    $('fpStaminaTxt').textContent = `${Math.round(s.stamina * 100)}%`;
    $('fpDrag').textContent = `${U.forceN(s.drag)} / ${U.forceN(s.maxDrag, 0)} ${U.forceUnit()}`;
    const showLine = this.g.settings.depthReadout !== false;   // Settings > Display > Depth and line readouts
    $('fpLine').parentElement.hidden = !showLine;
    $('fpLine').textContent = `${U.depthN(s.lineOut)} / ${U.depthN(s.cap)} ${U.distUnit()}`;
    $('fpLeft').classList.toggle('on', s.fishSide > 0);
    $('fpRight').classList.toggle('on', s.fishSide < 0);
    $('fpHint').textContent = s.runWarn ? 'It\'s running, stop reeling' : s.overload > 0.4 ? 'Line\'s about to go, ease the drag' : s.warn ? 'Line near its limit' : s.lineOut > s.cap * 0.85 ? 'Running out of line' : s.stamina < 0.32 ? 'It\'s tired, bring it in' : '';
    $('fpHint').style.color = s.runWarn || s.overload > 0.4 ? 'var(--red)' : s.warn ? 'var(--amber)' : '';
  }

  netTick(state, total, cap, type, turned) {
    const el = $('netPanel');
    if (state === 'stowed' || state == null) { el.hidden = true; return; }
    el.hidden = false;
    const label = { deploying: 'Shooting net…', fishing: type === 'trawl' ? 'Towing - keep 1-4 m/s through the schools' : `Circling: ${Math.round((turned / (Math.PI * 2)) * 360)}° - press N to purse`, hauling: 'Hauling back…' }[state];
    el.innerHTML = `<b>${type === 'trawl' ? 'TRAWL' : 'PURSE SEINE'}</b> · ${label}<div class="bar" style="margin-top:6px"><i style="width:${(total / cap) * 100}%;background:var(--accent)"></i></div><span class="small">${Math.round(total).toLocaleString()} / ${cap.toLocaleString()} lb · press N to haul</span>`;
  }

  // small amber "+n xp" next to the level readout
  xpGain(n) {
    const el = $('hLevel');
    if (!el) return;
    let t = el.querySelector('.gain');
    if (!t) { t = document.createElement('em'); t.className = 'gain'; el.appendChild(t); }
    t.textContent = `+${n} xp`;
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  }

  levelUp(level, unlocks) {
    let el = $('levelUp');
    if (!el) { el = document.createElement('div'); el.id = 'levelUp'; $('hud').appendChild(el); }
    const list = unlocks.length ? `<span>${unlocks.map((u) => `${esc(u.kind)}: ${esc(u.name)}`).join(' · ')}</span>` : '<span>Keep fishing</span>';
    el.innerHTML = `<small>ANGLER LEVEL</small><b>${level}</b>${list}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._luT);
    this._luT = setTimeout(() => el.classList.remove('on'), 5200);
  }

  hud() {
    const g = this.g, s = g.save, loc = g.loc;
    $('hLoc').innerHTML = `${esc(loc.name)}<small>${esc(loc.region)}</small>`;
    const h = g.hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('hTime').textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
    $('hCash').textContent = money(s.cash);
    const li = levelInfo(s.xp || 0);
    $('hLevel').innerHTML = `<span>Lv <b>${li.level}</b></span><i class="xpbar"><i style="width:${Math.round(li.frac * 100)}%"></i></i>`;
    // just the bait you're fishing; speed only while under way
    const e = s.equip;
    const well = s.livewell || [], slots = wellSlots(s.boat, s), weak = well.some((k) => !k.iced && k.health > 0 && k.health < 0.35);
    const hold = s.hold || [];
    const wellTxt = (well.length ? ` · <span class="${weak ? 'warn' : ''}">livewell ${well.length}/${slots}</span>` : '') + (hold.length ? ` · <span class="${hold.some((x) => x.health < 0.35) ? 'warn' : ''}">hold ${Math.round(holdLb(hold)).toLocaleString()} lb</span>` : '');
const pl = permitLeft(s, loc.id), w = s.wear || WEAR_DEFAULT;
    const permitTxt = pl > 0 ? ` · <span class="${pl < 3 ? 'warn' : ''}">permit ${permitText(pl)}</span>` : ' · <span class="warn">no permit</span>';
    const wearTxt = w.line >= 0.5 ? ` · <span class="${w.line >= 0.8 ? 'warn' : ''}">line ${wearWord(w.line).toLowerCase()}</span>` : '';
    $('gearLine').innerHTML = `<b>${esc(LURES[e.lure].name)}</b>${g.troll?.active ? ' · trolling spread out' : ''}${wellTxt}${wearTxt}${permitTxt}`;
    const sp = U.speed(g.boatSpeed());
    $('boatInfo').hidden = Math.abs(g.boatSpeed()) * 1.944 < 1;
    $('boatInfo').innerHTML = `<b>${sp.v.toFixed(0)}</b>${sp.u}`;
  }

  open(panel) {
    if (this.g.fishing.state === 'caught' && panel !== 'catch') return;
    // the shop and the marina are at the docks (the chart shows where)
    if ((panel === 'shop' && !this.g.serviceHere('tackle')) || ((panel === 'marina' || panel === 'yard') && !this.g.serviceHere('boats'))) { if (this.panel) this.close(); return; }
    if (panel === 'trophy' && !this.g.trophyAccess()) { if (this.panel) this.close(); return; }
    if (panel === 'trophy') this.tro = { arm: null, rep: null, ...(this.tro || {}), arm: null };
    if (panel === 'yard') this.yardInit();
    if (panel === 'talk') {
      const k = this.g.keepers?.who();
      if (!k) { this.toast('Nobody to talk to here. Shopkeepers stand at the shop doors on the docks (see the Chart, C).', 'info'); return; }
      this.g.keepers.open(k);
      this.talkExtra = null;
    }
    if (panel === 'settings') this.settingsPanel.opened();
    if (panel === 'saves' && this.sv) { this.sv.armed = null; this.sv.msg = ''; }   // never come back to a half-armed Overwrite/Delete
    this.panel = panel;
    this.g.freePointer?.();   // menus need the cursor
    $('modal').hidden = false;
    $('modal').classList.toggle('catchMode', panel === 'catch');
    $('modalCard').classList.toggle('catch', panel === 'catch');
    $('modal').classList.toggle('pauseMode', panel === 'pause');
    $('modalCard').classList.toggle('pause', panel === 'pause');
    this.render();
  }

  // ---- shopkeeper conversation (words in dialogue.js, logic in keepers.js) ----
  renderTalk() {
    const K = this.g.keepers, t = K.talk, k = t.k, tier = K.tier(k);
    const tn = TIERS[tier], disc = tn.discount && k.role !== 'buyer' ? ` · ${Math.round(tn.discount * 100)}% off permits and service` : '';
    const ch = K.choices(k).concat(this.talkExtra || [], [['bye', 'Goodbye']]);
    this.talkList = ch;
    return this.head(esc(k.d.name), `${esc(k.d.title)} · ${tn.name}${disc}`) + `
      <div class="talk"><p class="say">${esc(t.line)}</p>
      <div class="talk-ch">${ch.map(([id, label], i) => `<button data-act="talk" data-n="${i}"><kbd>${i + 1}</kbd>${esc(label)}</button>`).join('')}</div></div>
      <p class="tips">${esc(this.g.loc.name)} · press the number or click. Esc to leave.</p>`;
  }

  talkPick(i) {
    const K = this.g.keepers, ch = this.talkList && this.talkList[i];
    if (!ch || !K.talk) return;
    const id = ch[0];
    if (id === 'bye') { this.close(); return; }
    if (id === 'shop') { this.tab.shop = 'rods'; this.leaveTalk(true); this.open('shop'); return; }
    if (id === 'permit') { this.tab.shop = 'service'; this.leaveTalk(true); this.open('shop'); return; }
    if (id === 'boats') { this.leaveTalk(true); this.open('marina'); return; }
    if (id === 'sell') { this.leaveTalk(true); this.open('livewell'); return; }
    if (id === 'trophy') { this.leaveTalk(true); this.open('trophy'); return; }
    if (id === 'evpanel') { this.leaveTalk(true); this.open('events'); return; }
    K.reply(id);
    this.talkExtra = id === 'events' ? [['evpanel', 'Show me the entries']] : null;
    this.render();
  }

  leaveTalk(toShop = false) {
    const K = this.g.keepers, t = K.talk;
    if (!t) return;
    if (!toShop) this.say(t.k.d.name, K.bye(t.k));
    t.k.talking = false;
    K.talk = null;
  }

  // a line spoken in the world, at the bottom of the screen for a few seconds
  say(name, text) {
    let el = $('npcSay');
    if (!el) { el = document.createElement('div'); el.id = 'npcSay'; $('hud').appendChild(el); }
    el.innerHTML = `<b>${esc(name)}</b> ${esc(text)}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }

  // Esc menu: everything that used to sit on screen as buttons, plus today's goals
  renderPause() {
    const KL = (a) => keyLabel(this.g.binds.map[a]);
    const items = [['resume', 'Resume', 'Esc'], ['tackle', 'Tackle box', KL('tackle')], ['livewell', 'Livewell & market', KL('livewell')], ['shop', 'Tackle shop', KL('shop')], ['marina', 'Marina', KL('marina')], ...(this.g.serviceHere('boats') ? [['yard', 'Boat yard', '']] : []), ['events', 'Tournaments', KL('events')], ['chart', 'Chart', KL('chart')], ['map', 'Travel', KL('map')], ['journal', 'Journal', KL('journal')], ['angler', 'Angler log', ''], ['saves', 'Save / Load', ''], ['settings', 'Settings', KL('settings')], ['help', 'Controls', KL('help')]];
    const list = items.map(([id, label, key]) => `<button data-act="${id === 'resume' ? 'close' : 'go'}" data-id="${id}">${label}${key ? `<kbd>${key}</kbd>` : ''}</button>`).join('');
    const ch = this.g.save.challenges;
    const goals = ch ? ch.list.map((c) => `<div class="ch ${c.done ? 'done' : ''}"><span>${esc(c.text)}<div class="prog">${c.done ? 'Done' : `${Math.min(c.have, c.need)} of ${c.need}`}</div></span><b>${money(c.reward)}</b></div>`).join('') : '';
    return `<div><div class="pause-title">${esc(this.g.loc.name)} · Day ${this.g.save.day || 1}</div><div class="pause-list">${list}</div></div>
      <div class="pause-side"><div class="lvl-line">Angler level <b>${levelInfo(this.g.save.xp || 0).level}</b><span>${this.xpText()}</span></div><h5>Today's challenges</h5>${goals}<div class="credits-line">3D models: ${MODEL_CREDITS.map((c) => `${esc(c.title)} by ${esc(c.author)} (${esc(c.license)})`).join(', ')}. Details in credits.md.</div></div>`;
  }

  // ---- Save / Load screen ----
  saveSay(text, bad = false) { this.sv = { ...(this.sv || {}), msg: text, bad, armed: null }; if (this.panel === 'saves') this.render(); }

  renderSaves() {
    const sv = this.sv || (this.sv = {});
    if (!sv.diskAsked) { sv.diskAsked = true; diskBackup().then((b) => { sv.disk = b; if (this.panel === 'saves') this.render(); }); }
    const row = (title, when, data, btns, cls = '') => {
      const x = data && summarize(data);
      const body = x ? `<div class="sv-main"><b>${esc(x.location)}</b><span>Lv ${x.level} · ${money(x.cash)} · Day ${x.day} · ${esc(x.places)} · ${esc(x.catalog)}</span></div><div class="sv-time"><span>${fmtPlayed(x.played)} played</span><span>${esc(when)}</span></div>`
        : `<div class="sv-main"><span class="empty">Empty</span></div><div class="sv-time"></div>`;
      return `<div class="sv-row ${cls}"><div class="sv-name">${title}</div>${body}<div class="sv-btns">${btns}</div></div>`;
    };
    const arm = (label, act, n, armedLabel) => `<button class="btn ${sv.armed === `${act}:${n}` ? 'gold' : ''}" data-act="${act}" data-n="${n}">${sv.armed === `${act}:${n}` ? armedLabel : label}</button>`;
    const rows = listSlots().map(({ n, entry }) => row(`Slot ${n}`, entry ? fmtWhen(entry.savedAt) : '', entry && entry.data,
      (entry ? arm('Save', 'sv-save', n, 'Overwrite?') + arm('Load', 'sv-load', n, 'Load it?') + `<button class="btn" data-act="sv-export" data-n="${n}">Export</button>` : `<button class="btn" data-act="sv-save" data-n="${n}">Save</button>`)
      + `<button class="btn" data-act="sv-import" data-n="${n}">Import</button>` + (entry ? arm('Delete', 'sv-del', n, 'Really delete?') : ''))).join('');
    const disk = sv.disk ? row('Disk backup', fmtWhen(sv.disk.savedAt), sv.disk.data, arm('Restore', 'sv-load', 'disk', 'Load it?'), 'dim') : '';
    return this.head('Save / Load', '') + `<div class="sv">
      ${row('Autosave', 'saving as you play', this.g.save, `<button class="btn" data-act="sv-export" data-n="live">Export</button>`, 'live')}
      ${rows}${disk}
      <div class="sv-msg ${sv.bad ? 'bad' : ''}">${sv.msg ? esc(sv.msg) : '&nbsp;'}</div>
    </div>
    <p class="tips">Autosave keeps the game you are in. A slot is a snapshot you can come back to. Export writes a <b>.reelworld</b> file you can keep as a backup or open in another browser. A copy also goes to <b>%LOCALAPPDATA%\\ReelWorld\\saves</b>.</p>
    <div class="actions"><button class="btn primary" data-act="close">Back</button></div>`;
  }

  // the data behind a row id: 'live', a slot number or 'disk'
  saveData(n) {
    if (n === 'live') return this.g.save;
    if (n === 'disk') return this.sv?.disk?.data;
    return listSlots().find((s) => s.n === +n)?.entry?.data;
  }

  async saveAction(act, n) {
    const sv = this.sv || (this.sv = {});
    const key = `${act}:${n}`;
    const needsConfirm = act === 'sv-del' || act === 'sv-load' || (act === 'sv-save' && this.saveData(n));
    if (needsConfirm && sv.armed !== key) { sv.armed = key; this.render(); return; }
    sv.armed = null;
    if (act === 'sv-save') {
      writeSave(this.g.save);
      if (putSlot(n, this.g.save)) this.saveSay(`Saved to slot ${n}.`); else this.saveSay('Could not save: browser storage is full or blocked.', true);
    } else if (act === 'sv-del') {
      deleteSlot(+n);
      this.saveSay(`Slot ${n} deleted.`);
    } else if (act === 'sv-export') {
      const data = this.saveData(n);
      if (!data) return;
      const name = downloadFile(data, n === 'live' ? 'autosave' : `slot${n}`);
      this.saveSay(`Exported ${name} (see your Downloads folder).`);
    } else if (act === 'sv-import') {
      try {
        const text = await pickFile();
        if (text === null) return;
        const data = parseFile(text);
        putSlot(+n, data);
        this.saveSay(`Imported into slot ${n}. Press Load on it to play it.`);
      } catch (err) {
        this.saveSay(err.message || 'Could not import that file.', true);
      }
    } else if (act === 'sv-load') {
      const data = this.saveData(n);
      if (!data) return;
      freezeSaves();
      installAsLive(data);
      this.saveSay('Loading...');
      location.href = location.pathname;
    }
  }

  // grab = take the mouse back for mouse-look. Not when closing with Esc/Tab: that's how
  // players get their cursor out of the game, so it must leave the mouse free.
  close(grab = true) {
    if (this.panel === 'catch' || this.panel === 'haul') return;
    if (this.panel === 'talk') this.leaveTalk();
    this.settingsPanel.closed();
    this.yardStop();
    this.panel = null;
    $('modal').hidden = true;
    if (grab) this.g.grabPointer?.();   // back to mouse-look without an extra click
  }

  forceClose() { this.settingsPanel.closed(); this.yardStop(); this.panel = null; $('modal').hidden = true; this.g.grabPointer?.(); }

  render() {
    const card = $('modalCard');
    const fn = { angler: this.renderAngler, shop: this.renderShop, tackle: this.renderTackle, marina: this.renderMarina, map: this.renderMap, chart: this.renderChart, journal: this.renderJournal, trophy: this.renderTrophy, help: this.renderHelp, catch: this.renderCatch, haul: this.renderHaul, settings: this.renderSettings, events: this.renderEvents, tourResult: this.renderTourResult, pause: this.renderPause, saves: this.renderSaves, livewell: this.renderLivewell, talk: this.renderTalk, yard: this.renderYard }[this.panel];
    if (fn) card.innerHTML = fn.call(this);
    if (this.panel === 'yard') this.yardMount();
    if (this.panel === 'chart') this.g.chart.mount();
  }

  head(title, sub = '') {
    return `<div class="m-head"><h2>${title}</h2><span>${sub}<span class="x" data-act="close">Back</span></span></div>`;
  }

  tabs(group, list) {
    const cur = this.tab[group] || list[0][0];
    return `<div class="tabs">${list.map(([id, label]) => `<button class="${id === cur ? 'on' : ''}" data-act="tab" data-group="${group}" data-id="${id}">${label}</button>`).join('')}</div>`;
  }

  xpText() {
    const li = levelInfo(this.g.save.xp || 0);
    return li.level >= MAX_LEVEL ? 'max level' : `${Math.round(li.into)} / ${Math.round(li.need)} xp`;
  }

  // Angler log: level, what is next, gear condition, permit
  renderAngler() {
    const g = this.g, s = g.save, li = levelInfo(s.xp || 0), w = s.wear || WEAR_DEFAULT;
    const rows = [];
    for (let L = li.level + 1; L <= MAX_LEVEL && rows.length < 6; L++) {
      const u = unlocksAt(L);
      if (u.length) rows.push(`<div class="lv-row"><b>Lv ${L}</b><span>${u.map((x) => `${esc(x.kind)}: ${esc(x.name)}`).join(' · ')}</span><em>${Math.max(0, xpAt(L) - (s.xp || 0)).toLocaleString()} xp to go</em></div>`);
    }
    const pl = permitLeft(s, g.loc.id);
    const bar = (v) => `<div class="cond ${v >= 0.8 ? 'low' : v >= 0.5 ? 'mid' : 'ok'}"><i style="width:${Math.round((1 - v) * 100)}%"></i></div>`;
    return this.head('Angler log', `Level ${li.level}`) + `
      <div class="lv-bar"><i style="width:${Math.round(li.frac * 100)}%"></i></div>
      <div class="lv-sub"><span>${this.xpText()}</span><span>${(s.xp || 0).toLocaleString()} xp total</span></div>
      <h5 class="board-h">Coming up</h5>${rows.join('') || '<p class="small">Top of the ladder. Everything is open.</p>'}
      <h5 class="board-h">Tackle condition</h5>
      <div class="lv-cond"><span>Line (${esc(LINES[s.equip.line].name)})</span>${bar(w.line)}<span class="small">${wearWord(w.line)}</span></div>
      <div class="lv-cond"><span>Hooks</span>${bar(w.hook)}<span class="small">${wearWord(w.hook)}</span></div>
      <h5 class="board-h">Permit: ${esc(g.loc.name)}</h5><p class="small">${pl > 0 ? `Valid, ${permitText(pl)}.` : 'None. Buy one at the tackle shop (B): day, 3-day or week passes.'}</p>
      <p class="tips">XP comes from every fish (bigger, rarer, new species, colour variants and records pay more), daily challenges and tournament finishes. Levels open better tackle, bigger boats and farther waters.</p>
      <div class="actions"><button class="btn primary" data-act="close">Back</button></div>`;
  }

  renderShop() {
    const s = this.g.save, cur = this.tab.shop || 'rods';
    if (cur === 'service') return this.renderService();
    const cats = { rods: [RODS, 'rods', 'rod'], reels: [REELS, 'reels', 'reel'], lines: [LINES, 'lines', 'line'], lures: [LURES, 'lures', 'lure'] };
    const [table, owned] = cats[cur];
    const mine = table[s.equip[cats[cur][2]]];
    const d = (v, k, unit = '', conv = (n) => n) => { if (!mine) return ''; const x = conv(v - mine[k]); return !x ? '' : ` <span class="dl ${x > 0 ? 'up' : 'dn'}">${x > 0 ? '+' : ''}${+x.toFixed(1)}${unit}</span>`; };
    const fc = (n) => (U.units().weight === 'kg' ? n * 0.45359 : n), dc = (n) => (U.units().dist === 'ft' ? n * 3.28084 : n);
    const stat = (id, it) => cur === 'rods' ? `Power <b>${U.force(it.power, 0)}</b>${d(it.power, 'power', '', fc)} · cast <b>${U.depth(it.cast, 0)}</b>${d(it.cast, 'cast', '', dc)} · sensitivity <b>${Math.round(it.sens * 100)}</b>` :
      cur === 'reels' ? `Max drag <b>${U.force(it.drag, 0)}</b>${d(it.drag, 'drag', '', fc)} · ratio <b>${it.ratio}:1</b> · holds <b>${U.depth(it.cap, 0)}</b>${d(it.cap, 'cap', '', dc)} · smoothness <b>${Math.round(reelSmooth(id) * 100)}</b>` :
        cur === 'lines' ? `Breaks at <b>${U.force(it.test, 0)}</b>${d(it.test, 'test', '', fc)} · casts <b>${Math.round(lineCastMul(it.test) * 100)}%</b> · ${it.braid ? 'braid: no stretch, sensitive' : 'mono: stretch absorbs shock'}` :
          `Targets: <b>${dietText(it.diet)}</b> · ${({ s: 'surface', m: 'mid-water', b: 'bottom' })[it.depth]} · ${it.active ? 'retrieve or troll it' : 'let it sit'}`;
    const items = Object.entries(table).map(([id, it]) => {
      const have = s.equip && s[owned].includes(id), need = cur === 'lures' ? 1 : gateLevel(cur, id), lock = !have && !meets(s, cur, id), out = cur === 'lures' && (s.wear?.lost || []).includes(id);
      return `<div class="item ${lock ? 'locked' : ''}"><h4>${esc(it.name)}</h4>${cur === 'rods' && it.model ? `<img class="rodpic" alt="" src="${import.meta.env.BASE_URL}images/rods/${id}.webp">` : ''}<div class="stats">${stat(id, it)}</div><div class="foot"><span class="price">${it.price ? money(it.price) : 'Free'}${need > 1 ? ` <span class="lv">Lv ${need}</span>` : ''}</span>${have ? `<span class="small">${out ? 'Out of stock' : 'Owned'}</span>` : lock ? `<span class="small">Reach level ${need}</span>` : `<button class="btn primary" data-act="buy" data-kind="${owned}" data-id="${id}" ${s.cash < it.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
    }).join('');
    return this.head('Tackle Shop', money(s.cash)) + this.tabs('shop', [['rods', 'Rods'], ['reels', 'Reels'], ['lines', 'Line'], ['lures', 'Lures & Bait'], ['service', 'Service & permits']]) + `<div class="grid">${items}</div><p class="tips">Better tackle opens as your angler level rises. Tip: match line strength to the fish, and keep your drag below the line's breaking strength. Big game needs a heavy reel with lots of line.</p>`;
  }

  // Service & permits tab of the tackle shop
  renderService() {
    const g = this.g, s = g.save, w = s.wear || WEAR_DEFAULT, e = s.equip, loc = g.loc;
    const pl = permitLeft(s, loc.id);
    const permits = PERMIT_OPTIONS.map((o) => { const pr = g.keepers.price(permitPrice(loc, o)); return `<div class="item"><h4>${o.label} permit</h4><div class="foot"><span class="price">${money(pr)}</span><button class="btn gold" data-act="permit" data-id="${o.id}" ${s.cash < pr ? 'disabled' : ''}>Buy</button></div></div>`; }).join('');
    const lineDef = LINES[e.line], rc = g.keepers.price(respoolCost(lineDef)), sharp = g.keepers.price(SHARPEN_COST);
    const lost = (w.lost || []).map((id) => { const c = g.keepers.price(restockCost(LURES[id])); return `<div class="item"><h4>${esc(LURES[id].name)}</h4><div class="stats">Lost on a snag</div><div class="foot"><span class="price">${money(c)}</span><button class="btn primary" data-act="service" data-id="${id}" ${s.cash < c ? 'disabled' : ''}>Restock</button></div></div>`; }).join('');
    const bar = (v) => `<div class="cond ${v >= 0.8 ? 'low' : v >= 0.5 ? 'mid' : 'ok'}"><i style="width:${Math.round((1 - v) * 100)}%"></i></div>`;
    return this.head('Tackle Shop', money(s.cash)) + this.tabs('shop', [['rods', 'Rods'], ['reels', 'Reels'], ['lines', 'Line'], ['lures', 'Lures & Bait'], ['service', 'Service & permits']]) + `
      <h5 class="board-h">Fishing permit: ${esc(loc.name)}</h5>
      <p class="small">${pl > 0 ? `You hold a permit, ${permitText(pl)}. Buying more extends it.` : 'Rangers check the water here. You need a permit to cast, troll or shoot a net.'}</p>
      <div class="grid">${permits}</div>
      <h5 class="board-h">Tackle service</h5>
      <div class="grid">
        <div class="item"><h4>Respool: ${esc(lineDef.name)}</h4><div class="stats">${bar(w.line)} ${wearWord(w.line)} · breaks at <b>${U.forceN(effectiveTest(lineDef.test, w.line), 0)}</b> of ${U.force(lineDef.test, 0)}</div><div class="foot"><span class="price">${money(rc)}</span><button class="btn primary" data-act="service" data-id="line" ${w.line < 0.02 || s.cash < rc ? 'disabled' : ''}>Respool</button></div></div>
        <div class="item"><h4>Sharpen hooks</h4><div class="stats">${bar(w.hook)} ${wearWord(w.hook)} · sets ${Math.round((1 - 0.4 * w.hook) * 100)}% as well as new</div><div class="foot"><span class="price">${money(sharp)}</span><button class="btn primary" data-act="service" data-id="hook" ${w.hook < 0.02 || s.cash < sharp ? 'disabled' : ''}>Sharpen</button></div></div>
        ${lost}
      </div>
      <p class="tips">Line wears with casting and fighting fish, and a frayed line breaks well under its rating. Bottom lures can snag; most come free with a duller hook, some break off and need restocking.</p>`;
  }

  renderTackle() {
    const s = this.g.save, cur = this.tab.tackle || 'rod';
    const cats = { rod: [RODS, 'rods'], reel: [REELS, 'reels'], line: [LINES, 'lines'], lure: [LURES, 'lures'] };
    const [table, owned] = cats[cur];
    const items = s[owned].map((id) => {
      const it = table[id], on = s.equip[cur] === id;
      return `<div class="item ${on ? 'equipped' : ''}"><h4>${esc(it.name)}</h4>${cur === 'rod' && it.model ? `<img class="rodpic" alt="" src="${import.meta.env.BASE_URL}images/rods/${id}.webp">` : ''}<div class="stats">${cur === 'lure' ? `${dietText(it.diet)} · ${({ s: 'surface', m: 'mid', b: 'bottom' })[it.depth]}` : cur === 'rod' ? `${U.force(it.power, 0)} power · ${U.depth(it.cast, 0)} cast` : cur === 'reel' ? `${U.force(it.drag, 0)} drag · ${U.depth(it.cap, 0)}` : `${U.force(it.test, 0)} test`}</div><div class="foot">${on ? '<span class="small" style="color:var(--accent)">Equipped</span>' : `<button class="btn primary" data-act="equip" data-kind="${cur}" data-id="${id}">Equip</button>`}</div></div>`;
    }).join('');
    return this.head('Tackle Box') + this.tabs('tackle', [['rod', 'Rod'], ['reel', 'Reel'], ['line', 'Line'], ['lure', 'Lure']]) + `<div class="grid">${items}</div><p class="tips">Number keys 1-9 swap between your lures quickly while fishing.</p>`;
  }

  // ---- boat yard: paint, lettering and fit-out, with a turntable preview ----
  yardInit() {
    const s = this.g.save;
    if (!this.yard || !s.boats.includes(this.yard.id)) this.yard = { id: s.boat };
    const c = customOf(s, this.yard.id);
    this.yard.draft = { hull: c.hull, stripe: c.stripe, trim: c.trim, bottom: c.bottom, house: c.house, canopy: c.canopy, wear: c.wear, name: c.name, reg: c.reg };
  }

  // the Apply / Undo buttons follow typing without re-rendering (which would drop the text cursor)
  yardButtons() {
    const s = this.g.save, d = this.yard.draft, cur = customOf(s, this.yard.id);
    const dirty = ['hull', 'stripe', 'trim', 'bottom', 'house', 'canopy', 'wear'].some((k) => d[k] !== cur[k]), lettering = d.name !== cur.name || d.reg !== cur.reg;
    const apply = document.querySelector('[data-act="yard-apply"]'), undo = document.querySelector('[data-act="yard-revert"]');
    if (apply) apply.disabled = (!dirty && !lettering) || s.cash < (dirty ? paintCost(this.yard.id) : 0);
    if (undo) undo.disabled = !dirty && !lettering;
  }

  yardCfg() { const y = this.yard; return { ...customOf(this.g.save, y.id), ...y.draft }; }

  yardView() {
    if (!this.yv || this.panel !== 'yard') return;
    const cfg = this.yardCfg();
    if (this.yv.id !== this.yard.id) this.yv.show(this.yard.id, cfg, cfg.up); else this.yv.update(cfg, cfg.up);
  }

  yardMount() {
    if (!this.yv) this.yv = new BoatPreview();
    const m = $('yardMount');
    if (m) m.appendChild(this.yv.canvas);
    this.yv.start();
    if (this.yardShown !== this.yard.id + ':' + this.yardOpenCount) { this.yardShown = this.yard.id + ':' + this.yardOpenCount; this.yardView(); }
  }

  yardStop() { if (this.yv && this.panel === 'yard') { this.yv.stop(); this.yardOpenCount = (this.yardOpenCount || 0) + 1; } }

  renderYard() {
    const g = this.g, s = g.save, y = this.yard, id = y.id, d = y.draft, b = BOATS[id], cur = customOf(s, id);
    const lvl = levelInfo(s.xp || 0).level;
    const tabs = `<div class="tabs">${BOAT_ORDER.filter((k) => s.boats.includes(k)).map((k) => `<button class="${k === id ? 'on' : ''}" data-act="yard-boat" data-id="${k}">${esc(BOATS[k].name)}</button>`).join('')}</div>`;
    const slots = Object.keys(SLOTS[id]).concat(cur.up.shade ? ['canopy'] : []);
    const swatches = slots.map((slot) => {
      const label = SLOT_LABEL_BOAT[id]?.[slot] || SLOT_LABEL[slot];
      const sw = [slot === 'canopy' ? '' : `<button class="sw stock ${!d[slot] ? 'on' : ''}" data-act="yard-paint" data-slot="${slot}" data-pid="" title="As built">built</button>`]
        .concat(PALETTES[slot].map((p) => `<button class="sw ${d[slot] === p.id ? 'on' : ''}" data-act="yard-paint" data-slot="${slot}" data-pid="${p.id}" style="background:#${p.hex.toString(16).padStart(6, '0')}" title="${esc(p.name)}"></button>`));
      const nm = d[slot] ? PALETTES[slot].find((p) => p.id === d[slot])?.name : 'as built';
      return `<div class="sw-row"><span class="sw-l">${label}<em>${esc(nm || '')}</em></span><div class="sw-s">${sw.join('')}</div></div>`;
    }).join('');
    const dirty = ['hull', 'stripe', 'trim', 'bottom', 'house', 'canopy', 'wear'].some((k) => d[k] !== cur[k]);
    const lettering = d.name !== cur.name || d.reg !== cur.reg;
    const cost = dirty ? paintCost(id) : 0;
    const wear = WEAR_NAMES.map((n, i) => `<button class="pill ${d.wear === i ? 'on' : ''}" data-act="yard-wear" data-n="${i}">${n}</button>`).join('');
    const ups = upgradesFor(id).map((u) => {
      const def = UPGRADES[u], t = cur.up[u] || 0, done = t >= def.tiers.length;
      const next = done ? null : def.tiers[t];
      const price = done ? 0 : upgradePrice(id, u, t), need = done ? 0 : upgradeLevel(u, t);
      const btn = done ? '<span class="small" style="color:var(--accent)">Fully fitted</span>' : lvl < need ? `<span class="small">Reach level ${need}</span>` : `<button class="btn gold" data-act="yard-up" data-up="${u}" ${s.cash < price ? 'disabled' : ''}>Fit ${money(price)}</button>`;
      const have = t ? def.tiers[t - 1].name : 'Stock';
      return `<div class="item"><h4>${def.name}${def.tiers.length > 1 ? ` <span class="lv">${t}/${def.tiers.length}</span>` : ''}</h4><div class="stats">${esc(have)}${next ? ` &rarr; <b>${esc(next.name)}</b>` : ''}</div><div class="stats">${esc((next || def.tiers[t - 1]).text)}</div><div class="foot"><span class="price">${done ? '' : money(price)}${next && need > 1 ? ` <span class="lv">Lv ${need}</span>` : ''}</span>${btn}</div></div>`;
    }).join('');
    const none = !dirty && !lettering;
    return this.head('Boat yard', money(s.cash)) + tabs + `<div class="yard">
      <div class="yard-view"><div id="yardMount"></div><span class="yard-hint">Drag to turn · ${esc(b.name)}</span></div>
      <div class="yard-side">
        <div class="yard-name"><label>Name on the transom<input data-cu="name" type="text" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off" value="${esc(d.name)}"></label>
          <label>Bow registration<span class="reg">${esc(d.reg)} <button class="btn" data-act="yard-reg">New numbers</button></span></label></div>
        ${swatches}
        <div class="sw-row"><span class="sw-l">Weathering<em>${WEAR_NAMES[d.wear]}</em></span><div class="pills">${wear}</div></div>
        <div class="actions"><button class="btn primary" data-act="yard-apply" ${none || s.cash < cost ? 'disabled' : ''}>${dirty ? `Paint job ${money(cost)}` : 'Save lettering'}</button><button class="btn" data-act="yard-revert" ${none ? 'disabled' : ''}>Undo</button></div>
      </div></div>
      <h5 class="board-h">Fit-out</h5><div class="grid">${ups}</div>
      <p class="tips">Paint and lettering are kept per boat. A paint job costs ${money(paintCost(id))} whatever the colours; the name and numbers are free. Upgrades go straight onto the boat and are saved with it.</p>`;
  }

  renderMarina() {
    const s = this.g.save;
    const items = BOAT_ORDER.map((id) => {
      const b = BOATS[id], have = s.boats.includes(id), on = s.boat === id;
      const canHere = b.waters.includes(this.g.loc.water);
      const cust = have ? `<button class="btn" data-act="yard-open" data-id="${id}">Paint and fit out</button>` : '';
      let btn;
      if (on) btn = '<span class="small" style="color:var(--accent)">Your boat</span>';
      else if (have) btn = `<button class="btn primary" data-act="boat" data-id="${id}" ${canHere ? '' : 'disabled title="Can\'t run this boat here"'}>Take it out</button>`;
      else if (!meets(s, 'boats', id)) btn = `<span class="small">Reach level ${gateLevel('boats', id)}</span>`;
      else btn = `<button class="btn gold" data-act="buyboat" data-id="${id}" ${s.cash < b.price ? 'disabled' : ''}>Buy ${money(b.price)}</button>`;
      return `<div class="item ${on ? 'equipped' : ''}"><h4>${esc(b.name)}</h4><div class="stats">${esc(b.blurb)}</div><div class="stats">Top speed <b>${Math.round(U.speed(b.speed).v)} ${U.speed(b.speed).u === 'knots' ? 'kn' : U.speed(b.speed).u}</b> · waters <b>${b.waters.join(', ')}</b>${b.net ? ` · <b>${b.net === 'trawl' ? 'trawl net' : 'purse seine'}</b> ${U.weight(b.netCap)}` : ''}</div><div class="foot"><span class="price">${b.price ? money(b.price) : 'Free'}${gateLevel('boats', id) > 1 ? ` <span class="lv">Lv ${gateLevel('boats', id)}</span>` : ''}</span><span>${cust} ${btn}</span></div></div>`;
    }).join('');
    return this.head('Marina', money(s.cash)) + `<div class="grid">${items}</div><p class="tips">Lakes and rivers need a small boat. Offshore locations need a seaworthy one (center console or bigger). Net boats fish commercially: look for diving gulls over bait schools.</p>`;
  }

  renderChart() {
    return this.head(`Chart · ${esc(this.g.loc.name)}`, esc(this.g.loc.region)) + this.g.chart.html();
  }

  renderMap() {
    const s = this.g.save;
    const items = LOCATION_ORDER.map((id) => {
      const l = LOCATIONS[id], open = s.unlocked.includes(id), here = this.g.loc.id === id;
      const boatOk = s.boats.some((b) => BOATS[b].waters.includes(l.water));
      const caught = Object.keys(l.pool).filter((sp) => s.journal[sp]).length;
      let btn;
      if (here) btn = '<span class="small" style="color:var(--accent-2)">You are here</span>';
      else if (!open && !meets(s, 'locs', id)) btn = `<span class="small">Reach level ${gateLevel('locs', id)}</span>`;
      else if (!open) btn = `<button class="btn gold" data-act="unlock" data-id="${id}" ${s.cash < l.price ? 'disabled' : ''}>Open waters ${money(l.price)}</button>`;
      else btn = `<button class="btn primary" data-act="travel" data-id="${id}" ${boatOk ? '' : 'disabled title="You need a boat that can run here"'}>Travel</button>`;
      return `<div class="item loc-card ${here ? 'here' : ''} ${open ? '' : 'locked'}"><img class="loc-pic" src="/images/locations/${id}.webp" alt="" loading="lazy" draggable="false" onerror="this.remove()"><span class="water">${l.water}</span><h4>${esc(l.name)}</h4><div class="stats">${esc(l.region)}</div><div class="stats">${esc(l.blurb)}</div><div class="stats">Species found: <b>${caught} / ${Object.keys(l.pool).length}</b>${boatOk ? '' : ' · <b style="color:var(--bad)">needs a bigger boat</b>'}</div>${open ? `<div class="stats">Permit: <b>${permitText(permitLeft(s, id))}</b></div>` : (meets(s, 'locs', id) ? '' : `<div class="stats">Level <b>${gateLevel('locs', id)}</b> to open</div>`)}<div class="foot"><span></span>${btn}</div></div>`;
    }).join('');
    return this.head('Travel', money(s.cash)) + `<div class="grid">${items}</div>`;
  }

  renderJournal() {
    const s = this.g.save, cur = this.tab.journal || this.g.loc.id;
    const ids = cur === 'all' ? SPECIES.map((sp) => sp.id) : [...new Set([...Object.keys(LOCATIONS[cur].pool), ...Object.keys(LOCATIONS[cur].net || {})])];
    const rows = ids.map((id) => {
      const sp = SPECIES_BY_ID[id], e = s.journal[id];
      const chips = MORPHS.map((m) => `<span class="chip" title="${m.name}" style="background:${e?.morphs[m.id] ? MORPH_COLORS[m.id] : 'rgba(255,255,255,0.05)'}"></span>`).join('');
      return `<div class="sp-row ${e ? '' : 'unknown'}"><span class="nm">${e ? esc(sp.name) : '???'}</span><span class="meta">${e ? `${e.caught} caught · best ${lbs(e.best)}` : `record ${lbs(sp.lb[2])}`}</span><div class="chips">${chips}</div>${e ? this.hintHtml(sp, e) : ''}</div>`;
    }).join('');
    const species = Object.keys(s.journal).length;
    const tabs = [[this.g.loc.id, 'Here'], ...LOCATION_ORDER.filter((l) => l !== this.g.loc.id).map((l) => [l, LOCATIONS[l].name]), ['all', 'All species']];
    return this.head('Fishing Journal') + `<div class="journal-sum"><span>Species <b>${species} / ${SPECIES.length}</b></span><span>Catalog <b>${catalogCount(s)} / ${CATALOG_SIZE.toLocaleString()}</b></span><span>Fish caught <b>${s.stats.caught}</b></span><span>Trophies <b>${trophyCount(s)} / ${CAPACITY}</b></span><span>Earned <b>${money(s.stats.earned)}</b></span></div>` + this.tabs('journal', tabs) + `<div>${rows}</div><p class="tips">Every species comes in ${MORPHS.length} colour variants (golden, albino, piebald, calico, ghost and more). Rare variants are worth several times more.</p>`;
  }

  // progressive journal hints: more catches of a species reveal more (tiers in baitData TUNING.hints)
  hintHtml(sp, e) {
    const n = e.caught, H = BAIT.hints, h = hintFor(sp);
    const parts = [];
    if (n >= H.bait) {
      const worked = e.how && LURES[e.how.lure] ? `<span class="hint-worked" title="The lure that took your first one">first on ${esc(LURES[e.how.lure].name)}</span>` : '';
      parts.push(`<div class="hint-bait">${h.labels.map((l) => `<span class="tag">${l}</span>`).join('')}${worked}</div>`);
    }
    const hint = [];
    if (n >= H.depth) {
      // water column: 0-12 m strip with the preferred band and a fish at its centre
      const W = 120, sc = W / 12, d = h.depth;
      const band = d.bottom ? `<rect x="${W - 22}" y="5" width="22" height="10" rx="2" class="band"/>` : `<rect x="${Math.min(W - 4, d.lo * sc)}" y="5" width="${Math.max(6, Math.min(W, d.hi * sc) - d.lo * sc)}" height="10" rx="2" class="band"/>`;
      const fx = d.bottom ? W - 12 : Math.min(W - 10, d.c * sc + 2);
      let ticks = '';
      for (let m = 0; m <= 12; m += 3) ticks += `<line x1="${m * sc}" x2="${m * sc}" y1="15" y2="19" class="tick"/>`;
      hint.push(`<svg class="hint-depth" viewBox="0 0 ${W} 22" width="${W}" height="22" role="img" aria-label="${d.bottom ? 'Near the bottom' : `Holds around ${U.depthN(d.lo)} to ${U.depthN(d.hi)} ${U.units().dist === 'ft' ? 'feet' : 'metres'}`}"><title>${d.bottom ? 'Hugs the bottom' : `Holds ${U.depthN(d.lo)}-${U.depthN(d.hi)} ${U.distUnit()} down`}</title>${band}<path class="fish" d="M${fx - 6} 10 q3 -4 7 -1 l3 -3 v8 l-3 -3 q-4 3 -7 -1z"/>${ticks}</svg>`);
    }
    if (n >= H.time) {
      const labels = ['dawn', 'day', 'dusk', 'night'];
      hint.push(`<span class="hint-time" title="Best times: dawn / day / dusk / night">${h.time.map((v, i) => `<i style="height:${Math.round(4 + v * 12)}px" class="${v >= 0.9 ? 'hi' : ''}" title="${labels[i]}"></i>`).join('')}</span>`);
    }
    if (n >= H.weather) {
      const names = ['clear', 'partly cloudy', 'overcast', 'rain', 'storm'];
      hint.push(`<span class="hint-wx" title="Weather it bites in: clear / partly / overcast / rain / storm">${h.wx.map((v, i) => `<i style="height:${Math.round(4 + v * 10)}px" class="${v >= 0.95 ? 'hi' : ''}" title="${names[i]}"></i>`).join('')}</span>`);
    }
    if (hint.length) parts.push(`<div class="hint-row">${hint.join('')}</div>`);
    return parts.length ? `<div class="hint">${parts.join('')}</div>` : '';
  }


  // ---- trophy room: the wall, what is waiting to be mounted, and the records ----
  renderTrophy() {
    const g = this.g, s = g.save, T = this.tro || (this.tro = { arm: null, rep: null });
    const mounts = s.mounts || [], cands = s.cands || [], full = mounts.length >= CAPACITY;
    const nm = (e) => `${e.morph !== 'normal' ? esc(MORPHS.find((m) => m.id === e.morph)?.name || '') + ' ' : ''}${esc(SPECIES_BY_ID[e.sp].name)}`;
    const when = (e) => `${e.loc && LOCATIONS[e.loc] ? esc(LOCATIONS[e.loc].name) + ', ' : ''}day ${e.day}`;
    const tag = (e) => esc(e.tour ? `${e.tour}${e.place ? ', ' + PLACE[e.place - 1] : ''}` : (e.tags[0] || ''));
    const wall = mounts.map((e) => {
      const sel = T.rep === e.id, arm = T.arm === e.id;
      const rep = full && cands.length ? `<button class="btn ${sel ? 'primary' : ''}" data-act="tro-rep" data-id="${e.id}">${sel ? 'Swapping out' : 'Swap out'}</button> ` : '';
      const down = arm ? `<button class="btn gold" data-act="tro-down" data-id="${e.id}">Take it down for good</button>` : `<button class="btn" data-act="tro-arm" data-id="${e.id}">Take down</button>`;
      return `<tr><td><b>${nm(e)}</b> <span class="small">${tag(e)}</span></td><td>${lbs(e.lb)} · ${inches(e.inches)}</td><td class="small">${when(e)}</td><td class="b">${rep}${down}</td></tr>`;
    }).join('');
    const queue = cands.map((e) => {
      const fee = g.mountFee(e.lb), cant = s.cash < fee || (full && !T.rep);
      const why = s.cash < fee ? 'not enough cash' : full && !T.rep ? 'pick one to swap out' : '';
      return `<tr><td><b>${nm(e)}</b> <span class="small">${tag(e)}</span></td><td>${lbs(e.lb)} · ${inches(e.inches)}</td><td class="small">${when(e)}</td><td class="b"><button class="btn gold" data-act="tro-mount" data-id="${e.id}" ${cant ? 'disabled' : ''}>Mount ${money(fee)}</button>${why ? ` <span class="small">${why}</span>` : ''}</td></tr>`;
    }).join('');
    const bests = bestPerSpecies(s).slice(0, 12).map((r) => {
      const sp = SPECIES_BY_ID[r.sp];
      return `<tr><td>${esc(sp.name)}</td><td>${lbs(r.lb)}</td><td class="small">${Math.round(100 * r.lb / sp.lb[2])}% of record</td><td class="small">${r.loc ? esc(LOCATIONS[r.loc].name) : 'before records were kept'}</td></tr>`;
    }).join('');
    const water = bestPerWater(s).map((r) => `<tr><td>${esc(LOCATIONS[r.loc].name)}</td><td>${esc(SPECIES_BY_ID[r.sp].name)} ${lbs(r.lb)}</td><td class="small">${r.n} species</td><td class="small">day ${r.day}</td></tr>`).join('');
    const m = medalCounts(s), badges = (s.badges || []).length;
    return this.head('Trophy room', `${mounts.length} / ${CAPACITY} on the wall`) + `
      <p class="tips">${esc(mounts.length ? (full ? SAY.full : 'The harbour master mounts replicas cast and painted from your measurements and photographs, so the fish itself can go back.') : SAY.none)}</p>
      ${mounts.length ? `<h5 class="board-h">On the wall</h5><div class="holdscroll"><table class="well"><tr><th>Fish</th><th>Size</th><th>Where, when</th><th></th></tr>${wall}</table></div>` : ''}
      <h5 class="board-h">Waiting to be mounted</h5>
      ${cands.length ? `<div class="holdscroll"><table class="well"><tr><th>Fish</th><th>Size</th><th>Where, when</th><th></th></tr>${queue}</table></div>` : `<p class="tips">${esc(SAY.empty)}</p>`}
      <h5 class="board-h">Records</h5>
      <div class="journal-sum"><span>Gold <b>${m[0]}</b></span><span>Silver <b>${m[1]}</b></span><span>Bronze <b>${m[2]}</b></span><span>Daily jobs done <b>${badges}</b></span></div>
      ${bests ? `<div class="holdscroll"><table class="well"><tr><th>Species, personal best</th><th>Weight</th><th></th><th>Water</th></tr>${bests}</table></div>` : '<p class="tips">No catches logged yet.</p>'}
      ${water ? `<h5 class="board-h">Heaviest fish by water</h5><div class="holdscroll"><table class="well">${water}</table></div>` : ''}
      <div class="actions"><button class="btn primary" data-act="close">Back to fishing</button></div>`;
  }

  // every key here is read from the live bindings (Settings > Controls), so it never goes stale
  renderHelp() {
    const B = this.g.binds.map, K = (...ids) => ids.map((i) => keyLabel(B[i])).join(' ');
    const k = [['Cast (hold to power, release)', 'Left mouse'], ['Reel in', 'Hold left mouse'], ['Set the hook on STRIKE!', 'Click or keep reeling'], ['Drag setting', `Mouse wheel / ${K('dragDown', 'dragUp')}`], ['Steer rod against the fish', `${K('left')} / ${K('right')}`], ['Look around', 'Move the mouse (click once to lock it; Esc frees it) or right-drag'], ['Look around (keys)', K('lookLeft', 'lookRight', 'lookUp', 'lookDown')], ['Throttle / steer boat', `${K('forward', 'back')} / ${K('left', 'right')}`], ['Step onto a dock or the bank / back aboard', K('stepOff')], ['Livewell & market (sell at any dock)', K('livewell')], ['Walk (on foot)', `${K('forward', 'left', 'back', 'right')}, ${K('sprint')} to hurry`], ['View: first person / over the shoulder / boat overview', K('view')], ['Deploy / haul net (net boats)', K('net')], ['Trolling spread (salt water)', K('troll')], ['Drop / raise the anchor', K('anchor')], ['Quick lure swap', '1 - 9'], ['Tackle box / Shop / Marina (shop and marina are at the docks)', `${K('tackle')} / ${K('shop')} / ${K('marina')}`], ['Talk to the shopkeeper at a shop door / listen to the locals', K('talk')], ['Chart: local map with docks, shops, market', K('chart')], ['Travel / Journal', `${K('map')} / ${K('journal')}`], ['Trophy room (mounted catches, records)', K('trophy')], ['Skip ahead 1 hour', K('skip')], ['Underwater camera (lure / fish)', K('underwater')], ['Photo mode', K('photo')], ['Show / hide fish finder', K('sonar')], ['Drop a waypoint here (shows on the compass)', K('waypoint')], ['Clear all waypoints on this water', `Shift + ${K('waypoint')}`], ['Set / remove a waypoint on the chart', 'Click the chart'], ['Put the rod away / take it out', K('holster')], ['Tournaments', K('events')], ['Settings (rebind any key under Controls)', K('settings')], ['Controls (this page)', K('help')], ['Save / Load, export / import (autosave is always on)', 'Esc menu'], ['Close menus', 'Esc']];
    return this.head('How to fish') + `<div class="help-grid">${k.map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div>
      <p class="tips"><b>Fighting:</b> reel while the fish rests or turns, and STOP reeling when it runs - cranking against a running fish twists the line until it snaps. When it runs, line peels off at your drag setting. If tension goes past the line's breaking strength it snaps, so keep drag below it. Reel when the fish rests, pull the rod the opposite way to the fish (${K('left')}/${K('right')}) to tire it faster, and don't give it slack or it can throw the hook. When it jumps, ease off the drag. Get a tired fish next to the boat to land it.</p>
      <p class="tips"><b>Finding fish:</b> diving gulls and bait balls mark hotspots; dawn and dusk bite best. Match the lure to what the fish eats and to its depth. Active lures need to be moving (reel or troll).</p>
      <div class="actions"><button class="btn primary" data-act="close">Let's fish</button></div>`;
  }

  showCatch(info) {
    this.catchInfo = info;
    this.open('catch');
  }

  renderCatch() {
    const c = this.catchInfo;
    const badges = [c.isNewSpecies && '<span class="badge gold">New species</span>', c.isNewMorph && !c.isNewSpecies && c.morph.id !== 'normal' && '<span class="badge gold">New variant</span>', c.isRecord && '<span class="badge">Personal best</span>', c.lb > c.sp.lb[2] * 0.7 && '<span class="badge gold">Trophy</span>'].filter(Boolean).join('');
    return `<div class="morph">${c.morph.id === 'normal' ? 'Caught' : c.morph.name + ' variant'}</div><h2>${esc(c.sp.name)}</h2><div class="badges">${badges}</div>
      <div class="big"><div><b>${lbs(c.lb)}</b><span>weight</span></div><div><b>${inches(c.inches)}</b><span>length</span></div><div><b style="color:var(--accent-2)">${money(c.value)}</b><span>market value</span></div></div>
      <div class="stats small">World record about ${lbs(c.sp.lb[2])}. ${c.morph.id !== 'normal' ? `Rare variant: worth ${c.morph.value}x. ` : ''}${c.fishOfDay ? 'Fish of the day at the market. ' : ''}${c.buyer ? 'Buyer boat price (15% cut). ' : ''}<b style="color:var(--amber)">+${c.xp} xp</b></div>
      ${c.isNewSpecies && c.how && LURES[c.how.lure] ? `<div class="stats small how">First of its kind: it took the <b>${esc(LURES[c.how.lure].name)}</b>${c.how.depth > 0.1 && !LURES[c.how.lure].bobber ? ` at ${U.depth(+c.how.depth, 1)}` : ''} around ${hourText(c.how.hour)}. Logged in your journal.</div>` : ''}
      ${c.mountNote ? `<div class="stats small how">${esc(c.mountNote)}</div>` : ''}
      <div class="actions">${this.catchButtons(c)}</div>`;
  }

  catchButtons(c) {
    const keep = c.iced ? 'Put it on ice' : 'Keep it';
    let first;
    if (c.well < c.slots) first = `<button class="btn gold" data-act="keep">${keep} <small>${c.well + 1}/${c.slots}</small></button>`;
    else if (c.cull) first = `<button class="btn gold" data-act="cull">${keep}, release the ${esc(c.cull.name.toLowerCase())}</button>`;
    else first = '<button class="btn gold" disabled>Livewell full</button>';
    const sell = c.canSell ? `<button class="btn primary" data-act="sellnow">Sell now ${money(c.value)}</button>` : '';
    return `${first}${sell}<button class="btn" data-act="release">Release (luck boost)</button>`;
  }

  renderLivewell() {
    const g = this.g, s = g.save, m = g.market, day = s.day || 1;
    const access = g.marketAccess(), buyer = access === 'buyer';
    const well = s.livewell || [], slots = wellSlots(s.boat, s), hold = s.hold || [];
    const where = access === 'dock' ? 'At the dock market' : buyer ? 'Buyer boat on the radio (15% cut)' : `No buyer here. ${esc(g.nearestDockText())}`;
    const fotd = m.fishOfDay(day);
    const rows = well.map((k) => {
      const sp = SPECIES_BY_ID[k.sp], morph = MORPHS.find((x) => x.id === k.morph) || MORPHS[0];
      const cond = g.wellCondition(k), pct = Math.round(k.health * 100);
      const tone = k.iced ? 'ice' : k.health <= 0 ? 'dead' : k.health < 0.35 ? 'low' : k.health < 0.7 ? 'mid' : 'ok';
      const v = m.value(s, k, buyer);
      const btns = (access ? `<button class="btn primary" data-act="sellone" data-id="${k.id}">Sell</button>` : '') + (!k.iced && k.health > 0 ? `<button class="btn" data-act="releaseone" data-id="${k.id}">Release</button>` : '');
      return `<tr><td><b>${esc(sp.name)}</b>${morph.id !== 'normal' ? ` <span class="badge gold">${esc(morph.name)}</span>` : ''}${k.sp === fotd ? ' <span class="badge">Fish of the day</span>' : ''}</td><td>${lbs(k.lb)}</td><td><div class="cond ${tone}"><i style="width:${pct}%"></i></div><span class="small">${cond}</span></td><td class="v">${money(v)}</td><td class="b">${btns}</td></tr>`;
    }).join('');
    // what "sell everything" pays: each fish sold drops that species' price for the next
    let total = 0, tmp = s;
    for (const k of well) { total += m.value(tmp, k, buyer); tmp = { ...tmp, market: m.recordSale(tmp, k.sp) }; }
    let holdTotal = 0;
    for (const h of hold) { holdTotal += holdValue(m, tmp, h, buyer); tmp = { ...tmp, market: m.recordSale(tmp, h.sp, holdUnits(h)) }; }
    const hcap = holdCap(BOATS[s.boat], s, s.boat);
    const holdRows = hold.map((h) => {
      const sp = SPECIES_BY_ID[h.sp], pct = Math.round(h.health * 100), v = holdValue(m, s, h, buyer);
      const btns = (access ? `<button class="btn primary" data-act="sellspecies" data-id="${h.sp}">Sell</button>` : '') + `<button class="btn" data-act="tiphold" data-id="${h.sp}">Tip out</button>`;
      return `<tr><td><b>${esc(sp.name)}</b>${h.sp === fotd ? ' <span class="badge">Fish of the day</span>' : ''}</td><td>${h.count.toLocaleString()}</td><td>${lbs(h.lb)}</td><td><div class="cond ${holdTone(h)}"><i style="width:${pct}%"></i></div><span class="small">${holdCondition(h)}</span></td><td class="v">${money(v)}</td><td class="b">${btns}</td></tr>`;
    }).join('');
    const holdHtml = hold.length ? `<h5 class="board-h">Hold ${Math.round(holdLb(hold)).toLocaleString()}${hcap ? ` of ${hcap.toLocaleString()}` : ''} lb · ${holdCount(hold).toLocaleString()} fish${hcap ? '' : ' · this boat has no hold, so nothing more goes in'}</h5>
      <div class="holdscroll"><table class="well"><tr><th>Species</th><th>Count</th><th>Weight</th><th>Condition</th><th>Value</th><th></th></tr>${holdRows}</table></div>
      <p class="tips">The hold keeps fish on ice and seawater, but they still soften by the hour. A wholesale lot moves the price slower than single fish, and a buyer pays for what is still fresh.</p>` : '';
    // price board: this location's fish, today's $/lb vs the usual
    const ids = Object.entries(g.loc.pool || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id).filter((id) => SPECIES_BY_ID[id]);
    const board = ids.map((id) => {
      const sp = SPECIES_BY_ID[id], now = m.perLb(s, id), d = now / sp.price;
      const arrow = d > 1.08 ? '<span class="up">▲</span>' : d < 0.92 ? '<span class="down">▼</span>' : '<span class="flat">–</span>';
      return `<div class="pb"><span>${esc(sp.name)}${id === fotd ? ' <span class="badge">today</span>' : ''}</span><b>${money2(now)}/lb</b>${arrow}</div>`;
    }).join('');
    return this.head('Livewell', `${well.length}/${slots}${hold.length ? ` · hold ${Math.round(holdLb(hold)).toLocaleString()} lb` : ''} · ${money(s.cash)}`) + `
      <div class="well-where ${access ? 'on' : ''}">${where}</div>
      ${well.length ? `<table class="well"><tr><th>Fish</th><th>Weight</th><th>Condition</th><th>Value</th><th></th></tr>${rows}</table>` : (hold.length ? '' : '<p class="tips">Nothing in the livewell. Keep a catch instead of selling it on the spot, then bring it to any dock.</p>')}
      ${holdHtml}
      <h5 class="board-h">Today's prices at ${esc(g.loc.name)}</h5><div class="board">${board}</div>
      <p class="tips">Fish tire in the livewell: hardy fish (bass, catfish, gar) last far longer than trout, salmon or herring. Big pelagics go on ice. Prices change at midnight, and each fish of one species you sell today lowers its price.</p>
      <div class="actions">${access && hold.length && well.length ? `<button class="btn" data-act="sellhold">Sell the hold ${money(holdTotal)}</button>` : ''}${access && (well.length || hold.length) ? `<button class="btn gold" data-act="sellall">Sell everything ${money(total + holdTotal)}</button>` : ''}<button class="btn primary" data-act="close">Back to fishing</button></div>`;
  }

  showHaul(rows, morphs, cap) {
    this.haul = { rows, morphs, ...cap };
    this.open('haul');
  }

  renderHaul() {
    const h = this.haul, plan = planHaul(h.rows, h.room);
    const taken = plan.reduce((a, t) => a + t.lb, 0), have = holdLb(this.g.save.hold);
    const body = h.rows.map((r, i) => {
      const t = plan[i], full = t.lb >= r.lb - 0.5, part = t.lb > 0 && !full;
      const state = !r.keep ? 'back over the side' : t.lb <= 0 ? 'no room' : part ? `${Math.round(t.lb).toLocaleString()} lb fit` : 'aboard';
      return `<tr><td>${esc(r.sp.name)}</td><td>~${r.count.toLocaleString()}</td><td>${lbs(r.lb)}</td><td>${money(r.value)}</td><td class="b"><button class="btn ${r.keep ? '' : 'primary'}" data-act="haulkeep" data-n="${i}">${r.keep ? 'Release' : 'Keep'}</button> <span class="small">${state}</span></td></tr>`;
    }).join('');
    return `<div class="m-head"><h2>Haul in!</h2><span>hold ${Math.round(have + taken).toLocaleString()} / ${h.cap.toLocaleString()} lb</span></div><table class="haul"><tr><th>Species</th><th>Count</th><th>Weight</th><th>Value</th><th></th></tr>${body}</table>
      ${h.morphs.length ? `<p class="tips">Rare fish spotted in the haul: ${h.morphs.map((m) => `<b>${m.morph.name} ${esc(m.sp.name)}</b>`).join(', ')} (logged in your journal)</p>` : ''}
      ${(() => { const kept = h.rows.filter((r) => r.keep).reduce((q, r) => q + r.lb, 0) - taken; return kept > 1 ? `<p class="tips warn">The hold is short ${Math.round(kept).toLocaleString()} lb of room. That goes over the side, cheapest per pound first. Release more here to choose what stays.</p>` : ''; })()}
      <p class="tips">Nothing is paid out at sea. The hold goes to a fish market, and the longer it sits the less it fetches. Best price per pound goes in first when the hold is short on room.</p>
      <div class="actions"><button class="btn gold" data-act="stow" ${taken > 0 ? '' : 'disabled'}>Stow ${Math.round(taken).toLocaleString()} lb</button><button class="btn" data-act="haulrelease">Release all</button></div>`;
  }

  action(act, d) {
    const g = this.g;
    if (DEAL_ACTS.has(act)) g.keepers.deal();
    switch (act) {
      case 'talk': this.talkPick(+d.n); break;
      case 'close': this.close(); break;
      case 'tab': this.tab[d.group] = d.id; this.render(); break;
      case 'buy': g.buy(d.kind, d.id); this.render(); break;
      case 'equip': g.equip(d.kind, d.id); this.render(); break;
      case 'buyboat': g.buyBoat(d.id); this.render(); break;
      case 'boat': g.switchBoat(d.id); this.forceClose(); break;
      case 'unlock': g.unlock(d.id); this.render(); break;
      case 'permit': g.buyPermit(d.id); this.render(); break;
      case 'service': g.service(d.id); this.render(); break;
      case 'travel': g.travel(d.id); break;
      case 'keep': this.forceClose(); g.finishCatch('keep'); break;
      case 'cull': this.forceClose(); g.finishCatch('cull'); break;
      case 'sellnow': this.forceClose(); g.finishCatch('sell'); break;
      case 'release': this.forceClose(); g.finishCatch('release'); break;
      case 'sellone': g.sellFish([d.id]); this.render(); break;
      case 'sellall': g.sellFish('all'); g.sellHold('all'); this.render(); break;
      case 'releaseone': g.releaseFish(d.id); this.render(); break;
      case 'haulkeep': { const r = this.haul.rows[+d.n]; if (r) r.keep = !r.keep; this.render(); break; }
      case 'stow': this.forceClose(); g.stowHaul(this.haul.rows, this.haul.room); break;
      case 'haulrelease': this.forceClose(); g.stowHaul(this.haul.rows.map((r) => ({ ...r, keep: false })), 0); break;
      case 'sellhold': g.sellHold('all'); this.render(); break;
      case 'sellspecies': g.sellHold([d.id]); this.render(); break;
      case 'tiphold': g.discardHold(d.id); this.render(); break;
      case 'go': this.open(d.id); break;
      case 'yard-open': this.yard = { id: d.id }; this.open('yard'); break;
      case 'yard-boat': this.yard = { id: d.id }; this.yardInit(); this.render(); break;
      case 'yard-paint': this.yard.draft[d.slot] = d.pid || null; this.yardView(); this.render(); break;
      case 'yard-wear': this.yard.draft.wear = +d.n; this.yardView(); this.render(); break;
      case 'yard-reg': this.yard.draft.reg = makeReg(Math.random() + this.yard.id); this.yardView(); this.render(); break;
      case 'yard-revert': this.yardInit(); this.yardView(); this.render(); break;
      case 'yard-apply': g.applyYard(this.yard.id, this.yard.draft); this.yardInit(); this.render(); break;
      case 'yard-up': { const keep = { ...this.yard.draft }; g.buyUpgrade(this.yard.id, d.up); this.yardInit(); Object.assign(this.yard.draft, keep); this.yardView(); this.render(); break; }
      case 'sv-save': case 'sv-load': case 'sv-del': case 'sv-export': case 'sv-import': this.saveAction(act, d.n); break;
      case 'tro-arm': this.tro.arm = this.tro.arm === d.id ? null : d.id; this.render(); break;
      case 'tro-down': g.takeDownTrophy(d.id); this.tro.arm = null; if (this.tro.rep === d.id) this.tro.rep = null; this.render(); break;
      case 'tro-rep': this.tro.rep = this.tro.rep === d.id ? null : d.id; this.render(); break;
      case 'tro-mount': if (g.mountTrophy(d.id, this.tro.rep)) this.tro.rep = null; this.render(); break;
      case 'enter': g.enterTournament(d.id); this.forceClose(); break;
      case 'reset': {
        // two clicks: the first arms it
        const btn = document.querySelector('[data-act="reset"]');
        if (btn && !btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Click again: erase everything'; btn.classList.add('gold'); }
        else g.resetProgress();
        break;
      }
      default: if (act.startsWith('st-')) this.settingsPanel.click(act, d); break;
    }
  }
}

function dietText(diet) {
  const names = { i: 'insect eaters', w: 'worm eaters', m: 'predators', c: 'crab/shrimp eaters', q: 'squid eaters', p: 'grazers', b: 'scavengers' };
  return [...diet].map((c) => names[c]).join(', ');
}

export { money, lbs };

function hourText(h) {
  const hh = Math.floor(h) % 24;
  return `${hh % 12 || 12} ${hh < 12 ? 'am' : 'pm'}`;
}

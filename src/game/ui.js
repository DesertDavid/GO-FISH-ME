import { RODS, REELS, LINES, LURES, BOATS, BOAT_ORDER } from './gear.js';
import { LOCATIONS, LOCATION_ORDER } from './locations.js';
import { SPECIES, SPECIES_BY_ID, MORPHS, CATALOG_SIZE } from './species.js';
import { catalogCount } from './save.js';
import { wellSlots } from './livewell.js';

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + Math.round(n).toLocaleString();
const money2 = (n) => '$' + n.toFixed(2);
const lbs = (lb) => (lb < 1 ? `${Math.round(lb * 16)} oz` : lb < 100 ? `${lb.toFixed(2)} lb` : `${Math.round(lb).toLocaleString()} lb`);
const inches = (i) => (i < 48 ? `${i.toFixed(1)}"` : `${Math.floor(i / 12)}' ${Math.round(i % 12)}"`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MORPH_COLORS = { normal: '#9fb4bd', golden: '#f0c040', albino: '#fff2ee', leucistic: '#e8eef0', melanistic: '#222', piebald: 'linear-gradient(90deg,#fff 50%,#556 50%)', calico: 'linear-gradient(90deg,#e86a18 33%,#111 33% 66%,#fff 66%)', blue: '#4a7ac0', ghost: 'rgba(230,240,245,0.5)', copper: '#c87a40', tiger: 'repeating-linear-gradient(90deg,#8a7 0 3px,#222 3px 5px)', spotted: 'radial-gradient(#111 30%,#c8a050 32%)', rose: '#f08aa8', emerald: '#1a9a5a', chrome: 'linear-gradient(135deg,#fff,#8a929a)', sunset: 'linear-gradient(#5a1a6a,#f06020,#ffd040)' };

export class UI {
  constructor(game) {
    this.g = game;
    this.panel = null;
    this.tab = {};
    this.catchInfo = null;
    document.querySelectorAll('#topRight [data-open]').forEach((b) => b.addEventListener('click', () => this.open(b.dataset.open)));
    $('modal').addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (t) { this.g.audio.play('ui'); this.action(t.dataset.act, t.dataset); return; }
      if (e.target.id === 'modal' && this.panel !== 'catch' && this.panel !== 'haul') this.close();
    });
    // settings sliders/toggles apply live
    $('modal').addEventListener('input', (e) => {
      const t = e.target.closest('[data-set]');
      if (!t) return;
      const v = t.type === 'checkbox' ? t.checked : +t.value;
      this.g.applySettings({ [t.dataset.set]: v });
      const out = t.parentElement.querySelector('output');
      if (out) out.textContent = t.type === 'checkbox' ? '' : `${Math.round(v * 100)}%`;
    });
  }

  renderSettings() {
    const s = this.g.settings;
    const slider = (key, label, min, max, step) => `<label class="set-row"><span>${label}</span><input type="range" data-set="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"><output>${Math.round(s[key] * 100)}%</output></label>`;
    const toggle = (key, label) => `<label class="set-row"><span>${label}</span><input type="checkbox" data-set="${key}" ${s[key] ? 'checked' : ''}><output></output></label>`;
    return this.head('Settings') + `<div class="settings">
      ${slider('volume', 'Volume', 0, 1, 0.05)}
      ${slider('resolution', 'Render resolution (lower = faster)', 0.5, 1, 0.05)}
      ${toggle('reflections', 'Water reflections')}
      ${slider('lookSpeed', 'Look speed', 0.3, 2.5, 0.05)}
      ${toggle('invertY', 'Invert look up/down')}
      ${toggle('sonar', 'Fish finder panel (F)')}
      ${toggle('mouseLock', 'Mouse look (click to lock the mouse; off = right-drag)')}
    </div>
    <div class="actions"><button class="btn primary" data-act="close">Done</button><button class="btn" data-act="reset">Reset all progress</button></div>`;
  }

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
    el.textContent = msg;
    $('toasts').prepend(el);
    setTimeout(() => el.remove(), kind === 'bad' ? 3800 : 3000);
    while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
  }

  strike(on) { $('strike').hidden = !on; }

  lookHint(show) {
    let el = $('lookHint');
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
    const unit = (s) => (s ? `${s.toFixed(2)} lb` : '-');
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
      <table class="haul"><tr><th>Angler</th><th>Score</th></tr>${r.rows.map((x, i) => `<tr${x.you ? ' style="color:var(--orange)"' : ''}><td>${i + 1}. ${esc(x.name)}</td><td>${x.score ? x.score.toFixed(2) + ' lb' : '-'}</td></tr>`).join('')}</table>
      <p class="tips">${r.prize ? `Prize money: <b>${money(r.prize)}</b>` : 'No prize this time - top three get paid.'}</p>
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

  fightTick(s) {
    const tPct = Math.min(1, s.tension / (s.test * 1.25));
    const bar = $('fpTension');
    bar.style.width = `${tPct * 100}%`;
    bar.style.background = s.tension > s.test ? 'var(--bad)' : s.tension > s.test * 0.8 ? 'var(--amber)' : 'var(--text)';
    $('fpTest').style.left = `${(1 / 1.25) * 100}%`;
    $('fpTensionTxt').textContent = `${s.tension.toFixed(1)} / ${s.test} lb`;
    $('fpStamina').style.width = `${s.stamina * 100}%`;
    $('fpStaminaTxt').textContent = `${Math.round(s.stamina * 100)}%`;
    $('fpDrag').textContent = `${s.drag.toFixed(1)} / ${s.maxDrag} lb`;
    $('fpLine').textContent = `${Math.round(s.lineOut)} / ${s.cap} m`;
    $('fpLeft').classList.toggle('on', s.fishSide > 0);
    $('fpRight').classList.toggle('on', s.fishSide < 0);
    $('fpHint').textContent = s.runWarn ? 'It\'s running, stop reeling' : s.overload > 0.4 ? 'Line\'s about to go, ease the drag' : s.lineOut > s.cap * 0.85 ? 'Running out of line' : s.stamina < 0.32 ? 'It\'s tired, bring it in' : '';
    $('fpHint').style.color = s.runWarn || s.overload > 0.4 ? 'var(--bad)' : '';
  }

  netTick(state, total, cap, type, turned) {
    const el = $('netPanel');
    if (state === 'stowed' || state == null) { el.hidden = true; return; }
    el.hidden = false;
    const label = { deploying: 'Shooting net…', fishing: type === 'trawl' ? 'Towing - keep 1-4 m/s through the schools' : `Circling: ${Math.round((turned / (Math.PI * 2)) * 360)}° - press N to purse`, hauling: 'Hauling back…' }[state];
    el.innerHTML = `<b>${type === 'trawl' ? 'TRAWL' : 'PURSE SEINE'}</b> · ${label}<div class="bar" style="margin-top:6px"><i style="width:${(total / cap) * 100}%;background:var(--accent)"></i></div><span class="small">${Math.round(total).toLocaleString()} / ${cap.toLocaleString()} lb · press N to haul</span>`;
  }

  hud() {
    const g = this.g, s = g.save, loc = g.loc;
    $('hLoc').innerHTML = `${esc(loc.name)}<small>${esc(loc.region)}</small>`;
    const h = g.hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('hTime').textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
    $('hCash').textContent = money(s.cash);
    // just the bait you're fishing; speed only while under way
    const e = s.equip;
    const well = s.livewell || [], slots = wellSlots(s.boat), weak = well.some((k) => !k.iced && k.health > 0 && k.health < 0.35);
    const wellTxt = well.length ? ` · <span class="${weak ? 'warn' : ''}">livewell ${well.length}/${slots}</span>` : '';
    $('gearLine').innerHTML = `<b>${esc(LURES[e.lure].name)}</b>${g.troll?.active ? ' · trolling spread out' : ''}${wellTxt}`;
    const knots = Math.abs(g.boatSpeed()) * 1.944;
    $('boatInfo').hidden = knots < 1;
    $('boatInfo').innerHTML = `<b>${knots.toFixed(0)}</b>knots`;
  }

  open(panel) {
    if (this.g.fishing.state === 'caught' && panel !== 'catch') return;
    this.panel = panel;
    this.g.freePointer?.();   // menus need the cursor
    $('modal').hidden = false;
    $('modal').classList.toggle('catchMode', panel === 'catch');
    $('modalCard').classList.toggle('catch', panel === 'catch');
    $('modal').classList.toggle('pauseMode', panel === 'pause');
    $('modalCard').classList.toggle('pause', panel === 'pause');
    this.render();
  }

  // Esc menu: everything that used to sit on screen as buttons, plus today's goals
  renderPause() {
    const items = [['resume', 'Resume', 'Esc'], ['tackle', 'Tackle box', 'T'], ['livewell', 'Livewell & market', 'L'], ['shop', 'Tackle shop', 'B'], ['marina', 'Marina', 'Y'], ['events', 'Tournaments', 'E'], ['map', 'Travel', 'M'], ['journal', 'Journal', 'J'], ['settings', 'Settings', 'O'], ['help', 'Controls', 'H']];
    const list = items.map(([id, label, key]) => `<button data-act="${id === 'resume' ? 'close' : 'go'}" data-id="${id}">${label}<kbd>${key}</kbd></button>`).join('');
    const ch = this.g.save.challenges;
    const goals = ch ? ch.list.map((c) => `<div class="ch ${c.done ? 'done' : ''}"><span>${esc(c.text)}<div class="prog">${c.done ? 'Done' : `${Math.min(c.have, c.need)} of ${c.need}`}</div></span><b>${money(c.reward)}</b></div>`).join('') : '';
    return `<div><div class="pause-title">${esc(this.g.loc.name)} · Day ${this.g.save.day || 1}</div><div class="pause-list">${list}</div></div>
      <div class="pause-side"><h5>Today's challenges</h5>${goals}</div>`;
  }

  close() {
    if (this.panel === 'catch' || this.panel === 'haul') return;
    this.panel = null;
    $('modal').hidden = true;
  }

  forceClose() { this.panel = null; $('modal').hidden = true; }

  render() {
    const card = $('modalCard');
    const fn = { shop: this.renderShop, tackle: this.renderTackle, marina: this.renderMarina, map: this.renderMap, journal: this.renderJournal, help: this.renderHelp, catch: this.renderCatch, haul: this.renderHaul, settings: this.renderSettings, events: this.renderEvents, tourResult: this.renderTourResult, pause: this.renderPause, livewell: this.renderLivewell }[this.panel];
    if (fn) card.innerHTML = fn.call(this);
  }

  head(title, sub = '') {
    return `<div class="m-head"><h2>${title}</h2><span>${sub}<span class="x" data-act="close">Back</span></span></div>`;
  }

  tabs(group, list) {
    const cur = this.tab[group] || list[0][0];
    return `<div class="tabs">${list.map(([id, label]) => `<button class="${id === cur ? 'on' : ''}" data-act="tab" data-group="${group}" data-id="${id}">${label}</button>`).join('')}</div>`;
  }

  renderShop() {
    const s = this.g.save, cur = this.tab.shop || 'rods';
    const cats = { rods: [RODS, 'rods', 'rod'], reels: [REELS, 'reels', 'reel'], lines: [LINES, 'lines', 'line'], lures: [LURES, 'lures', 'lure'] };
    const [table, owned] = cats[cur];
    const stat = (id, it) => cur === 'rods' ? `Power <b>${it.power} lb</b> · cast <b>${it.cast} m</b> · sensitivity <b>${Math.round(it.sens * 100)}</b>` :
      cur === 'reels' ? `Max drag <b>${it.drag} lb</b> · ratio <b>${it.ratio}:1</b> · holds <b>${it.cap} m</b>` :
        cur === 'lines' ? `Breaks at <b>${it.test} lb</b> · ${it.braid ? 'braid: no stretch, sensitive' : 'mono: stretch absorbs shock'}` :
          `Targets: <b>${dietText(it.diet)}</b> · ${({ s: 'surface', m: 'mid-water', b: 'bottom' })[it.depth]} · ${it.active ? 'retrieve or troll it' : 'let it sit'}`;
    const items = Object.entries(table).map(([id, it]) => {
      const have = s[owned].includes(id);
      return `<div class="item"><h4>${esc(it.name)}</h4><div class="stats">${stat(id, it)}</div><div class="foot"><span class="price">${it.price ? money(it.price) : 'Free'}</span>${have ? '<span class="small">Owned</span>' : `<button class="btn primary" data-act="buy" data-kind="${owned}" data-id="${id}" ${s.cash < it.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
    }).join('');
    return this.head('Tackle Shop', money(s.cash)) + this.tabs('shop', [['rods', 'Rods'], ['reels', 'Reels'], ['lines', 'Line'], ['lures', 'Lures & Bait']]) + `<div class="grid">${items}</div><p class="tips">Tip: match line strength to the fish, and keep your drag below the line's breaking strength. Big game needs a heavy reel with lots of line.</p>`;
  }

  renderTackle() {
    const s = this.g.save, cur = this.tab.tackle || 'rod';
    const cats = { rod: [RODS, 'rods'], reel: [REELS, 'reels'], line: [LINES, 'lines'], lure: [LURES, 'lures'] };
    const [table, owned] = cats[cur];
    const items = s[owned].map((id) => {
      const it = table[id], on = s.equip[cur] === id;
      return `<div class="item ${on ? 'equipped' : ''}"><h4>${esc(it.name)}</h4><div class="stats">${cur === 'lure' ? `${dietText(it.diet)} · ${({ s: 'surface', m: 'mid', b: 'bottom' })[it.depth]}` : cur === 'rod' ? `${it.power} lb power · ${it.cast} m cast` : cur === 'reel' ? `${it.drag} lb drag · ${it.cap} m` : `${it.test} lb test`}</div><div class="foot">${on ? '<span class="small" style="color:var(--accent)">Equipped</span>' : `<button class="btn primary" data-act="equip" data-kind="${cur}" data-id="${id}">Equip</button>`}</div></div>`;
    }).join('');
    return this.head('Tackle Box') + this.tabs('tackle', [['rod', 'Rod'], ['reel', 'Reel'], ['line', 'Line'], ['lure', 'Lure']]) + `<div class="grid">${items}</div><p class="tips">Number keys 1-9 swap between your lures quickly while fishing.</p>`;
  }

  renderMarina() {
    const s = this.g.save;
    const items = BOAT_ORDER.map((id) => {
      const b = BOATS[id], have = s.boats.includes(id), on = s.boat === id;
      const canHere = b.waters.includes(this.g.loc.water);
      let btn;
      if (on) btn = '<span class="small" style="color:var(--accent)">Your boat</span>';
      else if (have) btn = `<button class="btn primary" data-act="boat" data-id="${id}" ${canHere ? '' : 'disabled title="Can\'t run this boat here"'}>Take it out</button>`;
      else btn = `<button class="btn gold" data-act="buyboat" data-id="${id}" ${s.cash < b.price ? 'disabled' : ''}>Buy ${money(b.price)}</button>`;
      return `<div class="item ${on ? 'equipped' : ''}"><h4>${esc(b.name)}</h4><div class="stats">${esc(b.blurb)}</div><div class="stats">Top speed <b>${Math.round(b.speed * 1.944)} kn</b> · waters <b>${b.waters.join(', ')}</b>${b.net ? ` · <b>${b.net === 'trawl' ? 'trawl net' : 'purse seine'}</b> ${b.netCap.toLocaleString()} lb` : ''}</div><div class="foot"><span class="price">${b.price ? money(b.price) : 'Free'}</span>${btn}</div></div>`;
    }).join('');
    return this.head('Marina', money(s.cash)) + `<div class="grid">${items}</div><p class="tips">Lakes and rivers need a small boat. Offshore locations need a seaworthy one (center console or bigger). Net boats fish commercially: look for diving gulls over bait schools.</p>`;
  }

  renderMap() {
    const s = this.g.save;
    const items = LOCATION_ORDER.map((id) => {
      const l = LOCATIONS[id], open = s.unlocked.includes(id), here = this.g.loc.id === id;
      const boatOk = s.boats.some((b) => BOATS[b].waters.includes(l.water));
      const caught = Object.keys(l.pool).filter((sp) => s.journal[sp]).length;
      let btn;
      if (here) btn = '<span class="small" style="color:var(--accent-2)">You are here</span>';
      else if (!open) btn = `<button class="btn gold" data-act="unlock" data-id="${id}" ${s.cash < l.price ? 'disabled' : ''}>License ${money(l.price)}</button>`;
      else btn = `<button class="btn primary" data-act="travel" data-id="${id}" ${boatOk ? '' : 'disabled title="You need a boat that can run here"'}>Travel</button>`;
      return `<div class="item loc-card ${here ? 'here' : ''} ${open ? '' : 'locked'}"><img class="loc-pic" src="/images/locations/${id}.webp" alt="" loading="lazy" draggable="false" onerror="this.remove()"><span class="water">${l.water}</span><h4>${esc(l.name)}</h4><div class="stats">${esc(l.region)}</div><div class="stats">${esc(l.blurb)}</div><div class="stats">Species found: <b>${caught} / ${Object.keys(l.pool).length}</b>${boatOk ? '' : ' · <b style="color:var(--bad)">needs a bigger boat</b>'}</div><div class="foot"><span></span>${btn}</div></div>`;
    }).join('');
    return this.head('Travel', money(s.cash)) + `<div class="grid">${items}</div>`;
  }

  renderJournal() {
    const s = this.g.save, cur = this.tab.journal || this.g.loc.id;
    const ids = cur === 'all' ? SPECIES.map((sp) => sp.id) : [...new Set([...Object.keys(LOCATIONS[cur].pool), ...Object.keys(LOCATIONS[cur].net || {})])];
    const rows = ids.map((id) => {
      const sp = SPECIES_BY_ID[id], e = s.journal[id];
      const chips = MORPHS.map((m) => `<span class="chip" title="${m.name}" style="background:${e?.morphs[m.id] ? MORPH_COLORS[m.id] : 'rgba(255,255,255,0.05)'}"></span>`).join('');
      return `<div class="sp-row ${e ? '' : 'unknown'}"><span class="nm">${e ? esc(sp.name) : '???'}</span><span class="meta">${e ? `${e.caught} caught · best ${lbs(e.best)}` : `record ${lbs(sp.lb[2])}`}</span><div class="chips">${chips}</div></div>`;
    }).join('');
    const species = Object.keys(s.journal).length;
    const tabs = [[this.g.loc.id, 'Here'], ...LOCATION_ORDER.filter((l) => l !== this.g.loc.id).map((l) => [l, LOCATIONS[l].name]), ['all', 'All species']];
    return this.head('Fishing Journal') + `<div class="journal-sum"><span>Species <b>${species} / ${SPECIES.length}</b></span><span>Catalog <b>${catalogCount(s)} / ${CATALOG_SIZE.toLocaleString()}</b></span><span>Fish caught <b>${s.stats.caught}</b></span><span>Earned <b>${money(s.stats.earned)}</b></span></div>` + this.tabs('journal', tabs) + `<div>${rows}</div><p class="tips">Every species comes in ${MORPHS.length} colour variants (golden, albino, piebald, calico, ghost and more). Rare variants are worth several times more.</p>`;
  }

  renderHelp() {
    const k = [['Cast (hold to power, release)', 'Left mouse'], ['Reel in', 'Hold left mouse'], ['Set the hook on STRIKE!', 'Click or keep reeling'], ['Drag setting', 'Mouse wheel / [ ]'], ['Steer rod against the fish', 'A / D'], ['Look around', 'Move the mouse (click once to lock it; Esc frees it) or right-drag'], ['Throttle / steer boat', 'W S / A D'], ['Step onto a dock or the bank / back aboard', 'G'], ['Livewell & market (sell at any dock)', 'L'], ['Walk (on foot)', 'W A S D, Shift to hurry'], ['First / third person', 'V'], ['Deploy / haul net (net boats)', 'N'], ['Trolling spread (salt water)', 'R'], ['Quick lure swap', '1 - 9'], ['Tackle box / Shop / Marina', 'T / B / Y'], ['Travel / Journal', 'M / J'], ['Skip ahead 1 hour', 'K'], ['Underwater camera (lure / fish)', 'U'], ['Photo mode', 'P'], ['Show / hide fish finder', 'F'],['Put the rod away / take it out', 'X'], ['Tournaments', 'E'], ['Settings', 'O'], ['Close menus', 'Esc']];
    return this.head('How to fish') + `<div class="help-grid">${k.map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div>
      <p class="tips"><b>Fighting:</b> reel while the fish rests or turns, and STOP reeling when it runs - cranking against a running fish twists the line until it snaps. When it runs, line peels off at your drag setting. If tension goes past the line's breaking strength it snaps, so keep drag below it. Reel when the fish rests, pull the rod the opposite way to the fish (A/D) to tire it faster, and don't give it slack or it can throw the hook. When it jumps, ease off the drag. Get a tired fish next to the boat to land it.</p>
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
      <div class="stats small">World record about ${lbs(c.sp.lb[2])}. ${c.morph.id !== 'normal' ? `Rare variant: worth ${c.morph.value}x. ` : ''}${c.fishOfDay ? 'Fish of the day at the market. ' : ''}${c.buyer ? 'Buyer boat price (15% cut).' : ''}</div>
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
    const well = s.livewell || [], slots = wellSlots(s.boat);
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
    // price board: this location's fish, today's $/lb vs the usual
    const ids = Object.entries(g.loc.pool || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id).filter((id) => SPECIES_BY_ID[id]);
    const board = ids.map((id) => {
      const sp = SPECIES_BY_ID[id], now = m.perLb(s, id), d = now / sp.price;
      const arrow = d > 1.08 ? '<span class="up">▲</span>' : d < 0.92 ? '<span class="down">▼</span>' : '<span class="flat">–</span>';
      return `<div class="pb"><span>${esc(sp.name)}${id === fotd ? ' <span class="badge">today</span>' : ''}</span><b>${money2(now)}/lb</b>${arrow}</div>`;
    }).join('');
    return this.head('Livewell', `${well.length}/${slots} · ${money(s.cash)}`) + `
      <div class="well-where ${access ? 'on' : ''}">${where}</div>
      ${well.length ? `<table class="well"><tr><th>Fish</th><th>Weight</th><th>Condition</th><th>Value</th><th></th></tr>${rows}</table>` : '<p class="tips">Nothing in the livewell. Keep a catch instead of selling it on the spot, then bring it to any dock.</p>'}
      <h5 class="board-h">Today's prices at ${esc(g.loc.name)}</h5><div class="board">${board}</div>
      <p class="tips">Fish tire in the livewell: hardy fish (bass, catfish, gar) last far longer than trout, salmon or herring. Big pelagics go on ice. Prices change at midnight, and each fish of one species you sell today lowers its price.</p>
      <div class="actions">${access && well.length ? `<button class="btn gold" data-act="sellall">Sell everything ${money(total)}</button>` : ''}<button class="btn primary" data-act="close">Back to fishing</button></div>`;
  }

  showHaul(rows, morphs, total) {
    this.haul = { rows, morphs, total };
    this.open('haul');
  }

  renderHaul() {
    const h = this.haul;
    return `<div class="m-head"><h2>Haul in!</h2></div><table class="haul"><tr><th>Species</th><th>Count</th><th>Weight</th><th>Value</th></tr>${h.rows.map((r) => `<tr><td>${esc(r.sp.name)}</td><td>~${r.count.toLocaleString()}</td><td>${Math.round(r.lb).toLocaleString()} lb</td><td>${money(r.value)}</td></tr>`).join('')}</table>
      ${h.morphs.length ? `<p class="tips">Rare fish spotted in the haul: ${h.morphs.map((m) => `<b>${m.morph.name} ${esc(m.sp.name)}</b>`).join(', ')} (logged in your journal)</p>` : ''}
      <div class="actions"><button class="btn gold" data-act="sellhaul">Sell the haul ${money(h.total)}</button></div>`;
  }

  action(act, d) {
    const g = this.g;
    switch (act) {
      case 'close': this.close(); break;
      case 'tab': this.tab[d.group] = d.id; this.render(); break;
      case 'buy': g.buy(d.kind, d.id); this.render(); break;
      case 'equip': g.equip(d.kind, d.id); this.render(); break;
      case 'buyboat': g.buyBoat(d.id); this.render(); break;
      case 'boat': g.switchBoat(d.id); this.forceClose(); break;
      case 'unlock': g.unlock(d.id); this.render(); break;
      case 'travel': g.travel(d.id); break;
      case 'keep': this.forceClose(); g.finishCatch('keep'); break;
      case 'cull': this.forceClose(); g.finishCatch('cull'); break;
      case 'sellnow': this.forceClose(); g.finishCatch('sell'); break;
      case 'release': this.forceClose(); g.finishCatch('release'); break;
      case 'sellone': g.sellFish([d.id]); this.render(); break;
      case 'sellall': g.sellFish('all'); this.render(); break;
      case 'releaseone': g.releaseFish(d.id); this.render(); break;
      case 'sellhaul': this.forceClose(); g.sellHaul(this.haul); break;
      case 'go': this.open(d.id); break;
      case 'enter': g.enterTournament(d.id); this.forceClose(); break;
      case 'reset': {
        // two clicks: the first arms it
        const btn = document.querySelector('[data-act="reset"]');
        if (btn && !btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Click again: erase everything'; btn.classList.add('gold'); }
        else g.resetProgress();
        break;
      }
      default: break;
    }
  }
}

function dietText(diet) {
  const names = { i: 'insect eaters', w: 'worm eaters', m: 'predators', c: 'crab/shrimp eaters', q: 'squid eaters', p: 'grazers', b: 'scavengers' };
  return [...diet].map((c) => names[c]).join(', ');
}

export { money, lbs };

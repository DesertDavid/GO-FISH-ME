import * as THREE from 'three';
import { LOC } from './current.js';
import { findStart, LOCATIONS } from './locations.js';
import { loadSave, writeSave, logCatch, resetSave, readRaw } from './save.js';
import { autoBackup, diskBackup, migrateSaves } from './saveSlots.js';
import { loadSettings, saveSettings, sanitize, detectPreset, PRESETS, GFX_KEYS } from './settings.js';
import { resolveBinds, keyName, keyLabel } from './keys.js';
import { GFX } from './gfx.js';
import { FEEL } from './fightFeel.js';
import { setUnits, dist as fmtDist } from './units.js';
import { TUNE as FISH_TUNE } from './fishTune.js';
import { RODS, REELS, LINES, LURES, BOATS } from './gear.js';
import { PlayerBoat } from './boats.js';
import { customOf, mods as boatModsOf, upgradePrice, upgradeLevel, UPGRADES, paintCost, finalName } from './boatCustom.js';
import { Rod } from './rod.js';
import { PlayerBody } from './jelly.js';
import { Fishing } from './fishing.js';
import { NetFishing } from './net.js';
import { buildScenery, Hotspots } from './scenery.js';
import { AmbientFish } from './ambient.js';
import { Wildlife } from './wildlife.js';
import { AIBoats } from './aiBoats.js';
import { ShoreLife } from './shorelife.js';
import { Birds } from './birds.js';
import { FishLife } from './fishLife.js';
import { FishCam } from './fishcam.js';
import { Trolling, TROLL_GEAR } from './troll.js';
import { Tournament, tournamentsFor } from './tournaments.js';
import { TrophyHall } from './trophyHall.js';
import { noteCatch, settleTournament, addBadge, mountCand, takeDown, mountFee, mountNote, SAY } from './trophyData.js';
import { DevTools } from './dev.js';
import { Sonar } from './sonar.js';
import { Compass } from './compass.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';
import { fishLengthM } from './fishMesh.js';
import { makeChallenges, recordCatch } from './challenges.js';
import { Weather } from './weather.js';
import { NightFX } from './night.js';
import { Docks } from './docks.js';
import { Chart, SERVICE_INFO } from './chart.js';
import { Obstacles } from './obstacles.js';
import { Buildings } from './buildings.js';
import { Keepers } from './keepers.js';
import { wellSlots, keepFish, Market, ageWell, condition, ageHold, holdCap, holdLb, holdValue, holdUnits, planHaul, stowStacks } from './livewell.js';
import { SPECIES_BY_ID, MORPHS, rollMorph } from './species.js';
import { catchXp, challengeXp, tournamentXp, levelOf, levelInfo, unlocksAt, gateLevel, meets, hasPermit, permitLeft, permitPrice, PERMIT_OPTIONS, absHours, respoolCost, SHARPEN_COST, restockCost, WEAR_DEFAULT, effectiveTest } from './progress.js';

const TABLES = { rods: RODS, reels: REELS, lines: LINES, lures: LURES };
const KIND_OF = { rods: 'rod', reels: 'reel', lines: 'line', lures: 'lure' };
const _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

// Owns gameplay: player boat, camera, rod fishing, nets, time of day, menus, saving.
export class Game {
  constructor(engine) {
    this.e = engine;
    this.loc = LOC;
    this.freshStart = readRaw() === null;
    migrateSaves();
    this.save = loadSave();
    this.save = { ...this.save, location: LOC.id };
    if (!this.save.unlocked.includes(LOC.id)) this.save = { ...this.save, unlocked: [...this.save.unlocked, LOC.id] };
    this.scene = engine.scene;
    this.overlay = engine.overlay;
    this.camera = engine.camera;
    this.angler = new THREE.PerspectiveCamera();   // the angler's eye on the boat (rod mount)
    this.patchProp = engine.patchProp;
    this.heightAt = engine.heightAt;
    this.view = 'first';
    this.tp = false;                  // third person over the shoulder (view stays 'first': fishing, holster, menus all work)
    this.look = { yaw: 0, pitch: -0.06, dist: 0 };
    this.keys = new Set();
    this.mouse = { down: false, pressed: false, right: false, x: 0, y: 0 };
    this.water = [0, 0, 0];
    this.time = 0;
    this.sunTimer = 0;
    this.holstered = false;           // rod put away (X)
    this.foot = null;                 // on foot: { x, z, y, speed } (docks and shore)
    this.footPos = new THREE.Vector3();
  }

  async init(progress) {
    const e = this.e;
    this.ui = new UI(this);
    this.settings = loadSettings();
    this.binds = resolveBinds(this.settings.binds);   // live key bindings: { map: action -> key, rev: key -> action }
    this.dev = new DevTools(this);   // developer tools (off unless enabled in Settings or ?dev=1; docs/dev-mode.md)
    this.dev.boot();
    this.audio = new GameAudio();
    progress(0.75, 'Planting trees…');
    const scenery = buildScenery(this.loc, this.heightAt, this.patchProp);
    this.scenery = scenery;
    this.scene.add(scenery);
    e.addTideGroup?.(scenery);
    this.start = findStart(this.loc);
    this.hotspots = new Hotspots(this.loc, this.heightAt, this.start, this.patchProp);
    this.scene.add(this.hotspots.group);
    this.docks = new Docks(this.loc, this.heightAt, this.patchProp, this.start);
    this.scene.add(this.docks.group);
    e.addTideGroup?.(this.docks.group);
    this.obstacles = new Obstacles();
    this.obstacles.add(scenery.userData.colliders);
    this.obstacles.add(this.docks.colliders());
    this.buildings = new Buildings(this);
    this.scene.add(this.buildings.group);
    this.obstacles.add(this.buildings.colliders());
    this.hall = this.buildings.hall ? new TrophyHall(this, this.buildings.hall) : null;   // trophy room contents (built only when near)
    this.obstacles.add((this.loc.stacks || []).map(([x, z, r]) => ({ x, z, r: r * 1.05 })));
    this.bumpCool = 0;
    this.market = new Market(this.loc);
    this.chart = new Chart(this);
    progress(0.85, 'Launching the boat…');
    let boatId = this.save.boat;
    if (!this.dev.keepBoat && !BOATS[boatId].waters.includes(this.loc.water)) boatId = this.save.boats.find((b) => BOATS[b].waters.includes(this.loc.water)) || 'jon';
    this.save = { ...this.save, boat: boatId };
    this.boat = await new PlayerBoat(boatId).create(e.floaters, this.patchProp, this.start, this.start.yaw || 0, this.boatCust(boatId));
    this.look.yaw = BOATS[boatId].face || 0;
    this.rod = new Rod(this.overlay, this.scene);
    this.body = new PlayerBody(this);   // the jellybean angler, drawn in third person
    this.fishing = new Fishing(this.ctx());
    this.net = new NetFishing(this.ctx());
    this.ambient = new AmbientFish(this.ctx());
    this.wildlife = new Wildlife(this.ctx());
    this.troll = new Trolling(this.ctx());
    this.nightFX = new NightFX(this.ctx());
    this.aiBoats = new AIBoats(this.ctx(), e.floaters, this.patchProp, this.start);
    progress(0.92, 'Other anglers heading out…');
    await this.aiBoats.spawn(this.loc.water === 'offshore' ? 2 : 3);
    this.shore = new ShoreLife(this);
    await this.shore.init();
    this.keepers = new Keepers(this);
    this.birds = new Birds(this);
    this.birds.init();
    this.fishLife = new FishLife(this);
    this.fishLife.balls.attachBirds(this.birds);
    this.fishCam = new FishCam(this);
    this.sonar = new Sonar(document.getElementById('sonar'));
    this.compass = new Compass(this, document.getElementById('compass'));
    this.applyGear();
    this.bindInput();
    this.applySettings();
    this.applySun(true);
    this.weather = new Weather(this.e, this.loc, this.save.weather, this.ui, this.audio);
    this.weather.severe = this.settings.severeWeather !== false;
    writeSave(this.save);
    progress(1, 'Ready');
    this.ui.ready();
    this.ui.lookHint(this.settings.mouseLock);
    if (this.freshStart) diskBackup().then((b) => { if (b) this.ui.toast('A backup of earlier progress was found on disk - Esc > Save / Load to restore it.', 'info'); });
    if (!this.save.seenHelp && !this.dev.url) { this.ui.open('help'); this.commit({ seenHelp: true }); }
    this.ensureChallenges();
    this.dev.ready();
    this.ui.toast(`${this.loc.name}.`, 'good');
    if (!hasPermit(this.save, this.loc.id)) this.ui.toast('Fishing here needs a permit: buy one at the tackle shop (Chart: C).', 'info');
  }

  // shared context handed to the fishing/net systems
  ctx() {
    return {
      camera: this.camera, angler: this.angler, scene: this.scene, overlay: this.overlay, patchProp: this.patchProp, loc: this.loc,
      get save() { return game.save; },
      rod: this.rod, ui: this.ui, audio: this.audio, hotspots: this.hotspots,
      get fishLife() { return game.fishLife; },
      heightAt: this.heightAt,
      waterAt: (i) => this.water[1 + i] ?? 0,
      waterHeightApprox: () => this.water[0] ?? 0,
      splash: (x, z, amp, size) => this.splash(x, z, amp, size),
      canFish: () => this.canFish(),
      hour: () => this.save.hour,
      weatherBite: () => this.weather?.bite ?? 1,
      weatherId: () => (this.weather?.L > 0.3 ? 'storm' : this.weather?.id ?? 'partly'),
      biteQuality: () => this.settings.biteQuality,
      depthReadout: () => this.settings.depthReadout,
      tideMul: (id) => this.weather?.tideMul(id) ?? 1,
      cloudCover: () => this.e.sky.params.cloudCoverage,
      fishingBusy: () => this.fishing.busy(),
      startTrollFight: (p, lure) => this.startTrollFight(p, lure),
      boatSpeed: () => this.boatSpeed(),
      boatSpec: () => BOATS[this.save.boat],
      boatMods: () => this.boatMods(),
      boatLength: () => (this.foot ? 0 : this.boat.hull.length),
      get boat() { return game.boat; },
      onCatch: (f, done) => this.onCatch(f, done),
      onHaul: (rows, morphs) => this.onHaul(rows, morphs),
      wearAdd: (kind, amt) => this.wearAdd(kind, amt),
      lureLost: (lure) => this.lureLost(lure),
    };
  }

  commit(patch) {
    this.save = { ...this.save, ...patch };
    writeSave(this.save);
  }

  applyGear() {
    const e = this.save.equip;
    this.rod.setGear(RODS[e.rod], LINES[e.line], LURES[e.lure]);
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const el = this.e.renderer.domElement;
    addEventListener('keydown', (ev) => {
      this.audio.start();
      if (this.ui.capturing) { this.ui.settingsPanel.capture(ev); return; }   // rebinding a key: it swallows everything
      const k = keyName(ev);
      // the Settings screen is keyboard-driven too (arrows, Enter); Esc/Tab fall through to close it
      if (this.ui.panel === 'settings' && k !== 'escape' && k !== 'tab') { if (this.ui.settingsPanel.key(ev, k)) ev.preventDefault(); return; }
      if (ev.repeat) return;
      // Esc / Tab: close whatever is open, otherwise open the pause menu
      if (k === 'escape' || k === 'tab') {
        ev.preventDefault();
        if (this.ui.isOpen()) { this.ui.close(false); this.freePointer?.(); }   // Esc closes and leaves the mouse free
        else this.ui.open('pause');
        this.keys.clear();
        return;
      }
      if (this.ui.panel === 'talk') { if (/^[1-9]$/.test(k)) this.ui.talkPick(+k - 1); return; }
      if (this.ui.isOpen()) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;   // browser shortcuts (Ctrl+C, Ctrl+R...) aren't game keys
      if (this.wantLock) this.grabPointer?.();   // last grab was refused: retry on this key
      this.keys.add(k);
      const act = this.binds.rev[k];
      if (act === 'dev' || act === 'fly') { this.dev.hotkey(act); this.keys.clear(); return; }
      const open = { tackle: 'tackle', shop: 'shop', marina: 'marina', map: 'map', chart: 'chart', journal: 'journal', help: 'help', settings: 'settings', events: 'events', trophy: 'trophy' }[act];
      if (open) { this.ui.open(open); this.keys.clear(); return; }
      if (act === 'view' && !this.fishCam.active) {
        // first person -> over the shoulder (still fishing) -> the old boat overview orbit -> first person
        if (this.view === 'first' && !this.tp) this.tp = true;
        else if (this.view === 'first') { this.tp = false; this.view = 'third'; this.look.yaw = 0; }
        else { this.view = 'first'; this.tp = false; this.restoreLook(); }
      }
      if (act === 'stepOff') { this.fishCam.exit(); this.toggleShore(); }
      if (act === 'talk') { this.ui.open('talk'); this.keys.clear(); return; }
      if (act === 'livewell') { this.ui.open('livewell'); this.keys.clear(); return; }
      if (act === 'net') { if (this.foot) this.ui.toast('Nets work from the boat.', 'info'); else if (this.net.state !== 'stowed' || this.permitOk()) this.net.toggle(); }
      if (act === 'troll') { if (this.foot) this.ui.toast('The trolling spread runs off the boat.', 'info'); else if (this.troll.active || this.permitOk()) this.troll.toggle(); }
      if (act === 'holster') this.toggleHolster();
      if (act === 'anchor') this.toggleAnchor();
      if (act === 'fishcam') this.fishCam.toggle();
      if (act === 'camLamp') this.fishCam.toggleLamp();
      if (act === 'camFollow') this.fishCam.toggleFollow();
      if (act === 'underwater' && !this.fishCam.active) this.toggleUnderwater();
      if (act === 'photo') { if (this.fishCam.active) this.fishCam.photo(); else this.togglePhoto(); }
      if (act === 'sonar') { this.applySettings({ sonar: !this.settings.sonar }); this.ui.toast(this.settings.sonar ? 'Fish finder on' : 'Fish finder off', 'info'); }
      if (act === 'waypoint') {
        if (ev.shiftKey) { if (this.compass.list().length) { this.compass.clear(); this.ui.toast('Waypoints cleared', 'info'); } }
        else this.compass.here();
      }
      if (act === 'skip') { this.commit({ hour: this.save.hour + 1 }); this.applySun(true); this.tourTick(60); this.ui.toast('An hour goes by.', 'info'); }
      if (act === 'dragUp' || act === 'dragDown') this.dragNudge(act === 'dragUp' ? 1 : -1);
      if (/^[1-9]$/.test(k) && !this.fishing.busy()) {
        const id = this.save.lures[+k - 1];
        if (id) { this.equip('lure', id); this.ui.toast(`Tied on: ${LURES[id].name}`, 'info'); }
      }
    });
    addEventListener('keyup', (ev) => this.keys.delete(keyName(ev)));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.audio.setFocus(false, this.settings.muteBlur); });
    addEventListener('focus', () => this.audio.setFocus(true, this.settings.muteBlur));
    document.addEventListener('visibilitychange', () => this.audio.setFocus(!document.hidden, this.settings.muteBlur));
    // no browser right-click menu anywhere in the game (releasing a right-drag over a panel
    // used to pop it up)
    addEventListener('contextmenu', (ev) => ev.preventDefault());
    // Mouse look: click the view once to lock the pointer, then the mouse looks around with no
    // button held (left button still casts/reels). Esc or opening a menu frees it.
    // Right-drag still works as a fallback when the lock is off.
    const locked = () => document.pointerLockElement === el;
    // A lock request only counts during a click, so never retry it later from a promise:
    // if the raw-input mode is refused, use the plain lock from the next click on. Only after
    // several refusals in a row do we give up and fall back to right-drag.
    this.lockRaw = true;
    this.lockFails = 0;
    const lockRefused = () => {
      if (this.lockFailed || this.lockSoft) return;
      if (this.lockRaw) { this.lockRaw = false; return; }   // try plain mode on the next click
      if (++this.lockFails < 3) return;
      this.lockFailed = true;
      this.ui.lookHint(false);
      this.ui.toast('Mouse lock isn\'t available in this browser - right-drag to look around.', 'info');
    };
    // soft = re-grab after a menu closes: the browser may refuse (cooldown after its own Esc
    // unlock, no fresh key/click), which is fine - we just try again on the next key or click
    const lockPointer = (soft = false) => {
      if (!this.settings.mouseLock || this.lockFailed || locked() || this.ui.isOpen()) return false;
      if (soft && !navigator.userActivation?.isActive) { this.wantLock = true; return false; }
      this.lockSoft = soft;
      this.wantLock = soft;
      try {
        const p = this.lockRaw ? el.requestPointerLock({ unadjustedMovement: true }) : el.requestPointerLock();
        if (p && p.catch) p.catch(lockRefused);
      } catch {
        lockRefused();
        return false;
      }
      return true;
    };
    document.addEventListener('pointerlockerror', lockRefused);
    document.addEventListener('pointerlockchange', () => {
      this.mouse.down = false;
      this.mouse.right = false;
      if (locked()) {
        this.lockFails = 0;
        this.wantLock = false;
        if (this.ui.isOpen()) document.exitPointerLock();   // a menu opened while the grab was in flight
      }
      this.ui.lookHint(this.settings.mouseLock && !this.lockFailed && !locked());
    });
    el.addEventListener('pointerdown', (ev) => {
      this.audio.start();
      // any click on the view grabs the mouse, so looking around can't run the cursor off the
      // window (the first click only grabs; it doesn't cast)
      if (!locked() && (ev.button === 0 || ev.button === 2) && lockPointer()) return;
      if (ev.button === 0) {
        if (this.view === 'third') { this.view = 'first'; return; }
        this.mouse.down = true; this.mouse.pressed = true;
      }
      if (ev.button === 2 && !locked()) { this.mouse.right = true; el.setPointerCapture(ev.pointerId); }
      this.mouse.x = ev.clientX; this.mouse.y = ev.clientY;
    });
    addEventListener('pointerup', (ev) => {
      if (ev.button === 0) this.mouse.down = false;
      if (ev.button === 2) this.mouse.right = false;
    });
    const look = (dx, dy) => {
      if (this.dev.fly) { this.dev.look(dx, dy); return; }
      const k = 0.0035 * this.settings.lookSpeed;
      this.look.yaw -= dx * k;
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * k * (this.settings.invertY ? -1 : 1), -1.2, 1.1);
    };
    addEventListener('pointermove', (ev) => {
      if (locked()) look(ev.movementX, ev.movementY);
      else if (this.mouse.right) look(ev.clientX - this.mouse.x, ev.clientY - this.mouse.y);
      this.mouse.x = ev.clientX; this.mouse.y = ev.clientY;
    });
    this.freePointer = () => { this.wantLock = false; if (locked()) document.exitPointerLock(); };
    // called by the UI as a menu closes, inside the click/key that closed it
    this.grabPointer = () => lockPointer(true);
    el.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      if (this.dev.fly) { this.dev.wheel(ev.deltaY); return; }
      if (this.fishCam?.active) { this.fishCam.wheel(ev.deltaY); return; }
      if (this.view === 'third') this.look.dist = THREE.MathUtils.clamp(this.look.dist + Math.sign(ev.deltaY) * 3, -10, 60);
      else this.dragNudge(-Math.sign(ev.deltaY));
    }, { passive: false });
  }

  // every setting goes through here: merge, keep the graphics preset label honest, save at once,
  // then push each value to the system that uses it (all live except the two ocean build sizes)
  applySettings(patch = {}) {
    let next = { ...this.settings, ...patch };
    if (patch.preset && PRESETS[patch.preset]) next = { ...next, ...PRESETS[patch.preset] };
    else if (!('preset' in patch) && GFX_KEYS.some((k) => k in patch)) next.preset = detectPreset(next);
    this.settings = sanitize(next);
    saveSettings(this.settings);
    const s = this.settings;
    this.binds = resolveBinds(s.binds);
    this.audio.setVolumes({ master: s.volume, sfx: s.sfxVol, amb: s.ambVol, ui: s.uiVol });
    this.audio.setFocus(!document.hidden && document.hasFocus(), s.muteBlur);
    Object.assign(GFX, { drawDistance: s.drawDistance, vegetation: s.vegetation, buildings: s.buildings, wildlife: s.wildlife, fishCount: s.fishCount, weatherFx: s.weatherFx, reduceMotion: s.reduceMotion, reduceFlash: s.reduceFlash });
    setUnits(s.unitDist, s.unitWeight, s.unitSpeed);
    this.applyDensity();
    if (this.weather) this.weather.severe = s.severeWeather !== false;
    this.e.setQuality(s);
    const root = document.documentElement;
    root.style.setProperty('--hud-scale', String(s.hudScale * (s.bigText ? 1.2 : 1)));
    root.style.setProperty('--hud-opacity', String(s.hudOpacity));
    root.style.setProperty('--ui-scale', String(s.bigText ? 1.18 : 1));
    root.classList.toggle('safe-colors', s.safeColors);
    this.ui.fpsShow?.(s.fps || this.dev?.fps);
    this.dev?.sync();
    if ('mouseLock' in patch) {
      if (!this.settings.mouseLock) this.freePointer?.();
      this.ui.lookHint(this.settings.mouseLock && document.pointerLockElement !== this.e.renderer.domElement);
    }
  }

  // vegetation and fish-count settings that act on objects already built
  applyDensity() {
    for (const v of this.scenery?.userData.veg || []) v.mesh.count = Math.round(v.n * GFX.vegetation);
    FISH_TUNE.maxActors = Math.max(1, Math.round(10 * GFX.fishCount));
    if (this.ambient) this.ambient.max = Math.max(1, Math.round(7 * GFX.fishCount));
  }

  resetProgress() {
    resetSave();
    location.href = location.pathname;
  }

  dragNudge(dir) {
    this.fishing.adjustDrag(dir);
    if (this.fishing.state !== 'fight') this.ui.toast(`Drag set to ${this.fishing.dragSetting().toFixed(1)} lb (line breaks at ${Math.round(effectiveTest(LINES[this.save.equip.line].test, this.save.wear.line))} lb)`, 'info');
  }

  // X: put the rod away / take it out again (only with nothing in the water)
  toggleHolster() {
    if (this.fishing.busy()) { this.ui.toast('Reel in before you put the rod away.', 'info'); return; }
    this.holstered = !this.holstered;
    this.ui.toast(this.holstered ? 'Rod put away.' : 'Rod out.', 'info');
  }

  canFish() {
    if (this.holstered) return false;
    if (this.ui.isOpen() || this.view !== 'first') return false;
    if (this.net.state !== 'stowed') { this.ui.toast('Haul the net in before casting.', 'info'); return false; }
    if (this.troll.active) { this.ui.toast('Clear the trolling spread first (R).', 'info'); return false; }
    if (Math.abs(this.boatSpeed()) > 6) { this.ui.toast('Slow down to cast.', 'info'); return false; }
    if (!this.permitOk()) return false;
    return true;
  }

  // fishing here needs a permit (a tournament entry covers it); toasts where to buy one
  permitOk() {
    if (this.tour && !this.tour.done) return true;
    if (hasPermit(this.save, this.loc.id)) return true;
    const at = this.dockHere();
    const where = at === 'buyer' ? 'from the supply boat (B)' : at && at.dock.profile.services.includes('tackle') ? 'here (B)' : 'at a bait shop or marina (see the Chart, C)';
    this.ui.toast(`No fishing permit for ${this.loc.name}. Get one ${where}.`, 'bad');
    return false;
  }

  // ---------------------------------------------------------------- loop
  update(dt) {
    this.time += dt;
    this.perfTick(dt);
    const fighting = this.fishing.state === 'fight';
    const k = (act) => !this.dev.fly && this.keys.has(this.binds.map[act]);   // is this action's key held (none while the dev camera flies)
    // boat controls (A/D steer the rod during a fight)
    const c = this.boat.control;
    const throttleTarget = (k('forward') ? 1 : 0) - (k('back') ? 1 : 0);
    const camOn = this.fishCam?.active;   // the fish cam is hanging: W/S run its cable, the boat sits still
    c.throttle += ((this.foot || camOn ? 0 : throttleTarget) - c.throttle) * Math.min(1, dt * 3);
    c.steer = fighting || this.foot || camOn ? 0 : (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
    if (this.foot) this.walk(dt, k, fighting);
    if (k('lookLeft')) this.look.yaw += dt * 1.6;
    if (k('lookRight')) this.look.yaw -= dt * 1.6;
    if (k('lookUp')) this.look.pitch = Math.min(1.1, this.look.pitch + dt * 1.2);
    if (k('lookDown')) this.look.pitch = Math.max(-1.2, this.look.pitch - dt * 1.2);
    this.boat.update(dt, this.e.floaters, this.loc.current);
    if (this.boat.body) {
      const hit = this.obstacles.resolve(this.boat.body, this.boat.hull.length, this.boat.hull.beam);
      this.bumpCool -= dt;
      if (hit > 0.6 && this.bumpCool <= 0) { this.audio.play('bump', Math.min(1, hit / 5)); this.bumpCool = 0.5; }
    }
    this.audio.engine(c.throttle, this.boatSpeed());
    this.fishCam.update(dt);
    this.updateCamera(dt);
    this.dev.update(dt);   // the free-fly camera takes over here when it is on

    // the underwater camera hands back to the angler when there's nothing left to watch
    if (this.view === 'under' && !['water', 'bite', 'fight'].includes(this.fishing.state)) { this.view = 'first'; this.restoreLook(); }
    // holster: ease the rod and hands down out of view (and back up)
    this.rod.holster += ((this.holstered ? 1 : 0) - this.rod.holster) * Math.min(1, dt * 7);
    if (this.holstered && this.rod.holster > 0.995) this.rod.holster = 1;
    // a screaming trolling rod: take the rod back out so the click can grab it
    if (this.holstered && this.troll.pending) { this.holstered = false; this.ui.toast('Rod out.', 'info'); }
    const canAct = (this.view === 'first' || this.view === 'under') && !this.holstered && !this.dev.fly;
    const input = {
      down: this.mouse.down && !this.ui.isOpen() && canAct,
      pressed: this.mouse.pressed && !this.ui.isOpen() && canAct,
      steer: fighting ? (k('right') ? 1 : 0) - (k('left') ? 1 : 0) : 0,
    };
    this.mouse.pressed = false;
    // a screaming trolling rod: the click grabs it instead of casting
    if (this.troll.pending && input.pressed) { this.troll.take(); input.pressed = false; }
    // landing: tip the view down toward the water where the fish is being brought in
    if (this.fishing.state === 'landing') {
      const sp = this.fishing.landing.spot, k = Math.min(1, dt * 3);
      if (this.look.pitch > -0.55) this.look.pitch += (-0.55 - this.look.pitch) * k;
      if (sp && this.view === 'first') {
        const psi = Math.atan2(-(sp.x - this.camera.position.x), -(sp.z - this.camera.position.z));
        const want = this.foot ? psi : psi - (this.boat.heading() - Math.PI / 2);
        this.look.yaw += Math.atan2(Math.sin(want - this.look.yaw), Math.cos(want - this.look.yaw)) * k;
      }
    }
    this.fishing.update(dt, input);
    // the over-the-shoulder fill lights a fish held up to the camera; the rest of the time it
    // would wash out the hands and rod right beside it
    if (this.e.overlayFill) this.e.overlayFill.intensity += ((this.fishing.state === 'caught' ? 3.5 : 0.5) - this.e.overlayFill.intensity) * Math.min(1, dt * 4);
    this.troll.update(dt);
    const tpOn = this.view === 'first' && this.tp;
    this.rod.setSpace(tpOn);
    this.fishing.lctx.camera = tpOn ? this.angler : this.camera;
    this.rod.setVisible(this.view === 'first' && this.fishing.state !== 'caught' && !this.photo && this.rod.holster < 1 && !this.dev.fly);
    this.body.update(dt, tpOn || this.dev.fly);
    this.ui.power(this.fishing.state === 'charging' ? this.fishing.power : null);
    this.net.update(dt);
    const bp = this.dev.fly ? this.dev.focus : this.foot ? this.footPos : this.boat.position;   // the dev camera streams the world around itself
    this.docks.update(this.nightLevel(), bp);
    this.buildings.update(dt, this.nightLevel(), bp);
    this.hall?.update(dt, bp);
    this.shoreHintTick(dt);
    this.hotspots.update(dt, this.time, this.e.floaters, bp);
    this.ambient.update(dt, bp);
    this.wildlife.update(dt, bp);
    this.nightFX.update(this.nightLevel(), this.camera);
    this.aiBoats.update(dt, bp);
    this.shore.update(dt, bp, this.nightLevel());
    this.keepers.update(dt, bp, this.camera.position);
    this.birds.update(dt, bp, this.nightLevel(), this.camera.position);
    this.fishLife.update(dt, bp);
    this.audio.update(dt, REELS[this.save.equip.reel].ratio, this);

    // clock: one real second = one game minute; nights are skipped
    const tick = this.dev.paused ? 0 : dt / 60;   // dev panel: clock paused
    this.weather.update(dt, tick, this.camera, { hour: this.save.hour, day: this.save.day || 1 });
    this.docks.yOff = -this.e.getTide();   // docks ride the tide with the land
    this.boat.rough = this.weather.rough;
    this.boat.gust = this.weather.gust;
    this.tourTick(dt);
    this.save.weather = this.weather.id;
    let hour = this.save.hour + tick;
    // full 24-hour clock; a new day (and new challenges) at midnight
    if (hour >= 24) {
      hour -= 24;
      this.save.day = (this.save.day || 1) + 1;
      this.ensureChallenges();
      this.ui.toast('New challenges posted.', 'good');
    }
    this.save.hour = hour;
    this.permitWatch();
    this.save.played = (this.save.played || 0) + dt;
    for (const k of ageWell(this.save.livewell, dt / 60, this.boatMods().wellSlow * (this.boatMods().shade ? 0.75 : 1))) {
      this.ui.toast(`The ${SPECIES_BY_ID[k.sp].name.toLowerCase()} in your livewell died. Sell soon - it's worth less now.`, 'bad');
    }
    for (const k of ageHold(this.save.hold, dt / 60, this.boatMods().wellSlow)) {
      this.ui.toast(`The ${SPECIES_BY_ID[k.sp].name.toLowerCase()} in the hold has spoiled. Sell it for what it fetches.`, 'bad');
    }
    this.sunTimer += dt;
    // re-bake the sky every 15 s, but every 2 s around dusk and dawn so the change is smooth
    const nearHorizon = Math.abs(this.sunElevation(hour)) < 5;
    if (this.sunTimer > (nearHorizon ? 2 : 15)) this.applySun();
    if (Math.floor(this.time) !== Math.floor(this.time - dt)) {
      this.ui.hud();
      if (Math.floor(this.time) % 10 === 0) { writeSave(this.save); autoBackup(this.save); }
    }
    const showSonar = !this.foot && (this.dev.sonar ?? this.settings.sonar);
    this.sonar.c.style.display = showSonar ? '' : 'none';
    this.compass.update();
    if (showSonar) this.sonar.update(dt, this.depthUnderBoat(), this.ambient.near(bp.x, bp.z, this.boatMods().sonarRange), this.hotspots.near(bp.x, bp.z, 60), ['SONAR', 'CHIRP', 'CHIRP SI'][(this.save.custom?.[this.save.boat]?.up?.sonar) || 0], this.settings.depthReadout);
  }

  // frame-rate counter (Settings > Display) and a one-time hint when the game runs slowly
  perfTick(dt) {
    const f = this.perf || (this.perf = { t: 0, n: 0, ms: 0, slowT: 0, warned: false });
    f.t += dt; f.n++; f.ms = Math.max(f.ms, dt * 1000);
    if (f.t < 0.5) return;
    const fps = f.n / f.t;
    if (this.settings.fps || this.dev.fps) this.ui.fpsText(`${Math.round(fps)} fps  ${(1000 / Math.max(fps, 1)).toFixed(1)} ms`);
    // never changes anything on its own: only suggests a lower preset after 20 s under 24 fps
    f.slowT = fps < 24 ? f.slowT + f.t : 0;
    if (f.slowT > 20 && !f.warned && this.settings.preset !== 'low') {
      f.warned = true;
      this.ui.toast('Running slowly? Settings > Graphics has Low and Medium presets.', 'info');
    }
    f.t = 0; f.n = 0; f.ms = 0;
  }

  updateCamera(dt) {
    const cam = this.camera, b = this.boat.body;
    const heading = this.boat.heading();
    // The angler's eye is tracked every frame whatever the camera does: the rod (and so the
    // line and the hooked fish) hang off it, never off an orbiting or underwater camera.
    if (this.view === 'first') this.anglerLook = { yaw: this.look.yaw, pitch: this.look.pitch };
    const al = this.anglerLook || { yaw: this.boatSpec().face || 0, pitch: -0.06 };
    const A = this.angler;
    if (this.foot) return this.footCamera(dt, al);
    this.boat.eyeWorld(A.position);
    // half of the boat's roll/pitch reaches the eye
    // world-space tilt = boat rotation with its heading taken out
    _q.setFromAxisAngle(UP, heading);
    const tilt = _q2.copy(b.quat).multiply(_q.invert());
    tilt.slerp(new THREE.Quaternion(), GFX.reduceMotion ? 1 : 0.55);   // reduce motion: the horizon stays level
    _e.set(al.pitch, heading - Math.PI / 2 + al.yaw, 0, 'YXZ');
    A.quaternion.setFromEuler(_e).premultiply(tilt);
    // green water over the deck: keep the eye above the wave crest rolling past
    A.position.y = Math.max(A.position.y, (this.water[0] || 0) + 0.7);
    A.updateMatrixWorld();
    if (this.view === 'first') {
      cam.position.copy(A.position);
      cam.quaternion.copy(A.quaternion);
      if (this.tp) this.shoulderCamera(cam, A);
    } else if (this.view === 'under') {
      this.underwaterCamera(dt);
    } else if (this.view === 'cam') {
      this.fishCam.placeCamera(dt);
    } else {
      const L = this.boat.hull.length;
      const dist = L * 1.3 + 6 + this.look.dist;
      const a = heading + Math.PI + this.look.yaw;
      const target = _v.copy(b.pos).add(new THREE.Vector3(0, L * 0.12 + 1, 0));
      const pitch = THREE.MathUtils.clamp(0.25 - this.look.pitch * 0.6, 0.05, 1.3);
      cam.position.set(target.x + Math.cos(a) * dist * Math.cos(pitch), target.y + Math.sin(pitch) * dist, target.z - Math.sin(a) * dist * Math.cos(pitch));
      cam.position.y = Math.max(cam.position.y, (this.water[0] || 0) + 1.5);
      cam.lookAt(target);
    }
    this.fightShake(dt);
    cam.updateMatrixWorld();
  }

  // Third person over the right shoulder: behind and above the angler, along the aim, pulled in where terrain, a dock deck,
  // a building or the water would be in the way. The angler (A) is still where the fishing is aimed from.
  shoulderCamera(cam, A) {
    const f = _v.set(0, 0, -1).applyQuaternion(A.quaternion), right = _v2.set(1, 0, 0).applyQuaternion(A.quaternion);
    const want = _v3.copy(A.position).addScaledVector(f, -3.6).addScaledVector(right, 0.8);
    want.y += 1.0;
    const surf = this.water[0] || 0;
    let t = 1;
    for (let i = 1; i <= 16; i++) {
      const u = i / 16, x = A.position.x + (want.x - A.position.x) * u, y = A.position.y + (want.y - A.position.y) * u, z = A.position.z + (want.z - A.position.z) * u;
      const deck = this.docks.deckAt(x, z);
      if (this.heightAt(x, z) + 0.35 > y || (deck !== null && deck + 0.35 > y) || this.buildings?.blocks(x, z)) { t = Math.max(0.28, (i - 1.5) / 16); break; }
    }
    cam.position.lerpVectors(A.position, want, t);
    cam.position.y = Math.max(cam.position.y, surf + 0.45);
    cam.lookAt(_v3.copy(A.position).addScaledVector(f, 14).addScaledVector(right, 0.25).setY(A.position.y - 0.5 + f.y * 14));
  }

  // a heavy fish on the line (and landing jolts) shake the view a little; Reduce motion turns it off
  fightShake(dt) {
    const F = this.fishing;
    if (GFX.reduceMotion || this.view !== 'first') return;
    const a = (F.state === 'fight' ? F.camShake : 0) + F.kickV;
    if (a < 0.005) return;
    this.shakeT = (this.shakeT || 0) + dt * FEEL.cam.freq;
    const k = FEEL.cam.shake * a, t = this.shakeT;
    this.camera.quaternion.multiply(_q.setFromEuler(_e.set(Math.sin(t * 1.7) * k, Math.sin(t * 2.3 + 1) * k * 0.8, Math.sin(t * 1.1 + 2) * k * 0.6, 'YXZ')));
  }

  // follow the lure (or the hooked fish) under the surface; orbit with right-drag
  underwaterCamera(dt) {
    const cam = this.camera, f = this.fishing;
    const fish = f.state === 'fight' ? f.fish : null;
    const target = fish ? fish.pos : f.lure;
    const base = fish ? fish.heading + Math.PI * 0.65 : this.boat.heading() + Math.PI;
    const ang = base + this.look.yaw;
    const dist = fish ? THREE.MathUtils.clamp(fish.len * 2.6, 1.6, 9) : 2.4;
    const surf = this.water[0] || 0;
    const want = _v.set(target.x + Math.cos(ang) * dist, target.y + 0.25 - this.look.pitch * 1.5, target.z - Math.sin(ang) * dist);
    want.y = Math.min(want.y, surf - 0.7);
    want.y = Math.max(want.y, this.heightAt(want.x, want.z) + 0.4);
    if (!this.underInit) { cam.position.copy(want); this.underInit = true; }
    cam.position.lerp(want, 1 - Math.exp(-dt * 4));
    cam.lookAt(target.x, Math.min(target.y, surf - 0.2), target.z);
  }

  // ---------------------------------------------------------------- on foot (docks and shore)
  groundAt(x, z) { return this.docks.deckAt(x, z) ?? this.heightAt(x, z); }
  standable(x, z) { return (this.docks.deckAt(x, z) !== null || this.heightAt(x, z) > -0.55) && !this.shore?.blocks(x, z) && !this.buildings?.blocks(x, z); }

  // where something is, as a clock bearing from the way you face ("at 2 o'clock")
  bearing(x, z, from, facing) {
    const rel = Math.atan2(-(z - from.z), x - from.x) - facing;
    const h = ((Math.round((-rel / (Math.PI * 2)) * 12) % 12) + 12) % 12;
    return `at ${h || 12} o'clock`;
  }

  walk(dt, k, fighting) {
    const f = this.foot, b = this.boat.body, m = this.moor;
    // the boat stays tied up where it was left
    if (m && b) {
      const kk = Math.min(1, dt * 1.5);
      b.vel.x += ((m.x - b.pos.x) * 0.4 - b.vel.x) * kk;
      b.vel.z += ((m.z - b.pos.z) * 0.4 - b.vel.z) * kk;
      b.angVel.y *= Math.exp(-dt * 2);
    }
    f.speed = 0;
    if (fighting || this.fishing.state === 'charging' || this.ui.isOpen() || this.view !== 'first') return;
    const fwd = (k('forward') ? 1 : 0) - (k('back') ? 1 : 0), side = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
    if (!fwd && !side) return;
    const yaw = this.look.yaw, run = k('sprint') ? 3.6 : 1.7;
    let mx = -Math.sin(yaw) * fwd + Math.cos(yaw) * side, mz = -Math.cos(yaw) * fwd - Math.sin(yaw) * side;
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    const step = run * dt, nx = f.x + mx * step, nz = f.z + mz * step;
    const g0 = this.groundAt(f.x, f.z);
    // no stepping off the dock edge or up a cliff; slide along edges instead
    const ok = (x, z) => this.standable(x, z) && Math.abs(this.groundAt(x, z) - g0) < 0.35;
    if (ok(nx, nz)) { f.x = nx; f.z = nz; } else if (ok(nx, f.z)) f.x = nx; else if (ok(f.x, nz)) f.z = nz; else return;
    f.speed = run;
  }

  footCamera(dt, al) {
    const f = this.foot, A = this.angler, cam = this.camera;
    const g = this.groundAt(f.x, f.z), surf = this.water[0] || 0;
    f.bob = (f.bob || 0) + dt * f.speed * 2.2;
    const eye = Math.max(g, surf - 1.1) + 1.68 + Math.sin(f.bob * 2) * 0.022 * Math.min(1, f.speed) * (GFX.reduceMotion ? 0 : 1);
    f.y = f.y === undefined ? eye : f.y + (eye - f.y) * Math.min(1, dt * 10);
    A.position.set(f.x, f.y, f.z);
    _e.set(al.pitch, al.yaw, 0, 'YXZ');
    A.quaternion.setFromEuler(_e);
    A.updateMatrixWorld();
    this.footPos.set(f.x, g, f.z);
    if (this.view === 'first') {
      cam.position.copy(A.position);
      cam.quaternion.copy(A.quaternion);
      if (this.tp) this.shoulderCamera(cam, A);
    } else if (this.view === 'under') {
      this.underwaterCamera(dt);
    } else if (this.view === 'cam') {
      this.fishCam.placeCamera(dt);
    } else {
      const a = al.yaw + Math.PI * 1.5 + this.look.yaw;
      const dist = Math.max(2.5, 7 + this.look.dist * 0.5);
      const pitch = THREE.MathUtils.clamp(0.3 - this.look.pitch * 0.6, 0.05, 1.3);
      const t = _v.set(f.x, f.y - 0.5, f.z);
      cam.position.set(t.x + Math.cos(a) * dist * Math.cos(pitch), t.y + Math.sin(pitch) * dist, t.z - Math.sin(a) * dist * Math.cos(pitch));
      cam.position.y = Math.max(cam.position.y, surf + 0.8, this.groundAt(cam.position.x, cam.position.z) + 0.5);
      cam.lookAt(t);
    }
    cam.updateMatrixWorld();
  }

  restoreLook() {
    if (this.foot && this.anglerLook) { this.look.yaw = this.anglerLook.yaw; this.look.pitch = this.anglerLook.pitch; }
    else { this.look.yaw = this.boatSpec().face || 0; this.look.pitch = -0.06; }
  }

  // somewhere to step off the boat: the nearest dock, else a bit of bank beside the hull
  shoreSpot() {
    const bp = this.boat.position, reach = this.boat.hull.length / 2 + 6;
    const n = this.docks.nearest(bp.x, bp.z);
    if (n && n.dist < reach) return { x: n.point.x, z: n.point.z, dock: true, yaw: Math.atan2(-n.dock.dx, -n.dock.dz) };
    for (let r = this.boat.hull.beam / 2 + 0.8; r < reach; r += 0.8) {
      for (let a = 0; a < Math.PI * 2; a += 0.25) {
        const x = bp.x + Math.cos(a) * r, z = bp.z + Math.sin(a) * r;
        if (this.heightAt(x, z) > 0.05) return { x, z, yaw: Math.atan2(Math.cos(a), Math.sin(a)) };   // facing back out over the water
      }
    }
    return null;
  }

  toggleShore() {
    if (this.view !== 'first') { this.view = 'first'; this.restoreLook(); }
    if (this.fishing.busy() || this.troll.active) { this.ui.toast('Reel in first.', 'info'); return; }
    if (this.net.state !== 'stowed') { this.ui.toast('Haul the net first.', 'info'); return; }
    if (this.foot) {
      const bp = this.boat.position, d = Math.hypot(bp.x - this.foot.x, bp.z - this.foot.z);
      if (d > this.boat.hull.length / 2 + 4) {
        this.ui.toast(`Your boat is ${fmtDist(d)} away, ${this.bearing(bp.x, bp.z, this.foot, this.look.yaw + Math.PI / 2)}. Walk back to it.`, 'info');
        return;
      }
      this.look.yaw -= this.boat.heading() - Math.PI / 2;   // world yaw back to boat-relative
      this.foot = null;
      this.moor = null;
      this.ui.toast('Back aboard.', 'info');
      return;
    }
    if (Math.abs(this.boatSpeed()) > 1.2) { this.ui.toast('Stop the boat first.', 'info'); return; }
    const spot = this.shoreSpot();
    if (!spot) {
      const bp = this.boat.position, n = this.docks.nearest(bp.x, bp.z);
      if (n) this.ui.toast(`Nearest dock: ${fmtDist(n.centre)}, ${this.bearing(n.dock.end.x, n.dock.end.z, bp, this.boat.heading())}. Pull up alongside and press G.`, 'info');
      else if (this.heightAt(bp.x, bp.z) < -60) this.ui.toast('Open ocean - no shore to fish from out here.', 'info');
      else this.ui.toast('Get up close to the bank, then press G to go ashore.', 'info');
      return;
    }
    const bp = this.boat.position;
    this.moor = { x: bp.x, z: bp.z };
    this.foot = { x: spot.x, z: spot.z, speed: 0 };
    this.look.yaw = spot.yaw;
    this.look.pitch = -0.06;
    this.anglerLook = { yaw: this.look.yaw, pitch: this.look.pitch };
    this.ui.toast(spot.dock ? 'On the dock. WASD to walk, Shift to hurry, G to get back in the boat.' : 'Ashore. WASD to walk the bank, G to get back in the boat.', 'good');
  }

  // "G" prompt when there's somewhere to step to
  shoreHintTick(dt) {
    this.hintT = (this.hintT || 0) - dt;
    if (this.hintT > 0) return;
    this.hintT = 0.3;
    let text = '';
    if (this.view === 'first' && !this.fishing.busy() && !this.ui.isOpen()) {
      if (this.foot) {
        const bp = this.boat.position;
        if (Math.hypot(bp.x - this.foot.x, bp.z - this.foot.z) < this.boat.hull.length / 2 + 4) text = 'get back in the boat';
      } else if (Math.abs(this.boatSpeed()) < 1.2) {
        const bp = this.boat.position, reach = this.boat.hull.length / 2 + 6, n = this.docks.nearest(bp.x, bp.z);
        if (n && n.dist < reach) text = 'step onto the dock';
        else {
          for (let a = 0; a < 6.28 && !text; a += 0.5) if (this.heightAt(bp.x + Math.cos(a) * (reach - 1), bp.z + Math.sin(a) * (reach - 1)) > 0.05) text = 'go ashore';
        }
      }
    }
    const KL = (a) => keyLabel(this.binds.map[a]);
    const hints = text ? [[KL('stepOff'), text]] : [];
    if (this.view === 'first' && !this.fishing.busy() && !this.ui.isOpen() && this.save.livewell.length && this.marketAccess() === 'dock') hints.push([KL('livewell'), 'sell your catch at the dock']);
    // at a shop door on foot: what this building sells (B tackle & permits, Y boats)
    const door = this.foot && this.view === 'first' && !this.ui.isOpen() ? this.buildings?.doorNear(this.foot.x, this.foot.z) : null;
    if (door) {
      if (door.services.includes('tackle')) hints.push([KL('shop'), `${door.title}: bait, tackle & permits`]);
      if (door.services.includes('boats')) hints.push([KL('marina'), 'boat dealer']);
    }
    if (this.foot && this.view === 'first' && !this.ui.isOpen() && this.hall?.inside(this.foot)) hints.push([KL('trophy'), 'trophy room: records, mounts']);
    if (!this.ui.isOpen() && this.view === 'first' && this.keepers?.who()) hints.push([KL('talk'), `talk to ${this.keepers.who().d.name}`]);
    if (this.view === 'first' && !this.ui.isOpen() && !this.fishing.busy() && this.fishCam.usable()) hints.push([KL('fishcam'), 'lower the fish cam']);
    this.ui.shoreHint(this.fishCam.active ? [] : hints);
  }

  // photo mode: hide every overlay (HUD and rod); the views and camera controls still work
  togglePhoto() {
    this.photo = !this.photo;
    document.getElementById('hud').style.visibility = this.photo ? 'hidden' : '';
    let hint = document.getElementById('photoHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'photoHint';
      hint.textContent = 'PHOTO MODE · right-drag to frame · V third person · U underwater · P to exit';
      document.body.appendChild(hint);
    }
    hint.classList.remove('show');
    if (this.photo) { void hint.offsetWidth; hint.classList.add('show'); }
  }

  toggleUnderwater() {
    const s = this.fishing.state;
    if (this.view === 'under') { this.view = 'first'; this.restoreLook(); return; }
    if (s !== 'water' && s !== 'bite' && s !== 'fight') { this.ui.toast('Cast first - the underwater camera follows your lure or fish.', 'info'); return; }
    this.view = 'under';
    this.underInit = false;
    this.look.yaw = 0;
    this.look.pitch = 0;
  }

  // Sun by day; after dusk the moon drives the sky (see main.js setNight). Sun is up from
  // ~5:40 to ~20:10; the moon rises in the east at dusk and sets in the west at dawn.
  sunElevation(h = this.save.hour) {
    return 64 * Math.sin((Math.PI * (h - 5.6)) / 14.6);
  }

  nightLevel(h = this.save.hour) {
    return THREE.MathUtils.smoothstep(-this.sunElevation(h), -4, 2.5);
  }

  applySun() {
    this.sunTimer = 0;
    const h = this.save.hour, sunEl = this.sunElevation(h);
    let el, az;
    if (sunEl > 0.5) {
      el = sunEl;
      az = 95 + ((h - 6) / 14) * 170;
    } else {
      const hm = (h - 19.5 + 24) % 24;                     // hours since the moon rose
      el = Math.max(6, 50 * Math.sin(Math.PI * Math.min(1, hm / 11)));
      az = 105 + (Math.min(hm, 11) / 11) * 150;
    }
    this.e.setSun(el, az);
    this.e.setNight(this.nightLevel(h));
  }

  queryPoints() { return this.fishing.queryPoints(); }

  // water query results: [camera, lure, fish]
  ingestWater(result, count) {
    for (let i = 0; i < 3 && i < count; i++) this.water[i] = result[i * 4];
  }

  splash(x, z, amp, size) {
    const f = this.e.floaters;
    f.impacts.push({ x, z, t: f.time, amp, size });
    if (f.impacts.length > 8) f.impacts.shift();
    this.fishLife?.noise(x, z, amp * size);
    this.audio.splashAt(x, z, amp, size);
  }

  boatSpeed() { return this.foot ? 0 : this.boat?.speed || 0; }
  boatSpec() { return BOATS[this.save.boat]; }

  // ---------------------------------------------------------------- boat yard (paint, name, upgrades)
  boatMods() { return boatModsOf(this.save, this.save.boat); }
  boatCust(id) { return { cfg: customOf(this.save, id), mods: boatModsOf(this.save, id) }; }
  // store one boat's settings; the live boat repaints at once if it is the one in use
  saveCustom(id, cfg) {
    this.commit({ custom: { ...(this.save.custom || {}), [id]: cfg } });
    if (id === this.save.boat && this.boat) this.boat.refresh(this.boatCust(id));
  }
  // paint + name from the draft: paint changes cost a paint job, lettering is free
  applyYard(id, draft) {
    const cur = customOf(this.save, id), paint = ['hull', 'stripe', 'trim', 'bottom', 'house', 'canopy', 'wear'].some((k) => draft[k] !== cur[k]);
    const cost = paint ? paintCost(id) : 0;
    if (this.save.cash < cost) { this.ui.toast(`A paint job is ${'$' + cost}: not enough cash.`, 'info'); return false; }
    this.commit({ cash: this.save.cash - cost });
    this.saveCustom(id, { ...cur, ...draft, name: finalName(draft.name, id), up: cur.up });
    if (cost) this.audio.play('cash');
    this.ui.toast(cost ? `Fresh paint on ${finalName(draft.name, id)} (${'$' + cost})` : `${finalName(draft.name, id)} relettered`, 'good');
    return true;
  }
  buyUpgrade(id, upId) {
    const cur = customOf(this.save, id), tier = cur.up[upId] || 0, def = UPGRADES[upId];
    if (!def || tier >= def.tiers.length || !def.boats.includes(id) || !this.save.boats.includes(id)) return false;
    const price = upgradePrice(id, upId, tier), lvl = upgradeLevel(upId, tier);
    if (levelOf(this.save.xp || 0) < lvl) { this.ui.toast(`Needs angler level ${lvl}.`, 'info'); return false; }
    if (this.save.cash < price) { this.ui.toast('Not enough cash.', 'info'); return false; }
    this.commit({ cash: this.save.cash - price });
    this.saveCustom(id, { ...cur, up: { ...cur.up, [upId]: tier + 1 } });
    this.audio.play('cash');
    this.ui.toast(`Fitted: ${def.tiers[tier].name}`, 'good');
    return true;
  }
  // I: drop / raise the anchor (needs a winch)
  toggleAnchor() {
    if (this.foot) { this.ui.toast('The anchor is on the boat.', 'info'); return; }
    const b = this.boat;
    if (b.anchored) { b.raiseAnchor(); this.ui.toast('Anchor up', 'info'); return; }
    const m = this.boatMods();
    if (!m.anchorDepth) { this.ui.toast('No anchor winch on this boat - fit one at the marina (Y).', 'info'); return; }
    const depth = this.depthUnderBoat();
    if (depth < 0.8) { this.ui.toast('Too shallow here to set the anchor properly.', 'info'); return; }
    if (depth > m.anchorDepth) { this.ui.toast(`Too deep for your anchor line (${fmtDist(m.anchorDepth)}, this is ${fmtDist(depth)}).`, 'info'); return; }
    if (Math.abs(this.boatSpeed()) > 2.5) { this.ui.toast('Slow down to set the anchor.', 'info'); return; }
    b.dropAnchor(depth);
    this.ui.toast(`Anchor down in ${fmtDist(depth)}`, 'good');
  }
  hour() { return this.save.hour; }
  depthUnderBoat() { const p = this.boat.position; return Math.max(0, -this.heightAt(p.x, p.z)); }

  // ---------------------------------------------------------------- catches & economy
  onCatch(f, done) {
    const res = logCatch(this.save, f.sp.id, f.morph.id, f.lb, f.how);
    const kept = keepFish(f);
    const access = this.marketAccess();
    const value = this.market.value(this.save, kept, access === 'buyer');
    this.pendingCatch = { f, done, value, res, kept };
    const { inches } = fishLengthM(f.sp, f.lb);
    // a full livewell: offer to swap out the least valuable fish if this one beats it
    const well = this.save.livewell, slots = wellSlots(this.save.boat, this.save);
    let cull = null;
    if (well.length >= slots) {
      const worst = well.reduce((a, k) => (!a || this.market.value(this.save, k) < this.market.value(this.save, a) ? k : a), null);
      if (worst && this.market.value(this.save, worst) < this.market.value(this.save, kept)) cull = { name: SPECIES_BY_ID[worst.sp].name, lb: worst.lb };
    }
    this.ui.showCatch({
      sp: f.sp, morph: f.morph, lb: f.lb, inches, value, iced: kept.iced, xp: catchXp(f.sp, f.morph, f.lb, res).xp,
      mountNote: res.isNewSpecies || res.isRecord ? mountNote([res.isNewSpecies ? 'First of its kind' : 'Personal best']) : '',
      how: f.how, isNewSpecies: res.isNewSpecies, isNewMorph: res.isNewMorph, isRecord: res.isRecord,
      well: well.length, slots, cull, canSell: !!access, buyer: access === 'buyer', fishOfDay: this.market.fishOfDay(this.save.day || 1) === f.sp.id,
    });
  }

  // mode: 'keep' (livewell), 'cull' (swap out the least valuable kept fish), 'sell' (at the market), 'release'
  finishCatch(mode) {
    const p = this.pendingCatch;
    if (!p) return;
    const stats = { ...p.res.save.stats, caught: p.res.save.stats.caught + 1 };
    if (!stats.heaviest || p.f.lb > stats.heaviest.lb) stats.heaviest = { sp: p.f.sp.id, lb: p.f.lb };
    let cash = p.res.save.cash, livewell = p.res.save.livewell, market = p.res.save.market;
    if (mode === 'sell') {
      const v = this.market.value(p.res.save, p.kept, this.marketAccess() === 'buyer');
      cash += v; stats.earned += v;
      market = this.market.recordSale(p.res.save, p.kept.sp);
      this.audio.play('cash');
      this.ui.toast(`Sold, $${Math.round(v).toLocaleString()}.`, 'good');
    } else if (mode === 'keep' || mode === 'cull') {
      if (mode === 'cull') {
        const worst = livewell.reduce((a, k) => (!a || this.market.value(p.res.save, k) < this.market.value(p.res.save, a) ? k : a), null);
        livewell = livewell.filter((k) => k !== worst);
        stats.released += 1;
        this.ui.toast(`Culled: released the ${SPECIES_BY_ID[worst.sp].name.toLowerCase()} to make room.`, 'info');
      }
      livewell = [...livewell, p.kept];
      this.ui.toast(p.kept.iced ? 'On ice in the fish box.' : `In the livewell (${livewell.length}/${wellSlots(this.save.boat, this.save)}).`, 'info');
    } else {
      stats.released += 1;
      p.f.released = true;
      this.fishing.luckUntil = performance.now() + 180000;
      this.ui.toast('Released. Luck is up for three minutes.', 'good');
      const at = this.foot ? this.fishing.lure : this.boat.position;
    }
    this.save = { ...p.res.save, cash, stats, livewell, market };
    let xpGain = catchXp(p.f.sp, p.f.morph, p.f.lb, p.res).xp;
    // daily challenges
    const ch = recordCatch(this.save.challenges, p.f.sp, p.f.morph, p.f.lb);
    let bonus = 0;
    for (const c of ch.completed) {
      bonus += c.reward;
      this.save = addBadge(this.save, c.text, this.save.location);
      xpGain += challengeXp(c.reward);
      this.ui.toast(`Done: ${c.text}. Paid $${c.reward.toLocaleString()}.`, 'good');
    }
    this.save = { ...this.save, challenges: ch.state, cash: this.save.cash + bonus, stats: { ...this.save.stats, earned: this.save.stats.earned + bonus } };
    if (bonus) this.audio.play('cash');
    this.ui.challenges(this.save.challenges);
    // tournament weigh-in (kept or released, it's weighed at the boat)
    const tourFish = this.tour && !this.tour.done && this.tour.record(p.f.sp, p.f.lb);
    // records per water, and a mount candidate for a first, a personal best or the best fish of an event
    this.save = noteCatch(this.save, { f: p.f, inches: fishLengthM(p.f.sp, p.f.lb).inches, isNewSpecies: p.res.isNewSpecies, isRecord: p.res.isRecord, tour: tourFish ? { key: this.tour.key, name: this.tour.def.name } : null });
    if (tourFish) {
      this.ui.toast(`Weighed in: ${p.f.lb.toFixed(2)} lb for the ${this.tour.def.name}`, 'good');
      this.ui.leaderboard(this.tour);
    }
    this.addXp(xpGain);
    writeSave(this.save);
    p.done();
    this.pendingCatch = null;
    this.ui.hud();
  }

  // the dock you are at (on it, or tied up alongside), 'buyer' where the water has no docks
  // (a supply/buyer boat covers everything), else null
  dockHere() {
    if (!this.docks.list.length) return 'buyer';
    this.chart.places();   // makes sure each dock has its profile
    if (this.foot) {
      if (this.docks.deckAt(this.foot.x, this.foot.z) === null) { const sd = this.buildings?.doorNear(this.foot.x, this.foot.z); return sd ? { dock: sd.dock } : null; }
      const n = this.docks.nearest(this.foot.x, this.foot.z);
      return n ? { dock: n.dock } : null;
    }
    const bp = this.boat.position, n = this.docks.nearest(bp.x, bp.z);
    return n && n.dist < this.boat.hull.length / 2 + 6 && Math.abs(this.boatSpeed()) < 1.5 ? { dock: n.dock } : null;
  }

  // ---------------------------------------------------------------- trophy room
  // the wall and the records board are read (and mounts ordered) at the trophy hall beside the Marina office, at the
  // marina's door or dock, or anywhere on water without docks (the buyer boat takes the order)
  trophyAccess(quiet) {
    const at = this.dockHere();
    if (at === 'buyer') return true;
    if (this.hall && this.foot && this.hall.dist(this.foot) < 16) return true;
    if (at && at.dock.profile.services.includes('boats')) return true;
    if (!quiet) {
      const sh = this.docks.list.find((d) => d.profile.services.includes('boats'));
      this.ui.toast(sh ? 'The trophy room is beside the marina office. Press C for the chart.' : 'There is no trophy room on this water.', 'info');
    }
    return false;
  }

  mountTrophy(id, replaceId) {
    const r = mountCand(this.save, id, replaceId);
    if (r.err) { this.ui.toast(r.err, 'info'); return false; }
    this.save = r.save; writeSave(this.save);
    this.audio.play('cash');
    this.ui.toast('Mounted, $' + r.fee + '. ' + SAY.hung[Math.floor(Math.random() * SAY.hung.length)], 'good');
    this.hall?.update(1, this.foot || this.boat.position);
    return true;
  }

  takeDownTrophy(id) {
    const r = takeDown(this.save, id);
    if (r.err) { this.ui.toast(r.err, 'info'); return false; }
    this.save = r.save; writeSave(this.save);
    this.ui.toast(SAY.down[Math.floor(Math.random() * SAY.down.length)], 'info');
    this.hall?.update(1, this.foot || this.boat.position);
    return true;
  }
  mountFee(lb) { return mountFee(lb); }

  // can you use this service (sell / tackle / boats) where you are? toasts where to go if not
  serviceHere(kind) {
    const at = this.dockHere();
    if (at === 'buyer') return true;
    if (at && at.dock.profile.services.includes(kind)) return true;
    const from = this.foot || this.boat.position;
    const list = this.docks.list.filter((d) => d.profile.services.includes(kind));
    list.sort((a, b) => Math.hypot(a.end.x - from.x, a.end.z - from.z) - Math.hypot(b.end.x - from.x, b.end.z - from.z));
    const d = list[0];
    const what = { tackle: 'The tackle shop', boats: 'The boat dealer', sell: 'The fish market' }[kind];
    if (d) {
      const dx = d.end.x - from.x, dz = d.end.z - from.z, dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
      this.ui.toast(`${what} is at the ${d.profile.name} dock, ${fmtDist(Math.hypot(dx, dz))} ${dirs[Math.round(Math.atan2(dx, -dz) / (Math.PI / 4) + 8) % 8]}. Press C for the chart.`, 'info');
    } else this.ui.toast(`No ${what.toLowerCase().replace('the ', '')} on this water.`, 'info');
    return false;
  }

  // ---------------------------------------------------------------- livewell & market
  // 'dock' at a dock (on it, or tied up alongside), 'buyer' where there are no docks (open
  // ocean: a buyer boat takes the catch for a cut), else null
  marketAccess() {
    if (!this.docks.list.length) return 'buyer';
    if (this.foot) return this.docks.deckAt(this.foot.x, this.foot.z) !== null || this.buildings?.doorNear(this.foot.x, this.foot.z) ? 'dock' : null;
    const bp = this.boat.position, n = this.docks.nearest(bp.x, bp.z);
    return n && n.dist < this.boat.hull.length / 2 + 6 && Math.abs(this.boatSpeed()) < 1.5 ? 'dock' : null;
  }

  nearestDockText() {
    const from = this.foot || this.boat.position;
    const n = this.docks.nearest(from.x, from.z);
    if (!n) return '';
    const facing = this.foot ? this.look.yaw + Math.PI / 2 : this.boat.heading();
    return `Nearest dock: ${fmtDist(n.centre)}, ${this.bearing(n.dock.end.x, n.dock.end.z, from, facing)}.`;
  }

  // sell kept fish by id (or every one); returns the total
  sellFish(ids) {
    const access = this.marketAccess();
    if (!access) { this.ui.toast(`No buyer here. Bring your catch to a dock. ${this.nearestDockText()}`, 'info'); return 0; }
    let save = this.save, total = 0;
    const sold = [];
    for (const k of save.livewell) {
      if (ids !== 'all' && !ids.includes(k.id)) continue;
      const v = this.market.value(save, k, access === 'buyer');
      total += v;
      sold.push(k.id);
      save = { ...save, market: this.market.recordSale(save, k.sp) };
    }
    if (!sold.length) return 0;
    save = { ...save, livewell: save.livewell.filter((k) => !sold.includes(k.id)), cash: save.cash + total, stats: { ...save.stats, earned: save.stats.earned + total } };
    this.save = save;
    writeSave(save);
    this.audio.play('cash');
    this.ui.toast(`Sold ${sold.length} fish for $${Math.round(total).toLocaleString()}`, 'good');
    this.ui.hud();
    return total;
  }

  releaseFish(id) {
    const k = this.save.livewell.find((x) => x.id === id);
    if (!k || k.iced || k.health <= 0) return;
    this.commit({ livewell: this.save.livewell.filter((x) => x !== k), stats: { ...this.save.stats, released: this.save.stats.released + 1 } });
    this.ui.toast(`Released the ${SPECIES_BY_ID[k.sp].name.toLowerCase()}.`, 'info');
    this.ui.hud();
  }

  wellCondition(k) { return condition(k); }

  // ---------------------------------------------------------------- tournaments
  tournaments() { return tournamentsFor(this.loc, this.save.day || 1); }

  enterTournament(id) {
    const def = this.tournaments().find((t) => t.id === id);
    if (!def || this.tour || this.save.cash < def.fee) return;
    this.commit({ cash: this.save.cash - def.fee });
    this.tour = new Tournament(def, this.loc);
    this.tour.key = def.id + '@' + (this.save.day || 1) + '@' + this.loc.id;   // ties the event's best fish to its result (trophy candidates)
    this.tourRefresh = 0;
    this.audio.play('strike');
    this.ui.toast(`${def.name}: ${def.minutes} minutes on the clock.`, 'good');
    this.ui.leaderboard(this.tour);
    this.ui.hud();
  }

  tourTick(minutes) {
    const t = this.tour;
    if (!t) return;
    t.tick(minutes);
    this.tourRefresh = (this.tourRefresh || 0) + minutes;
    if (this.tourRefresh >= 1) { this.tourRefresh = 0; this.ui.leaderboard(t); }
    // finish once the clock is out, but never on top of an open catch or haul card
    if (!t.done || this.fishing.state === 'caught' || this.ui.panel === 'haul' || this.ui.panel === 'catch') return;
    const r = t.result();
    this.save = settleTournament(this.save, t.key, r.place);
    const trophies = [...(this.save.trophies || []), { name: t.def.name, loc: this.loc.id, place: r.place, day: this.save.day || 1 }];
    this.commit({ cash: this.save.cash + r.prize, trophies, stats: { ...this.save.stats, earned: this.save.stats.earned + r.prize } });
    if (r.prize) this.audio.play('landed');
    this.tourResult = { def: t.def, ...r, xp: tournamentXp(r.place) };
    this.addXp(this.tourResult.xp);
    this.tour = null;
    this.ui.leaderboard(null);
    this.ui.forceClose();
    this.ui.open('tourResult');
  }

  // fish on the trolling spread: fight it on the boat's tackle, from the cockpit
  // dev hook (tests): land a fish straight onto the catch card, e.g. game.devLand('pike', 12.5), then game.finishCatch('release')
  devLand(id, lb, morphId = 'normal') {
    const sp = SPECIES_BY_ID[id], morph = MORPHS.find((m) => m.id === morphId);
    if (!sp || !morph) return false;
    this.onCatch({ sp, morph, lb: lb || sp.lb[1], how: { lure: this.save.equip.lure, depth: 1, hour: this.save.hour } }, () => {});
    return true;
  }

  // dev hook (tests, screenshots): hook a species right now, e.g. game.devFight('largemouth', 6)
  devFight(id, lb) {
    const f = this.fishing, sp = SPECIES_BY_ID[id];
    if (!sp) return false;
    if (f.busy()) f.reset();
    this.holstered = false;
    this.view = 'first';
    const fwd = this.angler.getWorldDirection(new THREE.Vector3()).setY(0).normalize(), tip = this.rod.tip;
    f.lure.set(tip.x + fwd.x * 14, this.water[1] ?? 0, tip.z + fwd.z * 14);
    f.lineOut = 15; f.depth = 1.5; f.state = 'water';
    f.bite = { sp, morph: rollMorph(() => 1), lb: lb || sp.lb[1] };
    f.hook();
    return true;
  }

  startTrollFight(p, lure) {
    const f = this.fishing;
    this.view = 'first';
    f.gearOverride = TROLL_GEAR;
    f.drag = null;
    const g = f.gear;
    this.rod.setGear(g.rod, g.line, g.lure);
    f.lure.copy(lure);
    f.depth = 0.3;
    f.bite = { sp: p.sp, morph: p.morph, lb: p.lb };
    f.hook();
    this.ui.toast('Rod in hand. Throttle back and work it.', 'good');
  }

  ensureChallenges() {
    const c = this.save.challenges, day = this.save.day || 1;
    if (!c || c.loc !== this.loc.id || c.day !== day) this.commit({ challenges: makeChallenges(this.loc, day) });
    this.ui.challenges(this.save.challenges);
  }

  // a net haul: journal entries now, then a panel to decide what goes in the hold
  onHaul(rows, morphs) {
    let save = this.save;
    for (const r of rows) save = logCatch(save, r.sp.id, 'normal', r.sp.lb[1]).save;
    for (const m of morphs) save = logCatch(save, m.sp.id, m.morph.id, m.sp.lb[1]).save;
    this.save = save;
    const cap = holdCap(BOATS[save.boat], save, save.boat), room = Math.max(0, cap - holdLb(save.hold));
    this.ui.showHaul(rows.map((r) => ({ ...r, id: r.sp.id, keep: true })), morphs, { cap, room });
  }

  // put the planned stacks in the hold; rows left out or over capacity go back over the side
  stowHaul(rows, room) {
    const plan = planHaul(rows, room);
    const stacks = [];
    let kept = 0, value = 0, left = 0;
    rows.forEach((r, i) => {
      const t = plan[i];
      if (t.lb > 0) { stacks.push({ sp: r.sp.id, lb: t.lb, count: t.count }); kept += t.lb; value += r.value * (t.lb / r.lb); }
      left += r.lb - t.lb;
    });
    if (stacks.length) {
      this.commit({ hold: stowStacks(this.save.hold, stacks) });
      this.addXp(Math.min(80, Math.round(Math.sqrt(value) / 3)));   // net hauls: small, capped XP, on what you keep
      this.audio.play('livewell');
    }
    this.ui.toast(stacks.length
      ? `${Math.round(kept).toLocaleString()} lb in the hold${left > 1 ? `, ${Math.round(left).toLocaleString()} lb back over the side` : ''}.`
      : 'All of it back over the side.', stacks.length ? 'good' : 'info');
    this.ui.hud();
    return { kept, left };
  }

  // sell hold stacks at the market: ids = species ids or 'all'; returns the total
  sellHold(ids) {
    const access = this.marketAccess();
    if (!access) { this.ui.toast(`No buyer here. Bring the hold to a dock. ${this.nearestDockText()}`, 'info'); return 0; }
    let save = this.save, total = 0, lb = 0;
    const sold = [];
    for (const s of save.hold || []) {
      if (ids !== 'all' && !ids.includes(s.sp)) continue;
      total += holdValue(this.market, save, s, access === 'buyer');
      lb += s.lb;
      sold.push(s.sp);
      save = { ...save, market: this.market.recordSale(save, s.sp, holdUnits(s)) };
    }
    if (!sold.length) return 0;
    save = { ...save, hold: save.hold.filter((s) => !sold.includes(s.sp)), cash: save.cash + total, stats: { ...save.stats, earned: save.stats.earned + total } };
    this.save = save;
    writeSave(save);
    this.audio.play('cash');
    this.ui.toast(`Sold ${Math.round(lb).toLocaleString()} lb from the hold for $${Math.round(total).toLocaleString()}`, 'good');
    this.ui.hud();
    return total;
  }

  discardHold(sp) {
    const s = (this.save.hold || []).find((x) => x.sp === sp);
    if (!s) return;
    this.commit({ hold: this.save.hold.filter((x) => x !== s) });
    this.ui.toast(`Tipped the ${SPECIES_BY_ID[sp].name.toLowerCase()} over the side.`, 'info');
    this.ui.hud();
  }

  // dev hook (tests): game.devHaul(lb) forces a haul on the current net boat
  devHaul(lb = 3000) {
    if (!this.net.type) return false;
    this.net.lbs = {}; this.net.total = 0;
    this.net.addCatch(lb);
    this.net.finish();
    return true;
  }

  // one toast when a permit runs out or is about to
  permitWatch() {
    const left = permitLeft(this.save, this.loc.id), had = this.permitHad;
    if (had !== undefined) {
      if (had > 0 && left <= 0) this.ui.toast(`Your permit for ${this.loc.name} has expired.`, 'bad');
      else if (had > 2 && left <= 2 && left > 0) this.ui.toast('Fishing permit runs out in about two hours.', 'info');
    }
    this.permitHad = left;
  }

  // ---------------------------------------------------------------- progression
  // add XP; announces level-ups and what they open
  addXp(n) {
    if (!n) return;
    const before = levelOf(this.save.xp || 0);
    this.save = { ...this.save, xp: (this.save.xp || 0) + n };
    const after = levelOf(this.save.xp);
    this.ui.xpGain(n);
    if (after > before) {
      this.audio.play('cash');
      for (let L = before + 1; L <= after; L++) this.ui.levelUp(L, unlocksAt(L));
    }
    this.ui.hud();
  }

  // wear is small and frequent: updated in place, saved with the next autosave
  wearAdd(kind, amt) {
    const w = this.save.wear || WEAR_DEFAULT, was = w[kind];
    const now = Math.min(1, was + amt);
    this.save = { ...this.save, wear: { ...w, [kind]: now } };
    const cross = (x) => was < x && now >= x;
    if (kind === 'line') {
      if (cross(0.5)) this.ui.toast('Line is getting worn. A fresh spool is cheap (B).', 'info');
      if (cross(0.8)) this.ui.toast('Line badly frayed - it will break well below its rating. Respool soon.', 'bad');
    } else if (cross(0.6)) this.ui.toast('Your hook is dull: more fish will come off. Sharpen it at the tackle shop (B).', 'info');
  }

  lureLost(lure) {
    const id = Object.keys(LURES).find((k) => LURES[k] === lure);
    if (!id) return;
    const w = this.save.wear;
    this.save = { ...this.save, wear: { ...w, lost: [...new Set([...w.lost, id])] } };
    this.ui.toast(`Snagged and broke off. Lost the ${lure.name.toLowerCase()}. A nightcrawler is on now.`, 'bad');
    this.equip('lure', 'nightcrawler');
  }

  // shop service: 'line' respool, 'hook' sharpen, or a lure id to restock
  service(what) {
    const s = this.save, w = s.wear;
    let cost = 0, msg = '';
    if (what === 'line') { cost = respoolCost(LINES[s.equip.line]); msg = `Respooled with fresh ${LINES[s.equip.line].name}`; }
    else if (what === 'hook') { cost = SHARPEN_COST; msg = 'Hooks sharpened'; }
    else if (LURES[what] && w.lost.includes(what)) { cost = restockCost(LURES[what]); msg = `Restocked ${LURES[what].name}`; }
    else return;
    cost = this.keepers.price(cost);
    if (s.cash < cost) { this.ui.toast('Not enough cash.', 'info'); return; }
    if (this.fishing.busy() && what !== 'hook') { this.ui.toast('Reel in first.', 'info'); return; }
    const wear = what === 'line' ? { ...w, line: 0 } : what === 'hook' ? { ...w, hook: 0 } : { ...w, lost: w.lost.filter((x) => x !== what) };
    this.commit({ cash: s.cash - cost, wear });
    this.fishing.drag = null;
    this.audio.play('cash');
    this.ui.toast(`${msg} ($${cost})`, 'good');
    this.ui.hud();
  }

  buyPermit(optId) {
    const opt = PERMIT_OPTIONS.find((o) => o.id === optId);
    if (!opt) return;
    const price = this.keepers.price(permitPrice(this.loc, opt));
    if (this.save.cash < price) { this.ui.toast('Not enough cash.', 'info'); return; }
    // extending a running permit adds to it
    const start = Math.max(absHours(this.save), this.save.permits[this.loc.id]?.until || 0);
    this.commit({ cash: this.save.cash - price, permits: { ...this.save.permits, [this.loc.id]: { until: start + opt.days * 24 } } });
    this.audio.play('cash');
    this.ui.toast(`Permit for ${this.loc.name}: ${opt.label} ($${price})`, 'good');
    this.permitHad = permitLeft(this.save, this.loc.id);
    this.ui.hud();
  }

  buy(kind, id) {
    const it = TABLES[kind][id];
    if (!it || this.save[kind].includes(id) || this.save.cash < it.price) return;
    if (kind !== 'lures' && !meets(this.save, kind, id)) { this.ui.toast(`Needs angler level ${gateLevel(kind, id)}.`, 'info'); return; }
    this.commit({ cash: this.save.cash - it.price, [kind]: [...this.save[kind], id] });
    this.equip(KIND_OF[kind], id);
    this.audio.play('cash');
    this.ui.toast(`Bought ${it.name}`, 'good');
  }

  equip(kind, id) {
    if (kind === 'lure' && this.save.wear.lost.includes(id)) { this.ui.toast(`Out of ${LURES[id].name.toLowerCase()} - restock at the tackle shop (B).`, 'info'); return; }
    if (this.fishing.busy() && kind !== 'lure') { this.ui.toast('Reel in first.', 'info'); return; }
    this.commit({ equip: { ...this.save.equip, [kind]: id } });
    if (kind === 'reel' || kind === 'line') this.fishing.drag = null;
    this.applyGear();
    this.ui.hud();
  }

  buyBoat(id) {
    const b = BOATS[id];
    if (this.save.boats.includes(id) || this.save.cash < b.price) return;
    if (!meets(this.save, 'boats', id)) { this.ui.toast(`Needs angler level ${gateLevel('boats', id)}.`, 'info'); return; }
    this.commit({ cash: this.save.cash - b.price, boats: [...this.save.boats, id] });
    this.audio.play('cash');
    this.ui.toast(`Bought the ${b.name}.`, 'good');
    if (b.waters.includes(this.loc.water)) this.switchBoat(id);
  }

  async switchBoat(id) {
    if (this.fishing.busy()) { this.ui.toast('Reel in first.', 'info'); return; }
    if (this.net.state !== 'stowed') { this.ui.toast('Haul the net first.', 'info'); return; }
    const p = this.boat.position.clone(), yaw = this.boat.heading();
    this.boat.dispose(this.e.floaters);
    this.commit({ boat: id });
    this.boat = await new PlayerBoat(id).create(this.e.floaters, this.patchProp, p, yaw, this.boatCust(id));
    this.look.yaw = BOATS[id].face || 0;
    this.foot = null; this.moor = null;
    this.ui.toast(`Now running the ${BOATS[id].name}`, 'good');
    this.ui.hud();
  }

  unlock(id) {
    const l = LOCATIONS[id];
    if (this.save.unlocked.includes(id) || this.save.cash < l.price) return;
    if (!meets(this.save, 'locs', id)) { this.ui.toast(`Needs angler level ${gateLevel('locs', id)}.`, 'info'); return; }
    this.commit({ cash: this.save.cash - l.price, unlocked: [...this.save.unlocked, id] });
    this.audio.play('cash');
    this.ui.toast(`${l.name} is open. You will need a permit there.`, 'good');
  }

  travel(id) {
    if (this.dev.engaged) { location.href = this.dev.href({ loc: id }); return; }   // a developer session never touches the save
    const l = LOCATIONS[id];
    const boat = this.save.boats.includes(this.save.boat) && BOATS[this.save.boat].waters.includes(l.water) ? this.save.boat : this.save.boats.find((b) => BOATS[b].waters.includes(l.water));
    this.commit({ location: id, boat: boat || this.save.boat, hour: Math.max(6, Math.min(this.save.hour, 15)) });
    location.href = location.pathname;
  }
}

let game = null;
export function createGame(engine) {
  game = new Game(engine);
  return game;
}

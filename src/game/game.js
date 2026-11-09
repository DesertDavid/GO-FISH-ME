import * as THREE from 'three';
import { LOC } from './current.js';
import { findStart, LOCATIONS } from './locations.js';
import { loadSave, writeSave, logCatch, resetSave } from './save.js';
import { loadSettings, saveSettings } from './settings.js';
import { RODS, REELS, LINES, LURES, BOATS } from './gear.js';
import { PlayerBoat } from './boats.js';
import { Rod } from './rod.js';
import { Fishing } from './fishing.js';
import { NetFishing } from './net.js';
import { buildScenery, Hotspots } from './scenery.js';
import { AmbientFish } from './ambient.js';
import { Wildlife } from './wildlife.js';
import { AIBoats } from './aiBoats.js';
import { Trolling, TROLL_GEAR } from './troll.js';
import { Tournament, tournamentsFor } from './tournaments.js';
import { Sonar } from './sonar.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';
import { fishLengthM } from './fishMesh.js';
import { makeChallenges, recordCatch } from './challenges.js';
import { Weather } from './weather.js';

const TABLES = { rods: RODS, reels: REELS, lines: LINES, lures: LURES };
const KIND_OF = { rods: 'rod', reels: 'reel', lines: 'line', lures: 'lure' };
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

// Owns gameplay: player boat, camera, rod fishing, nets, time of day, menus, saving.
export class Game {
  constructor(engine) {
    this.e = engine;
    this.loc = LOC;
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
    this.look = { yaw: 0, pitch: -0.06, dist: 0 };
    this.keys = new Set();
    this.mouse = { down: false, pressed: false, right: false, x: 0, y: 0 };
    this.water = [0, 0, 0];
    this.time = 0;
    this.sunTimer = 0;
  }

  async init(progress) {
    const e = this.e;
    this.ui = new UI(this);
    this.settings = loadSettings();
    this.audio = new GameAudio();
    progress(0.75, 'Planting trees…');
    this.scene.add(buildScenery(this.loc, this.heightAt, this.patchProp));
    this.start = findStart(this.loc);
    this.hotspots = new Hotspots(this.loc, this.heightAt, this.start, this.patchProp);
    this.scene.add(this.hotspots.group);
    progress(0.85, 'Launching the boat…');
    let boatId = this.save.boat;
    if (!BOATS[boatId].waters.includes(this.loc.water)) boatId = this.save.boats.find((b) => BOATS[b].waters.includes(this.loc.water)) || 'jon';
    this.save = { ...this.save, boat: boatId };
    this.boat = await new PlayerBoat(boatId).create(e.floaters, this.patchProp, this.start, this.start.yaw || 0);
    this.look.yaw = BOATS[boatId].face || 0;
    this.rod = new Rod(this.overlay, this.scene);
    this.fishing = new Fishing(this.ctx());
    this.net = new NetFishing(this.ctx());
    this.ambient = new AmbientFish(this.ctx());
    this.wildlife = new Wildlife(this.ctx());
    this.troll = new Trolling(this.ctx());
    this.aiBoats = new AIBoats(this.ctx(), e.floaters, this.patchProp, this.start);
    progress(0.92, 'Other anglers heading out…');
    await this.aiBoats.spawn(this.loc.water === 'offshore' ? 2 : 3);
    this.sonar = new Sonar(document.getElementById('sonar'));
    this.applyGear();
    this.bindInput();
    this.applySettings();
    this.applySun(true);
    this.weather = new Weather(this.e, this.loc, this.save.weather, this.ui, this.audio);
    writeSave(this.save);
    progress(1, 'Ready');
    this.ui.ready();
    this.ui.lookHint(this.settings.mouseLock);
    if (!this.save.seenHelp) { this.ui.open('help'); this.commit({ seenHelp: true }); }
    this.ensureChallenges();
    this.ui.toast(`Welcome to ${this.loc.name}`, 'good');
  }

  // shared context handed to the fishing/net systems
  ctx() {
    return {
      camera: this.camera, angler: this.angler, scene: this.scene, overlay: this.overlay, patchProp: this.patchProp, loc: this.loc,
      get save() { return game.save; },
      rod: this.rod, ui: this.ui, audio: this.audio, hotspots: this.hotspots,
      heightAt: this.heightAt,
      waterAt: (i) => this.water[1 + i] ?? 0,
      waterHeightApprox: () => this.water[0] ?? 0,
      splash: (x, z, amp, size) => this.splash(x, z, amp, size),
      canFish: () => this.canFish(),
      hour: () => this.save.hour,
      weatherBite: () => this.weather?.bite ?? 1,
      fishingBusy: () => this.fishing.busy(),
      startTrollFight: (p, lure) => this.startTrollFight(p, lure),
      boatSpeed: () => this.boatSpeed(),
      boatSpec: () => BOATS[this.save.boat],
      boatLength: () => this.boat.hull.length,
      get boat() { return game.boat; },
      onCatch: (f, done) => this.onCatch(f, done),
      onHaul: (rows, morphs) => this.onHaul(rows, morphs),
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
      if (ev.repeat) return;
      const k = ev.key.toLowerCase();
      // Esc / Tab: close whatever is open, otherwise open the pause menu
      if (k === 'escape' || k === 'tab') {
        ev.preventDefault();
        if (this.ui.isOpen()) this.ui.close();
        else this.ui.open('pause');
        this.keys.clear();
        return;
      }
      if (this.ui.isOpen()) return;
      this.keys.add(k);
      const open = { t: 'tackle', b: 'shop', y: 'marina', m: 'map', j: 'journal', h: 'help', o: 'settings', e: 'events' }[k];
      if (open) { this.ui.open(open); this.keys.clear(); return; }
      if (k === 'v') { this.view = this.view === 'first' ? 'third' : 'first'; this.look.yaw = this.view === 'third' ? 0 : this.boatSpec().face || 0; }
      if (k === 'n') this.net.toggle();
      if (k === 'r') this.troll.toggle();
      if (k === 'u') this.toggleUnderwater();
      if (k === 'p') this.togglePhoto();
      if (k === 'k') { this.commit({ hour: this.save.hour + 1 }); this.applySun(true); this.tourTick(60); this.ui.toast('An hour passes…', 'info'); }
      if (k === '[' || k === ']') this.dragNudge(k === ']' ? 1 : -1);
      if (/^[1-9]$/.test(k) && !this.fishing.busy()) {
        const id = this.save.lures[+k - 1];
        if (id) { this.equip('lure', id); this.ui.toast(`Tied on: ${LURES[id].name}`, 'info'); }
      }
    });
    addEventListener('keyup', (ev) => this.keys.delete(ev.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    // no browser right-click menu anywhere in the game (releasing a right-drag over a panel
    // used to pop it up)
    addEventListener('contextmenu', (ev) => ev.preventDefault());
    // Mouse look: click the view once to lock the pointer, then the mouse looks around with no
    // button held (left button still casts/reels). Esc or opening a menu frees it.
    // Right-drag still works as a fallback when the lock is off.
    const locked = () => document.pointerLockElement === el;
    // if the browser refuses the lock (some embedded views do), stop asking so clicks cast
    // normally, and fall back to right-drag
    const lockRefused = () => {
      if (this.lockFailed) return;
      this.lockFailed = true;
      this.ui.lookHint(false);
      this.ui.toast('Mouse lock isn\'t available in this browser - right-drag to look around.', 'info');
    };
    const lockPointer = () => {
      if (!this.settings.mouseLock || this.lockFailed || locked() || this.ui.isOpen()) return false;
      try {
        const p = el.requestPointerLock({ unadjustedMovement: true });
        // older browsers don't support unadjustedMovement: retry plain, then give up
        if (p && p.catch) p.catch(() => Promise.resolve(el.requestPointerLock()).catch(lockRefused));
      } catch {
        lockRefused();
        return false;
      }
      return true;
    };
    document.addEventListener('pointerlockerror', lockRefused);
    document.addEventListener('pointerlockchange', () => {
      this.mouse.down = false;
      this.ui.lookHint(this.settings.mouseLock && !this.lockFailed && !locked());
    });
    el.addEventListener('pointerdown', (ev) => {
      this.audio.start();
      if (ev.button === 0) {
        // the first click only grabs the mouse; it doesn't cast
        if (!locked() && lockPointer()) return;
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
      const k = 0.0035 * this.settings.lookSpeed;
      this.look.yaw -= dx * k;
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * k * (this.settings.invertY ? -1 : 1), -1.2, 1.1);
    };
    addEventListener('pointermove', (ev) => {
      if (locked()) look(ev.movementX, ev.movementY);
      else if (this.mouse.right) look(ev.clientX - this.mouse.x, ev.clientY - this.mouse.y);
      this.mouse.x = ev.clientX; this.mouse.y = ev.clientY;
    });
    this.freePointer = () => { if (locked()) document.exitPointerLock(); };
    el.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      if (this.view === 'third') this.look.dist = THREE.MathUtils.clamp(this.look.dist + Math.sign(ev.deltaY) * 3, -10, 60);
      else this.dragNudge(-Math.sign(ev.deltaY));
    }, { passive: false });
  }

  applySettings(patch = {}) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.audio.setVolume(this.settings.volume);
    this.e.setQuality({ resolution: this.settings.resolution, reflections: this.settings.reflections });
    if ('mouseLock' in patch) {
      if (!this.settings.mouseLock) this.freePointer?.();
      this.ui.lookHint(this.settings.mouseLock && document.pointerLockElement !== this.e.renderer.domElement);
    }
  }

  resetProgress() {
    resetSave();
    location.href = location.pathname;
  }

  dragNudge(dir) {
    this.fishing.adjustDrag(dir);
    if (this.fishing.state !== 'fight') this.ui.toast(`Drag set to ${this.fishing.dragSetting().toFixed(1)} lb (line breaks at ${LINES[this.save.equip.line].test} lb)`, 'info');
  }

  canFish() {
    if (this.ui.isOpen() || this.view !== 'first') return false;
    if (this.net.state !== 'stowed') { this.ui.toast('Haul the net in before casting.', 'info'); return false; }
    if (this.troll.active) { this.ui.toast('Clear the trolling spread first (R).', 'info'); return false; }
    if (Math.abs(this.boatSpeed()) > 6) { this.ui.toast('Slow down to cast.', 'info'); return false; }
    return true;
  }

  // ---------------------------------------------------------------- loop
  update(dt) {
    this.time += dt;
    const fighting = this.fishing.state === 'fight';
    const k = (key) => this.keys.has(key);
    // boat controls (A/D steer the rod during a fight)
    const c = this.boat.control;
    const throttleTarget = (k('w') ? 1 : 0) - (k('s') ? 1 : 0);
    c.throttle += (throttleTarget - c.throttle) * Math.min(1, dt * 3);
    c.steer = fighting ? 0 : (k('d') ? 1 : 0) - (k('a') ? 1 : 0);
    if (k('arrowleft')) this.look.yaw += dt * 1.6;
    if (k('arrowright')) this.look.yaw -= dt * 1.6;
    if (k('arrowup')) this.look.pitch = Math.min(1.1, this.look.pitch + dt * 1.2);
    if (k('arrowdown')) this.look.pitch = Math.max(-1.2, this.look.pitch - dt * 1.2);
    this.boat.update(dt, this.e.floaters, this.loc.current);
    this.audio.engine(c.throttle, this.boatSpeed());
    this.updateCamera(dt);

    // the underwater camera hands back to the angler when there's nothing left to watch
    if (this.view === 'under' && !['water', 'bite', 'fight'].includes(this.fishing.state)) { this.view = 'first'; this.look.yaw = this.boatSpec().face || 0; this.look.pitch = -0.06; }
    const canAct = this.view === 'first' || this.view === 'under';
    const input = {
      down: this.mouse.down && !this.ui.isOpen() && canAct,
      pressed: this.mouse.pressed && !this.ui.isOpen() && canAct,
      steer: fighting ? (k('d') ? 1 : 0) - (k('a') ? 1 : 0) : 0,
    };
    this.mouse.pressed = false;
    // a screaming trolling rod: the click grabs it instead of casting
    if (this.troll.pending && input.pressed) { this.troll.take(); input.pressed = false; }
    this.fishing.update(dt, input);
    this.troll.update(dt);
    this.rod.setVisible(this.view === 'first' && this.fishing.state !== 'caught' && !this.photo);
    this.ui.power(this.fishing.state === 'charging' ? this.fishing.power : null);
    this.net.update(dt);
    const bp = this.boat.position;
    this.hotspots.update(dt, this.time, this.e.floaters, bp);
    this.ambient.update(dt, bp);
    this.wildlife.update(dt, bp);
    this.aiBoats.update(dt, bp);
    this.audio.update(dt, REELS[this.save.equip.reel].ratio);

    // clock: one real second = one game minute; nights are skipped
    this.weather.update(dt, dt / 60, this.camera);
    this.tourTick(dt);
    this.save.weather = this.weather.id;
    let hour = this.save.hour + dt / 60;
    if (hour >= 21) {
      hour = 5.5;
      this.save.day = (this.save.day || 1) + 1;
      this.ensureChallenges();
      this.ui.toast('A new day dawns - new challenges posted.', 'good');
      this.sunTimer = 99;
    }
    this.save.hour = hour;
    this.sunTimer += dt;
    if (this.sunTimer > 15) this.applySun(false);
    if (Math.floor(this.time) !== Math.floor(this.time - dt)) {
      this.ui.hud();
      if (Math.floor(this.time) % 10 === 0) writeSave(this.save);
    }
    const depth = this.depthUnderBoat();
    this.sonar.update(dt, depth, this.ambient.near(bp.x, bp.z, 14), this.hotspots.near(bp.x, bp.z, 60));
  }

  updateCamera(dt) {
    const cam = this.camera, b = this.boat.body;
    const heading = this.boat.heading();
    // The angler's eye is tracked every frame whatever the camera does: the rod (and so the
    // line and the hooked fish) hang off it, never off an orbiting or underwater camera.
    if (this.view === 'first') this.anglerLook = { yaw: this.look.yaw, pitch: this.look.pitch };
    const al = this.anglerLook || { yaw: this.boatSpec().face || 0, pitch: -0.06 };
    const A = this.angler;
    this.boat.eyeWorld(A.position);
    // half of the boat's roll/pitch reaches the eye
    // world-space tilt = boat rotation with its heading taken out
    _q.setFromAxisAngle(UP, heading);
    const tilt = _q2.copy(b.quat).multiply(_q.invert());
    tilt.slerp(new THREE.Quaternion(), 0.55);
    _e.set(al.pitch, heading - Math.PI / 2 + al.yaw, 0, 'YXZ');
    A.quaternion.setFromEuler(_e).premultiply(tilt);
    // green water over the deck: keep the eye above the wave crest rolling past
    A.position.y = Math.max(A.position.y, (this.water[0] || 0) + 0.7);
    A.updateMatrixWorld();
    if (this.view === 'first') {
      cam.position.copy(A.position);
      cam.quaternion.copy(A.quaternion);
    } else if (this.view === 'under') {
      this.underwaterCamera(dt);
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
    cam.updateMatrixWorld();
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
    if (this.view === 'under') { this.view = 'first'; this.look.yaw = this.boatSpec().face || 0; return; }
    if (s !== 'water' && s !== 'bite' && s !== 'fight') { this.ui.toast('Cast first - the underwater camera follows your lure or fish.', 'info'); return; }
    this.view = 'under';
    this.underInit = false;
    this.look.yaw = 0;
    this.look.pitch = 0;
  }

  applySun(force) {
    this.sunTimer = 0;
    const h = this.save.hour;
    const el = Math.max(0.6, 64 * Math.sin((Math.PI * (h - 5.6)) / 14.6));
    const az = 95 + ((h - 6) / 14) * 170;
    this.e.setSun(el, az);
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
  }

  boatSpeed() { return this.boat?.speed || 0; }
  boatSpec() { return BOATS[this.save.boat]; }
  hour() { return this.save.hour; }
  depthUnderBoat() { const p = this.boat.position; return Math.max(0, -this.heightAt(p.x, p.z)); }

  // ---------------------------------------------------------------- catches & economy
  onCatch(f, done) {
    const value = Math.max(1, f.lb * f.sp.price * f.morph.value);
    const res = logCatch(this.save, f.sp.id, f.morph.id, f.lb);
    this.pendingCatch = { f, done, value, res };
    const { inches } = fishLengthM(f.sp, f.lb);
    this.ui.showCatch({ sp: f.sp, morph: f.morph, lb: f.lb, inches, value, isNewSpecies: res.isNewSpecies, isNewMorph: res.isNewMorph, isRecord: res.isRecord });
  }

  finishCatch(sell) {
    const p = this.pendingCatch;
    if (!p) return;
    const stats = { ...p.res.save.stats, caught: p.res.save.stats.caught + 1 };
    if (!stats.heaviest || p.f.lb > stats.heaviest.lb) stats.heaviest = { sp: p.f.sp.id, lb: p.f.lb };
    let cash = p.res.save.cash;
    if (sell) { cash += p.value; stats.earned += p.value; this.audio.play('cash'); }
    else {
      stats.released += 1;
      this.fishing.luckUntil = performance.now() + 180000;
      this.ui.toast('Released! Rare-variant luck boosted for 3 minutes.', 'good');
      this.splash(this.boat.position.x, this.boat.position.z, 0.05, 0.5);
    }
    this.save = { ...p.res.save, cash, stats };
    // daily challenges
    const ch = recordCatch(this.save.challenges, p.f.sp, p.f.morph, p.f.lb);
    let bonus = 0;
    for (const c of ch.completed) {
      bonus += c.reward;
      this.ui.toast(`Challenge complete: ${c.text}  +$${c.reward.toLocaleString()}`, 'good');
    }
    this.save = { ...this.save, challenges: ch.state, cash: this.save.cash + bonus, stats: { ...this.save.stats, earned: this.save.stats.earned + bonus } };
    if (bonus) this.audio.play('cash');
    this.ui.challenges(this.save.challenges);
    // tournament weigh-in (kept or released, it's weighed at the boat)
    if (this.tour && !this.tour.done && this.tour.record(p.f.sp, p.f.lb)) {
      this.ui.toast(`Weighed in: ${p.f.lb.toFixed(2)} lb for the ${this.tour.def.name}`, 'good');
      this.ui.leaderboard(this.tour);
    }
    writeSave(this.save);
    p.done();
    this.pendingCatch = null;
    this.ui.hud();
  }

  // ---------------------------------------------------------------- tournaments
  tournaments() { return tournamentsFor(this.loc, this.save.day || 1); }

  enterTournament(id) {
    const def = this.tournaments().find((t) => t.id === id);
    if (!def || this.tour || this.save.cash < def.fee) return;
    this.commit({ cash: this.save.cash - def.fee });
    this.tour = new Tournament(def, this.loc);
    this.tourRefresh = 0;
    this.audio.play('strike');
    this.ui.toast(`${def.name} is under way - ${def.minutes} minutes on the clock!`, 'good');
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
    const trophies = [...(this.save.trophies || []), { name: t.def.name, loc: this.loc.id, place: r.place, day: this.save.day || 1 }];
    this.commit({ cash: this.save.cash + r.prize, trophies, stats: { ...this.save.stats, earned: this.save.stats.earned + r.prize } });
    if (r.prize) this.audio.play('landed');
    this.tourResult = { def: t.def, ...r };
    this.tour = null;
    this.ui.leaderboard(null);
    this.ui.forceClose();
    this.ui.open('tourResult');
  }

  // fish on the trolling spread: fight it on the boat's tackle, from the cockpit
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
    this.ui.toast('Rod in hand - pull the throttle back and fight it!', 'good');
  }

  ensureChallenges() {
    const c = this.save.challenges, day = this.save.day || 1;
    if (!c || c.loc !== this.loc.id || c.day !== day) this.commit({ challenges: makeChallenges(this.loc, day) });
    this.ui.challenges(this.save.challenges);
  }

  onHaul(rows, morphs) {
    let save = this.save;
    for (const r of rows) save = logCatch(save, r.sp.id, 'normal', r.sp.lb[1]).save;
    for (const m of morphs) save = logCatch(save, m.sp.id, m.morph.id, m.sp.lb[1]).save;
    this.save = save;
    const total = rows.reduce((a, r) => a + r.value, 0);
    this.ui.showHaul(rows, morphs, total);
  }

  sellHaul(h) {
    this.commit({ cash: this.save.cash + h.total, stats: { ...this.save.stats, earned: this.save.stats.earned + h.total } });
    this.audio.play('cash');
    this.ui.toast(`Sold the haul for $${Math.round(h.total).toLocaleString()}`, 'good');
    this.ui.hud();
  }

  buy(kind, id) {
    const it = TABLES[kind][id];
    if (!it || this.save[kind].includes(id) || this.save.cash < it.price) return;
    this.commit({ cash: this.save.cash - it.price, [kind]: [...this.save[kind], id] });
    this.equip(KIND_OF[kind], id);
    this.audio.play('cash');
    this.ui.toast(`Bought ${it.name}`, 'good');
  }

  equip(kind, id) {
    if (this.fishing.busy() && kind !== 'lure') { this.ui.toast('Reel in first.', 'info'); return; }
    this.commit({ equip: { ...this.save.equip, [kind]: id } });
    if (kind === 'reel' || kind === 'line') this.fishing.drag = null;
    this.applyGear();
    this.ui.hud();
  }

  buyBoat(id) {
    const b = BOATS[id];
    if (this.save.boats.includes(id) || this.save.cash < b.price) return;
    this.commit({ cash: this.save.cash - b.price, boats: [...this.save.boats, id] });
    this.audio.play('cash');
    this.ui.toast(`You bought a ${b.name}!`, 'good');
    if (b.waters.includes(this.loc.water)) this.switchBoat(id);
  }

  async switchBoat(id) {
    if (this.fishing.busy()) { this.ui.toast('Reel in first.', 'info'); return; }
    if (this.net.state !== 'stowed') { this.ui.toast('Haul the net first.', 'info'); return; }
    const p = this.boat.position.clone(), yaw = this.boat.heading();
    this.boat.dispose(this.e.floaters);
    this.commit({ boat: id });
    this.boat = await new PlayerBoat(id).create(this.e.floaters, this.patchProp, p, yaw);
    this.look.yaw = BOATS[id].face || 0;
    this.ui.toast(`Now running the ${BOATS[id].name}`, 'good');
    this.ui.hud();
  }

  unlock(id) {
    const l = LOCATIONS[id];
    if (this.save.unlocked.includes(id) || this.save.cash < l.price) return;
    this.commit({ cash: this.save.cash - l.price, unlocked: [...this.save.unlocked, id] });
    this.audio.play('cash');
    this.ui.toast(`Fishing license: ${l.name}`, 'good');
  }

  travel(id) {
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

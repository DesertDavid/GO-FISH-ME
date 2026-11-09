import * as THREE from 'three';
import { SPECIES_BY_ID, rollMorph, rollWeight } from './species.js';
import { RODS, REELS, LINES, LURES } from './gear.js';
import { buildFish, fishLengthM } from './fishMesh.js';

// Rod-and-reel fishing: cast -> lure in the water -> nibbles -> strike window -> fight.
// The fight is a force balance: fish pull vs. drag setting vs. line strength, with stamina,
// runs, jumps, head shakes and slack.
const G = 9.81;
const DEPTH_INDEX = { s: 0, m: 1, b: 2 };
// species that feed mostly after dark: much more likely at night, a bit less by day
const NIGHT_FEEDERS = new Set(['channelcat', 'bluecat', 'flathead', 'walleye', 'sauger', 'burbot', 'redtail', 'piraiba', 'snook', 'tarpon', 'mangrovesnapper', 'swordfish', 'lemonshark', 'blacktip', 'nurseshark', 'tigershark', 'ling', 'wolffish', 'sablefish', 'pacifichalibut', 'barramundi', 'mangrovejack', 'trairao']);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _fwd = new THREE.Vector3();

export class Fishing {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'idle';
    this.power = 0;
    this.lure = new THREE.Vector3();
    this.lureVel = new THREE.Vector3();
    this.lineOut = 0;
    this.depth = 0;
    this.moving = false;
    this.fish = null;
    this.bite = null;
    this.drag = null;
    this.tension = 0;
    this.overload = 0;
    this.slackT = 0;
    this.side = 0;
    this.luck = 1;
    this.luckUntil = 0;
    this.entry = new THREE.Vector3();
  }

  // gearOverride: the boat's trolling tackle while fighting a fish off the spread
  get gear() {
    const e = this.gearOverride || this.ctx.save.equip;
    return { rod: RODS[e.rod], reel: REELS[e.reel], line: LINES[e.line], lure: LURES[e.lure] };
  }

  dragSetting() {
    const { reel, line } = this.gear;
    if (this.drag == null) this.drag = Math.min(reel.drag, line.test * 0.55);
    this.drag = THREE.MathUtils.clamp(this.drag, 0.5, reel.drag);
    return this.drag;
  }

  adjustDrag(delta) {
    const { reel } = this.gear;
    this.drag = THREE.MathUtils.clamp(this.dragSetting() + delta * Math.max(0.5, reel.drag / 30), 0.5, reel.drag);
  }

  busy() { return this.state !== 'idle'; }

  update(dt, input) {
    const c = this.ctx;
    switch (this.state) {
      case 'idle':
        if (input.pressed && c.canFish()) { this.state = 'charging'; this.power = 0; }
        break;
      case 'charging':
        this.power = Math.min(1, this.power + dt / 1.1);
        if (!input.down) this.cast();
        break;
      case 'flying': this.updateFlight(dt); break;
      case 'water': this.updateWater(dt, input); break;
      case 'bite': this.updateBite(dt, input); break;
      case 'fight': this.updateFight(dt, input); break;
      case 'caught': break;
      default: break;
    }
    this.updateVisuals(dt, input);
  }

  cast() {
    const c = this.ctx, { rod, lure } = this.gear;
    const fwd = c.angler.getWorldDirection(_fwd).setY(0).normalize();
    // even a quick tap lobs it a useful distance
    let dist = Math.max(8, rod.cast * (0.25 + 0.75 * this.power) * (lure.fly && !rod.fly ? 0.45 : 1) * (0.95 + Math.random() * 0.08));
    const start = c.rod.tip.clone();
    const aim = (Math.random() - 0.5) * 0.06 * this.power;
    fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), aim);
    const T = 0.55 + dist / 26;
    this.lure.copy(start);
    this.lureVel.set((fwd.x * dist) / T, (0 - start.y + 0.5 * G * T * T) / T, (fwd.z * dist) / T);
    this.state = 'flying';
    c.rod.castAnim = 1;
    c.audio.play('cast', this.power);
    this.lineOut = 0;
  }

  updateFlight(dt) {
    const c = this.ctx;
    this.lureVel.y -= G * dt;
    this.lure.addScaledVector(this.lureVel, dt);
    this.lineOut = c.rod.tip.distanceTo(this.lure);
    if (this.lure.y <= c.waterAt(0)) {
      const ground = c.heightAt(this.lure.x, this.lure.z);
      if (ground > -0.15) {
        c.ui.toast('Snagged on the bank! Line cut.', 'bad');
        c.audio.play('snap');
        this.reset();
        return;
      }
      this.lure.y = c.waterAt(0);
      this.depth = 0;
      this.state = 'water';
      this.lineOut = horiz(c.rod.tip, this.lure) + 1.5;
      this.biteClock = 0;
      c.splash(this.lure.x, this.lure.z, 0.05, 0.25);
      c.audio.play('plop');
    }
  }

  targetDepth() {
    const c = this.ctx, { lure } = this.gear;
    const bottom = Math.max(0.3, -c.heightAt(this.lure.x, this.lure.z));
    if (lure.depth === 's') return 0.04;
    if (lure.depth === 'b') return bottom - 0.15;
    return Math.min(bottom * 0.65, lure.bobber ? 1.8 : 2.6 + (this.moving ? 1.2 : 0));
  }

  updateWater(dt, input) {
    const c = this.ctx, { reel, lure, rod } = this.gear;
    const tip = c.rod.tip;
    const prev = _w.copy(this.lure);
    const reeling = input.down;
    if (reeling) {
      const v = reel.ratio * 0.36 * (1 + c.boatSpeed() * 0.02);
      _v.subVectors(tip, this.lure).setY(0).normalize();
      this.lure.addScaledVector(_v, v * dt);
      this.lineOut = Math.max(0, this.lineOut - v * dt);
      c.audio.reel(true);
    } else c.audio.reel(false);
    // line length holds the lure: boat moving away drags it (trolling)
    const d = horiz(tip, this.lure);
    if (d > this.lineOut) {
      _v.subVectors(tip, this.lure).setY(0).normalize();
      this.lure.addScaledVector(_v, d - this.lineOut);
    }
    const moved = horiz(prev, this.lure) / Math.max(dt, 1e-4);
    this.moving = moved > 0.25;
    this.depth += THREE.MathUtils.clamp(this.targetDepth() - this.depth, -1.2 * dt, 0.7 * dt);
    this.lure.y = c.waterAt(0) - (lure.bobber ? 0 : this.depth);
    const home = reeling && horiz(tip, this.lure) < 3;
    if (c.heightAt(this.lure.x, this.lure.z) > -0.05 || home) {
      if (home) c.ui.toast('Reeled in - click and hold to cast again', 'info');
      else c.ui.toast('Ran aground: lure back.', 'info');
      this.reset();
      return;
    }
    // bites
    this.biteClock += dt;
    if (this.biteClock < 1.2) return;
    const fish = this.rollBite(dt, rod, lure);
    if (fish) {
      this.bite = { ...fish, nibbles: 1 + Math.floor(Math.random() * 3), t: 0.5 + Math.random() * 0.7, phase: 'nibble' };
      this.state = 'bite';
    }
  }

  rollBite(dt, rod, lure) {
    const c = this.ctx;
    let activity = lure.active ? (this.moving ? 1 : 0.3) : (this.moving ? 0.5 : 1);
    if (lure.fly && rod.fly) activity *= 1.35;
    const hot = c.hotspots ? c.hotspots.near(this.lure.x, this.lure.z, 55) : 0;
    const hour = c.hour();
    // dawn and dusk are best; the dark hours are steady, with night feeders taking over
    const isNight = hour < 5.2 || hour > 20.6;
    const tod = isNight ? 0.95 : hour < 8.5 || hour > 17.5 ? 1.4 : hour > 11 && hour < 15 ? 0.85 : 1;
    const rate = 0.07 * activity * (1 + hot * 3.5) * tod * (c.weatherBite ? c.weatherBite() : 1);
    if (Math.random() > rate * dt) return null;
    const pool = c.loc.pool;
    const z = DEPTH_INDEX[lure.bobber ? 'm' : lure.depth];
    const entries = [];
    let sum = 0;
    for (const [id, w] of Object.entries(pool)) {
      const sp = SPECIES_BY_ID[id];
      if (!sp) continue;
      const dietOk = [...lure.diet].some((ch) => sp.diet.includes(ch)) ? 1 : 0.05;
      const dz = Math.abs(DEPTH_INDEX[sp.depth] - z);
      const nightW = isNight ? (NIGHT_FEEDERS.has(id) ? 3 : 0.45) : (NIGHT_FEEDERS.has(id) ? 0.7 : 1);
      const wt = w * dietOk * [1, 0.4, 0.12][dz] * nightW;
      entries.push([sp, wt]);
      sum += wt;
    }
    let r = Math.random() * sum;
    for (const [sp, wt] of entries) {
      r -= wt;
      if (r <= 0) {
        const big = (lure.size || 1) * ((['tuna', 'billfish', 'swordfish', 'shark'].includes(sp.body) ? c.boatSpec().bigGame || 1 : 1));
        const luck = this.luck * (performance.now() < this.luckUntil ? 1.6 : 1);
        return { sp, morph: rollMorph(Math.random, luck), lb: rollWeight(sp, Math.random, big) };
      }
    }
    return null;
  }

  updateBite(dt, input) {
    const c = this.ctx, b = this.bite, { rod, line } = this.gear;
    b.t -= dt;
    this.lure.y = c.waterAt(0) - (this.gear.lure.bobber ? 0 : this.depth);
    if (b.phase === 'nibble') {
      if (input.pressed) {
        if (Math.random() < 0.2) { c.ui.toast('Too early! You spooked it.', 'bad'); this.bite = null; this.state = 'water'; this.biteClock = 0; return; }
        c.ui.toast('Wait for it... strike when you see STRIKE!', 'info');
      }
      if (b.t <= 0) {
        c.rod.twitch = 0.35;
        c.audio.play('tick');
        c.splash(this.lure.x, this.lure.z, 0.03, 0.2);
        c.ui.toast('Nibble...', 'info');
        b.bob = 0.6;
        b.nibbles--;
        if (b.nibbles <= 0) {
          b.phase = 'strike';
          b.t = 1.0 + rod.sens * 0.6 + (line.braid ? 0.2 : 0);
          b.held = input.down;   // already holding when it hits: counts once you keep holding
          c.rod.twitch = 0.7;
          c.audio.play('strike');
          c.ui.strike(true);
          c.splash(this.lure.x, this.lure.z, 0.06, 0.35);
        } else b.t = 0.6 + Math.random() * 0.9;
      }
    } else {
      b.bob = 1;
      // click, or keep reeling into it (a moving lure often hooks the fish by itself)
      const reelSet = b.held && input.down && b.t < 1.0 + rod.sens * 0.6 - 0.25;
      if (input.pressed || reelSet) {
        c.ui.strike(false);
        if (Math.random() < 0.9 + (line.braid ? 0.07 : 0)) this.hook();
        else { c.ui.toast('Missed the hookset!', 'bad'); this.bite = null; this.state = 'water'; this.biteClock = 0; }
        return;
      }
      if (b.t <= 0) {
        c.ui.strike(false);
        c.ui.toast('It let go...', 'bad');
        this.bite = null;
        this.state = 'water';
        this.biteClock = 0;
      }
    }
  }

  hook() {
    const c = this.ctx, b = this.bite;
    const sp = b.sp, lb = b.lb;
    const { m } = fishLengthM(sp, lb);
    const model = buildFish(sp, b.morph, { patchProp: c.patchProp });
    model.group.scale.setScalar(m);
    c.scene.add(model.group);
    const tip = c.rod.tip;
    this.fish = {
      sp, morph: b.morph, lb, len: m, model, stamina: 1,
      r: horiz(tip, this.lure), theta: Math.atan2(this.lure.z - tip.z, this.lure.x - tip.x),
      depth: Math.max(0.6, this.depth), behavior: 'run', bT: 1.5, dir: 1, power: 1, jumpT: -1, jumps: 0, thrown: false,
      pos: this.lure.clone(), heading: 0, shake: 0, time: 0,
    };
    this.lineOut = this.fish.r + 1;
    this.overload = 0;
    this.slackT = 0;
    this.bite = null;
    this.state = 'fight';
    c.audio.play('hookset');
    c.ui.fight(true, this.fish);
    c.rod.twitch = 0.8;
  }

  chooseBehavior(f) {
    const sp = f.sp;
    const opts = [['run', 0.38], ['circle', 0.24], ['dive', sp.depth === 'b' ? 0.25 : 0.1], ['rest', 0.1 + (1 - f.stamina) * 0.3], ['charge', 0.08]];
    if (sp.jump > 0 && f.jumps < 6) opts.push(['jump', sp.jump * 0.28 * (0.4 + f.stamina)]);
    let sum = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * sum;
    for (const [name, w] of opts) { r -= w; if (r <= 0) { f.behavior = name; break; } }
    f.bT = 1.5 + Math.random() * 3.5;
    f.dir = Math.random() < 0.5 ? -1 : 1;
    f.power = { run: 1, circle: 0.65, dive: 0.85, rest: 0.25, charge: 0.35, jump: 0.7 }[f.behavior];
    if (f.behavior === 'jump') { f.jumpT = 0; f.jumps++; f.bT = 1.4; }
  }

  updateFight(dt, input) {
    const c = this.ctx, f = this.fish, { rod, reel, line } = this.gear;
    const tip = c.rod.tip;
    f.time += dt;
    f.bT -= dt;
    if (f.bT <= 0) this.chooseBehavior(f);
    const sp = f.sp;
    const D = this.dragSetting();
    f.shake = Math.max(0, Math.sin(f.time * 9) * Math.sin(f.time * 2.3)) * (sp.fight > 0.7 ? 0.22 : 0.12);
    const P = Math.max(0.3, 2.5 * Math.pow(f.lb, 0.75) * sp.fight * (0.22 + 0.78 * f.stamina) * f.power * (1 + f.shake));
    const speed = (1 + Math.pow(f.lb, 0.33) * 0.9) * (0.5 + sp.fight) * f.power * (0.3 + 0.7 * f.stamina);
    const radial = { run: 0.9, circle: 0.15, dive: 0.3, rest: 0, charge: -0.9, jump: 0.3 }[f.behavior];
    const tang = { run: 0.4, circle: 1, dive: 0.2, rest: 0.1, charge: 0.2, jump: 0.3 }[f.behavior] * f.dir;
    const reeling = input.down;
    const retrieve = reel.ratio * 0.36;
    let T;
    f.r = Math.min(f.r, this.lineOut);
    this.runWarn = false;
    if (radial > 0) {
      const want = speed * radial;
      if (P > D) {
        const out = want * (1 - D / P) + 0.15 * want;
        this.lineOut += out * dt;
        T = D;
        // cranking while the drag slips gains nothing and twists the line toward breaking
        if (reeling) { T = D * 1.3; this.overload += dt * 0.25; this.runWarn = true; }
        c.audio.drag(out);
      } else {
        T = P;
        c.audio.drag(0);
        if (reeling) { this.lineOut -= retrieve * (1 - P / D) * dt; T = Math.min(D, P + 0.3 * D); }
      }
      f.r = this.lineOut;
    } else {
      c.audio.drag(0);
      f.r = Math.max(1, f.r + speed * radial * dt);
      if (reeling) this.lineOut = Math.max(f.r, this.lineOut - retrieve * dt * (radial < 0 ? 1.6 : 1));
      const slack = this.lineOut - f.r;
      if (slack > 0.5) T = Math.max(0, P * 0.15 - slack * 0.2);
      else { T = reeling ? Math.min(D, P + 0.3 * D) : P * 0.8; this.lineOut = Math.min(this.lineOut, f.r + 0.2); if (reeling && P < D) { this.lineOut -= retrieve * (1 - P / D) * dt; f.r = this.lineOut; } }
    }
    c.audio.reel(reeling);
    // rod angle: pulling against the fish's side tires it faster
    const toFish = Math.atan2(f.pos.z - c.angler.position.z, f.pos.x - c.angler.position.x);
    const camDir = c.angler.getWorldDirection(_fwd);
    const camAng = Math.atan2(camDir.z, camDir.x);
    const rel = Math.atan2(Math.sin(toFish - camAng), Math.cos(toFish - camAng));
    const fishSide = rel > 0.15 ? 1 : rel < -0.15 ? -1 : 0;
    this.side += (input.steer - this.side) * Math.min(1, dt * 6);
    const against = input.steer !== 0 && fishSide !== 0 && Math.sign(input.steer) === -fishSide;
    const withIt = input.steer !== 0 && Math.sign(input.steer) === fishSide;
    const steerMul = against ? 1.9 : withIt ? 0.55 : 1;
    // stamina
    const strength = 2.5 * Math.pow(f.lb, 0.75) * sp.fight + 1;
    const chair = c.boatSpec().bigGame && f.lb > 80 ? 1.25 : 1;
    // bigger fish tire proportionally slower: a bass takes ~30 s, a 400 lb marlin a few minutes
    f.stamina -= dt * (T / strength) * 0.055 * Math.sqrt(rod.lift) * steerMul * chair / (1 + f.lb / 150);
    if (radial > 0 && P > D) f.stamina -= dt * 0.012;
    if (T < P * 0.3) f.stamina += dt * 0.015;
    f.stamina = THREE.MathUtils.clamp(f.stamina, 0, 1);
    // line strength: stretchy mono soaks up head shakes, braid doesn't
    const spike = T * (1 + f.shake * (1 - line.stretch * 3));
    if (spike > line.test) this.overload += dt * ((spike / line.test - 1) * 6 + 0.4);
    else if (!this.runWarn) this.overload = Math.max(0, this.overload - dt * 0.15);
    this.tension = T;
    if (this.overload >= 1) return this.lose(this.runWarn ? 'SNAP! You cranked against a running fish and twisted the line.' : 'SNAP! The line broke.', 'snap');
    if (T > rod.power * 3) return this.lose('Your rod couldn\'t take it - fish lost.', 'snap');
    if (this.lineOut > reel.cap) return this.lose('Spooled! The fish took all your line.', 'snap');
    // slack line lets a fish throw the hook
    if (T < P * 0.12 && !f.thrown) this.slackT += dt; else this.slackT = Math.max(0, this.slackT - dt * 2);
    if (this.slackT > 2.4) return this.lose('Slack line - it threw the hook!', 'miss');
    // position
    f.theta += (speed * tang) / Math.max(3, f.r) * dt;
    const bottom = Math.max(0.6, -c.heightAt(f.pos.x, f.pos.z));
    // a beaten fish comes up and thrashes on the surface near the boat
    const tired = f.stamina < 0.3 && f.behavior !== 'dive';
    const wantDepth = f.behavior === 'dive' ? bottom * 0.85 : tired ? 0.12 : f.behavior === 'jump' ? 0.4 : Math.min(bottom * 0.6, 1.5 + f.lb * 0.02);
    f.depth += THREE.MathUtils.clamp(wantDepth - f.depth, -2 * dt, 1.5 * dt);
    f.thrashT = (f.thrashT ?? 1) - dt;
    if (tired && f.depth < 0.4 && f.thrashT <= 0) {
      f.thrashT = 0.45 + Math.random() * 0.6;
      c.splash(f.pos.x, f.pos.z, 0.04 + Math.min(0.1, f.len * 0.04), f.len * 0.5);
      if (f.r < 30) c.audio.play('thrash');
    }
    const nx = tip.x + Math.cos(f.theta) * f.r, nz = tip.z + Math.sin(f.theta) * f.r;
    if (c.heightAt(nx, nz) > -0.4) { f.dir *= -1; f.r = Math.max(1, f.r - 1); }
    const prev = _w.copy(f.pos);
    f.pos.set(nx, c.waterAt(1) - f.depth, nz);
    if (f.jumpT >= 0) {
      f.jumpT += dt / 1.2;
      const hJ = 0.8 + Math.pow(f.lb, 0.2) * 0.6;
      f.pos.y = c.waterAt(1) + Math.sin(Math.PI * Math.min(1, f.jumpT)) * hJ - 0.2;
      if (f.jumpT < dt * 2) { c.splash(f.pos.x, f.pos.z, 0.12, f.len * 0.6); c.audio.play('splash'); c.ui.toast(`${f.sp.name} jumps!`, 'info'); }
      if (!f.thrown && f.jumpT > 0.3 && T > line.test * 0.65 && Math.random() < 0.45) {
        f.thrown = true;
        return this.lose('It shook the hook on the jump! (Lower the drag when they jump.)', 'miss');
      }
      if (f.jumpT >= 1) { f.jumpT = -1; c.splash(f.pos.x, f.pos.z, 0.15, f.len * 0.7); c.audio.play('splash'); }
    }
    _v.subVectors(f.pos, prev);
    if (_v.lengthSq() > 1e-6) f.heading = Math.atan2(-_v.z, _v.x);
    // landing
    const land = c.boatLength() * 0.35 + 2.5;
    if (f.r < land) {
      if (f.stamina < 0.32) return this.landed();
      if (f.behavior !== 'run') { f.behavior = 'run'; f.bT = 2.5; f.power = 1; f.dir = Math.random() < 0.5 ? 1 : -1; f.theta += Math.PI * 0.2; c.ui.toast('It sees the boat and bolts!', 'info'); }
    }
    c.ui.fightTick({ tension: T, test: line.test, drag: D, maxDrag: reel.drag, lineOut: this.lineOut, cap: reel.cap, stamina: f.stamina, fishSide, overload: this.overload, runWarn: this.runWarn });
  }

  lose(msg, sound) {
    const c = this.ctx;
    c.ui.toast(msg, 'bad');
    c.audio.play(sound);
    this.clearFish();
    this.reset();
  }

  clearFish() {
    if (!this.fish) return;
    this.ctx.scene.remove(this.fish.model.group);
    this.ctx.overlay.remove(this.fish.model.group);
    this.fish = null;
    this.ctx.ui.fight(false);
  }

  landed() {
    const c = this.ctx, f = this.fish;
    c.audio.drag(0);
    c.audio.reel(false);
    c.audio.play('landed');
    c.scene.remove(f.model.group);
    c.overlay.add(f.model.group);
    this.state = 'caught';
    c.ui.fight(false);
    c.onCatch(f, () => { this.clearFish(); this.reset(); });
  }

  reset() {
    this.state = 'idle';
    this.bite = null;
    this.tension = 0;
    this.lineOut = 0;
    this.ctx.audio.reel(false);
    this.ctx.audio.drag(0);
    this.ctx.ui.strike(false);
    this.ctx.rod.hideLine();
    if (this.gearOverride) {
      this.gearOverride = null;
      this.drag = null;
      const g = this.gear;
      this.ctx.rod.setGear(g.rod, g.line, g.lure);
    }
  }

  updateVisuals(dt, input) {
    const c = this.ctx, rod = c.rod, f = this.fish;
    if (this.state !== 'water' && this.state !== 'bite') c.ui.lureMarker(null);
    const pose = {
      side: this.state === 'fight' ? this.side : 0,
      lift: this.state === 'fight' ? 0.55 : this.state === 'water' || this.state === 'bite' ? 0.1 : 0,
      tension: this.state === 'fight' ? this.tension : this.state === 'water' ? 0.6 : 0.2,
      target: null,
      reeling: input.down && (this.state === 'water' || this.state === 'fight' || this.state === 'bite'),
      charge: this.state === 'charging' ? this.power : 0,
      lineOut: this.lineOut,
    };
    if (this.state === 'flying' || this.state === 'water' || this.state === 'bite') pose.target = this.lure;
    if (this.state === 'fight' && f) pose.target = f.pos;
    rod.update(dt, c.angler, pose);
    if (this.state === 'caught' && f) {
      // trophy shot: the fish held up in front of the camera
      const g = f.model.group;
      const fit = Math.min(1, 0.95 / f.len);
      g.scale.setScalar(f.len * fit);
      g.position.set(-0.3, -0.08, -1.1).applyMatrix4(c.camera.matrixWorld);   // left of centre, clear of the catch text
      g.quaternion.copy(c.camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(performance.now() / 900) * 0.35));
      if (f.model.body.flatfish) g.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
      f.model.uniforms.uSwim.value.x += dt;
      f.model.uniforms.uSwim.value.y = 0.04;
      rod.hideLine();
      return;
    }
    if (this.state === 'idle' || this.state === 'charging') { rod.hideLine(); return; }
    const { lure } = this.gear;
    if (this.state === 'fight' && f) {
      const g = f.model.group;
      g.position.copy(f.pos);
      g.rotation.set(0, f.heading, f.jumpT >= 0 ? Math.sin(f.jumpT * Math.PI * 2) * 0.6 : 0);
      if (f.model.body.flatfish) g.rotation.x = -Math.PI / 2;
      f.model.uniforms.uSwim.value.x += dt;
      f.model.uniforms.uSwim.value.y = 0.05 + (1 - f.stamina) * 0.02;
      f.model.uniforms.uSwim.value.z = 10 + 8 * f.stamina;
      this.entry.set(f.pos.x, c.waterAt(1), f.pos.z);
      const mouth = _v.set(f.len * 0.5, 0, 0).applyEuler(g.rotation).add(f.pos);
      rod.updateLine(mouth, 0, f.pos.y < this.entry.y ? this.entry : null);
      rod.bobber.visible = false;
      rod.lure.visible = false;
      return;
    }
    const surf = c.waterAt(0);
    const bob = this.bite?.bob || 0;
    if (this.bite) this.bite.bob = Math.max(0, bob - dt * 2);
    const striking = this.bite?.phase === 'strike';
    // keep the bobber/lure readable at range: grow it with distance
    const far = THREE.MathUtils.clamp(c.camera.position.distanceTo(this.lure) / 9, 1, 7);
    if (lure.bobber && this.state !== 'flying') {
      rod.bobber.visible = true;
      rod.bobber.scale.setScalar(far);
      rod.bobber.position.set(this.lure.x, surf - 0.02 - (striking ? 0.5 : bob * 0.3) * far * 0.6, this.lure.z);
      rod.lure.visible = false;
      rod.updateLine(rod.bobber.position, 0.6, null);
    } else {
      rod.bobber.visible = false;
      rod.lure.visible = true;
      rod.lure.scale.setScalar(Math.min(far, 3));
      rod.lure.position.copy(this.lure);
      if (this.lureVel.lengthSq() > 0.01) rod.lure.lookAt(_w.copy(this.lure).add(this.lureVel));
      const under = this.lure.y < surf - 0.05;
      // the line meets the water a little toward the rod from the lure, then slants down to it
      _v.subVectors(c.rod.tip, this.lure).setY(0).normalize();
      this.entry.copy(this.lure).addScaledVector(_v, Math.min(this.depth * 0.8, 4)).setY(surf);
      rod.updateLine(this.lure, this.state === 'flying' ? 0.2 : this.moving ? 0.05 : 0.5, under ? this.entry : null);
    }
    if (this.state === 'water' || this.state === 'bite') {
      const mode = striking ? 'strike' : this.state === 'bite' ? 'nibble' : 'idle';
      c.ui.lureMarker(_w.set(this.lure.x, surf + 0.3, this.lure.z), c.camera, `${Math.round(horiz(c.rod.tip, this.lure))} m${lure.bobber ? '' : ` · ${this.depth.toFixed(1)} m deep`}`, mode);
    } else c.ui.lureMarker(null);
  }

  // world positions sampled by the water query (lure, fish)
  queryPoints() {
    return [this.lure, this.fish ? this.fish.pos : this.lure];
  }
}

function horiz(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

import * as THREE from 'three';
import * as U from './units.js';
import { rollMorph, rollWeight } from './species.js';
import { poolFit, pickFrom } from './bait.js';
import { TUNING as BAIT } from './baitData.js';
import { RODS, REELS, LINES, LURES } from './gear.js';
import { buildFish, fishLengthM } from './fishMesh.js';
import { FEEL, personality, landKind, pickLine } from './fightFeel.js';
import { FightFx } from './fightFx.js';
import { GFX } from './gfx.js';
import { Landing } from './landing.js';
import { effectiveTest, reelSmooth, WEAR_DEFAULT, lineCastMul, CAST_WEAR, HOOK_WEAR_PER_FISH, hookMul, snagChance, fightWear } from './progress.js';

// Rod-and-reel fishing: cast -> lure in the water -> nibbles -> strike window -> fight.
// The fight is a force balance: fish pull vs. drag setting vs. line strength, with stamina,
// runs, jumps, head shakes and slack.
const G = 9.81;
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
    this.mouth = new THREE.Vector3();
    this.fx = new FightFx(ctx.scene);
    this.landing = new Landing(ctx.scene);
    this.lctx = { camera: ctx.camera, rod: ctx.rod, audio: ctx.audio, fx: this.fx, splash: (x, z, a, s) => ctx.splash(x, z, a, s), waterAt: (i) => ctx.waterAt(i), kick: (a) => this.kick(a), clearHull: (v) => this.clearHull(v) };
    this.camShake = 0;      // 0..1, read by the game for camera shake
    this.kickV = 0;
    this.warn = false;
    this.slip = 0;
    this.load = 0;
    this.releasing = null;
    this.fxT = { drip: 0, spray: 0, wake: 0 };
  }

  // keep a landing spot off the boat's own deck: a fish ahead of you is brought alongside, not over the bow
  clearHull(v) {
    const c = this.ctx, b = c.boat;
    if (!b || !b.hull || c.boatLength() <= 0) return;
    const h = b.heading(), fx = Math.cos(h), fz = -Math.sin(h), rx = Math.sin(h), rz = Math.cos(h);
    const dx = v.x - b.position.x, dz = v.z - b.position.z;
    const along = dx * fx + dz * fz, across = dx * rx + dz * rz, hw = b.hull.beam / 2 + 1.3;
    if (Math.abs(along) < b.hull.length / 2 + 0.8 && Math.abs(across) < hw) {
      const x = (across >= 0 ? 1 : -1) * hw;
      v.x = b.position.x + fx * along + rx * x;
      v.z = b.position.z + fz * along + rz * x;
    }
  }

  // one-off jolt for the camera (landing strikes, big jumps)
  kick(a) { this.kickV = Math.min(1.5, this.kickV + a); }

  // gearOverride: the boat's trolling tackle while fighting a fish off the spread
  get gear() {
    const e = this.gearOverride || this.ctx.save.equip;
    // worn line breaks below its rating (progress.js); the boat's trolling tackle is always fresh
    const line = this.gearOverride ? LINES[e.line] : { ...LINES[e.line], rated: LINES[e.line].test, test: effectiveTest(LINES[e.line].test, this.wear.line) };
    return { rod: RODS[e.rod], reel: { ...REELS[e.reel], smooth: reelSmooth(e.reel) }, line, lure: LURES[e.lure] };
  }

  get wear() { return this.gearOverride ? WEAR_DEFAULT : this.ctx.save.wear || WEAR_DEFAULT; }

  // a snag on the way back: usually you work it free (duller hook), sometimes it breaks off
  snag() {
    const c = this.ctx, { lure } = this.gear;
    c.wearAdd('line', 0.02);
    if (Math.random() < 0.35) {
      c.audio.play('snap');
      this.reset();
      c.lureLost(lure);
      return;
    }
    c.wearAdd('hook', 0.12);
    c.ui.toast(`Snagged on the bottom - worked it free. The hook is duller.`, 'info');
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
      case 'landing': this.updateLanding(dt); break;
      case 'caught': break;
      default: break;
    }
    this.kickV *= Math.exp(-dt * 6);
    if (this.state !== 'fight') this.camShake *= Math.exp(-dt * 5);
    this.updateVisuals(dt, input);
    this.updateRelease(dt);
    this.fx.update(dt, c.camera, c.rod.tip);
  }

  cast() {
    const c = this.ctx, { rod, lure, line } = this.gear;
    const fwd = c.angler.getWorldDirection(_fwd).setY(0).normalize();
    // even a quick tap lobs it a useful distance; thinner line casts farther
    let dist = Math.max(8, rod.cast * lineCastMul(line.rated ?? line.test) * (0.25 + 0.75 * this.power) * (lure.fly && !rod.fly ? 0.45 : 1) * (0.95 + Math.random() * 0.08));
    if (!this.gearOverride) c.wearAdd('line', CAST_WEAR);
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
    this.sinkT = 0;
    this.match = null;
  }

  updateFlight(dt) {
    const c = this.ctx;
    this.lureVel.y -= G * dt;
    this.lure.addScaledVector(this.lureVel, dt);
    this.lineOut = c.rod.tip.distanceTo(this.lure);
    if (this.lure.y <= c.waterAt(0)) {
      const ground = c.heightAt(this.lure.x, this.lure.z);
      if (ground > -0.15) {
        c.ui.toast('Hung up on the bank. Line cut.', 'bad');
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
    const base = Math.min(bottom * 0.65, lure.bobber ? 1.8 : 2.6 + (this.moving ? 1.2 : 0));
    // let it sink: a mid-water lure that is paused falls toward deeper fish (reel or move to bring it up)
    return lure.bobber ? base : Math.min(Math.max(base, bottom - 0.3), base + Math.min(BAIT.sink.max, this.sinkT * BAIT.sink.rate));
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
    this.sinkT = reeling || this.moving ? Math.max(0, this.sinkT - BAIT.sink.fall * dt) : this.sinkT + dt;
    this.depth += THREE.MathUtils.clamp(this.targetDepth() - this.depth, -1.2 * dt, 0.7 * dt);
    this.lure.y = c.waterAt(0) - (lure.bobber ? 0 : this.depth);
    const home = reeling && horiz(tip, this.lure) < 3;
    if (c.heightAt(this.lure.x, this.lure.z) > -0.05 || home) {
      if (home) c.ui.toast('Lure in. Hold the button to cast.', 'info');
      else c.ui.toast('Lure fouled on the bottom and recovered.', 'info');
      this.reset();
      return;
    }
    if (!this.gearOverride && Math.random() < snagChance(lure, this.moving) * dt) { this.snag(); if (this.state !== 'water') return; }
    // a visible fish that followed the lure and struck (fishLife.js) becomes the bite
    const take = c.fishLife?.consumeTake();
    if (take) {
      this.bite = { sp: take.sp, morph: take.morph, lb: take.lb, nibbles: take.nibbles, t: take.t, phase: 'nibble', actor: take.a, mode: take.mode };
      this.state = 'bite';
      return;
    }
    // bites
    this.biteClock += dt;
    if (this.biteClock < 1.2) return;
    const fish = c.fishLife?.engaged() ? null : this.rollBite(dt, rod, lure);
    if (fish) {
      this.bite = { ...fish, nibbles: 1 + Math.floor(Math.random() * 3), t: 0.5 + Math.random() * 0.7, phase: 'nibble' };
      this.state = 'bite';
    }
  }

  // how well the current lure/depth/time/weather suits this water's fish (cached, see baitData.js)
  matchInfo() {
    const c = this.ctx, now = performance.now();
    if (this.match && now - this.matchT < BAIT.cacheT * 1000) return this.match;
    const e = this.gearOverride || c.save.equip;
    const lure = LURES[e.lure];
    const depth = lure.bobber ? Math.min(this.depth, 1.8) : this.depth;
    this.matchT = now;
    this.match = poolFit(c.loc.pool, { lureId: e.lure, lure, depth, bottom: Math.max(0.3, -c.heightAt(this.lure.x, this.lure.z)), hour: c.hour(), wx: c.weatherId ? c.weatherId() : 'partly' });
    return this.match;
  }

  rollBite(dt, rod, lure) {
    const c = this.ctx;
    let activity = lure.active ? (this.moving ? 1 : 0.3) : (this.moving ? 0.5 : 1);
    if (lure.fly && rod.fly) activity *= 1.35;
    const hot = Math.max(c.hotspots ? c.hotspots.near(this.lure.x, this.lure.z, 55) : 0, c.fishLife ? c.fishLife.boilNear(this.lure.x, this.lure.z) : 0);
    const hour = c.hour();
    // dawn and dusk are best overall; per-species time/weather/depth/lure taste is in the match model
    const isNight = hour < 5.2 || hour > 20.6;
    const tod = isNight ? 0.95 : hour < 8.5 || hour > 17.5 ? 1.4 : hour > 11 && hour < 15 ? 0.85 : 1;
    const info = this.matchInfo();
    const rate = 0.07 * activity * (1 + hot * 3.5) * tod * (c.weatherBite ? c.weatherBite() : 1) * info.rate;
    if (Math.random() > rate * dt) return null;
    // tide: flats species like a rising tide, flatfish and cod a falling one (weather.js tideMul)
    let pick = info;
    if (c.tideMul) {
      const entries = info.entries.map(([s, w]) => [s, w * c.tideMul(s.id)]);
      pick = { entries, sum: entries.reduce((t, [, w]) => t + w, 0) };
    }
    const sp = pickFrom(pick);
    if (!sp) return null;
    const big = (lure.size || 1) * ((['tuna', 'billfish', 'swordfish', 'shark'].includes(sp.body) ? c.boatSpec().bigGame || 1 : 1));
    const luck = this.luck * (performance.now() < this.luckUntil ? 1.6 : 1);
    return { sp, morph: rollMorph(Math.random, luck), lb: rollWeight(sp, Math.random, big) };
  }

  updateBite(dt, input) {
    const c = this.ctx, b = this.bite, { rod, line } = this.gear;
    b.t -= dt;
    this.lure.y = c.waterAt(0) - (this.gear.lure.bobber ? 0 : this.depth);
    if (b.phase === 'nibble') {
      if (input.pressed) {
        if (Math.random() < 0.2) { c.ui.toast('Struck too soon. It was gone.', 'bad'); c.fishLife?.cue(b.actor, 'spook'); this.bite = null; this.state = 'water'; this.biteClock = 0; return; }
        c.ui.toast('Something has it. Wait for the strike call.', 'info');
      }
      if (b.t <= 0) {
        // a stiffer, less sensitive rod doesn't telegraph every tap (the strike itself is always obvious)
        // (an aggressive take skips the taps: the fish just hits it)
        if (b.mode !== 'strike' && Math.random() < 0.45 + rod.sens * 0.55) {
          c.rod.twitch = 0.35;
          c.audio.play('tick');
          c.splash(this.lure.x, this.lure.z, 0.03, 0.2);
          c.ui.toast('Nibble.', 'info');
        }
        if (b.actor && b.nibbles > 1) c.fishLife?.cue(b.actor, 'nudge');
        b.bob = 0.6;
        b.nibbles--;
        if (b.nibbles <= 0 && b.mode === 'halfhearted') {
          // mouthed it and thought better of it: nothing to set the hook in
          c.fishLife?.cue(b.actor, 'spit');
          c.ui.toast('It mouthed the lure and spat it out.', 'info');
          this.bite = null; this.state = 'water'; this.biteClock = 0;
          return;
        }
        if (b.nibbles <= 0) {
          c.fishLife?.cue(b.actor, 'strike');
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
        if (Math.random() < (0.9 + (line.braid ? 0.07 : 0)) * hookMul(this.wear.hook)) this.hook();
        else { c.ui.toast('No hook set.', 'bad'); c.fishLife?.cue(b.actor, 'spook'); this.bite = null; this.state = 'water'; this.biteClock = 0; }
        return;
      }
      if (b.t <= 0) {
        c.ui.strike(false);
        c.ui.toast('It let go.', 'bad');
        c.fishLife?.cue(b.actor, 'spit');
        this.bite = null;
        this.state = 'water';
        this.biteClock = 0;
      }
    }
  }

  hook() {
    const c = this.ctx, b = this.bite;
    const sp = b.sp, lb = b.lb;
    c.fishLife?.cue(b.actor, 'hooked');
    if (!this.gearOverride) c.wearAdd('hook', HOOK_WEAR_PER_FISH);
    const { m } = fishLengthM(sp, lb);
    const model = buildFish(sp, b.morph, { patchProp: c.patchProp });
    model.group.scale.setScalar(m);
    c.scene.add(model.group);
    const tip = c.rod.tip;
    this.fish = {
      sp, morph: b.morph, lb, len: m, model, stamina: 1,
      r: horiz(tip, this.lure), theta: Math.atan2(this.lure.z - tip.z, this.lure.x - tip.x),
      depth: Math.max(0.6, this.depth), behavior: 'run', bT: 1.5, dir: 1, power: 1, jumpT: -1, jumps: 0, thrown: false, pers: personality(sp, lb), pitch: 0, roll: 0, speed: 0,
      pos: this.lure.clone(), heading: 0, shake: 0, time: 0,
      how: { lure: (this.gearOverride || c.save.equip).lure, depth: Math.round(this.depth * 10) / 10, hour: c.hour() },
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
    const sp = f.sp, P = f.pers, T = f.stamina;
    const opts = [['run', 0.38], ['circle', 0.24], ['dive', sp.depth === 'b' ? 0.25 : 0.1], ['rest', 0.1 + (1 - T) * 0.3], ['charge', 0.08],
      ['surge', P.surge * (0.4 + T)], ['headshake', P.headshake], ['sound', P.sound * (0.5 + T)]];
    if (sp.jump > 0 && f.jumps < P.jumpMax) opts.push(['jump', sp.jump * 0.28 * (0.4 + T) * (P.jump ? 1.6 : 1)]);
    if (P.thrash && T < 0.75) opts.push(['thrash', P.thrash * (1.2 - T)]);
    let sum = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * sum;
    for (const [name, w] of opts) { r -= w; if (r <= 0) { f.behavior = name; break; } }
    const rnd = ([lo, hi]) => lo + Math.random() * (hi - lo);
    f.bT = 1.5 + Math.random() * 3.5;
    f.dir = Math.random() < 0.5 ? -1 : 1;
    f.power = { run: 1, circle: 0.65, dive: 0.85, rest: 0.25, charge: 0.35, jump: 0.7, surge: FEEL.surge.power, headshake: FEEL.headshake.power, sound: FEEL.sound.power, thrash: FEEL.thrash.power }[f.behavior];
    if (f.behavior === 'jump') { f.jumpT = 0; f.jumps++; f.bT = 1.4; }
    else if (f.behavior === 'surge') f.bT = rnd(FEEL.surge.t);
    else if (f.behavior === 'headshake') f.bT = rnd(FEEL.headshake.t);
    else if (f.behavior === 'sound') f.bT = rnd(FEEL.sound.t);
    else if (f.behavior === 'thrash') f.bT = rnd(FEEL.thrash.t);
  }

  updateFight(dt, input) {
    const c = this.ctx, f = this.fish, { rod, reel, line } = this.gear;
    const tip = c.rod.tip;
    f.time += dt;
    f.bT -= dt;
    if (f.bT <= 0) this.chooseBehavior(f);
    const sp = f.sp;
    const D = this.dragSetting();
    const hs = f.behavior === 'headshake' || f.behavior === 'thrash';
    f.shake = hs ? Math.abs(Math.sin(f.time * 16)) * FEEL.headshake.shake * (0.5 + 0.5 * Math.min(1, f.lb / 20))
      : Math.max(0, Math.sin(f.time * 9) * Math.sin(f.time * 2.3)) * (sp.fight > 0.7 ? 0.22 : 0.12);
    const P = Math.max(0.3, 2.5 * Math.pow(f.lb, 0.75) * sp.fight * (0.22 + 0.78 * f.stamina) * f.power * (1 + f.shake));
    const speed = (1 + Math.pow(f.lb, 0.33) * 0.9) * (0.5 + sp.fight) * f.power * (0.3 + 0.7 * f.stamina);
    const radial = { run: 0.9, circle: 0.15, dive: 0.3, rest: 0, charge: -0.9, jump: 0.3, surge: FEEL.surge.radial, headshake: 0, sound: 0.25, thrash: 0 }[f.behavior];
    const tang = { run: 0.4, circle: 1, dive: 0.2, rest: 0.1, charge: 0.2, jump: 0.3, surge: 0.3, headshake: 0.05, sound: 0.1, thrash: 0.5 }[f.behavior] * f.dir;
    const reeling = input.down;
    const retrieve = reel.ratio * 0.36;
    let T, reelStall = false;
    this.slip = 0;
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
        this.slip = Math.min(1.5, out);
        reelStall = reeling;
      } else {
        T = P;
        if (reeling) { this.lineOut -= retrieve * (1 - P / D) * dt; T = Math.min(D, P + 0.3 * D); }
      }
      f.r = this.lineOut;
    } else {
      f.r = Math.max(1, f.r + speed * radial * dt);
      if (reeling) this.lineOut = Math.max(f.r, this.lineOut - retrieve * dt * (radial < 0 ? 1.6 : 1));
      const slack = this.lineOut - f.r;
      if (slack > 0.5) T = Math.max(0, P * 0.15 - slack * 0.2);
      else { T = reeling ? Math.min(D, P + 0.3 * D) : P * 0.8; this.lineOut = Math.min(this.lineOut, f.r + 0.2); if (reeling && P < D) { this.lineOut -= retrieve * (1 - P / D) * dt; f.r = this.lineOut; } }
    }
    // a rough drag lets go in jerks: the cheaper the reel, the harder it hits the line
    if (radial > 0 && P > D) T *= 1 + (1 - reel.smooth) * 0.35 * Math.max(0, Math.sin(f.time * 17));
    if (!this.gearOverride) c.wearAdd('line', fightWear(dt, T / line.test));
    c.audio.reel(reeling);
    c.audio.playDrag(this.slip > 0 ? Math.min(1, 0.15 + 0.55 * (T / line.test) + 0.15 * this.slip) : 0);
    this.reelStall = reelStall;
    this.load = Math.min(1.3, T / line.test);
    // tension warning: loaded close to the line's limit, or the overload clock is running
    this.warn = this.load > FEEL.warnLoad || this.overload > FEEL.warnOverload;
    // heavier fish shake the camera and the hands more, harder on a surge or a headshake
    const heft = Math.min(1, Math.sqrt(f.lb / FEEL.cam.lbRef));
    const mood = f.behavior === 'headshake' || f.behavior === 'thrash' ? 1.5 : f.behavior === 'surge' ? 1.2 : f.jumpT >= 0 ? 0.3 : 1;
    this.camShake += (Math.min(1.4, this.load * heft * mood + (this.slip > 0 ? 0.1 * heft : 0)) - this.camShake) * Math.min(1, dt * 6);
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
    if (this.overload >= 1) return this.lose(this.runWarn ? 'wound' : this.wear.line > 0.5 ? 'snapFrayed' : 'snap');
    if (T > rod.power * 3) return this.lose('rod');
    if (this.lineOut > reel.cap) return this.lose('spooled');
    // slack line lets a fish throw the hook
    if (T < P * 0.12 && !f.thrown) this.slackT += dt; else this.slackT = Math.max(0, this.slackT - dt * 2);
    if (this.slackT > 2.4) return this.lose('pull');
    // position
    f.theta += (speed * tang) / Math.max(3, f.r) * dt;
    const bottom = Math.max(0.6, -c.heightAt(f.pos.x, f.pos.z));
    // a beaten fish comes up and thrashes on the surface near the boat
    const tired = f.stamina < 0.3 && f.behavior !== 'dive' && f.behavior !== 'sound';
    const thrash = tired || f.behavior === 'thrash';
    const wantDepth = f.behavior === 'dive' ? bottom * 0.85 : f.behavior === 'sound' ? bottom * FEEL.sound.depthFrac : thrash ? 0.12 : f.behavior === 'jump' ? 0.4 : Math.min(bottom * 0.6, 1.5 + f.lb * 0.02);
    f.depth += THREE.MathUtils.clamp(wantDepth - f.depth, -2 * dt, 1.5 * dt);
    f.thrashT = (f.thrashT ?? 1) - dt;
    if (thrash && f.depth < 0.4 && f.thrashT <= 0) {
      const [lo, hi] = FEEL.thrash.splashEvery;
      f.thrashT = lo + Math.random() * (hi - lo);
      c.splash(f.pos.x, f.pos.z, 0.04 + Math.min(0.1, f.len * 0.04), f.len * 0.5);
      this.fx.burst('splash', _v.set(f.pos.x, c.waterAt(1), f.pos.z), 6 + Math.floor(f.len * 6), null, 0.8 + f.len * 0.5);
      if (f.behavior === 'thrash') this.kick(0.12 * Math.min(1, f.lb / 30));
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
      if (f.jumpT < dt * 2) { c.splash(f.pos.x, f.pos.z, 0.12, f.len * 0.6); c.audio.play('splash'); this.fx.burst('splash', _v.set(f.pos.x, c.waterAt(1), f.pos.z), 14, null, 1.3); this.kick(0.25); c.ui.toast(`${f.sp.name} clears the water.`, 'info'); }
      if (!f.thrown && f.jumpT > 0.3 && T > line.test * 0.65 && Math.random() < 0.45) {
        f.thrown = true;
        return this.lose('thrown');
      }
      if (f.jumpT >= 1) { f.jumpT = -1; c.splash(f.pos.x, f.pos.z, 0.15, f.len * 0.7); c.audio.play('splash'); this.fx.burst('splash', _v.set(f.pos.x, c.waterAt(1), f.pos.z), 22, null, 1.6); this.kick(0.3 * Math.min(1, Math.sqrt(f.lb / 30))); }
    }
    _v.subVectors(f.pos, prev);
    f.speed += (_v.length() / Math.max(dt, 1e-4) - f.speed) * Math.min(1, dt * 5);
    if (_v.lengthSq() > 1e-6) f.heading = Math.atan2(-_v.z, _v.x);
    f.roll += ((tired ? FEEL.roll * (0.6 + 0.4 * Math.sin(f.time * 3)) : 0) - f.roll) * Math.min(1, dt * 3);
    // landing
    const land = c.boatLength() * 0.35 + 2.5;
    if (f.r < land) {
      if (f.stamina < FEEL.land.stamina) return this.startLanding();
      if (f.behavior !== 'run') { f.behavior = 'run'; f.bT = 2.5; f.power = 1; f.dir = Math.random() < 0.5 ? 1 : -1; f.theta += Math.PI * 0.2; c.ui.toast(c.boatLength() ? 'It has seen the boat and is running.' : 'It has seen you and is running.', 'info'); }
    }
    c.ui.fightTick({ warn: this.warn, slip: this.slip, behavior: f.behavior, tension: T, test: line.test, drag: D, maxDrag: reel.drag, lineOut: this.lineOut, cap: reel.cap, stamina: f.stamina, fishSide, overload: this.overload, runWarn: this.runWarn });
  }

  // kind: snap / snapFrayed / rod / spooled / wound (the line parts) or pull / thrown (the hook comes out)
  lose(kind) {
    const c = this.ctx, f = this.fish, tip = c.rod.tip;
    const hookOut = kind === 'pull' || kind === 'thrown';
    c.ui.toast(pickLine(kind), 'bad');
    c.audio.playDrag(0);
    c.audio.reel(false);
    if (hookOut) c.audio.play('miss'); else c.audio.playSnap();
    if (f) {
      // the line whips back to the rod, the blank straightens and rings, the fish leaves a swirl
      this.fx.snap(tip, this.mouth.lengthSq() ? this.mouth : f.pos, hookOut ? this.gear.lure.color : null);
      c.rod.kick(hookOut ? FEEL.releaseKick : FEEL.snapKick);
      c.splash(f.pos.x, f.pos.z, 0.08, f.len * 0.6);
      this.fx.burst('splash', _v.set(f.pos.x, c.waterAt(1), f.pos.z), 12, null, 1);
      this.kick(hookOut ? 0.35 : 0.6);
    }
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

  // a tired fish inside range: pick how you land it, then the Landing animation takes over
  startLanding() {
    const c = this.ctx, f = this.fish;
    c.audio.playDrag(0);
    c.audio.reel(false);
    this.slip = 0; this.warn = false;
    const kind = landKind(f.sp, f.lb, c.boatLength() > 0, !!c.boatSpec().bigGame);
    f.jumpT = -1;
    this.tension = 0;
    this.state = 'landing';
    c.ui.fight(false);
    this.landing.start(f, kind, this.lctx);
  }

  updateLanding(dt) {
    if (this.landing.update(dt, this.lctx)) { this.landing.clear(); this.landed(); }
  }

  landed() {
    const c = this.ctx, f = this.fish;
    c.audio.playDrag(0);
    c.audio.reel(false);
    c.audio.play('landed');
    f.spot = this.landing.spot ? this.landing.spot.clone() : f.pos.clone();
    f.pitch = f.roll = 0;
    c.scene.remove(f.model.group);
    c.overlay.add(f.model.group);
    this.state = 'caught';
    c.ui.fight(false);
    c.onCatch(f, () => {
      // released fish are dropped back over the side and swim off; everything else just goes away
      if (f.released) this.startRelease(f); else this.clearFish();
      this.reset();
    });
  }

  // the held fish falls to the water, splashes and swims off, sinking
  startRelease(f) {
    const c = this.ctx, g = f.model.group;
    g.updateMatrixWorld(true);
    const start = g.getWorldPosition(new THREE.Vector3());
    c.overlay.remove(g);
    g.scale.setScalar(f.len);
    g.position.copy(start);
    c.scene.add(g);
    const away = new THREE.Vector3().subVectors(f.spot, c.camera.position).setY(0).normalize();
    this.releasing = { f, g, vy: 0.5, away, t: 0, wet: false, heading: Math.atan2(-away.z, away.x) };
    this.fish = null;
    c.ui.fight(false);
  }

  updateRelease(dt) {
    const r = this.releasing;
    if (!r) return;
    const c = this.ctx, g = r.g, surf = c.waterAt(1);
    r.t += dt;
    g.position.addScaledVector(r.away, (r.wet ? 1.6 : 0.5) * dt);
    if (!r.wet) {
      r.vy -= 9.8 * dt;
      g.position.y += r.vy * dt;
      g.rotation.set(0, r.heading, Math.min(0.9, 0.4 + r.t * 1.2) * (r.f.model.body.flatfish ? 0 : 1));
      if (g.position.y < surf) {
        r.wet = true;
        c.splash(g.position.x, g.position.z, 0.09, r.f.len * 0.7);
        c.audio.playSplash(Math.min(1.5, 0.5 + r.f.len));
        this.fx.burst('splash', _v.set(g.position.x, surf, g.position.z), 16, null, 1.2);
      }
    } else {
      g.position.y += (surf - 0.9 - g.position.y) * Math.min(1, dt * 1.6);
      g.rotation.set(0, r.heading, 0);
      r.f.model.uniforms.uSwim.value.y = 0.07;
      r.f.model.uniforms.uSwim.value.z = 14;
    }
    if (r.f.model.body.flatfish) g.rotation.x = -Math.PI / 2;
    r.f.model.uniforms.uSwim.value.x += dt;
    if (r.t > 2.4) { c.scene.remove(g); this.releasing = null; }
  }

  reset() {
    this.state = 'idle';
    this.bite = null;
    this.tension = 0;
    this.lineOut = 0;
    this.ctx.audio.reel(false);
    this.ctx.audio.playDrag(0);
    this.ctx.ui.strike(false);
    this.landing.clear();
    this.warn = false; this.slip = 0; this.load = 0;
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
    const fighting = this.state === 'fight', landing = this.state === 'landing';
    const calm = GFX.reduceMotion;
    const pose = {
      side: fighting ? this.side : 0,
      lift: fighting ? 0.55 : landing ? 0.7 : this.state === 'water' || this.state === 'bite' ? 0.1 : 0,
      tension: fighting ? this.tension : this.state === 'water' ? 0.6 : landing ? 0.3 : 0.2,
      load: fighting ? Math.min(1, this.load) : 0,
      // hand tremor with a heavy fish on (off with Reduce motion); the crank stalls while the drag slips
      shakeAmp: fighting && !calm ? FEEL.hand.shake * this.camShake : 0,
      reelRate: fighting ? (this.reelStall ? FEEL.hand.slipStall : 1 - FEEL.hand.crankDrag * Math.min(1, this.load)) : 1,
      target: null,
      reeling: input.down && (this.state === 'water' || fighting || this.state === 'bite'),
      charge: this.state === 'charging' ? this.power : 0,
      lineOut: this.lineOut,
    };
    if (this.state === 'flying' || this.state === 'water' || this.state === 'bite') pose.target = this.lure;
    if ((fighting || landing) && f) pose.target = f.pos;
    rod.update(dt, c.angler, pose);
    if (this.state === 'caught' && f) {
      f.model.group.rotation.order = 'XYZ';
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
    if ((fighting || landing) && f) {
      const g = f.model.group;
      g.position.copy(f.pos);
      g.rotation.order = f.model.body.flatfish ? 'XYZ' : 'YXZ';
      g.rotation.set(f.model.body.flatfish ? 0 : f.roll, f.heading, (f.jumpT >= 0 ? Math.sin(f.jumpT * Math.PI * 2) * 0.6 : 0) + f.pitch);
      if (f.model.body.flatfish) g.rotation.x = -Math.PI / 2;
      f.model.uniforms.uSwim.value.x += dt;
      f.model.uniforms.uSwim.value.y = 0.05 + (1 - f.stamina) * 0.02;
      f.model.uniforms.uSwim.value.z = 10 + 8 * f.stamina;
      this.entry.set(f.pos.x, c.waterAt(1), f.pos.z);
      const mouth = _v.set(f.len * 0.5, 0, 0).applyEuler(g.rotation).add(f.pos);
      this.mouth.copy(mouth);
      rod.updateLine(mouth, landing ? 0.15 : 0, f.pos.y < this.entry.y ? this.entry : null);
      this.fightFx(dt, f, input);
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
      c.ui.lureMarker(_w.set(this.lure.x, surf + 0.3, this.lure.z), c.camera, [c.depthReadout() ? U.dist(horiz(c.rod.tip, this.lure)) + (lure.bobber ? '' : ` · ${U.depth(this.depth)} deep`) : '', c.biteQuality && c.biteQuality() ? '▮'.repeat(this.matchInfo().ticks) + '▯'.repeat(3 - this.matchInfo().ticks) : ''].filter(Boolean).join(' · '), mode);
    } else c.ui.lureMarker(null);
  }

  // spray off the line where it enters the water, drips at the tip, foam and a wake as the fish runs near the top
  fightFx(dt, f, input) {
    const c = this.ctx, T = this.fxT, tip = c.rod.tip, surf = c.waterAt(1);
    if (this.state !== 'fight') return;
    const load = Math.min(1.2, this.load);
    T.drip -= dt; T.spray -= dt; T.wake -= dt;
    if (T.drip <= 0) {
      T.drip = 0.5 / (1 + 6 * load + (input.down ? 2 : 0));
      this.fx.emit('drop', _w.copy(tip).addScaledVector(c.camera.getWorldDirection(_fwd), 0.02), null, 0.5);
    }
    // line spray: heavier when the drag is screaming, a mist when it is just tight
    const rate = (this.slip > 0 ? 70 : input.down ? 28 : 10) * load;
    if (rate > 0.5 && f.pos.y < this.entry.y + 0.3) {
      while (T.spray <= 0) {
        T.spray += 1 / Math.max(6, rate);
        _w.copy(this.entry).lerp(tip, Math.random() * 0.08);
        this.fx.emit('spray', _w, _v.set(0, 0.5 + load, 0), 1);
      }
    }
    // the fish near the surface and moving: foam trail and ripples
    if (f.depth < 0.7 && f.speed > 0.8 && T.wake <= 0) {
      T.wake = 0.2;
      this.fx.emit('foam', _w.set(f.pos.x, surf + 0.01, f.pos.z), null, 0.6 + f.len * 0.6);
      c.splash(f.pos.x, f.pos.z, 0.012 + Math.min(0.03, f.len * 0.012), f.len * 0.35);
    }
  }

  // world positions sampled by the water query (lure, fish)
  queryPoints() {
    return [this.lure, this.fish ? this.fish.pos : this.lure];
  }
}

function horiz(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

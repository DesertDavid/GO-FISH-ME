// Events placed in the world: lapping, hull slap, surf, creaks, birds, frogs, wildlife from their real positions,
// bell buoy, distant machinery. A timer per kind fires at a random pace set by the place, time of day and weather.
// AMB = what each water sounds like (all levels 0..1, `wind` scales the wind bed).
export const AMB = {
  okeechobee: { insects: 0.7, crickets: 0.8, frogs: 'bull', frogRate: 1, songbird: 0.6, owl: 0.5, wind: 0.8 },
  woods: { crickets: 0.8, songbird: 0.8, loon: 1, owl: 0.7, wind: 0.7 },
  tahoe: { crickets: 0.5, songbird: 0.6, owl: 0.5, wind: 0.9 },
  columbia: { crickets: 0.3, songbird: 0.3, owl: 0.4, wind: 1.35 },
  chesapeake: { gulls: 0.8, crickets: 0.4, surf: 0.15, marina: 0.8, traffic: 0.8, halyards: 1, wind: 1 },
  keys: { gulls: 0.8, crickets: 0.3, surf: 0.3, marina: 0.6, traffic: 0.7, halyards: 0.8, wind: 1 },
  mekong: { insects: 1, crickets: 1, frogs: 'tree', frogRate: 1, songbird: 0.4, longtail: 1, wind: 0.6 },
  amazon: { insects: 1, crickets: 1, frogs: 'tree', frogRate: 1.4, songbird: 0.9, howler: 1, wind: 0.5 },
  kariba: { insects: 0.8, crickets: 0.8, frogs: 'bull', frogRate: 0.6, songbird: 0.4, owl: 0.4, wind: 0.8 },
  fjord: { gulls: 0.7, surf: 0.5, wind: 1.25 },
  gulf: { gulls: 0.3, rig: 1, clank: 1, wind: 1.1 },
  cabo: { gulls: 0.7, surf: 1, seals: 0.7, wind: 0.9 },
  reef: { gulls: 0.35, surf: 0.55, wind: 0.9 },
  bering: { gulls: 0.3, surf: 0.7, seals: 0.35, wind: 1.55 },
};

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const exp = (mean) => -Math.log(1 - Math.random()) * mean;

const NO_PLAY = new Set(['hippoland']);

export class Life {
  constructor(A, locId) {
    this.A = A; this.cfg = AMB[locId] || {}; this.t = {};
    this.hornAng = Math.random() * Math.PI * 2; this.bellDist = rnd(150, 260);
    this.faunaT = 0; this.faunaSaid = new WeakMap();
  }

  // run `fn` every ~1/rate seconds on average; rate <= 0 idles
  every(key, dt, rate, fn) {
    const t = this.t[key] ?? (this.t[key] = rate > 0 ? exp(1 / rate) * Math.random() : 1);
    if (t > dt) { this.t[key] = t - dt; if (rate <= 0) this.t[key] = Math.min(this.t[key], 1); return; }
    if (rate > 0) { fn(); this.t[key] = exp(1 / rate) + 0.2; } else this.t[key] = 1;
  }

  // random spot around the listener (bearing optionally biased to the shore)
  around(S, dmin, dmax, shoreBias = 0) {
    let a = Math.random() * Math.PI * 2;
    if (shoreBias && Math.random() < shoreBias && S.shoreX !== undefined) a = Math.atan2(S.shoreZ, S.shoreX) + rnd(-0.9, 0.9);
    const d = rnd(dmin, dmax);
    return { x: S.cx + Math.cos(a) * d, z: S.cz + Math.sin(a) * d };
  }

  update(dt, S, g) {
    const A = this.A, cfg = this.cfg;
    const day = 1 - S.night, dim = (1 - 0.6 * S.fog) * (1 - 0.8 * S.rain), foot = S.foot;
    const dawnDusk = clamp(1 - Math.abs(((S.hour + 24 - 6) % 24) - 0) / 2.5, 0, 1) + clamp(1 - Math.abs(S.hour - 18.5) / 2.5, 0, 1);
    const near = S.shore ?? 0;

    // ---- the water itself
    const still = foot || S.speed < 1.5;
    const lapRate = (0.08 + 0.4 * S.waveH) * (still ? 1 : 0.4) * (foot ? (S.nearShore ? 1.3 : 0.3) : 1) * (S.atDock ? 1.5 : 1);
    this.every('lap', dt, lapRate, () => A.play('lap', clamp(0.3 + S.waveH * 0.6 + (S.atDock ? 0.2 : 0), 0.2, 1.3)));
    if (!foot && S.speed > 0.8) {
      const rate = clamp(S.speed * (0.12 + 0.55 * S.waveH) * 0.45, 0, 6);
      this.every('slap', dt, rate, () => A.play('hullSlap', clamp(S.speed / S.maxSpeed * (0.35 + S.waveH * 0.5) + Math.random() * 0.2, 0.1, 1)));
    } else if (!foot && S.waveH > 0.5) {
      this.every('slap', dt, (S.waveH - 0.4) * 0.8 * (S.anchored ? 1 : 0.6), () => A.play('hullSlap', 0.15 + S.waveH * 0.25));
    }
    if (cfg.surf) this.every('surf', dt, near * cfg.surf * 0.06 * (0.5 + 0.5 * Math.min(1.4, S.waveH + 0.3)), () => {
      A.play('surf', 0.5 + near * 0.6);   // centred: a random left/right bearing per crash sounded like static panning
    });
    // creaks and the bilge pump when it gets rough
    const sway = clamp(S.waveH * 0.6 + S.squall, 0, 1.4);
    if (!foot) {
      this.every('creak', dt, sway > 0.25 ? (sway - 0.2) * 0.7 : 0, () => A.play('creak', clamp(sway, 0.2, 1)));
      this.every('bilge', dt, sway > 0.55 && S.speed < 6 ? 0.015 : 0, () => A.play('bilge'));
    }

    // ---- animals and places
    const bird = dim * (foot ? 1.1 : 1);
    if (cfg.gulls) this.every('gull', dt, cfg.gulls * day * 0.075 * bird, () => { const p = this.around(S, 30, 220, 0.4); A.play('gull', 1, { x: p.x, z: p.z, ref: 10 }); });
    if (cfg.songbird) this.every('song', dt, cfg.songbird * (0.2 * day + 0.5 * clamp(dawnDusk, 0, 1)) * bird * near * 0.9, () => { const p = this.around(S, 20, 120, 0.9); A.play('songbird', 1, { x: p.x, z: p.z, ref: 6 }); });
    if (cfg.owl) this.every('owl', dt, cfg.owl * clamp((S.night - 0.4) / 0.5, 0, 1) * 0.035 * near * bird, () => { const p = this.around(S, 60, 220, 0.9); A.play('owl', 1, { x: p.x, z: p.z, ref: 12 }); });
    if (cfg.loon) this.every('loon', dt, cfg.loon * clamp(S.night * 0.7 + dawnDusk * 0.4, 0, 1) * 0.03 * bird, () => { const p = this.around(S, 120, 380, 0); A.play('loon', 1, { x: p.x, z: p.z, ref: 25 }); });
    if (cfg.frogs) this.every('frog', dt, (cfg.frogRate || 1) * (0.1 + 0.7 * S.night) * (0.5 + S.rain) * near * 1.3 * (1 - 0.5 * S.fog), () => {
      const p = this.around(S, 12, 70, 0.9);
      A.play(cfg.frogs === 'tree' ? 'frogTree' : 'frogBull', 1, { x: p.x, z: p.z, ref: 5 });
    });
    if (cfg.howler) this.every('howler', dt, cfg.howler * clamp(dawnDusk, 0, 1) * 0.04 * dim, () => { const p = this.around(S, 250, 600, 1); A.play('howler', 1, { x: p.x, z: p.z, ref: 40 }); });
    if (cfg.seals) this.every('seal', dt, cfg.seals * day * 0.04 * near, () => { const p = this.around(S, 60, 200, 1); A.play('seal', 1, { x: p.x, z: p.z, ref: 12 }); });
    if (cfg.traffic) this.every('truck', dt, cfg.traffic * 0.012 * (0.3 + day), () => { const p = this.around(S, 250, 600, 1); A.play('truck', 1, { x: p.x, z: p.z, ref: 50 }); });
    if (cfg.longtail) this.every('lt', dt, cfg.longtail * 0.014 * day, () => { const p = this.around(S, 200, 450, 0); A.play('distantEngine', 1, { x: p.x, z: p.z, ref: 40 }); });
    if (cfg.halyards && near > 0.05) this.every('hal', dt, cfg.halyards * (0.15 + 0.6 * clamp(S.wind / 10, 0, 1)) * clamp(1 - S.dockDist / 120, 0, 1), () => { A.play('halyard', 1, { x: S.dockX + rnd(-8, 8), z: S.dockZ + rnd(-8, 8), ref: 6 }); });
    if (cfg.clank) this.every('clank', dt, 0.05 * cfg.clank * clamp(1 - Math.hypot(S.px - 260, S.pz + 420) / 700, 0, 1), () => { A.play('clank', 1, { x: 260 + rnd(-12, 12), z: -420 + rnd(-12, 12), ref: 15 }); });
    // fog: the bell buoy rings as the swell moves it
    if (S.fog > 0.12) this.every('bell', dt, 0.18 + 0.2 * clamp(S.waveH, 0, 1), () => {
      const a = this.hornAng + 1.9;
      A.play('bell', 1, { x: S.cx + Math.cos(a) * this.bellDist, z: S.cz + Math.sin(a) * this.bellDist, ref: 20 });
    });

    // ---- wildlife that really is out there: calls come from the animals' own positions
    this.faunaT -= dt;
    if (this.faunaT <= 0 && S.fauna && S.fauna.length) {
      this.faunaT = 1.5;
      const list = S.fauna;
      const e = list[(Math.random() * list.length) | 0];
      if (e && !NO_PLAY.has(e.kind) && e.an?.root?.visible !== false) {
        const d = Math.hypot(e.x - S.cx, e.z - S.cz), kind = e.kind === 'hippoland' ? 'hippo' : e.kind;
        const last = this.faunaSaid.get(e) || -99, now = A.ctx.currentTime;
        const calls = { hippo: ['hippo', 130, 9], duck: ['duck', 70, 18], wolf: ['wolf', 380, 70] }[kind];
        if (calls && d < calls[1] && now - last > calls[2] * rnd(0.8, 1.6) && Math.random() < (kind === 'wolf' ? S.night * 0.9 + 0.1 : 1) * bird) {
          this.faunaSaid.set(e, now);
          A.play(calls[0], 1, { x: e.x, z: e.z, ref: kind === 'wolf' ? 20 : 8 });
        }
      }
    }
  }

}

import * as THREE from 'three';

// Low-poly building construction. A Mesher collects flat-shaded quads into material buckets
// ('tex:clap', 'glass', 'glow', 'sign', ...). UVs are in metres, so every texture tiles at real
// scale on any wall or roof. Everything is built in a local frame: +y up, +z is the front.
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _p = new THREE.Vector3();
const _col = new THREE.Color();

export class Mesher {
  constructor(rand, white) { this.rand = rand; this.white = white; this.b = new Map(); }

  bucket(key) {
    let b = this.b.get(key);
    if (!b) { b = { pos: [], uv: [], col: [] }; this.b.set(key, b); }
    return b;
  }

  // one triangle with metre UVs measured in the plane of (a, b, d); opt: { uo, vo, rect, jit }
  _tri(b, p0, p1, p2, f, col, opt) {
    const [o, e1, e2, uo, vo] = f;
    for (const p of [p0, p1, p2]) {
      b.pos.push(p[0], p[1], p[2]);
      _p.set(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
      const u = _p.dot(e1), v = _p.dot(e2);
      if (opt && opt.rect) {
        const R = opt.rect, tu = Math.max(0, Math.min(1, u / opt.su)), tv = Math.max(0, Math.min(1, v / opt.sv));
        b.uv.push(R.u0 + (R.u1 - R.u0) * tu, R.v0 + (R.v1 - R.v0) * tv);
      } else b.uv.push(u + uo, v + vo);
      b.col.push(col.r, col.g, col.b);
    }
  }

  _frame(a, b, d, opt) {
    _e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const l1 = _e1.length(); _e1.divideScalar(l1 || 1);
    _e2.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const l2 = _e2.length();
    _e2.addScaledVector(_e1, -_e2.dot(_e1)).normalize();
    if (opt && opt.rect) { opt.su = l1; opt.sv = l2; }
    return [a, _e1.clone(), _e2.clone(), opt && opt.uo !== undefined ? opt.uo : this.rand() * 4, opt && opt.vo !== undefined ? opt.vo : this.rand() * 4];
  }

  color(col, jit = 0.07) {
    _col.set(col);
    if (jit) { const k = 1 + (this.rand() - 0.5) * 2 * jit; _col.multiplyScalar(k); }
    return _col;
  }

  // a, b, c, d counter-clockwise seen from outside: u runs a->b, v runs a->d
  quad(key, a, b, c, d, col, opt) {
    const bk = this.bucket(key), cc = this.color(col, opt && opt.jit !== undefined ? opt.jit : 0.07);
    const f = this._frame(a, b, d, opt);
    this._tri(bk, a, b, c, f, cc, opt);
    this._tri(bk, a, c, d, f, cc, opt);
  }

  tri(key, a, b, c, col, opt) {
    const bk = this.bucket(key), cc = this.color(col, opt && opt.jit !== undefined ? opt.jit : 0.07);
    const f = this._frame(a, b, c, opt);
    this._tri(bk, a, b, c, f, cc, opt);
  }

  box(key, x0, x1, y0, y1, z0, z1, col, o = {}) {
    const q = (a, b, c, d, cc = col) => this.quad(key, a, b, c, d, cc, o.jit !== undefined ? { jit: o.jit } : undefined);
    const dk = o.sides || [1, 1, 1, 1, 1, 0];     // front back right left top bottom
    if (dk[0]) q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    if (dk[1]) q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    if (dk[2]) q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    if (dk[3]) q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    if (dk[4]) q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (dk[5]) q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  }

  // vertical cylinder as an n-gon prism (open top/bottom unless caps)
  prism(key, cx, cz, y0, y1, r0, r1, n, col, caps = true) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quad(key, [cx + c0 * r0, y0, cz + s0 * r0], [cx + c1 * r0, y0, cz + s1 * r0], [cx + c1 * r1, y1, cz + s1 * r1], [cx + c0 * r1, y1, cz + s0 * r1], col, { uo: i * (r0 * 6.28 / n) });
      if (caps && r1 > 0) this.tri(key, [cx, y1, cz], [cx + c0 * r1, y1, cz + s0 * r1], [cx + c1 * r1, y1, cz + s1 * r1], col);
    }
  }

  // a post / beam between two points (square section)
  beam(key, p0, p1, t, col) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], L = Math.hypot(dx, dy, dz) || 1;
    const dir = new THREE.Vector3(dx / L, dy / L, dz / L);
    const side = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const up = dir.clone().cross(side).normalize();
    const h = t / 2, s = side.clone().multiplyScalar(h), u = up.clone().multiplyScalar(h);
    const P = (base, sx, ux) => [base[0] + s.x * sx + u.x * ux, base[1] + s.y * sx + u.y * ux, base[2] + s.z * sx + u.z * ux];
    const A = [P(p0, -1, -1), P(p0, 1, -1), P(p0, 1, 1), P(p0, -1, 1)], B = [P(p1, -1, -1), P(p1, 1, -1), P(p1, 1, 1), P(p1, -1, 1)];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(key, A[i], A[j], B[j], B[i], col, { jit: 0.04 }); }
  }

  build(key) {
    const b = this.b.get(key);
    if (!b || !b.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

// ---- windows, doors -----------------------------------------------------------------------
const FACE = {
  front: { n: [0, 0, 1], t: [1, 0, 0] }, back: { n: [0, 0, -1], t: [-1, 0, 0] },
  right: { n: [1, 0, 0], t: [0, 0, -1] }, left: { n: [-1, 0, 0], t: [0, 0, 1] },
};
export function faceMap(w, d) {
  const make = (name, half) => {
    const F = FACE[name];
    return {
      name, len: name === 'front' || name === 'back' ? w : d,
      p: (s, y, off = 0) => [F.n[0] * (half + off) + F.t[0] * s, y, F.n[2] * (half + off) + F.t[2] * s],
    };
  };
  return { front: make('front', d / 2), back: make('back', d / 2), right: make('right', w / 2), left: make('left', w / 2) };
}

// axis-aligned slab given in face coordinates: s0..s1 along the face, y0..y1, off0..off1 out of the wall
function slab(M, F, key, s0, s1, y0, y1, o0, o1, col) {
  const A = F.p(s0, y0, o0), B = F.p(s1, y1, o1);
  M.box(key, Math.min(A[0], B[0]), Math.max(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[1], B[1]), Math.min(A[2], B[2]), Math.max(A[2], B[2]), col, { jit: 0.05, sides: [1, 1, 1, 1, 1, 0] });
}
const WARM = [[1.0, 0.74, 0.4], [1.0, 0.82, 0.55], [0.95, 0.9, 0.78], [1.0, 0.66, 0.3], [0.7, 0.85, 1.0]];

export function windowOn(M, F, s, y, ww, wh, o = {}) {
  const glassCol = o.dark || 0x151d24;
  const q = (key, off, inset, col, opt) => M.quad(key, F.p(s - ww / 2 + inset, y + inset, off), F.p(s + ww / 2 - inset, y + inset, off), F.p(s + ww / 2 - inset, y + wh - inset, off), F.p(s - ww / 2 + inset, y + wh - inset, off), col, opt);
  q('glass', 0.025, 0, glassCol, { jit: 0.2 });
  if (o.lit) {
    const w = WARM[Math.floor(M.rand() * (o.cool ? 5 : 4))], k = 0.8 + M.rand() * 0.5;
    // curtains: a darker band on one side now and then
    q('glow', 0.04, 0.03, new THREE.Color(w[0] * k, w[1] * k, w[2] * k), { jit: 0, rect: M.white, uo: 0, vo: 0 });
  }
  const fr = o.frame ?? 0xe6e2d6, bar = 0.07;
  slab(M, F, 'tex:wood', s - ww / 2 - bar, s - ww / 2, y - bar, y + wh + bar, 0, 0.06, fr);
  slab(M, F, 'tex:wood', s + ww / 2, s + ww / 2 + bar, y - bar, y + wh + bar, 0, 0.06, fr);
  slab(M, F, 'tex:wood', s - ww / 2, s + ww / 2, y + wh, y + wh + bar, 0, 0.06, fr);
  slab(M, F, 'tex:wood', s - ww / 2 - 0.1, s + ww / 2 + 0.1, y - bar - 0.04, y, 0, 0.12, fr);
  slab(M, F, 'tex:wood', s - 0.025, s + 0.025, y, y + wh, 0.02, 0.055, fr);                // mullion
  if (wh > 1.05) slab(M, F, 'tex:wood', s - ww / 2, s + ww / 2, y + wh * 0.5 - 0.02, y + wh * 0.5 + 0.02, 0.02, 0.055, fr);
  if (o.shutter) {
    slab(M, F, 'tex:wood', s - ww / 2 - bar - 0.42, s - ww / 2 - bar, y - 0.02, y + wh + 0.02, 0, 0.05, o.shutter);
    slab(M, F, 'tex:wood', s + ww / 2 + bar, s + ww / 2 + bar + 0.42, y - 0.02, y + wh + 0.02, 0, 0.05, o.shutter);
  }
}

export function doorOn(M, F, s, y, dw, dh, o = {}) {
  const col = o.color ?? 0x5a3a28, fr = o.frame ?? 0xe6e2d6, bar = 0.09;
  M.quad('tex:wood', F.p(s - dw / 2, y, 0.03), F.p(s + dw / 2, y, 0.03), F.p(s + dw / 2, y + dh, 0.03), F.p(s - dw / 2, y + dh, 0.03), col, { jit: 0.1 });
  if (o.glass) M.quad('glass', F.p(s - dw / 2 + 0.12, y + dh * 0.45, 0.05), F.p(s + dw / 2 - 0.12, y + dh * 0.45, 0.05), F.p(s + dw / 2 - 0.12, y + dh - 0.14, 0.05), F.p(s - dw / 2 + 0.12, y + dh - 0.14, 0.05), 0x151d24, { jit: 0.1 });
  if (o.lit) M.quad('glow', F.p(s - dw / 2 + 0.16, y + dh * 0.48, 0.06), F.p(s + dw / 2 - 0.16, y + dh * 0.48, 0.06), F.p(s + dw / 2 - 0.16, y + dh - 0.18, 0.06), F.p(s - dw / 2 + 0.16, y + dh - 0.18, 0.06), new THREE.Color(1.0, 0.74, 0.4), { jit: 0, rect: M.white, uo: 0, vo: 0 });
  slab(M, F, 'tex:wood', s - dw / 2 - bar, s - dw / 2, y, y + dh + bar, 0, 0.07, fr);
  slab(M, F, 'tex:wood', s + dw / 2, s + dw / 2 + bar, y, y + dh + bar, 0, 0.07, fr);
  slab(M, F, 'tex:wood', s - dw / 2 - bar, s + dw / 2 + bar, y + dh, y + dh + bar, 0, 0.07, fr);
  slab(M, F, 'metal', s + dw / 2 - 0.16, s + dw / 2 - 0.1, y + dh * 0.46, y + dh * 0.5, 0.03, 0.1, 0xb0a070);
}

// ---- the house ----------------------------------------------------------------------------
// o: { w, d, floors, fh, y0, wall:'clap', wcol, roof:'gable'|'hip'|'shed'|'flat'|'thatch', rtex, rcol, pitch, over,
//      found:1.5, ftex:'conc', fcol, piles:{depth}, porch, chimney, shutters, lit, trim, door, signs[], windows }
export function house(M, o) {
  const r = M.rand, w = o.w, d = o.d, fh = o.fh || 2.7, floors = o.floors || 1, h = fh * floors, y0 = o.y0 || 0;
  const hx = w / 2, hz = d / 2, F = faceMap(w, d), wt = `tex:${o.wall || 'clap'}`, trim = o.trim ?? 0xe8e4da;
  const lit = o.lit ?? 0.5;
  // base: stone/concrete plinth, or piles with a deck
  if (o.piles) {
    const depth = o.piles.depth || 3, nx = Math.max(2, Math.round(w / 2.4) + 1), nz = Math.max(2, Math.round(d / 2.4) + 1);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const px = -hx + 0.2 + (w - 0.4) * i / (nx - 1), pz = -hz + 0.2 + (d - 0.4) * k / (nz - 1);
      M.prism('tex:wood', px, pz, y0 - depth, y0 - 0.15, 0.15, 0.13, 6, 0x4a4234, false);
    }
    for (let i = 0; i < nx - 1; i++) {
      const px = -hx + 0.2 + (w - 0.4) * (i + 0.5) / (nx - 1);
      M.beam('tex:wood', [px - (w / nx) * 0.5, y0 - 0.9, hz - 0.2], [px + (w / nx) * 0.5, y0 - 2.2, hz - 0.2], 0.08, 0x4a4234);
    }
    M.box('tex:wood', -hx - 0.05, hx + 0.05, y0 - 0.2, y0, -hz - 0.05, hz + 0.05, 0x5c4a3a);
  } else if ((o.found ?? 1.2) > 0) {
    M.box(`tex:${o.ftex || 'conc'}`, -hx - 0.04, hx + 0.04, y0 - (o.found ?? 1.2), y0 + 0.08, -hz - 0.04, hz + 0.04, o.fcol ?? 0xb8b2a4, { sides: [1, 1, 1, 1, 0, 0] });
  }
  // walls, with a grimy splash band along the bottom
  const wc = new THREE.Color(o.wcol ?? 0xe4dfd0);
  const band = Math.min(0.5, h * 0.2), bandCol = wc.clone().multiplyScalar(0.74);
  const wallQ = (name, c0, c1) => {
    const f = F[name];
    const a = f.p(-f.len / 2, 0, 0), b = f.p(f.len / 2, 0, 0);
    const at = (p, y) => [p[0], y0 + y, p[2]];
    M.quad(wt, at(a, 0), at(b, 0), at(b, band), at(a, band), bandCol, { uo: 0, vo: 0 });
    M.quad(wt, at(a, band), at(b, band), at(b, h), at(a, h), wc, { uo: 0, vo: band });
  };
  for (const n of ['front', 'back', 'right', 'left']) wallQ(n);
  // corner boards and a belt course between floors
  if (o.wall === 'clap' || o.wall === 'batten') for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.box('tex:wood', sx * hx - 0.06 + (sx > 0 ? 0 : 0), sx * hx + 0.06, y0, y0 + h, sz * hz - 0.06, sz * hz + 0.06, trim, { jit: 0.04 });
  for (let f = 1; f < floors; f++) M.box('tex:wood', -hx - 0.06, hx + 0.06, y0 + fh * f - 0.07, y0 + fh * f + 0.07, -hz - 0.06, hz + 0.06, trim, { jit: 0.04, sides: [1, 1, 1, 1, 1, 1] });

  // roof
  const rt = `tex:${o.rtex || 'shingle'}`, rc = o.rcol ?? 0x5a5650, pitch = o.pitch ?? 0.5, over = o.over ?? 0.4, yE = y0 + h;
  const strips = (a, b, c, d2, n = 4) => {
    // slope quad cut into strips along its length, each toned a little differently (patchy weathering)
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      const col = new THREE.Color(rc).multiplyScalar(0.88 + r() * 0.24);
      if (r() < 0.12) col.lerp(new THREE.Color(0x4a5a30), 0.35);
      M.quad(rt, L(a, b, t0), L(a, b, t1), L(d2, c, t1), L(d2, c, t0), col, { uo: t0 * Math.hypot(b[0] - a[0], b[2] - a[2]), vo: 0, jit: 0 });
    }
  };
  const Z = hz + over, X = hx + over;
  const rise = Math.min(hx, hz) * pitch * (o.roof === 'thatch' ? 1.5 : 1);
  if (o.roof === 'flat') {
    M.box(`tex:${o.rtex || 'conc'}`, -hx - 0.1, hx + 0.1, yE, yE + 0.12, -hz - 0.1, hz + 0.1, rc);
    M.box(`tex:${o.ftex || 'conc'}`, -hx - 0.1, hx + 0.1, yE + 0.12, yE + 0.5, -hz - 0.1, -hz, o.fcol ?? wc);
    M.box(`tex:${o.ftex || 'conc'}`, -hx - 0.1, hx + 0.1, yE + 0.12, yE + 0.5, hz, hz + 0.1, o.fcol ?? wc);
    M.box(`tex:${o.ftex || 'conc'}`, -hx - 0.1, -hx, yE + 0.12, yE + 0.5, -hz, hz, o.fcol ?? wc);
    M.box(`tex:${o.ftex || 'conc'}`, hx, hx + 0.1, yE + 0.12, yE + 0.5, -hz, hz, o.fcol ?? wc);
  } else if (o.roof === 'shed') {
    const top = yE + (hz * 2) * pitch * 0.5;
    strips([-X, yE - 0.1, Z], [X, yE - 0.1, Z], [X, top, -Z], [-X, top, -Z], 4);
    M.quad(wt, [hx, yE, hz], [hx, yE, -hz], [hx, top - 0.2, -hz], [hx, yE + 0.05, hz], wc, { jit: 0.03 });
    M.quad(wt, [-hx, yE, -hz], [-hx, yE, hz], [-hx, yE + 0.05, hz], [-hx, top - 0.2, -hz], wc, { jit: 0.03 });
    M.quad(wt, [-hx, yE + 0.05, -hz], [hx, yE + 0.05, -hz], [hx, top - 0.2, -hz], [-hx, top - 0.2, -hz], wc, { jit: 0.03 });
  } else if (o.roof === 'hip' || o.roof === 'thatch') {
    const rx = Math.max(0, hx - hz) , yR = yE + rise;
    const Xo = hx + over, Zo = hz + over;
    strips([-Xo, yE - 0.12, Zo], [Xo, yE - 0.12, Zo], [rx, yR, 0], [-rx, yR, 0], 4);
    strips([Xo, yE - 0.12, -Zo], [-Xo, yE - 0.12, -Zo], [-rx, yR, 0], [rx, yR, 0], 4);
    M.quad(rt, [Xo, yE - 0.12, Zo], [Xo, yE - 0.12, -Zo], [rx, yR, 0], [rx, yR, 0.001], rc);
    M.quad(rt, [-Xo, yE - 0.12, -Zo], [-Xo, yE - 0.12, Zo], [-rx, yR, 0.001], [-rx, yR, 0], rc);
    M.box('tex:wood', -rx - 0.1, rx + 0.1, yR - 0.04, yR + 0.1, -0.06, 0.06, o.roof === 'thatch' ? 0x8a7a50 : rc);
  } else {
    // gable: slopes front/back, triangles filled with wall siding, ridge cap
    const yR = yE + rise;
    strips([-X, yE - 0.1, Z], [X, yE - 0.1, Z], [X, yR, 0], [-X, yR, 0], 5);
    strips([X, yE - 0.1, -Z], [-X, yE - 0.1, -Z], [-X, yR, 0], [X, yR, 0], 5);
    M.tri(wt, [hx, yE, hz], [hx, yE, -hz], [hx, yR - 0.02, 0], wc, { jit: 0.03 });
    M.tri(wt, [-hx, yE, -hz], [-hx, yE, hz], [-hx, yR - 0.02, 0], wc, { jit: 0.03 });
    // rake boards, fascia and ridge cap
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.beam('tex:wood', [sx * (hx + over * 0.9), yE - 0.1, sz * Z], [sx * (hx + over * 0.9), yR + 0.02, 0], 0.1, trim);
    M.box('tex:wood', -X, X, yE - 0.14, yE - 0.02, Z - 0.03, Z + 0.03, trim);
    M.box('tex:wood', -X, X, yE - 0.14, yE - 0.02, -Z - 0.03, -Z + 0.03, trim);
    M.box('tex:wood', -X, X, yR - 0.03, yR + 0.1, -0.09, 0.09, new THREE.Color(rc).multiplyScalar(0.8));
    o.ridgeY = yR;
    // an attic window in the front gable when there's room
    if (rise > 1.1 && o.attic !== false) windowOn(M, { p: (s, y, off) => [s, y, hz + off] }, 0, yE + 0.3, 0.7, 0.8, { lit: r() < lit, frame: trim });
  }
  // chimney
  if (o.chimney) {
    const cx = o.chimney.x ?? -hx * 0.55, cz = o.chimney.z ?? 0, top = (o.ridgeY || yE + 1) + 0.9;
    M.box(`tex:${o.chimney.tex || 'brick'}`, cx - 0.35, cx + 0.35, y0, top, cz - 0.3, cz + 0.3, o.chimney.col ?? 0xa86a50, { sides: [1, 1, 1, 1, 0, 0] });
    M.box('tex:conc', cx - 0.42, cx + 0.42, top, top + 0.1, cz - 0.37, cz + 0.37, 0x8a8880);
  }
  // windows
  const nWin = (len) => Math.max(1, Math.round(len / 2.5));
  const winCols = (len, door) => { const n = door ? Math.max(3, nWin(len) | 1) : nWin(len); return Array.from({ length: n }, (_, i) => (-len / 2 + (len * (i + 0.5)) / n)); };
  const ww = o.ww ?? 0.95, wh = o.wh ?? 1.25, sill = o.sill ?? 0.95;
  const shut = o.shutters;
  const doorS = o.doorS ?? 0;
  for (let f = 0; f < floors; f++) {
    const yy = y0 + fh * f + sill;
    const fs = winCols(w, true);
    for (const s of fs) {
      if (f === 0 && Math.abs(s - doorS) < 1.0) continue;
      windowOn(M, F.front, s, yy, ww, wh, { lit: r() < lit, frame: trim, shutter: shut });
    }
    if (f === 0) {
      doorOn(M, F.front, doorS, y0, 1.0, 2.1, { color: o.door ?? 0x6a2a22, frame: trim, glass: true, lit: r() < lit });
      o.doorWorld = [doorS, y0, hz];
    }
    for (const s of winCols(w, false)) if (r() < 0.8) windowOn(M, F.back, s, yy, ww, wh, { lit: r() < lit * 0.8, frame: trim });
    for (const s of winCols(d, false)) {
      if (r() < 0.85) windowOn(M, F.right, s, yy, ww, wh, { lit: r() < lit * 0.8, frame: trim });
      if (r() < 0.85) windowOn(M, F.left, s, yy, ww, wh, { lit: r() < lit * 0.8, frame: trim });
    }
  }
  // porch
  if (o.porch) {
    const pd = o.porch.d ?? 1.8, pw = Math.min(w - 0.4, o.porch.w ?? w * 0.7), ps = o.porch.s ?? doorS, ph = 2.4;
    const x0 = ps - pw / 2, x1 = ps + pw / 2;
    M.box('tex:wood', x0, x1, y0 - 0.14, y0 + 0.02, hz, hz + pd, 0x8a7860, { jit: 0.1 });
    for (const px of [x0 + 0.1, x1 - 0.1]) M.box('tex:wood', px - 0.08, px + 0.08, y0 + 0.02, y0 + ph, hz + pd - 0.2, hz + pd - 0.04, trim);
    M.quad(o.porch.roof ? `tex:${o.rtex || 'shingle'}` : 'tex:tin', [x0 - 0.15, y0 + ph, hz + pd + 0.2], [x1 + 0.15, y0 + ph, hz + pd + 0.2], [x1 + 0.15, y0 + ph + 0.6, hz], [x0 - 0.15, y0 + ph + 0.6, hz], rc, { jit: 0.05 });
    // steps down to the ground
    for (let k = 0; k < 3; k++) M.box('tex:wood', ps - 0.7, ps + 0.7, y0 - 0.14 - 0.2 * (k + 1) + 0.2, y0 - 0.14 - 0.2 * k, hz + pd + 0.28 * k, hz + pd + 0.28 * (k + 1), 0x8a7860, { jit: 0.1, sides: [1, 0, 1, 1, 1, 0] });
    if (o.porch.rail) for (const sx of [x0, x1]) M.box('tex:wood', sx - 0.04, sx + 0.04, y0 + 0.02, y0 + 0.95, hz + 0.1, hz + pd - 0.1, trim);
  }
  return o;
}

// ---- small props --------------------------------------------------------------------------
export function crate(M, x, y, z, s, col, yaw = 0) {
  const c = Math.cos(yaw), si = Math.sin(yaw), hx = s * 0.5, hz = s * 0.35;
  const P = (a, b, yy) => [x + a * c - b * si, yy, z + a * si + b * c];
  const face = (a0, b0, a1, b1) => M.quad('tex:wood', P(a0, b0, y), P(a1, b1, y), P(a1, b1, y + s * 0.5), P(a0, b0, y + s * 0.5), col, { jit: 0.12 });
  face(-hx, hz, hx, hz); face(hx, hz, hx, -hz); face(hx, -hz, -hx, -hz); face(-hx, -hz, -hx, hz);
  M.quad('tex:wood', P(-hx, hz, y + s * 0.5), P(hx, hz, y + s * 0.5), P(hx, -hz, y + s * 0.5), P(-hx, -hz, y + s * 0.5), col, { jit: 0.12 });
}
export function barrel(M, x, y, z, r, h, col) {
  M.prism('metal', x, z, y, y + h, r, r, 9, col, true);
  M.prism('metal', x, z, y + h * 0.3, y + h * 0.3 + 0.03, r + 0.012, r + 0.012, 9, 0x2a2a2a, false);
  M.prism('metal', x, z, y + h * 0.7, y + h * 0.7 + 0.03, r + 0.012, r + 0.012, 9, 0x2a2a2a, false);
}
// a crab / lobster pot: wire box on a wooden skid
export function pot(M, x, y, z, s, col, yaw = 0) {
  const c = Math.cos(yaw), si = Math.sin(yaw), P = (a, b, yy) => [x + a * c - b * si, yy, z + a * si + b * c], h = s * 0.55;
  const hx = s * 0.5, hz = s * 0.4;
  for (const [ax, az] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) M.beam('metal', P(ax, az, y), P(ax, az, y + h), 0.025, col);
  for (const yy of [y + 0.02, y + h]) { M.beam('metal', P(-hx, -hz, yy), P(hx, -hz, yy), 0.02, col); M.beam('metal', P(hx, -hz, yy), P(hx, hz, yy), 0.02, col); M.beam('metal', P(hx, hz, yy), P(-hx, hz, yy), 0.02, col); M.beam('metal', P(-hx, hz, yy), P(-hx, -hz, yy), 0.02, col); }
  M.quad('glass', P(-hx, hz, y + 0.05), P(hx, hz, y + 0.05), P(hx, hz, y + h), P(-hx, hz, y + h), 0x1c2420, { jit: 0.3 });
}

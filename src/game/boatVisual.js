import * as THREE from 'three';
import { PALETTES, SLOTS, finalName } from './boatCustom.js';

// Applies a boat's customization to its loaded GLB at runtime: tints named materials, paints the name on the
// transom and the registration on the bow (canvas textures raycast onto the real hull) and adds the visible
// upgrade parts procedurally. Nothing here changes the GLBs. Model space: x bow, y up (keel = 0), z starboard.

// hull recipes from tools/blender/build_boats.py (Blender y = -three z)
const SPEC = {
  bass: { length: 6.2, beam: 2.35, depth: 0.78, deadrise: 22, transom: 0.88, bowPow: 1.6, bowRise: 0.5, sheer: 0.12, flare: 0.04, deckDrop: 0.18 },
  skiff: { length: 5.6, beam: 2.1, depth: 0.62, deadrise: 10, transom: 0.9, bowPow: 1.7, bowRise: 0.45, sheer: 0.14, flare: 0.05, deckDrop: 0.2 },
  center: { length: 8.6, beam: 2.8, depth: 1.35, deadrise: 24, transom: 0.86, bowPow: 1.7, bowRise: 0.5, sheer: 0.16, flare: 0.06, deckDrop: 0.75 },
  sport: { length: 14.0, beam: 4.6, depth: 2.5, deadrise: 17, transom: 0.9, bowPow: 1.6, bowRise: 0.45, sheer: 0.2, flare: 0.07, deckDrop: 0.95 },
  trawler: { length: 20.0, beam: 6.4, depth: 3.4, deadrise: 14, transom: 0.82, bowPow: 1.5, bowRise: 0.4, sheer: 0.24, flare: 0.08, deckDrop: 1.1 },
  seiner: { length: 26.0, beam: 8.0, depth: 3.9, deadrise: 12, transom: 0.8, bowPow: 1.4, bowRise: 0.4, sheer: 0.26, flare: 0.08, deckDrop: 1.2 },
  jon: { length: 3.8, beam: 1.72, depth: 0.55, sheer: 0.2, deckDrop: 0.42, jon: true },
  // hand-lofted hulls: tools/blender/boats_kayak.py and boats_pontoon.py
  kayak: { length: 3.66, beam: 0.9, depth: 0.5, sheer: 0, deckDrop: 0.16, fn: (x) => {
    const L = 3.66, u = Math.min(1, Math.abs(2 * (x + L / 2) / L - 1)), zd = 0.285 + 0.17 * Math.pow(u, 2.6) + 0.033;
    return { half: 0.45 * Math.pow(Math.max(0.04, 1 - Math.pow(u, 2.3)), 0.55), sheer: zd, floor: zd };
  } },
  pontoon: { length: 6.9, beam: 2.6, depth: 1.2, sheer: 0, deckDrop: 0.5, fn: (x) => ({ half: x <= 2.55 ? 1.2 : 1.2 * Math.sqrt(Math.max(0.01, 1 - Math.pow((x - 2.55) / 0.8, 2))), sheer: 1.2, floor: 0.7 }) },
  bay: { length: 6.9, beam: 2.5, depth: 0.92, deadrise: 15, transom: 0.9, bowPow: 1.7, bowRise: 0.55, sheer: 0.16, flare: 0.09, deckDrop: 0.5 },
  yacht: { length: 18.4, beam: 5.5, depth: 2.35, deadrise: 21, transom: 0.88, bowPow: 1.5, bowRise: 0.52, sheer: 0.22, flare: 0.11, deckDrop: 0.82 },
};
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// top half-width, sheer height and deck-floor height at model x
export function hullAt(id, x) {
  const sp = SPEC[id], t = Math.min(1, Math.max(0, (x + sp.length / 2) / sp.length));
  if (sp.fn) return sp.fn(x);
  if (sp.jon) {
    const B = sp.beam / 2;
    const w = t < 0.5 ? B * (0.93 + 0.07 * Math.sin(t / 0.5 * Math.PI / 2)) : B * (0.05 + 0.95 * Math.pow(1 - Math.pow((t - 0.5) / 0.5, 1.6), 0.85));
    const zs = sp.depth * (1 + sp.sheer * Math.pow(sm(0.35, 1, t), 1.5));
    return { half: w, sheer: zs, floor: zs - sp.deckDrop };
  }
  const B = sp.beam / 2, tw = sp.transom;
  let b;
  if (t < 0.55) b = tw + (1 - tw) * Math.sin(t / 0.55 * Math.PI / 2);
  else b = Math.max(0.02, Math.pow(1 - Math.pow((t - 0.55) / 0.45, sp.bowPow), 0.62));
  b *= B;
  const sheer = sp.depth * (1 + sp.sheer * Math.pow(sm(0.35, 1, t), 1.5));
  return { half: b * (1 + sp.flare), sheer, floor: sheer - sp.deckDrop * (1 - 0.6 * sm(0.75, 1, t)) };
}

const hex = (c) => new THREE.Color(c);
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const pal = (slot, id) => PALETTES[slot].find((p) => p.id === id)?.hex;

// ---- lettering ----
function textTexture(text, font, fill, edge, px = 120) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `${font.replace('{px}', px)}`;
  const w = Math.max(40, Math.ceil(x.measureText(text).width) + px * 0.5), h = Math.ceil(px * 1.3);
  c.width = w; c.height = h;
  x.font = font.replace('{px}', px);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  if (edge) { x.strokeStyle = edge; x.lineWidth = px * 0.09; x.strokeText(text, w / 2, h / 2 + px * 0.03); }
  x.fillStyle = fill; x.fillText(text, w / 2, h / 2 + px * 0.03);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, aspect: w / h };
}

// where the name goes: transom height fraction of depth, centre offset (fraction of half width), width cap (m), letter height (m)
const NAME_AT = {
  jon: { h: 0.62, z: 0.5, maxW: 0.42, H: 0.07 }, bass: { h: 0.78, z: 0.55, maxW: 0.9, H: 0.15 }, skiff: { h: 0.78, z: 0.5, maxW: 0.9, H: 0.14 },
  center: { side: true, x: -0.3, h: 0.8, maxW: 1.9, H: 0.17 }, sport: { h: 0.8, z: 0, maxW: 3.1, H: 0.34 }, trawler: { h: 0.8, z: 0, maxW: 4.4, H: 0.42 }, seiner: { h: 0.8, z: 0, maxW: 5.4, H: 0.5 },
  kayak: { side: true, x: -0.17, h: 0.56, maxW: 0.55, H: 0.05 }, pontoon: { h: 0.75, z: 0, maxW: 1.7, H: 0.16 },
  bay: { side: true, x: -0.3, h: 0.8, maxW: 1.7, H: 0.15 }, yacht: { side: true, x: -0.24, h: 0.68, maxW: 3.4, H: 0.36 },
};

const _ray = new THREE.Raycaster();
function hullHit(model, hullMeshes, o, d) {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const nm = new THREE.Matrix3().getNormalMatrix(inv);
  _ray.set(o.clone().applyMatrix4(model.matrixWorld), d.clone().transformDirection(model.matrixWorld));
  const hit = _ray.intersectObjects(hullMeshes, false)[0];
  if (!hit) return null;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).applyNormalMatrix(nm).normalize();
  return { p: hit.point.clone().applyMatrix4(inv), n };
}

function placeDecal(group, model, meshes, o, d, tex, aspect, H, maxW, mats, opacity, patch) {
  const hit = hullHit(model, meshes, o, d);
  if (!hit) return null;
  let h = H, w = H * aspect;
  if (w > maxW) { w = maxW; h = w / aspect; }
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity, roughness: 0.6, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  patch?.(m);
  mats.push(m);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.copy(hit.p).addScaledVector(hit.n, 0.006);
  mesh.up.set(0, 1, 0);
  mesh.lookAt(mesh.position.clone().add(hit.n));
  mesh.renderOrder = 3;
  mesh.name = 'decal';
  group.add(mesh);
  return mesh;
}

function glowMat(color, base, glow) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, emissive: glow, emissiveIntensity: 0 });
  return { m, base };
}

// ---- main entry ----
export function applyCustom(model, id, cfg, up, opts = {}) {
  const patch = opts.patch;
  const old = model.getObjectByName('cust');
  if (old) { model.remove(old); old.traverse((o) => { o.geometry?.dispose(); if (o.material) { (o.material.map)?.dispose(); o.material.dispose?.(); } }); }

  // 1. paint: restore stock, then tint. Stock values are remembered on first touch.
  const byName = {};
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (!m.userData.base) m.userData.base = { color: m.color.getHex(), metal: m.metalness, rough: m.roughness };
    (byName[m.name] ||= []).push(m);
    if (o.name.includes('cowl') && !o.userData.baseScale) o.userData.baseScale = o.scale.clone();
    if (o.userData.baseScale) o.scale.copy(o.userData.baseScale);
  });
  for (const list of Object.values(byName)) for (const m of list) { const b = m.userData.base; m.color.setHex(b.color); m.metalness = b.metal; m.roughness = b.rough; }
  const wear = (cfg.wear || 0) / 3, grime = new THREE.Color(0x6e6a5c);
  const slots = SLOTS[id];
  const hullColor = new THREE.Color(cfg.hull ? pal('hull', cfg.hull) : 0xffffff);
  for (const slot of Object.keys(slots)) {
    const choice = cfg[slot], h = choice && pal(slot, choice);
    for (const name of slots[slot]) for (const m of byName[name] || []) {
      if (h != null) m.color.set(h);
      if (wear > 0) {
        const l = lum(m.color);
        m.color.lerp(grime.clone().multiplyScalar(0.35 + l * 1.1), 0.34 * wear).multiplyScalar(1 - 0.12 * wear);
        m.roughness = Math.min(1, m.roughness + 0.32 * wear);
        m.metalness *= 1 - 0.45 * wear;
      }
    }
  }
  const nameMats = byName[slots.hull[0]];  // lettering contrast follows the hull paint
  const hullLum = lum((nameMats && nameMats[0]) ? nameMats[0].color : hullColor);

  const group = new THREE.Group();
  group.name = 'cust';
  model.add(group);
  const sp = SPEC[id], L = sp.length, mats = [], geos = [];
  const fx = { group, glow: [], spot: null, anchorStow: null, chain: null, setAnchor() {}, dispose() {} };
  const tex = [];

  // 2. lettering, raycast onto the hull
  const hullMeshes = [];
  model.traverse((o) => { if (o.isMesh && (o.name.startsWith('hull') || o.parent?.name?.startsWith('hull'))) hullMeshes.push(o); });
  if (hullMeshes.length) {
    const dark = hullLum > 0.12;
    const ink = dark ? '#16222f' : '#efe7cf', edge = dark ? null : 'rgba(0,0,0,0.25)';
    const opacity = 1 - 0.14 * wear;
    const nm = finalName(cfg.name, id), na = NAME_AT[id];
    const nt = textTexture(nm, 'italic 700 {px}px Georgia, "Times New Roman", serif', dark ? '#1c2a38' : '#f1ead2', edge);
    tex.push(nt.tex);
    // transom: ray from astern along +x
    if (na.side) {      // twin outboards fill the transom: lettering goes on both quarters instead
      const nx = L * na.x, nh = hullAt(id, nx);
      for (const s2 of [1, -1]) placeDecal(group, model, hullMeshes, new THREE.Vector3(nx, sp.depth * na.h, s2 * (nh.half + 2)), new THREE.Vector3(0, 0, -s2), nt.tex, nt.aspect, na.H, na.maxW, mats, opacity, patch);
    } else placeDecal(group, model, hullMeshes, new THREE.Vector3(-L / 2 - 2, sp.depth * na.h, na.z * hullAt(id, -L / 2 + 0.05).half), new THREE.Vector3(1, 0, 0), nt.tex, nt.aspect, na.H, na.maxW, mats, opacity, patch);
    // bow: registration, both sides, reading from the bow end
    const rt = textTexture(cfg.reg || 'RW 0000', '800 {px}px "Arial Black", Impact, Arial, sans-serif', dark ? '#16222f' : '#f4f1e6', edge, 110);
    tex.push(rt.tex);
    const bx = L * (id === 'jon' ? 0.1 : 0.12), hb = hullAt(id, bx), H = Math.max(0.08, Math.min(0.5, sp.depth * 0.15));
    const rz = hb.sheer - Math.max(H * 1.5, sp.depth * 0.27);
    for (const s of [1, -1]) placeDecal(group, model, hullMeshes, new THREE.Vector3(bx, rz, s * (hb.half + 2)), new THREE.Vector3(0, 0, -s), rt.tex, rt.aspect, H, L * 0.34, mats, opacity, patch);
  }

  // 3. upgrade parts
  const s = Math.max(0.5, Math.min(1.6, L / 8.6));
  const std = (color, metal = 0, rough = 0.5) => { const m = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }); patch?.(m); mats.push(m); return m; };
  const steel = std(0xb4bbc2, 0.9, 0.3), black = std(0x1a1b1d, 0.2, 0.5), white = std(0xeeeeea, 0.1, 0.4);
  const add = (geo, mat, pos, rot, parent = group) => { const mesh = new THREE.Mesh(geo, mat); geos.push(geo); mesh.position.copy(pos); if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]); parent.add(mesh); return mesh; };
  const cyl = (r, len, mat, pos, rot, parent) => add(new THREE.CylinderGeometry(r, r, len, 12), mat, pos, rot, parent);
  const box = (w, h, d, mat, pos, rot, parent) => add(new THREE.BoxGeometry(w, h, d), mat, pos, rot, parent);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rail = (x, side, inset = 0.03) => { const a = hullAt(id, x); return V(x, a.sheer, side * (a.half - inset)); };
  const eyeX = { jon: -0.9, bass: 2.0, skiff: 1.6, center: -2.6, sport: -4.6, trawler: -3, seiner: 0.5, kayak: -0.12, pontoon: 0.45, bay: -1.6, yacht: -6.6 }[id];
  const has = (k) => up[k] || 0;

  if (has('gps') >= 1) {          // GPS dome on a post
    const p = rail(-L * 0.2, 1, 0.1 * s);
    cyl(0.012 * s, 0.3 * s, steel, p.clone().add(V(0, 0.15 * s, 0)));
    add(new THREE.SphereGeometry(0.055 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, p.clone().add(V(0, 0.3 * s, 0)));
  }
  if (has('gps') >= 2) {          // VHF whip
    const p = rail(-L * 0.2, -1, 0.1 * s);
    cyl(0.03 * s, 0.07 * s, black, p.clone().add(V(0, 0.035 * s, 0)));
    cyl(0.006 * s, 1.2 * Math.max(0.7, s), white, p.clone().add(V(0, 0.07 * s + 0.6 * Math.max(0.7, s), 0)));
  }
  if (has('sonar') >= 2) {        // fish-finder head on a pedestal
    const a = hullAt(id, -L * 0.05), g = new THREE.Group();
    g.position.set(-L * 0.05, a.floor, a.half * 0.62);
    g.rotation.y = eyeX < -L * 0.05 ? -Math.PI / 2 : Math.PI / 2;
    group.add(g);
    cyl(0.018 * s, 0.5 * s, steel, V(0, 0.25 * s, 0), null, g);
    box(0.06 * s, 0.03 * s, 0.06 * s, black, V(0, 0.5 * s, 0), null, g);
    const c = document.createElement('canvas'); c.width = 128; c.height = 80;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 80); gr.addColorStop(0, '#0f4a72'); gr.addColorStop(1, '#04121c');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 80);
    x.fillStyle = '#e8b030'; for (let i = 0; i < 128; i++) x.fillRect(i, 55 + Math.sin(i / 9) * 5, 1, 3);
    x.fillStyle = '#c84020'; for (let i = 0; i < 128; i++) x.fillRect(i, 58 + Math.sin(i / 9) * 5, 1, 7);
    x.fillStyle = '#ffe060'; for (const [ax, ay] of [[30, 24], [58, 36], [88, 20], [104, 40]]) { x.fillRect(ax - 4, ay, 9, 2); x.fillRect(ax - 2, ay - 2, 5, 2); }
    const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace; tex.push(st);
    const sc = new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.55, roughness: 0.3 });
    patch?.(sc); mats.push(sc);
    box(0.34 * s, 0.24 * s, 0.045 * s, black, V(0.0, 0.62 * s, 0), [0, 0, 0], g);
    add(new THREE.PlaneGeometry(0.29 * s, 0.19 * s), sc, V(0, 0.62 * s, 0.024 * s), null, g);
  }
  if (has('holders') >= 1) {      // flush gunwale rod holders, angled out and aft
    const xs = has('holders') >= 2 ? [-L * 0.3, -L * 0.14] : [-L * 0.3];
    for (const x0 of xs) for (const side of [1, -1]) {
      const p = rail(x0, side, 0.07 * s), g = new THREE.Group(); g.position.copy(p); group.add(g);
      g.rotation.set(-side * 0.38, 0, 0.25);
      const len = 0.3 * Math.max(0.7, Math.min(1.3, s));
      cyl(0.03 * s, len, black, V(0, len * 0.4, 0), null, g);
      cyl(0.04 * s, 0.03, steel, V(0, len * 0.9, 0), null, g);
      cyl(0.045 * s, 0.025, steel, V(0, 0.0, 0), null, g);
    }
  }
  if (has('livewell') >= 1) {     // hatch box on the aft deck
    const t = has('livewell'), x0 = -L * 0.34, a = hullAt(id, x0);
    const w = (t >= 2 ? 0.72 : 0.5) * s, d = (t >= 2 ? 0.55 : 0.42) * s, hgt = 0.2 * s;
    const g = new THREE.Group(); g.position.set(x0, a.floor, a.half * 0.5); group.add(g);
    box(w, hgt, d, std(0x3c4a52, 0.1, 0.6), V(0, hgt / 2, 0), null, g);
    box(w * 1.02, 0.035 * s, d * 1.02, std(0xc9d4d8, 0.05, 0.35), V(0, hgt + 0.018 * s, 0), null, g);
    cyl(0.03 * s, 0.02, black, V(w * 0.3, hgt + 0.045 * s, 0), null, g);
    box(0.07 * s, 0.025 * s, 0.03 * s, steel, V(-w * 0.3, hgt + 0.045 * s, 0), null, g);
    if (t >= 2) box(0.16 * s, 0.1 * s, 0.025 * s, std(0x1a6d8c, 0.1, 0.4), V(0, hgt * 0.5, d / 2 + 0.01), null, g);
  }
  if (has('shade')) {             // bimini over the aft cockpit
    const span = { jon: [-1.55, 0.15], bass: [-2.75, -0.9], skiff: [-2.45, -0.85], pontoon: [-2.9, 1.0] }[id] || [-L * 0.3, -L * 0.1];
    const aMid = hullAt(id, (span[0] + span[1]) / 2), top = aMid.floor + 2.12, wid = aMid.half * 0.9;
    const canopy = new THREE.MeshStandardMaterial({ color: pal('canopy', cfg.canopy) ?? 0x1c2a4a, roughness: 0.92, side: THREE.DoubleSide });
    patch?.(canopy); mats.push(canopy);
    const geo = new THREE.PlaneGeometry(span[1] - span[0], wid * 2, 10, 8);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const zz = pos.getZ(i) / wid, xx = pos.getX(i) / ((span[1] - span[0]) / 2); pos.setY(i, 0.14 * (1 - zz * zz) - 0.03 * xx * xx); }
    geo.computeVertexNormals(); geos.push(geo);
    const cm = new THREE.Mesh(geo, canopy); cm.position.set((span[0] + span[1]) / 2, top, 0); group.add(cm);
    const tube = std(0xb0b7bd, 0.9, 0.3);
    for (const x0 of span) for (const side of [1, -1]) {
      const a = rail(x0, side, 0.05), b = V(x0, top - 0.02, side * wid * 0.9);
      const dir = b.clone().sub(a), len = dir.length(), mid = a.clone().add(b).multiplyScalar(0.5);
      const m = cyl(0.014, len, tube, mid);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    }
    // cross bows
    for (const x0 of span) cyl(0.012, wid * 1.8, tube, V(x0, top - 0.02, 0), [Math.PI / 2, 0, 0]);
  }
  if (has('lights') >= 1) {       // red / green bow lights
    const x0 = L * 0.34;
    for (const [side, col, gl] of [[1, 0x1f9c4a, 0x28ff70], [-1, 0xc82828, 0xff3030]]) {
      const p = rail(x0, side, 0.04 * s);
      box(0.06 * s, 0.045 * s, 0.07 * s, black, p.clone().add(V(0, 0.03 * s, side * -0.01)));
      const g = glowMat(col, 0.0, gl); patch?.(g.m); mats.push(g.m);
      const lens = add(new THREE.SphereGeometry(0.028 * s, 10, 8), g.m, p.clone().add(V(0.03 * s, 0.035 * s, side * 0.02 * s)));
      lens.scale.set(1.2, 1, 1);
      fx.glow.push({ m: g.m, k: 3.2 });
    }
  }
  if (has('lights') >= 2) {       // bow spotlight
    const x0 = L * 0.4, a = hullAt(id, x0), g = new THREE.Group();
    g.position.set(x0, a.floor + 0.06 * s, 0); group.add(g);
    cyl(0.012 * s, 0.14 * s, steel, V(0, 0.07 * s, 0), null, g);
    const head = new THREE.Group(); head.position.set(0, 0.16 * s, 0); head.rotation.z = -0.12; g.add(head);
    cyl(0.055 * s, 0.13 * s, black, V(0, 0, 0), [0, 0, Math.PI / 2], head);
    const gm = glowMat(0xf6f2e4, 0, 0xfff4d8); patch?.(gm.m); mats.push(gm.m);
    const lens = add(new THREE.CircleGeometry(0.045 * s, 14), gm.m, V(0.067 * s, 0, 0), null, head);
    lens.rotation.y = Math.PI / 2;
    fx.glow.push({ m: gm.m, k: 5 });
    fx.spot = head;
  }
  if (has('winch') >= 1) {        // windlass + anchor on the bow
    const t = has('winch'), x0 = L * 0.36, a = hullAt(id, x0), g = new THREE.Group();
    g.position.set(x0, a.floor, 0); group.add(g);
    const body = std(t >= 2 ? 0x2c3238 : 0x53595e, 0.6, 0.45);
    box(0.2 * s * (t >= 2 ? 1.3 : 1), 0.1 * s, 0.16 * s, body, V(0, 0.05 * s, 0), null, g);
    cyl(0.05 * s, 0.24 * s * (t >= 2 ? 1.2 : 1), steel, V(0, 0.12 * s, 0), [Math.PI / 2, 0, 0], g);
    if (t >= 2) box(0.12 * s, 0.1 * s, 0.1 * s, black, V(-0.12 * s, 0.05 * s, 0), null, g);
    const anchor = new THREE.Group(); anchor.position.set(L * 0.1, 0.06 * s, 0); g.add(anchor);
    box(0.5 * s, 0.025 * s, 0.03 * s, steel, V(0, 0, 0), null, anchor);                 // shank
    box(0.03 * s, 0.03 * s, 0.2 * s, steel, V(-0.2 * s, 0.01 * s, 0), null, anchor);    // stock
    for (const side of [1, -1]) box(0.16 * s, 0.015 * s, 0.1 * s, steel, V(0.18 * s, -0.01 * s, side * 0.07 * s), [side * 0.45, 0, 0], anchor);
    fx.anchorStow = anchor;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 1, 6), std(0x30343a, 0.7, 0.6));
    chain.visible = false; geos.push(chain.geometry); fx.chain = chain;
    const bow = rail(L * 0.47, 1, 0); chain.userData.top = V(L * 0.47, hullAt(id, L * 0.47).floor + 0.05, 0);
    group.add(chain);
    fx.setAnchor = (depth) => {
      const down = depth != null;
      anchor.visible = !down; chain.visible = down;
      if (down) {
        const len = Math.max(1, Math.min(depth, 8));
        chain.scale.set(1, len, 1);
        chain.position.copy(chain.userData.top).add(V(-len * 0.12, -len / 2, 0));
        chain.rotation.z = 0.24;
      }
    };
  }
  // bigger cowls on the outboards
  const eng = has('engine');
  if (eng) model.traverse((o) => { if (o.isMesh && o.name.includes('cowl') && o.userData.baseScale) o.scale.copy(o.userData.baseScale).multiplyScalar(1 + 0.04 * eng); });

  fx.dispose = () => { mats.forEach((m) => m.dispose()); geos.forEach((g) => g.dispose()); tex.forEach((t) => t.dispose()); };
  return fx;
}

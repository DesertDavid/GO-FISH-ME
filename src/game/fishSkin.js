import * as THREE from 'three';

// Fish skin painter. Texture u runs head (0) -> tail (1); v runs top (0) -> belly (0.5) -> top (1),
// so each flank is one half and patterns are drawn once and mirrored.
const W = 1024, H = 512;   // pattern sizes below are written for 512 wide and scaled by W / 512

const C = (hex) => new THREE.Color(hex);
const mix = (a, b, t) => C(a).lerp(C(b), t).getHex();
const css = (hex, a = 1) => {
  const c = C(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};
const darken = (hex, k) => mix(hex, 0x000000, k);
const lighten = (hex, k) => mix(hex, 0xffffff, k);
const tint = (hex, to, k) => {
  const c = C(hex), lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  return C(to).multiplyScalar(0.4 + lum * 1.2).lerp(c, 1 - k).getHex();
};

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

export function morphLook(sp, morph) {
  let [back, side, belly, fin] = sp.colors;
  const look = {
    back, side, belly, fin, iris: 0xc8a040, pupil: 0x050505, metal: sp.metal || 0.1,
    pattern: sp.pattern, patternAlpha: 1, ghost: false, overlays: [],
  };
  const set = (b, s, be, f) => Object.assign(look, { back: b, side: s, belly: be, fin: f });
  switch (morph.id) {
    case 'golden': set(0xb88a18, 0xf0c040, 0xfff0b0, 0xe0a020); look.patternAlpha = 0.3; look.metal = 0.6; break;
    case 'albino': set(0xf0e2da, 0xfff2ee, 0xffffff, 0xf8c8c0); look.patternAlpha = 0.07; look.iris = 0xf0a0a0; look.pupil = 0xd01818; break;
    case 'leucistic': set(lighten(back, 0.72), lighten(side, 0.72), 0xffffff, lighten(fin, 0.6)); look.patternAlpha = 0.18; break;
    case 'melanistic': set(darken(back, 0.8), darken(side, 0.75), darken(belly, 0.55), darken(fin, 0.75)); look.patternAlpha = 0.25; break;
    case 'piebald': look.overlays.push(['patches', 0xffffff, 0.95]); break;
    case 'calico': look.overlays.push(['patches', 0xe86a18, 0.9], ['patches', 0x111111, 0.85]); break;
    case 'blue': set(0x16357e, 0x4a7ac0, 0xd0e0f8, 0x2a5aa8); look.patternAlpha = 0.5; break;
    case 'ghost': set(lighten(back, 0.6), 0xe8eef2, 0xffffff, 0xe0e8ee); look.patternAlpha = 0.25; look.ghost = true; look.metal = 0.9; break;
    case 'copper': set(tint(back, 0xb86a30, 0.8), tint(side, 0xd88a48, 0.8), tint(belly, 0xf0c8a0, 0.6), tint(fin, 0xb86a30, 0.8)); look.metal = 0.7; break;
    case 'tiger': look.overlays.push(['tigerbars', darken(back, 0.6), 0.75]); break;
    case 'spotted': look.overlays.push(['leopard', 0x161208, 0.85]); break;
    case 'rose': set(tint(back, 0xd04a7a, 0.7), tint(side, 0xf08aa8, 0.75), 0xffe8f0, tint(fin, 0xe06a90, 0.7)); break;
    case 'emerald': set(0x0a5a30, 0x1a9a5a, 0xc8f0d8, 0x0e7a44); look.patternAlpha = 0.5; look.metal = 0.5; break;
    case 'chrome': set(0x8a929a, 0xdfe5ea, 0xffffff, 0xb0b8c0); look.patternAlpha = 0.25; look.metal = 1; break;
    case 'sunset': set(0x5a1a6a, 0xf06020, 0xffd040, 0xe04a40); look.patternAlpha = 0.45; break;
    default: break;
  }
  return look;
}

// Draw into one flank: x 0..1 head->tail, y 0..1 top->belly; mirrored onto the other flank.
function flank(ctx, draw) {
  for (const mirror of [false, true]) {
    ctx.save();
    if (mirror) ctx.setTransform(W, 0, 0, -H / 2, 0, H);
    else ctx.setTransform(W, 0, 0, H / 2, 0, 0);
    draw();
    ctx.restore();
  }
}

function patternDraw(ctx, name, color, alpha, aspect, rand, sp) {
  const dot = (x, y, r) => { r *= W / 512; ctx.beginPath(); ctx.ellipse(x, y, r / W, (r / (H / 2)) / aspect, 0, 0, Math.PI * 2); ctx.fill(); };
  const fill = (c, a) => { ctx.fillStyle = css(c, a * alpha); ctx.strokeStyle = css(c, a * alpha); };
  switch (name) {
    case 'bars': case 'faintbars': case 'redbars': case 'calicobars': {
      const n = name === 'redbars' ? 3 : 6 + Math.floor(rand() * 3);
      fill(name === 'redbars' ? 0xc02a2a : name === 'calicobars' ? 0x6a2a50 : color, name === 'faintbars' ? 0.35 : 0.6);
      // real bars are never on a ruler: uneven gaps, uneven widths, each one leaning a
      // little differently, now and then one that forks, fades or is missing
      let x = 0.17 + rand() * 0.03;
      const step = 0.68 / n;
      for (let i = 0; i < n; i++) {
        x += step * (0.6 + rand() * 0.8);
        if (rand() < 0.07) continue;
        const w = 0.02 + rand() * 0.03, lean = 0.01 + rand() * 0.03, bot = 0.58 + rand() * 0.14;
        ctx.globalAlpha = 0.55 + rand() * 0.45;
        ctx.beginPath(); ctx.moveTo(x, 0.05); ctx.lineTo(x + w, 0.05); ctx.lineTo(x + w * (1.1 + rand() * 0.6) + lean, bot); ctx.lineTo(x + lean, bot); ctx.fill();
        if (rand() < 0.15) { ctx.beginPath(); ctx.moveTo(x + w * 0.5, 0.3); ctx.lineTo(x + w * 1.2, 0.3); ctx.lineTo(x + w * 2.4 + lean, bot - 0.08); ctx.lineTo(x + w * 1.4 + lean, bot - 0.08); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'tigerbars': {
      fill(color, 0.55);
      for (let i = 0; i < 14; i++) {
        const x = 0.15 + (i / 14) * 0.75 + (rand() - 0.5) * 0.03, ph = rand() * 6, amp = 0.008 + rand() * 0.014, end = 0.55 + rand() * 0.22;
        ctx.beginPath(); ctx.moveTo(x, 0.05);
        for (let y = 0.05; y < end; y += 0.05) ctx.lineTo(x + Math.sin(y * 14 + ph) * amp + y * 0.03, y);
        ctx.lineWidth = 0.008 + rand() * 0.014; ctx.stroke();
      }
      break;
    }
    case 'blotchline': case 'lateral': case 'amberstripe': case 'yellowstripe': {
      const c = name === 'amberstripe' ? 0xc8a050 : name === 'yellowstripe' ? 0xf0c020 : color;
      fill(c, name === 'lateral' ? 0.85 : 0.7);
      if (name === 'blotchline') for (let x = 0.12; x < 0.95; x += 0.02 + rand() * 0.035) dot(x, 0.5 + Math.sin(x * 17) * 0.04 + (rand() - 0.5) * 0.03, 4 + rand() * 8);
      else { ctx.fillRect(0.12, name === 'yellowstripe' ? 0.36 : 0.45, 0.82, name === 'lateral' ? 0.04 : 0.09); }
      break;
    }
    case 'hlines': case 'bellylines': case 'bellystripes': {
      fill(color, 0.6);
      const y0 = name === 'hlines' ? 0.2 : 0.62;
      for (let i = 0; i < 6; i++) { const a = 0.12 + rand() * 0.06, e = 0.8 + rand() * 0.14; ctx.fillRect(a, y0 + i * 0.065 + (rand() - 0.5) * 0.012, e - a + 0.1, 0.012 + rand() * 0.012); }
      break;
    }
    case 'specks': case 'darkspots': case 'redspots': case 'shadspots': case 'bluespots': case 'spot': case 'tips': case 'leopard': {
      const n = { specks: 160, darkspots: 90, redspots: 70, shadspots: 8, bluespots: 140, spot: 1, tips: 0, leopard: 120 }[name];
      const c = name === 'redspots' ? 0xc02818 : name === 'bluespots' ? 0x40a0ff : name === 'specks' ? lighten(color, 0.6) : color;
      fill(c, 0.75);
      for (let i = 0; i < n; i++) {
        const x = 0.08 + rand() * 0.88, y = name === 'shadspots' ? 0.42 : 0.04 + rand() * 0.62;
        const r = name === 'leopard' ? 5 + rand() * 7 : name === 'specks' ? 1.5 + rand() * 2.5 : 2.5 + rand() * 4;
        if (name === 'redspots') { ctx.fillStyle = css(0xf4e8d8, 0.7 * alpha); dot(x, y, r * 1.7); ctx.fillStyle = css(c, 0.85 * alpha); }
        dot(x, name === 'shadspots' ? 0.36 + i * 0.01 : y, name === 'shadspots' ? 6 : r);
      }
      if (name === 'spot') { fill(0x1a1010, 0.8); dot(0.62, 0.4, 9); }
      break;
    }
    case 'mottled': case 'beans': case 'chain': case 'darkblots': case 'patches': {
      const n = { mottled: 60, beans: 70, chain: 1, darkblots: 18, patches: 7 }[name];
      if (name === 'chain') {
        fill(color, 0.75); ctx.lineWidth = 0.008;
        for (let x = 0.08; x < 0.95; x += 0.05) for (let y = 0.08; y < 0.7; y += 0.1) {
          ctx.beginPath(); ctx.ellipse(x + (y * 3 % 0.05), y, 0.024, 0.045 / aspect, 0, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      }
      fill(name === 'beans' ? 0xe8e4c0 : color, name === 'beans' ? 0.75 : name === 'patches' ? 1 : 0.5);
      for (let i = 0; i < n; i++) {
        const x = 0.06 + rand() * 0.9, y = 0.04 + rand() * (name === 'patches' ? 0.9 : 0.66);
        const r = name === 'patches' ? 22 + rand() * 30 : name === 'darkblots' ? 7 + rand() * 6 : name === 'beans' ? 3 + rand() * 3 : 6 + rand() * 12;
        ctx.beginPath();
        ctx.ellipse(x, y, (r * (W / 512) * (name === 'beans' ? 1.8 : 1)) / W, (r * (W / 512)) / (H / 2) / aspect, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'vermic': {
      fill(0xd8d080, 0.8); ctx.lineWidth = 0.006;
      for (let i = 0; i < 70; i++) {
        const x = 0.08 + rand() * 0.86, y = 0.03 + rand() * 0.32;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 0.02, y + 0.06 * rand(), x + 0.035, y); ctx.stroke();
      }
      fill(0xd02818, 0.9);
      for (let i = 0; i < 30; i++) dot(0.1 + rand() * 0.8, 0.35 + rand() * 0.25, 2.5);
      break;
    }
    case 'rainbow': {
      ctx.fillStyle = css(0xe06080, 0.55 * alpha); ctx.fillRect(0.08, 0.4, 0.86, 0.14);
      fill(0x222018, 0.8);
      for (let i = 0; i < 150; i++) dot(0.08 + rand() * 0.9, 0.04 + rand() * 0.45, 1.5 + rand() * 2);
      break;
    }
    case 'scales': case 'bigscales': case 'redscales': {
      const s = name === 'scales' ? 0.035 : 0.05;
      ctx.lineWidth = 0.0035;
      for (let x = 0.12; x < 0.96; x += s) for (let y = 0.02; y < 0.98; y += s * 2.2) {
        const red = name === 'redscales' && x > 0.55 && y > 0.3;
        ctx.strokeStyle = css(red ? 0xd03020 : darken(color, 0.4), (red ? 0.8 : 0.4) * alpha);
        if (red) { ctx.fillStyle = css(0xc02818, 0.5 * alpha); }
        ctx.beginPath(); ctx.ellipse(x + (Math.floor(y / (s * 2.2)) % 2) * s * 0.5, y, s * 0.55, s * 1.2 / aspect, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        if (red) ctx.fill();
      }
      break;
    }
    case 'tailspot': { fill(0x111111, 0.9); dot(0.86, 0.42, 9); break; }
    case 'peacock': {
      fill(0x1a2a10, 0.7);
      for (let i = 0; i < 3; i++) ctx.fillRect(0.3 + i * 0.18, 0.08, 0.05, 0.62);
      fill(0x1a1a10, 0.9); dot(0.9, 0.45, 9);
      ctx.strokeStyle = css(0xf0c030, 0.9 * alpha); ctx.lineWidth = 0.006;
      ctx.beginPath(); ctx.ellipse(0.9, 0.45, 24 / W, 24 / (H / 2) / aspect, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'mahi': { fill(0x2a70d8, 0.85); for (let i = 0; i < 90; i++) dot(0.06 + rand() * 0.9, 0.05 + rand() * 0.6, 2 + rand() * 2.5); break; }
    case 'sailstripes': {
      fill(0x80b8ff, 0.6);
      for (let i = 0; i < 14; i++) { const x = 0.22 + i * 0.045; ctx.fillRect(x, 0.15, 0.008, 0.55); }
      break;
    }
    case 'wavy': {
      fill(darken(color, 0.3), 0.85); ctx.lineWidth = 0.01;
      for (let i = 0; i < 22; i++) {
        const x = 0.15 + i * 0.037;
        ctx.beginPath(); ctx.moveTo(x, 0.04);
        for (let y = 0.04; y < 0.45; y += 0.05) ctx.lineTo(x + Math.sin(y * 30 + i) * 0.012, y);
        ctx.stroke();
      }
      break;
    }
    case 'haddock': { fill(0x111111, 0.9); ctx.fillRect(0.1, 0.38, 0.85, 0.018); dot(0.25, 0.35, 10); break; }
    case 'redtail': break;
    default: break;
  }
}

// Organic variation: soft light and dark clouds plus fine speckle, so no flank is a flat
// fill. Kept faint; patterns go on top.
function mottle(ctx, look, rand) {
  ctx.save();
  for (let i = 0; i < 260; i++) {
    const x = rand() * W, y = rand() * H, r = (10 + rand() * 46) * (W / 512);
    const dark = rand() < 0.55;
    const c = dark ? darken(look.side, 0.35) : lighten(look.side, 0.3);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, css(c, dark ? 0.16 : 0.11));
    gr.addColorStop(1, css(c, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2400; i++) {
    const x = rand() * W, y = rand() * H;
    ctx.fillStyle = css(rand() < 0.5 ? 0x000000 : 0xffffff, 0.05);
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}

// variant: 0 is the species' reference pattern, 1+ are other individuals (seeded differently)
export function paintSkin(sp, b, look, variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // flank arc vs length: how much the texture stretches vertically on the body
  const aspect = Math.max(0.6, ((b.H + b.W * 0.6) * 1.1) / 0.25);
  // countershading: a dark back fading through the flank to a pale belly
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const stops = [[0, darken(look.back, 0.18)], [0.1, look.back], [0.2, mix(look.back, look.side, 0.6)], [0.3, look.side], [0.41, mix(look.side, look.belly, 0.75)], [0.5, look.belly]];
  for (const [t, c] of stops) { g.addColorStop(t, css(c)); g.addColorStop(1 - t, css(c)); }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // darker head/snout, a touch of tail colour
  const hg = ctx.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, css(darken(look.back, 0.2), 0.45)); hg.addColorStop(0.12, css(look.back, 0)); hg.addColorStop(0.9, css(look.fin, 0)); hg.addColorStop(1, css(look.fin, 0.4));
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);

  const vs = variant ? ':v' + variant : '';
  const rand = rng(seedOf(sp.id + vs));
  mottle(ctx, look, rng(seedOf(sp.id + 'mottle' + vs)));
  flank(ctx, () => {
    patternDraw(ctx, look.pattern, darken(look.back, 0.35), look.patternAlpha, aspect, rand, sp);
    for (const [p, c, a] of look.overlays) patternDraw(ctx, p, c, a, aspect, rng(seedOf(sp.id + p + vs)), sp);
    // lateral line
    // lateral line: a faint, slightly wavering dashed run, not a ruled one
    ctx.fillStyle = css(darken(look.side, 0.3), 0.25);
    for (let lx = 0.14; lx < 0.94; lx += 0.05) ctx.fillRect(lx, 0.33 + Math.sin(lx * 23 + sp.id.length) * 0.006, 0.038 + rand() * 0.012, 0.006 + rand() * 0.004);
    // gill plate / gill slits
    if (b.gills) {
      ctx.fillStyle = css(darken(look.side, 0.5), 0.6);
      for (let i = 0; i < 5; i++) ctx.fillRect(0.17 + i * 0.016, 0.3, 0.004, 0.32);
    } else {
      // gill cover: a shaded plate with a darker rear edge
      const gx = 0.13 + (b.snout || 0);
      const og = ctx.createLinearGradient(gx - 0.08, 0, gx + 0.05, 0);
      og.addColorStop(0, css(darken(look.side, 0.15), 0)); og.addColorStop(0.85, css(darken(look.side, 0.25), 0.35)); og.addColorStop(1, css(darken(look.side, 0.55), 0.7));
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.moveTo(gx - 0.08, 0.15); ctx.lineTo(gx, 0.15); ctx.quadraticCurveTo(gx + 0.07, 0.45, gx + 0.01, 0.8); ctx.lineTo(gx - 0.08, 0.8); ctx.fill();
      ctx.strokeStyle = css(darken(look.side, 0.6), 0.7); ctx.lineWidth = 0.005;
      ctx.beginPath(); ctx.moveTo(gx, 0.15); ctx.quadraticCurveTo(gx + 0.07, 0.45, gx + 0.01, 0.8); ctx.stroke();
    }
    // mouth: lip line plus a shadowed gape
    const m = b.mouth || 0.08;
    const y0 = b.upturned ? 0.45 : b.underMouth ? 0.8 : 0.6, y1 = b.underMouth ? 0.88 : 0.62;
    ctx.fillStyle = css(darken(look.back, 0.7), 0.55);
    ctx.beginPath(); ctx.moveTo(0, y0 - 0.03); ctx.lineTo(m * 0.85, y1 - 0.01); ctx.lineTo(m * 0.85, y1 + 0.03); ctx.lineTo(0, y0 + 0.06); ctx.fill();
    ctx.strokeStyle = css(darken(look.back, 0.75), 0.9); ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.moveTo(0.0, y0); ctx.lineTo(m * 0.85, y1); ctx.stroke();
    if (sp.throat) { ctx.fillStyle = css(0xe03018, 0.8); ctx.fillRect(0.02, 0.85, 0.12, 0.08); }
    if (look.pattern === 'tips' || (look.pattern === 'redtail')) {
      // handled by fin colour
    }
  });
  // belly/back sheen bands for silvery fish
  if (look.metal > 0.4) {
    const s = ctx.createLinearGradient(0, 0, 0, H);
    s.addColorStop(0.3, 'rgba(255,255,255,0)'); s.addColorStop(0.42, 'rgba(255,255,255,0.18)'); s.addColorStop(0.5, 'rgba(255,255,255,0)');
    s.addColorStop(0.58, 'rgba(255,255,255,0.18)'); s.addColorStop(0.7, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

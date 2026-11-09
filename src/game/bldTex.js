import * as THREE from 'three';

// Procedural surface textures for buildings. Each one is a grey-ish luminance pattern that tiles
// once per metre; the colour comes from vertex colours, so one texture serves many paint jobs.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const grey = (v, a = 1) => { const c = Math.max(0, Math.min(255, Math.round(v * 255))); return `rgba(${c},${c},${c},${a})`; };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// fine grime + speckle over the whole tile (wraps nowhere, but is too small to show a seam)
function speckle(g, S, rand, n, strength = 0.12) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(0,0,0,${rand() * strength})` : `rgba(255,255,255,${rand() * strength * 0.6})`;
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  }
}
// vertical weathering streaks: rain runs and rust bleed
function streaks(g, S, rand, n, dark = 0.18) {
  for (let i = 0; i < n; i++) {
    const x = rand() * S, y = rand() * S * 0.6, l = S * (0.15 + rand() * 0.5);
    const gr = g.createLinearGradient(0, y, 0, y + l);
    gr.addColorStop(0, `rgba(0,0,0,${dark * rand()})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x, y, 1 + rand() * 3, l);
  }
}

const MAKERS = {
  // lapped siding: 7 boards a metre, each with a lit upper edge, a shadow line and grain
  clap(g, S, rand) {
    g.fillStyle = grey(0.86); g.fillRect(0, 0, S, S);
    const n = 7, bh = S / n;
    for (let i = 0; i < n; i++) {
      const y = i * bh, tone = 0.8 + rand() * 0.16;
      g.fillStyle = grey(tone); g.fillRect(0, y, S, bh);
      g.fillStyle = grey(1, 0.5); g.fillRect(0, y, S, 2);
      const sh = g.createLinearGradient(0, y + bh * 0.6, 0, y + bh);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.38)');
      g.fillStyle = sh; g.fillRect(0, y + bh * 0.6, S, bh * 0.4);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(0,0,0,${0.03 + rand() * 0.07})`; g.beginPath(); const yy = y + 3 + rand() * (bh - 5); g.moveTo(rand() * S * 0.4, yy); g.lineTo(S * (0.4 + rand() * 0.6), yy + (rand() - 0.5) * 2); g.stroke(); }
      const j = rand() * S; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(j, y + 2, 1.5, bh - 3);
    }
    streaks(g, S, rand, 22); speckle(g, S, rand, 900);
  },
  // board and batten
  batten(g, S, rand) {
    g.fillStyle = grey(0.84); g.fillRect(0, 0, S, S);
    const n = 5, bw = S / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = grey(0.76 + rand() * 0.18); g.fillRect(i * bw, 0, bw, S);
      for (let k = 0; k < 16; k++) { g.strokeStyle = `rgba(0,0,0,${0.04 + rand() * 0.08})`; g.beginPath(); const xx = i * bw + 4 + rand() * (bw - 8); g.moveTo(xx, 0); g.bezierCurveTo(xx + 3, S * 0.3, xx - 3, S * 0.7, xx + 1, S); g.stroke(); }
      g.fillStyle = grey(0.96); g.fillRect(i * bw - 3, 0, 7, S);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * bw + 4, 0, 2, S);
    }
    streaks(g, S, rand, 26, 0.22); speckle(g, S, rand, 1000);
  },
  stucco(g, S, rand) {
    g.fillStyle = grey(0.88); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { g.fillStyle = grey(0.7 + rand() * 0.3, 0.1 + rand() * 0.25); const r = 1 + rand() * 6; g.beginPath(); g.arc(rand() * S, rand() * S, r, 0, 6.3); g.fill(); }
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; g.beginPath(); let x = rand() * S, y = rand() * S; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rand() - 0.5) * 18; y += 8 + rand() * 12; g.lineTo(x, y); } g.stroke(); }
    streaks(g, S, rand, 30, 0.25); speckle(g, S, rand, 1400, 0.1);
  },
  // round logs, chinked
  log(g, S, rand) {
    g.fillStyle = grey(0.35); g.fillRect(0, 0, S, S);
    const n = 4, bh = S / n;
    for (let i = 0; i < n; i++) {
      const y = i * bh;
      const gr = g.createLinearGradient(0, y, 0, y + bh);
      gr.addColorStop(0, grey(0.55)); gr.addColorStop(0.35, grey(1)); gr.addColorStop(0.8, grey(0.7)); gr.addColorStop(1, grey(0.28));
      g.fillStyle = gr; g.fillRect(0, y + 1, S, bh - 2);
      for (let k = 0; k < 28; k++) { g.strokeStyle = `rgba(0,0,0,${0.06 + rand() * 0.14})`; g.beginPath(); const yy = y + 4 + rand() * (bh - 8); g.moveTo(rand() * S, yy); g.lineTo(rand() * S, yy + (rand() - 0.5) * 4); g.stroke(); }
      for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(rand() * S, y + bh * 0.5, 4 + rand() * 4, 2 + rand() * 2, 0, 0, 6.3); g.fill(); }
    }
    speckle(g, S, rand, 600);
  },
  // corrugated sheet, rust bleeding from the fixings
  tin(g, S, rand) {
    const n = 8, w = S / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      gr.addColorStop(0, grey(0.55)); gr.addColorStop(0.3, grey(1)); gr.addColorStop(0.6, grey(0.78)); gr.addColorStop(1, grey(0.5));
      g.fillStyle = gr; g.fillRect(i * w, 0, w, S);
    }
    for (let i = 0; i < 18; i++) { const x = rand() * S, y = rand() * S, l = 30 + rand() * 120; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(90,40,10,0.35)'); gr.addColorStop(1, 'rgba(90,40,10,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + rand() * 4, l); }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(110,55,20,${0.1 + rand() * 0.25})`; g.beginPath(); g.arc(rand() * S, rand() * S, 2 + rand() * 9, 0, 6.3); g.fill(); }
    speckle(g, S, rand, 500, 0.1);
  },
  brick(g, S, rand) {
    g.fillStyle = grey(0.5); g.fillRect(0, 0, S, S);
    const rows = 14, bh = S / rows, bw = S / 5;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 6; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0);
      g.fillStyle = grey(0.62 + rand() * 0.34); g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
    streaks(g, S, rand, 20, 0.25); speckle(g, S, rand, 900);
  },
  conc(g, S, rand) {
    g.fillStyle = grey(0.8); g.fillRect(0, 0, S, S);
    speckle(g, S, rand, 2500, 0.16);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S);
    streaks(g, S, rand, 34, 0.3);
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.07})`; g.beginPath(); g.arc(rand() * S, rand() * S, 10 + rand() * 30, 0, 6.3); g.fill(); }
  },
  // asphalt shingles in staggered courses
  shingle(g, S, rand) {
    g.fillStyle = grey(0.6); g.fillRect(0, 0, S, S);
    const rows = 10, bh = S / rows, bw = S / 6;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 7; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0);
      const gr = g.createLinearGradient(0, r * bh, 0, (r + 1) * bh);
      const t = 0.62 + rand() * 0.32;
      gr.addColorStop(0, grey(t * 0.8)); gr.addColorStop(0.7, grey(t)); gr.addColorStop(1, grey(t * 0.45));
      g.fillStyle = gr; g.fillRect(x + 1, r * bh, bw - 2, bh);
    }
    speckle(g, S, rand, 2200, 0.16);
  },
  // barrel tiles
  tile(g, S, rand) {
    const cols = 8, w = S / cols;
    for (let c = 0; c < cols; c++) {
      const gr = g.createLinearGradient(c * w, 0, (c + 1) * w, 0);
      gr.addColorStop(0, grey(0.4)); gr.addColorStop(0.45, grey(1)); gr.addColorStop(1, grey(0.42));
      g.fillStyle = gr; g.fillRect(c * w, 0, w, S);
    }
    const rows = 6, bh = S / rows;
    for (let r = 0; r < rows; r++) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, r * bh, S, 2); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '40,30,10' : '255,255,255'},${rand() * 0.12})`; g.fillRect(rand() * S, rand() * S, 6 + rand() * 20, 3 + rand() * 8); }
    speckle(g, S, rand, 700);
  },
  thatch(g, S, rand) {
    g.fillStyle = grey(0.62); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { const x = rand() * S, y = rand() * S, l = 14 + rand() * 40; g.strokeStyle = grey(0.35 + rand() * 0.65, 0.5); g.lineWidth = 0.7 + rand(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 4, y + l); g.stroke(); }
    for (let r = 0; r < 5; r++) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, r * S / 5, S, 3); }
  },
  wood(g, S, rand) {
    g.fillStyle = grey(0.84); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { g.strokeStyle = rand() < 0.6 ? `rgba(0,0,0,${0.04 + rand() * 0.1})` : `rgba(255,255,255,${0.05 + rand() * 0.1})`; g.lineWidth = 0.6 + rand() * 1.4; const y = rand() * S, x = rand() * S; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + S * 0.3, y + (rand() - 0.5) * 5, x + S * 0.6, y + (rand() - 0.5) * 5, x + S, y + (rand() - 0.5) * 3); g.stroke(); }
    for (let k = 0; k < 4; k++) { const x = rand() * S, y = rand() * S; g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(x, y, 5 + rand() * 4, 2.5 + rand() * 2, 0, 0, 6.3); g.fill(); }
    speckle(g, S, rand, 700);
  },
  stone(g, S, rand) {
    g.fillStyle = grey(0.4); g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const bh = 22 + rand() * 24; let x = -rand() * 30;
      while (x < S) {
        const bw = 30 + rand() * 50, t = 0.55 + rand() * 0.4;
        g.fillStyle = grey(t); g.fillRect(x + 2, y + 2, bw - 3, bh - 3);
        g.fillStyle = grey(1, 0.18); g.fillRect(x + 2, y + 2, bw - 3, 3);
        x += bw;
      }
      y += bh;
    }
    speckle(g, S, rand, 1600, 0.2);
  },
};

const cache = new Map();
export function bldTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const S = 256, cv = canvas(S, S), g = cv.getContext('2d');
  let seed = 0; for (const ch of kind) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  MAKERS[kind](g, S, rng(seed));
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(kind, tex);
  return tex;
}
export const TEXTURE_KINDS = Object.keys(MAKERS);

// ---- signs -------------------------------------------------------------------------------
// One atlas of hand-painted boards (512 x 128 slots) and one of lit neon/lettering. Board text is
// drawn with some wear: flaked paint, rust runs under the screws, faded lettering.
const SLOT_W = 512, SLOT_H = 128, COLS = 4, ROWS = 8;
export class SignAtlas {
  constructor(glow = false) {
    this.glow = glow;
    this.cv = canvas(SLOT_W * COLS, SLOT_H * ROWS);
    this.g = this.cv.getContext('2d');
    this.n = glow ? 1 : 0;       // glow atlas keeps slot 0 as a plain white patch for windows
    if (glow) { this.g.fillStyle = '#fff'; this.g.fillRect(0, 0, SLOT_W, SLOT_H); }
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.cache = new Map();
  }

  rectOf(slot, inset = 0) {
    const cx = slot % COLS, cy = Math.floor(slot / COLS), W = SLOT_W * COLS, H = SLOT_H * ROWS;
    return { u0: (cx * SLOT_W + inset) / W, u1: ((cx + 1) * SLOT_W - inset) / W, v0: 1 - ((cy + 1) * SLOT_H - inset) / H, v1: 1 - (cy * SLOT_H + inset) / H };
  }
  white() { return this.rectOf(0, 40); }

  // painted board: { text, sub, bg, fg, border, font, wear }
  add(o) {
    const key = JSON.stringify(o);
    if (this.cache.has(key)) return this.cache.get(key);
    const slot = this.n++;
    if (slot >= COLS * ROWS) return this.rectOf(0);
    const g = this.g, x0 = (slot % COLS) * SLOT_W, y0 = Math.floor(slot / COLS) * SLOT_H;
    g.save(); g.beginPath(); g.rect(x0, y0, SLOT_W, SLOT_H); g.clip(); g.translate(x0, y0);
    let seed = slot * 977 + 5; const rand = rng(seed);
    if (this.glow) this.drawNeon(g, o); else this.drawBoard(g, o, rand);
    g.restore();
    this.tex.needsUpdate = true;
    const r = this.rectOf(slot);
    this.cache.set(key, r);
    return r;
  }

  drawBoard(g, o, rand) {
    const W = SLOT_W, H = SLOT_H;
    g.fillStyle = o.bg || '#f2efe6'; g.fillRect(0, 0, W, H);
    // plank seams and grain under the paint
    for (let i = 1; i < 3; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, (H / 3) * i, W, 1.5); }
    for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(0,0,0,${0.03 + rand() * 0.07})`; g.beginPath(); const y = rand() * H, x = rand() * W; g.moveTo(x, y); g.lineTo(x + 40 + rand() * 200, y + (rand() - 0.5) * 3); g.stroke(); }
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = 7; g.strokeRect(9, 9, W - 18, H - 18); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const size = o.sub ? 62 : 78, font = o.font || '"Impact", "Arial Black", sans-serif';
    g.font = `${o.italic ? 'italic ' : ''}${size}px ${font}`;
    let fs = size; while (g.measureText(o.text).width > W - 56 && fs > 18) { fs -= 3; g.font = `${o.italic ? 'italic ' : ''}${fs}px ${font}`; }
    g.fillStyle = o.fg || '#1c2a3a';
    g.fillText(o.text, W / 2, o.sub ? H * 0.38 : H * 0.52);
    if (o.sub) {
      g.font = `32px ${o.subFont || '"Georgia", serif'}`; let s2 = 32;
      while (g.measureText(o.sub).width > W - 60 && s2 > 14) { s2 -= 2; g.font = `${s2}px ${o.subFont || '"Georgia", serif'}`; }
      g.fillStyle = o.fg2 || o.fg || '#1c2a3a'; g.fillText(o.sub, W / 2, H * 0.78);
    }
    // wear: flaked paint, faded patches, rust under the corners
    const wear = o.wear ?? 1;
    for (let i = 0; i < 180 * wear; i++) { g.fillStyle = `rgba(70,50,30,${0.15 + rand() * 0.4})`; const r = 0.8 + rand() * 3.2; g.beginPath(); g.ellipse(rand() * W, rand() * H, r * 2, r, rand() * 3, 0, 6.3); g.fill(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.1})`; g.beginPath(); g.arc(rand() * W, rand() * H, 14 + rand() * 40, 0, 6.3); g.fill(); }
    for (const x of [16, W - 16]) { const gr = g.createLinearGradient(0, 14, 0, H); gr.addColorStop(0, 'rgba(110,50,15,0.55)'); gr.addColorStop(1, 'rgba(110,50,15,0)'); g.fillStyle = gr; g.fillRect(x - 2, 14, 4, H * 0.8); }
    const edge = g.createLinearGradient(0, 0, 0, H); edge.addColorStop(0, 'rgba(255,255,255,0.12)'); edge.addColorStop(0.1, 'rgba(0,0,0,0)'); edge.addColorStop(0.9, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = edge; g.fillRect(0, 0, W, H);
  }

  // glass tube lettering: bright core, soft halo, on transparent
  drawNeon(g, o) {
    const W = SLOT_W, H = SLOT_H;
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const font = o.font || '"Brush Script MT", "Segoe Script", cursive';
    let fs = o.size || 84; g.font = `${fs}px ${font}`;
    while (g.measureText(o.text).width > W - 40 && fs > 20) { fs -= 3; g.font = `${fs}px ${font}`; }
    for (const [blur, a, w] of [[18, 0.45, 8], [8, 0.7, 5], [0, 1, 2.2]]) {
      g.shadowColor = o.color || '#ff3a2a'; g.shadowBlur = blur;
      g.strokeStyle = blur ? (o.color || '#ff3a2a') : '#fff4ee'; g.lineWidth = w; g.globalAlpha = a;
      g.strokeText(o.text, W / 2, H / 2);
    }
    g.globalAlpha = 1; g.shadowBlur = 0;
  }
}

// Fish finder: a scrolling sonar trace of the bottom and fish arches under the boat.
import * as U from './units.js';
export class Sonar {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.maxDepth = 20;
    this.ctx.fillStyle = '#04121c';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  update(dt, depth, fishDepths, hot, tag = 'SONAR', show = true) {
    this.t += dt;
    if (this.t < 0.08) return;
    this.t = 0;
    const { ctx, c } = this;
    const W = c.width, H = c.height - 18;
    this.maxDepth += (Math.max(6, Math.min(200, depth * 1.3)) - this.maxDepth) * 0.05;
    const y = (d) => 18 + (d / this.maxDepth) * H;
    ctx.drawImage(c, 2, 0, W - 2, c.height, 0, 0, W - 2, c.height);
    const x = W - 2;
    const g = ctx.createLinearGradient(0, 18, 0, c.height);
    g.addColorStop(0, '#0a2a44'); g.addColorStop(1, '#04121c');
    ctx.fillStyle = g;
    ctx.fillRect(x, 18, 2, H);
    // bottom return
    const by = y(depth);
    ctx.fillStyle = '#e8b030'; ctx.fillRect(x, by, 2, 3);
    ctx.fillStyle = '#c84020'; ctx.fillRect(x, by + 3, 2, 6);
    ctx.fillStyle = '#5a2a18'; ctx.fillRect(x, by + 9, 2, c.height);
    // fish arches and bait clouds
    // arches: thicker, brighter returns for bigger fish; each sits at the depth its species holds
    for (const f of fishDepths) {
      const d = f.d ?? f, s = f.s ?? 0.3;
      ctx.fillStyle = s > 0.6 ? '#fff0a0' : '#ffe060';
      ctx.fillRect(x, y(d) - 1 - Math.round(s * 2), 2, 3 + Math.round(s * 4));
    }
    if (hot > 0.05) {
      ctx.fillStyle = `rgba(80,200,255,${0.25 + hot * 0.5})`;
      for (let i = 0; i < 4; i++) ctx.fillRect(x, y(1.5 + Math.random() * 3), 2, 2);
      if (Math.random() < hot * 0.35) { ctx.fillStyle = '#ff6a30'; const d = Math.random() * depth * 0.8; ctx.fillRect(x, y(d) - 2, 2, 5); }
    }
    ctx.fillStyle = '#1c2227';
    ctx.fillRect(0, 0, W, 18);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.fillText(show ? `${tag}  ${U.depth(depth)}` : tag, 8, 13);
    if (hot > 0.05) { ctx.fillStyle = '#ff7a1a'; ctx.fillText('FISH', W - 40, 13); }
  }
}

"""Headless depth check: for each water, boat-view shot, a high fly-over shot, the chart, the sonar readout and
the bait model's species mix at a shallow and a deep lure depth. Writes PNGs to --out. Run under the CPU cap
(see NOTES.md): cmd /c start "" /affinity FFF /belownormal /wait /b python tools/depth_shots.py --port 5252 --out DIR tahoe fjord
"""
import argparse, os, time, json
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, default=5252); ap.add_argument('--out', default='docs/shots'); ap.add_argument('--tag', default=''); ap.add_argument('--query', default=''); ap.add_argument('--land', default='')
ap.add_argument('locs', nargs='+')
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
exe = os.environ.get('CHROME_HEADLESS') or None
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=exe, args=['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'])
    for loc in a.locs:
        ctx = b.new_context(viewport={'width': 1280, 'height': 720}); page = ctx.new_page(); errs = []
        page.on('console', lambda m, e=errs: e.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e, E=errs: E.append('PAGEERROR ' + str(e)))
        page.goto(f'http://localhost:{a.port}/?dev=1&loc={loc}&hour=11{a.query}', wait_until='load'); time.sleep(10)
        if not page.evaluate('!!(window.game && window.game.boat)'): print(loc, 'not ready', errs[:4]); ctx.close(); continue
        step = lambda n=30: page.evaluate(f'window.__step && window.__step({n}, 0.016)')
        step(90)
        info = page.evaluate("""(() => { const g = game, p = g.boat.position; const L = g.loc; let max = 0, sum = 0, n = 0; const R = L.size / 2;
          for (let x = -R; x <= R; x += R / 40) for (let z = -R; z <= R; z += R / 40) { const h = L.height(x, z); if (h < -0.5) { max = Math.max(max, -h); sum += -h; n++; } }
          return { here: +(-g.heightAt(p.x, p.z)).toFixed(1), max: Math.round(max), mean: Math.round(sum / Math.max(1, n)) }; })()""")
        print(loc, info)
        page.screenshot(path=os.path.join(a.out, f'{loc}{a.tag}_boat.png'))
        # sonar canvas after a few seconds of running
        step(120); page.evaluate('window.game.ui && 0')
        sn = page.query_selector('#sonar')
        if sn: sn.screenshot(path=os.path.join(a.out, f'{loc}{a.tag}_sonar.png'))
        # fly: 140 m up, looking down 35 degrees, over the boat
        page.evaluate("""(() => { const d = game.dev; d.toggleFly(true); d.pos.set(game.boat.position.x - 120, 90, game.boat.position.z + 120); d.yaw = -0.78; d.pitch = -0.5; })()""")
        step(30); page.screenshot(path=os.path.join(a.out, f'{loc}{a.tag}_fly.png'))
        page.evaluate("game.dev.toggleFly(false)"); step(10)
        page.evaluate("game.ui.open('chart')"); time.sleep(1.2)
        page.screenshot(path=os.path.join(a.out, f'{loc}{a.tag}_chart.png'))
        page.evaluate("game.ui.close()")
        mix = page.evaluate("""(async () => { const bait = await import('/src/game/bait.js'); const { LURES } = await import('/src/game/gear.js');
          const out = {}; for (const [bottom, depth] of [[6, 3], [Math.min(60, 40), 30], [150, 60], [220, 200]]) { const lure = LURES.jig || Object.values(LURES)[3];
            const r = bait.poolFit(game.loc.pool, { lureId: 'jig', lure, depth, bottom, hour: 11, wx: 'partly' }); const e = r.entries.sort((x, y) => y[1] - x[1]).slice(0, 4).map(([sp, w]) => sp.id + ':' + (w / r.sum * 100).toFixed(0)); out[bottom + '/' + depth] = e.join(' '); } return out; })()""")
        print(' mix', json.dumps(mix))
        if a.land:
            page.evaluate(f"game.devLand('{a.land.split(':')[0]}', {a.land.split(':')[1]})"); time.sleep(0.8)
            page.screenshot(path=os.path.join(a.out, f'{loc}{a.tag}_catch.png')); page.evaluate("game.finishCatch('release')")
        errs = [e for e in errs if 'WebSocket' not in e and 'vite' not in e.lower()]
        print(' console errors:', len(errs), errs[:3]); ctx.close()
    b.close()

"""Headless fish cam check: for each water, hang the camera at several depths (screenshots), hold the view on a
fish for a sighting tag, cast and track the lure with a fish approaching it, take a photo, leave the camera.
Run under the CPU cap (below normal, affinity 0x0FFF), headless only, on a spare port:
  CHROME_HEADLESS=<chrome-headless-shell.exe> python tools/cam_shots.py --port 5733 --out DIR keys tahoe okeechobee fjord
"""
import argparse, os, time, json
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, default=5733); ap.add_argument('--out', default='docs/shots'); ap.add_argument('--hour', default='11')
ap.add_argument('--depths', default='2,8,20,45,100'); ap.add_argument('--w', type=int, default=1100); ap.add_argument('--h', type=int, default=620)
ap.add_argument('locs', nargs='+')
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_HEADLESS') or None, args=['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'])
    for loc in a.locs:
        ctx = b.new_context(viewport={'width': a.w, 'height': a.h}); page = ctx.new_page(); errs = []
        page.on('console', lambda m, e=errs: e.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e, E=errs: E.append('PAGEERROR ' + str(e)))
        page.goto(f'http://localhost:{a.port}/?dev=1&loc={loc}&hour={a.hour}', wait_until='load'); time.sleep(12)
        if not page.evaluate('!!(window.game && window.game.fishCam)'): print(loc, 'not ready', errs[:3]); ctx.close(); continue
        step = lambda n=30, dt=0.033: page.evaluate(f'window.__step({n}, {dt})')
        shot = lambda name: page.screenshot(path=os.path.join(a.out, f'{loc}_{name}.png'))
        page.evaluate("game.ui.isOpen() && game.ui.close(); game.save.permits = { [game.loc.id]: { until: 1e9 } }")
        step(60)
        print(loc, 'usable', page.evaluate('game.fishCam.usable()'), 'bottom', round(page.evaluate('-game.heightAt(game.boat.position.x, game.boat.position.z)')))
        page.evaluate('game.fishCam.toggle()'); step(40)
        print(' active', page.evaluate("[game.fishCam.active, game.view]"))
        for d in [float(x) for x in a.depths.split(',')]:
            page.evaluate(f'game.fishCam.len = {d}'); step(70)
            info = page.evaluate("({len: +game.fishCam.len.toFixed(1), max: +game.fishCam.maxLen.toFixed(1), live: game.fishLife.actors.filter(a => a.on).map(a => a.sp.id + ':' + a.y.toFixed(0))})")
            print(' depth', d, json.dumps(info)); shot(f'd{int(d):03d}')
            if info['max'] < d - 0.5: break
        # sighting: put a fish of this water 4 m dead ahead at the camera's depth and keep the view on it
        r = page.evaluate("""(() => { const g = game, fl = g.fishLife, c = g.camera; const ids = Object.keys(g.loc.pool); let a = null;
          for (const id of ids) { a = fl.spawnAt(id, 4, 0); if (a) break; }
          if (!a) return null; a.y = c.position.y; a.homeY = a.y; a.speed = 0; a.wander = 999; a.cool = 999; return a.sp.id; })()""")
        for _ in range(6):
            page.evaluate("(() => { const a = game.fishLife.actors.find((x) => x.on && x.cool > 900); if (!a) return; const c = game.camera, d = c.getWorldDirection(new c.position.constructor()); a.x = c.position.x + d.x * 4; a.z = c.position.z + d.z * 4; a.y = c.position.y + d.y * 4; a.homeY = a.y; a.speed = 0; })()")
            step(14)
        print(' sighting fish', r, page.evaluate("[game.save.sighted && Object.keys(game.save.sighted), [...document.querySelectorAll('#fishcam .tag')].filter(t => t.style.display === 'block').map(t => t.textContent)]"))
        shot('sighting')
        # lamp off / on at depth
        page.evaluate('game.fishCam.toggleLamp()'); step(30); shot('lamp_off'); page.evaluate('game.fishCam.toggleLamp()')
        # lure follow: cast close, track, a fish near the lure
        page.evaluate("game.fishCam.exit(); game.fishing.reset(); game.fishing.power = 0; game.fishing.cast()"); step(60)
        page.evaluate("game.fishCam.toggle(); game.fishCam.len = Math.min(game.fishCam.maxLen, 6); game.fishCam.toggleFollow()"); step(60)
        print(' follow', page.evaluate("[game.fishing.state, game.fishCam.follow, +game.fishing.depth.toFixed(1), +game.fishCam.len.toFixed(1)]"))
        r = page.evaluate("""(() => { const g = game, fl = g.fishLife, f = g.fishing; const ids = Object.keys(g.loc.pool); let a = null;
          for (const id of ids) { a = fl.spawnAt(id, 6, 0); if (a) break; } if (!a) return null; a.x = f.lure.x - 2.5; a.z = f.lure.z + 1; a.y = f.lure.y; a.homeY = a.y; return a.sp.id; })()""")
        states = []
        for i in range(12):
            step(20); states.append(page.evaluate("(() => { const a = game.fishLife.actors.find((x) => x.on); return a ? a.state : '-'; })()"))
            if i in (3, 8): shot(f'lure{i}')
        print(' lure fish', r, states)
        # photo
        page.evaluate('game.fishCam.photo()'); step(6)
        print(' photo bytes', page.evaluate('game.fishCam.lastShot ? game.fishCam.lastShot.length : 0'))
        page.evaluate('game.fishCam.toggle()'); step(20)
        print(' left', page.evaluate("[game.fishCam.active, game.view, game.fishLife.focus]"))
        shot('after')
        errs = [e for e in errs if 'WebSocket' not in e and 'vite' not in e.lower()]
        print(' console errors:', len(errs), errs[:3]); ctx.close()
    b.close()

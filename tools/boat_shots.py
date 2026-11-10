"""Headless screenshots of boats through the developer mode (?dev=1&boat=...): first person, over the shoulder and
boat overview, optionally the boat yard and the trolling spread. Nothing visible opens and nothing is saved.

  python tools/boat_shots.py --port 5340 --out docs/shots kayak:okeechobee pontoon:woods bay:keys yacht:gulf
  python tools/boat_shots.py --port 5340 --out docs/shots --views first,tp,over --yard --troll yacht:gulf

Run it under a CPU cap if the machine is shared (see NOTES.md). Needs `pip install playwright` + its chromium.
"""
import argparse, os, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, default=5340)
ap.add_argument('--out', default='docs/shots')
ap.add_argument('--views', default='first,tp,over')
ap.add_argument('--hour', default='10')
ap.add_argument('--yard', action='store_true', help='also open the boat yard preview')
ap.add_argument('--troll', action='store_true', help='also put the trolling spread out')
ap.add_argument('--wait', type=float, default=9.0, help='seconds to let a location load')
ap.add_argument('targets', nargs='+', help='boat:location, e.g. kayak:okeechobee')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

def settle(page, n=40):
    page.evaluate(f'window.__step && window.__step({n}, 0.016)')

with sync_playwright() as p:
    exe = os.environ.get('CHROME_HEADLESS') or None      # path to chrome-headless-shell.exe if playwright's own download is missing
    b = p.chromium.launch(headless=True, executable_path=exe, args=['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=' + os.environ.get('ANGLE', 'd3d11'), '--enable-unsafe-swiftshader', '--disable-gpu-vsync'])
    for t in a.targets:
        boat, loc = t.split(':')
        ctx = b.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
        page = ctx.new_page()
        errs = []
        page.on('console', lambda m, errs=errs: errs.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e, errs=errs: errs.append('PAGEERROR ' + str(e)))
        page.goto(f'http://localhost:{a.port}/?dev=1&loc={loc}&boat={boat}&hour={a.hour}', wait_until='load')
        time.sleep(a.wait)
        ok = page.evaluate('!!(window.game && window.game.boat)')
        if not ok:
            print(t, 'game not ready'); print('\n'.join(errs[:8])); ctx.close(); continue
        settle(page, 90)
        for v in a.views.split(','):
            page.evaluate(f"window.game.dev.setView('{v}')")
            settle(page, 20)
            time.sleep(0.4)
            fn = os.path.join(a.out, f'{boat}_{loc}_{v}.png')
            page.screenshot(path=fn)
            print('shot', fn)
        if a.troll:
            page.evaluate("window.game.dev.setView('tp'); if (!window.game.troll.active) window.game.troll.toggle()")
            settle(page, 60)
            page.screenshot(path=os.path.join(a.out, f'{boat}_{loc}_troll.png'))
            page.evaluate("if (window.game.troll.active) window.game.troll.toggle()")
        info = page.evaluate("(() => { const q = game.boat.body.quat; return { id: game.boat.id, y: +game.boat.body.pos.y.toFixed(2), upY: +(1 - 2 * (q.x * q.x + q.z * q.z)).toFixed(3), spd: +game.boat.speed.toFixed(2) }; })()")
        print(t, info)
        if a.yard:       # the boat yard turntable (yardlab.html), with some paint and the upgrades fitted
            L = page.evaluate("game.boat.hull.length")
            yp = ctx.new_page()
            yp.goto(f'http://localhost:{a.port}/yardlab.html?boat={boat}&yaw=-0.9&pitch=0.22&dist={L * 1.9:.1f}&hull=teal&stripe=gold&name=Reel%20Deal&up=gps:2,sonar:2,lights:2,holders:2', wait_until='load')
            time.sleep(4)
            yp.screenshot(path=os.path.join(a.out, f'{boat}_{loc}_yard.png'))
            yp.close()
        errs = [e for e in errs if 'WebSocket' not in e and 'vite' not in e.lower()]
        print(t, 'console errors:', len(errs))
        for e in errs[:6]:
            print('  ', e[:200])
        ctx.close()
    b.close()

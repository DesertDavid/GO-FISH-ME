"""Headless fly-over screenshots of Big Bear Lake through dev mode.
  CHROME_HEADLESS=<chrome-headless-shell.exe> python tools/bigbear/shots.py --port 5733 --out docs/bigbear-shots [--only name,name]
Run under below-normal priority, affinity 0x0FFF, headless only, on a spare port."""
import argparse, os, time, math
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=5733); ap.add_argument('--out', default='docs/bigbear-shots')
ap.add_argument('--hour', default='13'); ap.add_argument('--only', default=''); ap.add_argument('--w', type=int, default=1280); ap.add_argument('--h', type=int, default=720)
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
# name: (x, y, z, look-at x, y, z)
VIEWS = {
 'start_first_cast': (330, 3, 170, 120, 0, 40),
 'overview_dam_to_east': (-2300, 520, 700, 300, 0, -100),
 'overview_east_to_dam': (2250, 450, -520, -500, 0, 100),
 'dam_garstin_island': (-1830, 40, 560, -1818, 3, 478),
 'village_south_shore': (300, 60, 80, 330, 5, 420),
 'fawnskin_grout_bay': (-700, 60, -250, -755, 5, -520),
 'boulder_metcalf_bays': (-900, 120, 150, -900, 0, 520),
 'narrow_east_causeway': (1500, 80, -100, 1950, 0, -300),
 'north_shore_slopes': (-300, 25, -150, -300, 90, -800),
 'south_slope_forest': (-300, 20, 150, -300, 80, 700),
}
only = [s for s in a.only.split(',') if s]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_HEADLESS') or None, args=['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'])
    ctx = b.new_context(viewport={'width': a.w, 'height': a.h}); page = ctx.new_page(); errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    page.goto(f'http://localhost:{a.port}/?dev=1&loc=bigbear&hour={a.hour}&fly=1', wait_until='load'); time.sleep(14)
    if not page.evaluate('!!(window.game && window.game.dev)'): print('not ready', errs[:5]); raise SystemExit(1)
    page.evaluate("game.ui.isOpen() && game.ui.close()")
    page.evaluate("game.weather.force && game.weather.force('clear'); window.__step(60, 0.033)")
    if not page.evaluate('game.dev.fly'): page.evaluate('game.dev.toggleFly(true)')
    for name, (x, y, z, lx, ly, lz) in VIEWS.items():
        if only and name not in only: continue
        yaw = math.atan2(-(lx - x), -(lz - z)); dist = math.hypot(lx - x, lz - z); pitch = math.atan2(ly - y, dist)
        page.evaluate(f"(() => {{ const d = game.dev; d.pos.set({x},{y},{z}); d.yaw = {yaw}; d.pitch = {pitch}; d.vel.set(0,0,0); }})()")
        page.evaluate("window.__step(45, 0.033)"); time.sleep(0.5)
        page.screenshot(path=os.path.join(a.out, f'{name}.png')); print('shot', name)
    print('errors', errs[:8])

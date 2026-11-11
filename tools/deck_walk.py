"""Headless walk-the-deck test for every boat (dev mode, Playwright, ANGLE d3d11 through chrome-headless-shell).

  python tools/deck_walk.py --port 5421 --out docs/deckwalk-shots kayak:okeechobee jon:okeechobee ...

Per boat: leave the helm, walk to the stern and the bow (holding the move key), climb to the upper deck if there is one,
sit on every seat, turn the engine off and watch the boat coast and drift while the angler stays glued to the deck
(eye position in boat space, measured while the hull pitches and rolls), stand, walk back and return to the helm.
Prints one JSON line per boat; screenshots go to --out. Serve a built copy: vite build --outDir <dir>; vite preview --port N.
"""
import argparse, ctypes, json, os, time
from playwright.sync_api import sync_playwright

# stay inside the shared-machine rules: 8 of 16 cores, below normal priority (children inherit)
try:
    k = ctypes.windll.kernel32; h = k.GetCurrentProcess()
    k.SetProcessAffinityMask(h, 0x00FF); k.SetPriorityClass(h, 0x4000)
except Exception:
    pass

ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, default=5421)
ap.add_argument('--out', default='docs/deckwalk-shots')
ap.add_argument('--wait', type=float, default=10.0)
ap.add_argument('targets', nargs='+')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

JS_STATE = """(() => { const g = window.game, b = g.boat, d = g.deck, q = b.body.quat;
  const p = g.angler.position.clone().sub(b.body.pos); p.applyQuaternion(q.clone().invert());
  const up = 1 - 2 * (q.x * q.x + q.z * q.z);
  return { deck: d ? { x: +d.x.toFixed(2), z: +d.z.toFixed(2), level: d.level, seat: d.seat ? d.seat.label : null } : null,
    eye: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], tilt: +Math.acos(Math.min(1, up)).toFixed(3), speed: +b.speed.toFixed(2), eng: b.engineOn,
    pos: [+b.body.pos.x.toFixed(1), +b.body.pos.z.toFixed(1)] }; })()"""

def step(page, n, dt=0.02):
    page.evaluate(f'window.__step({n}, {dt})')

def walk(page, key, yaw, n=140):
    page.evaluate(f"(() => {{ const g = window.game; g.look.yaw = {yaw}; g.keys.add('{key}'); }})()")
    step(page, n)
    page.evaluate(f"window.game.keys.delete('{key}')")
    step(page, 3)

def shot(page, out, name):
    step(page, 6)
    time.sleep(0.25)
    fn = os.path.join(out, name + '.png')
    page.screenshot(path=fn)
    return fn

with sync_playwright() as p:
    exe = os.environ.get('CHROME_HEADLESS') or None
    b = p.chromium.launch(headless=True, executable_path=exe, args=['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=' + os.environ.get('ANGLE', 'd3d11'), '--enable-unsafe-swiftshader', '--disable-gpu-vsync'])
    for t in a.targets:
        boat, loc = t.split(':')
        ctx = b.new_context(viewport={'width': 960, 'height': 540}, device_scale_factor=1)
        page = ctx.new_page()
        errs = []
        page.on('console', lambda m, errs=errs: errs.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e, errs=errs: errs.append('PAGEERROR ' + str(e)))
        page.goto(f'http://localhost:{a.port}/?dev=1&loc={loc}&boat={boat}&hour=11', wait_until='load')
        time.sleep(a.wait)
        if not page.evaluate('!!(window.game && window.game.boat && window.__step)'):
            print(json.dumps({'boat': boat, 'error': 'not ready', 'errs': errs[:5]})); ctx.close(); continue
        step(page, 120)
        r = {'boat': boat, 'loc': loc, 'shots': []}
        S = lambda: page.evaluate(JS_STATE)
        r['helm'] = S()
        r['shots'].append(shot(page, a.out, f'{boat}_0helm'))
        page.evaluate('window.game.deckKey()')
        step(page, 20)
        r['left_helm'] = S()
        if r['left_helm']['deck'] is None:
            r['note'] = 'no deck walking (kayak)'
        else:
            # side lane first (consoles and cabins sit on the centre line), then aft to the stern and forward to the bow
            walk(page, 'd', 0.0, 120); r['lane'] = S()
            walk(page, 'w', 3.1416, 1400); r['stern'] = S(); r['shots'].append(shot(page, a.out, f'{boat}_1stern'))
            walk(page, 'w', 0.0, 2600); r['bow'] = S(); r['shots'].append(shot(page, a.out, f'{boat}_2bow'))
            walk(page, 'a', 0.0, 240); r['side'] = S()
            # upper deck
            up = page.evaluate("(() => { const D = window.__decks[game.boat.id]; return (D.climbs || []).filter(c => c.level === 0)[0] || null; })()")
            if up:
                page.evaluate(f"(() => {{ const d = game.deck; d.x = {up['x']}; d.z = {up['z']}; }})()")
                step(page, 15); page.evaluate('game.deckKey()'); step(page, 40)
                r['upper'] = S(); r['shots'].append(shot(page, a.out, f'{boat}_3upper'))
                walk(page, 'w', 0.0, 60); r['upper_walk'] = S()
                page.evaluate("(() => { const D = window.__decks[game.boat.id]; const c = D.climbs.find(c => c.level === 1); game.deck.x = c.x; game.deck.z = c.z; })()")
                step(page, 15); page.evaluate('game.deckKey()'); step(page, 40)
                r['down'] = S()
            # seats
            seats = page.evaluate("(window.__decks[game.boat.id].seats || []).map((s, i) => ({ i, level: s.level || 0, label: s.label }))")
            r['seats'] = []
            for s in seats:
                if s['level'] == 1:
                    # go up first
                    c = page.evaluate("window.__decks[game.boat.id].climbs.find(c => c.level === 0)")
                    page.evaluate(f"(() => {{ game.deck.level = 0; game.deck.x = {c['x']}; game.deck.z = {c['z']}; }})()"); step(page, 10); page.evaluate('game.deckKey()'); step(page, 30)
                else:
                    page.evaluate("game.deck.level = 0")
                page.evaluate(f"(() => {{ const s = window.__decks[game.boat.id].seats[{s['i']}]; game.deck.seat = null; game.deck.x = s.x + 0.3; game.deck.z = s.z + 0.2; }})()")
                step(page, 15); page.evaluate('game.deckKey()'); step(page, 40)
                st = S(); st['label'] = s['label']; r['seats'].append(st)
                r['shots'].append(shot(page, a.out, f"{boat}_4seat{s['i']}"))
                page.evaluate('game.deckKey()'); step(page, 20)       # stand again
            # engine off while sitting / standing: coast and drift
            page.evaluate("game.deck.level = 0")
            page.evaluate("(() => { game.deckStand && game.deckStand(); })()")
            page.evaluate("(() => { const b = game.boat; game.toggleEngine(); })()") if False else None
            # get some speed at the helm first
            page.evaluate("game.deck = null")
            page.evaluate("game.keys.add('w')"); step(page, 220); page.evaluate("game.keys.delete('w')")
            r['cruise'] = S()
            page.evaluate('game.deckKey()'); step(page, 20)
            page.evaluate('game.toggleEngine()')
            samples = []
            for i in range(5):
                step(page, 150); samples.append(S())
            r['coast'] = samples
            r['shots'].append(shot(page, a.out, f'{boat}_5engineoff'))
            # attachment: eye in boat space vs the deck coordinates while the hull moves
            drift = []
            for i in range(6):
                step(page, 40)
                s = S(); drift.append(s)
            r['attach'] = {'max_tilt': max(s['tilt'] for s in drift), 'eye_spread_x': round(max(s['eye'][0] for s in drift) - min(s['eye'][0] for s in drift), 3), 'eye_spread_z': round(max(s['eye'][2] for s in drift) - min(s['eye'][2] for s in drift), 3), 'eye_spread_y': round(max(s['eye'][1] for s in drift) - min(s['eye'][1] for s in drift), 3)}
            page.evaluate('game.toggleEngine()')
            # back to the helm
            page.evaluate("(() => { const b = game.boat; game.deck.x = b.spec.eye + 0.25; game.deck.z = 0.1; game.deck.level = 0; game.deck.seat = null; })()")
            step(page, 10); page.evaluate('game.deckKey()'); step(page, 40)
            r['returned'] = S()
        errs = [e for e in errs if 'WebSocket' not in e and 'vite' not in e.lower()]
        r['errors'] = errs[:6]
        print(json.dumps(r), flush=True)
        ctx.close()
    b.close()

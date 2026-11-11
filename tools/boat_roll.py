"""Headless roll / pitch / heave log for a boat sitting in the water (developer mode, nothing is saved or shown).

  python tools/boat_roll.py --port 5341 jon:bigbear jon:okeechobee jon:okeechobee:squall bass:okeechobee:squall

Each target is boat:location[:weather]. Weather is a dev weather id (clear, overcast, rain, squall...) held at 100 %.
Prints peak and rms roll and pitch in degrees and the heave range over the sample window, after a settling period.
Needs `pip install playwright`; set CHROME_HEADLESS=<chrome-headless-shell.exe> if playwright's own browser is missing.
"""
import argparse, json, math, os, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, default=5341)
ap.add_argument('--settle', type=int, default=300, help='frames to settle before sampling')
ap.add_argument('--frames', type=int, default=1500, help='frames sampled (at dt)')
ap.add_argument('--dt', type=float, default=1 / 30)
ap.add_argument('--hour', default='10')
ap.add_argument('--win', type=float, default=3.0, help='seconds per window for the peak-by-window lists')
ap.add_argument('--throttle', action='store_true', help='hold W (under way) while sampling')
ap.add_argument('--live', type=float, default=0, help='sample in REAL time for this many seconds (the water readback is asynchronous, so stepping frames in a burst does not move the waves)')
ap.add_argument('--steer', action='store_true', help='with --throttle: also hold A (turning)')
ap.add_argument('targets', nargs='+')
a = ap.parse_args()

JS = """async ([n, dt]) => {
  const out = { roll: [], pitch: [], y: [] };
  for (let i = 0; i < n; i += 3) {
    window.__step(3, dt);
    const b = game.boat.body.quat, x = b.x, y = b.y, z = b.z, w = b.w;
    // boat-frame image of world up: R^T * (0,1,0)
    const ux = 2 * (x * y - w * z), uy = 1 - 2 * (x * x + z * z), uz = 2 * (y * z + w * x);
    out.roll.push(Math.asin(Math.max(-1, Math.min(1, uz))) * 180 / Math.PI);       // + = starboard side down
    out.pitch.push(Math.asin(Math.max(-1, Math.min(1, ux))) * 180 / Math.PI);      // + = bow down
    out.y.push(game.boat.body.pos.y);
  }
  return out;
}"""

LIVE = """async ([secs, hz]) => {
  const out = { roll: [], pitch: [], y: [] }, t0 = performance.now();
  while ((performance.now() - t0) / 1000 < secs) {
    await new Promise((r) => setTimeout(r, 1000 / hz));
    const b = game.boat.body.quat, x = b.x, y = b.y, z = b.z, w = b.w;
    const ux = 2 * (x * y - w * z), uz = 2 * (y * z + w * x);
    out.roll.push(Math.asin(Math.max(-1, Math.min(1, uz))) * 180 / Math.PI);
    out.pitch.push(Math.asin(Math.max(-1, Math.min(1, ux))) * 180 / Math.PI);
    out.y.push(game.boat.body.pos.y);
  }
  return out;
}"""

def stats(xs):
    m = sum(xs) / len(xs)
    return dict(peak=max(abs(x - m) for x in xs), rms=math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs)), range=max(xs) - min(xs))

exe = os.environ.get('CHROME_HEADLESS') or None
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=exe, args=['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
    cur = None
    for t in a.targets:
        parts = t.split(':')
        boat, loc, wx = parts[0], parts[1], (parts[2] if len(parts) > 2 else None)
        if cur != loc:
            if cur is not None:
                ctx.close()
                time.sleep(1)
            ctx = b.new_context(viewport={'width': 640, 'height': 360})
            page = ctx.new_page()
            page.goto(f'http://localhost:{a.port}/?dev=1&loc={loc}&hour={a.hour}', wait_until='load')
            time.sleep(10)
            cur = loc
        page.evaluate("game.dev.wxLevel = 1.0")
        page.evaluate(f"game.dev.setWeather('{wx or 'clear'}')")
        page.evaluate(f"game.dev.spawnBoat('{boat}')")
        time.sleep(2)
        if a.live:
            time.sleep(a.settle / 30.0)         # settle in real time (settle frames at ~30 fps)
        else:
            page.evaluate(f"window.__step({a.settle}, {a.dt})")
        if a.throttle:
            page.keyboard.down('w')
            if a.steer:
                page.keyboard.down('a')
        r = page.evaluate(LIVE, [a.live, 30]) if a.live else page.evaluate(JS, [a.frames, a.dt])
        if a.throttle:
            page.keyboard.up('w')
            if a.steer:
                page.keyboard.up('a')
        sr, sp, sy = stats(r['roll']), stats(r['pitch']), stats(r['y'])
        per = max(1, int(round(a.win / (3 * a.dt)) if not a.live else int(round(a.win * 30))))     # samples are every 3 frames
        win = [round(max(abs(x) for x in r['roll'][i:i + per]), 1) for i in range(0, len(r['roll']), per)]
        winp = [round(max(abs(x) for x in r['pitch'][i:i + per]), 1) for i in range(0, len(r['pitch']), per)]
        print(json.dumps({'t': t + (':under-way' + ('+turn' if a.steer else '') if a.throttle else ''), 'rollPeak': round(sr['peak'], 2), 'rollRms': round(sr['rms'], 2), 'meanRoll': round(sum(r['roll']) / len(r['roll']), 2), 'meanPitch': round(sum(r['pitch']) / len(r['pitch']), 2), 'meanY': round(sum(r['y']) / len(r['y']), 3), 'pitchPeak': round(sp['peak'], 2), 'pitchRms': round(sp['rms'], 2), 'heaveRange': round(sy['range'], 2), 'rollByWindow': win, 'pitchByWindow': winp}), flush=True)
    b.close()

"""Headless audio check. Usage: python run.py <built-lab-dir> <out-dir> [realtime-seconds]
Build the lab first:  npx vite build -c tools/audio-lab/vite.config.js --outDir <built-lab-dir>
Serves the build on port 5472, runs offline renders (writes WAVs, prints peak/RMS per sound) and a real-time run
against a fake game (node counts, console errors). Needs Python Playwright + Chromium."""
import sys, base64, threading, http.server, functools, os
from playwright.sync_api import sync_playwright

d, out = sys.argv[1], sys.argv[2]
secs = int(sys.argv[3]) if len(sys.argv) > 3 else 70
os.makedirs(out, exist_ok=True)
h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=d)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 5472), h)
threading.Thread(target=srv.serve_forever, daemon=True).start()

ONE = [[n, p, 3] for n, p in [('ui', 1), ('uiOpen', 1), ('uiClose', 1), ('ping', 15), ('strike', 1), ('miss', 1), ('landed', 1), ('coin', 3), ('cast', 1), ('plop', 1), ('splash', 1), ('splash', 3), ('thrash', 1), ('hookset', 1), ('snap', 1), ('tick', 1), ('bump', 1), ('flop', 1), ('scoop', 1), ('livewell', 1), ('step', 1), ('hullSlap', 1), ('lap', 1), ('creak', 1), ('halyard', 1), ('bell', 1), ('blow', 1), ('gull', 1), ('songbird', 1), ('owl', 1), ('loon', 1), ('frogBull', 1), ('frogTree', 1), ('seal', 1), ('hippo', 1), ('wolf', 1), ('duck', 1), ('clank', 1)]]
LONG = [['winch', 4.5, 6], ['scream', 1, 4], ['anchorDown', 1, 5], ['anchorUp', 1, 5], ['engineStart', 1, 3], ['bilge', 1, 5], ['thunder', 400, 8], ['thunder', 3000, 9], ['foghorn', 1, 4], ['howler', 1, 7], ['distantEngine', 1, 15], ['truck', 1, 10], ['surf', 1, 9]]
BEDS = [['bed:idle', {'thr': 0.05, 'speed': 0}, 5], ['bed:cruise', {'thr': 1, 'speed': 8, 'night': 0}, 5], ['bed:rain', {'rain': 0.8, 'wind': 10, 'speed': 0}, 5], ['bed:night', {'night': 1, 'rain': 0, 'wind': 3}, 5], ['bed:gale', {'wind': 16, 'waveH': 1.6, 'thr': 0.2}, 5]]

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page()
    msgs = []
    pg.on('console', lambda m: msgs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: msgs.append('pageerror: ' + str(e)))
    pg.goto('http://127.0.0.1:5472/lab.html')
    pg.wait_for_function('() => !!window.renderOffline')

    def run(name, items, world=None):
        r = pg.evaluate('([i, w]) => renderOffline(i, w)', [items, world or {}])
        open(os.path.join(out, name + '.wav'), 'wb').write(base64.b64decode(r['wav']))
        print('==', name, 'overall', r['all'])
        for x in r['res']:
            print('  %-14s p=%-30s peak %6.1f dBFS  rms %6.1f' % (x['name'], x['p'], x['peakDb'], x['rmsDb']))
        return r

    r1 = run('oneshots', ONE)
    r2 = run('long', LONG)
    for loc in ['okeechobee', 'fjord']:
        run('beds_' + loc, BEDS, {'loc': loc, 'engineOn': True})
    for boat in ['jon', 'center', 'trawler']:
        run('engine_' + boat, [['bed:idle', {'thr': 0.05, 'speed': 0, 'boatId': boat}, 4], ['bed:cruise', {'thr': 1, 'speed': 8, 'boatId': boat}, 4]], {'engineOn': True, 'S': {'boatId': boat}})
    rt = pg.evaluate('(s) => realtime(s)', secs)
    print('== realtime')
    for s in rt['samples']:
        print('  ', s)
    print('errors in page:', rt['errs'])
    print('console:', msgs)
    live = [s['live'] for s in rt['samples']]
    print('live nodes: min', min(live), 'max', max(live), 'last', live[-1])
    print('PEAK max over all one-shots: %.1f dBFS' % max(x['peakDb'] for x in r1['res'] + r2['res']))
    b.close()

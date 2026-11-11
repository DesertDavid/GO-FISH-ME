import os, time, sys, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_HEADLESS') or None, args=['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=d3d11', '--enable-unsafe-swiftshader'])
    page = b.new_context(viewport={'width': 640, 'height': 360}).new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('http://localhost:5733/?dev=1&loc=bigbear', wait_until='load'); time.sleep(12)
    print(json.dumps(page.evaluate(sys.argv[1] if len(sys.argv) > 1 else "({docks: game.docks.list.map(d => [d.landing, Math.round(d.x), Math.round(d.z), Math.round(d.len)]), start: game.start, depth: game.heightAt(game.start.x, game.start.z)})"), indent=0)); print(errs[:5])

# Reel World - working notes

Read this first at the start of every session. Update it whenever a feature is finished.

## What it is
A first-person fishing game with realistic water: three.js + Vite, built on the Ultra-Water
ocean renderer (FFT ocean, buoyancy, sky, post-FX). 14 real locations, 145 fish species x 16
colour morphs, rods/reels/lines/lures, seven Blender-modelled boats (jon boat to purse seiner
with working nets), weather, a 24-hour clock with night fishing, docks and shore fishing, a
livewell and fish market, challenges and tournaments.

The user wants it to look great and never generic/"AI-made" (minimal marine-electronics HUD).

## Build and run
- Play: double-click `Play Reel World.bat`. It runs `tools/launcher.ps1`, which starts the
  Vite server hidden on port 5200 and opens an Edge app window (no tabs, add-ons or sync,
  own profile in `%LOCALAPPDATA%\ReelWorld\window`, so saves live there). Closing the window
  stops the server. `REELWORLD_PORT` env var picks another port for testing.
- Dev: `npm run dev -- --port 5200 --strictPort`. If 5200 is busy, the user is probably
  playing: use another port and leave theirs alone.
- Check a build: `npx vite build` (the >500 kB chunk warning is expected).
- URL options: `?loc=<id>` loads a location without touching the save.
- Dev hooks in the page: `window.game` (the Game), `window.__step(n, dt)` steps frames.
- `fishlab.html?ids=a,b,c&cols=2&n=4&dist=4.5` renders species models; `window.__shot(name)`
  there posts a PNG to a local receiver on 127.0.0.1:5300 (a tiny Python script, not in repo).
- Blender 5.2: `H:\Blender\blender-5.2.3-windows-x64\blender.exe`.
  - `blender -b --factory-startup --python tools/blender/build_boats.py` -> `public/models/boats/`
  - `blender -b --factory-startup --python tools/blender/build_hands.py [-- --preview DIR]`
    -> `public/models/hands.glb`
- Saves: localStorage `reelworld-save-v1`, settings `reelworld-settings-v1`.

## Git
Repo DesertDavid/GO-FISH-ME, branch `main`, repo-local identity already set (keeps the
user's email private). Conventional commit messages, NO attribution lines. Several sessions
may share this folder: commit only the files you changed and `git pull --rebase` before push.

## Code map (src/)
- `main.js` - engine setup: renderer, sky, ocean, terrain, overlay scene (rod/hands/held fish,
  lit by `ovSun`/`ovHemi` and `overlayFill`), post-FX. Exposes `engine` to the game.
- `game/game.js` - the Game: input (pointer lock on any click), camera, boat, walking/docks,
  catches, livewell, night, collisions (`obstacles.js`), menus via `ui.js`.
- `game/locations.js` - every location: heightfield `height(x,z)`, water look, waves, sky,
  trees, fish `pool`, `net` stocks; `LOCATION_ORDER`. `scene/terrain.js` renders terrain,
  shore rocks and `stacks` (sea stacks).
- `game/species.js` - species table + morphs; bodies in `fishBodies.js`, mesh `fishMesh.js`,
  skins `fishSkin.js`.
- `game/scenery.js` - instanced trees/props (pine, birch, cypress, palm, jungle, mangrove,
  reed, cabin, snag, acacia, cactus, stilt) + oil rig; returns colliders.
- `game/docks.js` - procedural docks on real shorelines; `livewell.js` - livewell + market.
- `game/rod.js` + `game/hands.js` - first-person rod, reel and Blender hands (left hand rides
  the crank; forearm hinges from a fixed elbow).
- `game/fishing.js` casting/bite/fight, `net.js` net boats, `troll.js` trolling,
  `sonar.js`, `weather.js`, `night.js`, `wildlife.js`, `aiBoats.js`, `tournaments.js`,
  `challenges.js`, `audio.js`, `save.js`, `settings.js`, `gear.js` (rods, reels, lines,
  lures, boats).

## Done
- Core fishing (cast, bite, fight with drag/tension), 145 species, morphs, journal.
- 14 locations: Okeechobee, Lake of the Woods, Tahoe, Columbia Gorge, Chesapeake Bay, Florida
  Keys, Mekong (Si Phan Don), Amazon, Lake Kariba (drowned forest), Lofoten fjords, Gulf of
  Mexico (oil rig), Cabo San Lucas (sea stacks), Great Barrier Reef, Bering Sea.
- Boats (7) incl. trawler/seiner nets; trolling; AI boats; weather; night fishing.
- Jon boat (starter): rebuilt as a riveted aluminium jon (flat bottom, 3 benches, bow deck, ply transom, tiller outboard, oars, fuel tank); `jon_sections()` in `build_boats.py` keeps the old length/beam/depth/sheer so buoyancy and eye height are unchanged.
- Docks + shore fishing (G to step off, walk with WASD); livewell + daily market (L).
- Boat collisions with drowned trees, sea stacks, docks, rig legs.
- Blender-built first-person hands; left hand follows the crank.
- Standalone Edge app-window launcher; mouse lock on any click; no right-click menu.
- Closing any menu (button, Back, click outside, Esc/Tab) re-grabs the mouse inside that same gesture (`ui.close/forceClose` -> `game.grabPointer`). If the browser refuses (cooldown after its own Esc unlock) it is silent and retried on the next key or click on the view; travel reloads the page, so that one still needs a click.
- Travel menu postcards: `public/images/locations/<id>.webp` (800x450, 40-100 KB, made with the local
  image generator, one prompt per place, same photo style/seed; shown in `.loc-pic`, dimmed when
  locked). To redo one, regenerate at 1344x768 and resize/compress to webp.

- Fish finder (sonar) panel toggle: `F` key + Settings checkbox, saved as `sonar` in settings;
  hidden = no per-frame sonar drawing (also hidden on foot).
- Holster the rod: `X` toggles held/put away (`Game.toggleHolster`, `rod.holster` 0..1 eases the rod
  and hands down out of view). Refused while a line is out/fighting; casting is off while holstered.

## Known gaps / ideas
- No angler body when walking in third person.
- Net hauls still sell instantly (not through the livewell).
- Saves from Firefox don't carry into the new Edge app window (could add export/import).
- `public/models/hands.glb` is ~2.9 MB (could be Draco/meshopt compressed).

## Next (proposed)
- (nothing queued)

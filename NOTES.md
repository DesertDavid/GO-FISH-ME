# Reel World - working notes

Read this first at the start of every session. Update it whenever a feature is finished.

## How we work (the user's rules)
- The main session builds: plans, writes code, talks to the user.
- Searching/reading lots of files, docs or the web: send a Haiku helper, get back only what matters.
- Opus helper as advisor only: (1) review the plan before a big change, (2) diagnose an error that
  happened twice, (3) check for misses before calling anything non-trivial done. Give it a short
  written summary, never the whole conversation; at most one Opus check per task.
- Small, simple tasks: no helpers.
- Read only the parts of files needed; don't re-read unchanged files.
- When a feature is done or the chat gets long: update this file, then tell the user
  "good point to start a fresh session."

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
    -> `public/models/hands.glb` (Draco-compressed on export, 2.9 MB -> 0.48 MB; max vertex error ~4 um,
       normals 0.06 deg. `hands.js` loads it through DRACOLoader, decoder files live in `public/draco/`,
       copied from three/examples/jsm/libs/draco - refresh them if three is upgraded)
- Saves: localStorage `reelworld-save-v1` (the live autosave), `reelworld-slots-v1` (named slots), settings `reelworld-settings-v1`. `?loc=<id>` pages never write the autosave (`save.js` frozen flag).

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
- Chart (key C, also in the Esc menu): `game/chart.js`. North-up map of the current water drawn
  from `loc.height` (cached per location in a 560 px canvas: depth shading + contours, hillshaded
  land, shoreline), range grid, your boat/position with heading, and dock markers. Docks now have
  roles (`dockProfile`): dock 0 Marina (fish market + bait & tackle + boat dealer), dock 1 Bait
  shop (market + tackle), others Fish buyer (market only). Selling already needed a dock; now the
  Tackle shop (B) and Marina (Y) also only open at a dock with that service (`Game.serviceHere`,
  gated in `ui.open`; toast says which dock and how far). Water with no docks (offshore) keeps the
  buyer boat and everything is available. Tackle box (T) stays available anywhere.
- Compass bar (`game/compass.js`, canvas `#compass`, top centre): heading tape read from the camera (0 = north = -z, same north as the Chart), 5 deg ticks, N/NE/... labels, numeric readout + cardinal. Waypoints are per location in `save.waypoints[locId]` (max 12): `Z` drops one at your position, `Shift+Z` clears all, clicking the Chart sets one (on a dock marker = named after the dock) or removes one you click; the Chart side panel lists them. On the tape they show as amber diamonds with name + distance, edge-clamped arrows with distance when off the tape. Settings checkbox `compass` hides the bar.
- Save / Load (Esc menu, `game/saveSlots.js` + `renderSaves` in ui.js): autosave row + 4 named slots, each showing place, money, day, waters, journal, play time (`save.played`, seconds) and last-saved time. Save (asks to overwrite), Load (asks, then freezes writes, installs the snapshot as `reelworld-save-v1` and reloads), Delete (asks), Export/Import of a versioned `.reelworld` JSON file (`{format:'reelworld-save',version:1,save}`, validated in `parseFile`/`sanitizeSave`, friendly error on a bad file; imports go into the chosen slot, then Load it). First run copies an existing autosave into slot 1 (autosave itself untouched). Disk backup: dev-server middleware in `vite.config.js` (`/__reelworld/backup/<autosave|slot-N>`, localhost only, fixed names) writes `%LOCALAPPDATA%\ReelWorld\saves` (other ports: `saves-<port>`, or `REELWORLD_SAVES_DIR`); autosave copy once a minute; a fresh browser profile shows a "Disk backup" Restore row and a toast. No key; Controls help mentions the Esc menu entry.

- Bait & lure matching (`game/src/game/bait.js` logic, `baitData.js` = ALL tunable numbers/tables). Each species gets a derived profile (family `body`, diet, typical size, depth class `s/m/b`, per-id hash for variety) with hand overrides in `OVERRIDES` (bass: worms/cranks, trout: flies/spinners, tuna/marlin/mahi/wahoo: trolled skirts, catfish: cut bait at night, ...). `fit(sp, cond)` = lure x depth x time x weather x colour, each factor floored (`TUNING.floor`) so a bad match is only slower. Lure: diet letters (miss = 0.14, not 0) x kind multiplier (`LURE_KIND` -> `BODY_KIND[body]`, per-species `kind`/`lure`) x size sanity. Depth: gaussian around the species' preferred metres (bottom fish: gap above the bottom), shallower at night, deeper at noon. Time: 4 anchors dawn/day/dusk/night interpolated round the clock (`NIGHT_FEEDERS` forced to a night profile). Weather: per family over clear/partly/overcast/rain/storm. `fishing.js` `matchInfo()` (cached 0.4 s) runs `poolFit` over the location's pool: per-species weights pick which fish bites, and the pool's average fit scales the bite rate (`TUNING.rate`, ~0.4x..1.55x). The global dawn/dusk `tod` and `weather.bite` multipliers still apply on top. New lures in `gear.js` only need an entry in `LURE_KIND` (unlisted = diet match only). Retrieve depth: a paused mid-water lure sinks (`TUNING.sink`), reeling or trolling brings it up; bobber/bottom/surface lures keep their fixed depth. Trolling strikes weight species by the same time/weather fit.
  - Journal hints (`Ui.hintHtml`): unknown species show nothing; caught ones reveal progressively by catch count (`TUNING.hints`: 1 = favourite lure types + the lure the first one took, 2 = depth strip with fish silhouette, 3 = dawn/day/dusk/night bars, 4 = weather bars). Save: `journal[id].how = {lure, depth, hour}` is stored on the first catch (optional; old saves just have no `how`, no migration needed). The catch card of a new species says what it took.
  - Fish finder: ambient fish hold at their species' preferred depth for the hour (`holdDepth`), arches are thicker/brighter for bigger fish. Optional Settings toggle "Bite quality ticks" (`biteQuality`, off by default) adds 3 ticks to the lure marker.
  - Tune by running `poolFit`/`fit` headless (pure modules, no three.js): `node` can import `species.js`, `gear.js`, `locations.js`, `bait.js` directly.

- Progression (`game/progress.js`, all numbers live there; gate tables are kept out of gear.js/locations.js). Save format is now `v: 2` (`SAVE_VERSION`); `upgradeSave()` runs from `loadSave` and `sanitizeSave` (slot/file import), is idempotent, and derives xp/wear/permits for old saves. Export files are `version: 2` (v1 files still import).
  - **XP / level**: cumulative XP for level L = `80 * (L-1)^1.6` (L2 80, L5 733, L10 2,700, L16 ~5,700, cap L25). Per fish: `min(70, 6 + 5*sqrt(lb))` + `2*log2(1+price/lb)` + colour `(morph.value-1)*8` + new species 40 + new variant 20 + personal best 15 + trophy (>70% of record) 25. Challenge: `15 + reward/8`. Tournament: 250/150/90 for 1st/2nd/3rd, 30 otherwise. Net haul: `min(80, sqrt(total$)/3)`. A first bass is ~60 xp, so level 2 comes in a couple of fish, level 5 in roughly 20-25.
  - **Gates** (`GATES`): buying a rod/reel/line/boat or opening waters needs the angler level (cash price unchanged; lures are never gated). Rods: ultralight/medium 1, MH casting 3, fly/flipping 4, inshore 5, surf 7, stand-up 11, big game 16. Reels: 1/3/4/5/8/11/14/18. Lines: 1,1,3,4,6,9,12,16. Boats: bass 4, skiff 6, centre console 10, trawler 13, sportfisher 15, seiner 19. Waters: woods 3, tahoe 5, columbia/chesapeake 6, keys 7, mekong 8, amazon 9, kariba 10, fjord 12, gulf 13, cabo 14, reef 16, bering 18. Existing saves keep what they own (migration lifts their level to cover it). The old `unlock()` travel purchase is now "Open waters" (level + cash); `save.unlocked` logic unchanged.
  - **Gear stats that matter in the fight**: rod `cast` (cast distance, times `lineCastMul = clamp(1.08 - test/400, .8, 1.05)`: thin line casts farther), `sens` (strike window, and low-sens rods telegraph only `0.45+0.55*sens` of nibbles), `lift`, `power`; reel `drag`, `cap` (spooled = lost fish), `ratio`, and `REEL_SMOOTH` (0.6 cheap .. 0.98 big game): while the drag is slipping, tension jerks by up to `(1-smooth)*35%`, which is what snaps light line on a cheap reel; line `test`/`stretch`/braid. The shop shows +/- against what you have equipped.
  - **Wear** (`save.wear = {line, hook, lost[]}`, 0..1): line `+0.003` per cast, `+dt*(0.0008+0.0022*(T/test)^2)` while fighting (a 30 s fight at 60% load ~0.03); effective test = `test*(1-0.45*wear^1.5)` (frayed line breaks ~20-45% low, "frayed" in the snap message). Hook `+0.04` per hooked fish, `+0.12` per snag; hookset chance x`(1-0.4*hook)`. Snags only for non-bobber lures that are moving: bottom lures 0.6%/s, mid-water 0.15%/s; 65% you work it free (hook duller, line +0.02), 35% it breaks off: that lure is added to `wear.lost`, a nightcrawler is tied on, and it can be restocked at the tackle shop. Trolling-spread gear is never worn. Costs (Tackle shop > Service & permits): respool `max(3, 35% of line price)`, sharpen $4, restock `max(5, 50% of lure price)`.
  - **Permits** (`save.permits[locId] = {until: absolute game hours}`, `absHours = (day-1)*24 + hour`): casting, trolling and shooting a net need one for the current water (a running tournament covers you). Price base `8 + 0.6*sqrt(location price)`; 1-day x1, 3-day x2.4, 7-day x4.5, rounded to $5 (Okeechobee $10/$25/$45, Bering ~$155 a day). Buying again extends a running permit. Sold wherever the tackle shop is (Marina and Bait shop docks on the Chart; the supply boat on dock-less water), tab "Service & permits". New games start with a 3-day Okeechobee permit; migrated saves get 3 days at their current water and Okeechobee. HUD gear line shows `permit 2 d left` / `no permit`, toasts at 2 h left and on expiry, and arriving somewhere without one says where to buy.
  - UI: HUD level + XP bar under the weather line (`+n xp` flash), a level-up banner listing what opened, Esc > Angler log (next unlocks, line/hook condition, permit), level on each Save/Load row, XP on the catch card and tournament result, level/permit lines on Travel cards, "Reach level N" instead of Buy in shop/marina.

## Known gaps / ideas
- No angler body when walking in third person.
- Net hauls still sell instantly (not through the livewell).
- Saves from Firefox don't carry into the Edge app window automatically: use Esc > Save / Load > Export, then Import in the other browser.

## Next (proposed)
- (nothing queued)

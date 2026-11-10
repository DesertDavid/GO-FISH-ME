# Developer mode

A free-fly camera and a compact panel for testing Reel World: spawn any boat, jump to any water, set the weather and time of day, loan tackle, hook a chosen fish, look at frame stats. It is off by default and nothing it does is ever saved.

## Turning it on

- **Settings > Gameplay > Developer tools** (stored in your settings; flip it back off any time), or
- open the game with **`?dev=1`** in the address (for that page only; never stored). `?dev=1` pages are frozen from the first frame.

While it is off the two keys do nothing but show a one-time hint, so pressing them by accident is harmless.

## Keys (rebindable in Settings > Controls > Developer)

| Key | Does |
| --- | --- |
| `` ` `` | Developer panel (the pause menu also gets a "Developer tools" entry) |
| `\` | Free-fly camera on / off |

Free-fly: **WASD** move (follows your move binds), **Space / E** up, **Q / Ctrl** down (prefer Q: Ctrl+W closes a browser tab), **Shift** 4x faster, **mouse** looks (locked pointer or right-drag, with your sensitivity), **wheel** changes speed (1 to 2500 m/s). It ignores terrain, water and buildings. The boat and angler stay where they were (the jellybean body is visible from outside); casting, the boat controls and the Talk / Events keys are disabled while flying. The world (buildings, fish, birds, wildlife) streams around the camera, not the boat. Optional "Boat follows the camera" tags the boat along over water. Leaving fly mode hands the camera back to the helm with nothing changed.

A **DEV** marker under the compass shows the state ("fly 40 m/s", "clock paused", "saving paused") so a dev session is never mistaken for normal play.

## The panel

| Tab | What it has |
| --- | --- |
| View | fly toggle, fly speed, boat-follows toggle, first person / over the shoulder (jellybean) / boat overview, FPS counter, stats overlay, fish finder |
| Boats | spawn any of the 11 boats (jon, kayak, bass, skiff, pontoon, bay boat, center console, sportfisher, trawler, seiner, yacht) on any water, instantly, without owning or unlocking them. "Fit every upgrade" fits all upgrades on whichever boat you spawn. Flying over water: the boat appears under the camera |
| World | location picker (all 14; reloads as `?dev=1&loc=...`, carrying boat, hour and fly), time-of-day slider, clock pause, weather (auto, clear, partly, overcast, rain, fog bank, squall) held at a chosen intensity, "strike now" lightning, tide held high / low |
| Gear | any rod, any lure (loaned and equipped), "loan all tackle", free fishing permit |
| Fish | species (this water first), colour variant, size from tiny to just over the record; **Hook it** (fight starts now, in front of the boat) or **Land it** (straight to the catch card) |
| Teleport | the chart's marinas, bait shops and fish buyers (boat goes to the dock), shop doors and the trophy hall (you stand there on foot), the launch point; while flying, the camera goes above the spot |
| Player | money presets, angler level slider (both session only), a note on saving |

The stats overlay (bottom left) shows frame time (average and worst), draw calls and triangles for the whole frame (reflection, water, overlay and post included), active and ambient fish, GPU geometries and textures, JS heap (Chromium) and position.

## Saving is paused, never mixed

The first time the panel or fly camera is used (or at page load with `?dev=1`) the game writes your real progress once and then freezes saving: the autosave, the save slots (the Save / Load screen says so) and the on-disk backup all stop until you reload. Money, level, loaned tackle, spawned boats, weather and time set from the panel exist only in memory. Dev options (fly speed, overlays...) are never stored. The only thing persisted is the "Developer tools" switch itself, and it only matters for the keys. Reload the page (or "Leave the dev session") to get the normal game back with your real save.

Verified headlessly: `localStorage` (save, slots, settings) is byte-identical before and after a long session of spawning boats, switching waters, loaning tackle, hooking fish, setting money and level.

## Page hooks for tests

`?dev=1&loc=<id>&boat=<id>&hour=<0-24>&fly=1&up=1` (all optional) start a dev session straight in a place. In the console: `game.dev` (`toggleFly()`, `spawnBoat(id)`, `setWeather(id)`, `teleport(i)`, `spots()`, ...), plus the older `game.devLand(id, lb)`, `game.devFight(id, lb)`, `game.devHaul(lb)`, `game.weather.force('fog'|'squall'|'clear')` and `window.__step(n, dt)`.

## Where it lives

`src/game/dev.js` (state, camera, actions), `devPanel.js` (HTML), `dev.css`; small hooks in `game.js` (`this.dev`), `weather.js` (`devLevel`, `devRain`, `devTide`), `save.js` / `saveSlots.js` (`isFrozen`), `keys.js`, `settings.js`, `ui.js`.

# Art-direction audit: what still reads as AI-made

Method: the production build was run headless (Edge via Playwright) on spare ports and
screenshotted at 1280x720: 9 locations by day and night (`w-*`), the pause, travel, chart,
journal, shop, tackle, tournaments, livewell, talk and settings screens (`ui-*`), the HUD,
the fish lab (`fishlab-*`) and the postcard sheet. Screenshots are in `docs/art-audit/`.
Caveat: the headless boat is stepped with 200 big frames, so some boat attitudes (Cabo,
reef, Bering) are tilted by sea state; that is not judged here.

Status: **FIXED** = done in the commit that adds this file. The rest is open.

## Ranked punch list

| # | What | Where | Why it reads as AI | Fix | Effort |
|---|------|-------|-------------------|-----|--------|
| 1 | **Postcards share one recipe** (**FIXED**: 14 regenerated locally, one composition and light per place, film grain; stray file deleted; see `postcards-after.jpg`) | `public/images/locations/*.webp`, `postcards-sheet.jpg` | Same horizon-in-the-middle frame, same soft overcast grade, plastic water, no people, no gear. A stray file with a prompt as its name is still in the folder. | Regenerate with the local image generator, one composition per place (dock at dusk, bow shot, shoreline from a hide), add film grain and a different grade per region; delete the stray file. | L |
| 2 | **Scenery is stamped** | `scenery.js`, `bld*.js` | Three mesh variants per tree type, even random scatter, tint jitter only per vertex. **FIXED** for trees and plants: six variants, stands with gaps (fbm density), per-tree tint, uneven width, 40 % lean, size skewed small with the odd big one. Open: dead trees, fallen logs, and the same repetition in `bld*.js` buildings. | Dead and fallen trees, per-instance variation for buildings. | M |
| 3 | **Hands and boat are showroom-clean** | `hands.js`, jon boat in `tools/blender/build_boats.py` | One smooth skin tone on every location and weather, no sleeve, no dirt. The jon boat is a uniform grey with no scuffs, water line, rust or gear in it. | Weather-grade hand albedo (sunburn, gloves in the cold), grime and scuff map on hulls, rope, a bailer, a cooler. | M |
| 4 | **Night glow orb on the rod tip** | `rod.js` night light | A perfectly round white sphere with no falloff; reads as a game marker, not a light. | Small warm LED with a cone, flicker and a hint of bloom. | S |
| 5 | **Fish are airbrushed** | `fishSkin.js`, `fishlab-before.jpg` | Every individual of a species identical; evenly spaced bars; a lateral line ruled with a straight edge; smooth gradients. **FIXED** for patterns: uneven bars (gaps, width, lean, forks), jittered blotch rows, wavering dashed lateral line, 3 random skins per species and morph. Still open: hero meshes, fin rays and scale normal map are uniform. | Per-individual scale-normal noise, scars and a few missing scales, fin ray width variance. | M |
| 6 | **One typeface for everything** | `ui.css` | Source Sans 3 is the default web UI face, and it was fetched from Google. Offline it fell back to Segoe UI. **FIXED**: self-hosted B612 (cockpit display face), B612 Mono for every number and key, Newsreader for spoken lines and notes. | | S |
| 7 | **Amber on everything** | `ui.css` | Prices, key names, badges, tabs, buttons and links were all amber, so it carried no meaning. **FIXED**: amber now marks the main action, "in use" / "here" and warnings only. Money and keys are plain text. | | S |
| 8 | **Every panel has the same shape** | `ui.js` panels | Big bold title left, Back right, list below; identical in Travel, Journal, Tackle and Tournaments. Partly **FIXED**: title bar with a ruled underline in capitals, small mono tabs. Open: panels still fill the same centred column. | Per-panel layout: chart-plotter split view for Chart, a ledger for Journal, a page of the tide table for Livewell. | M |
| 9 | **Toast and UI copy over-eager** | toasts in `fishing.js`, `net.js`, `troll.js` | "SNAP!", "FISH ON! ...is screaming", "Missed the hookset!", "Pursed around the school!" and many trailing ellipses. **FIXED** for these three files (dry, specific voice: "Line parted at the frayed stretch."). **FIXED** in `game.js` too ("Bought the X.", "Released. Luck is up for three minutes."); the rest of its toasts were already plain. Shopkeeper dialogue was checked and is already specific per place. | | S |
| 10 | **Menu help text reads as a manual** | Help and Controls panel | Long parenthetical key labels in one uniform structure. | Shorter harbour-notice phrasing; group by activity. | S |
| 11 | **Colour grading** | water and sky per location | Same saturated blue sky and the same contrast curve everywhere; Tahoe and Kariba look alike. | Per-location grade (haze colour, black point, saturation), see `LOC` sky settings. | M |
| 12 | **Audio uniformity** | `audio.js` | Not audited in this pass (headless). Known: single splash and reel samples with no pitch variance. | Random pitch and gain per play, 3 to 4 variants. | S |
| 13 | **Tahoe water highlights tile** | Tahoe day shot | Specular caustic blobs repeat visibly at the same spacing. | Break the highlight texture with a second scale. | S |

## What changed in this pass
- `src/game/ink.css` (new): type pairing, tabular numbers, hairline buttons, ruled page headers, serif for the spoken voice, alias of the canvas font names to B612. Loaded after `ui.css`, so no menu code was touched.
- Fonts via `@fontsource` (OFL), bundled by Vite; nothing is fetched at run time. Added to `package.json`.
- Toast copy in `fishing.js`, `net.js`, `troll.js`.
- `fishSkin.js` / `fishMesh.js`: organic patterns and per-individual skin variants.

Before/after: `fishlab-before.jpg` / `fishlab-after.jpg`, `ui-pause|chart|map|hud.jpg` / `after-ui-*.jpg`.

# Water depths

How deep each of the 14 waters is in the real world, how deep it was in the game before, and how deep it is now. Measured by sampling `height(x, z)` over the whole map (`tools/_depths.mjs` prints the same table). Metres.

## The in-game scale

- **Real depth up to about 100 m is kept as is.** Past that it is compressed (roughly 0.35 to 0.5 x), so the very deep waters stay playable: Tahoe 501 m real is about 225 m in the game, a Lofoten fjord 400 m is about 220 m, the open Gulf and Cabo are 150 to 400 m.
- Why: the fish finder auto-ranges up to **450 m** (was 200), a lure is dropped at about 1.4 m/s and hauled back at 3 to 4 m/s, and a hooked fish dives at 1.5 m/s. Below roughly 300 m nothing a player can do differs from 250 m, so extra depth would only make the lure take longer to fall.
- Okeechobee stays shallow (4 to 5 m) on purpose. The Keys flats stay shallow, only the channels deepen.

## Table

| Water | Real world | Before (median / max) | Now (median / max) | Notes |
| --- | --- | --- | --- | --- |
| Lake Okeechobee | avg 2.7 m, max about 4.5 m | 4 / 5 | 4 / 5 | unchanged on purpose |
| Lake of the Woods | max about 64 m, most of the lake 8 to 10 m | 11 / 16 | 22 / 66 | deep basins with holes and humps, the island shallows are kept |
| Lake Tahoe | max 501 m, avg 300 m | 104 / 110 | 208 / 238 | steep shelf, flat basin floor with humps (compressed) |
| Columbia Gorge | channel 20 to 60 m | 12 / 17 | 32 / 62 | thalweg with scour holes, bank shallows kept |
| Chesapeake Bay | bay 6 to 10 m, channel 20 to 50 m | 8 / 18 | 9 / 52 | open bay stays mid, the shipping channel and holes go deep |
| Florida Keys | flats 1 to 2 m, channels 3 to 15 m | 1 / 6 | 1 / 19 | flats untouched, channels cut deeper |
| Mekong (Si Phan Don) | pools up to 30 to 90 m | 11 / 16 | 24 / 65 | deep pools between the shallows |
| Amazon | channel 20 to 50 m, bends to 100 m | 9 / 12 | 32 / 58 | channel plus outside-of-bend scours |
| Lake Kariba | avg 29 m, about 97 m by the dam | 14 / 31 | 29 / 105 | drowned valley floor, drowned-tree flats stay at 1 to 4 m |
| Lofoten fjords | 100 to 400 m | 60 / 86 | 161 / 244 | steep walls (compressed) |
| Gulf of Mexico | shelf and slope 100 to 3000 m, rigs on 100 to 300 m | 300 flat | 177 / 291 | salt-dome banks up to about 40 m, one under the rig |
| Cabo San Lucas | drops to 1000 m within a mile or two of the cape | 276 / 297 | 374 / 443 | canyon holes, ledges (compressed) |
| Great Barrier Reef | lagoon 10 to 40 m, outer slope past 200 m | 38 / 42 | 167 / 207 | reef flats (under 6 m) kept, steep drop outside |
| Bering Sea | shelf 50 to 200 m, shelf break past 200 | 200 flat | 134 / 223 | gullies, banks and a shelf break |

## How the bathymetry is made

`locations.js` keeps each water's original shape (`rawHeight`) and runs it through `deepen(h, x, z, cfg)`:

- Depth up to `knee` (3 to 7 m) is untouched, so shorelines, docks, flats, drowned trees, rocks, sea stacks and the rig are exactly where they were.
- Deeper water is stretched from the old maximum (`ref`) to `max`, shaped by `pow` (below 1 = steep walls, above 1 = a gentle shelf that falls away late), with a slow noise swell (`feat`), deep holes and scours (`hole`) and humps and ledges (`hump`).
- Gulf and Bering have their own profile functions (they used to be flat).

## What reads the depth

- **Water and terrain look**: the water shader colours by real depth (per-water absorption), and the seabed mesh is cut away below 34 m, so deep water simply goes dark blue then black.
- **Sonar**: auto-ranges to 450 m; the arches sit where each species holds.
- **Lure depth**: a lure left to sink falls up to the bottom (was capped about 8 m below the surface), falls faster the more line is out, and comes back up faster when reeled.
- **Species**: bottom species have a habitat band in `baitData.js` (`OVERRIDES.<id>.band`, default 0 to 45 m of bottom depth). Outside it the depth match falls off, so walleye are not picked over burbot in a 60 m hole and cod are only common in the fjord below about 8 m. Lake trout, kokanee (10 to 32 m), whitefish, burbot, cod, halibut, ling, tusk, sablefish, snappers, groupers, amberjack and swordfish are the deep-water species. Mid-water and surface species are not tied to the bottom.
- **Ambient fish and the finder**: a spawn is weighted by the same band; fish deeper than 32 m are sonar-only markers (no mesh is built).
- **Chart (C)**: depth shading to 300 m, contours every 5 m (0 to 20 m), 20 m (to 100 m) and 50 m beyond, and soundings.

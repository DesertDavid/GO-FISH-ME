# Big Bear Lake, California - research and how it was built

Reel World location `bigbear` (the starting lake). Rebuilt 2026-11-10 from real survey and map data instead of knot tables.
Rule followed: every real lake is built from topography/bathymetry plus satellite/aerial imagery, each fact cross-checked from at least two sources.

## Sources and what each was used for

| What | Source | Used for |
| --- | --- | --- |
| Lake bed | BBMWD / Fugro-Pelagos multibeam hydrographic survey, "Water Depths, Chart 1 of 2" (https://bbmwd.specialdistrict.org/files/d62fd44e0/LakeBathMap.pdf, supplied by the user; lake maps page https://www.bbmwd.com/lake-maps) | depth everywhere (colour ramp 0-70 ft, read pixel by pixel), names and positions of the points and bays |
| Shoreline | OpenStreetMap `Big Bear Lake` relation 4045674 (outline traced from Bing aerial imagery; 1,456 vertices, 3 island rings), via the Overpass API, plus Google Maps view the user supplied | the exact outline, Garstin Island, every bay and point |
| Land relief | SRTM 30 m elevation (OpenTopoData), sampled every 200 m (61 x 61 posts); lake surface 2,057.5 m | mountain walls, the valley floor, the dam canyon, peak heights |
| Places | OpenStreetMap nodes/ways: places, bays, peaks, slipways, piers, hotels, 7,332 building centres inside the game map, main roads | landing positions, settlement layout, road network |
| Facts | Wikipedia "Big Bear Lake"; bigbear.com (lake safety page, history and names); Casago "Treasure Island / Garstin Island"; USGS OFR 72-295 | size, depth, dam history, ramps, island names, climate |

### Cross-checks
- **Outline vs. survey chart:** the survey chart's water mask, fitted to the OSM outline (scale + tiny rotation + shift, 1,872,890 px), overlaps it at **IoU 0.90**. Two independent sources (Bing-traced OSM, 2008 multibeam survey) agree on the shape; the residual is the survey being drawn at maximum lake level.
- **Area:** OSM outline = 11.46 km2 = 2,832 acres vs Wikipedia 2,971 acres (4.7 % low: the imagery shows a lowered lake).
- **Length:** OSM bounding box 10.2 km vs "about 7 miles (11 km)". Max width ~2.5 mi is the west basin including bays.
- **Depth:** survey ramp tops out at the dam (dark blue/purple, ~70 ft) = Wikipedia "72 ft at the dam"; the east end is red/orange (0-10 ft) = "shallow east". The USGS 1972 report says "generally less than 50 ft".
- **Island:** OSM island rings at the dam end, the survey chart labels "Garstin Island" at the dam end, and bigbear.com/Casago place Treasure/China/Garstin Island next to Bear Valley Dam. The old game placed it in the east basin: that was wrong.
- **Relief:** SRTM at OSM peak nodes: Butler Peak 2,571 m, Bertha Peak 2,499 m, Grays Peak 2,414 m, lake 2,057 m = 350-500 m of relief, consistent with the USGS quadrangle description of the walls.

## What the data says (summary)
- East-west reservoir, 6,743-6,750 ft (2,057 m), 2,971 acres, ~35 ft average depth, max 72 ft at the dam. Dam (1912 multiple-arch, 72 ft high) at the west end; Highway 18 crosses it on a bridge. The 1884 single-arch granite dam lies ~200-300 ft upstream, mostly under ~20 ft of water.
- Shape from the survey chart and the outline: a deep, wide west basin that runs SW-NE from the dam; **Papoose Bay, Boulder Bay and Metcalf Bay** are long fingers on the south shore (Inspiration Point between Papoose/Boulder and Metcalf); **Grout Bay** is a notch on the north shore with Windy Point, Big Bear Solar Observatory, Gilner Point on the north side; a wide, shallow, flat-bottomed central basin (about 9-15 ft in the middle, labelled "BIG BEAR LAKE" on the chart) bounded by Eagle Point on the south; then a narrower shallow arm east past Juniper Point to the East Public Boat Ramp and the **Stanfield Cutoff causeway** at the east end, with Stanfield Marsh beyond.
- Public ramps (both North Shore, BBMWD): **West Ramp** (Duane Boyer) west of Fawnskin near the dam, **East Ramp** (Carol Morrison) near the Stanfield Cutoff and the Discovery Center.
- Communities: Fawnskin (north shore, Grout Bay, Hwy 38 / North Shore Dr), Big Bear Lake / the Village + Pine Knot (south shore, Big Bear Blvd), Boulder Bay, Metcalf Bay, Moonridge and the Snow Summit / Bear Mountain ski areas behind the south shore, Big Bear City east (beyond the game map).
- Climate: 186 freezing days a year, ~72 in of snow at lake level, ~20 in precipitation, afternoon valley winds, summer afternoon thunderstorms; bald eagles winter here (annual Bald Eagle Count).
- Forest: San Bernardino National Forest. North shore faces south (dry): Jeffrey/Coulter pine with oak, juniper, manzanita/chaparral; south shore faces north (cool): white fir, incense cedar, Jeffrey pine; lodgepole high; willow/cottonwood and alder at the water; juniper and pinyon-chaparral lower and east toward Baldwin Lake. (General regional ecology; the OSM landcover polygons were too sparse to use.)

## How it is built in the game
- **Scale:** every real metre is **0.4 game metres** in x and z (the lake is 4.1 km long instead of 10.2 km and up to 0.8 km wide instead of 2 km). Depths are real (max about 17 m after smoothing, 21 m in the narrow dam arm of the chart); land relief is 0.8 x real. x east, z south.
- `tools/bigbear/` has every baking script (`asm.py` assemble the outline, `fit.py` fit the survey chart onto it, `bathy3.py` colour -> depth, `grid.py` depth grid + signed shoreline distance, `dem2.py` SRTM grid, `mkdata.py` -> `src/game/bigbearData.js`, `town.py` -> `src/game/bigbearTown.js`, `shots.py` / `probe.py` headless checks). Raw inputs kept: `ring.json`, `dem.json`, `fit.json`, `grid_meta.json`. The 4 MB survey PDF is not stored (link above).
- `bigbearData.js`: 521 x 185 depth grid (8 m cells, 0.1 m units), signed distance to the true shoreline (1 m units, +land), 61 x 61 SRTM posts. `locations.js bbHeight()` = survey depth easing up to the waterline over the first metres; land = a short beach then SRTM relief, with noise, ridged granite bands, and the valley closing at the map's ends.
- Landings at real places (game coordinates measured from OSM piers/slipways): Pine Knot Marina, Holloway's Marina, Fawnskin (Grout Bay), West Public Ramp, East Public Ramp, Boulder Bay, Metcalf Bay, Gray's Landing (historic fishing camp on North Shore Dr). Start: the jon boat sits in 8 m of open water off Pine Knot (330, 170).
- Garstin Island at its OSM position (-1818, 478) with its real cottage (an OSM building lands on it); the old dam by it.
- Settlement: 924 of the 7,332 real building centres (lakefront thinned to ~24 m spacing, 178 shops/hotels/motels) as chalets and log cabins, clustered per 450 m for culling; real main-road polylines (Big Bear Blvd, North Shore Dr, Stanfield Cutoff, Moonridge, Fox Farm...) draped on the terrain, with the Stanfield Cutoff causeway as a pier-supported deck over the water and the dam's multiple arches and bridge at the west end.

## Not verified / approximated
- Survey depths come from reading a colour chart (7 ft colour bands, contour lines and labels filled in by nearest colour), not from the raw xyz. The chart is at maximum lake level; the OSM shore is at the imagery's lake level.
- The dam arm is two or three grid cells wide, so its deepest water (real 72 ft) is smoothed to about 17 m.
- Stanfield Marsh, the Stanfield Cutoff bridge opening and boat passage under it are not modelled (the causeway is visual; the east end beyond x = 2,050 is cut by the map edge, Big Bear City is off the map).
- Real winter ice/snow and the low-water shore colours exist only as the dry sand band at the waterline.
- Not seen on a real GPU: all screenshots are headless (SwiftShader/ANGLE) captures.

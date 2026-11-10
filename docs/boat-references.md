# Boat references

Real boats used to check the proportions of the four newer boats (`kayak`, `pontoon`, `bay`, `yacht`). Dimensions were taken from public spec pages found by web search; the models are composites built from scratch in Blender (`tools/blender/boats_*.py`), not copies of any one maker's boat. No logos, brand names or model names appear in the models, the transom lettering, the dealer text or the game.

Everything is 1 game metre = 1 real metre (1:1). Spec pages disagree with each other (model year, trim, listing errors); the numbers below are the ones that agreed across sources or the manufacturer's own page. Pages were read as untrusted data. No reference photos were downloaded (nothing is stored in the repo); proportions were checked against the spec numbers and general layout notes only, so hardware placement (cleats, rod holders, console and tower geometry) is from general practice, not measured off a photo.

## Kayak (`kayak`, 12' Fishing Kayak)

Compared: Hobie Mirage Pro Angler 12, Old Town Sportsman PDL 120 Pro, Old Town Sportsman PDL 106, Hobie Pro Angler 14, Native TitanX Propel 12.5.

| | Real | In game |
| --- | --- | --- |
| Length | 10'6" to 13'8" (3.2 to 4.2 m); the 12 ft class is the mainstream | 3.66 m |
| Width | 36" to 40" (0.91 to 1.02 m) | 0.90 m |
| Weight | about 44 to 66 kg fitted hull | not simulated (draft 0.09 m) |
| Capacity | 420 to 600 lb usable | livewell 2 slots |
| Layout | sit-on-top, raised mesh seat on gear tracks, round bow hatch, tank well aft, moulded rod holders, horizontal rod storage, carry handles, scuppers | all of those; paddle clipped to the side, milk-crate rod pod aft |

Sources: [Old Town PDL 120 Pro review](https://www.outdoorlife.com/gear/old-town-sportsman-pdl-120-pro-review/), [Old Town 120 PDL Pro listing](https://paddleva.com/products/old-town-sportsman-120-pdl-pro-fishing-kayak), [Hobie Pro Angler 12 brochure and listings](https://static.hobiecat.com/digital_assets/Hobie-Mirage-Pro-Angler-12-Brochure.pdf), [Hobie Pro Angler 12 review](https://www.fieldandstream.com/outdoor-gear/hobie-pro-angler-12-review/), [Pro Angler 14 listing](https://assets.boattrader.com/boat/2022-hobie-mirage-pro-angler-14-8239170/), [Best fishing kayaks](https://www.fieldandstream.com/fishing-gear/best-fishing-kayaks).
Game decisions: paddled only (speed 2.2 m/s, about 4 kn, a hard sprint for a real kayak), 25 % of the usual fish-spook radius, the angler is always seated.

## Pontoon (`pontoon`, 22' Fishing Pontoon)

Compared: Crest Classic 220 SLC and Crest II 220, Godfrey Sweetwater 2286 F, Lowe 224 Sport Deck and SS 210.

| | Real | In game |
| --- | --- | --- |
| Deck length | 22' (6.7 m); overall with engine bracket to about 7.2 m | 6.9 m including the engine plate |
| Beam | 8'6" (2.59 m) | 2.6 m |
| Tubes | two 23" to 25" round tubes (0.58 to 0.64 m), a third centre tube on tritoons | two 0.63 m tubes, 1.76 m apart |
| Power | 90 to 200 hp outboard | 90 hp class, speed 8 m/s (about 16 kn) |
| Fuel | 28 to 48 gal | not simulated |
| Layout | perimeter fence with a gate, bimini on four legs, helm console on one side, lounge benches, fishing chairs forward, ladder aft | all of those, plus a cooler, round table and stern-mount outboard |

Sources: [Crest Classic 220 SLC (2025)](https://resources.boattrader.com/boat/2025-crest-220-slc-9505809), [Crest II 220](https://ca.boats.com/power-boats/2019-crest-ii-220-9987454), [Crest Classic LX 220 SF](https://assets.boattrader.com/boat/2023-crest-classic-lx-220-sf-9159298/), [Godfrey Sweetwater 2286 F](https://www.boomerangsports.com/inventory/v1/Current/Godfrey-Pontoons/Sweetwater/Fishing/Sweetwater-2286-F/Base---25505851), [Lowe 224 Sport Deck](https://resources.boattrader.com/boat/2025-lowe-224-sport-deck-9599159).
Not found in any source: fence height and deck height. The model uses a deck 0.70 m above the keel line (tube top at 0.635 m) and a 0.5 m rail, which is typical of what pontoons look like but is an estimate.

## Bay boat (`bay`, 22' Bay Boat)

Compared: Sportsman Masters 227, Scout 215 XSF; the Pathfinder 2200 and Robalo searches returned nothing usable.

| | Real | In game |
| --- | --- | --- |
| Length | 22'5" (6.83 m); 6.55 m for the 215 | 6.9 m |
| Beam | 8'4" (2.54 m); 2.59 m | 2.5 m |
| Draft | 12" to 14" (0.30 to 0.36 m) with the engine raised | draft 0.26 m |
| Deadrise | 15 deg at the transom (modified-V) | 15 deg |
| Power | 200 to 300 hp single outboard on a hydraulic jack plate | 200 hp class on a jack plate, speed 20 m/s (about 39 kn) |
| T-top | bridge clearance about 10' (3.05 m) with a T-top | top 2.6 m above the keel line |
| Layout | full-size console, large casting deck, three livewells, under-gunwale rod racks, optional T-top with rocket launchers | all of those; the T-top is part of the model (no option toggle) |

Sources: [Masters 227 specifications](https://sportsmanboatsmfg.com/masters/227-bay-boat/specifications), [Masters 227 spec blog](https://sportsmanboatsmfg.com/blog/722-sportsman-specs-masters-227-bay-boat), [Masters 227 listing](https://resources.boattrader.com/boat/2025-sportsman-masters-227-9584527), [Scout 215 XSF](https://yachtbuyer.com/en-gb/scout/new/215-xsf).

## Sportfishing yacht (`yacht`, 58' Convertible)

Compared: Viking 54, Hatteras GT59, Bertram 61 Convertible.

| | Real | In game |
| --- | --- | --- |
| Length | 54'6" (16.6 m), 59'9" (18.2 m), 61' (18.6 m) | 18.4 m |
| Beam | 17'8" (5.38 m), 18'9" (5.71 m), 18' (5.48 m) | 5.5 m |
| Draft | 4'9" to 5' (1.45 to 1.52 m) | 0.5 m (the game's drafts are about a third of real for every large boat) |
| Layout | open aft cockpit with fighting chair and tackle centre, mezzanine, enclosed salon, flybridge under a hardtop, optional tuna tower with a standing platform and spreader lights, outriggers | all of those |

Sources: [Viking 54O vs Hatteras GT59](https://www.yachtbuyer.com/en-us/yachts/compare/viking-54o-vs-hatteras-gt59-6c8d07f), [Hatteras GT59 vs Bertram 61](https://www.yachtbuyer.com/en-us/yachts/compare/hatteras-gt59-vs-bertram-61-convertible-cebb02f), [Viking 54 Sport Tower overview](https://www.marlinmag.com/?p=43347), [Viking 54ST](https://www.hmy.com/viking-yachts/viking-54st), [Viking 54 Sport Tower layout](https://flyyachts.com/compass-articles/viking-yachts/viking-54-sport-tower-overview).
Not found: tower height and outrigger length. Tower and outriggers in the model (3.4 m tower, 9.7 m outrigger poles angled about 35 deg) are estimates from general proportions. The yacht is smaller in volume than the stern trawler (20 x 6.4 m) and carries no net, so it adds a trophy-fishing flagship without touching the commercial economy.

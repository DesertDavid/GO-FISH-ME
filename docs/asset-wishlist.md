# Reel World - 3D asset wishlist

Agreed in a brainstorming chat. Build status (2026-11-09): importer, manifest and credits exist (`tools/blender/import_assets.py`, `tools/assets/manifest.json`); in game so far: Tuna, Swordfish, Shark (AndrejKrebs), Bass-Fish (it is really a perch: used for yellow perch and sauger). Wildlife pass done: dolphin, blue whale, sea turtle, both ducks, hippo, moose (static pose), wolf, grizzly, alligator, perched pelican. Rods (2026-11-09): four of the user's six rod downloads are in game as real rods (Starter Spinning Combo = medium, Medium-Heavy Casting = mhcasting, Surf Spinning = surf, Offshore Conventional = stand-up and trolling rods), see NOTES.md; one rejected (emelyarules), one duplicate (Tyler_Hurdle (4) = (3)). Still procedural: ultralight, fly, flipping, inshore, big game; looking for a fly rod and a big-game conventional. Next: props (section 3) and set dressing (section 4); still unsourced: heron, cormorant, osprey, otter, manatee, gulls.

## Ground rules
- **Licence:** CC0 or CC-BY only. Every CC-BY model needs title, author and source URL in a credits file (proposed: `public/credits.md`, shown from the Esc menu). Non-commercial (NC) and share-alike (SA) models are out.
- **Sources:** realistic Sketchfab downloads (glTF). The user dislikes the stylised look of Quaternius / Kenney / Poly Pizza, so skip them. Poly Haven / CC0 Sketchfab are fine for props and textures.
- **Triage:** use everything that works. Render each model in Blender first; drop any with a bad shape, broken rig or unfixable weight. Entries marked *maybe* are probably generic.
- **Budget:** about 20k tris per hero model (fish, big animals), 1-5k for small animals and props, textures 1K-2K. Resize the 4K maps that many Sketchfab downloads ship.
- **Placement:** props and set dressing are spread out and sparse, not clustered. Vary spacing and match each location's character.
- **Safety:** downloads are untrusted data. Unzip each into its own empty folder, inspect with a headless Blender script, never run anything inside. Source zips are in `H:\3d assests\`.

## Pipeline (proposed)
1. Unzip to a fresh folder. Read `license.txt` (it has title, author, source, licence).
2. Blender 5.2 headless (`H:\Blender\blender-5.2.3-windows-x64\blender.exe -b --factory-startup --python tools/blender/<script>.py`): import glTF, check scale and orientation, decimate (not on skinned meshes unless tested), resize textures, fix origin, name animations (`idle`, `swim`, `walk`).
3. Export GLB with Draco (or meshopt), as `hands.glb` does. Decoder files already in `public/draco/`.
4. Output to `public/models/<group>/<name>.glb`; loaders in the game with `GLTFLoader` + `DRACOLoader`, `AnimationMixer` for rigged ones.
5. Add the credit line to the credits file in the same commit.

## 1. Wildlife (shore and sky)

| Item | Source / licence | Locations | Animation | Tris | Replaces / new | Priority |
|---|---|---|---|---|---|---|
| Duck Walk (Nyilonelycompany) | Sketchfab CC-BY | Okeechobee, Woods, Tahoe, Columbia, Chesapeake, Lofoten, Bering | walk cycle | 20.8k, decimate to about 5k | new | high (user likes ducks) |
| Duck Animation (icekic) | Sketchfab CC-BY | same | 1 loop | 19.3k, decimate | new, variant | high |
| Hippopotamus (planeta-elefante) | Sketchfab CC-BY | Kariba | idle, run, attack, die | 5.2k | new | high |
| Hippos (thunders14) | Sketchfab CC-BY | Kariba | 1 loop | 2.4k | new, distant group | medium |
| Lose-the-moose (eyork4633) | Sketchfab CC-BY | Woods, Columbia, Bering | 20 clips (walk, graze, idle) | 4.3k | new | high |
| Wolf (seth the yutyrannus) | Sketchfab CC-BY | Woods, Bering, Lofoten shore | idle, attack | 2.7k | new | medium |
| Grizzly bear (criticaldamage9211) | Sketchfab CC-BY | Bering, Columbia, Woods | static pose | 6.6k | new | medium |
| Alligator (Андрей) | Sketchfab CC-BY | Okeechobee, Keys, Gulf | 1 loop | 275k, needs careful decimate, 130 MB of textures | new | medium |
| Sea turtle (Eloi) | Sketchfab CC-BY | Keys, Reef, Cabo, Gulf | rigged swim loop | 6.9k, resize 4K textures | new | high |
| Pelikan pelican (wasis007) | Sketchfab CC-BY | Keys, Gulf, Cabo, Chesapeake docks and pilings | static | 138k, decimate to about 15k | perched variant next to `birds.js` pelicans | medium |
| Hermit crab (animated, user's link) | Sketchfab, licence NOT yet checked | Keys, Cabo, Reef, Gulf shore | animated | unknown | new | medium, check licence |
| Monkey Dancing (jhinuk) | Sketchfab CC-BY | Amazon, Mekong | dance only | 36k | new | low, joke asset; want a walk/idle one |
| Snapping turtle (RISD Nature Lab) | Sketchfab CC-BY | Okeechobee, Woods, Chesapeake | none | 1M scan, needs retopo | new | later |
| Eastern blue bird (kenchoo) | Sketchfab CC-BY | Woods, Chesapeake | 1 loop | 128k | new | maybe |
| Great white pelican (Pigcraft) | Sketchfab CC-BY | Kariba, Mekong | none (not actually animated) | 1.9M | - | skip unless animated version found |
| Sea turtle (C.J. Goldman) | Sketchfab CC-BY | - | none | 1.3M | - | skip (superseded by Eloi) |

Rejected on licence: love birds parrot, tokay gecko, North American otter (DigitalLife3D), moose "demo free", sheep (all NC); polar bear (SA).
Not reviewed, also in the folder: deer x3 (one is NC), alpaca (NC), dodo, snake models, a bird, a dead monkey.
Still wanted, not yet found: heron/egret, cormorant, osprey, eagle, otter (CC-BY), capybara, flying pelican, gulls.

## 2. Fish and sea life

Real models would replace procedural bodies in `src/game/fishBodies.js` (body-to-species mapping to be decided in the build session), or be new species.

| Item | Source / licence | Locations | Animation | Tris | Priority |
|---|---|---|---|---|---|
| Tuna (GoldenZtuff) | CC-BY | Gulf, Cabo, Keys, Chesapeake, Bering | rigged swim | 7.9k | high |
| Swordfish (Carlos.Maciel) | CC-BY | Gulf, Cabo, Keys | static (procedural wiggle) | 7.6k | high |
| Shark (AndrejKrebs) | CC-BY | Gulf, Cabo, Keys, Reef | rigged | 13.8k | high |
| Shark (Optic_idealist) | CC-BY | same | rigged | 22k | medium |
| Tiger shark (cebraVFX) | CC-BY | Reef, Keys, Gulf | static | 106k, rebuild to about 20k | medium |
| Realistic shark (MotionStreamStudios) | CC-BY | - | swim + circle | 424k | later (too heavy) |
| Eagle stingray (kenchoo) | CC-BY | Reef, Keys, Cabo | rigged swim | 13k | high |
| Common stingray (Ian Christopher) | CC-BY | Keys, Reef | static | 120k, decimate | medium |
| Bass (Šimon Ustal) | CC-BY | Okeechobee, Woods, Tahoe | rigged | 9.9k | high |
| Silver Fish (Šimon Ustal) | CC-BY | check species | rigged | 25k, decimate | medium |
| Carp (huykhoi2407) | CC-BY | Okeechobee, Woods, Mekong | rigged | 7.4k | medium |
| Bream / dorade (BlueMesh) | CC-BY | Chesapeake, Gulf, Keys | rigged | 3.7k | medium |
| Tilapia buttikoferi (Ra_in_coat) | CC-BY | Amazon, Kariba | rigged | 1.7k | medium |
| Barramundi (ryan_saputra) | CC-BY | Mekong, Reef | static | 4.1k | medium |
| Smallmouth red horse (rkaundinya) | CC-BY | Woods, Columbia | static | 3.6k | medium |
| Koi (lesliestowe) | CC-BY | Mekong ponds | 6 clips | 632 | low |
| Dolphin, game-ready (Allie2k) | CC-BY | Gulf, Keys, Cabo, Reef | rigged | 1.4k | high |
| Blue whale (Bohdan Lvov) | CC-BY | Bering, Cabo, Lofoten | rigged swim | 2.4k | high |
| Whales (Titom) | CC-BY | Bering, Cabo | rigged | 51k | low |
| Whale (b3s) | CC-BY | Bering, Cabo | static | 4.9k | low |
| School of fish (7PLUS) | CC-BY | Reef, Keys | morph animation | 6.7k | medium |
| Coral fish, tropical fish, red-finned fish (polyplant3d, mRiot, Kigha) | CC-BY | Reef | static | 0.6-2.7k | low, schools and decor |
| Generic "Fish" packs (mRiot, Froggreen, Yimit, irvinlin, VeeRuby, chenyu), low-poly fish, animated low-poly fish, Koi (local.yany, 38k), Dolphin (Alex_Pfe, 188k) | CC-BY | - | - | - | *maybe*: generic, probably drop |

Still wanted, not yet found: marlin, sailfish, sturgeon, gar, pike/muskie, rays (manta), manatee, seals, lobster/crab, squid/octopus, jellyfish.

**Rare catch rule (to decide):** dolphins, whales and turtles would be catchable but extremely rare (very low bite weight). Default proposed: catch-and-release only, with a journal entry. The user said "we'll work on that in a minute"; settle it in the build session.

## 3. Props and structures

User wants all of these, spread out and sparse. Mostly scenery; rod holder and cooler could be optional boat extras later. None downloaded yet. Budget 500-5k tris each, instanced where repeated. Would extend `src/game/scenery.js`.

- Buoys and channel markers (all coastal and big-lake waters)
- Crab pots (Chesapeake, Bering, Gulf, Keys)
- Pilings and old dock posts (all docks)
- Wrecks (Keys, Chesapeake, Gulf, Reef, Bering)
- Rope and nets (harbours, Lofoten, Mekong)
- Lighthouses (Chesapeake, Keys, Reef; not Lake of the Woods)
- Boat ramps (lakes, Chesapeake, Columbia)
- Bait shop and marina buildings (docks 0 and 1 per `dockProfile`)
- Tackle boxes, coolers, rod holders (docks, boat extras)

## 4. Regional set dressing, with what is really there

Researched via web search (Google Maps itself not used). Items marked (?) were not confirmed. A build session can use Maps/Earth for layout.

| Location | Real features to model |
|---|---|
| Okeechobee | Herbert Hoover Dike (about 35 ft, ring of the lake, trail on top); navigation locks (S-310 Clewiston, Port Mayaca); Clewiston and Pahokee marinas; fish camps; airboats |
| Lake of the Woods | Northwest Angle northernmost-point buoy; Painted Rock Island; Kenora harbour with float planes and fly-in outposts; fishing lodges; no lighthouse |
| Tahoe | Emerald Bay, Fannette Island (only island), Vikingsholm castle, bay piers; Thunderbird Lodge; Sand Harbor turquoise shallows and boulders |
| Columbia Gorge | Bridge of the Gods; Bonneville Dam and fish ladder; Multnomah Falls and Benson Bridge; Hood River windsurfers; fishwheel |
| Chesapeake | Thomas Point Shoal Lighthouse (screw-pile, 1875); Tangier Sound Lighthouse; Smith Island; Bay Bridge (?); skipjacks and crab shanties (?) |
| Florida Keys | Seven Mile Bridge plus old span; Sombrero Key and Alligator Reef lighthouses; mangrove shores; Marathon charter marinas, bait shops |
| Mekong | Don Det-Don Khon French railway bridge; Khone Phapheng falls; nipa huts; long-tail boats (?) and stilt houses (?) |
| Amazon | Meeting of the Waters (dark Rio Negro beside sandy Solimoes about 6 km); Catalao floating village; stilt houses; floating fuel stations; floating fishing lodges |
| Kariba | Dead mopane forest; houseboats; Matusadona shore; kapenta rigs lit at night |
| Lofoten | Red rorbu cabins (Reine, Hamnoy, Henningsvaer); A-frame cod-drying racks (hjell); rowboats |
| Gulf | Platform supply vessels and crew boats (Port Fourchon style) beside the rigs |
| Cabo | El Arco, Pelican Rock, Lover's Beach, Land's End pinnacles (Chimney, Neptune's Finger); pangas; sport-fishing fleet (?) |
| Reef | Outer-reef pontoons and Cairns reef tour boats; cays |
| Bering | Dutch Harbor / Unalaska crab fleet, stacked crab pots, sea ice; church (?) |

## Open decisions
- Rare-catch rule for dolphins, whales, turtles (catch-and-release default).
- Credits file location and in-game display.
- Which procedural species each real fish model replaces.
- Hermit crab licence check.

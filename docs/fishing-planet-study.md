# Fishing Planet: a design study for Reel World

Written 2026-11-10. A design study only: no game code was changed.

**Method and limits.** Public web pages only, summarised in my own words. Nothing was read from a game install, and no art, names, text, number tables or code are copied here. Where a page gave exact numbers (prices, XP thresholds, entry fees, weight limits) I describe the shape of the system and leave the numbers out.

**Source quality, stated plainly.** The wiki is thinner than it looks. The pages `/Basic_fishing_tips/en`, `/Tutorial` and `/Bite_Chart` returned the wiki's Main page when fetched, so the first-pass claims about activity windows, cold fronts, light rain and species retrieve tips are **carried from the earlier pass and not re-verified here** (marked "[carried]"). Two Steam guides returned HTTP 429. Everything marked "[read]" was fetched and read this session. The wiki's own statement that fish activity depends on season, time of day, current, bottom type, water and air temperature and wind is on the Main page [read].

## 1. How Fishing Planet's systems work (own words)

### 1.1 Fish activity, weather, time
- The wiki's Main page says the fish AI reacts to season, time of day, current, bottom type, water and air temperature and wind, with a day/night cycle, seasons, rain, fog and sun. <https://wiki.fishingplanet.com/> [read]
- [carried] Dawn and dusk are best on cool overcast days, midday is slow, fish feed before a cold front and sulk after it, light rain helps, and trophy fish sit low and feed only in narrow windows. Source named by the first pass: `/Basic_fishing_tips/en`. I could not confirm it.
- A general "Lure fishing" page gives advice, not mechanics: match lure size to the natural prey, vary speed and depth until you find fish, bright lures for sun and dark for overcast, silver for clear sunny water and gold for murky or cloudy, red fades first with depth. <https://wiki.fishingplanet.com/wiki/Lure_fishing> [read]

### 1.2 The bite chart (a community tool, not in-game)
- The Fishing Planet Collective turns catch markers that players share into bite charts (best hours per place, per weather pattern, per fish and fish type) and filterable maps (by time, weather, fish, technique). <https://fp-collective.com/> [read, via search summary]
- A second fan tool, the Catch Atlas, loads one player's exported catch log. It filters by lake, spot, species, method, lure, outcome, pressure, sky, retrieve, hour and depth. It shows bites per hour with the landed share shaded, a bite-depth histogram, a two-condition heatmap (e.g. hour x pressure) with a minimum count before it shows a number, a "what stands out" list of correlations (only above a sample threshold, and labelled as correlation not proof), and a lake map with bite heat. <https://fp-atlas.com/> [read]
- Takeaway: the community built these because the game does not tell you *why* a bite happened. That gap is the opportunity. Players want to learn the water, and a spreadsheet is the worst possible way to do it.

### 1.3 Retrieves, lure and hook size
- Forum players describe twitching, lift-and-drop, stop-and-go and slow straight retrieves, and a bump or partial take is usually blamed on a lure or retrieve that is too aggressive for the day. Smaller lure or slower retrieve gives more solid hookups. In game, twitching is done with the right mouse button while pulling the rod without reeling (forum report). <https://steamcommunity.com/app/380600/discussions/0/1457328846183130272> and the 2022 thread via search [read as search summaries]. One poster guesses each retrieve has a per-species hookup chance; **unconfirmed**.
- Hook advice exists only as general guidance: bait size and hook size must balance, because a small bait on a big hook and a big bait on a small hook both cost strikes. Floats can make fish spit the bait. <https://wiki.fishingplanet.com/wiki/Float_fishing> [read]
- The wiki states tackle breaks according to the real rod, line and reel characteristics. <https://wiki.fishingplanet.com/> [read]

### 1.4 The fight
- [carried] Adjustable drag during a run: too tight snaps the line, too loose lets the fish reach cover and throw the hook. Lure size and speed decide bumps versus hookups. I found no page that documents tension or drag UI in detail (the Controls page is screenshots only).

### 1.5 Rod stands, alarms, multiple rods
- Players use stands to put one rod down and work another; the stand is packed away with a hold-and-confirm action; one reply says a single-rod stand is still useful if you carry two rods. A January 2025 forum thread says a patch stopped one rod type resting on stands and support called it a bug. <https://steamcommunity.com/app/380600/discussions/0/3203748171378214839> (search summary)
- A clip-on bell rings when a fish is hooked, sold in four sensitivity tiers gated by level, plus event and DLC exclusives. <https://wiki.fishingplanet.com/wiki/Fishing_Alarm> [read]
- Tournaments ban rod stands. <https://wiki.fishingplanet.com/wiki/World_Bass_Tour> [read]

### 1.6 Stringers and keepnets
- A stringer threads the fish through gill and mouth; the wiki flags it as unfriendly to fish and recommends a keepnet for release. Keepnets are the fish-friendly option. Each has a per-fish maximum and a total-weight maximum, rising with angler level. <https://wiki.fishingplanet.com/wiki/Stringers_and_Keepnets> [read]
- Players complain that a small keepnet limits how much they can earn per trip (Steam thread via search).
- Competitions require a keepnet and forbid stringers.

### 1.7 Tournaments
- A two-stage ladder (several qualifiers, then a semifinal and a final). Qualifiers run for most of a day and each player picks a 2-hour slot inside it; semifinal and final are live and simultaneous. Top finishers advance; top places and the biggest single fish earn prizes. Score = total weight of the first N fish in the keepnet (N is 10 in one series, 5 in later rounds of another); extra fish must be released. Entry is a large fee that also covers the licences for the event's fish and lifts the level limits for registered players for the duration. Spinning/casting rods only, no stands, boats only in the boat series. <https://wiki.fishingplanet.com/wiki/World_Bass_Tour> and <https://wiki.fishingplanet.com/wiki/Fishing_Planet_Boat_Series> [read]
- Other pages list around a hundred and thirty smaller competitions by water with themed names; rules are on their own pages (not read). <https://wiki.fishingplanet.com/wiki/Competitions> [read]

### 1.8 Licences, trophy and unique fish
- Licences are time-limited per waterway [carried; also a Steam complaint]. A Steam update (via search) says trophy fish need a separate licence, and catching one without it still counts but is fined afterwards. Unique fish need no licence, because rarity limits them. <https://steamcommunity.com/app/380600/discussions/0/3802778645092810406> area (search summary).
- Trophy and unique are fish *forms* that lift XP and are listed as distinct qualifying fish in tournaments. <https://wiki.fishingplanet.com/wiki/Experience> [read]

### 1.9 Progression
- XP for every catch, kept or released; the amount depends on fish size, the tackle used and the form (young, common, trophy, unique). Levels unlock gear and waters. The curve is steep at the top (it runs past level 100). <https://wiki.fishingplanet.com/wiki/Experience> [read]
- Sonar: only a mention that newer patches added fish radars on one boat's monitors. Detail not found. <https://wiki.fishingplanet.com/> [read]

### 1.10 What players love and complain about
- Loved: the fishing itself, a relaxed atmosphere, a friendly community. Disliked: grind and monetisation, the feeling that real money speeds progress; a paid version from the same studio is reported as much less grindy with no microtransactions. Sources: <https://www.pcgamer.com/games/this-russian-fishing-sim-is-bizarrely-popular-on-steam-but-players-cant-decide-if-they-love-or-hate-it-perhaps-because-of-the-usd2000-microtransaction>, <https://vaporlens.app/app/380600/fishing_planet/stats/analysis>, <https://www.thexboxhub.com/the-fisherman-fishing-planet-review/> (via search summaries).
- Not found: a documented tutorial structure, the HUD in detail, any echo-sounder reviews.

## 2. Reel World against Fishing Planet

Reel World facts are from `NOTES.md` and `src/game/*` read for this study.

| Area | Fishing Planet (as found) | Reel World today | Verdict |
|---|---|---|---|
| Lure matching | Depth, speed, size matter; community guesses the rest | Full model: lure x depth x time x weather x colour per species (`bait.js`, `baitData.js`), journal hints unlock by catch count | **Better here** |
| Seeing the fish | Fish are mostly unseen | Real fish swim, follow, inspect, refuse or strike your lure (`fishLife.js`); bait balls; sonar markers | **Better here** |
| Retrieve technique | Several retrieves, twitch/pause/lift | Binary: reel or not (`fishing.js updateWater`); a paused lure sinks, a moving one comes up | **Lacks** |
| Lure vs hook/mouth size | Size drives bumps vs hookups | `lure.size` only biases weight; no hook size, bump vs hookup is from fish mode | **Lacks** |
| Drag and fight | Live drag | Live drag, rod angle pulling, stamina, ten fish behaviours, reel smoothness, line wear (`fishing.js`, `fightFeel.js`) | **Better/equal** |
| Cover during the fight | Fish reach cover and throw hook | Fish pull away from shore only; no timber/weed/rock cover to steer fish out of | **Lacks** |
| Weather | Seasons, pressure, fog, rain | Weather states, squalls, fog banks, tides, gorge after a front (`weather.js`) but no pressure, no seasons, no moon | **Lacks (partly)** |
| Time | Day/night, bite charts | 24 h clock, night feeders, dawn/day/dusk/night profile per species | **Equal** |
| Bite insight | Community charts (external) | Per-species hints in the Journal; `journal[id].how` stored on first catch only | **Lacks** (no per-water notes) |
| Sonar | Fish radar on some boats | Scrolling trace with depth and species-depth arches, bait clouds, chirp upgrades; no bottom hardness, no lure marker, no structure | **Equal, thin** |
| Multiple rods | Rod stands, several rods | One rod in hand plus trolling spread (`troll.js`) | **Lacks** |
| Bite alarms | Bells in sensitivity tiers | No unattended rod, so no alarm | **Lacks** |
| Keepnet/stringer | Per-fish and total weight caps | Livewell with condition decay and a market; net hold (`livewell.js`) | **Different** |
| Tournaments | Qualifier ladder, live rivals, weigh-in count limit | Instant AI-score events (`tournaments.js`): three formats, 7 rivals with a skill number, no keepnet limit, no weigh-in | **Lacks depth** |
| Licences | Per waterway, trophy licence | Permits per water, tiers, wear, shopkeeper rapport (`progress.js`) | **Equal** |
| Trophy fish | A rarity tier | Trophy hall with real models, mounts, personal bests; `>70% of record` bonus | **Better here** |
| Unique/legend fish | A rarity tier | Rare colour morphs; no individual legend fish (listed under Next) | **Lacks** |
| Progression | Long XP grind, paid shortcuts | Level cap 25, sane curve, gear gated by level, no purchases | **Better here** |
| Tutorial | Scripted intro | Keeper dialogue and hint prompts; no first-hour guide | **Lacks** |
| HUD | Dense overlays | Minimal marine-instrument HUD, compass, chart, photo mode | **Better here** |
| World | Many lakes | 15 real-based waters with topography, buildings, wildlife | **Better here** |

## 3. Ranked original ideas

Ordering: deeper fishing and a satisfying loop first, then career, then HUD and feel. Each idea says what to avoid.

### Fishing and loop

**1. Cadence retrieve: your hands are the lure's voice (M).**
- *Problem:* reeling is on/off, so lure choice has no technique.
- *How it works:* read the rhythm of your hold and release. Slow steady, stop-and-go, short twitches (a tap while not reeling) and a lift-then-drop of the rod tip each give the lure a *motion signature* (speed, pauses, jerk). `baitData.js` gives each lure kind and each species a preferred signature (bass like pauses after a twitch, trout like steady and slow, surface plugs like a rhythm). The visible fish in `fishLife.js` already follow, inspect and refuse by lure movement, so you will *see* a fish trail the lure, lose interest at a boring cadence, and commit on the pause.
- *Files:* `fishing.js` (`updateWater`, new cadence tracker), `fishLife.js` (lure movement input), `baitData.js` (signatures), `rod.js` (tip twitch animation), `ui.js` (one hint line).
- *Avoid:* a menu of named retrieve styles, or mapping them to mouse buttons. Ours is read from timing. No per-species lookup table of "correct" styles shown to the player.

**2. Mouth match: lure size versus the fish that is looking at it (M).**
- *Problem:* a big lure and a small lure feel the same; bumps and spits are random.
- *How it works:* give each lure a body size and let the tackle box carry two or three sizes (the shop already sells lures). A visible fish compares the lure to its gape. Too big means it follows, bumps and slaps the lure ("halfhearted" mode exists) and you see it. Too small means small fish only or ignored by big ones. A correct size hooks cleanly. The shopkeepers' tips can say "go smaller" because `Keepers.rank()` already scores lures.
- *Files:* `gear.js`, `baitData.js`, `fishLife.js` (mode choice), `fishing.js` (hookset chance), `keepers`/`dialogue.js` (tip text), `ui.js` (tackle box).
- *Avoid:* a hook-size number table or a "hook number vs fish" chart. Keep size as the lure's physical profile you can read by eye.

**3. Cover and structure in the fight (M).**
- *Problem:* the fight is a force balance in open water; there is no place to lose a fish to.
- *How it works:* sunken timber (Kariba), weed beds (Okeechobee), rock ledges and docks become cover nodes. A running fish picks the nearest node when the drag is loose or you are pulling the wrong way. Reach it and the line catches (a short window to steer it out with the rod angle, already modelled) or the fish is lost. Tight drag stops the run but costs line wear. This gives drag a second meaning.
- *Files:* `fishing.js` (`updateFight`), `fightFeel.js`, `scenery.js`/`obstacles.js` (cover list), `ui.js` (fight line).
- *Avoid:* a pure "drag too loose = lose the fish" rule as the only reason. Cover must be *seen on the water*.

**4. Barometer and fronts (S to M).**
- *Problem:* weather only changes the sky, not the fish's mood in a way you can read.
- *How it works:* a slow pressure value per location (derived from the existing weather state plus a front passing every few days). Falling pressure ahead of a front: fish feed hard, bait balls more often. Rising and cold after: lethargic, shorter follows. Show it as a hand-drawn barograph on the Chart and the marina keeper's chalkboard, not a stat. The existing `afterT` gorge and `eventBite` fit in.
- *Files:* `weather.js` (pressure, `weatherBite`), `bait.js`/`baitData.js` (a small factor), `chart.js` or `ui.js` (barograph), `dialogue.js` (keeper lines).
- *Avoid:* a full season/calendar system in the first pass; add seasons later (L) per location by latitude.

**5. Field notebook instead of a bite chart (M).**
- *Problem:* players have to guess why bites happen; community tools fill the gap in other games.
- *How it works:* per water, the game quietly logs every nibble, strike, miss and catch with hour, depth, lure, cadence and weather. The Journal gets a hand-drawn "Water notes" page: a sketch of the lake with pencilled hot spots, hour ticks that fill in as you learn, and sentences in the angler's voice ("three bites between six and seven, all on the pause"). Knowledge is earned, not read off a table. Builds on `journal[id].how` and the hint system.
- *Files:* `save.js`/`progress.js` (optional `notes[locId]`, no version bump like the other optional fields), `fishing.js` (log hook), `ui.js` (Journal tab), `chart.js` (pencil marks).
- *Avoid:* a filterable dashboard, heatmap matrix or "what stands out" panel. No exported shared data.

**6. A second rod in a rest with a rod-tip alarm (L).**
- *Problem:* bottom baits and cut bait are dead time; the tackle shop sells them but the loop is the same as everything else.
- *How it works:* a rod holder on the dock and the boat (the trolling holders already exist). Cast a bottom bait, rest the rod, pick up the other. A bite shows as the visible rod tip nodding and the line twanging, with a tip bell sound; step back to strike. The line has to be watched or you lose it. Night and catfish become a calm sit-and-wait mode.
- *Files:* `fishing.js` (more than one `Fishing` state), `game.js` (switching), `rod.js`/`troll.js` (rest pose and clones), `audioSynth.js` (bell), `ui.js`.
- *Avoid:* paid bell tiers by level, and paid slot expansion. A rest is a physical object you place, not a gated slot.

**7. Sonar that reads structure (M).**
- *Problem:* the sonar shows depth and dots; it does not help you choose where to fish.
- *How it works:* a down-view that shows bottom hardness (a thicker return for rock), weed, timber, thermocline, and your own lure descending as a trace. Hot spots and bait clouds already exist; add structure so players *find* the ledge and fish it. Chirp tiers (existing) buy resolution, not wins.
- *Files:* `sonar.js`, `game.js` (feeds), `fishLife.js`, `locations.js` (bottom type per water), `boatCustom.js` (tiers).
- *Avoid:* a radar display of every fish, and mapping unknown fish into full species labels.

### Career

**8. Legend fish: named individuals with a memory (L).**
- *Problem:* rare fish are only colour morphs; there is nothing to hunt.
- *How it works:* one named legend per water (listed under Next in `NOTES.md`). It lives in a specific kind of spot, feeds only in certain hours and weather, is seen first as a big return on sonar or a shape at depth, and has a story from the shop keepers (`LORE`). Each time you hook and lose it, it remembers: the lure that fooled it before is dead, and it carries a scar. Landing it is a trophy-hall centrepiece and a release (catch-and-release counts for the legend's story, not cash).
- *Files:* `fishLife.js`, `fishing.js`, `locations.js`, `trophyData.js`, `dialogue.js`, `sonar.js`, `save.js` (optional `legends`).
- *Avoid:* "trophy and unique" as a rarity label with fines, licences or colour tiers. These are individuals with a history, not a drop table.

**9. Tournaments with a bag, a cull and a weigh-in (M).**
- *Problem:* the tournaments are instant scores; nothing tests judgement.
- *How it works:* the event gives you a live bag of N fish. Keep the weight under a fish-friendly bag; cull (release a smaller one to swap a bigger one) at the cost of a fish's health in the livewell; dead fish count less; the event ends at a dock weigh-in where the rivals' bags are lifted onto the scale one at a time. Persist the rivals as named anglers who recur and remember you (a small `rapport`-like struct, the same shape as the keeper relationship).
- *Files:* `tournaments.js`, `livewell.js`, `game.js`, `ui.js`, `save.js` (optional rival record).
- *Avoid:* a qualifier -> semifinal -> final ladder, 2-hour windows, and entry fees that cover licences. Our events are one-day local meets on one water.

**10. Regulations and bycatch (M).**
- *Problem:* nothing stops you keeping every fish; the Known gaps list the net hold has no bycatch rules.
- *How it works:* each water posts slot limits, closed seasons and protected species. A ranger can check the livewell (Amazon already dresses a ranger). Breaking a rule costs standing with the keepers, not cash. Fines are a story beat, not a grind. Releasing the right fish raises rapport tiers and unlocks tips.
- *Files:* `progress.js`, `livewell.js`, `dialogue.js`/`keepers.js`, `locations.js` (rules), `ui.js`.
- *Avoid:* a "trophy licence" you have to buy. Rules should be local and educational.

### HUD and feel

**11. Forecast board at the marina (S).**
- *Problem:* planning the next trip has no tool.
- *How it works:* a chalkboard in the marina office (the keeper already tells you what is biting) with wind, pressure trend, tide times and a plain-language outlook for the next 12 hours.
- *Files:* `buildings.js`/`bldKinds.js` (board), `dialogue.js`, `weather.js` (forecast read), `ui.js`.
- *Avoid:* a coloured probability bar per species.

**12. Tip bell and line-sag reading (S).**
- *Problem:* bites are shown as text toasts ("Nibble.").
- *How it works:* move bite cues into the world: the visible rod tip nods, line sag changes, a soft tick, the bobber dips. Keep the toast as an accessibility option. Pairs with idea 6.
- *Files:* `fishing.js` (`updateBite`), `rod.js`, `audioSynth.js`, `ui.js`, `settings.js`.
- *Avoid:* a flashing "!" icon.

**13. A first-hour mentor on the dock (S to M).**
- *Problem:* nothing guides a first cast beyond hints.
- *How it works:* the Big Bear bait shop keeper (the starting lake) walks you through cast, strike and landing as short spoken lines tied to what you do, always skippable. It teaches by letting you succeed; no pop-ups.
- *Files:* `dialogue.js`, `keepers.js`, `ui.js`, `save.js` (a seen-flag).
- *Avoid:* a scripted level or forced tutorial lake.

## 4. Top three to build first

1. **Cadence retrieve (idea 1).** It makes every lure choice mean something, it plugs straight into the fish behaviours we already built (follow, inspect, refuse, strike), and it adds skill without a grind.
2. **Mouth match (idea 2).** It explains bumps and spits that today feel random, uses the same visible-fish system, and gives the shopkeepers' tips something real to say. Build it right after 1 because they share the lure-motion data.
3. **Field notebook (idea 5).** It replaces the thing Fishing Planet players had to build outside the game. It reads as a handmade logbook rather than a spreadsheet, so it suits the "never generic" rule, and the data it needs mostly exists.

Suggested order after these: 4 (barometer, small), 3 (cover), then 9 and 8 for the career thread.

## 5. What would feel like a copy (avoid across the board)

- A level ladder that runs to 100+ or paid shortcuts, which is the main complaint players report.
- A named qualifier-to-final tournament tree with large entry fees.
- Trophy and unique rarity tiers with licence fines.
- A tiered bell and slot shop for rods.
- A community-style bite chart dashboard.
- Any use of their lure, fish or gear names, or their number tables.

## 6. Sources

Read: <https://wiki.fishingplanet.com/> (Main), <https://wiki.fishingplanet.com/wiki/Lure_fishing>, <https://wiki.fishingplanet.com/wiki/Float_fishing>, <https://wiki.fishingplanet.com/wiki/Experience>, <https://wiki.fishingplanet.com/wiki/Stringers_and_Keepnets>, <https://wiki.fishingplanet.com/wiki/World_Bass_Tour>, <https://wiki.fishingplanet.com/wiki/Fishing_Planet_Boat_Series>, <https://wiki.fishingplanet.com/wiki/Fishing_Alarm>, <https://wiki.fishingplanet.com/wiki/Competitions>, <https://wiki.fishingplanet.com/wiki/Tournaments>, <https://fp-atlas.com/>.

Via search summaries only: <https://fp-collective.com/>, the Steam forum threads linked above, the PC Gamer, Vaporlens and Xbox Hub pages.

Failed or empty: `/Basic_fishing_tips/en`, `/Tutorial`, `/Bite_Chart` (wiki served the Main page), Steam guides 2691600617 and 1976055435 (HTTP 429).

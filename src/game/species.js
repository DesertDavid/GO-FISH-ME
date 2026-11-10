// Fish species database. Weights in lb: [smallest usual, typical, world-record-ish].
// colors: [back, side, belly, fins]. depth: s(urface) m(id) b(ottom).
// diet letters: i insect, w worm, m minnow/fish, c crustacean, q squid, p plant/dough, b cut bait.
// fight 0-1 (pull per lb + stamina), jump 0-1 (chance to leap), price $ per lb.
const S = (id, name, body, lb, colors, pattern, fight, jump, price, depth, diet, extra = {}) =>
  ({ id, name, body, lb, colors, pattern, fight, jump, price, depth, diet, ...extra });

export const SPECIES = [
  // ---- warm freshwater
  S('largemouth', 'Largemouth Bass', 'bass', [0.5, 3, 22.3], [0x34502a, 0x7c9450, 0xeae6c8, 0x667a44], 'blotchline', 0.6, 0.6, 4, 'm', 'mwic'),
  S('smallmouth', 'Smallmouth Bass', 'bass', [0.4, 2, 11.9], [0x5a4a26, 0x9c8248, 0xe2d8b8, 0x8a7040], 'bars', 0.72, 0.7, 4.5, 'm', 'mci'),
  S('spotted', 'Spotted Bass', 'bass', [0.4, 1.5, 10.4], [0x45572a, 0x8c9c56, 0xefebcc, 0x6a7a44], 'blotchline', 0.62, 0.5, 4, 'm', 'mwc'),
  S('peacock', 'Peacock Bass', 'bass', [1, 5, 29], [0x4f6b1f, 0xd8b02a, 0xf2d27a, 0xc03a20], 'peacock', 0.88, 0.35, 6, 'm', 'm'),
  S('bluegill', 'Bluegill', 'panfish', [0.1, 0.5, 4.8], [0x2d4a3a, 0x6b8a5a, 0xe8a040, 0x4a6050], 'bars', 0.3, 0, 3, 'm', 'wi'),
  S('redear', 'Redear Sunfish', 'panfish', [0.2, 0.8, 5.8], [0x4a5a3a, 0x9aa870, 0xf0d090, 0x6a7050], 'specks', 0.32, 0, 3, 'b', 'wc'),
  S('pumpkinseed', 'Pumpkinseed', 'panfish', [0.1, 0.4, 1.4], [0x5a6a3a, 0xc8a040, 0xf0a030, 0x6a6a3a], 'specks', 0.28, 0, 3, 'm', 'wi'),
  S('blackcrappie', 'Black Crappie', 'crappie', [0.2, 0.8, 5], [0x26342a, 0xb8c0a8, 0xe8e8d8, 0x4a5a48], 'mottled', 0.3, 0, 3.5, 'm', 'mi'),
  S('whitecrappie', 'White Crappie', 'crappie', [0.2, 0.8, 5.2], [0x3a4a40, 0xcfd6c4, 0xf2f2e8, 0x5a6a58], 'bars', 0.3, 0, 3.5, 'm', 'mi'),
  S('yellowperch', 'Yellow Perch', 'perch', [0.1, 0.6, 4.2], [0x4a5a2a, 0xd8c040, 0xf0e8d0, 0xe07020], 'bars', 0.3, 0, 4, 'm', 'wmi'),
  S('walleye', 'Walleye', 'perch', [0.8, 3, 25], [0x4a4a28, 0xb8a050, 0xf0ece0, 0x6a6040], 'mottled', 0.45, 0, 6, 'b', 'mw', { eye: 1.4 }),
  S('sauger', 'Sauger', 'perch', [0.5, 1.5, 8.8], [0x4a4632, 0xa89a6a, 0xf0ece0, 0x6a6040], 'mottled', 0.42, 0, 5, 'b', 'mw'),
  S('pike', 'Northern Pike', 'pike', [1, 6, 55], [0x2d4022, 0x6a8048, 0xf0f0e0, 0x8a6a30], 'beans', 0.7, 0.2, 4, 'm', 'm'),
  S('muskie', 'Muskellunge', 'pike', [5, 15, 67.5], [0x4a4a30, 0xa8a070, 0xf0ece0, 0x9a6a40], 'tigerbars', 0.85, 0.4, 8, 'm', 'm'),
  S('pickerel', 'Chain Pickerel', 'pike', [0.5, 1.5, 9.4], [0x3a4a20, 0x9aa050, 0xf0f0d8, 0x7a7a40], 'chain', 0.5, 0.2, 3, 's', 'm'),
  S('channelcat', 'Channel Catfish', 'catfish', [1, 5, 58], [0x4a5560, 0x8a96a0, 0xf0f0f0, 0x5a6570], 'darkspots', 0.55, 0, 3, 'b', 'bwp'),
  S('bluecat', 'Blue Catfish', 'catfish', [2, 15, 143], [0x3a4a68, 0x7088a0, 0xf0f0f4, 0x4a5a78], 'none', 0.7, 0, 3, 'b', 'bm'),
  S('flathead', 'Flathead Catfish', 'catfish', [2, 15, 123], [0x5a4a28, 0x9a8040, 0xe8e0c0, 0x6a5a30], 'mottled', 0.72, 0, 3, 'b', 'm', { o: { W: 0.24 } }),
  S('carp', 'Common Carp', 'carp', [2, 10, 101], [0x5a4a20, 0xc0a050, 0xf0e0b0, 0x9a6a30], 'scales', 0.6, 0.05, 1, 'b', 'p'),
  S('grasscarp', 'Grass Carp', 'carp', [5, 20, 87], [0x4a4a38, 0xa8a888, 0xe8e8d8, 0x6a6a58], 'scales', 0.7, 0.1, 1, 'm', 'p', { o: { H: 0.2 } }),
  S('bowfin', 'Bowfin', 'bowfin', [1, 4, 21.5], [0x3a4a28, 0x6a7a48, 0xd8d8b0, 0x4a6a30], 'mottled', 0.7, 0.1, 1.5, 'm', 'm', { o: { tailspot: 1 } }),
  S('longnosegar', 'Longnose Gar', 'gar', [2, 8, 50], [0x4a5030, 0x9a9a68, 0xe8e8d0, 0x6a6a40], 'darkspots', 0.5, 0.3, 1, 's', 'm'),
  S('alligatorgar', 'Alligator Gar', 'gar', [10, 60, 327], [0x40482c, 0x8a8a5e, 0xe0e0c8, 0x5a5a38], 'darkspots', 0.8, 0.3, 2, 'm', 'mb', { o: { snout: 0.12, H: 0.13 } }),
  S('tilapia', 'Blue Tilapia', 'panfish', [0.5, 2, 9.4], [0x405a6a, 0x8aa0a8, 0xe0e8e8, 0x506a7a], 'faintbars', 0.35, 0, 2, 'm', 'p', { o: { H: 0.38 } }),
  S('whitebass', 'White Bass', 'bass', [0.5, 1.5, 6.8], [0x4a5a6a, 0xd0d8e0, 0xffffff, 0x8a9aa8], 'hlines', 0.5, 0.2, 3, 'm', 'm', { metal: 0.5, o: { H: 0.33 } }),
  S('stripedbass', 'Striped Bass', 'bass', [3, 12, 81.9], [0x3a4a5a, 0xc8d0d8, 0xffffff, 0x7a8a98], 'hlines', 0.75, 0.2, 5, 'm', 'mcq', { metal: 0.5, o: { H: 0.24 } }),
  // ---- cold freshwater / rivers
  S('rainbow', 'Rainbow Trout', 'trout', [0.5, 2.5, 48], [0x3a5a4a, 0xc0c8b0, 0xf0f0f0, 0x8a8a70], 'rainbow', 0.62, 0.8, 5, 'm', 'iwm', { metal: 0.3 }),
  S('brown', 'Brown Trout', 'trout', [0.5, 3, 44.4], [0x5a4a28, 0xc8a058, 0xf0e0b0, 0x8a7040], 'redspots', 0.62, 0.6, 5, 'm', 'iwm'),
  S('brook', 'Brook Trout', 'trout', [0.3, 1, 14.5], [0x2a3a28, 0x5a6a40, 0xe86030, 0xe05030], 'vermic', 0.5, 0.4, 6, 'm', 'iw'),
  S('laketrout', 'Lake Trout', 'trout', [2, 10, 102], [0x3e4952, 0x7f8790, 0xf0f0f0, 0x6a7078], 'specks', 0.66, 0.05, 6, 'b', 'm', { o: { tail: ['fork', 0.22] } }),
  S('cutthroat', 'Lahontan Cutthroat', 'trout', [1, 4, 41], [0x5a6040, 0xb0a870, 0xf0d0b0, 0x8a8050], 'darkspots', 0.58, 0.6, 7, 'm', 'iwm', { throat: 1 }),
  S('kokanee', 'Kokanee Salmon', 'salmon', [0.5, 1.5, 9.6], [0x2e4f72, 0xd0d8e0, 0xffffff, 0x6a7a8a], 'none', 0.45, 0.5, 5, 'm', 'im', { metal: 0.6 }),
  S('whitefish', 'Lake Whitefish', 'salmon', [1, 3, 15], [0x5a6a6a, 0xd8dcd8, 0xffffff, 0xa0a8a0], 'none', 0.4, 0.1, 3, 'b', 'ic', { metal: 0.5, o: { H: 0.25 } }),
  S('burbot', 'Burbot', 'eel', [1, 4, 25.2], [0x4a4a2a, 0x8a8a5a, 0xd8d8b8, 0x5a5a3a], 'mottled', 0.4, 0, 4, 'b', 'mb', { barbel: 1 }),
  S('lakesturgeon', 'Lake Sturgeon', 'sturgeon', [10, 50, 240], [0x4a4a40, 0x8a8a78, 0xe0e0d0, 0x6a6a5a], 'none', 0.7, 0.2, 3, 'b', 'bw'),
  S('whitesturgeon', 'White Sturgeon', 'sturgeon', [20, 90, 600], [0x50565a, 0x9aa0a4, 0xeeeeee, 0x70767a], 'none', 0.85, 0.4, 3, 'b', 'bm'),
  S('chinook', 'Chinook Salmon', 'salmon', [8, 22, 97.4], [0x3a5070, 0xc8d0d8, 0xffffff, 0x5a6a7a], 'darkspots', 0.85, 0.5, 9, 'm', 'mq', { metal: 0.5 }),
  S('coho', 'Coho Salmon', 'salmon', [3, 9, 33], [0x2e4a6e, 0xd0d6dc, 0xffffff, 0x5a6a7a], 'darkspots', 0.75, 0.7, 8, 'm', 'mq', { metal: 0.5 }),
  S('steelhead', 'Steelhead', 'trout', [4, 9, 42], [0x3a5268, 0xd0d4d0, 0xffffff, 0x7a8080], 'rainbow', 0.82, 0.85, 8, 'm', 'mwi', { metal: 0.4 }),
  S('sockeye', 'Sockeye Salmon', 'salmon', [3, 6, 15.5], [0x3a5a40, 0xc02020, 0xe04040, 0x3a5a40], 'none', 0.7, 0.6, 8, 'm', 'mi', { hook: 1 }),
  S('shad', 'American Shad', 'herring', [1, 3, 11.2], [0x2e4a6a, 0xd8e0e8, 0xffffff, 0x8a98a8], 'shadspots', 0.55, 0.6, 2, 's', 'mi', { metal: 0.7 }),
  // ---- Amazon
  S('arapaima', 'Arapaima', 'arapaima', [40, 150, 440], [0x3a4a40, 0x8a9080, 0xd0d0c0, 0xc03020], 'redscales', 0.9, 0.5, 4, 's', 'm'),
  S('piranha', 'Red-bellied Piranha', 'piranha', [0.3, 1, 7.7], [0x5a6068, 0xa8b0b0, 0xd04020, 0x5a5050], 'specks', 0.35, 0, 3, 'm', 'mb', { metal: 0.4, teeth: 1 }),
  S('pacu', 'Pacu', 'piranha', [2, 8, 65], [0x4a4a48, 0x8a8a88, 0xd8a040, 0x5a4a40], 'none', 0.6, 0, 3, 'm', 'p'),
  S('payara', 'Payara', 'salmon', [2, 8, 39.5], [0x5a6a70, 0xd8dcdc, 0xffffff, 0x8a9898], 'none', 0.8, 0.7, 6, 'm', 'm', { teeth: 1, metal: 0.6, o: { H: 0.2 } }),
  S('redtail', 'Redtail Catfish', 'catfish', [5, 40, 123], [0x2a2a2a, 0x4a4a4a, 0xf0e8d0, 0xd04020], 'redtail', 0.75, 0, 3, 'b', 'bm'),
  S('piraiba', 'Piraiba Catfish', 'catfish', [20, 100, 340], [0x50565c, 0x8a9096, 0xf4f4f4, 0x6a7076], 'none', 0.9, 0, 3, 'b', 'bm'),
  S('arowana', 'Silver Arowana', 'arowana', [1, 4, 13], [0x4a5a5a, 0xd0d8d0, 0xf8f8f0, 0x8a9a9a], 'bigscales', 0.6, 0.7, 5, 's', 'im', { metal: 0.7, barbel: 2 }),
  S('trairao', 'Trairao (Wolf Fish)', 'bowfin', [2, 8, 40], [0x3a3a2a, 0x6a6a4a, 0xc8c8a8, 0x4a4a3a], 'mottled', 0.7, 0.1, 3, 'm', 'm', { teeth: 1 }),
  // ---- inshore saltwater
  S('redfish', 'Red Drum', 'drum', [2, 8, 94.2], [0x8a5a30, 0xd09050, 0xf0e8d8, 0x9a6a40], 'tailspot', 0.72, 0, 5, 'b', 'cmb'),
  S('seatrout', 'Spotted Seatrout', 'snook', [0.5, 2, 17.4], [0x50606a, 0xb8c0c4, 0xf4f4f4, 0x8a9094], 'darkspots', 0.4, 0.2, 5, 'm', 'mc'),
  S('snook', 'Common Snook', 'snook', [2, 8, 53.6], [0x5a5a40, 0xd8d8c8, 0xffffff, 0xd8c860], 'lateral', 0.75, 0.6, 6, 'm', 'mc'),
  S('tarpon', 'Tarpon', 'tarpon', [20, 80, 286.9], [0x3a4a5a, 0xe0e8ee, 0xffffff, 0x6a7a8a], 'bigscales', 0.95, 1, 3, 's', 'mc', { metal: 0.85 }),
  S('bonefish', 'Bonefish', 'bonefish', [2, 6, 19], [0x7a8a90, 0xe0e8ea, 0xffffff, 0xa8b0b4], 'faintbars', 0.88, 0, 6, 'b', 'c', { metal: 0.7 }),
  S('permit', 'Permit', 'jack', [5, 20, 60], [0x3a4a5a, 0xd8dee2, 0xffffff, 0x2a2a30], 'none', 0.92, 0, 8, 'm', 'c', { metal: 0.6, o: { H: 0.5 } }),
  S('barracuda', 'Great Barracuda', 'barracuda', [3, 20, 85], [0x3a4a50, 0xd0d8dc, 0xffffff, 0x4a5458], 'darkblots', 0.7, 0.6, 2, 's', 'm', { metal: 0.6, teeth: 1 }),
  S('crevalle', 'Jack Crevalle', 'jack', [3, 15, 66], [0x3a4a40, 0xc8c8a0, 0xf0e8b0, 0xe0c040], 'none', 0.92, 0, 1.5, 'm', 'm', { metal: 0.5 }),
  S('muttonsnapper', 'Mutton Snapper', 'snapper', [3, 10, 30.4], [0x6a6a50, 0xd0a080, 0xf0d8c0, 0xd08060], 'spot', 0.6, 0, 7, 'b', 'mcb'),
  S('mangrovesnapper', 'Mangrove Snapper', 'snapper', [0.5, 2, 17], [0x5e4434, 0xb07050, 0xe8c0a0, 0xa05040], 'specks', 0.5, 0, 7, 'b', 'mcb'),
  S('sheepshead', 'Sheepshead', 'panfish', [1, 4, 21.2], [0x5a5a50, 0xe0e0d8, 0xf8f8f0, 0x4a4a48], 'bars', 0.5, 0, 4, 'b', 'c', { teeth: 1, o: { H: 0.42 } }),
  S('flounder', 'Southern Flounder', 'flat', [1, 3, 20.6], [0x6a5a40, 0x8a7a58, 0xf8f8f0, 0x7a6a50], 'mottled', 0.45, 0, 6, 'b', 'mc'),
  S('cobia', 'Cobia', 'cobia', [10, 30, 135.6], [0x3a3228, 0x6a5a48, 0xf0e8d8, 0x2a2420], 'lateral', 0.88, 0.1, 7, 'm', 'mcq'),
  S('lemonshark', 'Lemon Shark', 'shark', [40, 150, 405], [0xa89060, 0xc0a870, 0xf0e8d0, 0xa89060], 'none', 0.88, 0, 1, 'm', 'mb'),
  S('blacktip', 'Blacktip Shark', 'shark', [20, 60, 270], [0x6a7078, 0x9aa0a8, 0xf8f8f8, 0x6a7078], 'tips', 0.85, 0.6, 1, 'm', 'mb'),
  S('nurseshark', 'Nurse Shark', 'shark', [20, 80, 265], [0x8a7048, 0xa08860, 0xd8c8a8, 0x8a7048], 'none', 0.6, 0, 0.5, 'b', 'cb', { o: { H: 0.14, barbel: 2 } }),
  // ---- offshore
  S('yellowfin', 'Yellowfin Tuna', 'tuna', [20, 80, 427], [0x1a2a5a, 0xb8c0d0, 0xf0f0f4, 0xf0c020], 'yellowstripe', 1, 0, 12, 'm', 'mq', { metal: 0.6, o: { longfins: 1 } }),
  S('blackfin', 'Blackfin Tuna', 'tuna', [5, 15, 49.4], [0x14203a, 0xa8b0c0, 0xf0f0f4, 0x3a4050], 'bellystripes', 0.9, 0, 9, 'm', 'mq', { metal: 0.6 }),
  S('bluefin', 'Atlantic Bluefin Tuna', 'tuna', [100, 400, 1496], [0x0e1a3a, 0x8a98ac, 0xeef0f4, 0xd8c040], 'bellystripes', 1, 0, 20, 'm', 'mq', { metal: 0.6 }),
  S('skipjack', 'Skipjack Tuna', 'tuna', [3, 8, 45], [0x1a2848, 0xb0b8c8, 0xf4f4f8, 0x3a4458], 'bellylines', 0.8, 0, 3, 's', 'mq', { metal: 0.6 }),
  S('mahi', 'Mahi-Mahi', 'mahi', [5, 20, 87], [0x1a6a5a, 0x60c060, 0xf0e040, 0x2080c0], 'mahi', 0.8, 0.9, 7, 's', 'mq', { metal: 0.4 }),
  S('wahoo', 'Wahoo', 'mackerel', [15, 40, 184], [0x1a3a6a, 0x90a8c0, 0xf0f0f0, 0x2a4a7a], 'tigerbars', 0.92, 0.2, 8, 'm', 'm', { metal: 0.6, teeth: 1 }),
  S('kingmackerel', 'King Mackerel', 'mackerel', [5, 25, 93], [0x2a3a5a, 0xc0c8d4, 0xf8f8fa, 0x4a5a6a], 'none', 0.8, 0.6, 4, 'm', 'm', { metal: 0.7, teeth: 1 }),
  S('sailfish', 'Sailfish', 'billfish', [30, 70, 221], [0x1a2a5a, 0x6080a8, 0xf0f0f0, 0x2a3a8a], 'sailstripes', 0.9, 1, 15, 's', 'mq', { metal: 0.4, o: { sail: 1 } }),
  S('bluemarlin', 'Blue Marlin', 'billfish', [150, 400, 1805], [0x10204a, 0x4a6a9a, 0xf0f0f4, 0x1a2a5a], 'sailstripes', 1, 1, 25, 's', 'mq', { metal: 0.4 }),
  S('whitemarlin', 'White Marlin', 'billfish', [40, 70, 181], [0x1a2a4a, 0x7a90b0, 0xf4f4f6, 0x2a3a5a], 'faintbars', 0.92, 1, 18, 's', 'mq', { metal: 0.4 }),
  S('blackmarlin', 'Black Marlin', 'billfish', [150, 500, 1560], [0x101828, 0x4a5a70, 0xeeeeee, 0x1a2230], 'none', 1, 1, 25, 's', 'mq', { metal: 0.4 }),
  S('swordfish', 'Swordfish', 'swordfish', [50, 200, 1182], [0x2a2030, 0x6a5a70, 0xd8d0d8, 0x3a3040], 'none', 1, 0.3, 18, 'b', 'q', { metal: 0.3 }),
  S('redsnapper', 'Red Snapper', 'snapper', [2, 10, 50.4], [0xc03030, 0xe06050, 0xf8d0c0, 0xd04040], 'none', 0.55, 0, 9, 'b', 'mqb'),
  S('amberjack', 'Greater Amberjack', 'jack', [15, 40, 155.6], [0x4a4a3a, 0xc0b8a0, 0xf0ece0, 0x8a7a50], 'amberstripe', 0.95, 0, 3, 'b', 'mq', { metal: 0.4, o: { H: 0.26 } }),
  S('gag', 'Gag Grouper', 'grouper', [5, 20, 80.6], [0x4a4a48, 0x7a7a70, 0xd8d0c0, 0x3a3a40], 'mottled', 0.82, 0, 9, 'b', 'mb'),
  S('redgrouper', 'Red Grouper', 'grouper', [3, 10, 42.4], [0x8a4a3a, 0xb06a50, 0xe8c8b0, 0x7a4030], 'mottled', 0.75, 0, 9, 'b', 'mb'),
  S('goliath', 'Goliath Grouper', 'grouper', [50, 250, 680], [0x5a5038, 0x8a7a58, 0xd8c8a0, 0x4a4030], 'mottled', 1, 0, 0.5, 'b', 'mb', { o: { H: 0.32, W: 0.32 } }),
  S('mako', 'Shortfin Mako', 'shark', [60, 300, 1221], [0x1a3a7a, 0x4a6aa0, 0xf8f8f8, 0x1a3a7a], 'none', 1, 0.9, 3, 'm', 'mq', { metal: 0.3, teeth: 1 }),
  S('hammerhead', 'Great Hammerhead', 'shark', [100, 400, 1280], [0x6a6a60, 0x9a9a90, 0xf4f4f0, 0x6a6a60], 'none', 1, 0, 1, 'm', 'mb', { hammer: 1, o: { dorsalTall: 1 } }),
  S('tigershark', 'Tiger Shark', 'shark', [100, 500, 1785], [0x5a5a50, 0x8a8a78, 0xf0f0e8, 0x5a5a50], 'tigerbars', 1, 0, 1, 'm', 'mbq'),
  // ---- Great Barrier Reef
  S('coraltrout', 'Coral Trout', 'grouper', [2, 6, 53], [0xb01e1e, 0xe04030, 0xf06050, 0xc02a2a], 'bluespots', 0.75, 0, 12, 'b', 'm', { o: { H: 0.26 } }),
  S('gt', 'Giant Trevally', 'jack', [10, 50, 160], [0x2a3036, 0x9aa0a6, 0xe8ecee, 0x2a2e34], 'specks', 1, 0, 2, 'm', 'm', { metal: 0.5 }),
  S('redemperor', 'Red Emperor', 'snapper', [3, 10, 50], [0xc02a2a, 0xf0d0c8, 0xffffff, 0xc03030], 'redbars', 0.7, 0, 12, 'b', 'mqb'),
  S('sweetlips', 'Painted Sweetlips', 'snapper', [2, 5, 15], [0x5a6070, 0xa8b0c0, 0xe0e4ea, 0xd8c030], 'specks', 0.55, 0, 6, 'b', 'c'),
  S('barramundi', 'Barramundi', 'snook', [3, 15, 98], [0x4a5a5a, 0xd0d6d0, 0xf8f8f4, 0x7a8478], 'none', 0.8, 0.7, 9, 'm', 'mc', { metal: 0.5, o: { H: 0.27 } }),
  S('mangrovejack', 'Mangrove Jack', 'snapper', [2, 6, 22], [0x8a3020, 0xc05030, 0xe08060, 0xb04030], 'none', 0.8, 0, 9, 'm', 'mc'),
  S('queenfish', 'Queenfish', 'jack', [3, 10, 32], [0x3a5070, 0xe0e6ec, 0xffffff, 0xc8c060], 'specks', 0.75, 0.6, 2, 's', 'm', { metal: 0.6, o: { H: 0.3 } }),
  S('dogtooth', 'Dogtooth Tuna', 'tuna', [20, 80, 509], [0x1a2a40, 0x9aa4b4, 0xf0f0f4, 0x2a3a50], 'none', 1, 0, 9, 'b', 'mq', { metal: 0.6, teeth: 1 }),
  S('parrotfish', 'Blue-barred Parrotfish', 'parrot', [2, 6, 20], [0x1a7a6a, 0x30a890, 0x70d0c0, 0xe060a0], 'scales', 0.5, 0, 3, 'm', 'p'),
  S('spangled', 'Spangled Emperor', 'snapper', [2, 6, 20], [0x6a6a5a, 0xc0c0a8, 0xf0f0e0, 0xd06040], 'bluespots', 0.65, 0, 8, 'b', 'cm'),
  S('spanishmackerel', 'Narrow-barred Spanish Mackerel', 'mackerel', [10, 30, 99], [0x2a4a6a, 0xc0ccd8, 0xf8f8fa, 0x3a5a7a], 'wavy', 0.88, 0.5, 7, 's', 'm', { metal: 0.7, teeth: 1 }),
  S('blackmarlin_r', 'Reef Black Marlin', 'billfish', [100, 300, 1560], [0x101828, 0x4a5a70, 0xeeeeee, 0x1a2230], 'faintbars', 1, 1, 22, 's', 'mq', { metal: 0.4 }),
  // ---- North Atlantic / fjord
  S('cod', 'Atlantic Cod', 'cod', [3, 15, 103], [0x5a5a38, 0xa8a070, 0xf0ece0, 0x6a6a48], 'specks', 0.5, 0, 4, 'b', 'mcq', { barbel: 1, net: 1 }),
  S('halibut', 'Atlantic Halibut', 'flat', [20, 100, 515], [0x3a3a30, 0x5a5a48, 0xf8f8f8, 0x3a3a30], 'mottled', 0.95, 0, 9, 'b', 'mq'),
  S('saithe', 'Pollock (Saithe)', 'cod', [3, 10, 50], [0x2a3a30, 0x7a8478, 0xe0e4e0, 0x3a4a40], 'none', 0.65, 0, 3, 'm', 'mq', { net: 1 }),
  S('haddock', 'Haddock', 'cod', [1, 3, 37], [0x4a4a50, 0x9a9aa0, 0xf0f0f0, 0x4a4a50], 'haddock', 0.4, 0, 4, 'b', 'cq', { barbel: 1, net: 1 }),
  S('ling', 'Common Ling', 'eel', [5, 20, 90], [0x4a5040, 0x8a9070, 0xe0e0d0, 0x4a5040], 'mottled', 0.6, 0, 3, 'b', 'mb', { barbel: 1 }),
  S('wolffish', 'Atlantic Wolffish', 'eel', [3, 10, 52], [0x4a5058, 0x7a8088, 0xc8ccd0, 0x4a5058], 'bars', 0.6, 0, 4, 'b', 'c', { teeth: 1, o: { H: 0.17 } }),
  S('atlsalmon', 'Atlantic Salmon', 'salmon', [5, 15, 79], [0x3a4a5a, 0xd0d6dc, 0xffffff, 0x5a6a7a], 'darkspots', 0.85, 0.8, 10, 'm', 'mi', { metal: 0.5 }),
  S('mackerel', 'Atlantic Mackerel', 'mackerel', [0.5, 1, 7], [0x1a4a6a, 0xc0d0d8, 0xf8f8fa, 0x2a4a5a], 'wavy', 0.5, 0, 2, 's', 'm', { metal: 0.6, net: 1 }),
  S('monkfish', 'Monkfish', 'flat', [5, 20, 127], [0x5a4a38, 0x7a6a50, 0xe0d8c8, 0x5a4a38], 'mottled', 0.5, 0, 6, 'b', 'm', { o: { W: 0.42 } }),
  S('porbeagle', 'Porbeagle Shark', 'shark', [80, 200, 507], [0x3a4250, 0x6a7280, 0xf4f4f4, 0x3a4250], 'none', 0.95, 0.3, 2, 'm', 'mq', { o: { H: 0.22 } }),
  S('goldenredfish', 'Golden Redfish', 'snapper', [1, 3, 33], [0xc04020, 0xe06030, 0xf09060, 0xd05028], 'none', 0.4, 0, 4, 'b', 'mc', { eye: 1.5, net: 1 }),
  // ---- commercial / schooling (nets mostly)
  S('herring', 'Atlantic Herring', 'herring', [0.2, 0.5, 2.3], [0x2a4a6a, 0xd0d8e0, 0xffffff, 0x8a9aa8], 'none', 0.2, 0, 1.2, 'm', 'i', { metal: 0.8, net: 1 }),
  S('sardine', 'Pacific Sardine', 'herring', [0.1, 0.25, 1], [0x1a4060, 0xc8d4dc, 0xffffff, 0x8a9aa8], 'shadspots', 0.15, 0, 1.5, 's', 'i', { metal: 0.8, net: 1 }),
  S('anchovy', 'Anchovy', 'herring', [0.02, 0.06, 0.15], [0x3a6a6a, 0xd8e0e0, 0xffffff, 0xa0b0b0], 'lateral', 0.1, 0, 3, 's', 'i', { metal: 0.8, net: 1 }),
  S('menhaden', 'Gulf Menhaden', 'herring', [0.2, 0.5, 1.5], [0x3a5a4a, 0xd0d8c8, 0xf8f8f0, 0xd0c060], 'shadspots', 0.2, 0, 0.6, 's', 'i', { metal: 0.7, net: 1, o: { H: 0.3 } }),
  S('capelin', 'Capelin', 'herring', [0.05, 0.1, 0.2], [0x3a5a50, 0xc8d4d0, 0xf8f8f8, 0x8a9a90], 'none', 0.1, 0, 2, 'm', 'i', { metal: 0.7, net: 1 }),
  S('alaskapollock', 'Alaska Pollock', 'cod', [1, 2, 10], [0x4a5040, 0x9aa090, 0xf0f0e8, 0x5a6050], 'specks', 0.35, 0, 1.5, 'm', 'mi', { net: 1 }),
  S('pacificcod', 'Pacific Cod', 'cod', [3, 10, 50], [0x5a5440, 0x9a9070, 0xf0ece0, 0x6a6448], 'specks', 0.5, 0, 3, 'b', 'mcq', { barbel: 1, net: 1 }),
  S('hake', 'Silver Hake', 'cod', [0.5, 1.5, 5], [0x5a6068, 0xc8ccd0, 0xf8f8f8, 0x7a8088], 'none', 0.3, 0, 2, 'b', 'm', { net: 1, o: { H: 0.15 } }),
  S('pacifichalibut', 'Pacific Halibut', 'flat', [20, 60, 459], [0x3a3a30, 0x5a5a48, 0xf8f8f8, 0x3a3a30], 'mottled', 0.95, 0, 10, 'b', 'mq'),
  S('sablefish', 'Sablefish', 'cod', [3, 8, 57], [0x2a2a30, 0x4a4a52, 0xa0a0a8, 0x2a2a30], 'none', 0.5, 0, 12, 'b', 'mq', { net: 1 }),
  S('chum', 'Chum Salmon', 'salmon', [6, 12, 35], [0x3a4a3a, 0x8a8a5a, 0xe0e0d0, 0x4a5a4a], 'calicobars', 0.8, 0.5, 4, 'm', 'm', { hook: 1, net: 1 }),
  S('pacificherring', 'Pacific Herring', 'herring', [0.2, 0.4, 1.2], [0x2a4a6a, 0xd0d8e0, 0xffffff, 0x8a9aa8], 'none', 0.2, 0, 1, 'm', 'i', { metal: 0.8, net: 1 }),
  // ---- Chesapeake Bay
  S('bluefish', 'Bluefish', 'snook', [1, 5, 31.8], [0x2a5a6a, 0xa8c4cc, 0xf4f8f8, 0x5a7a80], 'none', 0.88, 0.4, 2, 'm', 'mq', { teeth: 1, metal: 0.4, o: { tail: ['fork', 0.28], dorsal: [[0.3, 0.42, 0.1, 'spiny'], [0.46, 0.66, 0.11, 'tri']] } }),
  S('croaker', 'Atlantic Croaker', 'drum', [0.3, 1, 8], [0x6a6040, 0xc8b890, 0xf0e8d8, 0xb8a070], 'specks', 0.35, 0, 2.5, 'b', 'cwb'),
  S('spotcroaker', 'Spot', 'drum', [0.1, 0.4, 1.5], [0x4a5a68, 0xc0c8cc, 0xf4f4f0, 0xd0b860], 'spot', 0.25, 0, 3, 'b', 'wc', { o: { H: 0.32 } }),
  S('summerflounder', 'Summer Flounder', 'flat', [1, 3, 22.5], [0x6a5840, 0x8a7656, 0xf8f8f0, 0x7a6a50], 'darkspots', 0.5, 0, 7, 'b', 'mq'),
  S('blackdrum', 'Black Drum', 'drum', [5, 25, 113], [0x2e2e2e, 0x6a6a6a, 0xd8d8d0, 0x2a2a2a], 'faintbars', 0.75, 0, 2, 'b', 'c', { barbel: 6, o: { H: 0.32 } }),
  S('whiteperch', 'White Perch', 'bass', [0.2, 0.6, 4.8], [0x4a5a50, 0xc8d0c8, 0xf4f4f0, 0x8a9488], 'none', 0.35, 0, 3, 'm', 'wim', { metal: 0.4, o: { H: 0.32 } }),
  // ---- Lake Kariba
  S('tigerfish', 'Tigerfish', 'salmon', [1, 6, 35.3], [0x3a4a50, 0xd8dcd8, 0xffffff, 0xd02a20], 'hlines', 0.92, 0.9, 4, 'm', 'm', { teeth: 1, metal: 0.6, o: { tail: ['fork', 0.27] } }),
  S('vundu', 'Vundu', 'catfish', [10, 40, 121], [0x4a4a3a, 0x7a7a60, 0xe0dccc, 0x5a5a48], 'darkspots', 0.82, 0, 2, 'b', 'bm', { o: { W: 0.22 } }),
  S('sharptooth', 'Sharptooth Catfish', 'catfish', [2, 10, 79], [0x3a3a30, 0x6a6a58, 0xd8d4c4, 0x4a4a3a], 'mottled', 0.6, 0, 1.5, 'b', 'bmw', { o: { H: 0.14, dorsal: [[0.3, 0.88, 0.06, 'long']], adipose: 0 } }),
  S('threespot', 'Three-spot Tilapia', 'panfish', [0.5, 2, 10], [0x3a5a40, 0x8aa070, 0xe8e0b8, 0x4a6a4a], 'darkspots', 0.45, 0, 3, 'm', 'wpi', { o: { H: 0.42 } }),
  S('karibatilapia', 'Kariba Tilapia', 'panfish', [0.5, 1.5, 7], [0x3a4a3a, 0x7a8a6a, 0xe0d8b8, 0xc04030], 'faintbars', 0.38, 0, 3, 'm', 'p', { o: { H: 0.4 } }),
  S('nembwe', 'Nembwe', 'bass', [0.5, 2, 8.5], [0x3a4a2a, 0x9aa060, 0xf0e0a0, 0x7a7a40], 'specks', 0.62, 0.3, 4, 'm', 'mi'),
  // ---- Mekong
  S('mekongcat', 'Mekong Giant Catfish', 'catfish', [60, 250, 646], [0x5a6068, 0x9aa0a8, 0xf0f0f0, 0x6a7078], 'none', 0.92, 0, 3, 'b', 'p', { barbel: 0, o: { H: 0.2 } }),
  S('siamesecarp', 'Siamese Giant Carp', 'carp', [10, 60, 300], [0x4a5048, 0xb8bcb0, 0xf0f0e8, 0x7a8078], 'bigscales', 0.85, 0.05, 2, 'm', 'p', { barbel: 0, metal: 0.3 }),
  S('giantsnakehead', 'Giant Snakehead', 'bowfin', [2, 10, 44], [0x2a3020, 0x4a5a38, 0xd8d8c0, 0x3a4a2a], 'darkblots', 0.85, 0.2, 3, 's', 'm', { teeth: 1, o: { W: 0.14 } }),
  S('stripedcatfish', 'Iridescent Shark', 'catfish', [2, 10, 97], [0x3a4450, 0x9aa4b0, 0xf0f0f4, 0x4a5460], 'none', 0.72, 0, 2, 'm', 'pb', { metal: 0.5, barbel: 2, o: { H: 0.2 } }),
  S('julliensbarb', 'Jullien\'s Golden Carp', 'carp', [3, 15, 110], [0x5a5030, 0xd0b060, 0xf4ecd0, 0x9a7a40], 'hlines', 0.8, 0, 3, 'b', 'pw', { barbel: 0 }),
  S('giantgourami', 'Giant Gourami', 'panfish', [1, 5, 20], [0x5a5a48, 0xb0a888, 0xe8e0c8, 0x8a8068], 'faintbars', 0.5, 0, 3, 's', 'pi', { o: { H: 0.45 } }),
  S('soldierbarb', 'Soldier River Barb', 'carp', [0.5, 2, 13], [0x4a5a6a, 0xd8dce0, 0xffffff, 0xd04030], 'none', 0.55, 0.1, 2, 'm', 'pi', { metal: 0.5 }),
  // ---- Baja / Cabo San Lucas
  S('stripedmarlin', 'Striped Marlin', 'billfish', [60, 130, 494], [0x10204a, 0x5a7aa8, 0xf0f0f4, 0x1a2a6a], 'sailstripes', 1, 1, 20, 's', 'mq'),
  S('roosterfish', 'Roosterfish', 'jack', [5, 30, 114], [0x3a4a5a, 0xd0d4d8, 0xf8f8f8, 0x2a2a2a], 'bars', 0.95, 0.2, 2, 'm', 'm', { metal: 0.4, o: { H: 0.32, dorsal: [[0.2, 0.4, 0.3, 'spiny'], [0.45, 0.8, 0.11, 'sickle']] } }),
  S('sierra', 'Pacific Sierra', 'mackerel', [1, 4, 18], [0x2a4a6a, 0xc0ccd8, 0xf8f8fa, 0x3a5a7a], 'specks', 0.7, 0.4, 4, 'm', 'm', { metal: 0.5, teeth: 1 }),
  S('pargo', 'Pacific Dog Snapper', 'snapper', [3, 12, 60], [0x7a3a2a, 0xb06a50, 0xe8c0a8, 0x8a4030], 'faintbars', 0.82, 0, 6, 'b', 'mc', { teeth: 1 }),
  S('cabrilla', 'Leopard Grouper', 'grouper', [2, 6, 25], [0x5a3a3a, 0x9a6a5a, 0xe0c0b0, 0x6a4040], 'leopard', 0.7, 0, 6, 'b', 'mc'),
  S('yellowtail', 'California Yellowtail', 'jack', [5, 20, 109], [0x2a3a5a, 0xc8d0d8, 0xf4f4f4, 0xf0c020], 'yellowstripe', 0.95, 0, 6, 'm', 'mq', { metal: 0.4, o: { H: 0.25 } }),
  // ---- batch 3 (sci = scientific name, fam = family, note = journal text once caught)
  // Pacific northwest and Alaska
  S('pink', 'Pink Salmon', 'salmon', [1.5, 4, 14.7], [0x2a4058, 0xc8d0d8, 0xf4f4f4, 0x6a7a8a], 'tailspot', 0.6, 0.6, 3, 'm', 'mi', { metal: 0.5, sci: 'Oncorhynchus gorbuscha', fam: 'Salmonidae', note: 'Runs in huge numbers and, in the river, loses its good looks fast. Fresh from salt water it fights harder than its size and eats fine; a week up the gravel it is only company.' }),
  S('bulltrout', 'Bull Trout', 'trout', [2, 8, 32], [0x4a5a40, 0xa8b090, 0xf0eee0, 0xc8a060], 'specks', 0.7, 0.3, 7, 'b', 'm', { o: { H: 0.2, mouth: 0.18 }, sci: 'Salvelinus confluentus', fam: 'Salmonidae', note: 'A char, not a trout, and it behaves like a pike: it sits low in cold holes and takes anything small enough to swallow. Protected in most of its range, so the photograph is the trophy.' }),
  S('pikeminnow', 'Northern Pikeminnow', 'carp', [1, 3, 12.6], [0x5a6040, 0xb8b890, 0xf0ecd8, 0xc08040], 'scales', 0.4, 0, 1, 'm', 'm', { barbel: 0, o: { H: 0.19, W: 0.12 }, sci: 'Ptychocheilus oregonensis', fam: 'Leuciscidae', note: 'The river keeps a bounty on these because they eat young salmon, which makes it the one fish here that earns less for being caught than for being counted.' }),
  S('dollyvarden', 'Dolly Varden', 'trout', [1, 3, 27], [0x3a4a38, 0x7a9068, 0xf0b090, 0xd8603a], 'spot', 0.6, 0.5, 6, 'm', 'iwm', { sci: 'Salvelinus malma', fam: 'Salmonidae', note: 'Follows the salmon up the creek and eats their eggs, which is the whole plan. Pink spots on olive, orange fins, and a belly that colours up in autumn.' }),
  S('lingcod', 'Lingcod', 'cod', [4, 18, 105], [0x4a4a3a, 0x8a8a60, 0xd8d4b8, 0x5a5a40], 'mottled', 0.8, 0, 7, 'b', 'm', { teeth: 1, o: { H: 0.17, mouth: 0.2, tail: ['round', 0.2] }, sci: 'Ophiodon elongatus', fam: 'Hexagrammidae', note: 'Not a cod. Mottled, all mouth, and it will hold a jig in its teeth up to the boat and look at you. The flesh of some is blue-green and cooks white.' }),
  S('yelloweye', 'Yelloweye Rockfish', 'grouper', [3, 10, 39], [0xc83a20, 0xe8602a, 0xf8e0c8, 0xd85a24], 'none', 0.6, 0, 12, 'b', 'mc', { eye: 1.3, o: { H: 0.34, tail: ['truncate', 0.2] }, sci: 'Sebastes ruberrimus', fam: 'Sebastidae', note: 'Orange as a traffic cone and may be over a hundred years old. Hauled from deep rock it arrives with its eyes out. A slow fish that does not recover fast, so treat it with some respect.' }),
  // Norway
  S('greenland', 'Greenland Shark', 'shark', [300, 800, 2100], [0x5a5650, 0x6e6a62, 0xa8a49a, 0x5a5650], 'none', 0.5, 0, 0.3, 'b', 'bm', { eye: 0.6, o: { H: 0.2, W: 0.2, blunt: 0.6, pect: 0.12, tail: ['hetero', 0.25], dorsal: [[0.52, 0.57, 0.06, 'shark'], [0.78, 0.82, 0.04, 'shark']] }, sci: 'Somniosus microcephalus', fam: 'Somniosidae', note: 'It swims at about the speed of a man walking and may be four hundred years old. Does not fight so much as arrive. The meat is poisonous fresh, so nobody here wants it for supper.' }),
  S('tusk', 'Tusk', 'cod', [2, 5, 44], [0x6a4a30, 0xa8845a, 0xe8d8b8, 0x8a6040], 'faintbars', 0.5, 0, 4, 'b', 'cmw', { o: { H: 0.17, tail: ['round', 0.14], dorsal: [[0.2, 0.97, 0.1, 'long']], anal: [[0.45, 0.97, 0.08, 'long']] }, sci: 'Brosme brosme', fam: 'Lotidae', note: 'One long fin down the back and a rust-brown skin. Lives on deep rough ground, which is why the line comes up tangled and the fish comes up surprised.' }),
  // Gulf of Mexico and the Keys
  S('triggerfish', 'Gray Triggerfish', 'panfish', [1, 3, 13.5], [0x5a5a58, 0x8a8a84, 0xc0c0b8, 0x6a6a68], 'mottled', 0.5, 0, 5, 'b', 'c', { o: { H: 0.6, tail: ['truncate', 0.14], dorsal: [[0.26, 0.32, 0.16, 'spiny'], [0.4, 0.85, 0.14, 'long']], anal: [[0.5, 0.85, 0.14, 'long']] }, sci: 'Balistes capriscus', fam: 'Balistidae', note: 'Locks its dorsal spine upright in a crack so you cannot pull it out, and has teeth that go through hooks. Excellent eating, if you can get past the hide.' }),
  S('redporgy', 'Red Porgy', 'snapper', [1, 2.5, 7.4], [0xa04a4a, 0xd08a88, 0xf0d8d0, 0xc06a6a], 'bluespots', 0.45, 0, 5, 'b', 'cm', { sci: 'Pagrus pagrus', fam: 'Sparidae', note: 'A pink, round, polite fish that bites small cut bait on hard bottom and does not fight. The rig usually comes up with two.' }),
  S('angelfish', 'Blue Angelfish', 'panfish', [0.5, 1.5, 3.5], [0x1a2a4a, 0x28507a, 0x6a8ab0, 0x1a3a6a], 'none', 0.35, 0, 2, 'm', 'c', { sci: 'Holacanthus bermudensis', fam: 'Pomacanthidae', note: 'A reef fish in a coat that looks painted on. Takes a bit of shrimp off a small hook on the rocks. Not worth much to the buyer, and most people put it back for the colour.' }),
  // Cabo and the Great Barrier Reef
  S('bonito', 'Pacific Bonito', 'mackerel', [3, 7, 25], [0x1a3a5a, 0xa8b8c8, 0xf4f4f4, 0x2a4a6a], 'wavy', 0.8, 0.5, 3, 'm', 'mq', { metal: 0.5, o: { H: 0.17 }, sci: 'Sarda chiliensis', fam: 'Scombridae', note: 'Oblique dark stripes down the back and a mouth full of small teeth. Moves in fast schools, strikes anything silver, and is mostly there to tell you the tuna are somewhere near.' }),
  S('maori', 'Humphead Wrasse', 'wrasse', [30, 100, 420], [0x2a6a58, 0x3a9a8a, 0xa8d8c8, 0x2a7a6a], 'wavy', 0.75, 0, 10, 'm', 'cm', { eye: 1.1, o: { H: 0.34, W: 0.2 }, sci: 'Cheilinus undulatus', fam: 'Labridae', note: 'Fat lips, blue-green, and as big as a man. A protected fish on most coasts, so the only sensible thing to do is measure it and let it go. It will stay in the reef after you are gone.' }),
  S('longtail', 'Longtail Tuna', 'tuna', [8, 25, 79], [0x14224a, 0xa8b4c8, 0xf4f4f8, 0x3a4458], 'bellylines', 0.85, 0.1, 6, 'm', 'mq', { o: { H: 0.22 }, sci: 'Thunnus tonggol', fam: 'Scombridae', note: 'The slim tuna of the warm Pacific shelf. Longer tail than a yellowfin, shorter life than you might guess, and a run that stays low and straight.' }),
  // Chesapeake
  S('scup', 'Scup', 'panfish', [0.5, 1.2, 4.5], [0x4a4a50, 0x9098a0, 0xd8dce0, 0x70747c], 'faintbars', 0.4, 0, 3, 'b', 'cw', { o: { H: 0.42, tail: ['truncate', 0.18] }, sci: 'Stenotomus chrysops', fam: 'Sparidae', note: 'Small porgy, grey-silver, with a tiny mouth that picks a hook clean. You learn to strike on the second tap rather than the first.' }),
  S('tautog', 'Tautog', 'wrasse', [1, 4, 25], [0x3a3a40, 0x6a6a68, 0xa8a8a0, 0x4a4a4e], 'mottled', 0.7, 0, 6, 'b', 'c', { o: { H: 0.28, W: 0.17, blunt: 0.4, tail: ['round', 0.18] }, sci: 'Tautoga onitis', fam: 'Labridae', note: 'Lives in the wrecks and the pilings, eats crabs, and dives for the nearest hole when hooked. Heavy tackle is not an insult; it is the only way to pull one out of the steel.' }),
  S('americaneel', 'American Eel', 'eel', [0.5, 2, 9], [0x3a3a28, 0x7a7a48, 0xc8c498, 0x4a4a30], 'none', 0.55, 0, 2, 'b', 'wmb', { o: { H: 0.07, W: 0.07, stalk: 0.9, tail: ['round', 0.05], dorsal: [[0.2, 0.99, 0.03, 'long']], anal: [[0.3, 0.99, 0.03, 'long']] }, sci: 'Anguilla rostrata', fam: 'Anguillidae', note: 'Born in the Sargasso Sea and in the bay for twenty years. Knots itself around the line, the net and your hand. A night fish that wants worms.' }),
  S('weakfish', 'Weakfish', 'snook', [1, 3, 19.2], [0x4a5a58, 0xa8b8a8, 0xf4f0e8, 0xc8b898], 'specks', 0.5, 0, 5, 'm', 'mc', { o: { H: 0.2, tail: ['truncate', 0.2] }, sci: 'Cynoscion regalis', fam: 'Sciaenidae', note: 'Named for a soft mouth that tears under the hook, so the fight is mostly manners. Purple-green in the sun, spotted, good eating if iced quickly.' }),
  // Lakes: Tahoe, Woods, Columbia, Okeechobee
  S('tahoesucker', 'Tahoe Sucker', 'sucker', [1, 2.5, 10], [0x5a5a38, 0xa8a070, 0xf0e8c8, 0xb85a30], 'scales', 0.45, 0, 1, 'b', 'wi', { sci: 'Catostomus tahoensis', fam: 'Catostomidae', note: 'Bottom-feeding, orange-finned, and common as sand in the shallows at dusk. Takes a worm and treats it as a favour.' }),
  S('redhorse', 'Shorthead Redhorse', 'sucker', [0.8, 2, 6.5], [0x5a5a38, 0xa8a070, 0xf0e8c8, 0xd05a30], 'scales', 0.45, 0.05, 1, 'b', 'wi', { sci: 'Moxostoma macrolepidotum', fam: 'Catostomidae', note: 'Red tail, silver scale pattern, small underslung mouth. Hard enough on the first run, to the point where you wonder what it is.' }),
  S('rockbass', 'Rock Bass', 'panfish', [0.2, 0.5, 3], [0x3a3a28, 0x8a8a58, 0xe8e0b8, 0x6a6a40], 'specks', 0.35, 0, 2, 'm', 'icw', { o: { H: 0.38 }, sci: 'Ambloplites rupestris', fam: 'Centrarchidae', note: 'Red-eyed, dark-flecked and always in the rocks under the dock. Not a bass, not a big fish, and a handy one when the others will not bite.' }),
  S('cisco', 'Cisco', 'herring', [0.5, 1.5, 5], [0x3a6a58, 0xc8d8cc, 0xf4f8f0, 0x7a9a8a], 'lateral', 0.35, 0.1, 2, 'm', 'i', { metal: 0.5, eye: 1.4, o: { H: 0.22, W: 0.12 }, sci: 'Coregonus artedi', fam: 'Salmonidae', note: 'A lake herring, a pale silver whitefish. Comes up in schools on cold nights and every muskie in the lake knows it.' }),
  S('warmouth', 'Warmouth', 'panfish', [0.2, 0.5, 2.7], [0x4a4a30, 0x8a8a50, 0xd8c890, 0x6a6a40], 'vermic', 0.4, 0, 2, 'm', 'mic', { o: { H: 0.4, mouth: 0.1 }, sci: 'Lepomis gulosus', fam: 'Centrarchidae', note: 'Mud-coloured, stubby, with a mouth too wide for a sunfish. Sits in the tannin-dark weeds and takes whatever you drop at it.' }),
  S('floridagar', 'Florida Gar', 'gar', [1, 3, 9], [0x4a4a30, 0x8a8a58, 0xe0e0c0, 0x6a6a40], 'darkspots', 0.45, 0.2, 1, 's', 'm', { o: { snout: 0.13, H: 0.1 }, sci: 'Lepisosteus platyrhincus', fam: 'Lepisosteidae', note: 'Lies in the weeds like a floating stick, rolls to gulp air, and takes a rope-fibre lure better than a hook. The bones are in the way of every supper.' }),
  S('ladyfish', 'Ladyfish', 'bonefish', [0.5, 1.5, 6], [0x3a5a6a, 0xd8e4e8, 0xffffff, 0x8a9aa0], 'none', 0.75, 0.95, 1, 's', 'm', { metal: 0.8, o: { H: 0.15, tail: ['fork', 0.3] }, sci: 'Elops saurus', fam: 'Elopidae', note: 'Ten pounds of nothing, but the fight is in the air: it jumps again and again and throws the hook before you are ready. Poor eating, great practice for tarpon.' }),
  S('hogfish', 'Hogfish', 'wrasse', [2, 6, 22], [0x8a4a40, 0xd8a090, 0xf4e4dc, 0xb85a4a], 'tailspot', 0.55, 0, 12, 'b', 'c', { o: { H: 0.3, snout: 0.09, blunt: 0.9 }, sci: 'Lachnolaimus maximus', fam: 'Labridae', note: 'Pig-nosed, pink and the best eating on the flats, so it also costs the most. Takes crab on hard bottom and no one is ever sure where the next one is.' }),
  S('southernray', 'Southern Stingray', 'ray', [20, 60, 200], [0x5a5446, 0x7a705a, 0xe8e4d8, 0x5a5446], 'none', 0.7, 0, 0.5, 'b', 'c', { sci: 'Hypanus americanus', fam: 'Dasyatidae', note: 'A flat grey disc with a barb at the base of a whip tail. Pulls like a sail in a current. Handle it by the wings and keep your feet clear.' }),
  // Amazon
  S('tambaqui', 'Tambaqui', 'piranha', [10, 35, 88], [0x3a3a38, 0x6a6a60, 0xd8a060, 0x3a3a38], 'none', 0.75, 0.05, 5, 'm', 'p', { o: { H: 0.5 }, sci: 'Colossoma macropomum', fam: 'Serrasalmidae', note: 'A vegetarian piranha the size of a hubcap that eats fallen seeds with molars. Wait under a flooded tree and fish a fruit, not a lure.' }),
  S('surubim', 'Surubim', 'catfish', [10, 40, 220], [0x4a4a48, 0xb8b4a0, 0xf0ecd8, 0x5a5a50], 'darkblots', 0.8, 0, 6, 'b', 'mb', { o: { H: 0.14 }, sci: 'Pseudoplatystoma fasciatum', fam: 'Pimelodidae', note: 'Shovel-nosed, spotted, nocturnal, with a long head built for the mud. Takes a live fish at night in the channel and takes line off the spool in long grunts.' }),
  S('oscar', 'Oscar', 'panfish', [0.5, 1.2, 3.5], [0x2a2a22, 0x4a4a38, 0xd88a3a, 0xb8602a], 'tailspot', 0.5, 0, 3, 'm', 'imc', { o: { H: 0.44, W: 0.15, tail: ['round', 0.2] }, sci: 'Astronotus ocellatus', fam: 'Cichlidae', note: 'A cichlid with a false eye on its tail. Born in the Amazon, now loose in the Florida canals as well. Hits small lures hard, then sulks.' }),
  // Mekong
  S('wallago', 'Wallago', 'catfish', [5, 25, 200], [0x4a5058, 0x9aa0a0, 0xe8eae8, 0x5a6068], 'none', 0.75, 0, 3, 'm', 'm', { barbel: 4, o: { H: 0.15, W: 0.11, anal: [[0.25, 0.9, 0.09, 'long']] }, sci: 'Wallago attu', fam: 'Siluridae', note: 'The long catfish with whiskers and a mouth that opens wide. Lurks at dusk by the rocks and hits live bait before the float has settled.' }),
  S('featherback', 'Giant Featherback', 'knife', [2, 10, 66], [0x3a3a34, 0x7a7a68, 0xc8c4b0, 0x4a4a40], 'specks', 0.7, 0.1, 5, 'm', 'm', { sci: 'Chitala lopis', fam: 'Notopteridae', note: 'A knife of a fish: deep at the shoulder, a thread at the tail, rippling its long fin to go backward as well as forward. Eats at night and sulks in the day.' }),
  S('hampala', 'Hampala Barb', 'carp', [1, 5, 20], [0x5a5a38, 0xc0b870, 0xf4ecd0, 0xd04030], 'bars', 0.7, 0.3, 3, 'm', 'm', { barbel: 0, o: { H: 0.2 }, sci: 'Hampala macrolepidota', fam: 'Cyprinidae', note: 'A predatory carp that is hardly ever mistaken for one: one black bar behind the gill, a red tail, and an urge to chase small lures through the rapids.' }),
  S('giantsalmoncarp', 'Giant Salmon Carp', 'pike', [8, 25, 66], [0x3a4a50, 0xc8d0d4, 0xffffff, 0x8a9498], 'none', 0.85, 0.5, 6, 's', 'm', { metal: 0.6, o: { H: 0.17 }, sci: 'Aaptosyax grypus', fam: 'Cyprinidae', note: 'A silver carp that eats other fish and runs like a salmon. Very nearly gone from the river; if you land one, the best you can do is get it back into the current quickly.' }),
  S('silvercarp', 'Silver Carp', 'carp', [4, 12, 60], [0x4a5a60, 0xc8d4d8, 0xf4f8f8, 0x8a9a9a], 'none', 0.55, 0.6, 1, 's', 'p', { barbel: 0, metal: 0.7, o: { H: 0.22 }, sci: 'Hypophthalmichthys molitrix', fam: 'Xenocyprididae', note: 'Leaps from the surface at the sound of a motor. A filter feeder that does not take a bait so much as bump a hook. Fun, if you wear a helmet.' }),
  // Kariba
  S('kapenta', 'Kapenta', 'herring', [0.02, 0.03, 0.07], [0x3a4a50, 0xc8d4d8, 0xffffff, 0x8a989c], 'lateral', 0.1, 0.1, 2, 'm', 'i', { metal: 0.6, eye: 0.8, o: { H: 0.12, tail: ['fork', 0.3] }, sci: 'Limnothrissa miodon', fam: 'Clupeidae', note: "A freshwater sardine brought up from Tanganyika and now the lake's whole fishery. Netted at night under pressure lamps. Nobody catches one on a hook." }),
  S('nkupe', 'Nkupe', 'panfish', [1.5, 5, 12], [0x4a5a58, 0xb8c4c0, 0xf0f0ec, 0xd04a30], 'hlines', 0.65, 0.1, 3, 'm', 'p', { o: { H: 0.3, W: 0.1 }, sci: 'Distichodus mossambicus', fam: 'Distichodontidae', note: 'A silver plant-eater with red fins that takes dough and soft bait where the weed is thick. Not a fish that hits hard; it just refuses to stop.' }),
  S('bottlenose', 'Bottlenose Mormyrid', 'elephant', [0.5, 2, 8], [0x3a3a30, 0x6a6a58, 0xa8a490, 0x4a4a3c], 'none', 0.5, 0, 2, 'b', 'wi', { sci: 'Mormyrus longirostris', fam: 'Mormyridae', note: 'An elephantfish: the trunk is a tool for sifting mud, and it senses prey with a small electric field. Takes worms on the bottom and looks surprised by the surface.' }),
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

// Colour morphs: every species can turn up in each. chance is per catch (normal takes the rest).
export const MORPHS = [
  { id: 'normal', name: 'Normal', chance: 0, value: 1 },
  { id: 'golden', name: 'Golden', chance: 0.012, value: 3 },
  { id: 'albino', name: 'Albino', chance: 0.006, value: 5 },
  { id: 'leucistic', name: 'Leucistic', chance: 0.008, value: 4 },
  { id: 'melanistic', name: 'Melanistic', chance: 0.01, value: 3 },
  { id: 'piebald', name: 'Piebald', chance: 0.008, value: 4 },
  { id: 'calico', name: 'Calico', chance: 0.006, value: 5 },
  { id: 'blue', name: 'Blue Phase', chance: 0.007, value: 4 },
  { id: 'ghost', name: 'Ghost', chance: 0.004, value: 7 },
  { id: 'copper', name: 'Copper', chance: 0.01, value: 2.5 },
  { id: 'tiger', name: 'Tiger', chance: 0.007, value: 4 },
  { id: 'spotted', name: 'Leopard', chance: 0.008, value: 3.5 },
  { id: 'rose', name: 'Rose', chance: 0.006, value: 4.5 },
  { id: 'emerald', name: 'Emerald', chance: 0.005, value: 5 },
  { id: 'chrome', name: 'Chrome', chance: 0.008, value: 3 },
  { id: 'sunset', name: 'Sunset', chance: 0.003, value: 8 },
];
export const MORPH_BY_ID = Object.fromEntries(MORPHS.map((m) => [m.id, m]));
export const CATALOG_SIZE = SPECIES.length * MORPHS.length;

export function rollMorph(rand = Math.random, luck = 1) {
  let r = rand();
  for (let i = 1; i < MORPHS.length; i++) {
    r -= MORPHS[i].chance * luck;
    if (r < 0) return MORPHS[i];
  }
  return MORPHS[0];
}

// Weight: mostly near typical, with a long tail toward the record.
export function rollWeight(sp, rand = Math.random, sizeBias = 1) {
  const [lo, typ, max] = sp.lb;
  const u = rand();
  let w;
  if (u < 0.82) w = lo + (typ - lo) * Math.pow(rand(), 0.7) * 1.4;
  else if (u < 0.985) w = typ + (max * 0.45 - typ) * Math.pow(rand(), 2.2);
  else w = max * (0.45 + 0.5 * Math.pow(rand(), 1.5));
  w *= sizeBias;
  return Math.max(lo * 0.6, Math.min(max * 0.98, w));
}

// Length (inches) from weight using the body condition factor.
export function lengthFor(sp, lb, cond) {
  return Math.cbrt(lb / cond);
}

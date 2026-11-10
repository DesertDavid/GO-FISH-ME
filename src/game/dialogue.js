// All shopkeeper / NPC talk lives here, as data. Edit freely: nothing in this file is logic.
//
// KEEPERS[locId][role]  who stands at the shop. role = 'marina' (dock 0), 'bait' (dock 1), 'buyer' (the rest).
//   name, title, skin (0..4 into the skin table in keepers.js), hair (hex), hat, beard, age ('old' = grey hair),
//   hi = first meeting, back = when you come back, kit = outfit override ('ranger' for park / river wardens).
// LORE[locId]           [role or '*', text]: what people actually say about the place. A keeper only tells
//                       what is addressed to their role or '*', never the same one twice in a visit.
// Templates use {tokens}; keepers.js fills them from the real fishing model (see TIPS below).

const K = (name, title, o = {}) => ({ name, title, ...o });

export const KEEPERS = {
  okeechobee: {
    marina: K('Walt Brennan', 'Harbour master', { skin: 0, hair: 0xb0b0a8, age: 'old', hat: 'cap', hi: "Walt Brennan. Marina's mine, the lake's everybody's. Sign the log if you're staying over.", back: 'Back on the lake. Wind is out of the east today, if that matters.' }),
    bait: K('Dale Pruitt', 'Bait & tackle', { skin: 1, hair: 0x5a4030, hat: 'cap', beard: true, hi: "Morning. Shiners are in the well, worms in the cooler, and the coffee's not worth drinking.", back: 'Look who found the lake again. Same as before?' }),
    buyer: K('Marisol Vega', 'Fish buyer', { skin: 2, hair: 0x161412, hat: 'none', hi: 'I buy by the pound and I weigh in front of you. Everyone does that here, you get used to it.', back: 'Let me see what you brought me.' }),
  },
  woods: {
    marina: K('Anders Kolstad', 'Harbour master', { skin: 4, hair: 0xb0b0a8, age: 'old', hat: 'cap', hi: 'Kolstad. The border runs through the middle of the water, so keep your papers in the boat.', back: 'You again. Good. Weather is turning by afternoon, I would be back before then.' }),
    bait: K('Jean-Luc Roy', 'Bait & tackle', { skin: 0, hair: 0x5a4030, hat: 'beanie', beard: true, hi: 'Minnows, leeches, crawlers. Ask what the walleye want today before you ask what I sell.', back: 'The walleye man returns. What are we chasing?' }),
    buyer: K('Ingrid Haugen', 'Fish buyer', { skin: 4, hair: 0xd6d0be, age: 'old', hat: 'beanie', hi: 'Walleye, pike, perch. I fillet and I pay, nothing fancy.', back: 'Good, I was running low on walleye.' }),
  },
  tahoe: {
    marina: K('Kai Nakamura', 'Harbour master', { skin: 1, hair: 0x161412, hat: 'cap', hi: 'Welcome to Tahoe. Fair warning: the lake is two kinds of cold, and the afternoon wind comes up fast.', back: 'Back out on the blue. Wind check is on the board.' }),
    bait: K('Beth Calloway', 'Bait & tackle', { skin: 0, hair: 0x9a8a6a, hat: 'cap', hi: 'Mackinaw gear is on the left wall. Be honest about how deep you plan to go.', back: 'Hey, you. Kokanee are moving, if you want that.' }),
    buyer: K('Tomás Ibarra', 'Fish buyer', { skin: 2, hair: 0x2a2220, hat: 'beanie', hi: 'Trout and mackinaw, whatever the lake gives. Keep them cold and I will treat you right.', back: 'Ice is ready. Put it on the scale.' }),
  },
  columbia: {
    marina: K('Rhonda Whitaker', 'Harbour master', { skin: 0, hair: 0x9a8a6a, hat: 'cap', hi: 'The river does what it wants. I only keep the dock. Mind the wind when it funnels through the Gorge.', back: 'Back in one piece. Good.' }),
    bait: K('Eli Standing Bear', 'Bait & tackle', { skin: 3, hair: 0x161412, hat: 'cap', hi: 'Sand shrimp, herring, spinners. My family fished this river long before the dams, so ask me anything.', back: 'Steelhead are moving. I tied a few for you.' }),
    buyer: K('Paulo Ferreira', 'Fish buyer', { skin: 2, hair: 0x2a2220, hat: 'beanie', beard: true, hi: 'Walleye and bass I take. Sturgeon never. Those go back, always.', back: 'I always know when the walleye run starts, my phone stops ringing.' }),
  },
  amazon: {
    marina: K('Rafael Tavares', 'Ranger', { kit: 'ranger', skin: 2, hair: 0x161412, hat: 'ranger', hi: 'Fiscalização. I check permits and I help lost tourists. Which one are you today?', back: 'Ah, the angler. You still carry your permit? Good.' }),
    bait: K('Dona Luzia', 'Bait & tackle', { skin: 3, hair: 0x2a2220, hat: 'none', hi: 'Minhoca, tuvira, anything with a hook in it. Ask me where the tucunaré are hiding.', back: 'Voltou! The water is higher, so the fish are in the trees.' }),
    buyer: K('Seu Anselmo', 'Fish buyer', { skin: 3, hair: 0xb0b0a8, age: 'old', hat: 'cap', hi: 'Pirarucu only by quota, and I have the papers. Tambaqui, surubim, whatever is legal.', back: 'Come, come. What did the river give you?' }),
  },
  keys: {
    marina: K('Capt. Ray Delgado', 'Harbour master', { skin: 1, hair: 0xb0b0a8, age: 'old', hat: 'cap', hi: 'Delgado. Twenty-six years at this fuel dock. Channel markers are not suggestions, so keep to the green.', back: 'Back for more flats? Tide table is on the wall.' }),
    bait: K('Mandy Sloane', 'Bait & tackle', { skin: 0, hair: 0xc8a040, hat: 'straw', hi: 'Live shrimp, crabs, pilchards. Guides buy from me before sunrise, so I sell out early.', back: 'I saved you a bucket. Do not tell the guides.' }),
    buyer: K('Hector Ruiz', 'Fish buyer', { skin: 2, hair: 0x2a2220, hat: 'cap', hi: 'Yellowtail, snapper, mahi. Not bonefish and not tarpon, those are for sport only.', back: 'Hey. Tell me what you caught, then I will tell you what it is worth.' }),
  },
  gulf: {
    marina: K('Dwayne Thibodeaux', 'Dock master', { skin: 0, hair: 0x5a4030, hat: 'cap', beard: true, hi: 'Thibodeaux. Crew boats run first, charter boats second. You are third. Do not mind it.', back: 'You come back every time, that tells me something.' }),
    bait: K('Celeste Landry', 'Tackle & supplies', { skin: 2, hair: 0x161412, hat: 'cap', hi: 'Heavy line, circle hooks, ice. Offshore you will want all three.', back: 'The weather report says you are fine. I would still bring extra line.' }),
    buyer: K('Big Leon Guidry', 'Fish buyer', { skin: 3, hair: 0x161412, hat: 'cap', hi: 'Snapper, wahoo, tuna. I buy what you bring and I weigh on the honest scale.', back: 'Ha. The boat that smells like fish. Put it right there.' }),
  },
  reef: {
    marina: K('Jodie Rennick', 'Marina manager', { skin: 0, hair: 0xc8a040, hat: 'cap', hi: 'G\'day. The green zones are marked on your chart. Fish in them and the rangers will find you, and so will I.', back: 'Back again? How was the swell out past the ribbon reef?' }),
    bait: K('Sione Tuilagi', 'Tackle & bait', { skin: 3, hair: 0x161412, hat: 'cap', hi: 'Poppers, jigs, wire leader. The trevally will test every knot you tie.', back: 'Got that jig you looked at. It works.' }),
    buyer: K('Anh Tran', 'Fish buyer', { skin: 1, hair: 0x161412, hat: 'cap', hi: 'Coral trout, spanish mackerel. Undersize goes back, no conversation.', back: 'Good timing, the restaurants just called.' }),
  },
  fjord: {
    marina: K('Bjørn Evensen', 'Havnesjef', { skin: 4, hair: 0xd6d0be, age: 'old', hat: 'beanie', beard: true, hi: 'Evensen. The weather here changes before you can finish a coffee. Watch the sky, not the clock.', back: 'Velkommen tilbake. You still have all your fingers, good.' }),
    bait: K('Solveig Hansen', 'Fiskeutstyr', { skin: 4, hair: 0xb0b0a8, hat: 'beanie', hi: 'Pilk, jigs, bait. I speak English because the cod do not care which language you speak.', back: 'Ah, you again. Pilker is up front, same as last time.' }),
    buyer: K('Magnus Olsen', 'Fiskekjøper', { skin: 4, hair: 0x9a8a6a, hat: 'cap', hi: 'Skrei, torsk, sei. Most of mine goes onto the racks. You are welcome to watch.', back: 'There he is. What did the sea give you?' }),
  },
  bering: {
    marina: K('Nikolai Petrenko', 'Harbour master', { skin: 0, hair: 0x9a8a6a, age: 'old', hat: 'beanie', beard: true, hi: 'Petrenko. Here the sea does the talking. I only keep the log of who goes out and who is back.', back: 'You came back. I put a tick next to your name.' }),
    bait: K('Aleesha Kashevarof', 'Gear & supplies', { skin: 3, hair: 0x161412, hat: 'beanie', hi: 'Heavy jigs, halibut hooks, gloves that survive the cold. And do not skimp on line out here.', back: 'Gloves are in the corner. You will want them.' }),
    buyer: K('Dmitri Harkonen', 'Fish buyer', { skin: 4, hair: 0xb0b0a8, hat: 'beanie', beard: true, hi: 'Cod, halibut, pollock. Keep it cold, keep it clean, and I pay by weight.', back: 'The plant is running tonight, so bring your catch early.' }),
  },
  chesapeake: {
    marina: K('Gene Tilghman', 'Harbour master', { skin: 0, hair: 0xb0b0a8, age: 'old', hat: 'cap', hi: 'Tilghman. My people have worked this bay since before the bridge. Slip fees are on the board.', back: 'Well. If it is not the angler.' }),
    bait: K('Patty Bowen', 'Bait & tackle', { skin: 0, hair: 0x9a8a6a, hat: 'cap', hi: 'Bloodworms, bunker, peelers. If you want rockfish, I can tell you where to start.', back: 'Hey, hon. Peelers are in good shape today.' }),
    buyer: K('Marcus Dorsey', 'Seafood dealer', { skin: 3, hair: 0x161412, hat: 'cap', hi: 'Rockfish and blues, crabs when they run. Size limits are on the wall, and I follow them.', back: 'There you are. Scale is clear.' }),
  },
  mekong: {
    marina: K('Khamphet Sisavath', 'Harbour master', { skin: 2, hair: 0x161412, hat: 'none', hi: 'Sabaidee. I keep the landing at Don Khone. The channel is deep on the left side, shallow on the right.', back: 'Sabaidee again. The river is still high.' }),
    bait: K('Noy Vongsa', 'Bait & tackle', { skin: 2, hair: 0x161412, hat: 'conical', hi: 'Worms, small fish, nets for sale. I speak a little English and a lot of fish.', back: 'You returned! The river fish are still hiding in the rocks.' }),
    buyer: K('Bounmy Phanthavong', 'Fish buyer', { skin: 2, hair: 0x2a2220, age: 'old', hat: 'conical', hi: 'I buy for the market in Pakse. Fresh, clean, quick. The truck leaves when the sun is high.', back: 'Good. The truck is coming soon.' }),
  },
  kariba: {
    marina: K('Tendai Moyo', 'Harbour master', { skin: 3, hair: 0x161412, hat: 'cap', hi: 'Moyo. Welcome to Kariba. Watch the drowned trees, they do not show on every chart, and hippos have no manners.', back: 'Ah, the angler. The lake treated you well?' }),
    bait: K('Grace Banda', 'Bait & tackle', { skin: 3, hair: 0x161412, hat: 'none', hi: 'Chicken liver, kapenta, spoons. Tigerfish take a lot of tackle and I stock plenty.', back: 'Back for another tiger? Stronger wire this time.' }),
    buyer: K('Mr. Chikwanda', 'Fish buyer', { skin: 3, hair: 0xb0b0a8, age: 'old', hat: 'cap', hi: 'Bream and tigerfish for the lodges. I pay in dollars or kwacha, as you like.', back: 'The lodges are waiting. Come, show me.' }),
  },
  cabo: {
    marina: K('Capitán Esteban Rojas', 'Capitán de puerto', { skin: 2, hair: 0xb0b0a8, age: 'old', hat: 'cap', hi: 'Rojas. The marina is busy, so stay in your lane. Cruise ships do not slow down for anyone.', back: 'Bienvenido otra vez, amigo.' }),
    bait: K('Lupita Camacho', 'Carnada y tackle', { skin: 2, hair: 0x161412, hat: 'cap', hi: 'Live sardines, caballito, ballyhoo. For marlin, ask me how I rig it.', back: 'Hola. Sardines are fresh this morning, as always.' }),
    buyer: K('Don Chuy Aguilar', 'Pescadería', { skin: 2, hair: 0xb0b0a8, age: 'old', hat: 'cap', beard: true, hi: 'Dorado, atún, huachinango. The restaurants want it fresh, so get it here fast.', back: 'Ahí está. Let me weigh it.' }),
  },
};

// ---------------------------------------------------------------------------------------------------------
// Generic lines, picked when a keeper has no custom one, and for small replies.
export const GENERIC = {
  first: { marina: ['Welcome. First time here? Ask if you need anything.'], bait: ['Come in, take a look around.'], buyer: ['Show me what you caught.'] },
  back: { marina: ['Good to see you again.'], bait: ['Back already? Good.'], buyer: ['Let me see it.'] },
  regular: ['The usual?', 'You are a regular now, I should start charging you rent.', 'Here comes my best customer.', 'Take your time.'],
  deal: ['Pleasure doing business.', 'There you go.', 'Fair is fair.', 'That works.'],
  bye: ['Tight lines.', 'Fish well.', 'Mind the weather.', 'See you out there.', 'Go get them.', 'Come back and tell me how it went.'],
  nothing: ['I have nothing new for you right now.', 'You already heard everything I know.'],
  // keeper name for the prompt: "[Q] Talk to {name}"
};

// ---------------------------------------------------------------------------------------------------------
// Tips: the numbers come from the real bite model (bait.js). Only wording lives here. Tokens:
//   {sp}   species name              {kind}  lure family, lower case (e.g. plastic worms)
//   {lure} best lure you own or the shop sells   {depth} 'about 4 m down' / 'right on the bottom'
//   {when} 'at dawn', 'at dusk', 'after dark', 'in the middle of the day'     {wx} 'in this rain' etc.
export const TIPS = {
  main: [
    '{sp} are the ones feeding right now. They want {kind}, {depth}.',
    'If I were you I would go after {sp}. {kind}, {depth}. That is what is working.',
    'Right now it is {sp}. Put {kind} {depth} and be patient.',
    'The {sp} are biting. Keep {kind} {depth}.',
  ],
  second: [
    '{sp} are also around, if you want a change. {kind} for those.',
    'Not as good, but {sp} will take {kind} too.',
  ],
  insider: [
    'Between us: tie on the {lure}. I would not say it to everyone.',
    'You are a regular, so I will say it plainly: the {lure} is what you want today.',
  ],
  noLure: 'You do not carry a good one for that. I stock the {lure}.',
  timeBetter: 'They feed harder {when}. {now} is not their best time.',
  timeNow: 'Now is about as good as it gets for them.',
  wxBad: 'This {wx} puts them off a little, so expect a slower day.',
  wxGood: 'The {wx} helps. They feed willingly in it.',
  none: 'Honestly? Slow. Whatever you throw will work only slowly. Try changing depth until something answers.',
};

// ---------------------------------------------------------------------------------------------------------
// Greetings for NPC anglers on docks and banks when you stand near them. [text, tags]
// tags: 'dawn' 'day' 'dusk' 'night' 'rain' 'cold' 'hot' (all must match); none = any time.
export const ANGLER_HI = [
  ['Morning.'], ['Hey there.'], ['Any luck?'], ['Nice day for it.'], ['They are not biting for me.'],
  ['Quiet today.'], ['Try the far end of the dock.'], ['Watch your line, it is windy.'],
  ['Early start. Good.', ['dawn']], ['Up before the sun, same as me.', ['dawn']], ['The dawn bite is real, you know.', ['dawn']],
  ['Hot enough for you?', ['hot', 'day']], ['Too hot for the fish. They sulk in the shade.', ['hot', 'day']],
  ['Cold hands, warm coffee. Good trade.', ['cold']], ['Layer up, it gets worse once the sun goes.', ['cold']],
  ['Nice sunset. Fish like it too.', ['dusk']], ['Last light is the best light.', ['dusk']],
  ['Night fishing, huh. Quiet company.', ['night']], ['Careful on the boards at night.', ['night']],
  ['You are brave. Or foolish. Same thing out here.', ['rain']], ['Rain keeps the crowd away.', ['rain']],
];
export const ANGLER_HI_LOC = {
  okeechobee: ['Watch for gators on the bank, they like the warm concrete.', 'Specks are on the edge of the grass.'],
  woods: ['Walleye like the edge of the weeds. Ask Jean-Luc.', 'Border patrol waves, so wave back.'],
  tahoe: ['I can see my bobber forty feet down. Clearest water there is.', 'Cold? That is the lake telling you to stay.'],
  columbia: ['If the wind hits sixty you are done for the day.', 'Steelhead is a gentleman fish. Takes a little patience.'],
  amazon: ['Cuidado with the current, it pulls harder than it looks.', 'Pegou algo? No? Me neither.'],
  keys: ['Tide is turning, so that is when the bonefish move.', 'Sunscreen. Trust me.'],
  gulf: ['Rig lights are on, so the bait is gathering.', 'Sea is flat. Take advantage.'],
  reef: ['Keep clear of the green zones.', 'Reef sharks are only curious. Mostly.'],
  fjord: ['Cold, but beautiful, no?', 'Cod move in with the cold. We just wait.'],
  bering: ['Hands warm? Mine are not.', 'Fog will lift by noon, maybe.'],
  chesapeake: ['Crabbers have the better evenings.', 'Rockfish like the bridge pilings.'],
  mekong: ['Sabaidee.', 'The river is generous when the water is high.'],
  kariba: ['Do not step too near the reeds. Hippos.', 'Fish eagles tell you where the fish are.'],
  cabo: ['Buenos días, amigo.', 'The marlin are out past the arch, not here.'],
};

// ---------------------------------------------------------------------------------------------------------
// Rumours and lore, per place. Grounded, plain, one or two sentences. [who, text]
export const LORE = {
  okeechobee: [
    ['bait', 'The lake is as wide as a small sea and about nine feet deep on average. Wind kicks it up fast, and shallow water means short, steep waves.'],
    ['bait', 'Specks are crappie, for anybody not from here. They come into the shallow grass edges when the water cools.'],
    ['bait', 'Big bass sit under the mats of hydrilla. If you can flip a worm into the hole, you will find them.'],
    ['marina', 'The dike was built after the 1928 hurricane. Before that the lake simply spilled over everything.'],
    ['marina', 'Gators don\'t bother you if you don\'t feed them. Don\'t feed them, and don\'t clean fish at the ramp.'],
    ['marina', 'Sunrise on the lake is worth the early alarm, even if you catch nothing.'],
    ['buyer', 'Cane fires in the fall. The sky goes brown, the ash falls in the boat, and the fish keep biting anyway.'],
    ['buyer', 'My grandfather sold catfish out of a cooler on the roadside. I got a scale and a licence, a step up.'],
  ],
  woods: [
    ['bait', 'Fourteen thousand islands, and I have not fished them all. Every year I find one I did not know.'],
    ['bait', 'Walleye stay deep in the daytime, then move up onto the rocks at dusk. A jig and a minnow never fails.'],
    ['bait', 'Muskies are the fish of ten thousand casts. They follow your lure to the boat and look at you. Then leave.'],
    ['marina', 'Part of this lake is in Canada and part is in Minnesota. Then there is the Northwest Angle, which is Minnesota but only reachable across the water.'],
    ['marina', 'Ice comes in late November. By January there are towns of fish houses out on the lake, with streets and everything.'],
    ['marina', 'When the wind swings north, go in. Storms here arrive without a warning.'],
    ['buyer', 'Wild rice grows in the shallows. People harvest it from canoes, the old way, and the ducks come for what falls.'],
    ['buyer', 'Eat walleye the same day, with butter and nothing else. Do not argue.'],
  ],
  tahoe: [
    ['bait', 'Mackinaw live down past a hundred feet, and the water is so cold they grow slowly. A big one could be fifty years old.'],
    ['bait', 'Kokanee are landlocked salmon. In the fall they turn red and run into the creeks to spawn, and everyone drives out to look.'],
    ['bait', 'Use light line in this water. It is so clear that the fish can see your leader.'],
    ['marina', 'The lake is over sixteen hundred feet deep. If you dropped the Eiffel Tower in, there would be water to spare.'],
    ['marina', 'There are old boats down in Emerald Bay, wrecks from the lumber days. Divers still find things.'],
    ['marina', 'Winter storms close the passes. Summer ones close the lake. Weather decides here.'],
    ['buyer', 'Rainbow trout I buy, and lake trout if they are legal. Fish from cold water like this has firm flesh, and I can tell it blind.'],
    ['buyer', 'In summer the beaches are packed. Come in the shoulder season, when the lake is yours alone.'],
  ],
  columbia: [
    ['bait', 'White sturgeon live here, some taller than a man. By law they go back, and the law is right, because they are very old.'],
    ['bait', 'In fall the steelhead come up from the sea. Cast across and let the current swing your lure through the run.'],
    ['bait', 'Walleye came with the dams. Fish them in the slow water behind Bonneville, in the evening.'],
    ['marina', 'The wind in the Gorge is a gift for windsurfers and a trouble for fishermen. It comes straight from the high desert.'],
    ['marina', 'Bonneville Dam has fish ladders and viewing windows. You can watch salmon climb, one by one, like pilgrims.'],
    ['marina', 'Before the dams there was Celilo Falls, the oldest trading place on the river. It is under water now.'],
    ['buyer', 'Tribal fishers still dip-net from platforms below the dam. Respect their spots; those are treaty rights.'],
    ['buyer', 'Smoked salmon is better than fresh, if you ask me, and I am a fish buyer. That is the true opinion.'],
  ],
  amazon: [
    ['bait', 'Tucunaré hit hard and fight harder. They wait in the shade of fallen trees, so cast right up to the wood.'],
    ['bait', 'Piranha are not what the films say. They are shy until the water is low and the food is gone, and then they are everywhere.'],
    ['bait', 'Pirarucu breathe air. They come up with a gulp you can hear from the boat, so you know where to look.'],
    ['marina', 'The river rises ten metres or more between seasons. Houses on stilts become houses on boats, then houses on stilts again.'],
    ['marina', 'At the meeting of the waters, two rivers run side by side without mixing. One is black, one is brown. It is true.'],
    ['marina', 'We patrol against illegal nets. It is hard to do, because the river is bigger than any patrol.'],
    ['buyer', 'Tambaqui eat fruit that falls from the trees in the flood. Their teeth can crack a Brazil nut.'],
    ['buyer', 'My mother fed six of us on river fish. I still prefer it to meat.'],
  ],
  keys: [
    ['bait', 'Bonefish are ghosts on the flat. You see the mud, then the tail, and then it is gone if you cast badly.'],
    ['bait', 'Tarpon roll in the channels at dusk. They are old and huge, with scales as big as a coin. They jump like a thrown horse.'],
    ['bait', 'Permit are the hardest fish on the flats. Crabs are the key; I sell them for a reason.'],
    ['marina', 'The Overseas Highway is a road across the sea. When a hurricane comes, it closes first, and that is when we know.'],
    ['marina', 'Irma took half the docks in 2017. We rebuilt them stronger. That is why mine has these pilings.'],
    ['marina', 'Look at the colour of the water. Dark green is grass, light is sand, dark blue is deep. Learn it, and you can read the flats.'],
    ['buyer', 'Conch fritters from the shack down the road. Tell her I sent you, she will not know who I am.'],
    ['buyer', 'Mangrove snapper are crafty. Smaller hook, lighter line, and you will do better.'],
  ],
  gulf: [
    ['bait', 'Every rig is a reef. The legs grow barnacles, the barnacles draw bait, the bait draws everything else.'],
    ['bait', 'Yellowfin tuna come up at dawn around the lights. Chunk some bait, drift it back, and hold on.'],
    ['bait', 'Red snapper regulations change every season. I don\'t like it, but I follow it, and you should too.'],
    ['marina', 'Crew helicopters go overhead all day. When one goes low, you know a storm is coming.'],
    ['marina', 'Hurricane season means we move everything. The rigs evacuate first, then the boats, then the people.'],
    ['marina', 'Sixty miles out you are on your own for a long time. File a plan with me, and let me know if you change it.'],
    ['buyer', 'My father worked a rig for thirty years. He said that on a calm night the lights look like a city on the sea.'],
    ['buyer', 'Wahoo is the best eating fish out there. White, firm, mild. People who know, know.'],
  ],
  reef: [
    ['bait', 'Giant trevally smash poppers like a bus. Check your knots after every fish. Every one.'],
    ['bait', 'Coral trout are the colour of a sunset. They hide in the bommies, and you need to turn them away from the coral fast.'],
    ['bait', 'Black marlin come to Cairns every spring. People call it the grander alley. I just sell the line.'],
    ['marina', 'Green zones are no-take. Fish a metre inside one and you pay a fine, and the reef pays more than you do.'],
    ['marina', 'Wet season brings stingers. Box jellyfish are real, so wear a suit if you swim.'],
    ['marina', 'Cyclones come in summer. The reef takes the blow for the coast, and then we all fix it afterwards.'],
    ['buyer', 'The bleaching years were hard. Some of the fish moved. Some of us did too.'],
    ['buyer', 'Spanish mackerel are best the day they are caught. Sashimi, with a bit of lime.'],
  ],
  fjord: [
    ['bait', 'Skrei come down from the Barents Sea to spawn here every winter. January to April, a long fat cod, and the whole island lives on it.'],
    ['bait', 'We hang the cod on wooden racks, the hjell, to dry in the wind. It becomes tørrfisk, and it keeps for years.'],
    ['bait', 'Jig deep on a slow drift. The cod lie along the bottom where the fjord drops off.'],
    ['marina', 'Moskstraumen is the whirlpool south of here. It is not as dangerous as the legend says, but it is not nothing.'],
    ['marina', 'In summer the sun never sets. Fishermen get tired because the day does not end.'],
    ['marina', 'The rorbuer were fishermen\'s huts, built on poles over the water. Now tourists sleep in them. I let them.'],
    ['buyer', 'Sea eagles follow the boats for scraps. Do not feed them from the deck, they take your hat.'],
    ['buyer', 'The best cod are the cold ones. I buy winter fish, I pay more for winter fish.'],
  ],
  bering: [
    ['bait', 'Halibut can be the size of a barn door. A real one could take your whole line to the bottom.'],
    ['bait', 'Cod come in thick over the flats. If you find the birds, you will find the cod.'],
    ['bait', 'Ice builds on the rails in a hard freeze. Crews chip it off with clubs, because too much of it will roll the boat.'],
    ['marina', 'Unalaska has the biggest fishing port in the country by volume. Every ship that comes in has a story, and most of them are not told.'],
    ['marina', 'The Orthodox church on the hill is two hundred years old. Sailors go up there before a long trip. I do too.'],
    ['marina', 'Fog comes in without a sound. The foghorn is not decoration. If you cannot see the buoy, wait.'],
    ['buyer', 'Eagles sit on every pole in town. They are almost like pigeons, only larger, and they take your lunch.'],
    ['buyer', 'My grandmother fished with a hand line from a skin boat. She said the sea gives, but only once a year.'],
  ],
  chesapeake: [
    ['bait', 'Rockfish is what everybody around here calls striped bass. Stay near the Bay Bridge pilings at dusk and they will come.'],
    ['bait', 'Bloodworms are the best bait for spot and croaker. They bite, so wear gloves if you are new.'],
    ['bait', 'Blue crabs shed their shells in summer. That is a peeler. Those are the ones people pay for, and the fish like them too.'],
    ['marina', 'Skipjacks are the last working sail fleet in America. They dredge oysters in winter, the only way the law allows.'],
    ['marina', 'Smith Island is sinking a little every year. People there still speak in an old accent, almost Cornish.'],
    ['marina', 'Sea nettles show up in July. Do not swim in the bay unless you are sure.'],
    ['buyer', 'The bay was nearly fished out in the eighties. We made rules, hard ones, and now the rockfish are back.'],
    ['buyer', 'Crab cakes should be crab, not bread. Anywhere that serves otherwise, I do not trust.'],
  ],
  mekong: [
    ['bait', 'The Mekong giant catfish is the biggest freshwater fish in the world, and almost gone. If you see one, let it go.'],
    ['bait', 'The Khone Falls block the river. Fish come to the foot of the falls, and the old people built traps there from bamboo.'],
    ['bait', 'In the dry season the water is clear and shallow. In the wet season it is a brown road, fast and fat.'],
    ['marina', 'The French built a railway across these islands a hundred years ago to carry boats around the falls. The bridge remains.'],
    ['marina', 'Irrawaddy dolphins used to be common near Khone. Now there are only a few, and people watch them from boats, quietly.'],
    ['marina', 'Dams upstream change the river. We feel it here before the maps show it.'],
    ['buyer', 'In the evenings, men set the bamboo traps. Early the next day, they bring what they found. That is breakfast.'],
    ['buyer', 'Fermented fish sauce, padaek. If a Lao cook offers it, say yes.'],
  ],
  kariba: [
    ['bait', 'Tigerfish have teeth like a pike and a jump like a bass. They break leaders. I sell wire for a reason.'],
    ['bait', 'Kapenta are small sardines. People fish them at night with lamps on rafts, and from the shore it looks like a floating town.'],
    ['bait', 'Fish the edges of the drowned trees. The branches hold bream, and the bream bring the tigers.'],
    ['marina', 'The dam closed in 1959 and the lake took years to fill. The Tonga people who lived on the valley floor were moved, and many have not forgotten it.'],
    ['marina', 'Nyaminyami is the river god, the serpent. The Tonga say that the floods that broke the dam wall during construction were his work.'],
    ['marina', 'Elephants swim between the islands in the dry season. Stay back and keep your engine quiet.'],
    ['buyer', 'Hippos kill more people in Africa than lions do. Give them room, particularly at dusk.'],
    ['buyer', 'Fish eagles call at dawn. When they call, the day has started, and so have I.'],
  ],
  cabo: [
    ['bait', 'Striped marlin come up in the fall, blue and black in the summer. Ask me before you pick a lure; the wrong colour costs a day.'],
    ['bait', 'Dorado gather under floating weed. Find the weed line and drop a live sardine, and hold on.'],
    ['bait', 'Yellowfin make long runs. A good reel and a patient hand will beat them; a nervous hand will not.'],
    ['marina', 'The arch at Land\'s End is where the Sea of Cortez meets the Pacific. The water on each side is a different colour.'],
    ['marina', 'The big tournament is in October. Boats come from everywhere, and the winning fish earns more than the town makes in a month.'],
    ['marina', 'Pangas go out before dawn. If you want to fish like the locals, be at the beach at five.'],
    ['buyer', 'Tourists want marlin for the photo. We tell them to let it go, and many do now. The photo is the same.'],
    ['buyer', 'Fish tacos are best with fresh dorado, a bit of cabbage and lime. Nothing more.'],
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Which choices each role offers. id -> label. Order matters. 'act' names are handled in keepers.js / ui.js.
export const CHOICES = {
  marina: [['boats', 'Boats for sale'], ['trophy', 'The trophy room'], ['permit', 'Permits & fees'], ['sell', 'Sell my catch'], ['tip', "What's biting?"], ['lore', 'Anything happening around here?'], ['events', 'Tournaments & challenges']],
  bait: [['shop', 'Browse tackle'], ['permit', 'Permits & repairs'], ['tip', "What's biting?"], ['lore', 'Anything happening around here?'], ['events', 'Tournaments & challenges']],
  buyer: [['sell', 'Sell my catch'], ['tip', "What's biting?"], ['lore', 'Anything happening around here?'], ['events', 'Tournaments & challenges']],
};

// Relationship tiers by completed deals at this shop (buys, repairs, permits, fish sales).
export const TIERS = [
  { name: 'New face', deals: 0, discount: 0 },
  { name: 'Familiar', deals: 3, discount: 0.05 },
  { name: 'Regular', deals: 8, discount: 0.1 },
];

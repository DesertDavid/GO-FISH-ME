// ---- regional styles ------------------------------------------------------------------------
export const STYLES = {
  cracker: { wall: 'batten', wcols: [0xd8d0b8, 0xa9b8a0, 0xc9bfa4, 0xb8c4c8], roof: 'gable', rtex: 'tin', rcols: [0x9a9a96, 0x84868a, 0x8a3a30, 0x6e8a6a], trim: 0xf0ece0, pitch: 0.34, over: 0.6, found: 0.9, shutters: 0x3a5a48, porch: { rail: true }, front: 'flat' },
  log: { wall: 'log', wcols: [0x9a7a56, 0x8a6a48, 0xa88a60], roof: 'gable', rtex: 'shingle', rcols: [0x4a3e34, 0x3e4a3a, 0x5a3a2c], trim: 0x6a4a30, pitch: 0.62, over: 0.8, found: 0.8, ftex: 'stone', fcol: 0x9a948a, chimney: { tex: 'stone', col: 0x9a948a }, porch: { rail: true, roof: true }, front: 'none', attic: true },
  chalet: { wall: 'log', wcols: [0x8a6a48, 0x7a5a3c, 0x96744c], roof: 'gable', rtex: 'shingle', rcols: [0x3c3a38, 0x4a3c34, 0x3a4440], trim: 0x4a3626, pitch: 0.7, over: 0.9, found: 1.0, ftex: 'stone', fcol: 0x8e8a82, chimney: { tex: 'stone', col: 0x8e8a82 }, porch: { rail: true, roof: true }, front: 'none', floors: 2 },
  columbia: { wall: 'clap', wcols: [0xc9d0cc, 0xe4dccb, 0x9aa8a4, 0xb8c0b0], roof: 'gable', rtex: 'shingle', rcols: [0x3e3c3a, 0x4a463e, 0x34403a], trim: 0xf2eee2, pitch: 0.5, over: 0.45, found: 1.0, shutters: 0x2c4a44, porch: { rail: true, roof: true }, chimney: { tex: 'brick' }, front: 'step' },
  chesapeake: { wall: 'clap', wcols: [0xe8e2d0, 0xc4d0d4, 0xd8c8a8, 0xe0e4e0], roof: 'gable', rtex: 'shingle', rcols: [0x56524c, 0x464a50, 0x5a4a40], trim: 0xf6f2e8, pitch: 0.58, over: 0.4, found: 1.0, shutters: 0x24384c, porch: { rail: true, roof: true }, chimney: { tex: 'brick' }, front: 'step', attic: true },
  conch: { wall: 'clap', wcols: [0xf0e4c0, 0xa6d4d0, 0xf0b8b0, 0xe8d880, 0xd8b8e0], roof: 'hip', rtex: 'tin', rcols: [0xb8c0c4, 0x8a2a2a, 0x2a6a58, 0xc0c4c0], trim: 0xfaf6ee, pitch: 0.45, over: 0.8, found: 1.4, shutters: 0x2c7a78, porch: { rail: true, roof: true }, front: 'flat' },
  stilt: { wall: 'batten', wcols: [0x8a6a48, 0x7a5c3e, 0x6e5a44, 0x9a8466], roof: 'gable', rtex: 'tin', rcols: [0x8a5a3a, 0x8a8a84, 0x7a4a30, 0x6e7478], trim: 0x5c4630, pitch: 0.42, over: 0.7, found: 0, piles: { depth: 3.2 }, porch: { rail: true }, front: 'none', door: 0x4a3426 },
  palm: { wall: 'batten', wcols: [0x9a8460, 0x8a7452, 0x7e6a4c], roof: 'thatch', rtex: 'thatch', rcols: [0x9a8a56, 0x8a7a4a, 0x7a6e44], trim: 0x5c4630, pitch: 0.7, over: 0.9, found: 0, piles: { depth: 2.6 }, porch: { rail: true }, front: 'none', door: 0x4a3426 },
  kariba: { wall: 'stucco', wcols: [0xe4d8bc, 0xd8c4a0, 0xcdb894], roof: 'thatch', rtex: 'thatch', rcols: [0xa89a62, 0x9a8c58, 0x8a7e52], trim: 0x6a4a30, pitch: 0.75, over: 1.0, found: 0.6, ftex: 'stone', fcol: 0xa09078, porch: { rail: false, roof: true }, front: 'none', door: 0x4a3426 },
  rorbu: { wall: 'clap', wcols: [0x9a2a1e, 0xa83a22, 0xc89a34, 0x8a2a24, 0xd8d4c8, 0x3a5a78], roof: 'gable', rtex: 'shingle', rcols: [0x3c3836, 0x4a3c32, 0x2e3438], trim: 0xf0ece4, pitch: 0.55, over: 0.4, found: 1.0, piles: { depth: 3.0 }, porch: { rail: true }, chimney: { tex: 'brick' }, front: 'none', shutters: 0xe8e4da },
  cabo: { wall: 'stucco', wcols: [0xf0e8d8, 0xe8d4b0, 0xd8a878, 0xe2c8a0, 0xdeb090], roof: 'flat', rtex: 'conc', rcols: [0xd0c8b8], trim: 0xd8a24a, pitch: 0.3, over: 0.4, found: 0.8, ftex: 'stone', fcol: 0xb0a088, porch: { rail: false, roof: false }, front: 'step', shutters: 0x2e6a8a, door: 0x2a5a78, fcolWall: 0xe0d4bc },
  reef: { wall: 'clap', wcols: [0xf2f0e6, 0xcfe4e0, 0xe8dcc0, 0xb8d8d4], roof: 'gable', rtex: 'tin', rcols: [0xb04a3a, 0x3a7a68, 0x8a9498], trim: 0xffffff, pitch: 0.4, over: 0.9, found: 0.5, piles: { depth: 1.4 }, porch: { rail: true, roof: true }, front: 'none', shutters: 0x1f6a78 },
};
export const LOC_STYLE = { okeechobee: 'cracker', woods: 'log', tahoe: 'chalet', columbia: 'columbia', chesapeake: 'chesapeake', keys: 'conch', mekong: 'stilt', amazon: 'palm', kariba: 'kariba', fjord: 'rorbu', cabo: 'cabo', reef: 'reef' };

// signs: [main, sub] per role; local language where the place has one
export const TEXT = {
  default: { marina: ['MARINA', 'Bait · Tackle · Boats · Fuel'], bait: ['BAIT & TACKLE', 'Live bait · Ice · Licences'], buyer: ['FISH MARKET', 'Fresh catch bought daily'], fuel: 'FUEL', open: 'OPEN' },
  okeechobee: { marina: ['FISH CAMP & MARINA', 'Live shiners · Boat rentals · Ice'], bait: ['SHINERS & WORMS', 'Bait · Tackle · Ice'], buyer: ['FISH HOUSE', 'Fresh catfish & bream'], fuel: 'GAS & OIL', open: 'OPEN' },
  fjord: { marina: ['HAVNEKONTOR', 'Fiskeutstyr · Båtsalg · Diesel'], bait: ['FISKEUTSTYR', 'Agn · Fiskekort · Is'], buyer: ['FISKEMOTTAK', 'Ferskfisk kjøpes daglig'], fuel: 'DIESEL', open: 'ÅPEN' },
  cabo: { marina: ['MARINA CABO', 'Pesca · Renta de lanchas · Combustible'], bait: ['CARNADA Y ANZUELOS', 'Pesca deportiva · Hielo'], buyer: ['PESCADERÍA', 'Pescado fresco del día'], fuel: 'GASOLINA', open: 'ABIERTO' },
  amazon: { marina: ['POSTO FLUTUANTE', 'Combustível · Iscas · Barcos'], bait: ['ISCAS & PESCA', 'Anzóis · Linhas · Gelo'], buyer: ['PEIXARIA', 'Peixe fresco do rio'], fuel: 'COMBUSTÍVEL', open: 'ABERTO' },
  mekong: { marina: ['PORT · ທ່າເຮືອ', 'Boats · Fuel · Fishing gear'], bait: ['FISHING GEAR', 'Bait · Nets · Lines'], buyer: ['ຕະຫຼາດປາ · FISH', 'Fresh river fish'], fuel: 'BENZIN', open: 'OPEN' },
  chesapeake: { marina: ['WATERMEN\'S MARINA', 'Bait · Tackle · Boat sales · Fuel'], bait: ['CRAB HOUSE & BAIT', 'Bloodworms · Eel · Ice'], buyer: ['SEAFOOD MARKET', 'Rockfish · Crabs · Oysters'], fuel: 'FUEL DOCK', open: 'OPEN' },
  keys: { marina: ['KEYS MARINA', 'Bait · Tackle · Boats · Fuel'], bait: ['BAIT & TACKLE', 'Live shrimp · Pilchards · Ice'], buyer: ['FISH MARKET', 'Fresh catch · Stone crab'], fuel: 'FUEL', open: 'OPEN' },
  columbia: { marina: ['RIVER MARINA', 'Tackle · Boat sales · Fuel'], bait: ['SALMON & STEELHEAD', 'Eggs · Tackle · Licences'], buyer: ['SMOKED SALMON', 'Fresh & smoked · Sturgeon'], fuel: 'FUEL', open: 'OPEN' },
  woods: { marina: ['RESORT & MARINA', 'Minnows · Leeches · Tackle · Boats'], bait: ['MINNOWS & LEECHES', 'Walleye bait · Licences'], buyer: ['FISH HOUSE', 'Walleye · Perch · Whitefish'], fuel: 'GAS', open: 'OPEN' },
  tahoe: { marina: ['TAHOE MARINA', 'Tackle · Boat sales · Fuel'], bait: ['TACKLE & BAIT', 'Mackinaw gear · Licences'], buyer: ['LAKE FISH CO.', 'Trout bought daily'], fuel: 'FUEL', open: 'OPEN' },
  kariba: { marina: ['KARIBA MARINA', 'Tackle · Boat hire · Diesel'], bait: ['FISH & TACKLE', 'Tigerfish gear · Bait'], buyer: ['KAPENTA MARKET', 'Fresh fish daily'], fuel: 'DIESEL', open: 'OPEN' },
  reef: { marina: ['REEF MARINA', 'Charters · Tackle · Fuel'], bait: ['BAIT & TACKLE', 'Reef gear · Ice'], buyer: ['FISH MARKET', 'Coral trout · Spanish mackerel'], fuel: 'FUEL', open: 'OPEN' },
};
// board paint per role/style: hand-lettered, mildly different shops
export const BOARDS = [
  { bg: '#1f4f6a', fg: '#f4efe0', border: '#e8d9a8', fg2: '#cfe0e0' },
  { bg: '#f1ead6', fg: '#a22a1e', border: '#1d3b52', fg2: '#1d3b52' },
  { bg: '#2c4a38', fg: '#f0e6c4', border: '#d8c070', fg2: '#d8d0b0' },
  { bg: '#e9d6a2', fg: '#2a2a2a', border: '#7a3a1c', fg2: '#4a2a1a' },
  { bg: '#27242a', fg: '#f2c14a', border: '#f2c14a', fg2: '#e0d8c0' },
  { bg: '#f4f0e8', fg: '#16365a', border: '#b02a24', fg2: '#b02a24' },
];
export const FONTS = ['"Impact", "Arial Black", sans-serif', '"Rockwell", "Georgia", serif', '"Franklin Gothic Heavy", "Impact", sans-serif', '"Georgia", serif', '"Trebuchet MS", "Verdana", sans-serif'];

export function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

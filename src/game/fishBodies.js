// Body plans for the procedural fish. All sizes are fractions of total body length (1).
// H/W: max height/width; hp: where the body is deepest; blunt: head curve exponent (low = round);
// stalk: tail-stalk height relative to H; tail: fin type + size; dorsal/anal: [start, end, height, shape].
// cond: weight constant, lb = cond * (length in inches)^3.
export const BODIES = {
  bass: { H: 0.27, hp: 0.38, W: 0.17, blunt: 0.55, stalk: 0.32, tail: ['truncate', 0.22], dorsal: [[0.24, 0.5, 0.13, 'spiny'], [0.5, 0.73, 0.11, 'round']], anal: [[0.62, 0.76, 0.09, 'round']], pect: 0.1, cond: 0.00063, mouth: 0.13 },
  panfish: { H: 0.5, hp: 0.42, W: 0.14, blunt: 0.5, stalk: 0.26, tail: ['truncate', 0.2], dorsal: [[0.22, 0.48, 0.12, 'spiny'], [0.48, 0.76, 0.14, 'round']], anal: [[0.55, 0.78, 0.13, 'round']], pect: 0.1, cond: 0.0011, mouth: 0.05 },
  crappie: { H: 0.42, hp: 0.45, W: 0.13, blunt: 0.6, stalk: 0.3, tail: ['fork', 0.22], dorsal: [[0.45, 0.76, 0.16, 'round']], anal: [[0.42, 0.78, 0.16, 'round']], pect: 0.1, cond: 0.0008, mouth: 0.1 },
  perch: { H: 0.22, hp: 0.36, W: 0.14, blunt: 0.62, stalk: 0.3, tail: ['fork', 0.22], dorsal: [[0.25, 0.48, 0.14, 'spiny'], [0.52, 0.72, 0.1, 'round']], anal: [[0.62, 0.76, 0.08, 'round']], pect: 0.09, cond: 0.0004, mouth: 0.1 },
  pike: { H: 0.15, hp: 0.48, W: 0.11, blunt: 0.95, snout: 0.1, stalk: 0.45, tail: ['fork', 0.2], dorsal: [[0.7, 0.84, 0.1, 'round']], anal: [[0.7, 0.84, 0.08, 'round']], pect: 0.07, cond: 0.00025, mouth: 0.16 },
  barracuda: { H: 0.14, hp: 0.45, W: 0.1, blunt: 1.0, snout: 0.08, stalk: 0.35, tail: ['fork', 0.24], dorsal: [[0.38, 0.47, 0.1, 'tri'], [0.68, 0.77, 0.08, 'tri']], anal: [[0.7, 0.78, 0.07, 'tri']], pect: 0.07, cond: 0.00022, mouth: 0.15 },
  catfish: { H: 0.17, hp: 0.3, W: 0.2, blunt: 0.38, stalk: 0.36, tail: ['fork', 0.2], dorsal: [[0.25, 0.33, 0.14, 'tri']], adipose: 1, anal: [[0.55, 0.82, 0.07, 'long']], pect: 0.11, barbel: 4, cond: 0.00045, mouth: 0.1, flatHead: 1 },
  carp: { H: 0.3, hp: 0.4, W: 0.15, blunt: 0.55, stalk: 0.38, tail: ['fork', 0.25], dorsal: [[0.32, 0.68, 0.1, 'long']], anal: [[0.7, 0.78, 0.1, 'tri']], pect: 0.09, barbel: 2, cond: 0.0007, mouth: 0.04 },
  bowfin: { H: 0.18, hp: 0.3, W: 0.12, blunt: 0.5, stalk: 0.6, tail: ['round', 0.18], dorsal: [[0.35, 0.9, 0.07, 'long']], anal: [[0.75, 0.86, 0.06, 'round']], pect: 0.08, cond: 0.0005, mouth: 0.1 },
  gar: { H: 0.11, hp: 0.5, W: 0.09, blunt: 1.5, snout: 0.18, stalk: 0.5, tail: ['round', 0.15], dorsal: [[0.78, 0.87, 0.08, 'round']], anal: [[0.76, 0.86, 0.07, 'round']], pect: 0.06, cond: 0.00012, mouth: 0.2 },
  trout: { H: 0.23, hp: 0.4, W: 0.13, blunt: 0.62, stalk: 0.38, tail: ['truncate', 0.2], dorsal: [[0.38, 0.55, 0.12, 'tri']], adipose: 1, anal: [[0.66, 0.78, 0.09, 'tri']], pect: 0.09, cond: 0.00045, mouth: 0.11 },
  salmon: { H: 0.24, hp: 0.42, W: 0.13, blunt: 0.68, stalk: 0.3, tail: ['fork', 0.22], dorsal: [[0.38, 0.54, 0.12, 'tri']], adipose: 1, anal: [[0.66, 0.78, 0.09, 'tri']], pect: 0.09, cond: 0.0005, mouth: 0.11 },
  sturgeon: { H: 0.13, hp: 0.3, W: 0.14, blunt: 1.15, snout: 0.1, stalk: 0.3, tail: ['hetero', 0.25], dorsal: [[0.72, 0.82, 0.07, 'tri']], anal: [[0.72, 0.8, 0.06, 'tri']], pect: 0.1, barbel: 4, scutes: 1, cond: 0.00025, mouth: 0.03 },
  arapaima: { H: 0.16, hp: 0.3, W: 0.12, blunt: 0.5, stalk: 0.55, tail: ['round', 0.16], dorsal: [[0.68, 0.88, 0.08, 'long']], anal: [[0.68, 0.88, 0.08, 'long']], pect: 0.07, cond: 0.00028, mouth: 0.08 },
  piranha: { H: 0.55, hp: 0.38, W: 0.16, blunt: 0.4, stalk: 0.25, tail: ['fork', 0.2], dorsal: [[0.45, 0.6, 0.14, 'tri']], adipose: 1, anal: [[0.6, 0.85, 0.1, 'long']], pect: 0.09, cond: 0.0014, mouth: 0.08 },
  arowana: { H: 0.2, hp: 0.55, W: 0.08, blunt: 0.95, stalk: 0.6, tail: ['round', 0.16], dorsal: [[0.68, 0.92, 0.1, 'long']], anal: [[0.55, 0.92, 0.1, 'long']], pect: 0.08, cond: 0.00025, mouth: 0.1 },
  drum: { H: 0.26, hp: 0.38, W: 0.14, blunt: 0.55, stalk: 0.33, tail: ['truncate', 0.2], dorsal: [[0.22, 0.4, 0.13, 'spiny'], [0.42, 0.75, 0.08, 'long']], anal: [[0.66, 0.76, 0.08, 'round']], pect: 0.09, cond: 0.0005, mouth: 0.07 },
  snook: { H: 0.22, hp: 0.38, W: 0.13, blunt: 0.85, stalk: 0.3, tail: ['fork', 0.23], dorsal: [[0.28, 0.45, 0.14, 'spiny'], [0.5, 0.68, 0.1, 'round']], anal: [[0.62, 0.74, 0.09, 'round']], pect: 0.08, cond: 0.0004, mouth: 0.12 },
  tarpon: { H: 0.26, hp: 0.4, W: 0.12, blunt: 0.55, stalk: 0.3, tail: ['fork', 0.3], dorsal: [[0.48, 0.6, 0.16, 'filament']], anal: [[0.66, 0.82, 0.1, 'sickle']], pect: 0.1, cond: 0.00045, mouth: 0.12, upturned: 1 },
  bonefish: { H: 0.2, hp: 0.4, W: 0.12, blunt: 0.95, snout: 0.05, stalk: 0.3, tail: ['fork', 0.28], dorsal: [[0.38, 0.52, 0.14, 'tri']], anal: [[0.72, 0.8, 0.06, 'tri']], pect: 0.09, cond: 0.0005, mouth: 0.04 },
  jack: { H: 0.4, hp: 0.3, W: 0.12, blunt: 0.35, stalk: 0.14, tail: ['lunate', 0.32], dorsal: [[0.3, 0.42, 0.08, 'spiny'], [0.45, 0.8, 0.12, 'sickle']], anal: [[0.5, 0.8, 0.11, 'sickle']], pect: 0.15, cond: 0.0008, mouth: 0.08, scutes: 1 },
  snapper: { H: 0.34, hp: 0.4, W: 0.14, blunt: 0.72, stalk: 0.3, tail: ['fork', 0.22], dorsal: [[0.28, 0.72, 0.12, 'spiny']], anal: [[0.62, 0.76, 0.09, 'round']], pect: 0.12, cond: 0.0007, mouth: 0.08 },
  grouper: { H: 0.3, hp: 0.4, W: 0.17, blunt: 0.6, stalk: 0.38, tail: ['round', 0.2], dorsal: [[0.25, 0.75, 0.1, 'spiny']], anal: [[0.62, 0.78, 0.09, 'round']], pect: 0.11, cond: 0.0009, mouth: 0.14 },
  flat: { H: 0.45, hp: 0.45, W: 0.06, blunt: 0.7, stalk: 0.25, tail: ['round', 0.18], dorsal: [[0.08, 0.86, 0.07, 'long']], anal: [[0.22, 0.86, 0.07, 'long']], pect: 0.06, cond: 0.0009, mouth: 0.1, flatfish: 1 },
  shark: { H: 0.17, hp: 0.38, W: 0.14, blunt: 0.9, snout: 0.04, stalk: 0.2, tail: ['hetero', 0.35], dorsal: [[0.33, 0.45, 0.16, 'shark'], [0.73, 0.78, 0.05, 'shark']], anal: [[0.73, 0.78, 0.04, 'shark']], pect: 0.22, gills: 1, cond: 0.00035, mouth: 0.12, underMouth: 1 },
  tuna: { H: 0.27, hp: 0.4, W: 0.2, blunt: 0.55, stalk: 0.06, tail: ['lunate', 0.38], dorsal: [[0.28, 0.4, 0.12, 'spiny'], [0.42, 0.52, 0.14, 'sickle']], anal: [[0.5, 0.58, 0.12, 'sickle']], pect: 0.14, finlets: 1, cond: 0.0011, mouth: 0.08 },
  mackerel: { H: 0.13, hp: 0.4, W: 0.09, blunt: 1.0, stalk: 0.12, tail: ['lunate', 0.25], dorsal: [[0.25, 0.45, 0.06, 'spiny'], [0.55, 0.62, 0.06, 'tri']], anal: [[0.58, 0.64, 0.05, 'tri']], pect: 0.07, finlets: 1, cond: 0.0003, mouth: 0.1 },
  mahi: { H: 0.27, hp: 0.12, W: 0.1, blunt: 0.25, stalk: 0.14, tail: ['fork', 0.33], dorsal: [[0.03, 0.88, 0.1, 'long']], anal: [[0.45, 0.88, 0.08, 'long']], pect: 0.1, cond: 0.0004, mouth: 0.06 },
  billfish: { H: 0.2, hp: 0.35, W: 0.12, blunt: 0.85, stalk: 0.08, tail: ['lunate', 0.4], bill: 0.25, dorsal: [[0.18, 0.7, 0.15, 'marlin']], anal: [[0.55, 0.64, 0.08, 'sickle']], pect: 0.18, cond: 0.0002, mouth: 0.05 },
  swordfish: { H: 0.2, hp: 0.35, W: 0.15, blunt: 0.85, stalk: 0.08, tail: ['lunate', 0.42], bill: 0.32, flatBill: 1, dorsal: [[0.22, 0.3, 0.18, 'sickle']], anal: [[0.55, 0.62, 0.08, 'sickle']], pect: 0.18, cond: 0.00035, mouth: 0.05 },
  cod: { H: 0.22, hp: 0.35, W: 0.14, blunt: 0.6, stalk: 0.28, tail: ['truncate', 0.2], dorsal: [[0.25, 0.4, 0.11, 'round'], [0.43, 0.6, 0.1, 'round'], [0.62, 0.78, 0.08, 'round']], anal: [[0.45, 0.62, 0.08, 'round'], [0.65, 0.78, 0.07, 'round']], pect: 0.09, cond: 0.0005, mouth: 0.1 },
  eel: { H: 0.12, hp: 0.3, W: 0.09, blunt: 0.6, stalk: 0.45, tail: ['round', 0.12], dorsal: [[0.3, 0.97, 0.05, 'long']], anal: [[0.5, 0.97, 0.04, 'long']], pect: 0.06, cond: 0.0002, mouth: 0.09 },
  herring: { H: 0.2, hp: 0.4, W: 0.1, blunt: 0.72, stalk: 0.3, tail: ['fork', 0.26], dorsal: [[0.42, 0.55, 0.12, 'tri']], anal: [[0.75, 0.85, 0.05, 'tri']], pect: 0.07, cond: 0.0006, mouth: 0.06 },
  parrot: { H: 0.38, hp: 0.38, W: 0.15, blunt: 0.35, stalk: 0.35, tail: ['truncate', 0.22], dorsal: [[0.25, 0.75, 0.08, 'long']], anal: [[0.6, 0.78, 0.07, 'round']], pect: 0.11, cond: 0.0009, mouth: 0.04 },
  cobia: { H: 0.17, hp: 0.3, W: 0.16, blunt: 0.9, snout: 0.03, stalk: 0.3, tail: ['fork', 0.28], dorsal: [[0.25, 0.3, 0.04, 'spiny'], [0.4, 0.7, 0.1, 'sickle']], anal: [[0.55, 0.75, 0.08, 'sickle']], pect: 0.12, cond: 0.0004, mouth: 0.1, flatHead: 1 },
};

// Fin outline in (u along base 0..1, v height 0..1) for each shape.
export const FIN_SHAPES = {
  tri: [[0, 0], [0.3, 1], [0.55, 0.85], [1, 0.15], [1, 0]],
  round: [[0, 0], [0.08, 0.7], [0.35, 1], [0.7, 0.95], [0.98, 0.5], [1, 0]],
  long: [[0, 0], [0.03, 0.85], [0.3, 1], [0.7, 0.95], [0.97, 0.8], [1, 0]],
  sickle: [[0, 0], [0.18, 0.7], [1.25, 1.1], [0.75, 0.35], [1, 0]],
  shark: [[0, 0], [0.45, 0.72], [0.95, 1], [0.82, 0.35], [1, 0]],
  marlin: [[0, 0], [0.03, 1], [0.12, 0.9], [0.22, 0.3], [0.98, 0.22], [1, 0]],
  sail: [[0, 0], [0.04, 0.55], [0.25, 1], [0.6, 0.95], [0.88, 0.45], [1, 0]],
  filament: [[0, 0], [0.2, 0.8], [1.7, 0.55], [0.9, 0.3], [1, 0]],
  spiny: (() => {
    const pts = [[0, 0]];
    for (let i = 0; i <= 10; i++) pts.push([i / 10, (i % 2 ? 0.72 : 1) * (1 - 0.35 * (i / 10))]);
    pts.push([1, 0]);
    return pts;
  })(),
};

// Tail outlines: upper half (x back from stalk, y up), mirrored below unless asymmetric.
export const TAIL_SHAPES = {
  fork: [[0, 1], [0.95, 3.2], [0.75, 2.6], [0.45, 0.25]],
  lunate: [[0, 1], [0.5, 2.6], [0.62, 2.75], [0.42, 1.5], [0.22, 0.3]],
  truncate: [[0, 1], [0.85, 2.4], [0.9, 1.4], [0.85, 0.15]],
  round: [[0, 1], [0.6, 2.0], [0.95, 1.2], [1.0, 0.0]],
};

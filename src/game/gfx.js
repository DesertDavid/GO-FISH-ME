// Live graphics / accessibility knobs read by the world systems each frame. Game.applySettings
// writes them; nothing else should. (Values that only matter at load time live in
// src/engine/gfxBoot.js instead.)
export const GFX = {
  drawDistance: 1,    // x the distance buildings, birds and shore life stay drawn
  vegetation: 1,      // share of trees / reeds drawn
  buildings: 1,       // share of background villages and towns drawn
  wildlife: 1,        // share of birds drawn and simulated
  fishCount: 1,       // share of the swimming fish
  weatherFx: 1,       // share of rain streaks
  reduceMotion: false,
  reduceFlash: false,
};

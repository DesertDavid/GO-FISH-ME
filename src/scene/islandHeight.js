import { LOC } from '../game/current.js';

// Terrain footprint (metres) and heightfield of the current fishing location. The terrain
// mesh, shore map, rocks, floaters and gameplay all read the ground through here.
export const ISLAND_SIZE = LOC.size;

export function islandHeight(x, z) {
  return LOC.height(x, z);
}

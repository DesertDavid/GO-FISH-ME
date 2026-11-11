import { LOCATIONS } from './locations.js';
import { loadSave } from './save.js';

// The location this page load renders. Travelling reloads the page, so the whole engine
// (terrain, shore bake, waves) is rebuilt cleanly for the new place.
const params = new URLSearchParams(location.search);
const id = params.get('loc') || loadSave().location;
export const LOC = LOCATIONS[id] || LOCATIONS.bigbear;

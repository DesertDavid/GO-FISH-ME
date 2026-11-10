// Graphics options that can only change while the world is built (ocean FFT size, ocean mesh
// density). Read straight from the saved settings before anything else loads; the Settings
// screen tells the player a reload is needed when they differ from what is running.
const pick = (v, list, def) => (list.includes(v) ? v : def);
export const BOOT = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('reelworld-settings-v1') || '{}') || {}; } catch { /* blocked */ }
  return { fft: pick(s.fft, [128, 256, 512], 256), meshDetail: pick(s.meshDetail, [256, 320, 384, 512], 384) };
})();

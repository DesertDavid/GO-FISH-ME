// Player settings (kept apart from game progress so resetting progress keeps them).
const KEY = 'reelworld-settings-v1';

export const DEFAULT_SETTINGS = Object.freeze({
  volume: 0.7,
  resolution: 1,
  reflections: true,
  lookSpeed: 1,
  invertY: false,
  mouseLock: true,
});

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

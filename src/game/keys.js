// Every rebindable action, its default key and the rules for assigning keys. Keys are stored
// as the lower-cased KeyboardEvent.key ('w', 'arrowleft', 'space', ']'). Esc and Tab (menus),
// 1-9 (quick lure swap), function keys and bare modifiers other than Shift are reserved.
// [id, label, group, default]
export const ACTIONS = [
  ['forward', 'Throttle up / walk forward', 'Move', 'w'],
  ['back', 'Throttle down, reverse / walk back', 'Move', 's'],
  ['left', 'Steer left / rod against the fish / step left', 'Move', 'a'],
  ['right', 'Steer right / rod against the fish / step right', 'Move', 'd'],
  ['sprint', 'Hurry on foot', 'Move', 'shift'],
  ['stepOff', 'Step off onto the dock or bank / back aboard', 'Move', 'g'],
  ['lookLeft', 'Look left (keys)', 'Look', 'arrowleft'],
  ['lookRight', 'Look right (keys)', 'Look', 'arrowright'],
  ['lookUp', 'Look up (keys)', 'Look', 'arrowup'],
  ['lookDown', 'Look down (keys)', 'Look', 'arrowdown'],
  ['view', 'First / third person', 'Look', 'v'],
  ['underwater', 'Underwater camera (lure / fish)', 'Look', 'u'],
  ['photo', 'Photo mode', 'Look', 'p'],
  ['holster', 'Put the rod away / take it out', 'Fishing', 'x'],
  ['dragUp', 'Drag setting up', 'Fishing', ']'],
  ['dragDown', 'Drag setting down', 'Fishing', '['],
  ['net', 'Deploy / haul the net (net boats)', 'Fishing', 'n'],
  ['troll', 'Trolling spread (salt water)', 'Fishing', 'r'],
  ['anchor', 'Drop / raise the anchor', 'Fishing', 'i'],
  ['talk', 'Talk to the shopkeeper / locals', 'Fishing', 'q'],
  ['sonar', 'Show / hide the fish finder', 'Navigation', 'f'],
  ['waypoint', 'Drop a waypoint (Shift + key clears them all)', 'Navigation', 'z'],
  ['chart', 'Chart', 'Navigation', 'c'],
  ['map', 'Travel', 'Navigation', 'm'],
  ['skip', 'Skip ahead one hour', 'Navigation', 'k'],
  ['tackle', 'Tackle box', 'Menus', 't'],
  ['shop', 'Tackle shop (at a dock)', 'Menus', 'b'],
  ['marina', 'Marina (at a dock)', 'Menus', 'y'],
  ['livewell', 'Livewell and market', 'Menus', 'l'],
  ['journal', 'Journal', 'Menus', 'j'],
  ['events', 'Tournaments', 'Menus', 'e'],
  ['trophy', 'Trophy room (at the marina)', 'Menus', ';'],
  ['help', 'Controls help', 'Menus', 'h'],
  ['settings', 'Settings', 'Menus', 'o'],
];
export const ACTION_IDS = ACTIONS.map((a) => a[0]);
export const ACTION = Object.fromEntries(ACTIONS.map(([id, label, group, def]) => [id, { id, label, group, def }]));
export const DEFAULT_BINDS = Object.fromEntries(ACTIONS.map((a) => [a[0], a[3]]));
export const GROUPS = ['Move', 'Look', 'Fishing', 'Navigation', 'Menus'];

// the name of a pressed key, matching what is stored
export const keyName = (ev) => (ev.key === ' ' ? 'space' : String(ev.key).toLowerCase());

const NAMES = { arrowleft: '\u2190', arrowright: '\u2192', arrowup: '\u2191', arrowdown: '\u2193', space: 'Space', shift: 'Shift', enter: 'Enter', backspace: 'Backspace', capslock: 'Caps', pageup: 'Page Up', pagedown: 'Page Down', home: 'Home', end: 'End', insert: 'Insert', delete: 'Delete', escape: 'Esc', tab: 'Tab' };
export const keyLabel = (k) => (!k ? '-' : NAMES[k] || (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1)));

// null = fine to bind, else why not
export function reservedReason(k) {
  if (!k || k === 'unidentified' || k === 'dead' || k === 'process') return 'That key can\'t be used.';
  if (k === 'escape' || k === 'tab') return 'Esc and Tab always open and close the menus.';
  if (/^[1-9]$/.test(k)) return '1-9 swap lures and stay fixed.';
  if (/^f\d{1,2}$/.test(k)) return 'Function keys are kept for the browser.';
  if (k === 'control' || k === 'alt' || k === 'meta' || k === 'os' || k === 'contextmenu') return 'Ctrl, Alt and Meta are kept for browser shortcuts.';
  return null;
}

// overrides ({action: key}) on top of the defaults -> { map: action -> key, rev: key -> action }
export function resolveBinds(overrides = {}) {
  const map = { ...DEFAULT_BINDS };
  for (const id of ACTION_IDS) if (typeof overrides[id] === 'string' && !reservedReason(overrides[id])) map[id] = overrides[id];
  const rev = {};
  for (const id of ACTION_IDS) if (!(map[id] in rev)) rev[map[id]] = id;
  return { map, rev };
}

// saved overrides that are valid and leave every action on its own key (anything else is dropped)
export function cleanBinds(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const id of ACTION_IDS) if (typeof raw[id] === 'string' && !reservedReason(raw[id]) && raw[id] !== DEFAULT_BINDS[id]) out[id] = raw[id];
  const keys = ACTION_IDS.map((id) => out[id] || DEFAULT_BINDS[id]);
  return new Set(keys).size === keys.length ? out : {};
}

// bind `key` to `id`; returns { overrides, swapped } or { conflict: otherId } when `swap` is false
export function assign(overrides, id, key, swap) {
  const { map, rev } = resolveBinds(overrides);
  const other = rev[key];
  if (other && other !== id) {
    if (!swap) return { conflict: other };
    const next = { ...map, [id]: key, [other]: map[id] };
    return { overrides: diff(next), swapped: other };
  }
  return { overrides: diff({ ...map, [id]: key }) };
}
const diff = (map) => Object.fromEntries(ACTION_IDS.filter((id) => map[id] !== DEFAULT_BINDS[id]).map((id) => [id, map[id]]));

// Messages are written with the default key letters ("(B)", "press G", "Chart: C"). When the
// player has rebound an action, swap its default letter for the live key in those spots.
export function rewriteKeys(msg, map) {
  const changed = {};
  for (const id of ACTION_IDS) {
    const d = DEFAULT_BINDS[id];
    if (d.length === 1 && /[a-z]/.test(d) && map[id] !== d) changed[d.toUpperCase()] = keyLabel(map[id]);
  }
  if (!Object.keys(changed).length) return msg;
  const sw = (m, pre, L) => (changed[L] ? pre + changed[L] : m);
  return msg.replace(/(\(|[Pp]ress |: |Shift \+ )([A-Z])(?=\)|[\s.,;]|$)/g, sw).replace(/(, )([A-Z])(?=\))/g, sw);
}

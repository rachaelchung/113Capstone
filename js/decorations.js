/**
 * decorations.js
 * Loads habitat decoration catalog + slot layout from data/decoration.json.
 */

/** @type {{ id: string, label: string, price: number, emoji?: string }[]} */
let DECORATION_ITEMS = [];

/** @type {Map<string, { id: string, label: string, price: number, emoji?: string }>} */
const _byId = new Map();

/** @type {{ left: number, bottom: number }[]} */
let DECORATION_SLOTS = [];

const _DEFAULT_ITEMS = [
  { id: 'moss_rock', label: 'moss rock', price: 8, emoji: '🪨' },
  { id: 'toadstool', label: 'toadstool seat', price: 12, emoji: '🍄' },
  { id: 'lantern', label: 'paper lantern', price: 15, emoji: '🏮' },
];

const _DEFAULT_SLOTS = [
  { left: 12, bottom: 8 },
  { left: 28, bottom: 14 },
  { left: 44, bottom: 6 },
  { left: 62, bottom: 18 },
  { left: 78, bottom: 10 },
  { left: 88, bottom: 22 },
];

/**
 * @param {string} [url='data/decoration.json']
 * @returns {Promise<void>}
 */
async function loadDecorationCatalog(url = 'data/decoration.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const slots = Array.isArray(data.slots) ? data.slots : [];

    DECORATION_ITEMS = items
      .filter((row) => row && typeof row.id === 'string' && row.id.length)
      .map((row) => ({
        id: row.id,
        label: typeof row.label === 'string' ? row.label : row.id,
        price: typeof row.price === 'number' && row.price >= 0 ? row.price : 0,
        emoji: typeof row.emoji === 'string' ? row.emoji : '📦',
      }));

    DECORATION_SLOTS = slots
      .filter((s) => s && typeof s.left === 'number' && typeof s.bottom === 'number')
      .map((s) => ({ left: s.left, bottom: s.bottom }));

    if (!DECORATION_ITEMS.length) throw new Error('empty items');
    if (!DECORATION_SLOTS.length) throw new Error('empty slots');
  } catch (err) {
    console.warn('[decorations] using fallback catalog:', err && err.message ? err.message : err);
    DECORATION_ITEMS = _DEFAULT_ITEMS.slice();
    DECORATION_SLOTS = _DEFAULT_SLOTS.slice();
  }

  _byId.clear();
  for (const it of DECORATION_ITEMS) _byId.set(it.id, it);
}

function getDecorationItem(id) {
  return _byId.get(id) || null;
}

function getSlotLayout() {
  return DECORATION_SLOTS.length ? DECORATION_SLOTS : _DEFAULT_SLOTS;
}

function getSlotCount() {
  return getSlotLayout().length;
}

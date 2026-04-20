/**
 * backgrounds.js
 * Loads purchasable habitat backgrounds from data/backgrounds.json.
 */

/** @type {{ id: string, label: string, price: number, hint?: string }[]} */
let HOME_BG_SHOP = [];

/** @type {{ id: string, label: string, price: number, hint?: string }[]} */
let FOCUS_BG_SHOP = [];

const _FALLBACK_HOME = [
  { id: 'heath_mauve', label: 'heath mauve', price: 28 },
  { id: 'tide_pool', label: 'tide pool', price: 28 },
  { id: 'apricot_mist', label: 'apricot mist', price: 24 },
  { id: 'wintery_pine', label: 'wintery pine', price: 32 },
  { id: 'blossom_orchard', label: 'blossom orchard', price: 30 },
];

const _FALLBACK_FOCUS = [
  { id: 'neon_arcade', label: 'neon arcade', price: 26 },
  { id: 'sunset_run', label: 'sunset run', price: 24 },
  { id: 'moonlit_track', label: 'moonlit track', price: 30 },
  { id: 'lavender_speedway', label: 'lavender speedway', price: 26 },
  { id: 'overcast_park', label: 'overcast park', price: 22 },
];

/**
 * @param {string} [url='data/backgrounds.json']
 * @returns {Promise<void>}
 */
async function loadBackgroundsCatalog(url = 'data/backgrounds.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const norm = (rows) =>
      (Array.isArray(rows) ? rows : [])
        .filter((r) => r && typeof r.id === 'string' && r.id.length)
        .map((r) => ({
          id: r.id,
          label: typeof r.label === 'string' ? r.label : r.id,
          price: typeof r.price === 'number' && r.price >= 0 ? r.price : 20,
          hint: typeof r.hint === 'string' ? r.hint : '',
        }));

    HOME_BG_SHOP = norm(data.home);
    FOCUS_BG_SHOP = norm(data.focus);
    if (HOME_BG_SHOP.length < 1 || FOCUS_BG_SHOP.length < 1) throw new Error('empty shop');
  } catch (err) {
    console.warn('[backgrounds] using fallback shop:', err && err.message ? err.message : err);
    HOME_BG_SHOP = _FALLBACK_HOME.map((r) => ({ ...r, hint: '' }));
    FOCUS_BG_SHOP = _FALLBACK_FOCUS.map((r) => ({ ...r, hint: '' }));
  }
}

function getHomeBackgroundShopItem(id) {
  return HOME_BG_SHOP.find((r) => r.id === id) || null;
}

function getFocusBackgroundShopItem(id) {
  return FOCUS_BG_SHOP.find((r) => r.id === id) || null;
}

function getHomeBackgroundShopIds() {
  return new Set(HOME_BG_SHOP.map((r) => r.id));
}

function getFocusBackgroundShopIds() {
  return new Set(FOCUS_BG_SHOP.map((r) => r.id));
}

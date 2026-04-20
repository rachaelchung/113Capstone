/**
 * creatures.js
 * Loads creature definitions from data/creatures.json (spawn table + catalog).
 * Fallback: original five creatures if fetch fails (e.g. file://).
 * Visuals: buildCreatureSVG() uses color, eyeWhite, pupil, shape only.
 */

let CREATURE_TYPES = [];

/** @type {{ rareTop: number, uncommonTop: number }} */
let _spawnThresholds = { rareTop: 0.1, uncommonTop: 0.4 };

const _FALLBACK_CREATURES = [
  { id: 'blobby', label: 'blobby', color: '#ff7043', eyeWhite: '#ffffff', pupil: '#333333', shape: 'round', rarity: 'common', spawnWeight: 1 },
  { id: 'squish', label: 'squish', color: '#ab47bc', eyeWhite: '#ffffff', pupil: '#1a237e', shape: 'wide', rarity: 'common', spawnWeight: 1 },
  { id: 'bouncy', label: 'bouncy', color: '#26a69a', eyeWhite: '#ffffff', pupil: '#004d40', shape: 'tall', rarity: 'common', spawnWeight: 1 },
  { id: 'sparky', label: 'sparky', color: '#ffd600', eyeWhite: '#ffffff', pupil: '#333333', shape: 'round', rarity: 'uncommon', spawnWeight: 1 },
  { id: 'raro', label: 'raro', color: '#ec407a', eyeWhite: '#ffffff', pupil: '#880e4f', shape: 'wide', rarity: 'rare', spawnWeight: 1 },
];

/**
 * Load catalog from JSON. Safe to call multiple times; last successful load wins.
 * @param {string} [url='data/creatures.json']
 * @returns {Promise<void>}
 */
async function loadCreatureCatalog(url = 'data/creatures.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data.creatures) ? data.creatures : [];
    if (!list.length) throw new Error('empty creatures');

    CREATURE_TYPES = list.map(_normalizeCreatureRow);

    const st = data.spawnTable || {};
    const rareTop = typeof st.rareTop === 'number' ? st.rareTop : 0.1;
    const uncommonTop = typeof st.uncommonTop === 'number' ? st.uncommonTop : 0.4;
    _spawnThresholds = {
      rareTop: Math.min(1, Math.max(0, rareTop)),
      uncommonTop: Math.min(1, Math.max(0, uncommonTop)),
    };
    if (_spawnThresholds.uncommonTop < _spawnThresholds.rareTop) {
      _spawnThresholds.uncommonTop = _spawnThresholds.rareTop;
    }
  } catch (err) {
    console.warn('[creatures] using fallback catalog:', err && err.message ? err.message : err);
    CREATURE_TYPES = _FALLBACK_CREATURES.map(_normalizeCreatureRow);
    _spawnThresholds = { rareTop: 0.1, uncommonTop: 0.4 };
  }
}

function _normalizeCreatureRow(row) {
  const w = row.spawnWeight;
  const spawnWeight = typeof w === 'number' && w > 0 && Number.isFinite(w) ? w : 1;
  return { ...row, spawnWeight };
}

/**
 * Build SVG markup for a creature.
 * @param {object} type  - one of CREATURE_TYPES
 * @param {number} size  - approximate pixel size (width OR height, depends on shape)
 * @returns {string}     - raw SVG string
 */
function buildCreatureSVG(type, size = 40) {
  if (!type) {
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }
  const { color: c, eyeWhite: e, pupil: p, shape } = type;

  if (shape === 'wide') {
    const w = size;
    const h = Math.round(size * 0.75);
    return `
      <svg width="${w}" height="${h}" viewBox="0 0 40 30" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="18" rx="18" ry="11" fill="${c}"/>
        <ellipse cx="13" cy="14" rx="4"  ry="4.5" fill="${e}"/>
        <circle  cx="14" cy="13" r="2"            fill="${p}"/>
        <ellipse cx="27" cy="14" rx="4"  ry="4.5" fill="${e}"/>
        <circle  cx="28" cy="13" r="2"            fill="${p}"/>
        <path d="M15 22 Q20 25 25 22" stroke="${p}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>`.trim();
  }

  if (shape === 'tall') {
    const w = Math.round(size * 0.75);
    const h = size;
    return `
      <svg width="${w}" height="${h}" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="15" cy="22" rx="11" ry="16" fill="${c}"/>
        <ellipse cx="10" cy="18" rx="3.5" ry="4"  fill="${e}"/>
        <circle  cx="11" cy="17" r="1.8"           fill="${p}"/>
        <ellipse cx="20" cy="18" rx="3.5" ry="4"  fill="${e}"/>
        <circle  cx="21" cy="17" r="1.8"           fill="${p}"/>
        <path d="M11 27 Q15 30 19 27" stroke="${p}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>`.trim();
  }

  // default: round
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="22" rx="16" ry="14"  fill="${c}"/>
      <ellipse cx="13" cy="17" rx="4"  ry="4.5" fill="${e}"/>
      <circle  cx="14" cy="16" r="2"             fill="${p}"/>
      <ellipse cx="27" cy="17" rx="4"  ry="4.5" fill="${e}"/>
      <circle  cx="28" cy="16" r="2"             fill="${p}"/>
      <path d="M15 26 Q20 30 25 26" stroke="${p}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="11" cy="33" rx="4"  ry="3"   fill="${c}" opacity="0.6"/>
      <ellipse cx="29" cy="33" rx="4"  ry="3"   fill="${c}" opacity="0.6"/>
    </svg>`.trim();
}

function _weightedPick(pool) {
  if (!pool.length) return null;
  const weights = pool.map((t) => t.spawnWeight);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Pick a random creature type: rarity tier from spawnTable, then weighted spawnWeight within tier.
 */
function pickRandomCreatureType() {
  if (!CREATURE_TYPES.length) return null;

  const roll = Math.random();
  const { rareTop, uncommonTop } = _spawnThresholds;

  const pool =
    roll < rareTop ? CREATURE_TYPES.filter((t) => t.rarity === 'rare') :
    roll < uncommonTop ? CREATURE_TYPES.filter((t) => t.rarity === 'uncommon') :
      CREATURE_TYPES.filter((t) => t.rarity === 'common');

  const chosen = _weightedPick(pool.length ? pool : CREATURE_TYPES);
  return chosen || CREATURE_TYPES[0];
}

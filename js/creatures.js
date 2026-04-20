/**
 * creatures.js
 * Defines all creature types and builds their SVG markup.
 * Add new creatures here — the rest of the game picks them up automatically.
 */

const CREATURE_TYPES = [
  {
    id: 'blobby',
    label: 'blobby',
    color: '#ff7043',
    eyeWhite: '#ffffff',
    pupil: '#333333',
    shape: 'round',
    rarity: 'common',
  },
  {
    id: 'squish',
    label: 'squish',
    color: '#ab47bc',
    eyeWhite: '#ffffff',
    pupil: '#1a237e',
    shape: 'wide',
    rarity: 'common',
  },
  {
    id: 'bouncy',
    label: 'bouncy',
    color: '#26a69a',
    eyeWhite: '#ffffff',
    pupil: '#004d40',
    shape: 'tall',
    rarity: 'common',
  },
  {
    id: 'sparky',
    label: 'sparky',
    color: '#ffd600',
    eyeWhite: '#ffffff',
    pupil: '#333333',
    shape: 'round',
    rarity: 'uncommon',
  },
  {
    id: 'raro',
    label: 'raro',
    color: '#ec407a',
    eyeWhite: '#ffffff',
    pupil: '#880e4f',
    shape: 'wide',
    rarity: 'rare',
  },
];

/**
 * Build SVG markup for a creature.
 * @param {object} type  - one of CREATURE_TYPES
 * @param {number} size  - approximate pixel size (width OR height, depends on shape)
 * @returns {string}     - raw SVG string
 */
function buildCreatureSVG(type, size = 40) {
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

/**
 * Pick a random creature type, weighted by rarity.
 * common: 60%  |  uncommon: 30%  |  rare: 10%
 */
function pickRandomCreatureType() {
  const roll = Math.random();
  const pool =
    roll < 0.10 ? CREATURE_TYPES.filter(t => t.rarity === 'rare') :
    roll < 0.40 ? CREATURE_TYPES.filter(t => t.rarity === 'uncommon') :
                  CREATURE_TYPES.filter(t => t.rarity === 'common');
  return pool[Math.floor(Math.random() * pool.length)];
}

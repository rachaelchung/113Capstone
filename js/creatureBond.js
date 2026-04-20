/**
 * creatureBond.js
 * Per-resident bond (closeness from feeds + interactions) and a habitat panel
 * to feed, boop, and chat using personality-driven lines from the creature catalog.
 *
 * Depends: CREATURE_TYPES, buildCreatureSVG, Game (trySpendFood, getStats), Home (pause/resume wander).
 */

const CreatureBond = (() => {
  const STORAGE_KEY = 'hen_creature_bond_v1';

  /** @type {{ bonds: Record<string, { feeds: number, pets: number, chats: number }> }} */
  let state = { bonds: {} };

  /** @type {{ id: string, typeId: string, name: string } | null} */
  let currentResident = null;

  let overlay = null;
  let escHandler = null;

  const VIBE_BY_PERSONALITY = {
    energy: new Set(['cheerleader', 'hype', 'morning_person', 'coach', 'zesty']),
    soft: new Set(['gentle_accountability', 'calm', 'nurturing', 'forgiving', 'comfort', 'dreamy', 'cozy', 'sweet_balance', 'flow', 'hopeful', 'break_buddy']),
    silly: new Set(['rascal_soft_heart', 'playful', 'chaotic_kind', 'snacker', 'creative']),
    study: new Set(['hyperfocus_nerd', 'planner', 'clear_mind', 'pattern_seeker', 'time_aware', 'determined']),
    shy: new Set(['anxious_brave', 'honest', 'library_ghost', 'slow_steady', 'stoic_warm']),
    loyal: new Set(['grateful_dependent', 'loyal', 'tiny_protector']),
    night: new Set(['midnight_study', 'gentle_night']),
    rareheart: new Set(['proud_loner', 'ethereal', 'fast_brilliant', 'regal_kind', 'growth_arc']),
    gentle: new Set(['earnest', 'curious', 'new_beginning']),
    airy: new Set(['stretchy_resilience', 'frosted', 'cool_head', 'fresh_start', 'many_sides']),
  };

  const CHAT_POOLS = {
    energy: [
      'tiny boss fight energy: we chip the hp of your homework.',
      'say the task out loud. i’ll nod like it’s profound.',
      'you’re allowed to be loud about small wins. i’ll match volume.',
    ],
    soft: [
      'we can go slow. slow still reaches the desk.',
      'no grades attached to this moment. just us.',
      'if your brain feels fuzzy, we can sit fuzzy together.',
    ],
    silly: [
      'if procrastination is a gremlin, we’re the silly bouncer.',
      'chaotic good study plan: snacks, water, one paragraph.',
      'i’m not judging your tabs. i’m judging them kindly.',
    ],
    study: [
      'break the scary task into a snack-sized crumb. one crumb.',
      'syllabus is lore. you’re speedrunning the good parts.',
      'focus is a skill tree. you just unlocked a branch.',
    ],
    shy: [
      'you showed up. that counts more than perfect.',
      'nervous is normal. i’m nervous too. we match.',
      'thanks for being gentle with yourself around me.',
    ],
    loyal: [
      'i’m keeping your seat warm in this habitat.',
      'pocket promise upgrade: heart-sized.',
      'i noticed you came back. that means a lot.',
    ],
    night: [
      'lamps and lo-fi: classic combo. you’re doing the vibe right.',
      'night shift isn’t doom shift. we pace it.',
      'stars are just syllabus dots in the sky.',
    ],
    rareheart: [
      'rare doesn’t mean fragile. rare means worth the care.',
      'you caught something special. keep being that careful.',
      'we can grow slow. some roots go deepest.',
    ],
    gentle: [
      'curiosity first, answers later. that’s a valid plan.',
      'earnest is a superpower. wear it loud.',
    ],
    airy: [
      'breathe like you mean it. one out, one in.',
      'fresh starts are allowed mid-semester.',
      'balance isn’t boring. balance is survival.',
    ],
    neutral: [
      'hi. humans are weird. i like yours.',
      'thanks for saying hi. that felt friendly.',
      'this habitat got nicer when you tapped me.',
    ],
  };

  const PET_POOLS = {
    energy: ['boop!! registered!! hype maintained!!', 'that boop charged my tiny batteries.'],
    soft: ['soft boop received. exhale optional but recommended.', 'gentle. i’ll remember that touch.'],
    silly: ['hehe—do it again, i dare you.', 'boop detected. deploying smirk.'],
    study: ['input accepted. affection metrics trending up.', 'efficient boop. very you.'],
    shy: ['…okay. that was nice. tiny smile engaged.', 'careful hands. i trust careful hands.'],
    loyal: ['that’s my human. confirmed.', 'guard mode: off. cuddle mode: maybe.'],
    night: ['night boop. statistically luckier.', 'moon-approved pat.'],
    rareheart: ['vip touch. i’ll pretend i’m chill about it.', 'you’re allowed to spoil me a little.'],
    gentle: ['sweet boop. notes filed under: good day.', 'kindness received. returning in kind.'],
    airy: ['light touch, big ripple.', 'breeze-level boop. perfect.'],
    neutral: ['boop! still counts!', 'pat registered. happiness +1.'],
  };

  const FEED_POOLS = {
    energy: ['fuel acquired!! now we chase one win together.', 'that snack was loud in the best way. thanks.'],
    soft: ['warm food, warm heart. thank you for sharing.', 'fed and calm. you’re good at taking care.'],
    silly: ['yum—was that… legally delicious?', 'snack heist successful. accomplice: you.'],
    study: ['macros optimized. (i mean emotionally.)', 'nutrients logged. focus buff: imaginary but real.'],
    shy: ['…thank you. i’ll try to deserve the next one.', 'gentle feeding. i’ll remember this moment.'],
    loyal: ['i’ll guard this meal in my heart forever.', 'fed = loved. simple math.'],
    night: ['late snack hits different. in a good way.', 'fed under soft light. peak cozy.'],
    rareheart: ['rare treat for a rare friend.', 'you didn’t have to. you did. that’s huge.'],
    gentle: ['tastes like trust.', 'small meal, big message: you show up.'],
    airy: ['balanced snack for a balanced soul.', 'refreshing. like a save point.'],
    neutral: ['full tummy, full heart, cliché but true.', 'thanks for the food. thanks for the you.'],
  };

  const CHAT_ACTION_LABEL = {
    energy: 'ask for hype',
    soft: 'sit together',
    silly: 'goof around',
    study: 'study pep talk',
    shy: 'gentle check-in',
    loyal: 'say thanks',
    night: 'night shift chat',
    rareheart: 'deep talk',
    gentle: 'earnest chat',
    airy: 'breathe & reset',
    neutral: 'say hi',
  };

  function _vibeKey(personality) {
    if (!personality) return 'neutral';
    for (const [key, set] of Object.entries(VIBE_BY_PERSONALITY)) {
      if (set.has(personality)) return key;
    }
    return 'neutral';
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.bonds && typeof parsed.bonds === 'object') {
        state = { bonds: parsed.bonds };
      }
    } catch {
      /* private mode / corrupt */
    }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* noop */
    }
  }

  function _ensureBond(residentId) {
    if (!state.bonds[residentId]) {
      state.bonds[residentId] = { feeds: 0, pets: 0, chats: 0 };
    }
    return state.bonds[residentId];
  }

  function getBond(residentId) {
    return { ..._ensureBond(residentId) };
  }

  function closenessPercent(b) {
    const feeds = b.feeds * 10;
    const pets = b.pets * 4;
    const chats = b.chats * 6;
    return Math.min(100, Math.round(feeds + pets + chats));
  }

  function closenessTier(pct) {
    if (pct >= 100) return { label: 'kindred', blurb: 'max closeness — you really showed up.' };
    if (pct >= 80) return { label: 'inseparable', blurb: 'best-habitat energy.' };
    if (pct >= 60) return { label: 'close pals', blurb: 'they light up when you visit.' };
    if (pct >= 40) return { label: 'good friends', blurb: 'trust is growing.' };
    if (pct >= 20) return { label: 'warming up', blurb: 'they’re learning your rhythm.' };
    return { label: 'just met', blurb: 'every bond starts with one tap.' };
  }

  function _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function _linePool(type, poolMap) {
    const key = _vibeKey(type && type.personality);
    const base = poolMap[key] || poolMap.neutral;
    const extra = [];
    if (type && type.quoteCaught) extra.push(type.quoteCaught);
    if (type && type.tagline) extra.push(type.tagline);
    return [...extra, ...base];
  }

  function _getType(typeId) {
    return CREATURE_TYPES.find((t) => t.id === typeId) || null;
  }

  function init() {
    _load();
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'creatureBondOverlay';
    overlay.className = 'creature-bond-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="creature-bond-backdrop" data-close-bond="1" aria-hidden="true"></div>
      <div class="creature-bond-card" role="dialog" aria-modal="true" aria-labelledby="creatureBondName">
        <button type="button" class="creature-bond-close" id="creatureBondClose" aria-label="Close">✕</button>
        <div class="creature-bond-row">
          <div class="creature-bond-preview" id="creatureBondPreview"></div>
          <div class="creature-bond-head">
            <h3 class="creature-bond-name" id="creatureBondName"></h3>
            <p class="creature-bond-species" id="creatureBondSpecies"></p>
            <p class="creature-bond-personality" id="creatureBondPersonality"></p>
          </div>
        </div>
        <div class="creature-bond-meter-wrap" aria-hidden="true">
          <div class="creature-bond-meter-label">closeness</div>
          <div class="creature-bond-meter">
            <div class="creature-bond-meter-fill" id="creatureBondMeterFill"></div>
          </div>
        </div>
        <p class="creature-bond-tierline" id="creatureBondTierline"></p>
        <p class="creature-bond-msg" id="creatureBondMsg"></p>
        <div class="creature-bond-actions">
          <button type="button" class="btn btn--bond btn--bond-feed" id="creatureBondFeed">feed (1 food)</button>
          <button type="button" class="btn btn--bond btn--bond-pet" id="creatureBondPet">gentle boop</button>
          <button type="button" class="btn btn--bond btn--bond-chat" id="creatureBondChat">chat</button>
        </div>
        <p class="creature-bond-foodhint" id="creatureBondFoodhint"></p>
      </div>
    `.trim();

    document.body.appendChild(overlay);

    overlay.querySelector('[data-close-bond="1"]').addEventListener('click', close);
    overlay.querySelector('#creatureBondClose').addEventListener('click', close);
    overlay.querySelector('#creatureBondFeed').addEventListener('click', _onFeed);
    overlay.querySelector('#creatureBondPet').addEventListener('click', _onPet);
    overlay.querySelector('#creatureBondChat').addEventListener('click', _onChat);
  }

  function _setMessage(text) {
    const el = overlay.querySelector('#creatureBondMsg');
    if (el) el.textContent = text;
  }

  function _refreshPanel() {
    if (!overlay || !currentResident) return;

    const type = _getType(currentResident.typeId);
    const b = _ensureBond(currentResident.id);
    const pct = closenessPercent(b);
    const tier = closenessTier(pct);
    const food = typeof Game !== 'undefined' ? Game.getStats().food : 0;

    overlay.querySelector('#creatureBondName').textContent = currentResident.name;
    overlay.querySelector('#creatureBondSpecies').textContent = type ? `a ${type.label}` : 'a mysterious friend';
    const pers = type && type.personality ? type.personality.replace(/_/g, ' ') : 'unique';
    overlay.querySelector('#creatureBondPersonality').textContent = `vibe: ${pers}`;

    const fill = overlay.querySelector('#creatureBondMeterFill');
    if (fill) fill.style.width = `${pct}%`;

    overlay.querySelector('#creatureBondTierline').textContent =
      `${tier.label} · ${pct}% — ${tier.blurb}`;

    const vkey = _vibeKey(type && type.personality);
    const chatBtn = overlay.querySelector('#creatureBondChat');
    if (chatBtn) chatBtn.textContent = CHAT_ACTION_LABEL[vkey] || CHAT_ACTION_LABEL.neutral;

    const feedBtn = overlay.querySelector('#creatureBondFeed');
    if (feedBtn) {
      feedBtn.disabled = food < 1;
      feedBtn.textContent = food < 1 ? 'need food (focus timer)' : 'feed (1 food)';
    }

    const hint = overlay.querySelector('#creatureBondFoodhint');
    if (hint) {
      hint.textContent =
        food < 1
          ? 'earn food while the focus timer runs — then come back to share.'
          : `you have ${food} food. feeding raises closeness fastest.`;
    }
  }

  function openForResident(resident) {
    if (!overlay) init();
    currentResident = resident;
    _ensureBond(resident.id);

    const type = _getType(resident.typeId);
    const preview = overlay.querySelector('#creatureBondPreview');
    if (preview) preview.innerHTML = type ? buildCreatureSVG(type, 72) : '';

    overlay.hidden = false;
    overlay.classList.add('creature-bond-overlay--open');
    _setMessage('tap an action — boops and chats add closeness; food needs focus-time snacks.');
    _refreshPanel();

    if (typeof Home !== 'undefined' && Home.pauseResidents) Home.pauseResidents();

    escHandler = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', escHandler);
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    overlay.classList.remove('creature-bond-overlay--open');
    currentResident = null;
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
    if (typeof Home !== 'undefined' && Home.resumeResidents) Home.resumeResidents();
  }

  function isOpen() {
    return overlay && !overlay.hidden;
  }

  function _onFeed() {
    if (!currentResident) return;
    const type = _getType(currentResident.typeId);
    const b = _ensureBond(currentResident.id);

    if (typeof Game === 'undefined' || !Game.trySpendFood(1)) {
      _setMessage('not enough food — run the focus timer to earn more.');
      _refreshPanel();
      return;
    }

    b.feeds += 1;
    _save();
    const vkey = _vibeKey(type && type.personality);
    const line = _pick(_linePool(type, FEED_POOLS));
    _setMessage(line);
    _refreshPanel();
  }

  function _onPet() {
    if (!currentResident) return;
    const type = _getType(currentResident.typeId);
    const b = _ensureBond(currentResident.id);
    b.pets += 1;
    _save();
    const line = _pick(_linePool(type, PET_POOLS));
    _setMessage(line);
    _refreshPanel();
  }

  function _onChat() {
    if (!currentResident) return;
    const type = _getType(currentResident.typeId);
    const b = _ensureBond(currentResident.id);
    b.chats += 1;
    _save();
    const line = _pick(_linePool(type, CHAT_POOLS));
    _setMessage(line);
    _refreshPanel();
  }

  function getStatsForResident(residentId) {
    const b = _ensureBond(residentId);
    const pct = closenessPercent(b);
    return { bond: { ...b }, closeness: pct, tier: closenessTier(pct) };
  }

  return {
    init,
    openForResident,
    close,
    isOpen,
    getBond,
    getStatsForResident,
    closenessPercent,
    closenessTier,
  };
})();

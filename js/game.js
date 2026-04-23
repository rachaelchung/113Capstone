/**
 * game.js
 * Handles creature spawning/catching during focus, the economy (food & coins),
 * and notifies Home when a creature is caught. Depends on creatures.js + home.js.
 */

const Game = (() => {
  /* ── state ───────────────────────────────────── */
  let food    = 0;
  let coins   = 0;
  let caught  = 0;
  let foodAccumulator = 0;   // fractional food; 1 food per 10 active focus-seconds

  let spawnTimeout = null;
  let forbidden    = false;
  /** True after server (or explicit applyPersistPayload) set economy; skips localStorage load in initEconomy. */
  let _economyHydrated = false;

  const ECONOMY_STORAGE_PREFIX = 'henn_game_economy_v1_';
  let _economySaveTimer = null;

  function _parseJwtSub(jwt) {
    try {
      const body = jwt.split('.')[1];
      if (!body) return null;
      let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const payload = JSON.parse(atob(b64));
      return payload && payload.sub != null ? String(payload.sub) : null;
    } catch {
      return null;
    }
  }

  function _economyStorageKey() {
    let uid = 'guest';
    try {
      const jwt = localStorage.getItem('henn_tracker_jwt');
      if (jwt && jwt.trim()) {
        const s = _parseJwtSub(jwt.trim());
        if (s) uid = s;
      } else {
        const raw = localStorage.getItem('henn_tracker_user_id');
        if (raw && String(raw).trim()) uid = String(raw).trim();
      }
    } catch {
      /* ignore */
    }
    return ECONOMY_STORAGE_PREFIX + uid;
  }

  function _scheduleEconomySave() {
    if (_economySaveTimer) clearTimeout(_economySaveTimer);
    _economySaveTimer = setTimeout(() => {
      _economySaveTimer = null;
      try {
        localStorage.setItem(
          _economyStorageKey(),
          JSON.stringify({ food, coins, caught, foodAccumulator }),
        );
      } catch {
        /* quota / private mode */
      }
      if (typeof UserAppState !== 'undefined' && UserAppState.schedulePush) UserAppState.schedulePush();
    }, 320);
  }

  function getPersistPayload() {
    return {
      food,
      coins,
      caught,
      foodAccumulator,
    };
  }

  /** Apply economy from server (`UserAppState`) and mirror to localStorage. */
  function applyPersistPayload(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Number.isFinite(Number(obj.food))) food = Math.max(0, Math.floor(Number(obj.food)));
    if (Number.isFinite(Number(obj.coins))) coins = Math.max(0, Math.floor(Number(obj.coins)));
    if (Number.isFinite(Number(obj.caught))) caught = Math.max(0, Math.floor(Number(obj.caught)));
    if (Number.isFinite(Number(obj.foodAccumulator))) {
      foodAccumulator = Math.max(0, Math.floor(Number(obj.foodAccumulator)));
    }
    _economyHydrated = true;
    try {
      localStorage.setItem(
        _economyStorageKey(),
        JSON.stringify({ food, coins, caught, foodAccumulator }),
      );
    } catch {
      /* ignore */
    }
  }

  /** Load food / coins / caught for the current signed-in user (or guest). Call once on app load. */
  function initEconomy() {
    if (!_economyHydrated) {
      try {
        const raw = localStorage.getItem(_economyStorageKey());
        if (raw) {
          const o = JSON.parse(raw);
          if (Number.isFinite(o.food)) food = o.food;
          if (Number.isFinite(o.coins)) coins = o.coins;
          if (Number.isFinite(o.caught)) caught = o.caught;
          if (Number.isFinite(o.foodAccumulator)) foodAccumulator = o.foodAccumulator;
        }
      } catch {
        /* keep defaults */
      }
    }
    _updateStat('foodStat', food);
    _updateStat('coinsStat', coins);
    _updateStat('caughtStat', caught);
  }

  /* ── economy ─────────────────────────────────── */

  /** Call once per focus second while timer is running and not forbidden. */
  function onFocusTick() {
    foodAccumulator++;
    if (foodAccumulator % 10 === 0) {
      food++;
      _updateStat('foodStat', food);
      _scheduleEconomySave();
    }
  }

  function _burstPointForCoins() {
    const el = document.getElementById('coinsStat');
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) {
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 - 2 };
      }
    }
    return {
      x: window.innerWidth / 2,
      y: Math.min(window.innerHeight - 72, window.innerHeight * 0.88),
    };
  }

  function _pulseStat(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('stat-val--pop');
    void el.offsetWidth;
    el.classList.add('stat-val--pop');
    setTimeout(() => el.classList.remove('stat-val--pop'), 620);
  }

  /**
   * Marketing-page style floating popup at viewport coordinates (fixed).
   * @param {number} clientX
   * @param {number} clientY
   * @param {string} text
   * @param {'coin'|'catch'} variant
   */
  function spawnRewardBurst(clientX, clientY, text, variant = 'coin') {
    const el = document.createElement('div');
    el.setAttribute('role', 'presentation');
    el.className = `reward-click-burst reward-click-burst--${variant}`;
    el.textContent = text;
    el.style.left = `${Math.round(clientX)}px`;
    el.style.top = `${Math.round(clientY)}px`;
    document.body.appendChild(el);
    const done = () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 980);
  }

  /** Award coins (e.g. when a tracker task is completed — once per task; see trackerStore). */
  function awardCoins(amount = 1) {
    const n = Number(amount);
    const add = Number.isFinite(n) && n > 0 ? n : 0;
    if (add <= 0) return;
    coins += add;
    _updateStat('coinsStat', coins);
    _scheduleEconomySave();
    _pulseStat('coinsStat');
    const p = _burstPointForCoins();
    spawnRewardBurst(p.x, p.y, `+${add} 🪙`, 'coin');
  }

  /** Spend food (e.g. feeding a resident). @returns {boolean} */
  function trySpendFood(amount = 1) {
    if (food < amount) return false;
    food -= amount;
    _updateStat('foodStat', food);
    _scheduleEconomySave();
    return true;
  }

  /** Spend coins (e.g. decoration shop). @returns {boolean} */
  function trySpendCoins(amount = 1) {
    if (coins < amount) return false;
    coins -= amount;
    _updateStat('coinsStat', coins);
    _scheduleEconomySave();
    return true;
  }

  /* ── forbidden mode ──────────────────────────── */

  function setForbidden(isForbidden) {
    forbidden = isForbidden;

    const flash = document.getElementById('forbiddenFlash');
    if (flash) flash.classList.toggle('active', forbidden);

    const btn = document.getElementById('forbiddenBtn');
    if (btn) {
      btn.textContent = forbidden
        ? 'resume (leave forbidden site)'
        : 'simulate forbidden site';
      btn.classList.toggle('on', forbidden);
    }

    if (forbidden) {
      _clearSpawnQueue();
      _removeAllCreatures();
    }
  }

  function isForbidden() { return forbidden; }

  /* ── spawning ────────────────────────────────── */

  /** Start the spawn loop. Call when timer enters focus and is running. */
  function startSpawning() {
    if (forbidden) return;
    _scheduleNextSpawn();
  }

  /** Stop spawning and clear existing creatures. */
  function stopSpawning() {
    _clearSpawnQueue();
    _removeAllCreatures();
  }

  function _scheduleNextSpawn() {
    _clearSpawnQueue();
    const delay = 120000 + Math.random() * 180000; // 2–5 minutes between spawns
    spawnTimeout = setTimeout(_spawnCreature, delay);
  }

  function _spawnCreature() {
    if (forbidden) return;

    const hab  = document.getElementById('focusArena');
    const habW = hab.offsetWidth;
    const habH = hab.offsetHeight;

    const type      = pickRandomCreatureType();
    const goRight   = Math.random() > 0.5;
    const size      = 36 + Math.floor(Math.random() * 22); // slightly larger = easier to tap
    const bottomPct = 0.38 + Math.random() * 0.18;

    const startX = goRight ? -60 : habW + 10;
    const endX   = goRight ? habW + 70 : -70;

    const el = document.createElement('div');
    el.className      = 'creature';
    el.dataset.typeId = type.id;
    el.innerHTML      = buildCreatureSVG(type, size);
    el.style.cssText  = `
      left:   ${startX}px;
      bottom: ${Math.round(habH * bottomPct)}px;
      position: absolute;
    `;

    el.addEventListener('click', () => _catchCreature(el, type));

    hab.appendChild(el);
    const duration = 10000 + Math.random() * 8000; // ~10–18 s across the lane
    el.style.transition = `left ${duration}ms linear`;
    requestAnimationFrame(() => { el.style.left = endX + 'px'; });

    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), duration + 300);

    _scheduleNextSpawn();
  }

  function _catchCreature(el, type) {
    caught++;
    _updateStat('caughtStat', caught);
    _scheduleEconomySave();
    Home.notifyCatch(type.id);
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    _pulseStat('caughtStat');
    spawnRewardBurst(cx, cy, '🌟 +1 🐾', 'catch');

    if (el.parentNode) el.parentNode.removeChild(el);
  }

  /* ── UI helpers ──────────────────────────────── */

  function _updateStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function _removeAllCreatures() {
    document.getElementById('focusArena')
      .querySelectorAll('.creature')
      .forEach(c => c.remove());
  }

  function _clearSpawnQueue() {
    clearTimeout(spawnTimeout);
    spawnTimeout = null;
  }

  /* ── notification helper ─────────────────────── */

  function showNotif(message) {
    const n = document.getElementById('notif');
    n.textContent = message;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 2500);
  }

  /* ── public API ──────────────────────────────── */
  return {
    onFocusTick,
    awardCoins,
    spawnRewardBurst,
    getPersistPayload,
    applyPersistPayload,
    initEconomy,
    setForbidden,
    isForbidden,
    startSpawning,
    stopSpawning,
    showNotif,
    getStats: () => ({ food, coins, caught }),
    trySpendFood,
    trySpendCoins,
  };
})();

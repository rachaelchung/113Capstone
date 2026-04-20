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

  /* ── economy ─────────────────────────────────── */

  /** Call once per focus second while timer is running and not forbidden. */
  function onFocusTick() {
    foodAccumulator++;
    if (foodAccumulator % 10 === 0) {
      food++;
      _updateStat('foodStat', food);
    }
  }

  /** Award coins (called when an assignment is completed — wired up in phase 2). */
  function awardCoins(amount = 1) {
    coins += amount;
    _updateStat('coinsStat', coins);
  }

  /* ── forbidden mode ──────────────────────────── */

  function setForbidden(isForbidden) {
    forbidden = isForbidden;

    document.getElementById('forbiddenFlash')
      .classList.toggle('active', forbidden);

    const btn = document.getElementById('forbiddenBtn');
    btn.textContent = forbidden
      ? 'resume (leave forbidden site)'
      : 'simulate forbidden site';
    btn.classList.toggle('on', forbidden);

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
    const delay = 8000 + Math.random() * 12000; // 8–20 s between spawns
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
    Home.notifyCatch(type.id);
    _showCatchBurst(el);

    if (el.parentNode) el.parentNode.removeChild(el);
  }

  /* ── UI helpers ──────────────────────────────── */

  function _updateStat(id, value) {
    document.getElementById(id).textContent = value;
  }

  function _showCatchBurst(el) {
    const hab   = document.getElementById('focusArena');
    const burst = document.createElement('div');
    burst.className  = 'catch-burst';
    burst.textContent = '+1';
    burst.style.cssText = `
      left:   ${parseInt(el.style.left, 10) + 10}px;
      bottom: ${el.style.bottom};
      position: absolute;
    `;
    hab.appendChild(burst);
    setTimeout(() => burst.parentNode && burst.parentNode.removeChild(burst), 700);
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
    setForbidden,
    isForbidden,
    startSpawning,
    stopSpawning,
    showNotif,
    getStats: () => ({ food, coins, caught }),
  };
})();

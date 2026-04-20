/**
 * main.js
 * Entry point. Wires Timer callbacks → Game reactions,
 * and binds all button click events.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadCreatureCatalog();

  CreatureBond.init();
  Home.init();

  const timerDock = document.getElementById('timerDock');
  const screenToggleBtn = document.getElementById('screenToggleBtn');
  const navIconHome = document.getElementById('navIconHome');
  const navIconFocus = document.getElementById('navIconFocus');
  const menuBtn = document.getElementById('menuBtn');
  const sideMenu = document.getElementById('sideMenu');
  const sideMenuBackdrop = document.getElementById('sideMenuBackdrop');
  const startBtn = document.getElementById('startBtn');

  /* ── screen navigation ─────────────────────── */

  function setMenuOpen(open) {
    if (!sideMenu || !menuBtn) return;
    sideMenu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setScreen(name) {
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('screen--active', el.id === `screen-${name}`);
    });

    const onHome = name === 'home';

    if (onHome) {
      if (Timer.isRunning()) {
        Timer.pause();
        Game.stopSpawning();
        if (startBtn) {
          startBtn.textContent = 'start';
          startBtn.classList.remove('running');
        }
      }
      if (timerDock) timerDock.classList.add('timer-dock--hidden');
    } else {
      if (timerDock) timerDock.classList.remove('timer-dock--hidden');
    }

    if (screenToggleBtn && navIconHome && navIconFocus) {
      if (onHome) {
        screenToggleBtn.dataset.targetScreen = 'focus';
        screenToggleBtn.setAttribute('aria-label', 'Back to focus');
        navIconHome.classList.add('icon-btn__svg--hidden');
        navIconFocus.classList.remove('icon-btn__svg--hidden');
      } else {
        screenToggleBtn.dataset.targetScreen = 'home';
        screenToggleBtn.setAttribute('aria-label', 'Go to my habitat');
        navIconFocus.classList.add('icon-btn__svg--hidden');
        navIconHome.classList.remove('icon-btn__svg--hidden');
      }
    }

    if (name === 'home') Home.enter();
    else Home.leave();
  }

  if (screenToggleBtn) {
    screenToggleBtn.addEventListener('click', () => {
      const next = screenToggleBtn.dataset.targetScreen === 'home' ? 'home' : 'focus';
      setScreen(next);
    });
  }

  if (menuBtn && sideMenu) {
    menuBtn.addEventListener('click', () => {
      setMenuOpen(sideMenu.hidden);
    });
  }

  if (sideMenuBackdrop) {
    sideMenuBackdrop.addEventListener('click', () => setMenuOpen(false));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu && !sideMenu.hidden) {
      setMenuOpen(false);
    }
  });

  function initTimerDockDrag(dock) {
    const handle = document.getElementById('timerDockHandle');
    if (!handle) return;

    const STORAGE_KEY = 'timerDockPos';
    const margin = 8;

    function readSaved() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const { l, t } = JSON.parse(raw);
        if (typeof l !== 'number' || typeof t !== 'number' || Number.isNaN(l) || Number.isNaN(t)) {
          return null;
        }
        return { l, t };
      } catch {
        return null;
      }
    }

    function savePos(l, t) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ l: Math.round(l), t: Math.round(t) }));
      } catch {
        /* private mode / quota */
      }
    }

    function layoutDock(left, top) {
      const w = dock.offsetWidth;
      const h = dock.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!w || !h) {
        dock.style.left = `${Math.round(left)}px`;
        dock.style.top = `${Math.round(top)}px`;
        dock.style.right = 'auto';
        dock.style.bottom = 'auto';
        return { l: left, t: top };
      }
      const maxL = Math.max(margin, vw - w - margin);
      const maxT = Math.max(margin, vh - h - margin);
      const cl = Math.min(Math.max(margin, left), maxL);
      const ct = Math.min(Math.max(margin, top), maxT);
      dock.style.left = `${Math.round(cl)}px`;
      dock.style.top = `${Math.round(ct)}px`;
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      return { l: cl, t: ct };
    }

    function clampFromResize() {
      if (dock.style.left === '') return;
      const l = parseFloat(dock.style.left);
      const t = parseFloat(dock.style.top);
      if (Number.isNaN(l) || Number.isNaN(t)) return;
      layoutDock(l, t);
    }

    const saved = readSaved();
    if (saved) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => layoutDock(saved.l, saved.t));
      });
    }

    window.addEventListener('resize', () => {
      requestAnimationFrame(clampFromResize);
    });

    let drag = null;

    handle.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
    });

    handle.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = dock.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        l0: r.left,
        t0: r.top,
      };
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dock.classList.add('timer-dock--dragging');
      document.body.classList.add('is-timer-dragging');
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      layoutDock(drag.l0 + dx, drag.t0 + dy);
    });

    function endDrag(e) {
      if (!drag) return;
      if (e && typeof e.pointerId === 'number' && e.pointerId !== drag.id) return;
      const pid = drag.id;
      try {
        handle.releasePointerCapture(pid);
      } catch {
        /* noop */
      }
      const l = parseFloat(dock.style.left);
      const t = parseFloat(dock.style.top);
      if (!Number.isNaN(l) && !Number.isNaN(t)) savePos(l, t);
      dock.classList.remove('timer-dock--dragging');
      document.body.classList.remove('is-timer-dragging');
      drag = null;
    }

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  setScreen('focus');

  if (timerDock) initTimerDockDrag(timerDock);

  /* ── wire Timer callbacks to Game ──────────── */

  Timer.setCallbacks({

    onTick({ isFocus }) {
      if (isFocus) {
        Game.onFocusTick();
      }
    },

    onPhaseEnd({ newPhase }) {
      const name = newPhase.name;

      if (name === 'focus') {
        Game.showNotif('back to focus! time to work.');
        if (!Game.isForbidden()) {
          Game.startSpawning();
        }
      } else if (name === 'long break') {
        Game.showNotif('long break — you earned it!');
        Game.stopSpawning();
      } else {
        Game.showNotif('short break time!');
        Game.stopSpawning();
      }
    },

    onBreakWarn({ phaseName }) {
      const label = phaseName === 'long break' ? 'long break' : 'break';
      Game.showNotif(`${label} ending soon!`);
    },

  });

  /* ── button: start / pause ──────────────────── */

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (Timer.isRunning()) {
        Timer.pause();
        Game.stopSpawning();
        startBtn.textContent = 'start';
        startBtn.classList.remove('running');
      } else {
        Timer.start();
        startBtn.textContent = 'pause';
        startBtn.classList.add('running');

        if (Timer.isFocus() && !Game.isForbidden()) {
          Game.startSpawning();
        }
      }
    });
  }

  /* ── button: reset ──────────────────────────── */

  document.getElementById('resetBtn').addEventListener('click', () => {
    Timer.reset();
    Game.stopSpawning();
    if (startBtn) {
      startBtn.textContent = 'start';
      startBtn.classList.remove('running');
    }
  });

  /* ── button: forbidden site toggle ─────────── */

  document.getElementById('forbiddenBtn').addEventListener('click', () => {
    const nowForbidden = !Game.isForbidden();
    Game.setForbidden(nowForbidden);

    if (!nowForbidden && Timer.isRunning() && Timer.isFocus()) {
      Game.startSpawning();
    }
  });

});

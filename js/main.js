/**
 * main.js
 * Entry point. Wires Timer callbacks → Game reactions,
 * and binds all button click events.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadCreatureCatalog();
  await loadDecorationCatalog();
  await loadBackgroundsCatalog();

  await UserAppState.pullAndApply();

  CreatureBond.init();
  Home.init();
  Store.init();
  Home.syncBackgroundFromStore();
  FocusBg.applyFromStore();

  if (typeof Game !== 'undefined' && Game.initEconomy) Game.initEconomy();

  const timerDock = document.getElementById('timerDock');
  const screenToggleBtn = document.getElementById('screenToggleBtn');
  const storeBtn = document.getElementById('storeBtn');
  const navIconHome = document.getElementById('navIconHome');
  const navIconFocus = document.getElementById('navIconFocus');
  const menuBtn = document.getElementById('menuBtn');
  const sideMenu = document.getElementById('sideMenu');
  const sideMenuBackdrop = document.getElementById('sideMenuBackdrop');
  const sideMenuProfileBtn = document.getElementById('sideMenuProfileBtn');
  const sideMenuLogoutBtn = document.getElementById('sideMenuLogoutBtn');
  const profileOverlay = document.getElementById('profileOverlay');
  const profileBackdrop = document.getElementById('profileBackdrop');
  const profileCloseBtn = document.getElementById('profileCloseBtn');
  const profileOverlayLogoutBtn = document.getElementById('profileOverlayLogoutBtn');
  const startBtn = document.getElementById('startBtn');

  function escapeHtmlProfile(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setProfileOpen(open) {
    if (!profileOverlay) return;
    profileOverlay.hidden = !open;
    profileOverlay.classList.toggle('store-overlay--open', open);
  }

  async function openProfilePanel() {
    const lede = document.getElementById('profileLede');
    const dl = document.getElementById('profileDl');
    const hint = document.getElementById('profileHint');
    if (!lede || !dl || !hint) return;
    setProfileOpen(true);
    setMenuOpen(false);
    dl.hidden = true;
    hint.hidden = true;
    dl.innerHTML = '';
    lede.textContent = 'loading…';

    let jwt = '';
    try {
      jwt = (localStorage.getItem('henn_tracker_jwt') || '').trim();
    } catch {
      jwt = '';
    }

    if (!jwt) {
      lede.textContent = 'You are not signed in on this device.';
      hint.hidden = false;
      hint.textContent =
        'Use log in or sign up on the home page to sync your tracker and keep a separate coin balance per account.';
      return;
    }

    if (typeof TrackerApi === 'undefined' || !TrackerApi.fetchMe) {
      lede.textContent = 'Profile could not be loaded.';
      return;
    }

    const me = await TrackerApi.fetchMe();
    if (!me) {
      lede.textContent =
        'Could not load your profile from the server. Your session may have expired — try signing in again from the home page.';
      return;
    }

    lede.textContent = 'You are signed in as:';
    dl.hidden = false;
    const rows = [
      ['username', me.username || '—'],
      ['email', me.email || '—'],
      ['display name', me.displayName || '—'],
      ['user id', String(me.id || '—')],
    ];
    dl.innerHTML = rows
      .map(
        ([k, v]) =>
          `<dt>${escapeHtmlProfile(k)}</dt><dd>${escapeHtmlProfile(v)}</dd>`,
      )
      .join('');
  }

  function performLogout() {
    try {
      localStorage.removeItem('henn_tracker_jwt');
      localStorage.removeItem('henn_tracker_user_id');
    } catch {
      /* ignore */
    }
    setMenuOpen(false);
    setProfileOpen(false);
    window.location.href = 'index.html';
  }

  /* ── screen navigation ─────────────────────── */

  function setMenuOpen(open) {
    if (!sideMenu || !menuBtn) return;
    sideMenu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function clearTrackerMenuTabHighlight() {
    document.querySelectorAll('[data-tracker-tab]').forEach((btn) => {
      btn.classList.remove('tracker-tab--active');
    });
  }

  function syncTrackerMenuTabHighlight() {
    if (window.HeadEmptyTracker) {
      HeadEmptyTracker.setTab(HeadEmptyTracker.getActiveTab());
    }
  }

  function setScreen(name) {
    document.querySelectorAll('.screen').forEach((el) => {
      if (!el.id.startsWith('screen-')) return;
      const key = el.id.replace(/^screen-/, '');
      el.classList.toggle('screen--active', key === name);
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
      clearTrackerMenuTabHighlight();
    } else {
      if (timerDock) timerDock.classList.remove('timer-dock--hidden');
      if (name === 'tracker') syncTrackerMenuTabHighlight();
      else clearTrackerMenuTabHighlight();
    }

    if (screenToggleBtn && navIconHome && navIconFocus) {
      if (onHome) {
        screenToggleBtn.dataset.targetScreen = 'focus';
        screenToggleBtn.setAttribute('aria-label', 'Go to focus timer');
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

  if (sideMenu) {
    sideMenu.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-app-screen], [data-tracker-tab]');
      if (!navBtn || !sideMenu.contains(navBtn)) return;
      const screen = navBtn.dataset.appScreen;
      const tab = navBtn.dataset.trackerTab;
      if (screen === 'home' || screen === 'focus') {
        setScreen(screen);
        setMenuOpen(false);
        return;
      }
      if (tab) {
        setScreen('tracker');
        if (window.HeadEmptyTracker) HeadEmptyTracker.setTab(tab);
        setMenuOpen(false);
      }
    });
  }

  if (screenToggleBtn) {
    screenToggleBtn.addEventListener('click', () => {
      const next = screenToggleBtn.dataset.targetScreen === 'home' ? 'home' : 'focus';
      setScreen(next);
    });
  }

  if (storeBtn) {
    storeBtn.addEventListener('click', () => {
      if (Store.isOpen()) Store.close();
      else Store.open();
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

  if (sideMenuProfileBtn) {
    sideMenuProfileBtn.addEventListener('click', () => {
      openProfilePanel();
    });
  }
  if (sideMenuLogoutBtn) {
    sideMenuLogoutBtn.addEventListener('click', () => performLogout());
  }
  if (profileCloseBtn) profileCloseBtn.addEventListener('click', () => setProfileOpen(false));
  if (profileBackdrop) profileBackdrop.addEventListener('click', () => setProfileOpen(false));
  if (profileOverlayLogoutBtn) {
    profileOverlayLogoutBtn.addEventListener('click', () => performLogout());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (profileOverlay && !profileOverlay.hidden) {
      setProfileOpen(false);
      return;
    }
    if (sideMenu && !sideMenu.hidden) setMenuOpen(false);
  });

  const STORAGE_DOCK_MIN = 'timerDockMin';
  const STORAGE_DOCK_POS = 'timerDockPos';

  function readSavedDockPos() {
    try {
      const raw = localStorage.getItem(STORAGE_DOCK_POS);
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

  function applyDockPosStyles(dock, l, t) {
    const margin = 8;
    const w = dock.offsetWidth;
    const h = dock.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!w || !h) {
      dock.style.left = `${Math.round(l)}px`;
      dock.style.top = `${Math.round(t)}px`;
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      return;
    }
    const maxL = Math.max(margin, vw - w - margin);
    const maxT = Math.max(margin, vh - h - margin);
    const cl = Math.min(Math.max(margin, l), maxL);
    const ct = Math.min(Math.max(margin, t), maxT);
    dock.style.left = `${Math.round(cl)}px`;
    dock.style.top = `${Math.round(ct)}px`;
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  }

  function applyTimerDockMinimized(dock, on, opts = {}) {
    if (!dock) return;
    dock.classList.toggle('timer-dock--minimized', on);
    const btn = document.getElementById('timerDockMinBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? '⟨' : '⟩';
      btn.setAttribute('aria-label', on ? 'Expand timer' : 'Minimize timer to a side tab');
      btn.setAttribute('title', on ? 'expand timer' : 'minimize to side tab');
    }
    if (on) {
      dock.style.left = '';
      dock.style.top = '';
      dock.style.right = '';
      dock.style.bottom = '';
    } else {
      const saved = readSavedDockPos();
      if (saved) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => applyDockPosStyles(dock, saved.l, saved.t));
        });
      }
    }
    if (!opts.skipStorage) {
      try {
        localStorage.setItem(STORAGE_DOCK_MIN, on ? '1' : '0');
      } catch {
        /* noop */
      }
    }
  }

  function initTimerDockDrag(dock, options = {}) {
    const handle = document.getElementById('timerDockHandle');
    if (!handle) return;

    const margin = 8;

    function savePos(l, t) {
      try {
        localStorage.setItem(STORAGE_DOCK_POS, JSON.stringify({ l: Math.round(l), t: Math.round(t) }));
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
      if (dock.classList.contains('timer-dock--minimized')) return;
      if (dock.style.left === '') return;
      const l = parseFloat(dock.style.left);
      const t = parseFloat(dock.style.top);
      if (Number.isNaN(l) || Number.isNaN(t)) return;
      layoutDock(l, t);
    }

    if (!options.skipRestore) {
      const saved = readSavedDockPos();
      if (saved) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => layoutDock(saved.l, saved.t));
        });
      }
    }

    window.addEventListener('resize', () => {
      requestAnimationFrame(clampFromResize);
    });

    let drag = null;

    handle.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
    });

    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest?.('.timer-dock__pin-btn')) return;
      if (dock.classList.contains('timer-dock--minimized')) return;
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

  setScreen('home');

  let startDockMin = false;
  try {
    startDockMin = localStorage.getItem(STORAGE_DOCK_MIN) === '1';
  } catch {
    startDockMin = false;
  }

  if (timerDock) {
    initTimerDockDrag(timerDock, { skipRestore: startDockMin });
    if (startDockMin) {
      applyTimerDockMinimized(timerDock, true, { skipStorage: true });
    }

    const minBtn = document.getElementById('timerDockMinBtn');
    const dockShell = document.getElementById('timerDockShell');
    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = !timerDock.classList.contains('timer-dock--minimized');
        applyTimerDockMinimized(timerDock, next);
      });
    }
    if (dockShell) {
      dockShell.addEventListener('click', (e) => {
        if (!timerDock.classList.contains('timer-dock--minimized')) return;
        if (e.target.closest?.('.timer-dock__pin-btn')) return;
        applyTimerDockMinimized(timerDock, false);
      });
    }
  }

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

});

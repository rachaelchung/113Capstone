/**
 * main.js
 * Entry point. Wires Timer callbacks → Game reactions,
 * and binds all button click events.
 */

document.addEventListener('DOMContentLoaded', () => {

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

  setScreen('focus');

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

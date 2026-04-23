/**
 * userAppState.js — sync game economy, habitat shop state, and creature bonds
 * to the backend (`/api/user/app-state`) when the user is logged in (JWT + api base).
 * Mirrors into localStorage as a cache for offline / same-device speed.
 */

const UserAppState = (() => {
  let _pushTimer = null;
  const PUSH_DEBOUNCE_MS = 520;
  let _remoteOk = false;

  function canSync() {
    return typeof TrackerApi !== 'undefined' && !!TrackerApi.getBaseUrl() && _hasJwt();
  }

  function _hasJwt() {
    try {
      const j = localStorage.getItem('henn_tracker_jwt');
      return !!(j && j.trim());
    } catch {
      return false;
    }
  }

  /**
   * Pull server state and hydrate Game, Store, CreatureBond. Falls back to local-only.
   * @returns {Promise<boolean>} true if server payload was applied
   */
  async function pullAndApply() {
    _remoteOk = false;
    if (!canSync()) return false;
    try {
      const data = await TrackerApi.fetchUserAppState();
      if (!data || typeof data !== 'object') return false;
      if (typeof Game !== 'undefined' && Game.applyPersistPayload) Game.applyPersistPayload(data.game || {});
      if (typeof Store !== 'undefined' && Store.applyPersistPayload) Store.applyPersistPayload(data.habitat || {});
      if (typeof CreatureBond !== 'undefined' && CreatureBond.applyPersistPayload) {
        CreatureBond.applyPersistPayload(data.bonds || {});
      }
      _remoteOk = true;
      return true;
    } catch (e) {
      console.warn('UserAppState: remote pull failed', e);
      return false;
    }
  }

  function schedulePush() {
    if (!_remoteOk || !canSync()) return;
    if (_pushTimer) clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => {
      _pushTimer = null;
      const game = typeof Game !== 'undefined' && Game.getPersistPayload ? Game.getPersistPayload() : null;
      const habitat = typeof Store !== 'undefined' && Store.getPersistPayload ? Store.getPersistPayload() : null;
      const bonds = typeof CreatureBond !== 'undefined' && CreatureBond.getPersistPayload
        ? CreatureBond.getPersistPayload()
        : null;
      if (!game || !habitat || !bonds) return;
      TrackerApi.putUserAppState({ v: 1, game, habitat, bonds }).catch((e) => {
        console.warn('UserAppState: remote save failed', e);
      });
    }, PUSH_DEBOUNCE_MS);
  }

  function usesRemoteSync() {
    return _remoteOk && canSync();
  }

  return {
    pullAndApply,
    schedulePush,
    usesRemoteSync,
    canSync,
  };
})();

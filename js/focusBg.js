/**
 * focusBg.js
 * Applies purchased focus-lane background themes to #focusArena / #focusBgLayer.
 * Depends: backgrounds.js (shop ids), Store (selection).
 */

const FocusBg = (() => {
  function _validId(id) {
    if (id === 'default') return true;
    return getFocusBackgroundShopIds().has(id);
  }

  /**
   * @param {string} id
   */
  function apply(id) {
    const arena = document.getElementById('focusArena');
    const layer = document.getElementById('focusBgLayer');
    if (!arena) return;
    const safe = _validId(id) ? id : 'default';
    arena.dataset.focusBg = safe;
    arena.classList.toggle('habitat--bg-custom', safe !== 'default');
    if (layer) {
      layer.className = `focus-bg focus-bg--${safe}`;
    }
  }

  function applyFromStore() {
    if (typeof Store === 'undefined' || !Store.getSelectedFocusBackgroundId) {
      apply('default');
      return;
    }
    apply(Store.getSelectedFocusBackgroundId());
  }

  return {
    apply,
    applyFromStore,
  };
})();

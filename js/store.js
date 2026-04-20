/**
 * store.js
 * Decoration shop (coins), countable inventory, and slot placements persisted in localStorage.
 * Depends: Game, decorations.js (getDecorationItem), Home.refreshFurnitureSlots (optional).
 */

const Store = (() => {
  const STORAGE_KEY = 'hen_habitat_decor_v1';

  /** @type {Record<string, number>} decorationId -> owned count */
  let inventory = {};

  /** @type {Record<string, string>} slotIndex string -> decorationId */
  let placements = {};

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data.inventory === 'object' && data.inventory) {
        inventory = { ...data.inventory };
      }
      if (data && typeof data.placements === 'object' && data.placements) {
        placements = { ...data.placements };
      }
    } catch {
      inventory = {};
      placements = {};
    }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ inventory, placements }));
    } catch {
      /* noop */
    }
  }

  function _uses(decId) {
    let n = 0;
    for (const k of Object.keys(placements)) {
      if (placements[k] === decId) n++;
    }
    return n;
  }

  function getInventory() {
    return { ...inventory };
  }

  function getPlacements() {
    return { ...placements };
  }

  function ownedCount(decId) {
    return Math.max(0, Math.floor(inventory[decId] || 0));
  }

  function availableToPlace(decId) {
    return Math.max(0, ownedCount(decId) - _uses(decId));
  }

  /**
   * @param {string} decId
   * @returns {boolean}
   */
  function buy(decId) {
    const item = getDecorationItem(decId);
    if (!item) return false;
    const price = item.price;
    if (!Game.trySpendCoins(price)) {
      Game.showNotif('not enough coins');
      return false;
    }
    inventory[decId] = ownedCount(decId) + 1;
    _save();
    _renderStoreList();
    Game.showNotif(`bought: ${item.label}`);
    return true;
  }

  /**
   * Clear or place a decoration on a slot. Moving between slots: clear first, then place.
   * @param {number} slotIndex
   * @param {string | null} decId
   * @returns {boolean}
   */
  function setSlotPlacement(slotIndex, decId) {
    const key = String(slotIndex);
    const oldId = placements[key] || null;

    if (decId === null || decId === '') {
      if (oldId) delete placements[key];
      _save();
      _refreshHome();
      return true;
    }

    if (oldId === decId) return true;

    const invN = ownedCount(decId);
    const need = _uses(decId) + 1;
    if (need > invN) {
      Game.showNotif('none left to place — buy more or pick up from another slot');
      return false;
    }

    placements[key] = decId;
    _save();
    _refreshHome();
    return true;
  }

  function _refreshHome() {
    if (typeof Home !== 'undefined' && Home.refreshFurnitureSlots) {
      Home.refreshFurnitureSlots();
    }
  }

  function _renderStoreList() {
    const root = document.getElementById('storeList');
    if (!root) return;
    root.innerHTML = '';

    if (!DECORATION_ITEMS.length) {
      root.innerHTML = '<p class="store-empty">no items loaded.</p>';
      return;
    }

    for (const item of DECORATION_ITEMS) {
      const row = document.createElement('div');
      row.className = 'store-row';
      const emoji = item.emoji || '📦';
      const owned = ownedCount(item.id);
      row.innerHTML = `
        <div class="store-row__icon" aria-hidden="true">${emoji}</div>
        <div class="store-row__meta">
          <div class="store-row__title">${item.label}</div>
          <div class="store-row__sub">${item.price} coins · you own <strong>${owned}</strong></div>
        </div>
        <button type="button" class="btn btn--store-buy" data-buy-dec="${item.id}">buy</button>
      `;
      const btn = row.querySelector('[data-buy-dec]');
      if (btn) {
        btn.addEventListener('click', () => buy(item.id));
      }
      root.appendChild(row);
    }
  }

  function open() {
    const overlay = document.getElementById('storeOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    overlay.classList.add('store-overlay--open');
    _renderStoreList();
    const closeBtn = document.getElementById('storeCloseBtn');
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    const overlay = document.getElementById('storeOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.classList.remove('store-overlay--open');
  }

  function isOpen() {
    const overlay = document.getElementById('storeOverlay');
    return overlay && !overlay.hidden;
  }

  function init() {
    _load();
    const overlay = document.getElementById('storeOverlay');
    const backdrop = document.getElementById('storeBackdrop');
    const closeBtn = document.getElementById('storeCloseBtn');

    if (backdrop) {
      backdrop.addEventListener('click', () => close());
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => close());
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  return {
    init,
    open,
    close,
    isOpen,
    buy,
    getInventory,
    getPlacements,
    ownedCount,
    availableToPlace,
    setSlotPlacement,
    refreshStoreList: _renderStoreList,
  };
})();

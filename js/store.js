/**
 * store.js
 * Habitat shop: decor (countable), home backgrounds, focus lane backgrounds.
 * Depends: Game, decorations.js, backgrounds.js, Home.syncBackgroundFromStore, FocusBg.applyFromStore.
 */

const Store = (() => {
  const STORAGE_KEY = 'hen_habitat_decor_v1';

  /** @type {Record<string, number>} decorationId -> owned count */
  let inventory = {};

  /** @type {Record<string, string>} slotIndex string -> decorationId */
  let placements = {};

  /** @type {Record<string, boolean>} */
  let ownedHomeBgs = { default: true };

  /** @type {Record<string, boolean>} */
  let ownedFocusBgs = { default: true };

  let homeBackgroundId = 'default';
  let focusBackgroundId = 'default';

  /** @type {'decor' | 'homeBg' | 'focusBg'} */
  let activeTab = 'decor';

  const LEDE = {
    decor: 'placeable props — each buy adds one to your inventory.',
    homeBg: 'home sky & grass — buy once, then tap use to equip.',
    focusBg: 'focus creature lane — buy once, then tap use to equip.',
  };

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
      if (data && typeof data.ownedHomeBackgrounds === 'object' && data.ownedHomeBackgrounds) {
        ownedHomeBgs = { default: true, ...data.ownedHomeBackgrounds };
      }
      if (data && typeof data.ownedFocusBackgrounds === 'object' && data.ownedFocusBackgrounds) {
        ownedFocusBgs = { default: true, ...data.ownedFocusBackgrounds };
      }
      ownedHomeBgs.default = true;
      ownedFocusBgs.default = true;

      if (typeof data.homeBackgroundId === 'string') homeBackgroundId = data.homeBackgroundId;
      if (typeof data.focusBackgroundId === 'string') focusBackgroundId = data.focusBackgroundId;
    } catch {
      inventory = {};
      placements = {};
      ownedHomeBgs = { default: true };
      ownedFocusBgs = { default: true };
      homeBackgroundId = 'default';
      focusBackgroundId = 'default';
    }
  }

  function _repairBgSelections() {
    let dirty = false;
    if (typeof getHomeBackgroundShopIds === 'function') {
      const sh = getHomeBackgroundShopIds();
      if (homeBackgroundId !== 'default' && !sh.has(homeBackgroundId)) {
        homeBackgroundId = 'default';
        dirty = true;
      }
      if (!ownedHomeBgs[homeBackgroundId]) {
        homeBackgroundId = 'default';
        dirty = true;
      }
    }
    if (typeof getFocusBackgroundShopIds === 'function') {
      const sf = getFocusBackgroundShopIds();
      if (focusBackgroundId !== 'default' && !sf.has(focusBackgroundId)) {
        focusBackgroundId = 'default';
        dirty = true;
      }
      if (!ownedFocusBgs[focusBackgroundId]) {
        focusBackgroundId = 'default';
        dirty = true;
      }
    }
    if (dirty) _save();
  }

  function _save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          inventory,
          placements,
          ownedHomeBackgrounds: ownedHomeBgs,
          ownedFocusBackgrounds: ownedFocusBgs,
          homeBackgroundId,
          focusBackgroundId,
        }),
      );
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

  function isHomeBackgroundOwned(id) {
    return id === 'default' || !!ownedHomeBgs[id];
  }

  function isFocusBackgroundOwned(id) {
    return id === 'default' || !!ownedFocusBgs[id];
  }

  function getSelectedHomeBackgroundId() {
    return homeBackgroundId;
  }

  function getSelectedFocusBackgroundId() {
    return focusBackgroundId;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function setSelectedHomeBackgroundId(id) {
    if (id !== 'default' && typeof getHomeBackgroundShopIds === 'function' && !getHomeBackgroundShopIds().has(id)) {
      return false;
    }
    if (!isHomeBackgroundOwned(id)) return false;
    homeBackgroundId = id;
    _save();
    if (typeof Home !== 'undefined' && Home.syncBackgroundFromStore) {
      Home.syncBackgroundFromStore();
    }
    return true;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function setSelectedFocusBackgroundId(id) {
    if (id !== 'default' && typeof getFocusBackgroundShopIds === 'function' && !getFocusBackgroundShopIds().has(id)) {
      return false;
    }
    if (!isFocusBackgroundOwned(id)) return false;
    focusBackgroundId = id;
    _save();
    if (typeof FocusBg !== 'undefined' && FocusBg.applyFromStore) {
      FocusBg.applyFromStore();
    }
    return true;
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
    _renderActivePanel();
    Game.showNotif(`bought: ${item.label}`);
    return true;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function buyHomeBackground(id) {
    const item = typeof getHomeBackgroundShopItem === 'function' ? getHomeBackgroundShopItem(id) : null;
    if (!item) return false;
    if (ownedHomeBgs[id]) {
      Game.showNotif('already owned — tap use to equip');
      return false;
    }
    if (!Game.trySpendCoins(item.price)) {
      Game.showNotif('not enough coins');
      return false;
    }
    ownedHomeBgs[id] = true;
    homeBackgroundId = id;
    _save();
    if (typeof Home !== 'undefined' && Home.syncBackgroundFromStore) {
      Home.syncBackgroundFromStore();
    }
    _renderActivePanel();
    Game.showNotif(`bought: ${item.label}`);
    return true;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function buyFocusBackground(id) {
    const item = typeof getFocusBackgroundShopItem === 'function' ? getFocusBackgroundShopItem(id) : null;
    if (!item) return false;
    if (ownedFocusBgs[id]) {
      Game.showNotif('already owned — tap use to equip');
      return false;
    }
    if (!Game.trySpendCoins(item.price)) {
      Game.showNotif('not enough coins');
      return false;
    }
    ownedFocusBgs[id] = true;
    focusBackgroundId = id;
    _save();
    if (typeof FocusBg !== 'undefined' && FocusBg.applyFromStore) {
      FocusBg.applyFromStore();
    }
    _renderActivePanel();
    Game.showNotif(`bought: ${item.label}`);
    return true;
  }

  /**
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

  function _setActiveTab(tab) {
    activeTab = tab;
    const tabs = document.querySelectorAll('[data-store-tab]');
    tabs.forEach((btn) => {
      const t = btn.getAttribute('data-store-tab');
      const on = t === tab;
      btn.classList.toggle('store-tab--active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const lede = document.getElementById('storeLede');
    const panel = document.getElementById('storeList');
    if (lede) lede.textContent = LEDE[tab] || LEDE.decor;
    if (panel) {
      const tabEl = document.querySelector(`[data-store-tab="${tab}"]`);
      if (tabEl && tabEl.id) panel.setAttribute('aria-labelledby', tabEl.id);
    }
    _renderActivePanel();
  }

  function _renderDecorPanel(root) {
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
      if (btn) btn.addEventListener('click', () => buy(item.id));
      root.appendChild(row);
    }
  }

  function _renderHomeBgPanel(root) {
    const rows = typeof HOME_BG_SHOP !== 'undefined' ? HOME_BG_SHOP : [];
    if (!rows.length) {
      root.innerHTML = '<p class="store-empty">no backgrounds loaded.</p>';
      return;
    }

    const defRow = document.createElement('div');
    defRow.className = 'store-row store-row--bg';
    const active = homeBackgroundId === 'default';
    defRow.innerHTML = `
      <div class="store-swatch store-swatch--default" aria-hidden="true"></div>
      <div class="store-row__meta">
        <div class="store-row__title">original meadow</div>
        <div class="store-row__sub">free · always owned</div>
      </div>
      <button type="button" class="btn btn--store-buy" data-equip-home="default" ${active ? 'disabled' : ''}>${active ? 'active' : 'use'}</button>
    `;
    const b0 = defRow.querySelector('[data-equip-home]');
    if (b0 && !active) b0.addEventListener('click', () => { setSelectedHomeBackgroundId('default'); _renderActivePanel(); });

    root.appendChild(defRow);

    for (const item of rows) {
      const owned = !!ownedHomeBgs[item.id];
      const activeBg = homeBackgroundId === item.id;
      const row = document.createElement('div');
      row.className = 'store-row store-row--bg';
      row.innerHTML = `
        <div class="store-swatch store-swatch--home-${item.id}" aria-hidden="true"></div>
        <div class="store-row__meta">
          <div class="store-row__title">${item.label}</div>
          <div class="store-row__sub">${item.price} coins${item.hint ? ` · ${item.hint}` : ''}</div>
        </div>
        <div class="store-row__actions"></div>
      `;
      const actions = row.querySelector('.store-row__actions');
      if (owned) {
        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'btn btn--store-buy';
        useBtn.textContent = activeBg ? 'active' : 'use';
        useBtn.disabled = activeBg;
        if (!activeBg) {
          useBtn.addEventListener('click', () => {
            setSelectedHomeBackgroundId(item.id);
            _renderActivePanel();
          });
        }
        actions.appendChild(useBtn);
      } else {
        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'btn btn--store-buy';
        buyBtn.textContent = 'buy';
        buyBtn.addEventListener('click', () => buyHomeBackground(item.id));
        actions.appendChild(buyBtn);
      }
      root.appendChild(row);
    }
  }

  function _renderFocusBgPanel(root) {
    const rows = typeof FOCUS_BG_SHOP !== 'undefined' ? FOCUS_BG_SHOP : [];
    if (!rows.length) {
      root.innerHTML = '<p class="store-empty">no backgrounds loaded.</p>';
      return;
    }

    const defRow = document.createElement('div');
    defRow.className = 'store-row store-row--bg';
    const active = focusBackgroundId === 'default';
    defRow.innerHTML = `
      <div class="store-swatch store-swatch--focus-default" aria-hidden="true"></div>
      <div class="store-row__meta">
        <div class="store-row__title">original lane</div>
        <div class="store-row__sub">free · always owned</div>
      </div>
      <button type="button" class="btn btn--store-buy" data-equip-focus="default" ${active ? 'disabled' : ''}>${active ? 'active' : 'use'}</button>
    `;
    const bf = defRow.querySelector('[data-equip-focus]');
    if (bf && !active) bf.addEventListener('click', () => { setSelectedFocusBackgroundId('default'); _renderActivePanel(); });
    root.appendChild(defRow);

    for (const item of rows) {
      const owned = !!ownedFocusBgs[item.id];
      const activeBg = focusBackgroundId === item.id;
      const row = document.createElement('div');
      row.className = 'store-row store-row--bg';
      row.innerHTML = `
        <div class="store-swatch store-swatch--focus-${item.id}" aria-hidden="true"></div>
        <div class="store-row__meta">
          <div class="store-row__title">${item.label}</div>
          <div class="store-row__sub">${item.price} coins${item.hint ? ` · ${item.hint}` : ''}</div>
        </div>
        <div class="store-row__actions"></div>
      `;
      const actions = row.querySelector('.store-row__actions');
      if (owned) {
        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'btn btn--store-buy';
        useBtn.textContent = activeBg ? 'active' : 'use';
        useBtn.disabled = activeBg;
        if (!activeBg) {
          useBtn.addEventListener('click', () => {
            setSelectedFocusBackgroundId(item.id);
            _renderActivePanel();
          });
        }
        actions.appendChild(useBtn);
      } else {
        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'btn btn--store-buy';
        buyBtn.textContent = 'buy';
        buyBtn.addEventListener('click', () => buyFocusBackground(item.id));
        actions.appendChild(buyBtn);
      }
      root.appendChild(row);
    }
  }

  function _renderActivePanel() {
    const root = document.getElementById('storeList');
    if (!root) return;
    root.innerHTML = '';
    if (activeTab === 'decor') _renderDecorPanel(root);
    else if (activeTab === 'homeBg') _renderHomeBgPanel(root);
    else _renderFocusBgPanel(root);
  }

  function open() {
    const overlay = document.getElementById('storeOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    overlay.classList.add('store-overlay--open');
    _setActiveTab(activeTab);
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
    _repairBgSelections();
    const backdrop = document.getElementById('storeBackdrop');
    const closeBtn = document.getElementById('storeCloseBtn');

    if (backdrop) {
      backdrop.addEventListener('click', () => close());
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => close());
    }

    document.querySelectorAll('[data-store-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-store-tab');
        if (t === 'decor' || t === 'homeBg' || t === 'focusBg') _setActiveTab(t);
      });
    });

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
    buyHomeBackground,
    buyFocusBackground,
    getInventory,
    getPlacements,
    ownedCount,
    availableToPlace,
    setSlotPlacement,
    refreshStoreList: _renderActivePanel,
    getSelectedHomeBackgroundId,
    getSelectedFocusBackgroundId,
    setSelectedHomeBackgroundId,
    setSelectedFocusBackgroundId,
    isHomeBackgroundOwned,
    isFocusBackgroundOwned,
  };
})();

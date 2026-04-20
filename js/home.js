/**
 * home.js
 * “My habitat” screen: pending catches → naming flow, resident creatures with
 * grid A* pathfinding, and extension hooks for backgrounds + furniture slots.
 *
 * Decor slots + placements: `Store` + `data/decoration.json` (slot % layout).
 */

const Home = (() => {
  /** @type {{ catchId: string, typeId: string }[]} */
  let pending = [];

  /**
   * @type {{ id: string, typeId: string, name: string, x: number, y: number,
   *          path: {x:number,y:number}[], pathIdx: number, el: HTMLElement | null }[]}
   */
  let residents = [];

  let wanderRaf = 0;
  let lastWanderTs = 0;
  let gridCols = 22;
  let gridRows = 14;
  /** row from top (0 = top); walkable when true */
  let walkable = [];
  let habitatW = 0;
  let habitatH = 0;

  /* ── extension: backgrounds (filler only for now) ───────────────────── */
  const homeConfig = {
    /** @type {string} id from HOME_BACKGROUNDS */
    backgroundId: 'default',
  };

  const HOME_BACKGROUNDS = {
    default: {
      id: 'default',
      /** Apply visuals to #homeBgLayer — swap for images / CSS vars later */
      apply(el) {
        el.className = 'home-bg home-bg--default';
        el.style.backgroundImage = '';
      },
    },
    // future: meadow: { id, apply(el) { el.className = 'home-bg home-bg--meadow'; ... } },
  };

  function getHomeBackgroundId() {
    return homeConfig.backgroundId;
  }

  function setHomeBackgroundId(id) {
    if (!HOME_BACKGROUNDS[id]) return;
    homeConfig.backgroundId = id;
    _applyHomeBackground();
  }

  function _applyHomeBackground() {
    const layer = document.getElementById('homeBgLayer');
    if (!layer) return;
    const def = HOME_BACKGROUNDS[homeConfig.backgroundId] || HOME_BACKGROUNDS.default;
    def.apply(layer);
  }

  /* ── furniture slots (ground-scattered; positions from decoration.json) ─ */

  /** @type {number | null} */
  let _decorPickSlot = null;

  /**
   * Reserved DOM + hit areas for shop / editor tooling.
   * @returns {HTMLElement[]}
   */
  function getFurnitureSlotElements() {
    return Array.from(document.querySelectorAll('[data-furniture-slot]'));
  }

  /** Future: parse slot index → blocked grid cells for pathfinding. */
  function getBlockedGridKeys() {
    return new Set();
  }

  /* ── catches from focus game ────────────────────────────────────────── */

  function _uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function notifyCatch(typeId) {
    pending.push({ catchId: _uid(), typeId });
  }

  function _defaultName(typeId) {
    const type = CREATURE_TYPES.find(t => t.id === typeId);
    const base = type ? type.label : 'friend';
    let n = 0;
    for (const r of residents) {
      if (r.typeId === typeId) n++;
    }
    return n === 0 ? base : `${base} ${n + 1}`;
  }

  function _addResident(typeId, name) {
    const id = _uid();
    const spawn = _randomWalkablePixel();
    residents.push({
      id,
      typeId,
      name,
      x: spawn.x,
      y: spawn.y,
      path: [],
      pathIdx: 0,
      el: null,
    });
    _mountResidentDOM(residents[residents.length - 1]);
    _assignNewPath(residents[residents.length - 1]);
  }

  function _mountResidentDOM(r) {
    const layer = document.getElementById('residentLayer');
    if (!layer) return;
    const type = CREATURE_TYPES.find(t => t.id === r.typeId);
    if (!type) return;

    const wrap = document.createElement('div');
    wrap.className = 'resident';
    wrap.dataset.residentId = r.id;
    wrap.innerHTML = buildCreatureSVG(type, 40);
    wrap.title = `${r.name} — tap to visit`;
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof CreatureBond !== 'undefined') CreatureBond.openForResident(r);
    });
    layer.appendChild(wrap);
    r.el = wrap;
    _positionResidentEl(r);
  }

  function _positionResidentEl(r) {
    if (!r.el) return;
    r.el.style.left = `${r.x}px`;
    r.el.style.bottom = `${r.y}px`;
  }

  function _syncAllResidentDOM() {
    const layer = document.getElementById('residentLayer');
    if (!layer) return;
    layer.innerHTML = '';
    for (const r of residents) {
      r.el = null;
      _mountResidentDOM(r);
    }
  }

  /* ── grid / pathfinding ─────────────────────────────────────────────── */

  function _rebuildWalkGrid() {
    const hab = document.getElementById('homeHabitat');
    if (!hab) return;
    habitatW = hab.clientWidth;
    habitatH = hab.clientHeight;
    if (!habitatW || !habitatH) return;

    const blocked = getBlockedGridKeys();
    const skyFrac = 0.36;
    walkable = [];
    for (let gy = 0; gy < gridRows; gy++) {
      const row = [];
      const centerYFromTop = (gy + 0.5) * (habitatH / gridRows);
      const inSky = centerYFromTop < habitatH * skyFrac;
      for (let gx = 0; gx < gridCols; gx++) {
        const key = `${gx},${gy}`;
        row.push(!inSky && !blocked.has(key));
      }
      walkable.push(row);
    }
  }

  function _pixelToGrid(x, y) {
    const cw = habitatW / gridCols;
    const ch = habitatH / gridRows;
    const gx = Math.max(0, Math.min(gridCols - 1, Math.floor(x / cw)));
    const yFromTop = habitatH - y;
    const gy = Math.max(0, Math.min(gridRows - 1, Math.floor(yFromTop / ch)));
    return { gx, gy };
  }

  function _gridToPixel(gx, gy) {
    const cw = habitatW / gridCols;
    const ch = habitatH / gridRows;
    const x = (gx + 0.5) * cw;
    const y = habitatH - (gy + 0.5) * ch;
    return { x, y };
  }

  function _randomWalkableGrid() {
    const opts = [];
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        if (walkable[gy][gx]) opts.push({ gx, gy });
      }
    }
    return opts[Math.floor(Math.random() * opts.length)] || { gx: 1, gy: gridRows - 2 };
  }

  function _randomWalkablePixel() {
    const g = _randomWalkableGrid();
    return _gridToPixel(g.gx, g.gy);
  }

  function _neighbors(gx, gy) {
    const out = [];
    const tryAdd = (x, y) => {
      if (x < 0 || y < 0 || x >= gridCols || y >= gridRows) return;
      if (!walkable[y][x]) return;
      out.push({ gx: x, gy: y });
    };
    tryAdd(gx - 1, gy);
    tryAdd(gx + 1, gy);
    tryAdd(gx, gy - 1);
    tryAdd(gx, gy + 1);
    return out;
  }

  function _bfsPath(start, goal) {
    const key = (x, y) => `${x},${y}`;
    const sk = key(start.gx, start.gy);
    const gk = key(goal.gx, goal.gy);
    const q = [{ gx: start.gx, gy: start.gy }];
    const visited = new Set([sk]);
    const parent = new Map();

    while (q.length) {
      const cur = q.shift();
      if (key(cur.gx, cur.gy) === gk) {
        const path = [];
        let node = { gx: goal.gx, gy: goal.gy };
        while (node) {
          path.push(node);
          const p = parent.get(key(node.gx, node.gy));
          node = p || null;
        }
        path.reverse();
        return path;
      }

      for (const nb of _neighbors(cur.gx, cur.gy)) {
        const nk = key(nb.gx, nb.gy);
        if (visited.has(nk)) continue;
        visited.add(nk);
        parent.set(nk, { gx: cur.gx, gy: cur.gy });
        q.push(nb);
      }
    }
    return null;
  }

  function _pathPixels(gridPath) {
    if (!gridPath || gridPath.length < 2) return [];
    const pts = [];
    for (let i = 1; i < gridPath.length; i++) {
      pts.push(_gridToPixel(gridPath[i].gx, gridPath[i].gy));
    }
    return pts;
  }

  function _assignNewPath(r) {
    _rebuildWalkGrid();
    if (!habitatW) return;

    const start = _pixelToGrid(r.x, r.y);
    if (!walkable[start.gy][start.gx]) {
      const fix = _randomWalkablePixel();
      r.x = fix.x;
      r.y = fix.y;
    }

    const goal = _randomWalkableGrid();
    const s = _pixelToGrid(r.x, r.y);
    let gridPath = _bfsPath(s, goal);

    if (!gridPath || gridPath.length < 2) {
      const nb = _neighbors(s.gx, s.gy)[0];
      if (nb) gridPath = [s, nb];
      else {
        r.path = [];
        r.pathIdx = 0;
        return;
      }
    }

    r.path = _pathPixels(gridPath);
    r.pathIdx = 0;
  }

  function _wanderStep(ts) {
    if (!lastWanderTs) lastWanderTs = ts;
    const dt = Math.min(0.05, (ts - lastWanderTs) / 1000);
    lastWanderTs = ts;

    const speed = 34;
    for (const r of residents) {
      if (!r.el) continue;
      if (!r.path.length || r.pathIdx >= r.path.length) {
        _assignNewPath(r);
        continue;
      }

      const target = r.path[r.pathIdx];
      const dx = target.x - r.x;
      const dy = target.y - r.y;
      const dist = Math.hypot(dx, dy);
      const step = speed * dt;

      if (dist < 4 || dist < step) {
        r.x = target.x;
        r.y = target.y;
        r.pathIdx++;
        if (r.pathIdx >= r.path.length) {
          _assignNewPath(r);
        }
      } else {
        r.x += (dx / dist) * step;
        r.y += (dy / dist) * step;
      }
      _positionResidentEl(r);
    }

    wanderRaf = requestAnimationFrame(_wanderStep);
  }

  function _startWander() {
    if (wanderRaf) return;
    lastWanderTs = 0;
    _rebuildWalkGrid();
    for (const r of residents) {
      if (!r.path || !r.path.length) _assignNewPath(r);
    }
    wanderRaf = requestAnimationFrame(_wanderStep);
  }

  function _stopWander() {
    if (wanderRaf) cancelAnimationFrame(wanderRaf);
    wanderRaf = 0;
    lastWanderTs = 0;
  }

  /* ── welcome / naming overlay ───────────────────────────────────────── */

  function _showWelcomeIfNeeded(done) {
    const overlay = document.getElementById('welcomeOverlay');
    const title = document.getElementById('welcomeTitle');
    const sub = document.getElementById('welcomeSub');
    const preview = document.getElementById('welcomeCreature');
    const input = document.getElementById('welcomeNameInput');
    const btnName = document.getElementById('welcomeBtnName');
    const btnSkip = document.getElementById('welcomeBtnSkip');

    if (!overlay || !title || !sub || !preview || !input || !btnName || !btnSkip) {
      done();
      return;
    }

    if (pending.length === 0) {
      done();
      return;
    }

    function finish() {
      overlay.hidden = true;
      overlay.classList.remove('welcome-overlay--open');
      input.value = '';
      input.onkeydown = null;
      btnName.onclick = null;
      btnSkip.onclick = null;
      done();
    }

    function showNext() {
      if (pending.length === 0) {
        finish();
        return;
      }

      const item = pending[0];
      const type = CREATURE_TYPES.find(t => t.id === item.typeId);
      overlay.hidden = false;
      overlay.classList.add('welcome-overlay--open');
      title.textContent = 'someone new arrived!';
      sub.textContent = type
        ? `a ${type.label} wandered in from focus time.`
        : 'a new friend is here.';
      preview.innerHTML = type ? buildCreatureSVG(type, 96) : '';
      input.value = '';
      input.placeholder = _defaultName(item.typeId);
      setTimeout(() => input.focus(), 40);

      btnName.onclick = () => {
        const raw = input.value.trim();
        const name = raw || _defaultName(item.typeId);
        _addResident(item.typeId, name);
        pending.shift();
        showNext();
      };

      btnSkip.onclick = () => {
        _addResident(item.typeId, _defaultName(item.typeId));
        pending.shift();
        showNext();
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btnName.click();
        }
      };
    }

    showNext();
  }

  /* ── lifecycle ───────────────────────────────────────────────────────── */

  function init() {
    _initFurnitureSlotPlaceholders();
    _initDecorPickUi();
    window.addEventListener('resize', () => {
      _rebuildWalkGrid();
      for (const r of residents) _assignNewPath(r);
    });
  }

  function _initDecorPickUi() {
    const overlay = document.getElementById('decorPickOverlay');
    const backdrop = document.getElementById('decorPickBackdrop');
    const cancel = document.getElementById('decorPickCancel');
    if (backdrop) backdrop.addEventListener('click', () => _closeDecorPick());
    if (cancel) cancel.addEventListener('click', () => _closeDecorPick());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && !overlay.hidden) _closeDecorPick();
    });
  }

  function _closeDecorPick() {
    const overlay = document.getElementById('decorPickOverlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('decor-pick-overlay--open');
    }
    _decorPickSlot = null;
  }

  function _openDecorPick(slotIndex) {
    if (typeof Store !== 'undefined' && Store.isOpen && Store.isOpen()) {
      Store.close();
    }
    if (typeof Store === 'undefined') return;
    const overlay = document.getElementById('decorPickOverlay');
    const sub = document.getElementById('decorPickSub');
    const list = document.getElementById('decorPickList');
    if (!overlay || !sub || !list) return;

    _decorPickSlot = slotIndex;
    const placements = Store.getPlacements();
    const current = placements[String(slotIndex)] || null;
    const curItem = current ? getDecorationItem(current) : null;

    sub.textContent = current && curItem
      ? `${curItem.label} is here — pick up or swap with something you still have free.`
      : 'choose a piece you still have available (owned minus already placed).';

    list.innerHTML = '';

    if (current) {
      const pickUp = document.createElement('button');
      pickUp.type = 'button';
      pickUp.className = 'decor-pick-option decor-pick-option--muted';
      pickUp.textContent = 'pick up (back to inventory)';
      pickUp.addEventListener('click', () => {
        Store.setSlotPlacement(slotIndex, null);
        _closeDecorPick();
      });
      list.appendChild(pickUp);
    }

    let anyChoice = !!current;

    for (const item of DECORATION_ITEMS) {
      if (item.id === current) continue;
      const avail = Store.availableToPlace(item.id);
      if (avail <= 0) continue;
      anyChoice = true;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'decor-pick-option';
      const em = item.emoji || '📦';
      btn.innerHTML = `<span class="decor-pick-emoji" aria-hidden="true">${em}</span><span class="decor-pick-label">${item.label}</span><span class="decor-pick-meta">${avail} to place</span>`;
      btn.addEventListener('click', () => {
        Store.setSlotPlacement(slotIndex, item.id);
        _closeDecorPick();
      });
      list.appendChild(btn);
    }

    if (!anyChoice) {
      const p = document.createElement('p');
      p.className = 'decor-pick-empty';
      p.textContent = 'nothing to place — open the shop and buy decor with coins.';
      list.appendChild(p);
    }

    overlay.hidden = false;
    overlay.classList.add('decor-pick-overlay--open');
  }

  function _syncSlotDomFromStore() {
    const placements = typeof Store !== 'undefined' ? Store.getPlacements() : {};
    for (const el of getFurnitureSlotElements()) {
      const idx = el.dataset.furnitureSlot;
      const decId = placements[idx] || null;
      const item = decId ? getDecorationItem(decId) : null;
      const marker = el.querySelector('.furniture-slot__marker');
      const art = el.querySelector('.furniture-slot__art');

      el.classList.toggle('furniture-slot--filled', !!item);
      el.classList.toggle('furniture-slot--empty', !item);
      el.setAttribute('aria-label', item ? `Decoration: ${item.label}. Tap to change.` : 'Empty decor spot. Tap to place.');
      el.setAttribute('aria-hidden', 'false');

      if (art) {
        art.textContent = item ? (item.emoji || '📦') : '';
        art.hidden = !item;
      }
      if (marker) marker.hidden = !!item;
    }
  }

  function refreshFurnitureSlots() {
    _syncSlotDomFromStore();
    if (typeof Store !== 'undefined') Store.refreshStoreList();
  }

  function _initFurnitureSlotPlaceholders() {
    const layer = document.getElementById('furnitureSlotLayer');
    if (!layer) return;

    const n = typeof getSlotCount === 'function' ? getSlotCount() : 6;
    const existing = layer.querySelectorAll('[data-furniture-slot]').length;
    if (existing === n && layer.dataset.initialized === '1') {
      _syncSlotDomFromStore();
      return;
    }
    layer.dataset.initialized = '1';
    layer.innerHTML = '';

    const layout = typeof getSlotLayout === 'function' ? getSlotLayout() : [];
    for (let i = 0; i < n; i++) {
      const pos = layout[i] || { left: 8 + i * 14, bottom: 10 };
      const slot = document.createElement('div');
      slot.className = 'furniture-slot furniture-slot--empty';
      slot.dataset.furnitureSlot = String(i);
      slot.style.left = `${pos.left}%`;
      slot.style.bottom = `${pos.bottom}%`;

      const marker = document.createElement('span');
      marker.className = 'furniture-slot__marker';
      marker.setAttribute('aria-hidden', 'true');

      const art = document.createElement('span');
      art.className = 'furniture-slot__art';
      art.hidden = true;

      slot.appendChild(marker);
      slot.appendChild(art);

      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        const homeScreen = document.getElementById('screen-home');
        if (!homeScreen || !homeScreen.classList.contains('screen--active')) return;
        _openDecorPick(i);
      });

      layer.appendChild(slot);
    }
    _syncSlotDomFromStore();
  }

  function enter() {
    _applyHomeBackground();
    _initFurnitureSlotPlaceholders();
    _closeDecorPick();
    _rebuildWalkGrid();
    _syncAllResidentDOM();

    _showWelcomeIfNeeded(() => {
      _startWander();
    });
  }

  function leave() {
    _closeDecorPick();
    if (typeof Store !== 'undefined' && Store.isOpen && Store.isOpen()) {
      Store.close();
    }
    if (typeof CreatureBond !== 'undefined' && CreatureBond.isOpen && CreatureBond.isOpen()) {
      CreatureBond.close();
    }
    _stopWander();
    const overlay = document.getElementById('welcomeOverlay');
    const btnName = document.getElementById('welcomeBtnName');
    const btnSkip = document.getElementById('welcomeBtnSkip');
    const input = document.getElementById('welcomeNameInput');
    if (btnName) btnName.onclick = null;
    if (btnSkip) btnSkip.onclick = null;
    if (input) input.onkeydown = null;
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('welcome-overlay--open');
    }
  }

  function getResidents() {
    return residents.slice();
  }

  function pauseResidents() {
    _stopWander();
  }

  function resumeResidents() {
    const homeScreen = document.getElementById('screen-home');
    if (homeScreen && homeScreen.classList.contains('screen--active')) {
      _startWander();
    }
  }

  return {
    init,
    enter,
    leave,
    notifyCatch,
    getResidents,
    pauseResidents,
    resumeResidents,
    getHomeBackgroundId,
    setHomeBackgroundId,
    getFurnitureSlotElements,
    HOME_BACKGROUNDS,
    refreshFurnitureSlots,
  };
})();

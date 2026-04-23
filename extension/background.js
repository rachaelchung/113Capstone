/**
 * Tracks each tab’s URL and tells that tab’s content script if it’s a “forbidden” host
 * (focus guard). Host list is stored in chrome.storage.local under `henn_forbidden_hosts`.
 */

const DEFAULT_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'twitter.com',
  'x.com',
  'www.tiktok.com',
  'twitch.tv',
  'www.twitch.tv',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'netflix.com',
  'www.netflix.com',
];

const STORAGE_KEY = 'henn_forbidden_hosts';

const AUTH_API_BASE_KEY = 'henn_extension_api_base';
const AUTH_JWT_KEY = 'henn_tracker_jwt';

function normalizeApiBase(s) {
  return String(s || '')
    .trim()
    .replace(/\/$/, '');
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    const detail = data && data.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg || d).join('; ')
      : typeof detail === 'string'
        ? detail
        : text && text.length < 400
          ? text
          : 'HTTP ' + res.status;
    throw new Error(msg);
  }
  return data;
}

/** A bare TLD or single label (e.g. "com") would otherwise match every *.com host via endsWith('.com'). */
function normalizeOneHost(raw) {
  const s = String(raw).toLowerCase().replace(/^www\./, '').trim();
  if (!s || s.includes(' ') || s.includes('/')) return null;
  if (!s.includes('.')) return null;
  return s;
}

function normalizeHostList(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const item of list) {
    const n = normalizeOneHost(item);
    if (n) out.push(n);
  }
  return out;
}

async function getHostList() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      const raw = data[STORAGE_KEY];
      if (Array.isArray(raw) && raw.length) {
        const fixed = normalizeHostList(raw) || [];
        if (fixed.length) {
          const needRewrite =
            raw.length !== fixed.length ||
            raw.some((e) => normalizeOneHost(e) == null && String(e).trim() !== '');
          if (needRewrite) {
            chrome.storage.local.set({ [STORAGE_KEY]: fixed }, () => resolve(fixed));
            return;
          }
          resolve(fixed);
          return;
        }
        const normalized = DEFAULT_HOSTS.map((h) => h.toLowerCase().replace(/^www\./, ''));
        chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_HOSTS }, () => {
          resolve(normalized);
        });
        return;
      }
      const normalized = DEFAULT_HOSTS.map((h) => h.toLowerCase().replace(/^www\./, ''));
      chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_HOSTS }, () => {
        resolve(normalized);
      });
    });
  });
}

function hostMatchesList(hostname, list) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  for (const entry of list) {
    if (!entry) continue;
    if (h === entry) return true;
    /* Suffix match only for multi-label entries; never treat "com" as matching all *.com */
    if (String(entry).indexOf('.') === -1) continue;
    if (h.endsWith(`.${entry}`)) return true;
  }
  return false;
}

function tabUrlForbidden(url, list) {
  if (!url || /^(chrome:|chrome-extension:|brave:|about:|edge:|opera:)/i.test(url)) {
    return false;
  }
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return false;
    return hostMatchesList(u.hostname, list);
  } catch {
    return false;
  }
}

async function pushForbiddenForTab(tabId, url) {
  const list = await getHostList();
  const active = tabUrlForbidden(url, list);
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'henn-forbidden', active });
  } catch {
    /* no receiver (restricted page) */
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (data) => {
    if (!data[STORAGE_KEY] || !Array.isArray(data[STORAGE_KEY])) {
      chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_HOSTS });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status && changeInfo.status !== 'complete') return;
  const url = changeInfo.url || (tab && tab.url);
  if (url) pushForbiddenForTab(tabId, url);
  else if (tab && tab.url) pushForbiddenForTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    if (tab.url) pushForbiddenForTab(tab.id, tab.url);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'henn-get-forbidden' && sender.tab && sender.tab.url) {
    getHostList()
      .then((list) => {
        const active = tabUrlForbidden(sender.tab.url, list);
        sendResponse({ active });
      })
      .catch(() => sendResponse({ active: false }));
    return true;
  }
  if (msg && msg.type === 'henn-auth-login') {
    (async () => {
      const base = normalizeApiBase(msg.apiBase);
      const ident = String(msg.emailOrUsername || '').trim();
      const password = String(msg.password || '');
      if (!base) {
        sendResponse({ ok: false, error: 'API base URL is required' });
        return;
      }
      if (!ident || !password) {
        sendResponse({ ok: false, error: 'Email/username and password are required' });
        return;
      }
      try {
        const res = await fetch(base + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_or_username: ident, password }),
        });
        const data = await parseJsonResponse(res);
        const token = data && data.token;
        if (!token || typeof token !== 'string' || !token.trim()) {
          sendResponse({ ok: false, error: 'No token in response' });
          return;
        }
        const t = token.trim();
        await chrome.storage.local.set({ [AUTH_API_BASE_KEY]: base, [AUTH_JWT_KEY]: t });
        sendResponse({ ok: true, user: data.user || null });
      } catch (e) {
        const err = e && e.message ? e.message : 'Login failed';
        sendResponse({ ok: false, error: err });
      }
    })();
    return true;
  }
  if (msg && msg.type === 'henn-auth-logout') {
    chrome.storage.local.remove([AUTH_JWT_KEY], () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg && msg.type === 'henn-auth-status') {
    chrome.storage.local.get([AUTH_JWT_KEY, AUTH_API_BASE_KEY], (d) => {
      const j = d[AUTH_JWT_KEY];
      const hasJwt = !!(j && String(j).trim());
      const apiBase = d[AUTH_API_BASE_KEY] && String(d[AUTH_API_BASE_KEY]).trim()
        ? normalizeApiBase(d[AUTH_API_BASE_KEY])
        : '';
      sendResponse({ hasJwt, apiBase });
    });
    return true;
  }
  if (msg && msg.type === 'henn-auth-test-me') {
    (async () => {
      const d = await chrome.storage.local.get([AUTH_JWT_KEY, AUTH_API_BASE_KEY]);
      const jwt = d[AUTH_JWT_KEY] && String(d[AUTH_JWT_KEY]).trim();
      const base = d[AUTH_API_BASE_KEY] && normalizeApiBase(d[AUTH_API_BASE_KEY]);
      if (!jwt) {
        sendResponse({ ok: false, error: 'No token — sign in first.' });
        return;
      }
      if (!base) {
        sendResponse({ ok: false, error: 'No API base — sign in again to save the API URL.' });
        return;
      }
      try {
        const res = await fetch(base + '/api/auth/me', {
          headers: { Authorization: 'Bearer ' + jwt },
        });
        const data = await parseJsonResponse(res);
        sendResponse({ ok: true, user: data && data.user ? data.user : null });
      } catch (e) {
        const err = e && e.message ? e.message : 'Request failed';
        sendResponse({ ok: false, error: err });
      }
    })();
    return true;
  }
  if (msg && msg.type === 'henn-auth-get-credentials') {
    chrome.storage.local.get([AUTH_JWT_KEY, AUTH_API_BASE_KEY], (d) => {
      const j = d[AUTH_JWT_KEY] && String(d[AUTH_JWT_KEY]).trim();
      const b = d[AUTH_API_BASE_KEY] && normalizeApiBase(d[AUTH_API_BASE_KEY]);
      sendResponse({ jwt: j || '', apiBase: b || '' });
    });
    return true;
  }
  if (msg && msg.type === 'henn-auth-sync-from-page' && msg.source === 'henn-content-sync') {
    const raw = String(msg.jwt || '').trim();
    const parts = raw.split('.');
    if (parts.length !== 3) {
      sendResponse({ ok: false, error: 'invalid token' });
      return true;
    }
    const apiBase = msg.apiBase && normalizeApiBase(msg.apiBase);
    const toSet = { [AUTH_JWT_KEY]: raw };
    if (apiBase) {
      toSet[AUTH_API_BASE_KEY] = apiBase;
    }
    chrome.storage.local.set(toSet, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg && msg.type === 'henn-pending-catch') {
    const typeId = String(msg.typeId || '')
      .trim()
      .slice(0, 80);
    if (!typeId) {
      sendResponse({ ok: false, error: 'missing typeId' });
      return true;
    }
    (async () => {
      const cred = await chrome.storage.local.get([AUTH_JWT_KEY, AUTH_API_BASE_KEY]);
      const jwt = cred[AUTH_JWT_KEY] && String(cred[AUTH_JWT_KEY]).trim();
      const base = cred[AUTH_API_BASE_KEY] && normalizeApiBase(cred[AUTH_API_BASE_KEY]);
      if (!jwt || !base) {
        sendResponse({ ok: false, error: 'not_signed_in' });
        return;
      }
      try {
        const resGet = await fetch(base + '/api/user/app-state', {
          headers: { Authorization: 'Bearer ' + jwt },
        });
        const data = await parseJsonResponse(resGet);
        const game = { ...(data.game && typeof data.game === 'object' ? data.game : {}) };
        const cur = Number(game.caught);
        game.caught = (Number.isFinite(cur) ? cur : 0) + 1;
        const home =
          data.home && typeof data.home === 'object' ? data.home : { pending: [], residents: [] };
        const pending = Array.isArray(home.pending) ? [...home.pending] : [];
        const catchId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        pending.push({ catchId, typeId });
        const residents = Array.isArray(home.residents) ? home.residents : [];
        const putBody = {
          v: data.v && Number.isFinite(Number(data.v)) ? Number(data.v) : 1,
          game,
          habitat: data.habitat,
          home: { pending, residents },
          bonds: data.bonds,
        };
        const resPut = await fetch(base + '/api/user/app-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
          body: JSON.stringify(putBody),
        });
        await parseJsonResponse(resPut);
        sendResponse({ ok: true });
      } catch (e) {
        const err = e && e.message ? e.message : 'sync failed';
        sendResponse({ ok: false, error: err });
      }
    })();
    return true;
  }
  return false;
});

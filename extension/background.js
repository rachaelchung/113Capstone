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
  return false;
});

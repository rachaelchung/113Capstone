/**
 * Resolves API base: local Flask first when the page may call http://localhost,
 * otherwise production URL from apiBaseConfig / meta.
 */
(function () {
  const LOCAL_CANDIDATES = ['http://127.0.0.1:8001', 'http://localhost:8001'];
  const PROBE_MS = 650;

  let cached = '';
  let inflight = null;

  function norm(s) {
    return String(s || '')
      .trim()
      .replace(/\/$/, '');
  }

  function getRemoteBase() {
    try {
      const w = typeof window.HENN_REMOTE_API_BASE === 'string' ? window.HENN_REMOTE_API_BASE.trim() : '';
      if (w) return norm(w);
    } catch {
      /* no-op */
    }
    try {
      const t = document.querySelector('meta[name="tracker-api-base"]');
      const a = document.querySelector('meta[name="api-base"]');
      const tC = t && t.getAttribute('content') && t.getAttribute('content').trim();
      const aC = a && a.getAttribute('content') && a.getAttribute('content').trim();
      if (tC) return norm(tC);
      if (aC) return norm(aC);
    } catch {
      /* no-op */
    }
    try {
      if (typeof window.TRACKER_API_BASE === 'string' && window.TRACKER_API_BASE.trim()) {
        return norm(window.TRACKER_API_BASE);
      }
    } catch {
      /* no-op */
    }
    return '';
  }

  function shouldProbeLocal() {
    try {
      if (window.location.protocol !== 'http:') return false;
      const h = (window.location.hostname || '').toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    } catch {
      return false;
    }
  }

  async function probeHealth(base) {
    const url = norm(base) + '/health';
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), PROBE_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(tid);
    }
  }

  async function resolve() {
    if (cached) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
      const remote = getRemoteBase();
      if (shouldProbeLocal()) {
        for (const b of LOCAL_CANDIDATES) {
          if (await probeHealth(b)) {
            cached = norm(b);
            inflight = null;
            return cached;
          }
        }
      }
      cached = remote;
      inflight = null;
      return cached;
    })();

    return inflight;
  }

  function resetCache() {
    cached = '';
    inflight = null;
  }

  window.HennApiResolve = {
    LOCAL_CANDIDATES,
    getRemoteBase,
    shouldProbeLocal,
    probeHealth,
    resolve,
    resetCache,
  };
})();

/**
 * Injects a single full-viewport extension iframe. Pass-through: transparent html/body
 * + pointer-events in overlay.css; the iframe is not pointer-events: none (inner UI must work).
 *
 * Page styles (e.g. on google.com) can override a bare inline `style` on injected nodes.
 * A high-specificity lock stylesheet keeps the host + iframe transparent and hittable.
 */

if (window.top !== window) {
} else {
  (function () {
    const ID = 'henn-chrome-ext-host';
    const LOCK_ID = 'henn-chrome-ext-lock';
    if (document.getElementById(ID)) return;

    if (!document.getElementById(LOCK_ID)) {
      const lock = document.createElement('style');
      lock.id = LOCK_ID;
      lock.textContent = `
#${ID} {
  position: fixed !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  z-index: 2147483000 !important;
  pointer-events: auto !important;
  background: transparent !important;
  display: block !important;
  box-sizing: border-box !important;
  opacity: 1 !important;
  transform: none !important;
  filter: none !important;
  overflow: visible !important;
  isolation: auto !important;
  mix-blend-mode: normal !important;
  contain: none !important;
}
#${ID} > iframe {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  pointer-events: auto !important;
  background: transparent !important;
  opacity: 1 !important;
  visibility: visible !important;
  color-scheme: light !important;
}
`;
      (document.head || document.documentElement).appendChild(lock);
    }

    const host = document.createElement('div');
    host.id = ID;
    /* Do not use all:initial on the host — it resets display and can break layout and
       compositing on heavy host pages. The lock stylesheet above defends against page CSS. */
    host.setAttribute(
      'style',
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:auto;z-index:2147483000;border:0;margin:0;padding:0;background:transparent;'
    );

    const frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('overlay.html');
    frame.setAttribute('title', 'head empty — focus timer');
    frame.setAttribute('allowtransparency', 'true');
    frame.setAttribute(
      'style',
      'width:100%;height:100%;border:0;margin:0;padding:0;background:transparent;pointer-events:auto;opacity:1;'
    );

    host.appendChild(frame);
    (document.documentElement || document.body).appendChild(host);

    const forwardToOverlay = (active) => {
      if (!frame.contentWindow) return;
      try {
        frame.contentWindow.postMessage(
          { source: 'henn-ext', type: 'henn-forbidden', active: !!active },
          '*'
        );
      } catch {
        /* no-op */
      }
    };

    frame.addEventListener('load', () => {
      try {
        chrome.runtime.sendMessage({ type: 'henn-get-forbidden' }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res && res.active != null) forwardToOverlay(res.active);
        });
      } catch {
        /* no-op */
      }
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'henn-forbidden') return;
      forwardToOverlay(msg.active);
    });
  })();
}

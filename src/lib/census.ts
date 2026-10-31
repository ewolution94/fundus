/**
 * Census, the self-hosted visit counter: no cookies, nothing stored on the device, and never what
 * goes into a tool. The beacon comes from our own origin (server/census.mjs forwards /_e.js and
 * /_e), so the CSP stays 'self'. It counts the page's path, so a tool's address counts as that tool.
 *
 * Production only, like the service worker.
 */
let loaded = false;

export function loadCensus() {
  if (loaded || !import.meta.env.PROD) return;
  loaded = true;
  const script = document.createElement('script');
  script.src = '/_e.js';
  document.head.append(script);
}

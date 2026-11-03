/**
 * Addresses: `/` is the home, `/<tool's path>` a tool (shared/catalog.mjs), `/licences` the
 * libraries' licences. One document serves them all (the server writes each one's title and link
 * preview into it); moving between them is the History API.
 */

import { toolByPath } from '../../shared/catalog.mjs';

export const route = $state({ path: location.pathname });

/** What each history entry keeps: the address it was opened from, and the scroll it was left at. */
interface Entry {
  from?: string;
  y?: number;
}

const entry = () => (history.state ?? {}) as Entry;

// Back and forward put the scroll back here too: the browser does it before the page is drawn again,
// and the home's wall comes a moment later, so it landed near the top. (A reload stays the browser's.)
addEventListener('popstate', () => {
  route.path = location.pathname;
  const { y } = entry();
  if (y != null) restore(y);
});

/**
 * Scrolls back to where an entry was left, as soon as the page is tall enough (a second at most, and
 * not once you scroll yourself). Timers, not frames: they run in a page that isn't being drawn too.
 */
function restore(y: number) {
  let tries = 0;
  let stop = false;
  const cancel = () => (stop = true);
  addEventListener('wheel', cancel, { once: true, passive: true });
  addEventListener('touchstart', cancel, { once: true, passive: true });
  const step = () => {
    if (!stop) scrollTo({ top: y, behavior: 'instant' });
    if (!stop && Math.abs(scrollY - y) > 1 && ++tries < 60) setTimeout(step, 16);
    else {
      removeEventListener('wheel', cancel);
      removeEventListener('touchstart', cancel);
    }
  };
  setTimeout(step);
}

/** Opens an address in the page. Each entry remembers the address it was opened from, for `home()`. */
export function go(path: string, { replace = false } = {}) {
  if (path === location.pathname) {
    scrollTo({ top: 0 });
    return;
  }
  if (replace) history.replaceState(history.state, '', path);
  else {
    history.replaceState({ ...entry(), y: scrollY }, '');
    history.pushState({ from: location.pathname } satisfies Entry, '', path);
  }
  route.path = path;
  scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * Back to all the tools: a step back when the home is the page behind, so it's where you left it;
 * the home from its top when the tool came from a link or another tool.
 */
export function home() {
  if (entry().from === '/') history.back();
  else go('/');
}

/** For `<a href>` in the app: a plain click stays in the page; a modified one opens a tab. */
export function nav(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const a = (event.currentTarget as HTMLElement).closest('a');
  if (!a || a.target === '_blank' || a.origin !== location.origin) return;
  event.preventDefault();
  go(a.pathname);
}

export const currentTool = () => toolByPath(route.path);

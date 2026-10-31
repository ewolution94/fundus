/**
 * Addresses: `/` is the home, `/<tool's path>` a tool (shared/catalog.mjs), `/licences` the
 * libraries' licences. One document serves them all (the server writes each one's title and link
 * preview into it); moving between them is the History API.
 */

import { toolByPath } from '../../shared/catalog.mjs';

export const route = $state({ path: location.pathname });

addEventListener('popstate', () => {
  route.path = location.pathname;
});

/** Opens an address in the page. */
export function go(path: string, { replace = false } = {}) {
  if (path === location.pathname) {
    scrollTo({ top: 0 });
    return;
  }
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  route.path = path;
  scrollTo({ top: 0 });
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

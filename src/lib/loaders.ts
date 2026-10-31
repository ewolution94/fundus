// Every tool's component, loaded only when it opens: one file per tool (and its libraries), so the
// home stays light. "Everything offline" in Settings calls them all once, so the service worker keeps
// every file.

import type { Component } from 'svelte';

type Loader = () => Promise<{ default: Component<any> }>;

const modules = import.meta.glob('../tools/*/Tool.svelte') as Record<string, Loader>;

export const LOADERS: Record<string, Loader> = Object.fromEntries(
  Object.entries(modules).map(([path, load]) => [path.split('/').at(-2)!, load]),
);

/** Fetches every tool's files (and pdf.js's fonts), so all of them work offline. */
export async function loadAll(onProgress?: (done: number, total: number) => void): Promise<void> {
  const loads = Object.values(LOADERS);
  let done = 0;
  for (const load of loads) {
    try {
      await load();
    } catch {}
    onProgress?.(++done, loads.length);
  }
  const { preloadPdfAssets } = await import('./pdf.ts');
  await preloadPdfAssets().catch(() => undefined);
}

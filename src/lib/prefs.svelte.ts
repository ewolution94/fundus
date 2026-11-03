// This device's language pick and the view the home opens on (the theme lives in theme.svelte.ts,
// which boot.js mirrors before first paint; the shared settings every tool reads are in
// settings.svelte.ts), and what's open right now.

export type Language = 'system' | 'en' | 'de';

interface Prefs {
  language: Language;
  /** The view the home opens on, the list or the wall of drawers (Settings, Shelves). */
  view: View;
}

export type View = 'list' | 'wall';

const KEY = 'fundus:prefs';
const DEFAULTS: Prefs = { language: 'system', view: 'list' };

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs = $state<Prefs>(load());

/**
 * What's open: the settings sheet, the search, the chip the register shows, and the home's view for
 * this visit (the switch over the tools; each visit starts on `prefs.view`).
 */
export const ui = $state({ settings: false, search: false, query: '', chip: 'all' as string, view: prefs.view });

$effect.root(() => {
  $effect(() => {
    const snapshot = JSON.stringify(prefs);
    try {
      localStorage.setItem(KEY, snapshot);
    } catch {}
  });
});

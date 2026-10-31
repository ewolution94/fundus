// This device's language pick (the theme lives in theme.svelte.ts, which boot.js mirrors before first
// paint; the shared settings every tool reads are in settings.svelte.ts), and what's open right now.

export type Language = 'system' | 'en' | 'de';

interface Prefs {
  language: Language;
}

const KEY = 'fundus:prefs';
const DEFAULTS: Prefs = { language: 'system' };

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs = $state<Prefs>(load());

/** What's open: the settings sheet, the search, the chip the register shows. */
export const ui = $state({ settings: false, search: false, query: '', chip: 'all' as string });

$effect.root(() => {
  $effect(() => {
    const snapshot = JSON.stringify(prefs);
    try {
      localStorage.setItem(KEY, snapshot);
    } catch {}
  });
});

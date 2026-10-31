/**
 * The language (the browser's until one is picked in Settings), and the strings.
 *
 * The shell's strings are in `strings/shell.ts`. Each tool keeps its own in its folder and reads
 * them through `words()`, so a tool is one folder: `const w = words({ en: {...}, de: {...} })`, then
 * `w('key', { n: 3 })` in the template, which updates when the language changes.
 */

import { themeShift } from '../../vendor/ewo/elements/theme-shift.js';
import { prefs, type Language } from './prefs.svelte.ts';
import { SHELL } from './strings/shell.ts';

export type Locale = 'en' | 'de';

/** The browser's language if it's one we have; English otherwise. */
function detect(): Locale {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0];
    if (base === 'de' || base === 'en') return base;
  }
  return 'en';
}

let system = $state<Locale>(detect());
addEventListener('languagechange', () => (system = detect()));

export function locale(): Locale {
  return prefs.language === 'system' ? system : prefs.language;
}

/** A pick in Settings: the page follows under Folio's veil (themeShift), unless the language on
 *  screen stays the same (system → the browser's own language). */
export function setLanguage(next: Language) {
  if (next === prefs.language) return;
  if ((next === 'system' ? system : next) === locale()) prefs.language = next;
  else themeShift(() => (prefs.language = next));
}

$effect.root(() => {
  $effect(() => {
    document.documentElement.lang = locale();
  });
});

type Params = Record<string, string | number>;

/** `{name}` in a string takes `params.name`. */
export function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * A tool's (or a component's) own strings. English is the reference: German may leave a key out,
 * and English shows for it. A key ending in `.one`/`.other` is a plural pair: pass `n` and the base.
 */
type PluralBase<T> = { [K in keyof T]: K extends `${infer B}.other` ? B : never }[keyof T];

export function words<const T extends Record<string, string>>(dict: { en: T; de: Partial<Record<keyof T, string>> }) {
  return (key: (keyof T & string) | PluralBase<T>, params?: Params): string => {
    const lang = locale();
    let k = key as string;
    if (params && 'n' in params && !(k in dict.en)) {
      const form = new Intl.PluralRules(lang).select(Number(params.n)) === 'one' ? 'one' : 'other';
      k = `${k}.${form}`;
    }
    const template = (dict[lang] as Record<string, string | undefined>)[k] ?? (dict.en as Record<string, string>)[k] ?? k;
    return fill(template, params);
  };
}

/** The shell's strings. */
export const t = words(SHELL);

/** A `{ en, de }` pair from the catalogue, in the current language. */
export const pick = (w: { en: string; de: string }) => w[locale()];

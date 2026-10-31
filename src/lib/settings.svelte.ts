/**
 * The shared settings: one setting per idea, read by every tool that has it (the catalogue's
 * `shared` lists which). Changing one in a tool changes it for all of them, and the Settings sheet
 * gathers them all.
 *
 * Defaults follow the device's language and region (US: Letter, imperial, US weeks; German: the
 * decimal comma). Only what someone changed is stored, so an untouched setting keeps following the
 * device, and a language switch moves the decimal mark along.
 */

import { locale } from './i18n.svelte.ts';
import { toast } from '../../vendor/ewo/elements/toaster.js';

export type PhotoFormat = 'same' | 'jpg' | 'png' | 'webp';

export interface Shared {
  /** What photo tools save. `same` keeps the original's, except HEIC and AVIF, which become JPG. */
  photoFormat: PhotoFormat;
  /** JPG and WebP quality, 0–100. */
  quality: number;
  /** Strip place, camera and time from every photo a tool saves. */
  stripLocation: boolean;
  /** Shrink a photo's target, in MB. */
  sizeTarget: number;
  pageSize: 'a4' | 'letter';
  units: 'metric' | 'imperial';
  decimal: 'comma' | 'point';
  week: 'iso' | 'us';
  /** An IANA zone, e.g. Europe/Berlin. */
  homeZone: string;
  /** `suffix` adds what was done (IMG_4127-small.jpg); `same` keeps the name. */
  names: 'suffix' | 'same';
  /** From this many files on, they're saved as one ZIP; 0 never. */
  zipFrom: number;
  passwordWords: 'en' | 'de';
  /** The developer shelf, a sixth chip. */
  dev: boolean;
  /** Fetch every tool's files once, so all of them work without a connection. */
  offline: boolean;
}

export type SharedKey = keyof Shared;

const KEY = 'fundus:shared';

function region(): string {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const r = tag?.split('-')[1];
    if (r && /^[A-Za-z]{2}$/.test(r)) return r.toUpperCase();
  }
  return '';
}

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** What each setting is when nobody changed it, from this device. */
export function defaults(): Shared {
  const us = region() === 'US';
  return {
    photoFormat: 'same',
    quality: 85,
    stripLocation: true,
    sizeTarget: 2,
    pageSize: us || region() === 'CA' ? 'letter' : 'a4',
    units: us ? 'imperial' : 'metric',
    decimal: locale() === 'de' ? 'comma' : 'point',
    week: us ? 'us' : 'iso',
    homeZone: deviceZone(),
    names: 'suffix',
    zipFrom: 5,
    passwordWords: locale(),
    dev: false,
    offline: false,
  };
}

function load(): Partial<Shared> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

const changed = $state<Partial<Shared>>(load());

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(changed));
  } catch {}
}

/** The settings as they stand: what someone changed, else the device's default. Reactive. */
export const shared: Shared = new Proxy({} as Shared, {
  get(_, key: string) {
    const own = (changed as Record<string, unknown>)[key];
    return own !== undefined ? own : (defaults() as unknown as Record<string, unknown>)[key];
  },
  set(_, key: string, value) {
    (changed as Record<string, unknown>)[key] = value;
    persist();
    return true;
  },
});

/** Whether a setting still follows the device. */
export const isDefault = (key: SharedKey) => (changed as Record<string, unknown>)[key] === undefined;

/** Back to the device's default. */
export function reset(key: SharedKey) {
  delete (changed as Record<string, unknown>)[key];
  persist();
}

/**
 * A change made inside a tool: it reaches every tool that has the setting, so a toast says so and
 * offers the way back ("Every photo tool now saves WebP · Undo").
 */
export function setShared<K extends SharedKey>(key: K, value: Shared[K], message?: string, undoLabel = 'Undo') {
  const before = (changed as Record<string, unknown>)[key];
  if (shared[key] === value) return;
  shared[key] = value;
  if (!message) return;
  toast(message, {
    duration: 5000,
    action: {
      label: undoLabel,
      run: () => {
        if (before === undefined) reset(key);
        else (shared as unknown as Record<string, unknown>)[key] = before;
      },
    },
  });
}

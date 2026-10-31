/**
 * What Fundus remembers on this device: each tool's last options, the pinned tools and the recent
 * ones. Never a file: what a tool is given lives in memory only and is gone with the tab.
 */

import { untrack } from 'svelte';

const PINS = 'fundus:pins';
const RECENTS = 'fundus:recents';
const MAX_RECENTS = 8;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/**
 * A tool's own options, kept between visits: `const o = remember('shrink', { keepPixels: false })`.
 * Values missing from what was stored (a new option) take the default; stored keys the defaults no
 * longer have are dropped. Call it once, at the top of the tool's component.
 */
export function remember<T extends Record<string, unknown>>(id: string, defaults: T): T {
  const key = `fundus:tool:${id}`;
  const stored = read<Record<string, unknown>>(key, {});
  const start = { ...defaults };
  for (const k of Object.keys(defaults)) {
    if (k in stored && typeof stored[k] === typeof defaults[k]) (start as Record<string, unknown>)[k] = stored[k];
  }
  const state = $state(start);
  $effect(() => {
    write(key, $state.snapshot(state));
  });
  return state;
}

class Yours {
  pins = $state<string[]>(read(PINS, []));
  recents = $state<string[]>(read(RECENTS, []));

  isPinned = (id: string) => this.pins.includes(id);

  togglePin(id: string) {
    this.pins = this.isPinned(id) ? this.pins.filter((p) => p !== id) : [...this.pins, id];
    write(PINS, this.pins);
  }

  /** A tool was used: it moves to the front of the recents. Untracked, so an effect can call it. */
  used(id: string) {
    const next = [id, ...untrack(() => this.recents).filter((r) => r !== id)].slice(0, MAX_RECENTS);
    this.recents = next;
    write(RECENTS, next);
  }

  /** Forget the pins and recents (Settings). */
  clear() {
    this.pins = [];
    this.recents = [];
    write(PINS, []);
    write(RECENTS, []);
  }
}

export const yours = new Yours();

/** Every tool's remembered options go (Settings). Pins and recents stay. */
export function forgetOptions() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('fundus:tool:')) localStorage.removeItem(key);
  } catch {}
}

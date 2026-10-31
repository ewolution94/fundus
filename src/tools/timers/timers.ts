// The sums of Timers: every time shown is worked out from timestamps (when a timer ends, when the
// stopwatch started), never by counting ticks, so a throttled background tab or a reload loses
// nothing. Plain TypeScript with erasable types, tested as it is.

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

/** The longest timer: 99 hours, 59 minutes, 59 seconds. */
export const MAX = 100 * HOUR - SEC;

export interface Timer {
  id: string;
  name: string;
  /** Its full length, in ms. */
  length: number;
  /** When it ends (epoch ms) while it runs; null while paused, reset or done. */
  end: number | null;
  /** What's left while paused (the full length once reset). */
  left: number;
  /** It reached zero and nobody has reset it yet. */
  done: boolean;
}

export interface Watch {
  /** When the current run started (epoch ms); null while stopped. */
  start: number | null;
  /** Time counted in the runs before. */
  before: number;
  /** The total at each lap. */
  laps: number[];
}

/**
 * A length as people type it: "5" (minutes), "1,5" (a minute and a half), "1:30" (m:ss),
 * "1:02:03" (h:mm:ss), "90s", "2 min", "1h 30m", "1 Std 30 Min". NaN for anything else, for zero
 * and for more than MAX.
 */
export function parseDuration(text: string): number {
  const t = String(text ?? '')
    .trim()
    .toLowerCase();
  if (!t) return NaN;
  let ms = NaN;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+(?:[.,]\d+)?)$/.exec(t))) ms = Number(m[1].replace(',', '.')) * MIN;
  else if ((m = /^(\d+):(\d{1,2})$/.exec(t))) ms = Number(m[2]) < 60 ? Number(m[1]) * MIN + Number(m[2]) * SEC : NaN;
  else if ((m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(t))) ms = Number(m[2]) < 60 && Number(m[3]) < 60 ? Number(m[1]) * HOUR + Number(m[2]) * MIN + Number(m[3]) * SEC : NaN;
  else {
    const unit = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|stunden?|std|minutes?|minuten?|mins?|m|seconds?|sekunden?|secs?|sek|s)(?![a-z])\s*/gy;
    let total = 0;
    let at = 0;
    let any = false;
    while ((m = unit.exec(t))) {
      const n = Number(m[1].replace(',', '.'));
      const u = m[2];
      total += n * (/^(h|hr|hrs|hour|hours|std|stunde|stunden)$/.test(u) ? HOUR : /^(s|sec|secs|second|seconds|sek|sekunde|sekunden)$/.test(u) ? SEC : MIN);
      at = unit.lastIndex;
      any = true;
    }
    if (any && at === t.length) ms = total;
  }
  ms = Math.round(ms / SEC) * SEC;
  return ms >= SEC && ms <= MAX ? ms : NaN;
}

/**
 * A countdown as a clock: "4:59", "1:02:03". Seconds round up, so a five-minute timer shows 5:00
 * at its start and 0:00 only at its end.
 */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / SEC - 1e-9));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}

/** The stopwatch: "0:05.27", "1:02:03.40". Hundredths round down (a time not yet reached). */
export function watchClock(ms: number): string {
  const cs = Math.max(0, Math.floor(ms / 10 + 1e-9));
  const h = Math.floor(cs / 360000);
  const min = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h ? `${h}:${pad(min)}` : min}:${pad(sec)}.${pad(cs % 100)}`;
}

let counter = 0;
const id = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function timer(name: string, length: number): Timer {
  return { id: id(), name, length, end: null, left: length, done: false };
}

export const running = (t: Timer) => t.end !== null;

/** Time left, in ms, at `now`. */
export const remaining = (t: Timer, now: number) => (t.end !== null ? Math.max(0, t.end - now) : t.done ? 0 : t.left);

export function start(t: Timer, now: number): Timer {
  if (t.end !== null) return t;
  const left = t.done || t.left <= 0 ? t.length : t.left;
  return { ...t, end: now + left, left, done: false };
}

export function pause(t: Timer, now: number): Timer {
  if (t.end === null) return t;
  return { ...t, end: null, left: Math.max(0, t.end - now) };
}

export const reset = (t: Timer): Timer => ({ ...t, end: null, left: t.length, done: false });

/** Whether it has just reached zero at `now`. */
export const due = (t: Timer, now: number) => t.end !== null && t.end <= now;

export const ring = (t: Timer): Timer => ({ ...t, end: null, left: 0, done: true });

/** The running timer that ends first, for the tab's title. */
export function nearest(list: Timer[], now: number): Timer | null {
  let best: Timer | null = null;
  for (const t of list) if (t.end !== null && (!best || remaining(t, now) < remaining(best, now))) best = t;
  return best;
}

/** The soonest end among the running timers, to wake up for. */
export const nextEnd = (list: Timer[]) => list.reduce<number | null>((soonest, t) => (t.end !== null && (soonest === null || t.end < soonest) ? t.end : soonest), null);

// ── The stopwatch ────────────────────────────────────────────────────────────────────────────

export const watch = (): Watch => ({ start: null, before: 0, laps: [] });

export const elapsed = (w: Watch, now: number) => w.before + (w.start !== null ? Math.max(0, now - w.start) : 0);

export const go = (w: Watch, now: number): Watch => (w.start !== null ? w : { ...w, start: now });

export const stop = (w: Watch, now: number): Watch => (w.start === null ? w : { ...w, start: null, before: elapsed(w, now) });

export const lap = (w: Watch, now: number): Watch => ({ ...w, laps: [...w.laps, elapsed(w, now)] });

export interface Lap {
  n: number;
  /** This lap's own time. */
  time: number;
  /** The total at its end. */
  total: number;
}

/** The laps, newest first, each with its own time. */
export function laps(w: Watch): Lap[] {
  return w.laps.map((total, i) => ({ n: i + 1, time: total - (i ? w.laps[i - 1] : 0), total })).reverse();
}

/** The fastest lap's number, once there are two. */
export function fastest(list: Lap[]): number | null {
  if (list.length < 2) return null;
  return list.reduce((best, l) => (l.time < best.time ? l : best)).n;
}

// ── What was kept ────────────────────────────────────────────────────────────────────────────

/** Timers as kept in localStorage, checked: anything malformed is dropped. */
export function readTimers(raw: unknown): Timer[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const t = x as Record<string, unknown>;
    const length = Number(t.length);
    if (!(length >= SEC && length <= MAX)) return [];
    const end = typeof t.end === 'number' && Number.isFinite(t.end) ? t.end : null;
    const left = Math.min(length, Math.max(0, Number(t.left) || 0));
    return [{ id: typeof t.id === 'string' ? t.id : id(), name: typeof t.name === 'string' ? t.name.slice(0, 80) : '', length, end, left, done: t.done === true }];
  });
}

export function readWatch(raw: unknown): Watch {
  if (!raw || typeof raw !== 'object') return watch();
  const w = raw as Record<string, unknown>;
  const start = typeof w.start === 'number' && Number.isFinite(w.start) ? w.start : null;
  const before = Math.max(0, Number(w.before) || 0);
  const lapList = Array.isArray(w.laps) ? w.laps.filter((l): l is number => typeof l === 'number' && Number.isFinite(l) && l >= 0) : [];
  return { start, before, laps: lapList };
}

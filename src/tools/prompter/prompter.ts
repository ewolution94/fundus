// The sums of the Teleprompter: words, how long they take at a speed, and how fast the text moves on
// the stage. The speed on screen comes from the layout: the text's measured height, divided by its
// words, times the words a second, so the reading line passes the last word when the estimate says.
// Plain TypeScript with erasable types, tested as it is.

export const MIN_WPM = 60;
export const MAX_WPM = 250;
export const DEFAULT_WPM = 140;
/** What one press of faster or slower changes. */
export const STEP_WPM = 10;

/** Words as people count them: anything between spaces with a letter or a digit in it, so a lone
 *  dash or a bullet isn't one, and "Straßen-Bahn" or "3,5" is. */
export function countWords(text: string): number {
  let n = 0;
  for (const token of String(text ?? '').split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) n++;
  return n;
}

/** A speed within what the prompter offers, in whole words a minute; the default for nonsense. */
export function clampWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return DEFAULT_WPM;
  return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(wpm)));
}

/** How long the words take at a speed, in ms. */
export function durationMs(words: number, wpm: number): number {
  if (!(words > 0)) return 0;
  return (words / clampWpm(wpm)) * 60_000;
}

/** How fast the text moves, in px a second: its height spread over its words, at the words a second. */
export function pxPerSecond(height: number, words: number, wpm: number): number {
  if (!(height > 0) || !(words > 0)) return 0;
  return (height / words) * (clampWpm(wpm) / 60);
}

/** The time still to read, in ms, at `progress` (0 at the first word, 1 past the last). */
export function timeLeftMs(progress: number, words: number, wpm: number): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return (1 - p) * durationMs(words, wpm);
}

/** A length as a clock: "2:40", "1:02:03". Seconds round up, so the last moment still shows 0:01. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** The estimate before starting, to the nearest five seconds (it's "about"), never under 0:05. */
export function estimate(words: number, wpm: number): string {
  if (!(words > 0)) return '';
  const s = Math.max(5, Math.round(durationMs(words, wpm) / 5000) * 5);
  return clock(s * 1000);
}

/** Where the text stands after a jump, kept between the first word and past the last. */
export function jump(offset: number, by: number, height: number): number {
  return Math.min(Math.max(0, height), Math.max(0, offset + by));
}

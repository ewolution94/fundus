// The maths of the hearing test and the tone generator. Plain TypeScript with erasable types,
// tested as it is.
//
// The test's tone climbs exponentially (the same number of octaves every second, the way pitch is
// heard) from 2,000 Hz to the top the device can play. Each run ends when you say it's gone; three
// runs per ear, and the median is the result, so one slip doesn't count.

export const START_HZ = 2000;
/** A quarter of an octave a second: 2 kHz to 16 kHz in 12 s. */
export const OCTAVES_PER_SECOND = 0.25;
/** Never higher than this, whatever the device. */
export const MAX_HZ = 22000;
/** How long the top is held before a run ends unheard. */
export const HOLD_S = 1.5;
export const RUNS = 3;

/** The tone's frequency `t` seconds into a run. */
export function freqAt(t: number, start = START_HZ, rate = OCTAVES_PER_SECOND): number {
  return start * 2 ** (Math.max(0, t) * rate);
}

/** When a run reaches a frequency, in seconds from its start. */
export function timeAt(hz: number, start = START_HZ, rate = OCTAVES_PER_SECOND): number {
  return Math.max(0, Math.log2(hz / start) / rate);
}

/** The highest tone a device plays cleanly: 95 % of half its sample rate, at most 22 kHz. */
export function topFor(sampleRate: number): number {
  return Math.floor(Math.min(MAX_HZ, (0.95 * sampleRate) / 2));
}

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A result as people read it: to the nearest 100 Hz. */
export const roundHz = (hz: number) => Math.round(hz / 100) * 100;

export interface Run {
  /** Where the tone was when it was gone. */
  hz: number;
  /** It reached the top unheard: the device stopped before the ears did. */
  top: boolean;
}

export interface Result {
  hz: number;
  top: boolean;
}

/** The median of three runs; it's "the top" when the median run reached it. */
export function resultOf(runs: Run[]): Result | null {
  if (runs.length < RUNS) return null;
  const hz = median(runs.map((r) => r.hz));
  const sorted = [...runs].sort((a, b) => a.hz - b.hz);
  return { hz, top: sorted[Math.floor(sorted.length / 2)].top };
}

// ── The rough guide ────────────────────────────────────────────────────────────────────────

/** The typical upper limit of hearing by age, roughly, in Hz. */
export const GUIDE = [
  { age: 'u20', lo: 17000, hi: 20000 },
  { age: '30', lo: 15000, hi: 17000 },
  { age: '40', lo: 14000, hi: 15000 },
  { age: '50', lo: 12000, hi: 12000 },
  { age: '60', lo: 10000, hi: 11000 },
  { age: '70', lo: 8000, hi: 9000 },
] as const;

export type GuideAge = (typeof GUIDE)[number]['age'];

/** The age whose typical limit is nearest a result (inside its range, else the closest edge). */
export function typicalAge(hz: number): GuideAge {
  let best: GuideAge = GUIDE[0].age;
  let gap = Infinity;
  for (const g of GUIDE) {
    const d = hz < g.lo ? g.lo - hz : hz > g.hi ? hz - g.hi : 0;
    if (d < gap) {
      gap = d;
      best = g.age;
    }
  }
  return best;
}

// ── Tones ──────────────────────────────────────────────────────────────────────────────────

export const TONE_MIN = 20;
export const TONE_MAX = 20000;
export const SLIDER_STEPS = 1000;

/** A slider position (0 … steps) to a frequency, evenly in octaves: the middle is 632 Hz. */
export function sliderToHz(x: number, steps = SLIDER_STEPS): number {
  const f = Math.min(1, Math.max(0, x / steps));
  return TONE_MIN * (TONE_MAX / TONE_MIN) ** f;
}

export function hzToSlider(hz: number, steps = SLIDER_STEPS): number {
  const f = Math.log(clampHz(hz) / TONE_MIN) / Math.log(TONE_MAX / TONE_MIN);
  return Math.round(f * steps);
}

export const clampHz = (hz: number) => Math.min(TONE_MAX, Math.max(TONE_MIN, hz));

/** A frequency as shown and typed: whole hertz, a tenth below 100. */
export const tidyHz = (hz: number) => (hz < 100 ? Math.round(hz * 10) / 10 : Math.round(hz));

export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth';

/** The gain never goes above this, at full volume. */
export const CEILING = 0.3;
/** Volume starts here (of the ceiling): low. */
export const START_VOLUME = 0.25;

/** Square and sawtooth carry much more energy than a sine at the same gain: they're turned down. */
export const WAVE_LEVEL: Record<Wave, number> = { sine: 1, triangle: 1, square: 0.45, sawtooth: 0.55 };

/** The gain for a volume (0 … 1) and a wave: never above the ceiling, never below 0. */
export function gainFor(volume: number, wave: Wave = 'sine'): number {
  const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
  return Math.min(CEILING, v * CEILING * (WAVE_LEVEL[wave] ?? 1));
}

export type Ear = 'left' | 'right' | 'both';

export const panFor = (ear: Ear) => (ear === 'left' ? -1 : ear === 'right' ? 1 : 0);

export const PRESETS = [
  { id: 'a440', hz: 440 },
  { id: 'k1', hz: 1000 },
  { id: 'mosquito', hz: 17400 },
] as const;

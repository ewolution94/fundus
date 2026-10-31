// How Make a password draws. Plain TypeScript with erasable types, tested in node.
//
// Every choice comes from crypto.getRandomValues, as whole numbers by rejection (learnings/
// randomness.md): a 32-bit word above the largest multiple of n is drawn again, so every index owns
// exactly as many words as every other, which `word % n` alone never gives. The source is a whole-
// number function the tests can replace; nothing here touches Math.random.
//
// Strong: characters from the chosen sets, each set at least once. Drawn uniformly over all such
// passwords (a draw without one of the sets is drawn again), so the entropy is exactly log2 of
// how many there are, counted by inclusion–exclusion.
// Memorable: words from a 7,776-word list (EFF's in English, dys2p's in German), log2(7776) ≈ 12.9
// bits each; a digit after a random one of them adds log2(10 × words) bits; capitals add nothing.

/** A whole number in [0, n). */
export type RandomInt = (n: number) => number;

/** A whole number in [0, n) from `next` (whole numbers in [0, range)), rejecting the uneven top. */
export function fairInt(n: number, next: () => number, range = 2 ** 32): number {
  if (!Number.isInteger(n) || n < 1 || n > range) throw new RangeError(`fairInt(${n})`);
  const limit = Math.floor(range / n) * n;
  for (;;) {
    const word = next();
    if (word < limit) return word % n;
  }
}

/** 32-bit words from the browser's (or Node's) crypto, a few at a time. */
function cryptoWords(): () => number {
  const buffer = new Uint32Array(64);
  let at = buffer.length;
  return () => {
    if (at === buffer.length) {
      crypto.getRandomValues(buffer);
      at = 0;
    }
    return buffer[at++];
  };
}

const words32 = cryptoWords();
export const cryptoInt: RandomInt = (n) => fairInt(n, words32);

// ── Strong ──────────────────────────────────────────────────────────────────────────────────

export const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  /** The ones forms and keyboards take without trouble: no quotes, backslash, spaces or brackets. */
  symbols: '!#$%&*+-.:;=?@^_~',
} as const;

export type SetName = keyof typeof SETS;
export const SET_NAMES: SetName[] = ['upper', 'lower', 'digits', 'symbols'];

/** Characters easy to mistake for one another when read or typed off a screen. */
export const LOOKALIKES = 'Il1O0';

export interface StrongOptions {
  length: number;
  sets: Record<SetName, boolean>;
  avoidLookalikes: boolean;
}

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 64;

/** The chosen sets' characters (without look-alikes when asked), each set on its own. */
export function pools(o: StrongOptions): string[] {
  return SET_NAMES.filter((s) => o.sets[s]).map((s) => [...SETS[s]].filter((ch) => !(o.avoidLookalikes && LOOKALIKES.includes(ch))).join(''));
}

export function strong(o: StrongOptions, rnd: RandomInt = cryptoInt): string {
  const p = pools(o);
  if (!p.length) throw new RangeError('No characters to draw from');
  const all = p.join('');
  const length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(o.length)));
  for (;;) {
    let out = '';
    for (let i = 0; i < length; i++) out += all[rnd(all.length)];
    if (p.every((pool) => [...out].some((ch) => pool.includes(ch)))) return out;
  }
}

/**
 * Bits of a password of `length` drawn uniformly from disjoint pools of these sizes, with every
 * pool used at least once: log2 of Σ over subsets S of (−1)^|S| (N − |S|)^length.
 */
export function poolBits(sizes: number[], length: number): number {
  const total = sizes.reduce((a, b) => a + b, 0);
  if (!total || length < sizes.length) return 0;
  let sum = 0;
  for (let mask = 0; mask < 1 << sizes.length; mask++) {
    let left = total;
    let bits = 0;
    for (let i = 0; i < sizes.length; i++) {
      if (mask & (1 << i)) {
        left -= sizes[i];
        bits++;
      }
    }
    sum += (bits % 2 ? -1 : 1) * (left / total) ** length;
  }
  return length * Math.log2(total) + Math.log2(sum);
}

export const strongBits = (o: StrongOptions) => {
  const length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(o.length)));
  return poolBits(pools(o).map((p) => p.length), length);
};

// ── Memorable ───────────────────────────────────────────────────────────────────────────────

export interface MemorableOptions {
  words: number;
  separator: string;
  capitalise: boolean;
  digit: boolean;
}

export const MIN_WORDS = 3;
export const MAX_WORDS = 8;

export function memorable(o: MemorableOptions, list: readonly string[], rnd: RandomInt = cryptoInt): string {
  if (!list.length) throw new RangeError('No words to draw from');
  const n = Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(o.words)));
  const picked = Array.from({ length: n }, () => list[rnd(list.length)]);
  const shown = o.capitalise ? picked.map((w) => w.charAt(0).toLocaleUpperCase() + w.slice(1)) : picked;
  if (o.digit) {
    const at = rnd(n);
    shown[at] += String(rnd(10));
  }
  return shown.join(o.separator);
}

export function memorableBits(o: MemorableOptions, listSize: number): number {
  const n = Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(o.words)));
  return n * Math.log2(listSize) + (o.digit ? Math.log2(10 * n) : 0);
}

/** The words in a list module: one per whitespace-separated token. */
export const wordsOf = (text: string) => text.trim().split(/\s+/);

// ── Strength ────────────────────────────────────────────────────────────────────────────────

export type Strength = 'weak' | 'fair' | 'strong' | 'very';

/**
 * In plain words. Under 50 bits a stolen password file gives it up to a fast computer; from 60 it
 * holds against that for years; from 80 it's beyond any guessing.
 */
export function strength(bits: number): Strength {
  if (bits < 50) return 'weak';
  if (bits < 64) return 'fair';
  if (bits < 80) return 'strong';
  return 'very';
}

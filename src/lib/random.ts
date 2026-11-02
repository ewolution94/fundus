// Fair draws: whole numbers from 32-bit words by rejection, never by scaling a float, and shuffles by
// Fisher–Yates on them (learnings/randomness.md). The words come from the browser's crypto; tests pass
// their own seeded source. Plain TypeScript with erasable types, so the tests run it as it is.

/** A source of uniform 32-bit words. */
export type WordSource = () => number;

export const cryptoWords: WordSource = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** A whole number in [0, n): words at or above the largest multiple of n are drawn again. */
export function fairInt(n: number, words: WordSource = cryptoWords): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`fairInt: n must be a whole number from 1 to 2^32, not ${n}`);
  const limit = Math.floor(2 ** 32 / n) * n;
  for (;;) {
    const word = words() >>> 0;
    if (word < limit) return word % n;
  }
}

/** A new array in random order (Fisher–Yates). */
export function shuffle<T>(list: readonly T[], words: WordSource = cryptoWords): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = fairInt(i + 1, words);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** k different items, in the order drawn. */
export function pick<T>(list: readonly T[], k: number, words: WordSource = cryptoWords): T[] {
  return shuffle(list, words).slice(0, Math.max(0, Math.min(k, list.length)));
}

/** A seeded word source for tests (mulberry32): the same seed, the same words. */
export function seededWords(seed: number): WordSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// How Shrink a photo finds its result: quality first, then pixels. Plain TypeScript with erasable
// types, so the tests run it with a model of an encoder instead of a canvas.
//
// At full size it searches the highest quality that lands under the target. Only when even the
// lowest acceptable quality is too big does it take pixels away, by the square root of what's left
// to lose (bytes follow the area), and searches the quality again.

export interface Try {
  /** 1 is the original size. */
  scale: number;
  /** 0–1, as the canvas takes it. */
  quality: number;
  bytes: number;
}

export type Encoder = (scale: number, quality: number) => Promise<number>;

/** Below this a JPG shows its blocks; pixels go first. */
export const MIN_QUALITY = 0.55;
export const MAX_QUALITY = 0.92;

/** The best quality at a scale that fits, or the lowest tried when none does. */
async function searchQuality(encode: Encoder, scale: number, target: number): Promise<Try> {
  let lo = MIN_QUALITY;
  let hi = MAX_QUALITY;
  const top = await encode(scale, hi);
  if (top <= target) return { scale, quality: hi, bytes: top };
  const bottom = await encode(scale, lo);
  if (bottom > target) return { scale, quality: lo, bytes: bottom };
  let best: Try = { scale, quality: lo, bytes: bottom };
  // Six halvings get within half a percent of quality: enough, and quick on a phone.
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const bytes = await encode(scale, mid);
    if (bytes <= target) {
      best = { scale, quality: mid, bytes };
      lo = mid;
    } else hi = mid;
  }
  return best;
}

/** The result under `target` bytes with the most quality and pixels; scale never below 5 %. */
export async function shrinkTo(encode: Encoder, target: number): Promise<Try> {
  let scale = 1;
  let result = await searchQuality(encode, scale, target);
  for (let round = 0; result.bytes > target && round < 8 && scale > 0.05; round++) {
    scale = Math.max(0.05, scale * Math.sqrt(target / result.bytes) * 0.97);
    result = await searchQuality(encode, scale, target);
  }
  return result;
}

/** The targets the tool offers, in MB (decimal, like upload forms). */
export const TARGETS = [0.5, 1, 2, 5];

export const targetBytes = (mb: number) => Math.round(mb * 1e6);

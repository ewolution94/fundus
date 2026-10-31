// What PDF to photos works out before it draws: which pages, at how many pixels, under which names.
// Plain TypeScript with erasable types, tested as it is.

/** The resolutions offered, in dots per inch. A PDF's unit is the point, 72 to the inch. */
export const DPIS = [72, 150, 300] as const;
export type Dpi = (typeof DPIS)[number];

/**
 * The largest canvas every browser draws: iOS Safari refuses a canvas over 16.7 million pixels
 * (4096 × 4096), and a page past it would come out blank. A bigger page is drawn smaller to fit.
 */
export const MAX_PIXELS = 4096 * 4096;

export interface PixelSize {
  width: number;
  height: number;
  /** What pdf.js draws at: 1 is 72 dpi. */
  scale: number;
  /** Drawn smaller than asked, to fit MAX_PIXELS. */
  clamped: boolean;
}

/**
 * A page's size in pixels at a resolution: points × dpi / 72, rounded (an A4 page, 595 × 842 pt, is
 * 1240 × 1754 at 150 dpi). `width` and `height` are the page as shown, its rotation applied.
 */
export function pixelSize(widthPt: number, heightPt: number, dpi: number, maxPixels = MAX_PIXELS): PixelSize {
  let scale = dpi / 72;
  let width = Math.max(1, Math.round(widthPt * scale));
  let height = Math.max(1, Math.round(heightPt * scale));
  if (width * height <= maxPixels) return { width, height, scale, clamped: false };
  scale *= Math.sqrt(maxPixels / (width * height));
  // Rounding down keeps it under the limit.
  width = Math.max(1, Math.floor(widthPt * scale));
  height = Math.max(1, Math.floor(heightPt * scale));
  return { width, height, scale, clamped: true };
}

/**
 * Page numbers as people type them: "1-3, 5", "2–4", "7-" (to the end), "-3" (from the start),
 * "3-1" (the same as 1-3). Sorted, each once, only pages that exist. `bad` when a part isn't a page
 * number or a range, or points past the last page.
 */
export function parsePages(text: string, count: number): { pages: number[]; bad: boolean } {
  const found = new Set<number>();
  let bad = false;
  // "1 - 3" is one range: the spaces around a dash go first.
  for (const part of text.replace(/\s*([-–—])\s*/g, '$1').split(/[,;\s]+/)) {
    if (!part) continue;
    const range = /^(\d*)[-–—](\d*)$/.exec(part);
    if (range && (range[1] || range[2])) {
      let from = range[1] ? Number(range[1]) : 1;
      let to = range[2] ? Number(range[2]) : count;
      if (from > to) [from, to] = [to, from];
      if (from < 1 || to > count) bad = true;
      for (let p = Math.max(1, from); p <= Math.min(count, to); p++) found.add(p);
    } else if (/^\d+$/.test(part)) {
      const p = Number(part);
      if (p >= 1 && p <= count) found.add(p);
      else bad = true;
    } else bad = true;
  }
  return { pages: [...found].sort((a, b) => a - b), bad };
}

/** [1, 2, 3, 5] → "1–3, 5": runs of three or more as a range, two as a pair. */
export function formatPages(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  return parts.join(', ');
}

/** A file name without its extension (as files.ts's `stem`, kept here so this file stands alone). */
const stem = (name: string) => (name.split(/[\\/]/).pop() ?? name).replace(/\.[^.]+$/, '') || 'file';

/**
 * A page's photo's name: letter.pdf's page 2 is letter-p2.jpg. The page number stays even with the
 * File names setting on "Keep the name" when there are several, or they'd all be called the same;
 * one page alone is then letter.jpg.
 */
export function pageName(original: string, page: number, ext: string, names: 'suffix' | 'same', several: boolean): string {
  const base = stem(original);
  return names === 'same' && !several ? `${base}.${ext}` : `${base}-p${page}.${ext}`;
}

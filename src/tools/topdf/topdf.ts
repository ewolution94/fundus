// How Photos to PDF lays each photo on its page. Plain TypeScript with erasable types, so the tests
// run it as it is. Sizes are PDF points (1/72 in), with the origin at the page's bottom left.
//
// - A page is A4 or Letter (the shared Page size), turned to suit the photo ("auto") or as chosen,
//   and the photo is fitted inside the margins, centred, up or down.
// - "Fit the photo": the page takes the photo's own shape, its long side as long as the paper's, with
//   the margin around it.
// - The photo goes in at most at 300 dpi of the size it's drawn at: more pixels than that only make the
//   PDF heavier, never sharper on paper. It's never enlarged.

import { outName } from '../../lib/files.ts';

export type Paper = 'a4' | 'letter';
export type PageChoice = Paper | 'fit';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type Margin = 'none' | 'small' | 'normal';

/** Portrait width and height in points. */
export const PAPER: Record<Paper, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export const MARGIN_MM: Record<Margin, number> = { none: 0, small: 6, normal: 15 };

export const DPI = 300;

export const mmToPt = (mm: number) => (mm / 25.4) * 72;
export const ptToMm = (pt: number) => (pt / 72) * 25.4;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  /** The page's width and height. */
  page: [number, number];
  /** Where the photo is drawn on it. */
  box: Box;
}

export function layout(photoW: number, photoH: number, choice: PageChoice, paper: Paper, orientation: Orientation, margin: Margin): Layout {
  const m = mmToPt(MARGIN_MM[margin]);
  if (choice === 'fit') {
    const long = PAPER[paper][1] - 2 * m;
    const scale = long / Math.max(photoW, photoH);
    const w = photoW * scale;
    const h = photoH * scale;
    return { page: [w + 2 * m, h + 2 * m], box: { x: m, y: m, w, h } };
  }
  let [W, H] = PAPER[choice];
  const landscape = orientation === 'landscape' || (orientation === 'auto' && photoW > photoH);
  if (landscape) [W, H] = [H, W];
  const scale = Math.min((W - 2 * m) / photoW, (H - 2 * m) / photoH);
  const w = photoW * scale;
  const h = photoH * scale;
  return { page: [W, H], box: { x: (W - w) / 2, y: (H - h) / 2, w, h } };
}

/** The pixels a photo goes in with: at most `dpi` of the size it's drawn at, never more than it has. */
export function pixelsFor(box: Box, photoW: number, photoH: number, dpi = DPI): { width: number; height: number } {
  const most = (box.w / 72) * dpi;
  const scale = Math.min(1, most / photoW);
  return { width: Math.max(1, Math.round(photoW * scale)), height: Math.max(1, Math.round(photoH * scale)) };
}

/** A copy of a list with one item moved from one place to another. */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list.slice();
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item);
  return out;
}

/** The PDF's name, after the first photo. */
export const pdfName = (first: string, names: 'suffix' | 'same') => outName(first, 'scan', 'pdf', names);

/** "297 × 210 mm" or "11 × 8.5 in" for a page. */
export function pageSize(page: [number, number], units: 'metric' | 'imperial', fmt: (n: number, max: number) => string): string {
  if (units === 'imperial') return `${fmt(page[0] / 72, 1)} × ${fmt(page[1] / 72, 1)} in`;
  return `${fmt(ptToMm(page[0]), 0)} × ${fmt(ptToMm(page[1]), 0)} mm`;
}

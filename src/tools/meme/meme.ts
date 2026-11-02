// The sums behind the meme maker: words into lines, the text's size, where each line goes. Plain
// TypeScript with erasable types and no DOM, so the tests run it with a model of a font instead of
// a canvas (`measure` says how wide a text is at a size).
//
// Everything is in the photo's own pixels. Classic: top and bottom text in upper case, centred,
// at most three lines each, starting large and shrinking until every line fits 92 % of the width
// and a block stays within about a third of the height. Caption: a white bar above the photo,
// left-aligned text, at most four lines, the bar growing with them.

/** How wide a text is at a font size, in pixels. */
export type Measure = (text: string, px: number) => number;

export type Style = 'classic' | 'caption';
export type Size = 'small' | 'medium' | 'large';

/** Medium is the size the photo gets by itself; the others scale it. */
export const SIZES: Record<Size, number> = { small: 0.75, medium: 1, large: 1.3 };

/** The share of the width a line may take. */
export const LINE_SHARE = 0.92;
/** Saved pictures are at most this long on their longer side. */
export const MAX_SIDE = 4096;

/**
 * Words into lines no wider than `max` at `px`, greedily. A typed line break always breaks; a word
 * wider than a line stands on its own (the size then shrinks until it fits).
 */
export function wrap(text: string, px: number, max: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = words[0];
    for (const word of words.slice(1)) {
      const next = `${line} ${word}`;
      if (measure(next, px) <= max) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export interface FitOptions {
  /** The largest size, where it starts. */
  start: number;
  /** It never goes below this (a text too long for it gets more lines). */
  floor: number;
  maxLines: number;
  maxWidth: number;
  /** The block's height for a size and a number of lines, and its limit. */
  height?: (px: number, lines: number) => number;
  maxHeight?: number;
  measure: Measure;
}

/** The biggest size, from `start` down in small steps, at which the text fits. */
export function fit(text: string, o: FitOptions): { px: number; lines: string[] } {
  let px = o.start;
  for (;;) {
    const lines = wrap(text, px, o.maxWidth, o.measure);
    const fits =
      lines.length <= o.maxLines &&
      lines.every((l) => o.measure(l, px) <= o.maxWidth) &&
      (o.height === undefined || o.maxHeight === undefined || o.height(px, lines.length) <= o.maxHeight);
    if (fits || px <= o.floor) return { px, lines };
    px = Math.max(o.floor, px * 0.96);
  }
}

/** A block of text: its size, its lines and each line's baseline (the lines' x is in `Layout`). */
export interface Block {
  px: number;
  lines: string[];
  baselines: number[];
}

export interface Layout {
  style: Style;
  /** The whole picture, in the photo's pixels (a caption adds its bar on top). */
  width: number;
  height: number;
  /** Where the photo goes. */
  photoY: number;
  /** Classic: the top and the bottom text; caption: its text in `top`. */
  top: Block | null;
  bottom: Block | null;
  /** Classic: the centre; caption: the left edge. */
  x: number;
}

/** What the tool measures in the font itself, as shares of the font size. */
export interface Metrics {
  /** Anton's capital height. */
  cap: number;
  /** The caption face's ascent and descent. */
  ascent: number;
  descent: number;
}

export const DEFAULT_METRICS: Metrics = { cap: 0.72, ascent: 0.95, descent: 0.25 };

/** Upper case as memes are: ß becomes SS. */
export const shout = (text: string) => text.trim().toUpperCase();

/** The outline: about an eighth of the size, drawn under the fill (so half of it shows). */
export const strokeOf = (px: number) => px / 8;

/** Classic: top and bottom text, centred, upper case. */
export function classic(width: number, height: number, top: string, bottom: string, size: Size, measure: Measure, m: Metrics = DEFAULT_METRICS): Layout {
  const scale = SIZES[size];
  const start = Math.min(width * 0.12, height * 0.15) * scale;
  const floor = Math.max(4, Math.min(width, height) * 0.015);
  const maxWidth = width * LINE_SHARE;
  // Baseline to baseline: the capitals and a little air (memes set them tight), enough for Ä and Ü.
  const gap = (px: number) => px * (m.cap + 0.26);
  const blockHeight = (px: number, n: number) => px * m.cap + (n - 1) * gap(px) + strokeOf(px);
  const maxHeight = height * Math.min(0.45, 0.3 * scale);
  const margin = height * 0.035;

  const block = (text: string, where: 'top' | 'bottom'): Block | null => {
    const t = shout(text);
    if (!t) return null;
    const { px, lines } = fit(t, { start, floor, maxLines: 3, maxWidth, height: blockHeight, maxHeight, measure });
    const half = strokeOf(px) / 2;
    const baselines =
      where === 'top'
        ? lines.map((_, i) => margin + half + px * m.cap + i * gap(px))
        : lines.map((_, i) => height - margin - half - (lines.length - 1 - i) * gap(px));
    return { px, lines, baselines };
  };

  return { style: 'classic', width, height, photoY: 0, top: block(top, 'top'), bottom: block(bottom, 'bottom'), x: width / 2 };
}

/** Caption: a white bar above the photo with the text left-aligned in it; no text, no bar. */
export function caption(width: number, height: number, text: string, size: Size, measure: Measure, m: Metrics = DEFAULT_METRICS): Layout {
  const scale = SIZES[size];
  const t = text.trim();
  const padX = width * 0.045;
  if (!t) return { style: 'caption', width, height, photoY: 0, top: null, bottom: null, x: padX };
  const start = Math.min(width * 0.06, height * 0.1) * scale;
  const floor = Math.max(4, Math.min(width, height) * 0.012);
  const { px, lines } = fit(t, { start, floor, maxLines: 4, maxWidth: width - 2 * padX, measure });
  const lineBox = px * 1.25;
  const padY = px * 0.7;
  const bar = Math.round(2 * padY + lines.length * lineBox);
  const baselines = lines.map((_, i) => padY + i * lineBox + (lineBox - (m.ascent + m.descent) * px) / 2 + m.ascent * px);
  return { style: 'caption', width, height: height + bar, photoY: bar, top: { px, lines, baselines }, bottom: null, x: padX };
}

/** The saved size: the whole picture, its longer side at most `max`. */
export function capped(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { scale, width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

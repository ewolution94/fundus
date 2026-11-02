// The sums behind the carousel slicer. Plain TypeScript with erasable types and no DOM, so the tests
// run it as it is.
//
// A strip of n tiles side by side, each in the tile's shape (4:5 by default), is fitted into the
// photo as big as it goes: when the photo is wider than the strip, its sides are cut off and the
// strip can slide sideways; when it's taller, the strip can slide up or down. Everything is in the
// photo's own pixels (upright). Each tile is saved 1080 px wide, or narrower when the photo has
// fewer pixels per tile: never scaled up.

export type Ratio = '4:5' | '1:1' | '3:4';

/** A tile's width over its height. */
export const RATIOS: Record<Ratio, number> = { '4:5': 4 / 5, '1:1': 1, '3:4': 3 / 4 };

export const MIN_TILES = 2;
export const MAX_TILES = 10;
/** What the apps show a post at. */
export const TILE_WIDTH = 1080;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Strip extends Rect {
  /** The way it can slide: sideways, up and down, or not at all (it fills the photo). */
  axis: 'x' | 'y' | null;
  /** How far it can slide, in the photo's pixels. */
  slack: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** 4/5 isn't exact in binary: a millionth of a pixel is plenty. */
const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

/** As many tiles as the photo's width holds at its full height, 2 to 10. */
export const defaultTiles = (w: number, h: number, ratio: number) => clamp(Math.round(w / (h * ratio)), MIN_TILES, MAX_TILES);

/** The strip of `n` tiles in the photo, `position` 0 to 1 along the way it can slide (0.5 the middle). */
export function strip(w: number, h: number, n: number, ratio: number, position = 0.5): Strip {
  const p = clamp(Number.isFinite(position) ? position : 0.5, 0, 1);
  const shape = n * ratio;
  const sw = tidy(h * shape);
  // Half a pixel either way is a fit.
  if (sw < w - 0.5) return { x: tidy((w - sw) * p), y: 0, w: sw, h, axis: 'x', slack: tidy(w - sw) };
  const sh = tidy(w / shape);
  if (sh < h - 0.5) return { x: 0, y: tidy((h - sh) * p), w, h: sh, axis: 'y', slack: tidy(h - sh) };
  return { x: 0, y: 0, w, h, axis: null, slack: 0 };
}

/** Each tile's part of the photo, left to right. */
export function tiles(s: Rect, n: number): Rect[] {
  const tw = s.w / n;
  return Array.from({ length: n }, (_, i) => ({ x: s.x + i * tw, y: s.y, w: tw, h: s.h }));
}

/** A saved tile's size: 1080 wide, or the photo's own pixels per tile when they're fewer. */
export function tileSize(s: Rect, n: number, ratio: number): { width: number; height: number; scaled: boolean } {
  const own = Math.floor(s.w / n + 1e-6);
  const width = Math.max(1, Math.min(TILE_WIDTH, own));
  return { width, height: Math.max(1, Math.round(width / ratio)), scaled: width < own };
}

/**
 * A tile's look in the preview without drawing it: the photo as its CSS background, sized and
 * placed so the tile's part shows (percentages, so any width works).
 */
export function backgroundFor(w: number, h: number, t: Rect): { size: string; position: string } {
  const pct = (n: number) => `${Math.round(n * 1e4) / 1e4}%`;
  const x = w - t.w > 0.5 ? (t.x / (w - t.w)) * 100 : 0;
  const y = h - t.h > 0.5 ? (t.y / (h - t.h)) * 100 : 0;
  return { size: `${pct((w / t.w) * 100)} auto`, position: `${pct(x)} ${pct(y)}` };
}

/** Saved names in order: IMG_4127-1.jpg … (the number is needed whatever the names setting says). */
export const tileName = (stem: string, i: number) => `${stem}-${i + 1}.jpg`;

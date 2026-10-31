// What Blur parts does to the pixels, and the boxes' geometry. Plain TypeScript with erasable types,
// so the tests run it as it is.
//
// Hiding has to be for good. A soft blur can be undone (deconvolution sharpens it back), and small
// pixel blocks over text can be matched back to the letters. So a box is either blacked out or
// pixelated in large blocks: each block becomes the exact average of its pixels, one flat colour, and
// what was inside it is gone from the file. Blocks are sized from the photo's long side, so they're
// as coarse on a 4K photo as on a small one, and never under 8 pixels.

export type Style = 'pixelate' | 'black';
export type BlockSize = 'small' | 'medium' | 'large';

export interface Box {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  style: Style;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A block's side as a share of the photo's long side. */
export const BLOCK_SHARE: Record<BlockSize, number> = { small: 1 / 90, medium: 1 / 55, large: 1 / 32 };
export const MIN_BLOCK = 8;

/** A block's side in the photo's pixels. */
export function blockPx(imgW: number, imgH: number, size: BlockSize): number {
  return Math.max(MIN_BLOCK, Math.round(Math.max(imgW, imgH) * BLOCK_SHARE[size]));
}

/**
 * Every `block` × `block` square of an RGBA buffer (a region's ImageData, `width` × `height`) turned
 * into its own average, alpha included; the squares start at the buffer's top left, and those at the
 * right and bottom edges are as big as what's left.
 */
export function pixelate(data: Uint8ClampedArray, width: number, height: number, block: number): void {
  const b = Math.max(1, Math.round(block));
  for (let by = 0; by < height; by += b) {
    const bh = Math.min(b, height - by);
    for (let bx = 0; bx < width; bx += b) {
      const bw = Math.min(b, width - bx);
      let r = 0;
      let g = 0;
      let bl = 0;
      let a = 0;
      for (let y = by; y < by + bh; y++) {
        let i = (y * width + bx) * 4;
        for (let x = 0; x < bw; x++, i += 4) {
          r += data[i];
          g += data[i + 1];
          bl += data[i + 2];
          a += data[i + 3];
        }
      }
      const n = bw * bh;
      const rr = Math.round(r / n);
      const gg = Math.round(g / n);
      const bb = Math.round(bl / n);
      const aa = Math.round(a / n);
      for (let y = by; y < by + bh; y++) {
        let i = (y * width + bx) * 4;
        for (let x = 0; x < bw; x++, i += 4) {
          data[i] = rr;
          data[i + 1] = gg;
          data[i + 2] = bb;
          data[i + 3] = aa;
        }
      }
    }
  }
}

/** The box's pixels, widened to whole pixels so nothing at its edge is left half-covered. */
export function region(box: Region, imgW: number, imgH: number, scale = 1): Region {
  const x = Math.max(0, Math.floor(box.x * scale));
  const y = Math.max(0, Math.floor(box.y * scale));
  const right = Math.min(Math.round(imgW * scale), Math.ceil((box.x + box.w) * scale));
  const bottom = Math.min(Math.round(imgH * scale), Math.ceil((box.y + box.h) * scale));
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A box drawn from one corner to the other, in any direction, inside the photo. */
export function fromCorners(ax: number, ay: number, bx: number, by: number, imgW: number, imgH: number): Region {
  const x1 = clamp(Math.min(ax, bx), 0, imgW);
  const y1 = clamp(Math.min(ay, by), 0, imgH);
  const x2 = clamp(Math.max(ax, bx), 0, imgW);
  const y2 = clamp(Math.max(ay, by), 0, imgH);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** A box moved, stopped at the photo's edges. */
export function moveBox<T extends Region>(b: T, dx: number, dy: number, imgW: number, imgH: number): T {
  return { ...b, x: clamp(b.x + dx, 0, Math.max(0, imgW - b.w)), y: clamp(b.y + dy, 0, Math.max(0, imgH - b.h)) };
}

export type Corner = 'nw' | 'ne' | 'se' | 'sw';

/** A box resized from a corner, the opposite corner staying, never smaller than `min` or outside. */
export function resizeBox<T extends Region>(b: T, corner: Corner, dx: number, dy: number, imgW: number, imgH: number, min: number): T {
  const right = b.x + b.w;
  const bottom = b.y + b.h;
  const mw = Math.min(min, imgW);
  const mh = Math.min(min, imgH);
  const l = corner.includes('w') ? clamp(b.x + dx, 0, right - mw) : b.x;
  const r = corner.includes('e') ? clamp(right + dx, b.x + mw, imgW) : right;
  const t = corner.includes('n') ? clamp(b.y + dy, 0, bottom - mh) : b.y;
  const bo = corner.includes('s') ? clamp(bottom + dy, b.y + mh, imgH) : bottom;
  return { ...b, x: l, y: t, w: r - l, h: bo - t };
}

/** A new box in the middle, a fifth of the photo each way: for the "Add a box" button. */
export function middleBox(imgW: number, imgH: number): Region {
  const w = imgW / 5;
  const h = imgH / 5;
  return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
}

/** What the result depends on, as one string (boxes rounded to whole pixels). */
export function boxesKey(boxes: Box[]): string {
  return boxes.map((b) => `${b.style[0]}${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)}`).join(';');
}

// The sums behind Resize & crop. Plain TypeScript with erasable types, so the tests run it as it is.
//
// Everything is in the photo's own pixels (upright), with the origin at its top left. The crop frame
// is moved and resized from a snapshot taken when the finger or the mouse went down plus the whole way
// it has travelled since (never added up move by move, so it can't drift), and it never leaves the
// photo. A frame with a shape (1:1, 16:9 …) keeps it while it's dragged: a corner pulls against the
// opposite corner, an edge against the middle of the other.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export type PresetId = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | 'profile';

export interface Preset {
  id: PresetId;
  /** Width over height; null for free. */
  ratio: number | null;
  /** The result's size, square, when the preset names one. */
  size?: number;
  /** Whether "Turn" (portrait) applies. */
  turns?: boolean;
}

export const PRESETS: Preset[] = [
  { id: 'free', ratio: null },
  { id: '1:1', ratio: 1 },
  { id: '4:3', ratio: 4 / 3, turns: true },
  { id: '3:2', ratio: 3 / 2, turns: true },
  { id: '16:9', ratio: 16 / 9 },
  { id: '9:16', ratio: 9 / 16 },
  { id: 'profile', ratio: 1, size: 800 },
];

export const preset = (id: PresetId) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/** The preset's shape, turned upright (3:4, 2:3) when asked and it turns. */
export function ratioOf(id: PresetId, turned: boolean): number | null {
  const p = preset(id);
  if (p.ratio === null) return null;
  return turned && p.turns ? 1 / p.ratio : p.ratio;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The biggest frame of a shape that fits the photo, in its middle (the whole photo for free). */
export function centred(imgW: number, imgH: number, ratio: number | null): Rect {
  if (ratio === null) return { x: 0, y: 0, w: imgW, h: imgH };
  let w = imgW;
  let h = w / ratio;
  if (h > imgH) {
    h = imgH;
    w = h * ratio;
  }
  return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
}

/** A new shape for a frame: as big as fits around the old frame's middle, then pushed inside. */
export function reshape(r: Rect, imgW: number, imgH: number, ratio: number | null): Rect {
  if (ratio === null) return { ...r };
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  // Keep about the old frame's area, as far as the photo allows.
  const area = Math.max(r.w * r.h, 1);
  let w = Math.sqrt(area * ratio);
  let h = w / ratio;
  const fitScale = Math.min(1, imgW / w, imgH / h);
  w *= fitScale;
  h *= fitScale;
  return { x: clamp(cx - w / 2, 0, imgW - w), y: clamp(cy - h / 2, 0, imgH - h), w, h };
}

/** The frame moved by (dx, dy), stopped at the photo's edges. */
export function moveRect(r: Rect, dx: number, dy: number, imgW: number, imgH: number): Rect {
  return { x: clamp(r.x + dx, 0, Math.max(0, imgW - r.w)), y: clamp(r.y + dy, 0, Math.max(0, imgH - r.h)), w: r.w, h: r.h };
}

/**
 * The frame resized by dragging a handle by (dx, dy), from the frame as it was when the drag began.
 * With a ratio the shape holds; nothing gets smaller than `min` a side or leaves the photo.
 */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, imgW: number, imgH: number, ratio: number | null, min: number): Rect {
  const left = r.x;
  const top = r.y;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');

  if (ratio === null) {
    const mw = Math.min(min, imgW);
    const mh = Math.min(min, imgH);
    const l = west ? clamp(left + dx, 0, right - mw) : left;
    const rr = east ? clamp(right + dx, left + mw, imgW) : right;
    const t = north ? clamp(top + dy, 0, bottom - mh) : top;
    const b = south ? clamp(bottom + dy, top + mh, imgH) : bottom;
    return { x: l, y: t, w: rr - l, h: b - t };
  }

  const minW = Math.min(min * Math.max(1, ratio), imgW, imgH * ratio);
  if ((west || east) && (north || south)) {
    // A corner: the opposite corner stays; the size follows whichever way the pointer went further.
    const wantW = r.w + (east ? dx : -dx);
    const wantH = r.h + (south ? dy : -dy);
    const roomW = east ? imgW - left : right;
    const roomH = south ? imgH - top : bottom;
    const w = clamp(Math.max(wantW, wantH * ratio), minW, Math.min(roomW, roomH * ratio));
    const h = w / ratio;
    return { x: east ? left : right - w, y: south ? top : bottom - h, w, h };
  }
  if (west || east) {
    // A side: the other side stays, the height grows about the middle.
    const cy = top + r.h / 2;
    const wantW = r.w + (east ? dx : -dx);
    const roomW = east ? imgW - left : right;
    const roomH = 2 * Math.min(cy, imgH - cy);
    const w = clamp(wantW, minW, Math.min(roomW, roomH * ratio));
    const h = w / ratio;
    return { x: east ? left : right - w, y: cy - h / 2, w, h };
  }
  const cx = left + r.w / 2;
  const wantH = r.h + (south ? dy : -dy);
  const roomH = south ? imgH - top : bottom;
  const roomW = 2 * Math.min(cx, imgW - cx);
  const h = clamp(wantH, minW / ratio, Math.min(roomH, roomW / ratio));
  const w = h * ratio;
  return { x: cx - w / 2, y: south ? top : bottom - h, w, h };
}

/** The frame in whole pixels, inside the photo, its shape exact where whole pixels allow. */
export function snap(r: Rect, imgW: number, imgH: number, ratio: number | null): Rect {
  let w = clamp(Math.round(r.w), 1, imgW);
  let h = ratio === null ? clamp(Math.round(r.h), 1, imgH) : Math.round(w / ratio);
  if (h > imgH) {
    h = imgH;
    w = Math.round(h * (ratio ?? w / h));
  }
  h = Math.max(1, h);
  const x = clamp(Math.round(r.x), 0, imgW - w);
  const y = clamp(Math.round(r.y), 0, imgH - h);
  return { x, y, w, h };
}

/** Phones draw at most this many pixels on a canvas (iOS: 4096 × 4096), and no side longer than this. */
export const MAX_AREA = 16_777_216;
export const MAX_SIDE = 16_384;

/** A size brought down, shape kept, to what every browser can draw. */
export function capped(w: number, h: number): { width: number; height: number; capped: boolean } {
  const scale = Math.min(1, Math.sqrt(MAX_AREA / (w * h)), MAX_SIDE / w, MAX_SIDE / h);
  if (scale >= 1) return { width: Math.round(w), height: Math.round(h), capped: false };
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), capped: true };
}

/** The other side of a size that keeps a photo's shape. */
export const heightFor = (width: number, imgW: number, imgH: number) => Math.max(1, Math.round((width * imgH) / imgW));
export const widthFor = (height: number, imgW: number, imgH: number) => Math.max(1, Math.round((height * imgW) / imgH));

/**
 * The size a photo becomes in "Size": inside W × H, its shape kept (several photos of different
 * shapes all fit the same box), or exactly W × H when the shape isn't kept.
 */
export function sized(imgW: number, imgH: number, W: number, H: number, keepShape: boolean): { width: number; height: number } {
  if (!keepShape) return { width: Math.round(W), height: Math.round(H) };
  const scale = Math.min(W / imgW, H / imgH);
  return { width: Math.max(1, Math.round(imgW * scale)), height: Math.max(1, Math.round(imgH * scale)) };
}

/** What a cropped photo becomes: the frame's pixels, or the preset's square (never enlarged). */
export function cropOutput(frame: Rect, id: PresetId): { width: number; height: number } {
  const size = preset(id).size;
  if (size && frame.w > size) return { width: size, height: size };
  return { width: frame.w, height: frame.h };
}

/** A size on paper at 300 dpi: centimetres or inches, one decimal. */
export function printSize(width: number, height: number, units: 'metric' | 'imperial', dpi = 300): { w: number; h: number; unit: 'cm' | 'in' } {
  const f = units === 'imperial' ? 1 / dpi : 2.54 / dpi;
  const round = (n: number) => Math.round(n * f * 10) / 10;
  return { w: round(width), h: round(height), unit: units === 'imperial' ? 'in' : 'cm' };
}

/** The MIME type a photo is saved as (the shared Photo format; WebP only where the browser writes it). */
export function outType(kind: string, setting: 'same' | 'jpg' | 'png' | 'webp', webpOk: boolean): string {
  let type = setting === 'jpg' ? 'image/jpeg' : setting === 'png' ? 'image/png' : setting === 'webp' ? 'image/webp' : kind === 'png' ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/jpeg';
  if (type === 'image/webp' && !webpOk) type = 'image/jpeg';
  return type;
}

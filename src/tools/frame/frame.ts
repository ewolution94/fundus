// The sums behind Screenshot frame: where the screenshot, its browser window or phone, and the
// ground go, and the colours a ground is made of. Plain TypeScript with erasable types and no DOM,
// so the tests run it as it is.
//
// Everything is in output pixels. The screenshot keeps its own pixels (scale 1) unless the whole
// picture would be longer than 8000 px on a side, or bigger than the browser can draw (`maxArea`,
// which the tool only sets after a canvas that size failed). Padding is a share of the screenshot's
// shorter side; corners a share of its width; a shaped picture (16:9, 1:1, 4:5) is the smallest of
// that shape that holds the screenshot with its padding, which then grows on the long side.

export type Pad = 'small' | 'medium' | 'large';
export type Corners = 'none' | 'small' | 'medium' | 'large';
export type Shadow = 'none' | 'soft' | 'strong';
export type Device = 'none' | 'browser' | 'phone';
export type Shape = 'as-is' | '16:9' | '1:1' | '4:5';

export const PAD: Record<Pad, number> = { small: 0.06, medium: 0.1, large: 0.16 };
export const CORNERS: Record<Corners, number> = { none: 0, small: 0.015, medium: 0.03, large: 0.05 };
/** Width over height; null keeps the screenshot's own shape. */
export const SHAPES: Record<Shape, number | null> = { 'as-is': null, '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5 };
export const MAX_SIDE = 8000;
/** What iPhones draw at most (4096 × 4096): the fallback when a bigger canvas fails. */
export const SAFE_AREA = 4096 * 4096;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Top left, top right, bottom right, bottom left. */
export type Radii = [number, number, number, number];

export interface Dot {
  x: number;
  y: number;
  r: number;
}

export interface Bar {
  rect: Rect;
  radii: Radii;
  dots: Dot[];
  /** The address field. */
  pill: Rect;
}

export interface Layout {
  width: number;
  height: number;
  /** 1 keeps the screenshot's own pixels. */
  scale: number;
  /** What casts the shadow: the screenshot, the browser window or the phone. */
  body: Rect;
  bodyRadii: Radii;
  shot: Rect;
  shotRadii: Radii;
  bar: Bar | null;
  /** The phone's rim around the screen; 0 without one. */
  bezel: number;
  shadow: { blur: number; offsetY: number; alpha: number } | null;
}

export interface Options {
  pad: Pad;
  corners: Corners;
  shadow: Shadow;
  device: Device;
  shape: Shape;
}

const all = (r: number): Radii => [r, r, r, r];

/** The picture's layout for a screenshot `w` × `h`. */
export function layout(w: number, h: number, o: Options, limits: { maxSide?: number; maxArea?: number } = {}): Layout {
  const maxSide = limits.maxSide ?? MAX_SIDE;
  const maxArea = limits.maxArea ?? Infinity;
  const pad = Math.round(Math.min(w, h) * PAD[o.pad]);
  const r = Math.round(w * CORNERS[o.corners]);
  const bezel = o.device === 'phone' ? Math.max(6, Math.round(w * 0.03)) : 0;
  const barH = o.device === 'browser' ? Math.max(24, Math.round(w * 0.045)) : 0;

  const bw = w + 2 * bezel;
  const bh = h + 2 * bezel + barH;
  let W = bw + 2 * pad;
  let H = bh + 2 * pad;
  const ratio = SHAPES[o.shape];
  if (ratio) {
    if (W / H < ratio) W = Math.round(H * ratio);
    else H = Math.round(W / ratio);
  }
  const bx = Math.floor((W - bw) / 2);
  const by = Math.floor((H - bh) / 2);

  let body: Rect = { x: bx, y: by, w: bw, h: bh };
  let shot: Rect = { x: bx + bezel, y: by + bezel + barH, w, h };
  let bodyRadii: Radii;
  let shotRadii: Radii;
  let bar: Bar | null = null;
  if (o.device === 'phone') {
    bodyRadii = all(r + bezel);
    shotRadii = all(r);
  } else if (o.device === 'browser') {
    const top = Math.min(r, barH);
    bodyRadii = [top, top, r, r];
    shotRadii = [0, 0, r, r];
    const dotR = barH * 0.11;
    const cy = by + barH / 2;
    const dots = [0, 1, 2].map((i) => ({ x: bx + barH * 0.55 + i * barH * 0.36, y: cy, r: dotR }));
    const pillH = barH * 0.5;
    const left = dots[2].x + dotR + barH * 0.5;
    const right = bx + bw - barH * 0.55;
    let pw = Math.min(bw * 0.56, right - left);
    const px = Math.max(left, bx + (bw - pw) / 2);
    pw = Math.max(0, Math.min(pw, right - px));
    bar = { rect: { x: bx, y: by, w: bw, h: barH }, radii: [top, top, 0, 0], dots, pill: { x: px, y: cy - pillH / 2, w: pw, h: pillH } };
  } else {
    bodyRadii = all(r);
    shotRadii = all(r);
  }
  const shadow =
    o.shadow === 'none' ? null : o.shadow === 'soft' ? { blur: pad * 0.5, offsetY: pad * 0.12, alpha: 0.22 } : { blur: pad * 0.7, offsetY: pad * 0.22, alpha: 0.42 };

  const scale = Math.min(1, maxSide / Math.max(W, H), Math.sqrt(maxArea / (W * H)));
  if (scale === 1) return { width: W, height: H, scale, body, bodyRadii, shot, shotRadii, bar, bezel, shadow };
  const s = (n: number) => n * scale;
  const rect = (q: Rect): Rect => ({ x: s(q.x), y: s(q.y), w: s(q.w), h: s(q.h) });
  const radii = (q: Radii): Radii => q.map(s) as Radii;
  body = rect(body);
  shot = rect(shot);
  return {
    width: Math.max(1, Math.floor(W * scale)),
    height: Math.max(1, Math.floor(H * scale)),
    scale,
    body,
    bodyRadii: radii(bodyRadii),
    shot,
    shotRadii: radii(shotRadii),
    bar: bar && { rect: rect(bar.rect), radii: radii(bar.radii), dots: bar.dots.map((d) => ({ x: s(d.x), y: s(d.y), r: s(d.r) })), pill: rect(bar.pill) },
    bezel: s(bezel),
    shadow: shadow && { blur: s(shadow.blur), offsetY: s(shadow.offsetY), alpha: shadow.alpha },
  };
}

// ── Grounds ──

export type GroundId = 'paper' | 'ink' | 'highlighter' | 'dusk' | 'sea' | 'mint' | 'picture' | 'colour' | 'none';

/** Six gradients, from the top left to the bottom right. */
export const GRADIENTS: { id: GroundId; from: string; to: string }[] = [
  { id: 'paper', from: '#f7f4ec', to: '#dcd4c2' },
  { id: 'ink', from: '#3b3b39', to: '#0c0c0c' },
  { id: 'highlighter', from: '#fff7b8', to: '#ffd500' },
  { id: 'dusk', from: '#ffb59c', to: '#6c5bd4' },
  { id: 'sea', from: '#62d4e2', to: '#1d4b9b' },
  { id: 'mint', from: '#e2faee', to: '#3bbd8b' },
];

/** A ground as it's painted: two colours (the same twice for one), across or down; null for none. */
export interface Paint {
  from: string;
  to: string;
  /** Down the picture (its own edges), else from the top left to the bottom right. */
  vertical: boolean;
}

export type RGB = [number, number, number];

export const hex = ([r, g, b]: RGB) => `#${[r, g, b].map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')).join('')}`;

export function rgbOf(colour: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(colour.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB relative luminance, 0 (black) to 1 (white). */
export function luminance(colour: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgbOf(colour);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Whether a ground reads as light: its colours' mean luminance past mid-grey (0.18 is about L* 50). */
export const isLight = (p: Paint | null) => !p || (luminance(p.from) + luminance(p.to)) / 2 > 0.18;

/**
 * The median colour (each channel's median) of the pixels from `from` to `to` in RGBA data; null
 * when they're all see-through.
 */
export function medianColour(data: ArrayLike<number>, from = 0, to = data.length / 4): RGB | null {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let p = from; p < to; p++) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  }
  if (!rs.length) return null;
  const mid = (a: number[]) => {
    a.sort((x, y) => x - y);
    const k = a.length >> 1;
    return a.length % 2 ? a[k] : Math.round((a[k - 1] + a[k]) / 2);
  };
  return [mid(rs), mid(gs), mid(bs)];
}

/** The median colours of a picture's top and bottom `rows` rows (RGBA, `width` wide). */
export function edgeColours(data: ArrayLike<number>, width: number, height: number, rows = 2): { top: RGB | null; bottom: RGB | null } {
  const n = Math.max(1, Math.min(rows, height));
  return { top: medianColour(data, 0, n * width), bottom: medianColour(data, (height - n) * width, height * width) };
}

/** The ground to paint for a choice; the picture's own edges fall back to Paper when see-through. */
export function groundPaint(id: GroundId, edges: { top: RGB | null; bottom: RGB | null } | null, colour: string): Paint | null {
  if (id === 'none') return null;
  if (id === 'colour') {
    const c = /^#[0-9a-f]{6}$/i.test(colour) ? colour.toLowerCase() : '#ffffff';
    return { from: c, to: c, vertical: false };
  }
  if (id === 'picture') {
    const top = edges?.top ?? edges?.bottom;
    const bottom = edges?.bottom ?? edges?.top;
    if (top && bottom) return { from: hex(top), to: hex(bottom), vertical: true };
    id = 'paper';
  }
  const g = GRADIENTS.find((x) => x.id === id) ?? GRADIENTS[0];
  return { from: g.from, to: g.to, vertical: false };
}

/** The browser bar's greys: light on a light ground, dark on a dark one; no colours of anyone's. */
export function chrome(light: boolean) {
  return light ? { bar: '#e9e9e6', dot: '#c2c2bd', pill: '#ffffff' } : { bar: '#2a2a29', dot: '#5c5c58', pill: '#3c3c3a' };
}

export const PHONE = { body: '#141414', rim: '#3a3a38', lens: '#262625' };

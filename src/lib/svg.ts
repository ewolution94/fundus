/**
 * SVG in, pixels out: how big an SVG is, the text that draws it sharp at another size, and the
 * drawing itself. Reading and rewriting are string work with erasable types and no DOM, so node
 * tests them; `paintSvg()` and `drawSvg()` need a browser.
 *
 * What browsers do with an SVG as a picture (measured in Chromium and WebKit, 2026-11-01):
 * - As an <img> from a blob URL it draws onto a canvas, and the canvas still exports.
 * - One with <foreignObject> taints the canvas (toBlob throws a SecurityError): refused up front.
 * - One with only a viewBox reports 300 × 150 as its size. So the size is read here, and the pixels
 *   wanted go onto the root element before it loads: it renders sharp at that size.
 * - Whatever it links to (fonts, pictures by URL) stays out: an SVG as a picture loads nothing, and
 *   the CSP agrees. Its text uses the device's fonts unless it embeds its own.
 */

import { makeCanvas } from './images.ts';

export interface Size {
  width: number;
  height: number;
}

/** What a browser makes of an SVG that says nothing about its size. */
export const DEFAULT_SIZE: Size = { width: 300, height: 150 };

/** The most pixels a canvas holds everywhere (iOS Safari stops at 4096 × 4096). */
export const MAX_AREA = 4096 * 4096;
export const MAX_SIDE = 16384;

/** CSS pixels per unit. Relative units (em, ex, %) have no size of their own. */
const UNITS: Record<string, number> = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, q: 96 / 101.6 };

/** A width or height attribute in CSS pixels: "64", "12.5px", "10mm", "1in"; null for em, %, junk. */
export function length(value: string | null | undefined): number | null {
  if (value == null) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value);
  if (!m) return null;
  const unit = UNITS[m[2].toLowerCase()];
  const n = unit === undefined ? NaN : Number(m[1]) * unit;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A viewBox's width and height; null unless it's four numbers with a positive size. */
export function viewBox(value: string | null | undefined): Size | null {
  if (value == null) return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [, , width, height] = parts;
  return width > 0 && height > 0 ? { width, height } : null;
}

interface Attr {
  name: string;
  value: string;
  /** As written, quotes and all, so the rewrite leaves it untouched. */
  raw: string;
  quote: string;
}

export interface Root {
  /** Where the start tag begins and ends in the text. */
  start: number;
  end: number;
  /** "svg:" for a prefixed root, else "". */
  prefix: string;
  attrs: Attr[];
  selfClosing: boolean;
}

const space = (c: string | undefined) => c === ' ' || c === '\n' || c === '\r' || c === '\t';

/** The root <svg> start tag after the prolog (XML declaration, comments, doctype); null when the
 *  text isn't an SVG. */
export function rootTag(text: string): Root | null {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (;;) {
    while (space(text[i])) i++;
    if (text.startsWith('<?', i)) {
      const e = text.indexOf('?>', i);
      if (e < 0) return null;
      i = e + 2;
    } else if (text.startsWith('<!--', i)) {
      const e = text.indexOf('-->', i);
      if (e < 0) return null;
      i = e + 3;
    } else if (text.slice(i, i + 9).toUpperCase() === '<!DOCTYPE') {
      // Its internal subset, in brackets, may hold '>'.
      let depth = 0;
      let j = i + 9;
      for (; j < text.length; j++) {
        if (text[j] === '[') depth++;
        else if (text[j] === ']') depth--;
        else if (text[j] === '>' && depth <= 0) break;
      }
      if (j >= text.length) return null;
      i = j + 1;
    } else break;
  }
  const head = /^<([A-Za-z_][\w.-]*:)?svg(?=[\s/>])/.exec(text.slice(i, i + 80));
  if (!head) return null;
  const root: Root = { start: i, end: 0, prefix: head[1] ?? '', attrs: [], selfClosing: false };
  let j = i + head[0].length;
  for (;;) {
    while (space(text[j])) j++;
    if (j >= text.length) return null;
    if (text[j] === '>') {
      root.end = j + 1;
      return root;
    }
    if (text.startsWith('/>', j)) {
      root.end = j + 2;
      root.selfClosing = true;
      return root;
    }
    const from = j;
    while (j < text.length && !space(text[j]) && text[j] !== '=' && text[j] !== '>' && text[j] !== '/') j++;
    const name = text.slice(from, j);
    if (!name) return null;
    while (space(text[j])) j++;
    if (text[j] !== '=') return null;
    j++;
    while (space(text[j])) j++;
    const quote = text[j];
    if (quote !== '"' && quote !== "'") return null;
    const close = text.indexOf(quote, j + 1);
    if (close < 0) return null;
    root.attrs.push({ name, value: text.slice(j + 1, close), raw: text.slice(from, close + 1), quote });
    j = close + 1;
  }
}

const attr = (root: Root, name: string) => root.attrs.find((a) => a.name === name)?.value;

function sizeOf(root: Root): Size {
  const w = length(attr(root, 'width'));
  const h = length(attr(root, 'height'));
  if (w && h) return { width: w, height: h };
  const box = viewBox(attr(root, 'viewBox'));
  if (box) {
    const ratio = box.width / box.height;
    if (w) return { width: w, height: w / ratio };
    if (h) return { width: h * ratio, height: h };
    return box;
  }
  return { width: w ?? DEFAULT_SIZE.width, height: h ?? DEFAULT_SIZE.height };
}

/** An SVG's size in CSS pixels: its width and height (px, pt, pc, mm, cm, in), else its viewBox,
 *  else what browsers assume (300 × 150). */
export function svgSize(text: string): Size {
  const root = rootTag(text);
  return root ? sizeOf(root) : { ...DEFAULT_SIZE };
}

const num = (n: number) => String(Number(n.toFixed(4)));

/**
 * The same SVG, set to render at `width` × `height` pixels: those on its root, a viewBox from its
 * own size when it had none (so it scales instead of being cut), no size in the root's style (CSS
 * would win over the attributes), and the namespaces an SVG copied out of a web page often lacks.
 */
export function sized(text: string, width: number, height: number): string {
  const root = rootTag(text);
  if (!root) return text;
  const natural = sizeOf(root);
  const has = (name: string) => root.attrs.some((a) => a.name === name);
  const parts: string[] = [];
  for (const a of root.attrs) {
    if (a.name === 'width' || a.name === 'height') continue;
    if (a.name === 'style') {
      const style = a.value.replace(/(^|;)\s*(width|height)\s*:[^;]*/gi, '$1').replace(/^[\s;]+/, '');
      if (style.trim()) parts.push(`style=${a.quote}${style}${a.quote}`);
      continue;
    }
    parts.push(a.raw);
  }
  if (!has('viewBox')) parts.push(`viewBox="0 0 ${num(natural.width)} ${num(natural.height)}"`);
  if (!root.prefix && !has('xmlns')) parts.push('xmlns="http://www.w3.org/2000/svg"');
  if (/\sxlink:\w+\s*=/.test(text) && !has('xmlns:xlink')) parts.push('xmlns:xlink="http://www.w3.org/1999/xlink"');
  parts.push(`width="${Math.max(1, Math.round(width))}"`, `height="${Math.max(1, Math.round(height))}"`);
  return `${text.slice(0, root.start)}<${root.prefix}svg ${parts.join(' ')}${root.selfClosing ? '/>' : '>'}${text.slice(root.end)}`;
}

/** Whether the text is an SVG at all (a file can come without a type or an ending). */
export const isSvgText = (text: string) => rootTag(text) !== null;

/** HTML inside (<foreignObject>): browsers won't let a canvas that drew it export. */
export const holdsHtml = (text: string) => /<([\w.-]+:)?foreignObject[\s/>]/.test(text);

/** Text drawn without a font of its own: it comes out in the device's fonts. */
export const needsFonts = (text: string) => /<([\w.-]+:)?text[\s/>]/.test(text) && !/@font-face/i.test(text);

/**
 * The size to draw an SVG at: `scale` times its own, or `width` pixels wide (the height follows),
 * kept within what every browser's canvas holds. `capped` when it had to be made smaller.
 */
export function scaleTo(size: Size, want: { scale?: number; width?: number }): Size & { capped: boolean } {
  let width = want.width ?? size.width * (want.scale ?? 1);
  let height = (width * size.height) / size.width;
  const fits = Math.min(1, Math.sqrt(MAX_AREA / (width * height)), MAX_SIDE / Math.max(width, height));
  // Rounded down when cut to the limit, so it stays under it.
  const round = fits < 1 ? Math.floor : Math.round;
  width = Math.max(1, round(width * fits));
  height = Math.max(1, round(height * fits));
  return { width, height, capped: fits < 1 };
}

// ── In the browser ──────────────────────────────────────────────────────────────────────────

export class SvgError extends Error {
  /** `html`: it holds a <foreignObject>; `broken`: the browser couldn't draw it. */
  reason: 'html' | 'broken';
  constructor(reason: 'html' | 'broken') {
    super(reason === 'html' ? 'This SVG holds HTML inside' : 'This SVG can’t be drawn');
    this.reason = reason;
  }
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = ReturnType<typeof makeCanvas>;

/** Draws an SVG into a canvas at x, y, rendered at w × h pixels so it stays sharp (any clip set on
 *  the context applies). */
export async function paintSvg(ctx: Ctx, text: string, x: number, y: number, w: number, h: number): Promise<void> {
  if (holdsHtml(text)) throw new SvgError('html');
  const url = URL.createObjectURL(new Blob([sized(text, w, h)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new SvgError('broken'));
      image.src = url;
    });
    // Safari may draw an SVG's embedded fonts late; decoding first settles them.
    await image.decode().catch(() => undefined);
    ctx.drawImage(image, x, y, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** An SVG (the file or its text) drawn onto a new canvas of `width` × `height`, on a ground colour
 *  when one is given (a JPG has no transparency), else transparent. */
export async function drawSvg(svg: Blob | string, width: number, height: number, ground: string | null = null): Promise<AnyCanvas> {
  const text = typeof svg === 'string' ? svg : await svg.text();
  const canvas = makeCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  const ctx = canvas.getContext('2d') as Ctx;
  if (ground) {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  await paintSvg(ctx, text, 0, 0, canvas.width, canvas.height);
  return canvas;
}

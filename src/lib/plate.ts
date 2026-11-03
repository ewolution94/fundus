// A tool's plate: the spec sheet's figure in its head, a technical line drawing on an 8-unit grid
// (viewBox 0 0 160 120) with a note that's true of the tool. Each tool draws its own in
// src/tools/<id>/plate.ts with these helpers; components/Plate.svelte shows it and draws it on.
//
// Every part says when it's drawn: `at` (seconds after the draw starts) and, for lines drafted on,
// `dur`. Object lines (o) are drawn bold, construction lines (c) thin and first; phantom (h), centre
// (cl) lines, fills (f), dimensions (dl, ah) and notes (txt) fade in. A plate is drawn in about 1.4 s.

export type Lang = 'en' | 'de';
/** A figure: the SVG's inside, in the page's language. */
export type Figure = (lang: Lang) => string;

export const r2 = (v: number) => Math.round(v * 100) / 100;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** When a part comes in: --d is its delay, --t its drawing time, --e its easing. */
const tm = (d?: number | null, t?: number | null, e?: string | null) => {
  const s = [];
  if (d != null) s.push(`--d:${d}s`);
  if (t != null) s.push(`--t:${t}s`);
  if (e) s.push(`--e:${e}`);
  return s.length ? ` style="${s.join(';')}"` : '';
};
const cls = (base: string, extra = '') => (extra ? `${base} ${extra}` : base);

/** Object line, drawn on. `extra` adds a class: w (filled with the card), fq, bar, dg. */
export const o = (d: string, at: number, dur: number, e: string | null = null, extra = '') => `<path class="${cls('o', extra)}" pathLength="1" d="${d}"${tm(at, dur, e)}/>`;
/** Thin construction line, drawn on, first. */
export const c = (d: string, at: number, dur: number) => `<path class="c" pathLength="1" d="${d}"${tm(at, dur)}/>`;
/** Phantom (dashed) line, faded in. */
export const h = (d: string, at: number) => `<path class="h" d="${d}"${tm(at)}/>`;
/** Centre line (dash-dot), faded in. */
export const cl = (d: string, at: number) => `<path class="cl" d="${d}"${tm(at)}/>`;
/** Solid fill, faded in. */
export const f = (d: string, at: number, extra = '') => `<path class="${cls('f', extra)}" d="${d}"${tm(at)}/>`;
/** Dimension, extension and leader lines. */
export const dl = (d: string, at: number) => `<path class="d" d="${d}"${tm(at)}/>`;
/** Arrowheads (filled, from head()). */
export const ah = (d: string, at: number) => `<path class="a" d="${d}"${tm(at)}/>`;

interface TextOptions {
  /** text-anchor: start, middle (default) or end. */
  a?: 'start' | 'middle' | 'end';
  /** dominant-baseline: hanging, central … */
  b?: string;
  /** t (a note, the default), t t2 (a quieter note), k (a value), mm (a meme caption). */
  cls?: string;
  at?: number;
  /** More attributes, with a leading space. */
  extra?: string;
}
/** A note in mono capitals (write it in capitals). */
export const txt = (x: number, y: number, s: string, { a = 'middle', b, cls = 't', at, extra = '' }: TextOptions = {}) =>
  `<text class="${cls}" x="${r2(x)}" y="${r2(y)}"${a !== 'start' ? ` text-anchor="${a}"` : ''}${b ? ` dominant-baseline="${b}"` : ''}${extra}${tm(at)}>${esc(s)}</text>`;

/** A group that moves as a whole: dn (drops in), up (rises in), rise, ex/ey (the easing dot). */
export const g = (klass: string, inner: string, at?: number) => `<g class="${klass}"${tm(at)}>${inner}</g>`;

export const rect = (x: number, y: number, w: number, hh: number) => `M${r2(x)} ${r2(y)}H${r2(x + w)}V${r2(y + hh)}H${r2(x)}Z`;
export const rrect = (x: number, y: number, w: number, hh: number, r: number) =>
  `M${r2(x + r)} ${r2(y)}H${r2(x + w - r)}A${r} ${r} 0 0 1 ${r2(x + w)} ${r2(y + r)}V${r2(y + hh - r)}A${r} ${r} 0 0 1 ${r2(x + w - r)} ${r2(y + hh)}H${r2(x + r)}A${r} ${r} 0 0 1 ${r2(x)} ${r2(y + hh - r)}V${r2(y + r)}A${r} ${r} 0 0 1 ${r2(x + r)} ${r2(y)}Z`;
export const circ = (cx: number, cy: number, r: number) => `M${r2(cx)} ${r2(cy - r)}A${r} ${r} 0 1 1 ${r2(cx)} ${r2(cy + r)}A${r} ${r} 0 1 1 ${r2(cx)} ${r2(cy - r)}`;
export const ell = (cx: number, cy: number, rx: number, ry: number) => `M${r2(cx - rx)} ${r2(cy)}A${rx} ${ry} 0 1 1 ${r2(cx + rx)} ${r2(cy)}A${rx} ${ry} 0 1 1 ${r2(cx - rx)} ${r2(cy)}`;

/** A filled arrowhead with its tip at (x, y), pointing along `deg` (0 is right, 90 down). */
export const head = (x: number, y: number, deg: number, L = 4.2, W = 1.5) => {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const bx = x - L * dx;
  const by = y - L * dy;
  const px = -dy * W;
  const py = dx * W;
  return `M${r2(x)} ${r2(y)}L${r2(bx + px)} ${r2(by + py)}L${r2(bx - px)} ${r2(by - py)}Z`;
};

/** A photo's hill and sun inside a frame. */
export const scene = (x: number, y: number, w: number, hh: number) => ({
  hill: `M${r2(x)} ${r2(y + hh * 0.8)}L${r2(x + w * 0.36)} ${r2(y + hh * 0.46)}L${r2(x + w * 0.58)} ${r2(y + hh * 0.68)}L${r2(x + w * 0.72)} ${r2(y + hh * 0.56)}L${r2(x + w)} ${r2(y + hh * 0.84)}`,
  sun: circ(x + w * 0.28, y + hh * 0.28, Math.min(w, hh) * 0.09),
});

/** When the dimensions and the notes come in, after the drawing. */
export const DIM_AT = 1.0;
export const TXT_AT = 1.1;

interface DimOptions {
  /** Extension lines: [x, fromY] for a horizontal dimension, [fromX, y] for a vertical one. */
  ext?: [number, number][];
  /** Arrows outside the extension lines, for a short span. */
  out?: boolean;
  at?: number;
  tat?: number;
}

/** A horizontal dimension: line, arrowheads, extension lines, the label above (or below). */
export function dimH(x1: number, x2: number, y: number, label: string, { ext = [], out = false, below = false, at = DIM_AT, tat = TXT_AT, lx, la = 'middle' }: DimOptions & { below?: boolean; lx?: number; la?: 'start' | 'middle' | 'end' } = {}) {
  const line = out ? `M${r2(x1 - 8)} ${y}H${r2(x2 + 8)}` : `M${r2(x1)} ${y}H${r2(x2)}`;
  const heads = out ? head(x1, y, 0) + head(x2, y, 180) : head(x1, y, 180) + head(x2, y, 0);
  const exts = ext
    .map(([x, from]) => {
      const dir = Math.sign(y - from);
      return `M${r2(x)} ${r2(from + dir * 1.6)}V${r2(y + dir * 2.6)}`;
    })
    .join('');
  return dl(exts + line, at) + ah(heads, at) + (label ? txt(lx ?? (x1 + x2) / 2, below ? y + 2.6 : y - 2.6, label, { a: la, b: below ? 'hanging' : undefined, at: tat }) : '');
}

/** A vertical dimension, the label beside it (right, or left with side 'l'). */
export function dimV(x: number, y1: number, y2: number, label: string, { ext = [], out = false, side = 'r', at = DIM_AT, tat = TXT_AT, ly }: DimOptions & { side?: 'r' | 'l'; ly?: number } = {}) {
  const line = out ? `M${x} ${r2(y1 - 8)}V${r2(y2 + 8)}` : `M${x} ${r2(y1)}V${r2(y2)}`;
  const heads = out ? head(x, y1, 90) + head(x, y2, -90) : head(x, y1, -90) + head(x, y2, 90);
  const exts = ext
    .map(([fromX, y]) => {
      const dir = Math.sign(x - fromX);
      return `M${r2(fromX + dir * 1.6)} ${r2(y)}H${r2(x + dir * 2.6)}`;
    })
    .join('');
  return dl(exts + line, at) + ah(heads, at) + (label ? txt(side === 'r' ? x + 3.4 : x - 3.4, ly ?? (y1 + y2) / 2, label, { a: side === 'r' ? 'start' : 'end', b: 'central', at: tat }) : '');
}

/** A leader from a dot at (x1, y1) through a knee to a note at its end. */
export function leader(x1: number, y1: number, kx: number, ky: number, label: string, { a = 'start' as 'start' | 'end', at = DIM_AT, tat = TXT_AT } = {}) {
  const end = a === 'start' ? kx + 3 : kx - 3;
  return dl(`M${r2(x1)} ${r2(y1)}L${r2(kx)} ${r2(ky)}H${r2(end)}`, at) + f(circ(x1, y1, 1.1), at, 'dot') + txt(a === 'start' ? end + 2 : end - 2, ky, label, { a, b: 'central', at: tat });
}

/** The page's language picks the words. */
export const say = (lang: Lang, en: string, de: string) => (lang === 'de' ? de : en);

// What Colours does with a colour: reads it in any CSS form, writes it in the usual codes, and
// measures two colours' contrast the WCAG 2 way. Plain TypeScript with erasable types, no DOM, so
// the tests run it in node.
//
// A colour is kept as sRGB, gamma-encoded, each channel 0–1, plus alpha. Forms that can name a
// colour outside sRGB (oklch, oklab, lab, lch, an rgb() over 255) are brought in the way CSS does it:
// lightness and hue stay, chroma comes down until it fits (OKLCH), and the colour says it was.

export interface Rgb {
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  alpha: number;
}

export interface Colour extends Rgb {
  /** It was outside sRGB and was brought in. */
  clamped: boolean;
}

// ── sRGB ↔ linear ↔ OKLab ↔ OKLCH ────────────────────────────────────────────────────

/** One sRGB channel, gamma-encoded (0–1), to linear light. */
export const toLinear = (c: number) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4);

/** Linear light back to gamma-encoded sRGB. */
export const fromLinear = (l: number) => (Math.abs(l) <= 0.0031308 ? 12.92 * l : Math.sign(l) * (1.055 * Math.abs(l) ** (1 / 2.4) - 0.055));

type Vec = [number, number, number];

/** Linear sRGB to OKLab (Björn Ottosson's matrices, as CSS Color 4 uses them). */
export function linearToOklab([r, g, b]: Vec): Vec {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([L, a, b]: Vec): Vec {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklabToOklch([L, a, b]: Vec): Vec {
  const C = Math.hypot(a, b);
  const H = C < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

export function oklchToOklab([L, C, H]: Vec): Vec {
  const h = (H * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

// Within half a step of 8-bit sRGB counts as inside: it rounds to the same bytes.
const inGamut = (lin: Vec) => lin.every((c) => {
  const g = fromLinear(c);
  return g >= -0.5 / 255 && g <= 1 + 0.5 / 255;
});
const clip = (c: number) => Math.min(1, Math.max(0, c));

/**
 * Linear sRGB that may be outside the gamut, brought in: lightness and hue kept, chroma reduced
 * (a binary search in OKLCH), then what little is left clipped.
 */
function intoGamut(lin: Vec): { rgb: Vec; clamped: boolean } {
  if (inGamut(lin)) return { rgb: lin.map((c) => fromLinear(clip(c))) as Vec, clamped: false };
  const [L, C, H] = oklabToOklch(linearToOklab(lin));
  if (L >= 1) return { rgb: [1, 1, 1], clamped: true };
  if (L <= 0) return { rgb: [0, 0, 0], clamped: true };
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinear(oklchToOklab([L, mid, H])))) lo = mid;
    else hi = mid;
  }
  const best = oklabToLinear(oklchToOklab([L, lo, H]));
  return { rgb: best.map((c) => fromLinear(clip(c))) as Vec, clamped: true };
}

function fromLinearColour(lin: Vec, alpha: number): Colour {
  const { rgb, clamped } = intoGamut(lin);
  return { r: rgb[0], g: rgb[1], b: rgb[2], alpha, clamped };
}

// ── CIE Lab and LCH (D50), for lab() and lch() ─────────────────────────────────────────

const D50: Vec = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

function labToLinear([L, a, b]: Vec): Vec {
  const k = 24389 / 27;
  const e = 216 / 24389;
  const f1 = (L + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const x = (f0 ** 3 > e ? f0 ** 3 : (116 * f0 - 16) / k) * D50[0];
  const y = (L > k * e ? ((L + 16) / 116) ** 3 : L / k) * D50[1];
  const z = (f2 ** 3 > e ? f2 ** 3 : (116 * f2 - 16) / k) * D50[2];
  // D50 to D65 (Bradford), then XYZ to linear sRGB: CSS Color 4's matrices.
  const X = 0.955473421488075 * x - 0.02309845494876471 * y + 0.06325924320057072 * z;
  const Y = -0.0283697093338637 * x + 1.0099953980813041 * y + 0.021041441191917323 * z;
  const Z = 0.012314014864481998 * x - 0.020507649298898964 * y + 1.330365926242124 * z;
  return [
    3.2409699419045226 * X - 1.537383177570094 * Y - 0.4986107602930034 * Z,
    -0.9692436362808796 * X + 1.8759675015077202 * Y + 0.04155505740717559 * Z,
    0.05563007969699366 * X - 0.20397695888897652 * Y + 1.0569715142428786 * Z,
  ];
}

// ── HSL and HWB ───────────────────────────────────────────────────────────────────────

/** Hue in degrees, saturation and lightness 0–1, to sRGB 0–1. */
export function hslToRgb(h: number, s: number, l: number): Vec {
  const hue = ((h % 360) + 360) % 360;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** sRGB 0–1 to hue (degrees), saturation and lightness (0–1). */
export function rgbToHsl(r: number, g: number, b: number): Vec {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-9) return [0, 0, l];
  const s = l === 0 || l === 1 ? 0 : (max - l) / Math.min(l, 1 - l);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60) % 360, s, l];
}

export function hwbToRgb(h: number, w: number, bl: number): Vec {
  if (w + bl >= 1) {
    const grey = w / (w + bl);
    return [grey, grey, grey];
  }
  return hslToRgb(h, 1, 0.5).map((c) => c * (1 - w - bl) + w) as Vec;
}

// ── Reading a colour ───────────────────────────────────────────────────────────────────

/** The CSS named colours (CSS Color 4), as hex. */
export const NAMED: Record<string, string> = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff',
  beige: 'f5f5dc', bisque: 'ffe4c4', black: '000000', blanchedalmond: 'ffebcd', blue: '0000ff',
  blueviolet: '8a2be2', brown: 'a52a2a', burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00',
  chocolate: 'd2691e', coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c',
  cyan: '00ffff', darkblue: '00008b', darkcyan: '008b8b', darkgoldenrod: 'b8860b', darkgray: 'a9a9a9',
  darkgreen: '006400', darkgrey: 'a9a9a9', darkkhaki: 'bdb76b', darkmagenta: '8b008b', darkolivegreen: '556b2f',
  darkorange: 'ff8c00', darkorchid: '9932cc', darkred: '8b0000', darksalmon: 'e9967a', darkseagreen: '8fbc8f',
  darkslateblue: '483d8b', darkslategray: '2f4f4f', darkslategrey: '2f4f4f', darkturquoise: '00ced1', darkviolet: '9400d3',
  deeppink: 'ff1493', deepskyblue: '00bfff', dimgray: '696969', dimgrey: '696969', dodgerblue: '1e90ff',
  firebrick: 'b22222', floralwhite: 'fffaf0', forestgreen: '228b22', fuchsia: 'ff00ff', gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff', gold: 'ffd700', goldenrod: 'daa520', gray: '808080', green: '008000',
  greenyellow: 'adff2f', grey: '808080', honeydew: 'f0fff0', hotpink: 'ff69b4', indianred: 'cd5c5c',
  indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa', lavenderblush: 'fff0f5',
  lawngreen: '7cfc00', lemonchiffon: 'fffacd', lightblue: 'add8e6', lightcoral: 'f08080', lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3', lightgreen: '90ee90', lightgrey: 'd3d3d3', lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a', lightseagreen: '20b2aa', lightskyblue: '87cefa', lightslategray: '778899', lightslategrey: '778899',
  lightsteelblue: 'b0c4de', lightyellow: 'ffffe0', lime: '00ff00', limegreen: '32cd32', linen: 'faf0e6',
  magenta: 'ff00ff', maroon: '800000', mediumaquamarine: '66cdaa', mediumblue: '0000cd', mediumorchid: 'ba55d3',
  mediumpurple: '9370db', mediumseagreen: '3cb371', mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a', mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585', midnightblue: '191970', mintcream: 'f5fffa', mistyrose: 'ffe4e1', moccasin: 'ffe4b5',
  navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6', olive: '808000', olivedrab: '6b8e23',
  orange: 'ffa500', orangered: 'ff4500', orchid: 'da70d6', palegoldenrod: 'eee8aa', palegreen: '98fb98',
  paleturquoise: 'afeeee', palevioletred: 'db7093', papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f',
  pink: 'ffc0cb', plum: 'dda0dd', powderblue: 'b0e0e6', purple: '800080', rebeccapurple: '663399',
  red: 'ff0000', rosybrown: 'bc8f8f', royalblue: '4169e1', saddlebrown: '8b4513', salmon: 'fa8072',
  sandybrown: 'f4a460', seagreen: '2e8b57', seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0',
  skyblue: '87ceeb', slateblue: '6a5acd', slategray: '708090', slategrey: '708090', snow: 'fffafa',
  springgreen: '00ff7f', steelblue: '4682b4', tan: 'd2b48c', teal: '008080', thistle: 'd8bfd8',
  tomato: 'ff6347', turquoise: '40e0d0', violet: 'ee82ee', wheat: 'f5deb3', white: 'ffffff',
  whitesmoke: 'f5f5f5', yellow: 'ffff00', yellowgreen: '9acd32',
};

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
const TOKEN = new RegExp(String.raw`^(${NUM})(%|deg|grad|rad|turn)?$|^none$`, 'i');

interface Part {
  value: number;
  unit: '' | '%' | 'deg' | 'grad' | 'rad' | 'turn';
}

/** The parts inside the brackets: commas (legacy) or spaces, with an optional "/ alpha". */
function partsOf(inner: string): { parts: Part[]; alpha: Part | null } | null {
  let body = inner.trim();
  let alphaText: string | null = null;
  const slash = body.split('/');
  if (slash.length > 2) return null;
  if (slash.length === 2) {
    body = slash[0].trim();
    alphaText = slash[1].trim();
  }
  const raw = body.includes(',') ? body.split(',').map((s) => s.trim()) : body.split(/\s+/);
  if (body.includes(',') && alphaText !== null) return null;
  if (body.includes(',') && raw.length === 4) alphaText = raw.pop()!;
  const read = (s: string): Part | null => {
    const m = s.match(TOKEN);
    if (!m) return null;
    if (/^none$/i.test(s)) return { value: 0, unit: '' };
    return { value: parseFloat(m[1]), unit: (m[2]?.toLowerCase() ?? '') as Part['unit'] };
  };
  const parts = raw.filter(Boolean).map(read);
  if (parts.some((p) => p === null) || parts.length !== 3) return null;
  const alpha = alphaText === null ? null : read(alphaText);
  if (alphaText !== null && alpha === null) return null;
  return { parts: parts as Part[], alpha };
}

const hueOf = (p: Part) => {
  if (p.unit === '%') return NaN;
  if (p.unit === 'rad') return (p.value * 180) / Math.PI;
  if (p.unit === 'grad') return p.value * 0.9;
  if (p.unit === 'turn') return p.value * 360;
  return p.value;
};

const alphaOf = (p: Part | null) => (p === null ? 1 : Math.min(1, Math.max(0, p.unit === '%' ? p.value / 100 : p.value)));

/** A fraction from a percentage or a number on a scale (rgb's 255, oklch's 1). */
const scaled = (p: Part, full: number) => (p.unit === '%' ? p.value / 100 : p.value / full);

function hex(text: string): Colour | null {
  const h = text.replace(/^#/, '');
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) return null;
  const full = h.length <= 4 ? [...h].map((c) => c + c).join('') : h;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), alpha: full.length === 8 ? n(6) : 1, clamped: false };
}

/** Reads one colour in any CSS form, or null. Case and spaces don't matter. */
export function parseColour(input: string): Colour | null {
  const text = input.trim().toLowerCase().replace(/;$/, '').trim();
  if (!text) return null;
  if (text === 'transparent') return { r: 0, g: 0, b: 0, alpha: 0, clamped: false };
  if (NAMED[text]) return hex(NAMED[text]);
  if (/^#/.test(text) || /^([0-9a-f]{6}|[0-9a-f]{8})$/.test(text) || /^(?=.*[a-f])[0-9a-f]{3,4}$/.test(text)) return hex(text);
  const m = text.match(/^([a-z]+)\(\s*(.*?)\s*\)$/);
  if (!m) return null;
  const [, fn, inner] = m;
  const got = partsOf(inner);
  if (!got) return null;
  const [a, b, c] = got.parts;
  const alpha = alphaOf(got.alpha);
  switch (fn) {
    case 'rgb':
    case 'rgba': {
      if ([a, b, c].some((p) => p.unit !== '' && p.unit !== '%')) return null;
      // CSS clips rgb() channel by channel.
      const raw = [a, b, c].map((p) => scaled(p, 255));
      const clamped = raw.some((v) => v < -0.5 / 255 || v > 1 + 0.5 / 255);
      return { r: clip(raw[0]), g: clip(raw[1]), b: clip(raw[2]), alpha, clamped };
    }
    case 'hsl':
    case 'hsla':
    case 'hwb': {
      const h = hueOf(a);
      if (!Number.isFinite(h) || ![b, c].every((p) => p.unit === '' || p.unit === '%')) return null;
      // Modern syntax allows plain numbers, meant as percent.
      const x = Math.max(0, b.value / 100);
      const y = Math.min(1, Math.max(0, c.value / 100));
      const rgb = fn === 'hwb' ? hwbToRgb(h, Math.min(1, x), y) : hslToRgb(h, Math.min(1, x), y);
      return { r: clip(rgb[0]), g: clip(rgb[1]), b: clip(rgb[2]), alpha, clamped: false };
    }
    case 'oklab': {
      if ([b, c].some((p) => p.unit !== '' && p.unit !== '%') || (a.unit !== '' && a.unit !== '%')) return null;
      const L = scaled(a, 1);
      const A = b.unit === '%' ? (b.value / 100) * 0.4 : b.value;
      const B = c.unit === '%' ? (c.value / 100) * 0.4 : c.value;
      return fromLinearColour(oklabToLinear([L, A, B]), alpha);
    }
    case 'oklch': {
      if ((a.unit !== '' && a.unit !== '%') || (b.unit !== '' && b.unit !== '%')) return null;
      const L = scaled(a, 1);
      const C = Math.max(0, b.unit === '%' ? (b.value / 100) * 0.4 : b.value);
      const H = hueOf(c);
      if (!Number.isFinite(H)) return null;
      return fromLinearColour(oklabToLinear(oklchToOklab([L, C, H])), alpha);
    }
    case 'lab': {
      if ([a, b, c].some((p) => p.unit !== '' && p.unit !== '%')) return null;
      const L = a.value;
      const A = b.unit === '%' ? (b.value / 100) * 125 : b.value;
      const B = c.unit === '%' ? (c.value / 100) * 125 : c.value;
      return fromLinearColour(labToLinear([L, A, B]), alpha);
    }
    case 'lch': {
      if ((a.unit !== '' && a.unit !== '%') || (b.unit !== '' && b.unit !== '%')) return null;
      const L = a.value;
      const C = Math.max(0, b.unit === '%' ? (b.value / 100) * 150 : b.value);
      const H = (hueOf(c) * Math.PI) / 180;
      if (!Number.isFinite(H)) return null;
      return fromLinearColour(labToLinear([L, C * Math.cos(H), C * Math.sin(H)]), alpha);
    }
  }
  return null;
}

// ── Writing it ─────────────────────────────────────────────────────────────────────────

const byte = (c: number) => Math.round(clip(c) * 255);
const two = (n: number) => n.toString(16).padStart(2, '0');

/** Up to `digits` decimals, without trailing zeros: 0.5, 97.1, 100. */
export function round(n: number, digits: number): string {
  const f = 10 ** digits;
  const v = Math.round(n * f) / f;
  return String(Object.is(v, -0) ? 0 : v);
}

export function toHex(c: Rgb): string {
  const a = c.alpha < 1 ? two(byte(c.alpha)) : '';
  return `#${two(byte(c.r))}${two(byte(c.g))}${two(byte(c.b))}${a}`;
}

const alphaText = (a: number) => round(a, 3);

export function toRgb(c: Rgb): string {
  const [r, g, b] = [byte(c.r), byte(c.g), byte(c.b)];
  return c.alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alphaText(c.alpha)})` : `rgb(${r}, ${g}, ${b})`;
}

export function toHsl(c: Rgb): string {
  const [h, s, l] = rgbToHsl(clip(c.r), clip(c.g), clip(c.b));
  const body = `${round(h, 1)}, ${round(s * 100, 1)}%, ${round(l * 100, 1)}%`;
  return c.alpha < 1 ? `hsla(${body}, ${alphaText(c.alpha)})` : `hsl(${body})`;
}

export function oklchOf(c: Rgb): Vec {
  return oklabToOklch(linearToOklab([toLinear(clip(c.r)), toLinear(clip(c.g)), toLinear(clip(c.b))]));
}

export function toOklch(c: Rgb): string {
  const [L, C, H] = oklchOf(c);
  const hue = C < 0.0005 ? '0' : round(H, 1);
  const body = `${round(L * 100, 1)}% ${round(C, 3)} ${hue}`;
  return c.alpha < 1 ? `oklch(${body} / ${alphaText(c.alpha)})` : `oklch(${body})`;
}

/** The CSS name of exactly this colour, if it has one ("gold"); the first of two spellings. */
export function nameOf(c: Rgb): string | null {
  if (c.alpha < 1) return c.alpha === 0 ? 'transparent' : null;
  const h = toHex(c).slice(1);
  for (const [name, value] of Object.entries(NAMED)) if (value === h) return name;
  return null;
}

/** The colour from bytes 0–255 (a picked pixel). */
export const fromBytes = (r: number, g: number, b: number, alpha = 1): Colour => ({ r: r / 255, g: g / 255, b: b / 255, alpha, clamped: false });

// ── Contrast (WCAG 2) ──────────────────────────────────────────────────────────────────

/** Relative luminance, as WCAG 2 defines it (from the 8-bit values a screen shows). */
export function luminance(c: Rgb): number {
  const [r, g, b] = [c.r, c.g, c.b].map((v) => toLinear(byte(v) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `top` laid over `under` (for a colour that's partly see-through), over white when `under` is too. */
export function over(top: Rgb, under: Rgb): Rgb {
  const base = under.alpha < 1 ? over(under, { r: 1, g: 1, b: 1, alpha: 1 }) : under;
  const a = top.alpha;
  return { r: top.r * a + base.r * (1 - a), g: top.g * a + base.g * (1 - a), b: top.b * a + base.b * (1 - a), alpha: 1 };
}

/** The WCAG 2 contrast ratio of text in `fg` on `bg`, 1–21. */
export function contrast(fg: Rgb, bg: Rgb): number {
  const back = bg.alpha < 1 ? over(bg, { r: 1, g: 1, b: 1, alpha: 1 }) : bg;
  const front = fg.alpha < 1 ? over(fg, back) : fg;
  const a = luminance(front);
  const b = luminance(back);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const LEVELS = { aaNormal: 4.5, aaLarge: 3, aaaNormal: 7, aaaLarge: 4.5 } as const;

export interface Grades {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

/** Pass or fail at each level; never rounded up (4.499 fails 4.5). */
export function grades(ratio: number): Grades {
  return {
    aaNormal: ratio >= LEVELS.aaNormal,
    aaLarge: ratio >= LEVELS.aaLarge,
    aaaNormal: ratio >= LEVELS.aaaNormal,
    aaaLarge: ratio >= LEVELS.aaaLarge,
  };
}

/** "4.48": two decimals, cut rather than rounded where rounding would reach a level it misses. */
export function ratioText(ratio: number): string {
  let shown = Math.round(ratio * 100) / 100;
  if ([3, 4.5, 7].some((level) => ratio < level && shown >= level)) shown = Math.floor(ratio * 100) / 100;
  return shown.toFixed(2);
}

/** White or black, whichever stands out more against `c`. */
export function bestAgainst(c: Rgb): Colour {
  const white = { r: 1, g: 1, b: 1, alpha: 1, clamped: false };
  const black = { r: 0, g: 0, b: 0, alpha: 1, clamped: false };
  return contrast(c, white) >= contrast(c, black) ? white : black;
}

// ── A photo ────────────────────────────────────────────────────────────────────────────

/** The average colour of the square around (x, y), `radius` pixels each way, in RGBA bytes. */
export function averageAt(data: Uint8ClampedArray | Uint8Array, width: number, height: number, x: number, y: number, radius: number): Colour {
  const cx = Math.min(width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(height - 1, Math.max(0, Math.round(y)));
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  for (let yy = Math.max(0, cy - radius); yy <= Math.min(height - 1, cy + radius); yy++) {
    for (let xx = Math.max(0, cx - radius); xx <= Math.min(width - 1, cx + radius); xx++) {
      const i = (yy * width + xx) * 4;
      const alpha = data[i + 3] / 255;
      // Weighted by alpha, so a see-through edge doesn't pull the colour to black.
      r += data[i] * alpha;
      g += data[i + 1] * alpha;
      b += data[i + 2] * alpha;
      a += alpha;
      n++;
    }
  }
  if (a === 0) return { r: 0, g: 0, b: 0, alpha: 0, clamped: false };
  return fromBytes(Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / n) * 1000) / 1000);
}

/** The square's half-width for a picture this size: small, a few pixels at most. */
export const pickRadius = (width: number, height: number) => Math.max(1, Math.round(Math.min(width, height) / 250));

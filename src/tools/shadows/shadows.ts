// What Shadows does: builds a smooth, layered box-shadow from a few controls, tinted by the ground
// it sits on, with a stronger one for a dark ground and the same as filter: drop-shadow(); reads a
// pasted box-shadow back into its layers. Plain TypeScript with erasable types, no DOM, so the tests
// run it in node.
//
// The layers (n of them, i = 1 … n) grow along an ease-in, f(i) = (i / n)², so the first sit tight
// under the card and the last reach out:
//   offset(i) = distance · f(i), in the direction away from the light
//   blur(i)   = blur · f(i)
//   alpha(i)  = strength / n, in thousandths, the remainder going to the closest layers,
// so the alphas add up to the strength exactly. The colour is the ground's hue, a little less
// saturated, at 30 % of its lightness (plain black with the tint off). On a dark ground the strength
// is 2.5 times as much (at most 0.95): a shadow there needs more to show.

import { parseColour, rgbToHsl } from '../colours/colours.ts';

export interface Settings {
  /** 1–8 */
  layers: number;
  /** How far the farthest layer falls, px. */
  distance: number;
  /** How soft the farthest layer is: its blur radius, px. */
  blur: number;
  /** Where the light comes from, degrees clockwise from the top. */
  angle: number;
  /** The alphas added up, 0–1. */
  strength: number;
}

export interface Layer {
  x: number;
  y: number;
  blur: number;
  /** 0–1 */
  alpha: number;
}

export type PresetId = 'subtle' | 'card' | 'floating' | 'sharp';

export const PRESETS: Record<PresetId, Omit<Settings, 'angle'>> = {
  subtle: { layers: 3, distance: 4, blur: 8, strength: 0.12 },
  card: { layers: 5, distance: 16, blur: 32, strength: 0.2 },
  floating: { layers: 6, distance: 40, blur: 80, strength: 0.24 },
  sharp: { layers: 2, distance: 6, blur: 1, strength: 0.3 },
};

export const LIMITS = {
  layers: [1, 8],
  distance: [0, 100],
  blur: [0, 200],
  angle: [0, 359],
  strength: [0.01, 1],
} as const;

/** Light paper and a dark grey. */
export const GROUNDS = { light: '#f2f0eb', dark: '#2a2a2a' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Up to `digits` decimals, without trailing zeros, never "-0". */
export function num(n: number, digits = 1): string {
  const f = 10 ** digits;
  const v = Math.round(n * f) / f;
  return String(v === 0 ? 0 : v);
}

/** A length: "0" for nothing, else px with up to one decimal. */
export const px = (n: number) => (num(n, 1) === '0' ? '0' : `${num(n, 1)}px`);

/** Which way the shadow falls for light from `angle` (0 = the top, clockwise): a unit vector, y down. */
export function fallOf(angle: number): { x: number; y: number } {
  const a = (angle * Math.PI) / 180;
  const tidy = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  return { x: tidy(-Math.sin(a)), y: tidy(Math.cos(a)) };
}

/** The light's angle for a shadow falling by (x, y): the other way round from fallOf. */
export function angleOf(x: number, y: number): number {
  if (x === 0 && y === 0) return 0;
  return Math.round(((Math.atan2(-x, y) * 180) / Math.PI + 360) % 360) % 360;
}

/** How far along the layers are, layer i of n (1-based): an ease-in. */
export const grow = (i: number, n: number) => (i / n) ** 2;

/** `total` split into n alphas in thousandths that add up to it exactly; the closest get the rest. */
export function shares(total: number, n: number): number[] {
  const units = Math.round(clamp(total, 0, 1) * 1000);
  const base = Math.floor(units / n);
  const rest = units - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rest ? 1 : 0)) / 1000);
}

/** The layers, closest first. */
export function layersOf(s: Settings, strength = s.strength): Layer[] {
  const n = Math.round(clamp(s.layers, 1, 8));
  const dir = fallOf(s.angle);
  const alphas = shares(strength, n);
  return Array.from({ length: n }, (_, k) => {
    const f = grow(k + 1, n);
    const d = s.distance * f;
    return { x: dir.x * d, y: dir.y * d, blur: s.blur * f, alpha: alphas[k] };
  });
}

/** On a dark ground: 2.5 times the strength, at most 0.95. */
export const darkStrength = (strength: number) => Math.min(0.95, Math.round(strength * 2.5 * 100) / 100);

// ── Colours ───────────────────────────────────────────────────────────────────────────

export interface Hsl {
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

/** A colour as hue, saturation and lightness, or null if it isn't one. */
export function hslOf(colour: string): Hsl | null {
  const c = parseColour(colour);
  if (!c) return null;
  const [h, s, l] = rgbToHsl(c.r, c.g, c.b);
  return { h, s: s * 100, l: l * 100 };
}

/** The shadow's colour on a ground: its hue, a little less saturated, at 30 % of its lightness. */
export function tintOf(ground: string, tinted = true): Hsl {
  const g = hslOf(ground);
  if (!tinted || !g) return { h: 0, s: 0, l: 0 };
  return { h: g.s < 0.5 ? 0 : g.h, s: Math.min(60, g.s * 0.8), l: g.l * 0.3 };
}

export const hsl = (c: Hsl, alpha?: number) =>
  `hsl(${num(c.h, 0)} ${num(c.s, 0)}% ${num(c.l, 0)}%${alpha === undefined ? '' : ` / ${num(alpha, 3)}`})`;

/** A card on that ground and the text on it: near white on a light ground, a step up on a dark one. */
export function cardOn(ground: string): { card: string; ink: string; line: string } {
  const g = hslOf(ground) ?? { h: 0, s: 0, l: 95 };
  const light = g.l >= 50;
  const l = light ? g.l + (100 - g.l) * 0.75 : Math.min(g.l + 8, 45);
  return {
    card: hsl({ h: g.h, s: g.s, l }),
    ink: hsl({ h: g.h, s: Math.min(g.s, 20), l: light ? 12 : 92 }),
    line: hsl({ h: g.h, s: Math.min(g.s, 20), l: light ? 86 : l + 12 }),
  };
}

// ── Writing ───────────────────────────────────────────────────────────────────────────

const layerText = (l: Layer, c: Hsl) => `${px(l.x)} ${px(l.y)} ${px(l.blur)} ${hsl(c, l.alpha)}`;

/** The value alone, one layer per line (for a style, or CSS.supports). */
export const shadowValue = (layers: Layer[], c: Hsl) => layers.map((l) => layerText(l, c)).join(',\n  ');

/** `box-shadow:` with one layer per line. */
export const boxShadow = (layers: Layer[], c: Hsl) => `box-shadow:\n  ${shadowValue(layers, c)};`;

/** The value of filter: drop-shadow()'s blur is a standard deviation, half a box-shadow's radius. */
export const dropValue = (layers: Layer[], c: Hsl) => layers.map((l) => `drop-shadow(${px(l.x)} ${px(l.y)} ${px(l.blur / 2)} ${hsl(c, l.alpha)})`).join('\n  ');

export const dropShadow = (layers: Layer[], c: Hsl) => `filter:\n  ${dropValue(layers, c)};`;

// ── Reading a pasted box-shadow ───────────────────────────────────────────────────────

export interface Pasted {
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** As written; "currentcolor" when there was none. */
  colour: string;
  /** Its alpha, where it could be read (1 if not). */
  alpha: number;
}

/** Splits at commas (or white space) outside brackets. */
function splitTop(text: string, by: ',' | ' '): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (by === ',' ? ch === ',' : /\s/.test(ch))) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const LENGTH = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|em)?$/i;

/** A colour's alpha: what the colours tool reads, else a "/ a" at the end of any colour function. */
function alphaOf(colour: string): number {
  const c = parseColour(colour);
  if (c) return c.alpha;
  const m = colour.match(/\/\s*([\d.]+)(%?)\s*\)$/);
  if (m) return clamp(parseFloat(m[1]) / (m[2] ? 100 : 1), 0, 1);
  return 1;
}

/**
 * A box-shadow as written, with or without `box-shadow:` and its `;`: each layer's lengths (px;
 * rem and em at 16 px), its colour (commas inside rgba(…) and the like are the colour's) and
 * `inset`. Null if it isn't one.
 */
export function parseShadow(input: string): Pasted[] | null {
  const t = input
    .trim()
    .replace(/^box-shadow\s*:\s*/i, '')
    .replace(/;\s*$/, '')
    .replace(/\s*!important$/i, '')
    .trim();
  if (!t || /^none$/i.test(t)) return null;
  const out: Pasted[] = [];
  for (const part of splitTop(t, ',')) {
    let inset = false;
    let colour: string | null = null;
    const lengths: number[] = [];
    let lengthsDone = false;
    for (const tok of splitTop(part, ' ')) {
      const len = tok.match(LENGTH);
      if (/^inset$/i.test(tok)) {
        if (inset) return null;
        inset = true;
        if (lengths.length) lengthsDone = true;
      } else if (len) {
        if (lengthsDone) return null;
        const unit = (len[2] ?? '').toLowerCase();
        lengths.push(parseFloat(len[1]) * (unit === 'rem' || unit === 'em' ? 16 : 1));
      } else {
        if (colour !== null || !/^(#[0-9a-f]{3,8}|[a-z-]+(\(.*\))?)$/i.test(tok)) return null;
        colour = tok;
        if (lengths.length) lengthsDone = true;
      }
    }
    if (lengths.length < 2 || lengths.length > 4) return null;
    const c = colour ?? 'currentcolor';
    out.push({ inset, x: lengths[0], y: lengths[1], blur: Math.max(0, lengths[2] ?? 0), spread: lengths[3] ?? 0, colour: c, alpha: alphaOf(c) });
  }
  return out.length ? out : null;
}

/** A pasted shadow written back out, one layer per line (the value alone). */
export const pastedValue = (layers: Pasted[]) =>
  layers
    .map((l) => [l.inset ? 'inset' : '', px(l.x), px(l.y), px(l.blur), l.spread ? px(l.spread) : '', l.colour].filter(Boolean).join(' '))
    .join(',\n  ');

/**
 * The controls near a pasted shadow: as many layers (up to 8), the distance and the light's angle
 * from its farthest layer, the blur from its softest, the strength from its alphas added up. Inset
 * layers count only when there's nothing else.
 */
export function settingsNear(layers: Pasted[]): Settings {
  const outer = layers.filter((l) => !l.inset);
  const use = outer.length ? outer : layers;
  const far = use.reduce((a, b) => (Math.hypot(b.x, b.y) > Math.hypot(a.x, a.y) ? b : a));
  const sum = use.reduce((s, l) => s + l.alpha, 0);
  return {
    layers: clamp(use.length, 1, 8),
    distance: Math.round(clamp(Math.hypot(far.x, far.y), 0, 100)),
    blur: Math.round(clamp(Math.max(...use.map((l) => l.blur)), 0, 200)),
    angle: angleOf(far.x, far.y),
    strength: Math.round(clamp(sum, 0.01, 1) * 100) / 100,
  };
}

/** The preset with exactly these numbers, if there is one. */
export function presetOf(s: Settings): PresetId | null {
  for (const [id, p] of Object.entries(PRESETS) as [PresetId, (typeof PRESETS)[PresetId]][]) {
    if (p.layers === s.layers && p.distance === s.distance && p.blur === s.blur && Math.abs(p.strength - s.strength) < 1e-9) return id;
  }
  return null;
}

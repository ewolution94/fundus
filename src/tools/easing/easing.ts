// What Easing curves does with a timing function: evaluates a cubic Bézier (x solved for t, Newton
// then bisection), reads and writes CSS timing functions (the keywords, cubic-bezier(), linear()
// and a whole transition line), and builds a damped spring as a linear() string. Plain TypeScript
// with erasable types, no DOM, so the tests run it in node.

/** x1, y1, x2, y2: the two handles of a cubic Bézier from (0, 0) to (1, 1). */
export type Bezier = [number, number, number, number];

/** One point of a linear() function: output `y` at input `x` (0–1). */
export interface Stop {
  x: number;
  y: number;
}

export type Easing = { kind: 'bezier'; p: Bezier } | { kind: 'linear'; stops: Stop[] };

// ── A cubic Bézier ──────────────────────────────────────────────────────────────────

/** The polynomial of one coordinate, from its two inner control values (the ends are 0 and 1). */
function poly(a1: number, a2: number) {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return {
    at: (t: number) => ((a * t + b) * t + c) * t,
    slope: (t: number) => (3 * a * t + 2 * b) * t + c,
  };
}

/** The point on the curve at parameter t (not time: x is time). */
export function bezierPoint(p: Bezier, t: number): { x: number; y: number } {
  return { x: poly(p[0], p[2]).at(t), y: poly(p[1], p[3]).at(t) };
}

/**
 * The parameter t where the curve's x is `x`. Newton's method first (quick where the slope is
 * fair); where it stalls (a flat stretch, x1 or x2 at 0 or 1) bisection, which can't fail: with
 * x1 and x2 inside 0–1, x grows with t.
 */
export function solveT(x1: number, x2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const px = poly(x1, x2);
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = px.at(t) - x;
    if (Math.abs(err) < 1e-7) return t;
    const d = px.slope(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
    if (t < 0 || t > 1) break;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 60; i++) {
    const v = px.at(t);
    if (Math.abs(v - x) < 1e-9) return t;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return t;
}

/** The output of a cubic-bezier() timing function at progress x (0–1). */
export function bezierAt(p: Bezier, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return poly(p[1], p[3]).at(solveT(p[0], p[2], x));
}

/** The lowest and highest output of the curve (it can leave 0–1 when a handle does). */
export function bezierExtent(p: Bezier): [number, number] {
  let lo = 0;
  let hi = 1;
  const py = poly(p[1], p[3]);
  for (let i = 1; i < 200; i++) {
    const y = py.at(i / 200);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return [lo, hi];
}

// ── The presets ───────────────────────────────────────────────────────────────────────

/** CSS's own keywords (CSS Easing 1). */
export const KEYWORDS: Record<string, Bezier> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  linear: [0, 0, 1, 1],
};

export interface Preset {
  id: string;
  /** The group in the list: 'css' or the family. */
  group: string;
  /** The name shown: the keyword, or in / out / in-out. */
  name: string;
  p: Bezier;
}

/** The usual families as cubic-bezier() values, as easings.net publishes them. */
const FAMILIES: Record<string, [Bezier, Bezier, Bezier]> = {
  sine: [[0.12, 0, 0.39, 0], [0.61, 1, 0.88, 1], [0.37, 0, 0.63, 1]],
  quad: [[0.11, 0, 0.5, 0], [0.5, 1, 0.89, 1], [0.45, 0, 0.55, 1]],
  cubic: [[0.32, 0, 0.67, 0], [0.33, 1, 0.68, 1], [0.65, 0, 0.35, 1]],
  quart: [[0.5, 0, 0.75, 0], [0.25, 1, 0.5, 1], [0.76, 0, 0.24, 1]],
  quint: [[0.64, 0, 0.78, 0], [0.22, 1, 0.36, 1], [0.83, 0, 0.17, 1]],
  expo: [[0.7, 0, 0.84, 0], [0.16, 1, 0.3, 1], [0.87, 0, 0.13, 1]],
  circ: [[0.55, 0, 1, 0.45], [0, 0.55, 0.45, 1], [0.85, 0, 0.15, 1]],
  back: [[0.36, 0, 0.66, -0.56], [0.34, 1.56, 0.64, 1], [0.68, -0.6, 0.32, 1.6]],
};

export const PRESETS: Preset[] = [
  ...Object.entries(KEYWORDS).map(([name, p]) => ({ id: name, group: 'css', name, p })),
  ...Object.entries(FAMILIES).flatMap(([family, [i, o, io]]) => [
    { id: `in-${family}`, group: family, name: 'in', p: i },
    { id: `out-${family}`, group: family, name: 'out', p: o },
    { id: `in-out-${family}`, group: family, name: 'in-out', p: io },
  ]),
];

export const GROUPS = ['css', ...Object.keys(FAMILIES)];

const same = (a: Bezier, b: Bezier) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

/** The preset with exactly these numbers, if there is one. */
export const presetOf = (p: Bezier): Preset | undefined => PRESETS.find((x) => same(x.p, p));

/** The keyword for exactly these numbers ("ease-out"), if CSS has one. */
export const keywordOf = (p: Bezier): string | undefined => Object.keys(KEYWORDS).find((k) => same(KEYWORDS[k], p));

// ── Numbers ───────────────────────────────────────────────────────────────────────────

/** Up to `digits` decimals, without trailing zeros, never "-0": 0.5, 1.56, 1. */
export function num(n: number, digits = 3): string {
  const f = 10 ** digits;
  const v = Math.round(n * f) / f;
  return String(Object.is(v, -0) || v === 0 ? 0 : v);
}

/** Rounded to `digits` decimals, as a number. */
export const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where a handle may go: x inside the time, y within −1 to 2. */
export const clampHandle = (x: number, y: number): [number, number] => [clamp(x, 0, 1), clamp(y, -1, 2)];

// ── linear() ──────────────────────────────────────────────────────────────────────────

/**
 * The points of a linear() list, its missing inputs filled in as CSS Easing 2 does: the first at 0,
 * the last at 1 (or the largest before it), any going backwards raised to the largest before it,
 * and runs without one spread evenly between their neighbours. A point with two inputs is two
 * points. Null if it isn't a linear() list.
 */
export function parseStops(inner: string): Stop[] | null {
  const parts = inner.split(',').map((s) => s.trim());
  if (parts.length < 2 || parts.some((s) => !s)) return null;
  const raw: { y: number; x: number | null }[] = [];
  for (const part of parts) {
    const tokens = part.split(/\s+/);
    let y: number | null = null;
    const xs: number[] = [];
    for (const tok of tokens) {
      const pct = tok.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)%$/i);
      if (pct) xs.push(parseFloat(pct[1]) / 100);
      else if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(tok) && y === null) y = parseFloat(tok);
      else return null;
    }
    if (y === null || xs.length > 2) return null;
    if (!xs.length) raw.push({ y, x: null });
    else for (const x of xs) raw.push({ y, x });
  }
  if (raw[0].x === null) raw[0].x = 0;
  const last = raw[raw.length - 1];
  if (last.x === null) last.x = Math.max(1, ...raw.map((r) => r.x ?? -Infinity));
  let largest = -Infinity;
  for (const r of raw) {
    if (r.x === null) continue;
    if (r.x < largest) r.x = largest;
    largest = r.x;
  }
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].x !== null) continue;
    let j = i;
    while (raw[j].x === null) j++;
    const a = raw[i - 1].x!;
    const b = raw[j].x!;
    for (let k = i; k < j; k++) raw[k].x = a + ((b - a) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return raw.map((r) => ({ x: r.x!, y: r.y }));
}

/** The output of a linear() function at input x: straight lines between the points, the first and
 *  last lines carried on beyond them. At a point listed twice (a jump), the later one counts. */
export function linearAt(stops: Stop[], x: number): number {
  const n = stops.length;
  if (x < stops[0].x) {
    const [a, b] = [stops[0], stops.find((s) => s.x > stops[0].x) ?? stops[0]];
    return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  if (x >= stops[n - 1].x) {
    const b = stops[n - 1];
    const a = [...stops].reverse().find((s) => s.x < b.x) ?? b;
    return b.x === a.x || x === b.x ? b.y : b.y + ((b.y - a.y) * (x - b.x)) / (b.x - a.x);
  }
  let i = 0;
  while (i < n - 1 && stops[i + 1].x <= x) i++;
  const a = stops[i];
  const b = stops[i + 1];
  return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** linear(…) from points: the first and last without their input when it's 0 and 1. */
export function formatLinear(stops: Stop[]): string {
  const n = stops.length;
  const body = stops.map((s, i) => {
    const y = num(s.y, 3);
    if ((i === 0 && s.x === 0) || (i === n - 1 && s.x === 1)) return y;
    return `${y} ${num(s.x * 100, 2)}%`;
  });
  return `linear(${body.join(', ')})`;
}

// ── Reading and writing ───────────────────────────────────────────────────────────────

export type ReadError = 'unreadable' | 'outside' | 'steps';

export interface Read {
  easing: Easing;
  /** From a transition line: the property and the duration in ms, when it named them. */
  property?: string;
  duration?: number;
}

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
const TIME = new RegExp(String.raw`^(${NUMBER})(ms|s)$`, 'i');

/** Splits at commas (or spaces) outside brackets. */
function splitTop(text: string, by: ',' | ' '): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    const split = depth === 0 && (by === ',' ? ch === ',' : /\s/.test(ch));
    if (split) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** One timing function: a keyword, cubic-bezier(…), linear(…), or four bare numbers. */
function readFunction(text: string): Easing | ReadError {
  const t = text.trim().toLowerCase();
  if (KEYWORDS[t]) return { kind: 'bezier', p: [...KEYWORDS[t]] as Bezier };
  if (/^(steps\(|step-start$|step-end$)/.test(t)) return 'steps';
  const fn = t.match(/^(cubic-bezier|linear)\(\s*([^()]*?)\s*\)$/);
  const bare = !fn && t.match(new RegExp(String.raw`^${NUMBER}\s*,\s*${NUMBER}\s*,\s*${NUMBER}\s*,\s*${NUMBER}$`, 'i'));
  if (fn?.[1] === 'linear') {
    const stops = parseStops(fn[2]);
    return stops ? { kind: 'linear', stops } : 'unreadable';
  }
  const inner = fn ? fn[2] : bare ? t : null;
  if (inner === null) return 'unreadable';
  const parts = inner.split(',').map((s) => s.trim());
  if (parts.length !== 4 || !parts.every((s) => new RegExp(`^${NUMBER}$`, 'i').test(s))) return 'unreadable';
  const p = parts.map(Number) as Bezier;
  // CSS refuses an x outside 0–1: time can't run backwards.
  if (p[0] < 0 || p[0] > 1 || p[2] < 0 || p[2] > 1) return 'outside';
  return { kind: 'bezier', p };
}

const isFunction = (tok: string) => /^(cubic-bezier|linear|steps)\(/i.test(tok) || KEYWORDS[tok.toLowerCase()] !== undefined || /^step-(start|end)$/i.test(tok);

/**
 * A pasted or typed timing function, with what a transition line says besides: "ease-out",
 * "cubic-bezier(0.34, 1.56, 0.64, 1)", "linear(0, 0.5 40%, 1)", "0.4, 0, 0.2, 1",
 * "transition: opacity 0.3s cubic-bezier(…);" or "animation-timing-function: linear(…)". Of a list
 * (transitions for several properties) the first with a timing function counts.
 */
export function parseEasing(input: string): Read | { error: ReadError } {
  let t = input.trim().replace(/;\s*$/, '').trim();
  const decl = t.match(/^(transition|animation)(-timing-function)?\s*:\s*([\s\S]*)$/i);
  if (decl) t = decl[3].trim();
  if (!t) return { error: 'unreadable' };
  const items = splitTop(t, ',');
  // "0.4, 0, 0.2, 1" is one function, not four.
  if (!decl || decl[2]) {
    const one = readFunction(decl ? items[0] : t);
    return typeof one === 'string' ? { error: one } : { easing: one };
  }
  for (const item of items) {
    const tokens = splitTop(item, ' ');
    const fnTok = tokens.find(isFunction);
    if (!fnTok) continue;
    const easing = readFunction(fnTok);
    if (typeof easing === 'string') return { error: easing };
    const read: Read = { easing };
    const time = tokens.map((x) => x.match(TIME)).find(Boolean);
    if (time) read.duration = Math.round(parseFloat(time[1]) * (time[2].toLowerCase() === 's' ? 1000 : 1));
    if (decl[1].toLowerCase() === 'transition') {
      const prop = tokens.find((x) => x !== fnTok && /^-?[a-z][\w-]*$/i.test(x) && !TIME.test(x));
      if (prop) read.property = prop.toLowerCase();
    }
    return read;
  }
  return { error: 'unreadable' };
}

/** The CSS for a timing function: the keyword where the numbers are one, else cubic-bezier(…). */
export function formatEasing(e: Easing): string {
  if (e.kind === 'linear') return formatLinear(e.stops);
  return keywordOf(e.p) ?? formatBezier(e.p);
}

export const formatBezier = (p: Bezier) => `cubic-bezier(${p.map((v) => num(v, 3)).join(', ')})`;

/** `transition: transform 600ms cubic-bezier(…);` */
export const transitionLine = (fn: string, ms: number, property = 'transform') => `transition: ${property} ${num(ms, 0)}ms ${fn};`;

/** The Web Animations call with the same timing. */
export const animateLine = (fn: string, ms: number) => `el.animate(keyframes, { duration: ${num(ms, 0)}, easing: '${fn}' });`;

/** The output of any easing at progress x. */
export const easingAt = (e: Easing, x: number) => (e.kind === 'bezier' ? bezierAt(e.p, x) : linearAt(e.stops, x));

/** The lowest and highest output it reaches. */
export function extentOf(e: Easing): [number, number] {
  if (e.kind === 'bezier') return bezierExtent(e.p);
  return [Math.min(0, ...e.stops.map((s) => s.y)), Math.max(1, ...e.stops.map((s) => s.y))];
}

/**
 * The range of outputs the graph shows: −0.5 to 1.5, wider when a handle or the curve goes past
 * it (never past −1.1 to 2.1, a little more than the handles may go).
 */
export function viewRange(e: Easing): [number, number] {
  const [lo, hi] = extentOf(e);
  const ys = e.kind === 'bezier' ? [lo, hi, e.p[1], e.p[3]] : [lo, hi];
  return [Math.max(-1.1, Math.min(-0.5, Math.min(...ys) - 0.1)), Math.min(2.1, Math.max(1.5, Math.max(...ys) + 0.1))];
}

// ── A spring ──────────────────────────────────────────────────────────────────────────

/** How close to the end the spring is by the end of the duration: a thousandth of the way. */
export const SETTLE = 0.001;
/** How closely linear() follows the spring: at most this far off anywhere, before rounding. */
export const TOLERANCE = 0.0015;
/** Samples taken from the spring before simplifying: the inputs land on 0.05 % steps. */
export const SAMPLES = 2000;

/**
 * A damped spring's position over the duration (0–1), from bounce 0 (critically damped: no
 * overshoot) to 0.9 (lightly damped). The damping ratio is 1 − bounce, as SwiftUI and Motion
 * define bounce; the stiffness is chosen so the swing has died down to SETTLE by the end, so the
 * duration you set is the whole animation and the curve's shape depends on the bounce alone.
 */
export function spring(bounce: number): (x: number) => number {
  const zeta = 1 - clamp(bounce, 0, 0.95);
  if (zeta >= 1) {
    // Critically damped: 1 − e^(−k x)(1 + k x); k so that it's within SETTLE at x = 1.
    let lo = 1;
    let hi = 40;
    for (let i = 0; i < 80; i++) {
      const k = (lo + hi) / 2;
      if (Math.exp(-k) * (1 + k) > SETTLE) lo = k;
      else hi = k;
    }
    const k = hi;
    return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-k * x) * (1 + k * x));
  }
  // Under-damped: the swing's envelope e^(−ζω x)/√(1−ζ²) reaches SETTLE at x = 1.
  const root = Math.sqrt(1 - zeta * zeta);
  const w = Math.log(1 / (SETTLE * root)) / zeta;
  const wd = w * root;
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + (zeta / root) * Math.sin(wd * x)));
}

/**
 * Ramer–Douglas–Peucker on points sorted by x, by vertical distance (what an easing is off by at
 * a moment): keeps the fewest points with every dropped one within `tolerance` of the line left.
 */
export function simplify(points: Stop[], tolerance: number): Stop[] {
  const n = points.length;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const pa = points[a];
    const pb = points[b];
    let far = -1;
    let most = tolerance;
    for (let i = a + 1; i < b; i++) {
      const p = points[i];
      const on = pb.x === pa.x ? pa.y : pa.y + ((pb.y - pa.y) * (p.x - pa.x)) / (pb.x - pa.x);
      const d = Math.abs(p.y - on);
      if (d > most) {
        most = d;
        far = i;
      }
    }
    if (far > -1) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** The spring as linear() points: sampled, simplified, rounded as they'll be written. */
export function springStops(bounce: number): Stop[] {
  const f = spring(bounce);
  const samples: Stop[] = [];
  for (let i = 0; i <= SAMPLES; i++) samples.push({ x: i / SAMPLES, y: f(i / SAMPLES) });
  return simplify(samples, TOLERANCE).map((s) => ({ x: round(s.x, 4), y: round(s.y, 3) }));
}

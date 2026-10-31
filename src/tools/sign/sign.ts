// Sign a PDF's sums: where a box placed on a page as it's shown lands in the PDF's own coordinates
// (pages can be turned, and a PDF counts from the bottom left in points), the strokes of a drawn
// signature, and the date. Plain TypeScript with erasable types, tested as it is.

/** A page's visible area in PDF points, as pdf.js gives it (`page.view`): x0, y0, x1, y1. */
export type View = [number, number, number, number];

/** A box on the page as shown (turned), in fractions of its width and height, from the top left. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Degrees into 0, 90, 180 or 270. */
export function quarter(deg: number): number {
  const q = Math.round(deg / 90) * 90;
  return ((q % 360) + 360) % 360;
}

/** The page's size as shown, in points: a page turned a quarter shows its height as its width. */
export function shownSize(view: View, rotation: number): { width: number; height: number } {
  const w = view[2] - view[0];
  const h = view[3] - view[1];
  return quarter(rotation) % 180 ? { width: h, height: w } : { width: w, height: h };
}

/**
 * A point on the page as shown (u across, v down, both 0–1) in PDF coordinates. The inverse of
 * pdf.js's viewport: turned 90°, the page's left edge is at the top and its bottom on the left.
 */
export function toPdf(u: number, v: number, view: View, rotation: number): { x: number; y: number } {
  const [x0, y0, x1, y1] = view;
  const w = x1 - x0;
  const h = y1 - y0;
  switch (quarter(rotation)) {
    case 90:
      return { x: x0 + v * w, y: y0 + u * h };
    case 180:
      return { x: x1 - u * w, y: y0 + v * h };
    case 270:
      return { x: x1 - v * w, y: y1 - u * h };
    default:
      return { x: x0 + u * w, y: y1 - v * h };
  }
}

/** How pdf-lib's drawImage puts a picture there: its bottom-left corner, its size, and a turn that
 *  makes it stand upright on the page as shown. */
export interface Placed {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Counter-clockwise, as pdf-lib's `degrees()` takes it. */
  rotate: number;
}

export function placeImage(box: Box, view: View, rotation: number): Placed {
  const shown = shownSize(view, rotation);
  // The picture's bottom-left, as shown, is the box's bottom-left.
  const corner = toPdf(box.x, box.y + box.h, view, rotation);
  return { x: corner.x, y: corner.y, width: box.w * shown.width, height: box.h * shown.height, rotate: quarter(rotation) };
}

/** Text boxes are this many font sizes high, with the baseline this far up from their bottom
 *  (Helvetica's, and Arial's on screen: the same widths and nearly the same descent). */
export const LINE = 1.2;
export const BASELINE = 0.25;

/** Where drawText starts a line of text set in a box: its baseline's left end, and the size. */
export function placeText(box: Box, view: View, rotation: number): { x: number; y: number; size: number; rotate: number } {
  const shown = shownSize(view, rotation);
  const size = (box.h * shown.height) / LINE;
  const start = toPdf(box.x, box.y + box.h - (BASELINE * size) / shown.height, view, rotation);
  return { x: start.x, y: start.y, size, rotate: quarter(rotation) };
}

/** A box kept on the page: never past an edge, never smaller than a sliver. */
export function clampBox(box: Box): Box {
  const w = Math.min(1, Math.max(0.02, box.w));
  const h = Math.min(1, Math.max(0.01, box.h));
  return { x: Math.min(1 - w, Math.max(0, box.x)), y: Math.min(1 - h, Math.max(0, box.y)), w, h };
}

/** A picture's box height for a width, keeping its shape on a page as shown (all in fractions). */
export const heightFor = (w: number, aspect: number, shown: { width: number; height: number }) => (w * shown.width) / aspect / shown.height;

/** The date, written the way the language writes it: "31.10.2026", "Oct 31, 2026". */
export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

// ── Drawing ─────────────────────────────────────────────────────────────────────────────────────

/** A point of a stroke, in pad widths (so a drawing keeps its shape when the pad changes size),
 *  with the pen's width there. */
export interface Point {
  x: number;
  y: number;
  w: number;
}

export type Stroke = Point[];

/** The pen, in pad widths: thick when slow, thinner when fast. */
export const PEN = { max: 0.011, min: 0.004 };

/**
 * The next point of a stroke from a raw one: the position eased towards the finger (a shaky hand
 * draws a calm line), the width from the speed (pad widths per millisecond), or from the pressure
 * of a pen that has one. The last point (`end`, when the finger lifts) is where the finger was,
 * or the easing would stop the line short of it.
 */
export function nextPoint(
  stroke: Stroke,
  raw: { x: number; y: number; t: number; pressure?: number },
  last: { x: number; y: number; t: number } | null,
  end = false,
): Point {
  const prev = stroke[stroke.length - 1];
  if (!prev || !last) {
    const w = raw.pressure !== undefined ? PEN.min + (PEN.max - PEN.min) * raw.pressure : (PEN.max + PEN.min) / 2;
    return { x: raw.x, y: raw.y, w };
  }
  const ease = end ? 1 : 0.6;
  const x = prev.x + (raw.x - prev.x) * ease;
  const y = prev.y + (raw.y - prev.y) * ease;
  let target: number;
  if (raw.pressure !== undefined) target = PEN.min + (PEN.max - PEN.min) * raw.pressure;
  else {
    const speed = Math.hypot(raw.x - last.x, raw.y - last.y) / Math.max(1, raw.t - last.t);
    // 0.002 pad widths a millisecond (a slow, careful line) or less: the full width.
    target = PEN.max - Math.min(1, Math.max(0, (speed - 0.002) / 0.01)) * (PEN.max - PEN.min);
  }
  return { x, y, w: prev.w + (target - prev.w) * 0.35 };
}

/** One piece of a smoothed stroke: a curve from `from` to `to` bending towards `ctrl`. */
export interface Piece {
  from: { x: number; y: number };
  ctrl: { x: number; y: number };
  to: { x: number; y: number };
  w: number;
}

const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * A stroke as curves through the midpoints between its points, each bending towards the point
 * itself: no corners where the samples were. The pieces join end to start. One point is a dot
 * (a piece from it to itself).
 */
export function pieces(stroke: Stroke): Piece[] {
  if (!stroke.length) return [];
  if (stroke.length === 1) {
    const p = stroke[0];
    return [{ from: p, ctrl: p, to: p, w: p.w }];
  }
  if (stroke.length === 2) {
    const [a, b] = stroke;
    return [{ from: a, ctrl: mid(a, b), to: b, w: (a.w + b.w) / 2 }];
  }
  const out: Piece[] = [];
  let from: { x: number; y: number } = stroke[0];
  for (let i = 1; i < stroke.length - 1; i++) {
    const to = mid(stroke[i], stroke[i + 1]);
    out.push({ from, ctrl: stroke[i], to, w: stroke[i].w });
    from = to;
  }
  const last = stroke[stroke.length - 1];
  out.push({ from, ctrl: mid(stroke[stroke.length - 2], last), to: last, w: last.w });
  return out;
}

/** Everything drawn, with the pen's half width around it; null when nothing is. */
export function inkBounds(strokes: Stroke[]): { left: number; top: number; right: number; bottom: number } | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const s of strokes) {
    for (const p of s) {
      left = Math.min(left, p.x - p.w / 2);
      top = Math.min(top, p.y - p.w / 2);
      right = Math.max(right, p.x + p.w / 2);
      bottom = Math.max(bottom, p.y + p.w / 2);
    }
  }
  return Number.isFinite(left) ? { left, top, right, bottom } : null;
}

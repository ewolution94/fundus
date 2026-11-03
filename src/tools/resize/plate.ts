// F-103's plate: the photo in thin lines, the two crop marks framing 16:9 of it, the part kept bold.
import { c, cl, o, rect, scene, r2, dimH, type Figure } from '../../lib/plate.ts';

type Pt = [number, number];

/** The part of a polyline between x0 and x1 (the hill runs left to right). */
function between(pts: Pt[], x0: number, x1: number): string {
  const at = (a: Pt, b: Pt, x: number): Pt => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (b[0] < x0 || a[0] > x1) continue;
    if (!out.length) out.push(a[0] < x0 ? at(a, b, x0) : a);
    out.push(b[0] > x1 ? at(a, b, x1) : b);
  }
  return out.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('');
}

const figure: Figure = () => {
  const s = scene(24, 12, 112, 72);
  const hill: Pt[] = s.hill
    .slice(1)
    .split('L')
    .map((p) => p.split(' ').map(Number) as Pt);
  // The crop: 80 × 45, 16:9, from (44, 22).
  const [x0, y0, x1, y1] = [44, 22, 124, 67];
  return [
    c(rect(24, 12, 112, 72), 0, 0.4), c(s.hill, 0.08, 0.35), c(s.sun, 0.12, 0.3),
    cl(`M37 ${r2(y1 + 3.9)}L131 ${r2(y0 - 3.9)}`, 0.45),
    o(`M${x0} ${y0 - 8}V${y1}H${x1 + 8}`, 0.35, 0.45), o(`M${x1} ${y1 + 8}V${y0}H${x0 - 8}`, 0.5, 0.45),
    o(between(hill, x0, x1), 0.75, 0.35), o(s.sun, 0.85, 0.25),
    dimH(x0, x1, 100, '16:9', { ext: [[x0, y1], [x1, y1 + 8]] }),
  ].join('');
};
export default figure;

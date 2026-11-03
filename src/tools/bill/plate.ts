// F-505's plate: a receipt cut in two along its centre line, the tip line called out.
import { c, o, cl, leader, type Figure } from '../../lib/plate.ts';

const TOP = 14;
const FOOT = 96;
const TOOTH = 4;

/** A receipt's half, x0 to x1, its foot torn in teeth. */
const half = (x0: number, x1: number) => {
  let d = `M${x0} ${TOP}H${x1}V${FOOT}`;
  for (let x = x1; x > x0 + 0.01; x -= TOOTH) d += `L${x - TOOTH / 2} ${FOOT - 3}L${x - TOOTH} ${FOOT}`;
  return `${d}Z`;
};

const figure: Figure = () => {
  const L = [30, 58];
  const R = [66, 94];
  const lines = (x0: number, x1: number, rows: [number, number][]) => rows.map(([y, w]) => `M${x0 + 4} ${y}H${Math.min(x1 - 4, x0 + 4 + w)}`).join('');
  return [
    cl('M62 8V104', 0.05),
    o(half(L[0], L[1]), 0.05, 0.55), o(half(R[0], R[1]), 0.2, 0.55),
    c(lines(L[0], L[1], [[26, 20], [33, 14], [40, 18], [54, 20], [62, 12]]) + lines(R[0], R[1], [[26, 12], [33, 20], [40, 16], [54, 20], [62, 20]]), 0.3, 0.4),
    o(`M${L[0] + 4} 76H${L[1] - 4}M${R[0] + 4} 76H${R[1] - 4}`, 0.7, 0.25, null, 'bar'),
    leader(R[1] - 4, 62, 108, 52, '+10 %'),
  ].join('');
};
export default figure;

// F-201's plate: three pages in a row, the last one turned a quarter about its centre lines.
import { c, h, o, cl, dl, ah, txt, head, DIM_AT, TXT_AT, type Figure } from '../../lib/plate.ts';

/** A page 28 × 40 with its top left at (x, y): outline, folded corner, its lines. */
const page = (x: number, y: number) => ({
  edge: `M${x} ${y}H${x + 21}L${x + 28} ${y + 7}V${y + 40}H${x}Z`,
  fold: `M${x + 21} ${y}V${y + 7}H${x + 28}`,
  lines: `M${x + 5} ${y + 13}H${x + 21}M${x + 5} ${y + 19}H${x + 23}M${x + 5} ${y + 25}H${x + 19}M${x + 5} ${y + 31}H${x + 22}`,
});

// The third page turns about its middle (CX, CY); the arc says how far, at radius R.
const [CX, CY, R] = [102, 68, 30];

const figure: Figure = () => {
  const A = page(10, 48);
  const B = page(46, 48);
  const C = page(CX - 14, CY - 20);
  return [
    o(A.edge, 0.05, 0.45), o(A.fold, 0.35, 0.12), c(A.lines, 0.2, 0.3),
    o(B.edge, 0.15, 0.45), o(B.fold, 0.45, 0.12), c(B.lines, 0.3, 0.3),
    h(C.edge + C.fold, 0.3),
    cl(`M${CX} ${CY - R - 6}V${CY + 28}M${CX - 24} ${CY}H${CX + R + 6}`, 0.35),
    `<g transform="rotate(90 ${CX} ${CY})">${o(C.edge, 0.45, 0.45, null, 'w')}${o(C.fold, 0.75, 0.12)}${c(C.lines, 0.7, 0.25)}</g>`,
    dl(`M${CX} ${CY - R}A${R} ${R} 0 0 1 ${CX + R} ${CY}`, DIM_AT), ah(head(CX, CY - R, 180) + head(CX + R, CY, 90), DIM_AT),
    txt(CX + 26, CY - 26, '90°', { a: 'start', b: 'central', at: TXT_AT }),
  ].join('');
};
export default figure;

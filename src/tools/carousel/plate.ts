// F-110's plate: one wide picture cut into three 4:5 tiles, drawn apart, its hill running on across them.
import { o, dl, ah, txt, rect, circ, head, r2, DIM_AT, TXT_AT, type Figure } from '../../lib/plate.ts';

type Pt = [number, number];

// The drawer's panorama, in the strip's own units: 108 × 45, three tiles of 36 × 45.
const HILL: Pt[] = [[0, 36], [24, 15], [43, 33], [57, 20], [80, 42], [89, 34], [108, 19]];
const SUN: [number, number, number] = [93, 11, 4.4];
const [TW, TH, GAP, X0, Y0] = [36, 45, 7, 19, 30];
const DY = Y0 + TH + 10;

/** The hill between u0 and u1, moved to where tile i is drawn. */
function piece(u0: number, u1: number, i: number): string {
  const at = (a: Pt, b: Pt, u: number): Pt => [u, a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0])];
  const pts: Pt[] = [];
  for (let k = 0; k < HILL.length - 1; k++) {
    const [a, b] = [HILL[k], HILL[k + 1]];
    if (b[0] <= u0 || a[0] >= u1) continue;
    if (!pts.length) pts.push(a[0] < u0 ? at(a, b, u0) : a);
    pts.push(b[0] > u1 ? at(a, b, u1) : b);
  }
  return pts.map(([u, v], k) => `${k ? 'L' : 'M'}${r2(X0 + u + i * GAP)} ${r2(Y0 + v)}`).join('');
}

const figure: Figure = () => {
  const tiles = [0, 1, 2].map((i) => o(rect(X0 + i * (TW + GAP), Y0, TW, TH), 0.05 + i * 0.13, 0.4)).join('');
  const hills = [0, 1, 2].map((i) => o(piece(i * TW, (i + 1) * TW, i), 0.45 + i * 0.12, 0.22, 'linear')).join('');
  return [
    tiles,
    hills,
    o(circ(X0 + SUN[0] + 2 * GAP, Y0 + SUN[1], SUN[2]), 0.82, 0.2),
    // The first tile's width, its value carried out beside it on the dimension line.
    dl(`M${X0} ${Y0 + TH + 1.6}V${DY + 2.6}M${X0 + TW} ${Y0 + TH + 1.6}V${DY + 2.6}M${X0} ${DY}H${X0 + TW + 4}`, DIM_AT),
    ah(head(X0, DY, 180) + head(X0 + TW, DY, 0), DIM_AT),
    txt(X0 + TW + 6, DY, '1080 PX', { a: 'start', b: 'central', at: TXT_AT }),
  ].join('');
};
export default figure;

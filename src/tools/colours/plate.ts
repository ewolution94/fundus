// F-403's plate: a fan of three swatches, light, hatched and solid, and the contrast that sets text apart (WCAG's AA).
import { c, o, f, dl, ah, txt, rrect, circ, head, r2, TXT_AT, DIM_AT, type Figure } from '../../lib/plate.ts';

const PX = 80;
const PY = 94;
/** Each swatch's half width, its length above the pivot, and below it. */
const HW = 11;
const UP = 62;
const DOWN = 8;
const FIELD = 30;
const TURN = 30;
const R = UP + 8;

/** Hatching at 45° inside a box. */
function hatch(x0: number, y0: number, w: number, hh: number, step: number) {
  const x1 = x0 + w;
  const y1 = y0 + hh;
  let d = '';
  for (let k = x0 + y0 + step; k < x1 + y1; k += step) {
    const a = Math.max(x0, k - y1);
    const b = Math.min(x1, k - y0);
    if (b - a > 0.4) d += `M${r2(a)} ${r2(k - a)}L${r2(b)} ${r2(k - b)}`;
  }
  return d;
}

const figure: Figure = () => {
  const x = PX - HW;
  const y = PY - UP;
  const w = HW * 2;
  // The colour field: the swatch's top, its corners rounded like the swatch.
  const field = `M${x} ${y + FIELD}V${y + 3}A3 3 0 0 1 ${x + 3} ${y}H${x + w - 3}A3 3 0 0 1 ${x + w} ${y + 3}V${y + FIELD}Z`;
  const swatch = (turn: number, at: number, fill: string) =>
    `<g transform="rotate(${turn} ${PX} ${PY})">${o(rrect(x, y, w, UP + DOWN, 3), at, 0.45, null, 'w')}${o(`M${x} ${y + FIELD}H${x + w}`, at + 0.3, 0.15)}${fill}${o(`M${PX - 5} ${y + FIELD + 10}H${PX + 5}`, at + 0.4, 0.12)}</g>`;
  const at = (deg: number, r: number) => [PX + r * Math.sin((deg * Math.PI) / 180), PY - r * Math.cos((deg * Math.PI) / 180)];
  const [lx, ly] = at(-TURN, R);
  const [rx, ry] = at(TURN, R);
  const ext = [-TURN, TURN].map((t) => {
    const [ax, ay] = at(t, UP + 1.6);
    const [bx, by] = at(t, R + 2.6);
    return `M${r2(ax)} ${r2(ay)}L${r2(bx)} ${r2(by)}`;
  });
  return [
    swatch(-TURN, 0.05, ''),
    swatch(0, 0.2, c(hatch(x, y, w, FIELD, 3.2), 0.7, 0.2)),
    swatch(TURN, 0.35, f(field, 0.8)),
    o(circ(PX, PY, 2.4), 0.82, 0.12, null, 'w'),
    dl(ext.join('') + `M${r2(lx)} ${r2(ly)}A${R} ${R} 0 0 1 ${r2(rx)} ${r2(ry)}`, DIM_AT),
    ah(head(lx, ly, 180 - TURN) + head(rx, ry, TURN), DIM_AT),
    txt(PX, PY - R - 2.6, '4.5 : 1', { at: TXT_AT }),
  ].join('');
};
export default figure;

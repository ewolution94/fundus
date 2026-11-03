// F-508's plate: the life-in-weeks poster on its A4 page, the weeks lived filled in decade by decade.
import { c, o, f, rect, r2, dimH, dimV, say, type Figure } from '../../lib/plate.ts';
import { ROWS, COLS } from './life.ts';

// The poster's layout in millimetres, as life.ts lays it out, drawn at 58 units for the page's 210.
const S = 58 / 210;
const PX = 14;
const PY = 26;
const TOP = 58;
const BOTTOM = 280;
const PITCH = (BOTTOM - TOP) / (ROWS + 8 * 0.6);
const GAP = PITCH * 0.6;
const LEFT = (210 - COLS * PITCH) / 2 + 3;
const X = (mm: number) => r2(PX + mm * S);
const Y = (mm: number) => r2(PY + mm * S);
/** A sample life: 34 years and 20 weeks. */
const LIVED = [34, 20];

const figure: Figure = (lang) => {
  const x0 = X(LEFT);
  const x1 = X(LEFT + COLS * PITCH);
  const w = x1 - x0;
  const p = PITCH * S;
  const rowY = (row: number) => Y(TOP + row * PITCH + Math.floor(row / 10) * GAP);
  const decades = Array.from({ length: ROWS / 10 }, (_, d) => rect(x0, rowY(d * 10), w, rowY(d * 10 + 9) + p - rowY(d * 10)));
  const full = Math.floor(LIVED[0] / 10);
  const fills = [];
  for (let d = 0; d < full; d++) fills.push(f(decades[d], 0.55 + d * 0.1));
  const part = rect(x0, rowY(full * 10), w, rowY(LIVED[0]) - rowY(full * 10)) + rect(x0, rowY(LIVED[0]), (w * LIVED[1]) / COLS, p);
  fills.push(f(part, 0.55 + full * 0.1));
  const top = rowY(0);
  const foot = rowY(ROWS - 1) + p;
  return [
    o(rect(PX, PY, 210 * S, 297 * S), 0.05, 0.55),
    c(decades.join(''), 0.25, 0.5),
    ...fills,
    dimH(x0, x1, 18, say(lang, '52 WEEKS', '52 WOCHEN'), { ext: [[x0, top], [x1, top]], lx: x1 + 4, la: 'start' }),
    dimV(82, top, foot, say(lang, '90 YEARS', '90 JAHRE'), { ext: [[x1, top], [x1, foot]] }),
  ].join('');
};
export default figure;

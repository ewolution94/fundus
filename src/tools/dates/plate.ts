// F-501's plate: a month sheet, Monday and Friday of one week circled, the days between them.
import { o, f, rrect, circ, dimH, say, type Figure } from '../../lib/plate.ts';

const COLS = [32, 48, 64, 80, 96, 112, 128];
const ROWS = [38, 51, 64, 77];

const figure: Figure = (lang) =>
  [
    o(rrect(24, 16, 112, 70, 2), 0.05, 0.55), o('M48 10V22M112 10V22', 0.35, 0.2), o('M24 28H136', 0.4, 0.25),
    ROWS.map((y, i) => f(COLS.map((x) => circ(x, y, 1.6)).join(''), 0.45 + i * 0.06)).join(''),
    o(circ(32, 77, 5), 0.7, 0.25), o(circ(96, 77, 5), 0.82, 0.25),
    dimH(32, 96, 96, say(lang, '4 DAYS', '4 TAGE'), { ext: [[32, 82], [96, 82]], below: true }),
  ].join('');
export default figure;

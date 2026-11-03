// F-909's plate: a table with its header row, both ways to an array of objects, one for each row.
import { c, o, dl, ah, txt, rect, head, DIM_AT, TXT_AT, type Figure } from '../../lib/plate.ts';

/** A small curly brace, its stem at x from y0 to y1, its point left (1) or right (-1). */
const brace = (x: number, y0: number, y1: number, s: 1 | -1) => {
  const m = (y0 + y1) / 2;
  const w = 3 * s;
  return `M${x + w} ${y0}Q${x} ${y0} ${x} ${y0 + 3}V${m - 2}Q${x} ${m} ${x - w * 0.6} ${m}Q${x} ${m} ${x} ${m + 2}V${y1 - 3}Q${x} ${y1} ${x + w} ${y1}`;
};

const figure: Figure = () =>
  [
    o(rect(12, 28, 54, 44), 0.05, 0.5), o('M12 42H66', 0.35, 0.2),
    c('M12 57H66M30 28V72', 0.15, 0.35),
    c('M14 40L21 30M21 40L28 30M33 40L40 30M40 40L47 30M47 40L54 30M54 40L61 30M61 40L64.5 35', 0.3, 0.3),
    dl('M76 50H90', 0.45), ah(head(72, 50, 180) + head(94, 50, 0), 0.45),
    o('M104 26H100V74H104M144 26H148V74H144', 0.4, 0.4),
    o(brace(110, 30, 48, 1) + brace(138, 30, 48, -1), 0.6, 0.3),
    o(brace(110, 52, 70, 1) + brace(138, 52, 70, -1), 0.7, 0.3),
    c('M116 36H132M116 42H128M116 58H134M116 64H126', 0.75, 0.25),
    dl('M39 73.6V82M124 75.6V82', DIM_AT),
    txt(39, 86, 'CSV', { b: 'hanging', at: TXT_AT }),
    txt(124, 86, 'JSON', { b: 'hanging', at: TXT_AT }),
  ].join('');
export default figure;

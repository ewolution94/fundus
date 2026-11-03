// F-901's plate: an object's braces, its keys and values on two levels, the indent they're set in.
import { c, o, dl, ah, txt, head, say, DIM_AT, TXT_AT, type Figure } from '../../lib/plate.ts';

/** A curly brace with its stem at x from y0 to y1, its point to the left (1, an opening brace) or the right (-1). */
const brace = (x: number, y0: number, y1: number, s: 1 | -1) => {
  const m = (y0 + y1) / 2;
  const w = 5 * s;
  return `M${x + w} ${y0}Q${x} ${y0} ${x} ${y0 + 5}V${m - 5}Q${x} ${m} ${x - w} ${m}Q${x} ${m} ${x} ${m + 5}V${y1 - 5}Q${x} ${y1} ${x + w} ${y1}`;
};

const figure: Figure = (lang) =>
  [
    o(brace(28, 20, 88, 1), 0.05, 0.5), o(brace(120, 20, 88, -1), 0.15, 0.5),
    // "id": 7, then "tags": [ … ] with two items a level in.
    o('M40 30H58', 0.35, 0.15), c('M64 30H104', 0.45, 0.2),
    o('M40 42H62', 0.45, 0.15), o('M70 38.5H68V45.5H70', 0.55, 0.12),
    o('M48 54H96', 0.55, 0.25), o('M48 66H84', 0.65, 0.2),
    o('M40 74.5H42V81.5H40', 0.8, 0.12),
    dl('M40 83.1V98.6M48 67.6V98.6M32 96H56', DIM_AT), ah(head(40, 96, 0) + head(48, 96, 180), DIM_AT),
    txt(60, 96, say(lang, '2 SPACES', '2 LEERZEICHEN'), { a: 'start', b: 'central', at: TXT_AT }),
  ].join('');
export default figure;

// F-910's plate: YAML's keys and its indented list, both ways to the same lines in JSON's braces.
import { c, o, f, dl, ah, txt, rect, circ, head, DIM_AT, TXT_AT, type Figure } from '../../lib/plate.ts';

/** A curly brace with its stem at x from y0 to y1, its point to the left (1) or the right (-1). */
const brace = (x: number, y0: number, y1: number, s: 1 | -1) => {
  const m = (y0 + y1) / 2;
  const w = 4 * s;
  return `M${x + w} ${y0}Q${x} ${y0} ${x} ${y0 + 4}V${m - 4}Q${x} ${m} ${x - w} ${m}Q${x} ${m} ${x} ${m + 4}V${y1 - 4}Q${x} ${y1} ${x + w} ${y1}`;
};

const figure: Figure = () =>
  [
    o(rect(12, 28, 54, 44), 0.05, 0.5),
    // name: value / tags: / - item / - item
    o('M18 37H30M18 46H32', 0.3, 0.2), f(circ(33.5, 35.4, 0.9) + circ(33.5, 38.6, 0.9) + circ(35.5, 44.4, 0.9) + circ(35.5, 47.6, 0.9), 0.5),
    c('M38 37H58', 0.35, 0.15),
    o('M24 55H27M24 64H27', 0.45, 0.12), c('M31 55H54M31 64H48', 0.5, 0.2),
    dl('M76 50H90', 0.45), ah(head(72, 50, 180) + head(94, 50, 0), 0.45),
    o(brace(106, 26, 74, 1) + brace(142, 26, 74, -1), 0.4, 0.45),
    o('M112 35H122M112 44H124M131 40.5H129V47.5H131', 0.65, 0.2), c('M126 35H136M120 53H134M120 61H130', 0.75, 0.2),
    o('M112 65.5H114V72.5H112', 0.85, 0.1),
    dl('M39 73.6V82M124 77.6V82', DIM_AT),
    txt(39, 86, 'YAML', { b: 'hanging', at: TXT_AT }),
    txt(124, 86, 'JSON', { b: 'hanging', at: TXT_AT }),
  ].join('');
export default figure;

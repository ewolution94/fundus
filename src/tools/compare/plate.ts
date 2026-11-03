// F-303's plate: the two versions side by side, a word struck through on the left, the new word under the highlighter on the right.
import { c, h, o, rrect, r2, leader, say, type Figure } from '../../lib/plate.ts';

/** Hatching at 45° inside a box: the highlighter, in ink. */
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

const figure: Figure = (lang) =>
  [
    o(rrect(16, 14, 56, 78, 2), 0.05, 0.5), o(rrect(88, 14, 56, 78, 2), 0.15, 0.5),
    c('M24 26H64M24 36H58M24 46H62M24 56H31M59 56H64M24 66H56M24 76H44', 0.25, 0.4),
    c('M96 26H136M96 36H130M96 46H134M96 56H105M131 56H136M96 66H114M96 76H112', 0.32, 0.4),
    h(rrect(37, 51.5, 16, 9, 1.5), 0.55), o('M34.5 56H55.5', 0.6, 0.2, 'ease-out'),
    o(rrect(109, 51.5, 18, 9, 1.5), 0.62, 0.25), c(hatch(109, 51.5, 18, 9, 3), 0.78, 0.2),
    leader(118, 60.5, 118, 104, say(lang, 'BY WORDS', 'NACH WÖRTERN'), { a: 'end' }),
  ].join('');
export default figure;

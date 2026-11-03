// F-305's plate: a CSV row split at its semicolons, the columns drawn down from them into a sheet, the header row filled in.
import { c, o, txt, rect, r2, leader, say, type Figure } from '../../lib/plate.ts';

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

const figure: Figure = (lang) =>
  [
    c('M24 26H56M72 26H92M108 26H130', 0, 0.35),
    txt(64, 26.6, ';', { b: 'central', cls: 'k', at: 0.2 }), txt(100, 26.6, ';', { b: 'central', cls: 'k', at: 0.25 }),
    o(rect(24, 44, 112, 54) + 'M24 56H136', 0.1, 0.55),
    c('M24 70H136M24 84H136', 0.35, 0.3),
    c('M64 31V44M100 31V44', 0.4, 0.15),
    o('M64 44V98', 0.5, 0.3), o('M100 44V98', 0.62, 0.3),
    c(hatch(24, 44, 112, 12, 4), 0.8, 0.2),
    leader(66, 21, 74, 13, say(lang, 'SEMICOLON', 'SEMIKOLON')),
  ].join('');
export default figure;

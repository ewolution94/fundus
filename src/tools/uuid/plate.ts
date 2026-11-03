// F-905's plate: a fingerprint, and a UUID's 32 hex digits in their five groups, 8-4-4-4-12.
import { c, o, r2, rect, dimH, say, type Figure } from '../../lib/plate.ts';

const GROUPS = [8, 4, 4, 4, 12];
const U = 3.6;
const GAP = 5;

// The drawer's fingerprint, at 1.6 times its size.
const PRINT = [
  'M55.94 29.25A25.6 25.6 0 0 1 104.06 29.25',
  'M62.59 46.11A19.2 19.2 0 0 1 99.2 38v11.2',
  'M69.52 45.34A12.8 12.8 0 1 1 91.6 43.41c-1.28 4.16-3.04 8-5.44 11.2',
  'M73.6 38a6.4 6.4 0 0 1 12.8 0v4.8c0 5.12-1.76 9.6-4.64 13.44',
  'M80 40.4v2.4c0 5.44-2.24 10.56-5.76 14.08',
  'M67.2 52.72c-1.44 2.56-3.2 4.8-5.28 6.72',
];

const figure: Figure = (lang) => {
  const total = 32 * U + 4 * GAP;
  const x0 = 80 - total / 2;
  let x = x0;
  let boxes = '';
  let ticks = '';
  let dashes = '';
  GROUPS.forEach((n, i) => {
    boxes += rect(x, 70, n * U, 12);
    for (let k = 1; k < n; k++) ticks += `M${r2(x + k * U)} 70V82`;
    x += n * U;
    if (i < 4) {
      dashes += `M${r2(x + GAP / 2 - 1.4)} 76H${r2(x + GAP / 2 + 1.4)}`;
      x += GAP;
    }
  });
  return [
    PRINT.map((d, i) => o(d, 0.05 + (5 - i) * 0.06, 0.4)).join(''),
    c(ticks, 0.35, 0.3),
    o(boxes, 0.45, 0.45), o(dashes, 0.8, 0.1),
    dimH(r2(x0), r2(x), 100, say(lang, '36 CHARS', '36 ZEICHEN'), { ext: [[r2(x0), 82], [r2(x), 82]] }),
  ].join('');
};
export default figure;

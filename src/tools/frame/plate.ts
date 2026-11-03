// F-109's plate: the screenshot in a browser window on its ground, the shadow under it, the padding.
import { c, o, f, rect, rrect, circ, dimV, type Figure } from '../../lib/plate.ts';

const figure: Figure = () =>
  [
    c(rect(10, 18, 104, 80), 0, 0.45),
    o(rrect(22, 30, 80, 56, 3), 0.15, 0.55), o('M22 40H102', 0.5, 0.2),
    f(circ(28, 35, 1.3) + circ(32.5, 35, 1.3) + circ(37, 35, 1.3), 0.6),
    c(rrect(46, 33, 44, 4, 2), 0.6, 0.25),
    c('M30 51H74M30 59H86M30 67H60', 0.65, 0.3),
    c('M25 89H102A3 3 0 0 0 105 86V33', 0.7, 0.25),
    dimV(120, 18, 30, '10 %', { ext: [[114, 18], [102, 30]], out: true }),
  ].join('');
export default figure;

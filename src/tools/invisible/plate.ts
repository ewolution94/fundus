// F-307's plate: lines of text, the hidden character shown as a phantom with a dot, a dimension of zero width with its code.
import { o, h, f, dl, txt, rrect, circ, dimH, DIM_AT, type Figure } from '../../lib/plate.ts';

const figure: Figure = () =>
  [
    o('M16 56H58', 0.05, 0.3), o('M74 56H140', 0.2, 0.35),
    o('M16 72H120', 0.3, 0.4), o('M16 88H84', 0.42, 0.3),
    h(rrect(60, 46, 12, 18, 1.5), 0.7),
    f(circ(66, 55, 1.8), 0.8, 'dot'),
    dl('M66 44.4V34', DIM_AT),
    dimH(66, 66, 34, '', { out: true }),
    txt(79, 34, 'U+200B', { a: 'start', b: 'central' }),
  ].join('');
export default figure;

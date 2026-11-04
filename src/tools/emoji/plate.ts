// F-309's plate: a smiling face drawn in its em square, like a type specimen, with its width above
// and its code point below.
import { c, o, h, cl, txt, rect, circ, ell, dimH, TXT_AT, type Figure } from '../../lib/plate.ts';

const figure: Figure = () =>
  [
    c('M8 28H152M8 88H152', 0, 0.45),
    h(rect(50, 28, 60, 60), 0.3),
    cl('M80 22V94M44 58H116', 0.35),
    o(circ(80, 58, 26), 0.15, 0.6),
    o(ell(71, 51, 2.4, 4.2), 0.72, 0.2), o(ell(89, 51, 2.4, 4.2), 0.8, 0.2),
    o('M66 64Q80 78 94 64', 0.86, 0.3),
    dimH(50, 110, 19, '1 EM', { ext: [[50, 28], [110, 28]] }),
    txt(80, 97, 'U+1F600', { b: 'hanging', at: TXT_AT }),
  ].join('');
export default figure;

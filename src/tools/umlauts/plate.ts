// F-304's plate: the ü's two UTF-8 bytes, what Windows-1252 makes of them, and the dots dropping back onto the u.
import { c, o, f, dl, ah, txt, g, rect, circ, head, dimH, type Figure } from '../../lib/plate.ts';

const figure: Figure = () =>
  [
    c('M12 44H70M12 80H70', 0, 0.35),
    o('M27 44V66A14 14 0 0 0 55 66V44M55 66V80', 0.1, 0.55),
    o(rect(92, 52, 48, 18) + 'M116 52V70', 0.3, 0.5),
    txt(104, 61.6, 'C3', { b: 'central', cls: 'k', at: 0.7 }),
    txt(128, 61.6, 'BC', { b: 'central', cls: 'k', at: 0.75 }),
    dl('M104 71.6V78M128 71.6V78', 0.8),
    txt(104, 82, 'Ã', { b: 'hanging', cls: 'k t2', at: 0.85 }),
    txt(128, 82, '¼', { b: 'hanging', cls: 'k t2', at: 0.85 }),
    dl('M86 61H70', 0.6), ah(head(66, 61, 180), 0.6),
    g('dn', f(circ(33, 34, 3.2) + circ(49, 34, 3.2), 0.7), 0.7),
    dimH(92, 140, 40, 'UTF-8', { ext: [[92, 52], [140, 52]] }),
  ].join('');
export default figure;

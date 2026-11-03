// F-907's plate: a token's three parts joined by dots, header.payload.signature, the key that checks it.
import { c, o, f, txt, rect, circ, dimH, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) =>
  [
    o(rect(12, 52, 32, 14), 0.05, 0.35), o(rect(53, 52, 50, 14), 0.2, 0.45), o(rect(112, 52, 36, 14), 0.4, 0.35),
    f(circ(48.5, 59, 1.6) + circ(107.5, 59, 1.6), 0.55),
    txt(28, 59.4, '{ }', { b: 'central', cls: 'k', at: 0.6 }),
    txt(78, 59.4, '{ }', { b: 'central', cls: 'k', at: 0.65 }),
    c('M116 64L124 54M122 64L130 54M128 64L136 54M134 64L142 54', 0.5, 0.3),
    // The key, its bit over the signature.
    o(circ(90, 30, 7.5) + circ(90, 30, 2.3), 0.6, 0.35), o('M97.5 30H146M140 30V36M146 30V34.5', 0.75, 0.25),
    dimH(12, 148, 82, say(lang, '3 PARTS', '3 TEILE'), { ext: [[12, 66], [148, 66]], below: true }),
  ].join('');
export default figure;

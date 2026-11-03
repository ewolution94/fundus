// F-906's plate: a page of any length drawn in to a hash of fixed length, eight words of 32 bits.
import { c, o, ah, rect, head, dimH, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) =>
  [
    o('M12 32H36L46 42V88H12Z', 0.05, 0.5), o('M36 32V42H46', 0.35, 0.15),
    c('M18 50H38M18 58H40M18 66H32M18 74H38M18 82H28', 0.1, 0.35),
    c('M52 34L72 54.4M52 86L72 65.6', 0.3, 0.35),
    ah(head(72, 54.4, 45.5) + head(72, 65.6, -45.5), 0.6),
    c('M86 54V66M94 54V66M102 54V66M110 54V66M118 54V66M126 54V66M134 54V66', 0.5, 0.25),
    o(rect(78, 54, 64, 12), 0.55, 0.45),
    dimH(78, 142, 42, say(lang, '256 BITS', '256 BIT'), { ext: [[78, 54], [142, 54]] }),
  ].join('');
export default figure;

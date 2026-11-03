// F-306's plate: a big A between its cap line and baseline, three of the sixteen styles beside it.
import { c, o, circ, dimH, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) =>
  [
    c('M8 84H152M8 36H152', 0, 0.45),
    o('M18 84L37 36H49L68 84H57L53 72H33L29 84Z', 0.15, 0.6), o('M36 63H50L43 44Z', 0.6, 0.25),
    // Circled
    o(circ(90, 72, 12), 0.72, 0.35), o('M84.5 78L90 65L95.5 78M86.6 73.4H93.4', 0.85, 0.25),
    // Double-struck
    o('M106 84L115 60H118L127 84M110 84L116.5 64M109 76H124', 0.88, 0.3),
    // Upside down
    o('M131 60L140.5 84L150 60M134 68H147', 1.0, 0.25),
    dimH(78, 150, 98, say(lang, '16 STYLES', '16 STILE'), { ext: [[78, 86], [150, 86]] }),
  ].join('');
export default figure;

// F-904's plate: a calendar sheet and a clock, measured from the datum of Unix time.
import { c, o, cl, rrect, circ, dimH, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) =>
  [
    cl('M20 24V96', 0.05),
    o(rrect(52, 24, 60, 56, 2), 0.05, 0.55), o('M66 18V30M98 18V30', 0.4, 0.2), o('M52 36H112', 0.45, 0.25),
    c('M52 50H112M52 64H112M67 36V80M82 36V80M97 36V80', 0.2, 0.4),
    o(circ(108, 76, 16), 0.55, 0.45, null, 'w'),
    o('M108 76V65', 0.85, 0.15), o('M108 76H117', 0.8, 0.15),
    dimH(20, 108, 105, say(lang, 'SINCE 1970', 'SEIT 1970'), { ext: [[20, 94], [108, 92]] }),
  ].join('');
export default figure;

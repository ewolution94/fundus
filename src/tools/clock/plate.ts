// F-509's plate: two split-flap cards, the right one's top flap dropping.
import { c, h, o, f, dl, ah, rect, rrect, head, dimH, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) =>
  [
    o(rrect(20, 18, 44, 74, 2), 0.05, 0.5), o(rrect(72, 18, 44, 74, 2), 0.15, 0.5),
    c('M20 55H64M72 55H116', 0.4, 0.25),
    f(rect(17.5, 52.5, 3, 5) + rect(63.5, 52.5, 3, 5) + rect(69.5, 52.5, 3, 5) + rect(115.5, 52.5, 3, 5), 0.5),
    o('M35 36L44 30V82', 0.55, 0.35, null, 'dg'),
    o('M80 42C80 29 106 28 106 42C106 55 83 64 80 82H107', 0.65, 0.45, null, 'dg'),
    h('M70 40H118L116 55H72Z', 0.5),
    dl('M124 26A30 30 0 0 1 124 82', 0.9), ah(head(121, 84.6, 140), 0.9),
    dimH(20, 116, 104, say(lang, '24 H', '24 STD.'), { ext: [[20, 92], [116, 92]] }),
  ].join('');
export default figure;

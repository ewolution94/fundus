// F-301's plate: words as boxes, counted on a tally.
import { o, rrect, dimH, say, type Figure } from '../../lib/plate.ts';

const WORDS = [
  [16, 24, 18], [38, 24, 10], [52, 24, 24],
  [16, 40, 14], [34, 40, 26], [64, 40, 12],
  [16, 56, 20], [40, 56, 16],
];
const MARKS = ['M98 26V62', 'M104 26V62', 'M110 26V62', 'M116 26V62', 'M93 54L121 33', 'M130 26V62', 'M136 26V62', 'M142 26V62'];

const figure: Figure = (lang) =>
  [
    WORDS.map(([x, y, w], i) => o(rrect(x, y, w, 10, 1.5), 0.05 + i * 0.07, 0.3)).join(''),
    MARKS.map((d, i) => o(d, 0.68 + i * 0.07, 0.14, 'ease-out')).join(''),
    dimH(16, 76, 80, say(lang, '8 WORDS', '8 WÖRTER'), { ext: [[16, 66], [76, 66]] }),
  ].join('');
export default figure;

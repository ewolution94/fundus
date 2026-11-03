// F-908's plate: a pattern, and the line it's tested on with its three matches marked.
import { c, o, txt, rrect, dimH, say, type Figure } from '../../lib/plate.ts';

// The line: plain stretches (thin) and the matches (boxed, their digits written in).
const PLAIN = 'M12 66H22M50 66H60M98 66H110M132 66H148';
const HITS: [number, number, string][] = [[26, 20, '12'], [64, 30, '345'], [114, 14, '7']];

const figure: Figure = (lang) =>
  [
    o(rrect(56, 14, 48, 16, 2), 0.05, 0.45),
    txt(80, 22.4, '\\d+', { b: 'central', cls: 'k', at: 0.4 }),
    c(PLAIN, 0.1, 0.4),
    c(HITS.map(([x, w]) => `M80 30L${x + w / 2} 59`).join(''), 0.3, 0.3),
    HITS.map(([x, w, s], i) => o(rrect(x, 59, w, 14, 2), 0.55 + i * 0.1, 0.3) + txt(x + w / 2, 66.4, s, { b: 'central', cls: 'k', at: 0.75 + i * 0.1 })).join(''),
    dimH(26, 128, 92, say(lang, '3 MATCHES', '3 TREFFER'), { ext: [[26, 73], [128, 73]] }),
  ].join('');
export default figure;

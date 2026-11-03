// F-402's plate: a field whose dots turn into twenty characters, a strength bar.
import { o, f, txt, g, rrect, circ, dimH, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) => {
  const dots = Array.from({ length: 20 }, (_, i) => circ(20 + i * 6.2, 55, 1.5)).join('');
  return [
    o(rrect(10, 44, 140, 22, 2), 0.05, 0.6),
    g('pw', f(dots, 0.25, 'pwd')),
    txt(18, 55.6, 'Hx7#vQ2m!Tz9$kLp4@Wd', { a: 'start', b: 'central', cls: 'k pwc', extra: ' textLength="121" lengthAdjust="spacing"' }),
    o('M10 76H42M46 76H78M82 76H114M118 76H150', 0.95, 0.35, 'linear', 'bar'),
    dimH(18, 139, 34, say(lang, '20 CHARS', '20 ZEICHEN'), { ext: [[18, 44], [139, 44]] }),
  ].join('');
};
export default figure;

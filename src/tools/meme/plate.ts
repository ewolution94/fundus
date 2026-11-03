// F-108's plate: a picture, the outlined captions dropping in, a leader to the face they're set in.
import { c, o, f, dl, txt, g, rect, circ, scene, say, DIM_AT, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) => {
  const s = scene(16, 14, 96, 82);
  return [
    o(rect(16, 14, 96, 82), 0.05, 0.6),
    c(s.hill, 0.1, 0.4), c(s.sun, 0.15, 0.35),
    g('dn', txt(64, 34, say(lang, 'TOP TEXT', 'TEXT OBEN'), { cls: 'mm', extra: ' textLength="66" lengthAdjust="spacingAndGlyphs"' }), 0.55),
    g('up', txt(64, 89, say(lang, 'BOTTOM TEXT', 'TEXT UNTEN'), { cls: 'mm', extra: ' textLength="84" lengthAdjust="spacingAndGlyphs"' }), 0.7),
    dl('M98 27L118 19H121', DIM_AT), f(circ(98, 27, 1.1), DIM_AT, 'dot'),
    txt(123, 19, 'ANTON', { a: 'start', b: 'central' }),
  ].join('');
};
export default figure;

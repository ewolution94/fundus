// F-202's plate: a page, its lines, a signature that writes itself on the line.
import { c, o, f, dl, txt, circ, say, DIM_AT, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) =>
  [
    o('M16 10H62L78 26V108H16Z', 0.05, 0.6), o('M62 10V26H78', 0.4, 0.2),
    c('M24 30H54M24 38H70M24 46H64M24 54H70M24 62H46', 0.1, 0.4),
    c('M24 94H72', 0.2, 0.3), c('M24.5 85.5L28.5 89.5M28.5 85.5L24.5 89.5', 0.25, 0.2),
    o('M31 91C33 83 36 72 39 72C42 72 38 90 36 92C35 93 37 82 42 80C46 78 44 88 47 88C50 88 50 80 53 80C56 80 54 87 57 87C61 87 62 78 66 78C69 78 66 86 70 85C73 84 76 80 80 79', 0.45, 0.75, 'cubic-bezier(.4,.1,.4,1)'),
    // The two ways in, as the tool names them, one under the other.
    dl('M82 79L88 60H90', DIM_AT), f(circ(82, 79, 1.1), DIM_AT, 'dot'),
    txt(92, 60, say(lang, 'DRAW', 'ZEICHNEN'), { a: 'start', b: 'central' }),
    txt(92, 72.5, say(lang, 'TYPE', 'TIPPEN'), { a: 'start', b: 'central' }),
  ].join('');
export default figure;

// F-102's plate: the big frame in phantom, projection lines down to the small one, the size it's under.
import { c, h, o, ah, rect, head, scene, dimH, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const s = scene(48, 30, 48, 36);
  const proj = 'M24 12L45.6 28.2M120 12L98.4 28.2M24 84L45.6 67.8M120 84L98.4 67.8';
  return [
    h(rect(24, 12, 96, 72), 0),
    c(proj, 0.1, 0.35),
    ah(head(46.4, 28.8, 36.87) + head(97.6, 28.8, 143.13) + head(46.4, 67.2, -36.87) + head(97.6, 67.2, -143.13), 0.4),
    o(rect(48, 30, 48, 36), 0.35, 0.55), o(s.hill, 0.75, 0.4), o(s.sun, 0.85, 0.3),
    dimH(48, 96, 98, '< 2 MB', { ext: [[48, 66], [96, 66]] }),
  ].join('');
};
export default figure;

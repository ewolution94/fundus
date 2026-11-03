// F-203's plate: a page, an arrow, its pages fanned out as photo cards at the resolution they're made.
import { c, o, dl, ah, rect, head, scene, dimH, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const card = (rot: number, at: number) => {
    const s = scene(98, 30, 28, 38);
    return `<g transform="rotate(${rot} 112 104)">${o(rect(98, 30, 28, 38), at, 0.4, null, 'w')}${o(s.hill, at + 0.3, 0.25)}${o(s.sun, at + 0.36, 0.2)}</g>`;
  };
  return [
    o('M14 22H44L54 32V86H14Z', 0.05, 0.5), o('M44 22V32H54', 0.35, 0.15),
    c('M20 42H44M20 50H48M20 58H40M20 66H46M20 74H36', 0.15, 0.35),
    dl('M60 54H74', 0.45), ah(head(78, 54, 0), 0.45),
    card(-16, 0.5), card(16, 0.62), card(0, 0.74),
    dimH(98, 126, 86, '150 DPI', { ext: [[98, 68], [126, 68]], below: true }),
  ].join('');
};
export default figure;

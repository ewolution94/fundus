// F-101's plate: the HEIC as drawn (thin), the arrow, the JPG drawn bold.
import { c, o, dl, ah, txt, rect, head, scene, DIM_AT, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const L = scene(16, 30, 48, 40);
  const R = scene(96, 30, 48, 40);
  return [
    c(rect(16, 30, 48, 40), 0, 0.4), c(L.hill, 0.08, 0.35), c(L.sun, 0.12, 0.3),
    dl('M70 50H86', 0.35), ah(head(90, 50, 0), 0.35),
    o(rect(96, 30, 48, 40), 0.4, 0.55), o(R.hill, 0.75, 0.4), o(R.sun, 0.85, 0.3),
    dl('M40 72.6V80M120 72.6V80', DIM_AT),
    txt(40, 84, 'HEIC', { b: 'hanging', cls: 't t2' }),
    txt(120, 84, 'JPG', { b: 'hanging' }),
  ].join('');
};
export default figure;

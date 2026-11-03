// F-106's plate: photos, an arrow, each on a page of its own, fitted inside the margin.
import { c, o, dl, ah, rect, head, scene, dimH, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const card = scene(22, 41, 26, 34);
  const pic = scene(94, 32, 36, 44);
  return [
    // The next page, behind.
    c('M93 25H133L141 33V93H93Z', 0, 0.4),
    o(rect(14, 33, 26, 34), 0.05, 0.4, null, 'w'),
    o(rect(22, 41, 26, 34), 0.18, 0.4, null, 'w'), o(card.hill, 0.42, 0.25), o(card.sun, 0.5, 0.2),
    dl('M58 54H74', 0.45), ah(head(78, 54, 0), 0.45),
    o('M88 20H128L136 28V88H88Z', 0.45, 0.5, null, 'w'), o('M128 20V28H136', 0.75, 0.15),
    o(rect(94, 32, 36, 44), 0.6, 0.4), o(pic.hill, 0.8, 0.3), o(pic.sun, 0.88, 0.2),
    dimH(88, 94, 98, '6 MM', { ext: [[88, 88], [94, 76]], out: true, below: true, lx: 108, la: 'start' }),
  ].join('');
};
export default figure;

// F-404's plate: a die in oblique projection with its hidden edges, a coin flipping.
import { h, o, f, dl, ah, rect, circ, ell, head, dimH, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const top = (u: number, v: number) => [24 + u * 32 + v * 14, 56 - v * 10];
  const right = (u: number, v: number) => [56 + u * 14, 88 - u * 10 - v * 32];
  const pipF = [[32, 64], [48, 64], [40, 72], [32, 80], [48, 80]].map(([x, y]) => circ(x, y, 2.3)).join('');
  const pipT = [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]]
    .map(([u, v]) => {
      const [x, y] = top(u, v);
      return ell(x, y, 2.4, 1.3);
    })
    .join('');
  const [rx, ry] = right(0.5, 0.5);
  const pipR = ell(rx, ry, 1.3, 2.4);
  return [
    h('M38 46V78H70M38 78L24 88', 0.1),
    o(rect(24, 56, 32, 32), 0.1, 0.45), o('M24 56L38 46H70L56 56', 0.35, 0.3), o('M56 88L70 78V46', 0.5, 0.25),
    f(pipF + pipT + pipR, 0.75),
    o(ell(118, 34, 17, 6) + 'M101 34V37.5A17 6 0 0 0 135 37.5V34', 0.45, 0.5),
    dl('M98 22A22 14 0 0 1 136 17', 0.65), ah(head(138.4, 19.8, 52), 0.65),
    dimH(24, 56, 100, '1 – 6', { ext: [[24, 88], [56, 88]] }),
    dimH(101, 135, 52, '50 : 50', { ext: [[101, 40], [135, 40]], below: true }),
  ].join('');
};
export default figure;

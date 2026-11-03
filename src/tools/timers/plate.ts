// F-506's plate: a stopwatch, its hand swept on from twelve, the longest timer called out.
import { c, h, o, f, dl, ah, circ, rrect, head, r2, leader, type Figure } from '../../lib/plate.ts';

const W = { x: 48, y: 66, r: 33 };

/** A point on the dial at minute `m` (0 at the top), `r` from its centre. */
const at = (m: number, r: number) => {
  const a = (m / 60) * 2 * Math.PI;
  return [r2(W.x + r * Math.sin(a)), r2(W.y - r * Math.cos(a))];
};

const figure: Figure = () => {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const [x1, y1] = at(i * 5, W.r - 3);
    const [x2, y2] = at(i * 5, W.r - (i % 3 ? 6 : 9));
    return `M${x1} ${y1}L${x2} ${y2}`;
  }).join('');
  const [hx, hy] = at(10, W.r - 8);
  const ra = W.r - 14;
  const [ax, ay] = at(1, ra);
  const [bx, by] = at(9, ra);
  const [bs1x, bs1y] = at(7.5, W.r);
  const [bs2x, bs2y] = at(7.5, W.r + 6);
  const [lx, ly] = at(20, W.r);
  return [
    c(ticks, 0.05, 0.4),
    o(circ(W.x, W.y, W.r), 0.1, 0.6),
    o(`M${W.x} ${W.y - W.r}V${W.y - W.r - 7}`, 0.45, 0.15, null, 'bar'),
    o(rrect(W.x - 8, W.y - W.r - 13, 16, 6, 1.5), 0.5, 0.25),
    o(`M${bs1x} ${bs1y}L${bs2x} ${bs2y}`, 0.55, 0.15, null, 'bar'),
    h(`M${W.x} ${W.y}V${W.y - W.r + 8}`, 0.6),
    o(`M${W.x} ${W.y}L${hx} ${hy}`, 0.75, 0.2),
    f(circ(W.x, W.y, 1.8), 0.8),
    dl(`M${ax} ${ay}A${ra} ${ra} 0 0 1 ${bx} ${by}`, 0.85),
    ah(head(bx, by, 54), 0.85),
    leader(lx, ly, 90, 100, '99:59:59'),
  ].join('');
};
export default figure;

// F-504's plate: a globe with its meridians, a clock in front of it, the working hours on its dial.
import { c, o, f, dl, ah, circ, ell, head, r2, leader, type Figure } from '../../lib/plate.ts';

const G = { x: 52, y: 50, r: 34 };
const K = { x: 88, y: 84, r: 20 };

/** A point on the clock at hour `h` (12 at the top), `r` from its centre. */
const at = (h: number, r: number) => {
  const a = (h / 12) * 2 * Math.PI;
  return [r2(K.x + r * Math.sin(a)), r2(K.y - r * Math.cos(a))];
};

const figure: Figure = () => {
  const meridians = [0.5, Math.sqrt(3) / 2].map((s) => ell(G.x, G.y, G.r * s, G.r)).join('');
  const ticks = [0, 3, 6, 9]
    .map((h) => {
      const [x1, y1] = at(h, K.r - 2);
      const [x2, y2] = at(h, K.r - 5);
      return `M${x1} ${y1}L${x2} ${y2}`;
    })
    .join('');
  const ri = K.r - 8;
  const [sx, sy] = at(9, ri);
  const [ex, ey] = at(5, ri);
  const [mx, my] = at(1.5, ri);
  return [
    c(`M${G.x - G.r} ${G.y}H${G.x + G.r}M${G.x} ${G.y - G.r}V${G.y + G.r}`, 0, 0.35),
    c(meridians, 0.1, 0.45),
    o(circ(G.x, G.y, G.r), 0.15, 0.55),
    o(circ(K.x, K.y, K.r), 0.45, 0.45, null, 'w'),
    c(ticks, 0.6, 0.2),
    o(`M${K.x} ${K.y}V${K.y - K.r + 6}M${K.x} ${K.y}H${K.x + K.r - 9}`, 0.75, 0.25),
    f(circ(K.x, K.y, 1.4), 0.8),
    dl(`M${sx} ${sy}A${ri} ${ri} 0 1 1 ${ex} ${ey}`, 0.9),
    ah(head(ex, ey, 150), 0.9),
    leader(mx, my, 114, 62, '9–17'),
  ].join('');
};
export default figure;

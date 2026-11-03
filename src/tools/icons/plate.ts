// F-107's plate: one picture as rounded icons from the favicon up to the biggest, on one baseline.
import { o, rrect, circ, r2, dimH, type Figure } from '../../lib/plate.ts';

/** An icon of side `s` standing on y = 80 at x, its picture's hill (and sun from 32 up). */
function icon(x: number, s: number, at: number) {
  const y = 80 - s;
  const P = (u: number, v: number) => `${r2(x + u * s)} ${r2(y + v * s)}`;
  const hill = `M${P(0.04, 0.78)}L${P(0.36, 0.46)}L${P(0.58, 0.68)}L${P(0.72, 0.56)}L${P(0.97, 0.8)}`;
  return [
    o(rrect(x, y, s, s, r2(s * 0.23)), at, 0.4),
    o(hill, at + 0.25, 0.3),
    s >= 32 ? o(circ(x + s * 0.3, y + s * 0.28, r2(s * 0.08)), at + 0.32, 0.2) : '',
  ].join('');
}

const figure: Figure = () =>
  [
    icon(16, 16, 0.05), icon(44, 32, 0.15), icon(88, 56, 0.3),
    dimH(16, 144, 96, '16 – 512 PX', { ext: [[16, 80], [144, 80]] }),
  ].join('');
export default figure;

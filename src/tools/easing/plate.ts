// F-912's plate: the default curve (out-back), its handles, the overshoot, a dot easing along it.
import { c, h, o, f, txt, g, circ, r2, dimV, type Figure } from '../../lib/plate.ts';

const P = [0.34, 1.56, 0.64, 1];

const figure: Figure = () => {
  const X = (v: number) => 32 + v * 80;
  const Y = (v: number) => 100 - v * 56;
  let peak = 0;
  for (let i = 0; i <= 1000; i++) {
    const s = i / 1000;
    peak = Math.max(peak, 3 * (1 - s) ** 2 * s * P[1] + 3 * (1 - s) * s * s * P[3] + s ** 3);
  }
  const over = Math.round((peak - 1) * 100);
  return [
    c('M32 100H120M32 100V22', 0, 0.4),
    h(`M32 44H${X(1)}M${X(1)} 100V44`, 0.1),
    c(`M32 100L${r2(X(P[0]))} ${r2(Y(P[1]))}M112 44L${r2(X(P[2]))} ${r2(Y(P[3]))}`, 0.25, 0.3),
    o(circ(X(P[0]), Y(P[1]), 2.2) + circ(X(P[2]), Y(P[3]), 2.2), 0.4, 0.25),
    o(`M32 100C${r2(X(P[0]))} ${r2(Y(P[1]))} ${r2(X(P[2]))} ${r2(Y(P[3]))} 112 44`, 0.35, 0.6),
    g('ex', g('ey', f(circ(112, 44, 3), 0.85, 'dot'))),
    dimV(119, r2(Y(peak)), 44, `+${over} %`, { ext: [[X(0.58), r2(Y(peak))], [114, 44]], out: true }),
    txt(76, 112, P.join(', ')),
  ].join('');
};
export default figure;

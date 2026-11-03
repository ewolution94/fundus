// F-104's plate: a photo, the pin of where it was taken stuck in it and struck through.
import { c, o, rect, circ, scene, r2, leader, type Figure } from '../../lib/plate.ts';

/** The drawer's pin, its head's middle at (x, y), `k` times its size: the outline and the eye. */
function pin(x: number, y: number, k: number) {
  const p = (dx: number, dy: number) => `${r2(x + dx * k)} ${r2(y + dy * k)}`;
  const R = r2(14 * k);
  const r = r2(1.75 * k);
  return {
    body: `M${p(14, 0)}C${p(14, 8.74)} ${p(4.31, 17.84)} ${p(1.05, 20.65)}A${r} ${r} 0 0 1 ${p(-1.05, 20.65)}C${p(-4.31, 17.84)} ${p(-14, 8.74)} ${p(-14, 0)}A${R} ${R} 0 0 1 ${p(14, 0)}Z`,
    eye: circ(x, y, r2(5.25 * k)),
    strike: `M${p(-17, -13.5)}L${p(17, 22.5)}`,
    shoulder: [r2(x + 14 * k * 0.766), r2(y - 14 * k * 0.643)] as const,
  };
}

const figure: Figure = () => {
  const s = scene(28, 50, 104, 56);
  const P = pin(80, 38, 1.3);
  return [
    o(rect(28, 50, 104, 56), 0.05, 0.55), c(s.hill, 0.1, 0.4), c(s.sun, 0.15, 0.35),
    o(P.body, 0.35, 0.5, null, 'w'), o(P.eye, 0.62, 0.22),
    o(P.strike, 0.78, 0.2, 'ease-out'),
    leader(P.shoulder[0], P.shoulder[1], 106, 16, 'GPS'),
  ].join('');
};
export default figure;

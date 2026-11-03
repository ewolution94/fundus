// F-913's plate: a card lit from the top, the Card preset's layers falling under it along an ease-in.
import { h, o, dl, ah, rrect, head, r2, leader, say, type Figure } from '../../lib/plate.ts';
import { PRESETS, grow } from './shadows.ts';

const C = { x: 36, y: 26, w: 80, h: 40, r: 3 };
/** Plate units per px of the preset's distance and blur. */
const K = 1.5;

const figure: Figure = (lang) => {
  // The Card preset, the tool's default: 5 layers, 16 px, 32 px of blur; light from the top (0°).
  const { layers, distance, blur } = PRESETS.card;
  const bottom = C.y + C.h;
  let foot = [0, 0];
  const edges = Array.from({ length: layers }, (_, k) => {
    const g = grow(k + 1, layers);
    const e = blur * g * K * 0.06;
    const yb = r2(bottom + distance * g * K + e);
    const x0 = r2(C.x - e);
    const x1 = r2(C.x + C.w + e);
    const r = r2(C.r + e);
    foot = [r2((x0 + x1) / 2), yb];
    return h(`M${x0} ${r2(yb - r)}A${r} ${r} 0 0 0 ${r2(x0 + r)} ${yb}H${r2(x1 - r)}A${r} ${r} 0 0 0 ${x1} ${r2(yb - r)}`, 0.55 + k * 0.08);
  });
  const rays = [56, 76, 96];
  return [
    edges.join(''),
    o(rrect(C.x, C.y, C.w, C.h, C.r), 0.05, 0.55, null, 'w'),
    dl(rays.map((x) => `M${x} 8V18`).join(''), 0.3),
    ah(rays.map((x) => head(x, 22, 90)).join(''), 0.3),
    leader(foot[0], foot[1], foot[0] + 10, 102, say(lang, '5 LAYERS', '5 EBENEN')),
  ].join('');
};
export default figure;

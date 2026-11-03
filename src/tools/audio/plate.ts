// F-601's plate: a sound's waveform, the two trim edges, the part kept bold and what it's saved at.
import { c, cl, o, f, rect, r2, leader, type Figure } from '../../lib/plate.ts';

// Half the height of each bar, left to right: a voice, louder in the middle.
const AMP = [2, 3, 5, 4, 7, 10, 8, 5, 9, 14, 18, 13, 9, 16, 22, 17, 11, 7, 13, 19, 15, 10, 7, 12, 15, 9, 6, 4, 7, 5, 3, 2, 2];
const [X0, STEP, MID, IN, OUT] = [16, 4, 62, 38, 122];

const figure: Figure = () => {
  // The bars sweep in left to right, each its own stroke; the ones trimmed off stay thin.
  const bars = AMP.map((a, i) => {
    const x = X0 + i * STEP;
    const bar = `M${x} ${MID - a}V${MID + a}`;
    const at = r2(0.1 + i * 0.019);
    return x > IN && x < OUT ? o(bar, at, 0.12) : c(bar, at, 0.12);
  }).join('');
  return [
    cl(`M10 ${MID}H150`, 0.05),
    bars,
    o(`M${IN} 32V92M${OUT} 32V92`, 0.75, 0.2),
    f(rect(IN - 2, 32, 4, 7) + rect(OUT - 2, 32, 4, 7), 0.85),
    leader(72, MID - 22, 86, 22, '192 KBPS'),
  ].join('');
};
export default figure;

// F-602's plate: an ear, a tone rising from 2 kHz towards the top a device can play.
import { c, o, r2, dimH, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const x1 = 62;
  const L = 146 - x1;
  const cy = 52;
  const k0 = (2 * Math.PI) / 18;
  const ratio = 18 / 3.4;
  let d = '';
  for (let i = 0; i <= 420; i++) {
    const s = i / 420;
    const phase = ((k0 * L) / Math.log(ratio)) * (ratio ** s - 1);
    const amp = 13 - 4 * s;
    d += `${i ? 'L' : 'M'}${r2(x1 + s * L)} ${r2(cy - amp * Math.sin(phase))}`;
  }
  return [
    o('M14 43.5a19.5 19.5 0 1 1 39 0c0 18-18 18-18 30a10.5 10.5 0 1 1-21 0', 0.05, 0.6),
    o('M41 43.5a7.5 7.5 0 0 0-15 0v3a6 6 0 1 1 0 12', 0.45, 0.3),
    c(`M58 ${cy}H150`, 0.1, 0.4),
    o(d, 0.5, 0.75, 'linear'),
    dimH(62, 146, 90, '2 → 22 kHz', { ext: [[62, 67], [146, 67]] }),
  ].join('');
};
export default figure;

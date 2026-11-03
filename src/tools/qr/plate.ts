// F-401's plate: the three finders drawn, the modules filling in around them. A real code for
// fundus.ewolution.cloud.
import { encode } from 'uqr';
import { o, f, rect, dimH, r2, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const qr = encode('HTTPS://FUNDUS.EWOLUTION.CLOUD', { ecc: 'M', border: 0 });
  const n = qr.size;
  const x0 = 48;
  const y0 = 32;
  const m = 64 / n;
  const finders = [[0, 0], [n - 7, 0], [0, n - 7]];
  const inFinder = (x: number, y: number) => finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  const groups: string[][] = [[], [], [], [], []];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!qr.data[y][x] || inFinder(x, y)) continue;
      const dist = Math.min(...finders.map(([fx, fy]) => Math.hypot(x - (fx + 3), y - (fy + 3))));
      const q = m * 0.78;
      const e = (m - q) / 2;
      groups[Math.min(4, Math.floor(dist / 4.2))].push(`M${r2(x0 + x * m + e)} ${r2(y0 + y * m + e)}h${r2(q)}v${r2(q)}h${r2(-q)}z`);
    }
  const rings = finders.map(([fx, fy], i) => o(rect(x0 + fx * m + m / 2, y0 + fy * m + m / 2, 6 * m, 6 * m), 0.1 + i * 0.12, 0.4, null, 'fq')).join('');
  const eyes = f(finders.map(([fx, fy]) => rect(x0 + (fx + 2) * m, y0 + (fy + 2) * m, 3 * m, 3 * m)).join(''), 0.5);
  const mods = groups.map((gr, i) => f(gr.join(''), 0.62 + i * 0.1, 'mod')).join('');
  return [rings, eyes, mods, dimH(48, 112, 22, `${n} × ${n}`, { ext: [[48, 32], [112, 32]] })].join('');
};
export default figure;

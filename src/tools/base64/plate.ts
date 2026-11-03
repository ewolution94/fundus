// F-902's plate: three bytes (Man) laid on a strip of their 24 bits, read back in fours of six: TWFu.
import { c, o, f, txt, rect, dimH, say, type Figure } from '../../lib/plate.ts';

const BYTES = [0x4d, 0x61, 0x6e];

const figure: Figure = (lang) => {
  const bits = BYTES.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));
  const cells = Array.from({ length: 23 }, (_, k) => `M${25 + k * 5} 48V56`).join('');
  const ones = [0, 1, 2].map((byte) =>
    bits
      .slice(byte * 8, byte * 8 + 8)
      .map((b, i) => (b ? rect(20 + (byte * 8 + i) * 5 + 1, 49, 3, 6) : ''))
      .join(''),
  );
  return [
    c('M20 36V48M60 36V48M100 36V48M140 36V48M20 56V68M50 56V68M80 56V68M110 56V68M140 56V68', 0, 0.35),
    o(rect(20, 24, 120, 12) + 'M60 24V36M100 24V36', 0.05, 0.5),
    o(rect(20, 48, 120, 8), 0.3, 0.45), c(cells, 0.25, 0.3),
    ones.map((d, i) => f(d, 0.55 + i * 0.08)).join(''),
    o(rect(20, 68, 120, 12) + 'M50 68V80M80 68V80M110 68V80', 0.6, 0.4),
    ['M', 'a', 'n'].map((ch, i) => txt(40 + i * 40, 30.4, ch, { b: 'central', cls: 'k', at: 0.5 })).join(''),
    ['T', 'W', 'F', 'u'].map((ch, i) => txt(35 + i * 30, 74.4, ch, { b: 'central', cls: 'k', at: 0.9 })).join(''),
    dimH(20, 140, 100, say(lang, '24 BITS', '24 BIT'), { ext: [[20, 80], [140, 80]] }),
  ].join('');
};
export default figure;

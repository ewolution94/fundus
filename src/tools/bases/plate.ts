// F-911's plate: a byte's eight bits in two nibbles, each nibble projected into its hex digit: 0b0010 1010 is 0x2A.
import { c, o, txt, rect, dimH, say, type Figure } from '../../lib/plate.ts';

const BITS = '00101010';
const HEX = '2A';
const CELL = 12;
const NIB = [26, 84];
const BOX = [[64, 76], [82, 76]];

const figure: Figure = (lang) => {
  const cells = NIB.map((x) => rect(x, 40, CELL * 4, 16) + [1, 2, 3].map((i) => `M${x + i * CELL} 40V56`).join(''));
  const bits = [...BITS].map((b, i) => txt(NIB[i >> 2] + (i % 4) * CELL + CELL / 2, 48.6, b, { b: 'central', cls: 'k', at: 0.45 + i * 0.03 })).join('');
  const proj = NIB.map((x, i) => `M${x} 56L${BOX[i][0]} ${BOX[i][1]}M${x + CELL * 4} 56L${BOX[i][0] + 12} ${BOX[i][1]}`).join('');
  const end = NIB[1] + CELL * 4;
  return [
    c(proj, 0.05, 0.4),
    o(cells[0], 0.1, 0.5), o(cells[1], 0.25, 0.5),
    bits,
    o(BOX.map(([x, y]) => rect(x, y, 12, 14)).join(''), 0.6, 0.35),
    [...HEX].map((ch, i) => txt(BOX[i][0] + 6, BOX[i][1] + 7.6, ch, { b: 'central', cls: 'k', at: 0.85 })).join(''),
    txt(22, 48.6, '0b', { a: 'end', b: 'central', cls: 't t2', at: 0.45 }),
    txt(60, 83.6, '0x', { a: 'end', b: 'central', cls: 't t2', at: 0.85 }),
    dimH(NIB[0], end, 30, say(lang, '8 BITS', '8 BIT'), { ext: [[NIB[0], 40], [end, 40]] }),
  ].join('');
};
export default figure;

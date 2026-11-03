// F-105's plate: a portrait whose face is pixel blocks, a line of text blacked out, the block size.
import { c, h, o, f, dl, ah, txt, rect, circ, head, DIM_AT, type Figure } from '../../lib/plate.ts';

const figure: Figure = () => {
  const cells = ['FHHF', '.FF.', 'H..H', '.HH.'];
  let fill = '';
  let hatch = '';
  cells.forEach((row, ry) =>
    [...row].forEach((ch, cx) => {
      const x = 40 + cx * 8;
      const y = 28 + ry * 8;
      if (ch === 'F') fill += rect(x, y, 8, 8);
      if (ch === 'H') hatch += `M${x} ${y + 4}L${x + 4} ${y}M${x} ${y + 8}L${x + 8} ${y}M${x + 4} ${y + 8}L${x + 8} ${y + 4}`;
    }),
  );
  return [
    o(rect(20, 14, 72, 82), 0.05, 0.55),
    h(circ(56, 44, 14), 0.1),
    o('M32 96C32 79 43 70 56 70C69 70 80 79 80 96', 0.35, 0.45),
    o(rect(40, 28, 32, 32) + 'M48 28V60M56 28V60M64 28V60M40 36H72M40 44H72M40 52H72', 0.4, 0.55),
    f(fill, 0.8),
    `<path class="c" pathLength="1" d="${hatch}" style="--d:.75s;--t:.35s"/>`,
    c('M102 44H146M102 56H110M102 68H140M102 80H128', 0.1, 0.4),
    f(rect(114, 52.5, 32, 7), 0.85),
    dl('M40 26.4V20.4M48 26.4V20.4M33 23H48M48 23H97', DIM_AT),
    ah(head(40, 23, 0) + head(48, 23, 180), DIM_AT),
    txt(99, 23, '≥ 8 PX', { a: 'start', b: 'central' }),
  ].join('');
};
export default figure;

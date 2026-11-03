// F-308's plate: a screen, the lines rising past the reading line, the speed.
import { c, h, o, f, dl, ah, txt, g, rect, head, say, DIM_AT, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) => {
  const lines = [[24, 48], [32, 64], [40, 56], [48, 72], [56, 60], [64, 40], [72, 52]]
    .map(([y, w], i) => (y === 48 ? o : c)(`M${76 - w / 2} ${y}H${76 + w / 2}`, 0.35 + i * 0.06, 0.3))
    .join('');
  return [
    o(rect(28, 14, 96, 68), 0.05, 0.55), o('M76 82V92M62 92H90', 0.4, 0.2),
    h('M18 48H134', 0.1),
    f('M30.5 44.5L35.5 48L30.5 51.5ZM121.5 44.5L116.5 48L121.5 51.5Z', 0.5),
    g('rise', lines),
    dl('M140 78V27', DIM_AT), ah(head(140, 23, -90), DIM_AT),
    txt(152, 100, say(lang, '140 WPM', '140 W./MIN.'), { a: 'end', b: 'hanging' }),
  ].join('');
};
export default figure;

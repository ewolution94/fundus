// F-502's plate: the sign as a part, its rings as callout balloons for the two VAT rates.
import { cl, o, txt, circ, r2, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) => {
  const ux = 0.573;
  const uy = -0.819;
  const nx = 0.819 * 3.6;
  const ny = 0.573 * 3.6;
  const a = [80 - 40 * ux, 60 - 40 * uy];
  const b = [80 + 40 * ux, 60 + 40 * uy];
  const bar = `M${r2(a[0] - nx)} ${r2(a[1] - ny)}L${r2(b[0] - nx)} ${r2(b[1] - ny)}L${r2(b[0] + nx)} ${r2(b[1] + ny)}L${r2(a[0] + nx)} ${r2(a[1] + ny)}Z`;
  return [
    cl('M21 33H28M60 33H67M44 10V17M44 49V56M93 87H100M132 87H139M116 64V71M116 103V110', 0.05),
    o(circ(44, 33, 15), 0.15, 0.5), o(circ(116, 87, 15), 0.3, 0.5), o(bar, 0.45, 0.5),
    txt(44, 33.6, '19', { b: 'central', cls: 'k bal', at: 0.7 }),
    txt(116, 87.6, '7', { b: 'central', cls: 'k bal', at: 0.8 }),
    txt(8, 112, say(lang, 'NET · GROSS', 'NETTO · BRUTTO'), { a: 'start' }),
  ].join('');
};
export default figure;

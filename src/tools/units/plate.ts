// F-503's plate: a rule with a centimetre scale above and an inch scale below, one inch dimensioned on both.
import { c, o, rrect, r2, dimH, say, type Figure } from '../../lib/plate.ts';

const X0 = 18;
const CM = 10;
/** The inch, exactly 2.54 cm since 1959 (units.ts). */
const INCH = 2.54 * CM;
const TOP = 42;
const FOOT = 80;

const figure: Figure = (lang) => {
  let cmMajor = '';
  let cmMinor = '';
  for (let k = 0; X0 + k * (CM / 2) <= 142; k++) {
    const x = r2(X0 + k * (CM / 2));
    if (k % 2) cmMinor += `M${x} ${TOP}V${TOP + 4}`;
    else cmMajor += `M${x} ${TOP}V${TOP + 8}`;
  }
  let inMajor = '';
  let inMinor = '';
  for (let k = 0; X0 + k * (INCH / 4) <= 146; k++) {
    const x = r2(X0 + k * (INCH / 4));
    if (k % 4 === 0) inMajor += `M${x} ${FOOT}V${FOOT - 10}`;
    else inMinor += `M${x} ${FOOT}V${FOOT - (k % 2 ? 4 : 6.5)}`;
  }
  const one = X0 + INCH;
  return [
    o(rrect(12, TOP, 136, FOOT - TOP, 1.5), 0.05, 0.55),
    c(cmMinor, 0.3, 0.45), c(inMinor, 0.4, 0.45),
    o(cmMajor, 0.45, 0.4, 'linear'), o(inMajor, 0.6, 0.35, 'linear'),
    dimH(X0, one, TOP - 10, say(lang, '2.54 CM', '2,54 CM'), { ext: [[X0, TOP], [one, TOP]], lx: one + 4, la: 'start' }),
    dimH(X0, one, FOOT + 10, say(lang, '1 IN', '1 ZOLL'), { ext: [[X0, FOOT], [one, FOOT]], below: true, lx: one + 4, la: 'start' }),
  ].join('');
};
export default figure;

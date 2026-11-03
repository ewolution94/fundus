// F-302's plate: ragged lines with a double space (thin), the arrow, the same lines flush on the margin and single-spaced (bold).
import { c, o, cl, dl, ah, head, leader, say, DIM_AT, type Figure } from '../../lib/plate.ts';

// Each line as it came (its start, its words and the gap between them), and the same words cleaned.
const RAGGED = ['M24 30H62', 'M16 42H31M41 42H60', 'M20 54H64', 'M16 66H46', 'M28 78H56'];
const CLEAN = ['M96 30H134', 'M96 42H111M115 42H134', 'M96 54H140', 'M96 66H126', 'M96 78H124'];

const figure: Figure = (lang) =>
  [
    cl('M16 24V84M96 24V84', 0),
    RAGGED.map((d, i) => c(d, 0.05 + i * 0.05, 0.3)).join(''),
    dl('M70 54H84', 0.4), ah(head(88, 54, 0), 0.4),
    CLEAN.map((d, i) => o(d, 0.45 + i * 0.07, 0.32)).join(''),
    leader(77, 54, 72, 94, say(lang, '8 STEPS', '8 SCHRITTE'), { at: DIM_AT }),
  ].join('');
export default figure;

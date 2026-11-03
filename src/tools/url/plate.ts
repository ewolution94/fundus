// F-903's plate: two words and the space between them, the space drawn out to %20 below.
import { c, o, txt, rrect, leader, say, type Figure } from '../../lib/plate.ts';

const figure: Figure = (lang) =>
  [
    c(rrect(26, 30, 28, 12, 1.5) + rrect(74, 30, 28, 12, 1.5), 0, 0.4),
    o('M59 35V40H69V35', 0.15, 0.25),
    c('M58 44L52 72M70 44L88 72', 0.3, 0.3),
    o(rrect(20, 74, 28, 12, 1.5), 0.4, 0.35), o(rrect(52, 74, 36, 12, 1.5), 0.5, 0.35), o(rrect(92, 74, 28, 12, 1.5), 0.6, 0.35),
    txt(70, 80.4, '%20', { b: 'central', cls: 'k', at: 0.85 }),
    leader(64, 40, 70, 16, say(lang, 'SPACE', 'LEERZEICHEN')),
  ].join('');
export default figure;

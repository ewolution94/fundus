// F-507's plate: an amount in figures, the same written out on the line, its Roman numeral called out.
import { c, o, leader, type Figure } from '../../lib/plate.ts';

const figure: Figure = () =>
  [
    c('M24 92H112', 0.05, 0.4),
    o('M44 28L54 20V58', 0.1, 0.35, null, 'dg'),
    o('M66 28C67 17 86 17 86 29C86 41 66 46 66 58H88', 0.25, 0.45, null, 'dg'),
    o(
      'M26 86C29 80 32 73 35 74C38 75 33 85 36 86C39 87 41 78 44 78C47 78 45 86 48 86C51 86 53 76 56 76C59 76 57 85 60 85C62 85 63 82 65 81' +
        'M71 84C73 80 75 79 77 80C79 81 76 86 79 86C82 86 83 80 86 80C89 80 87 86 90 86C93 86 94 81 97 81C99 81 100 83 102 82',
      0.4,
      0.55,
      'cubic-bezier(.4,.1,.4,1)',
    ),
    leader(87, 36, 104, 26, 'XII'),
  ].join('');
export default figure;

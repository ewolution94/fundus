// What Amount in words does: a number in German or English words (an amount for a contract or a
// cheque), and Roman numerals both ways. Plain TypeScript with erasable types, tested in node.
//
// German, as contracts and cheques write it: lower case, one word below a million
// ("eintausendzweihundertfünfzig"), "eins" alone but "ein" before hundert and tausend and in
// "ein Euro", "eine Million", "zwei Millionen", the currency with its capital ("Euro", "Cent").
// English is British: "one thousand two hundred and fifty euros and fifty cents".

export type Lang = 'de' | 'en';
export type Currency = 'eur' | 'usd' | 'none';

/** The largest amount it writes: 999,999,999,999.99. */
export const MAX = 999_999_999_999.99;

// ── German ─────────────────────────────────────────────────────────────────────────────

const DE_ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const DE_TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

/** How a final 1 is said: "eins" alone, "ein" before tausend or a noun, "eine" before Million. */
type One = 'eins' | 'ein' | 'eine';

function deBelow100(n: number, one: One): string {
  if (n === 1) return one;
  if (n < 20) return DE_ONES[n];
  const unit = n % 10;
  const tens = DE_TENS[Math.floor(n / 10)];
  return unit ? `${unit === 1 ? 'ein' : DE_ONES[unit]}und${tens}` : tens;
}

function deBelow1000(n: number, one: One): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return (h ? `${h === 1 ? 'ein' : DE_ONES[h]}hundert` : '') + (rest ? deBelow100(rest, one) : '');
}

/** Below a million, as one word. */
function deBelowMillion(n: number, one: One): string {
  const t = Math.floor(n / 1000);
  const rest = n % 1000;
  return (t ? `${deBelow1000(t, 'ein')}tausend` : '') + (rest ? deBelow1000(rest, one) : '');
}

/** A whole number in German words; `one` is how a final 1 is said ("eins", or "ein" before Euro). */
export function germanWhole(n: number, one: One = 'eins'): string {
  if (n === 0) return 'null';
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor(n / 1e6) % 1000;
  const rest = n % 1e6;
  if (billions) parts.push(billions === 1 ? 'eine Milliarde' : `${deBelow1000(billions, 'eine')} Milliarden`);
  if (millions) parts.push(millions === 1 ? 'eine Million' : `${deBelow1000(millions, 'eine')} Millionen`);
  if (rest) parts.push(deBelowMillion(rest, n === 1 ? one : 'eins'));
  return parts.join(' ');
}

// ── English ────────────────────────────────────────────────────────────────────────────

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enBelow100(n: number): string {
  if (n < 20) return EN_ONES[n];
  const unit = n % 10;
  return EN_TENS[Math.floor(n / 10)] + (unit ? `-${EN_ONES[unit]}` : '');
}

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return enBelow100(rest);
  return `${EN_ONES[h]} hundred` + (rest ? ` and ${enBelow100(rest)}` : '');
}

/** A whole number in British English words: "one thousand and one", "two million and one". */
export function englishWhole(n: number): string {
  if (n === 0) return 'zero';
  const groups: [number, string][] = [
    [Math.floor(n / 1e9), 'billion'],
    [Math.floor(n / 1e6) % 1000, 'million'],
    [Math.floor(n / 1000) % 1000, 'thousand'],
  ];
  const parts: string[] = [];
  for (const [value, name] of groups) if (value) parts.push(`${enBelow1000(value)} ${name}`);
  const rest = n % 1000;
  // British: "and" before a last part under a hundred that follows a bigger one.
  if (rest) parts.push(parts.length && rest < 100 ? `and ${enBelow100(rest)}` : enBelow1000(rest));
  return parts.join(' ');
}

// ── An amount ──────────────────────────────────────────────────────────────────────────

const NAMES: Record<Lang, Record<Exclude<Currency, 'none'>, { one: string; many: string; cent: string; cents: string }>> = {
  de: { eur: { one: 'Euro', many: 'Euro', cent: 'Cent', cents: 'Cent' }, usd: { one: 'Dollar', many: 'Dollar', cent: 'Cent', cents: 'Cent' } },
  en: { eur: { one: 'euro', many: 'euros', cent: 'cent', cents: 'cents' }, usd: { one: 'dollar', many: 'dollars', cent: 'cent', cents: 'cents' } },
};

const DIGITS: Record<Lang, string[]> = {
  de: ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'],
  en: EN_ONES.slice(0, 10),
};

export interface Options {
  lang: Lang;
  currency: Currency;
  /** The cents as a fraction, the way a cheque writes them: "… euros and 50/100". */
  cheque?: boolean;
}

export type Spelt = { words: string } | { error: 'nan' | 'range' };

/**
 * A number in words. With a currency it's rounded to the cent ("eintausendzweihundertfünfzig Euro
 * und fünfzig Cent"); without one, decimals are read digit by digit ("eins Komma fünf",
 * "one point five"), up to six.
 */
export function inWords(value: number, { lang, currency, cheque = false }: Options): Spelt {
  if (!Number.isFinite(value)) return { error: 'nan' };
  const negative = value < 0;
  const abs = Math.abs(value);
  // Cents, without float drift: 1250.5 is 125050 cents, 0.29 is 29.
  const cents = Math.round(abs * 100 + 1e-7);
  if (cents > Math.round(MAX * 100)) return { error: 'range' };
  const minus = negative && (currency !== 'none' || cheque ? cents > 0 : abs > 0) ? 'minus ' : '';
  const whole = (n: number, one: One = 'eins') => (lang === 'de' ? germanWhole(n, one) : englishWhole(n));

  if (currency === 'none' && !cheque) {
    // Up to six decimals, and no more digits in all than a double holds (15), so
    // 999,999,999,999.99 doesn't read as …,989990.
    const intDigits = Math.max(1, Math.floor(abs).toString().length);
    const text = abs.toFixed(Math.max(0, Math.min(6, 15 - intDigits))).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    const [int, frac = ''] = text.split('.');
    if (Number(int) > Math.floor(MAX)) return { error: 'range' };
    let words = whole(Number(int));
    if (frac) words += ` ${lang === 'de' ? 'Komma' : 'point'} ${[...frac].map((d) => DIGITS[lang][Number(d)]).join(' ')}`;
    return { words: minus + words };
  }

  const units = Math.floor(cents / 100);
  const rest = cents % 100;
  if (cheque) {
    const name = currency === 'none' ? '' : units === 1 ? NAMES[lang][currency].one : NAMES[lang][currency].many;
    const amount = whole(units, currency === 'none' ? 'eins' : 'ein');
    const fraction = `${String(rest).padStart(2, '0')}/100`;
    const words = lang === 'de' ? [amount, name, fraction].filter(Boolean).join(' ') : [amount, name, 'and', fraction].filter(Boolean).join(' ');
    return { words: minus + words };
  }

  const n = NAMES[lang][currency as Exclude<Currency, 'none'>];
  const main = `${whole(units, 'ein')} ${units === 1 ? n.one : n.many}`;
  const small = rest ? `${whole(rest, 'ein')} ${rest === 1 ? n.cent : n.cents}` : '';
  if (!units && small) return { words: minus + small };
  const and = lang === 'de' ? 'und' : 'and';
  return { words: minus + (small ? `${main} ${and} ${small}` : main) };
}

/**
 * The words with soft hyphens where a long German number word may break across lines
 * ("eintausend-|zweihundertfünfzig"), for showing; Copy takes the words without them.
 */
export function breakable(words: string): string {
  return words
    .replace(/(hundert|tausend)(?=\p{L})/gu, '$1\u00ad')
    .replace(/(?<=\p{Ll})tausend/gu, '\u00adtausend')
    .replace(/(?<!h)und(?=\p{Ll})/gu, 'und\u00ad');
}

// ── Roman numerals ─────────────────────────────────────────────────────────────────────

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** 1–3,999 as a Roman numeral, or null. */
export function toRoman(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return null;
  let out = '';
  let left = n;
  for (const [value, letters] of ROMAN) {
    while (left >= value) {
      out += letters;
      left -= value;
    }
  }
  return out;
}

const LETTER: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export type RomanRead =
  | { value: number; canonical: string; valid: true }
  /** Letters that add up, written another way than the usual ("IIII" is usually IV). */
  | { value: number; canonical: string; valid: false }
  | { error: 'letters' | 'range' };

/** A Roman numeral (upper or lower case) as a number. */
export function fromRoman(input: string): RomanRead {
  const s = input.trim().toUpperCase();
  if (!s || !/^[IVXLCDM]+$/.test(s)) return { error: 'letters' };
  let value = 0;
  for (let i = 0; i < s.length; i++) {
    const v = LETTER[s[i]];
    const next = LETTER[s[i + 1]] ?? 0;
    value += v < next ? -v : v;
  }
  const canonical = toRoman(value);
  if (!canonical) return { error: 'range' };
  return { value, canonical, valid: canonical === s };
}

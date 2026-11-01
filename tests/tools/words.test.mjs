import { test } from 'node:test';
import assert from 'node:assert/strict';
import { germanWhole, englishWhole, inWords, breakable, toRoman, fromRoman, MAX } from '../../src/tools/words/words.ts';

const say = (value, lang, currency = 'none', cheque = false) => {
  const r = inWords(value, { lang, currency, cheque });
  return 'words' in r ? r.words : r.error;
};

test('German whole numbers: one word below a million, eins alone, ein before hundert and tausend', () => {
  const cases = {
    0: 'null',
    1: 'eins',
    7: 'sieben',
    11: 'elf',
    12: 'zwölf',
    16: 'sechzehn',
    17: 'siebzehn',
    21: 'einundzwanzig',
    30: 'dreißig',
    31: 'einunddreißig',
    99: 'neunundneunzig',
    100: 'einhundert',
    101: 'einhunderteins',
    111: 'einhundertelf',
    200: 'zweihundert',
    999: 'neunhundertneunundneunzig',
    1000: 'eintausend',
    1001: 'eintausendeins',
    1250: 'eintausendzweihundertfünfzig',
    2021: 'zweitausendeinundzwanzig',
    21000: 'einundzwanzigtausend',
    101000: 'einhunderteintausend',
    999999: 'neunhundertneunundneunzigtausendneunhundertneunundneunzig',
    1000000: 'eine Million',
    1000001: 'eine Million eins',
    2000001: 'zwei Millionen eins',
    21000000: 'einundzwanzig Millionen',
    3500000: 'drei Millionen fünfhunderttausend',
    1000000000: 'eine Milliarde',
    2000000000: 'zwei Milliarden',
    1002003004: 'eine Milliarde zwei Millionen dreitausendvier',
  };
  for (const [n, words] of Object.entries(cases)) assert.equal(germanWhole(Number(n)), words, n);
});

test('British English whole numbers, with "and" after hundred and before a last part under 100', () => {
  const cases = {
    0: 'zero',
    1: 'one',
    13: 'thirteen',
    21: 'twenty-one',
    40: 'forty',
    101: 'one hundred and one',
    110: 'one hundred and ten',
    200: 'two hundred',
    1000: 'one thousand',
    1001: 'one thousand and one',
    1250: 'one thousand two hundred and fifty',
    21000: 'twenty-one thousand',
    101000: 'one hundred and one thousand',
    1000000: 'one million',
    2000001: 'two million and one',
    1000100: 'one million one hundred',
    1000000000: 'one billion',
    999999999999: 'nine hundred and ninety-nine billion nine hundred and ninety-nine million nine hundred and ninety-nine thousand nine hundred and ninety-nine',
  };
  for (const [n, words] of Object.entries(cases)) assert.equal(englishWhole(Number(n)), words, n);
});

test('amounts in Euro and Dollar, German', () => {
  assert.equal(say(1, 'de', 'eur'), 'ein Euro');
  assert.equal(say(21, 'de', 'eur'), 'einundzwanzig Euro');
  assert.equal(say(101, 'de', 'eur'), 'einhunderteins Euro');
  assert.equal(say(1000, 'de', 'eur'), 'eintausend Euro');
  assert.equal(say(1250.5, 'de', 'eur'), 'eintausendzweihundertfünfzig Euro und fünfzig Cent');
  assert.equal(say(1000000, 'de', 'eur'), 'eine Million Euro');
  assert.equal(say(2000001, 'de', 'eur'), 'zwei Millionen eins Euro');
  assert.equal(say(0.01, 'de', 'eur'), 'ein Cent');
  assert.equal(say(1.01, 'de', 'eur'), 'ein Euro und ein Cent');
  assert.equal(say(0, 'de', 'eur'), 'null Euro');
  assert.equal(say(19.99, 'de', 'usd'), 'neunzehn Dollar und neunundneunzig Cent');
});

test('amounts in Euro and Dollar, English', () => {
  assert.equal(say(1, 'en', 'eur'), 'one euro');
  assert.equal(say(21, 'en', 'eur'), 'twenty-one euros');
  assert.equal(say(101, 'en', 'eur'), 'one hundred and one euros');
  assert.equal(say(1000, 'en', 'eur'), 'one thousand euros');
  assert.equal(say(1250.5, 'en', 'eur'), 'one thousand two hundred and fifty euros and fifty cents');
  assert.equal(say(1000000, 'en', 'eur'), 'one million euros');
  assert.equal(say(2000001, 'en', 'eur'), 'two million and one euros');
  assert.equal(say(0.01, 'en', 'eur'), 'one cent');
  assert.equal(say(1.01, 'en', 'usd'), 'one dollar and one cent');
  assert.equal(say(0.29, 'en', 'usd'), 'twenty-nine cents', 'no float drift: 0.29 is 29 cents');
});

test('no currency: decimals digit by digit', () => {
  assert.equal(say(1250.5, 'de'), 'eintausendzweihundertfünfzig Komma fünf');
  assert.equal(say(0.01, 'de'), 'null Komma null eins');
  assert.equal(say(0.01, 'en'), 'zero point zero one');
  assert.equal(say(3.14159, 'en'), 'three point one four one five nine');
  assert.equal(say(999999999999.99, 'de'), 'neunhundertneunundneunzig Milliarden neunhundertneunundneunzig Millionen neunhundertneunundneunzigtausendneunhundertneunundneunzig Komma neun neun');
});

test('the cheque form: the cents as a fraction', () => {
  assert.equal(say(1250.5, 'en', 'eur', true), 'one thousand two hundred and fifty euros and 50/100');
  assert.equal(say(1250.5, 'de', 'eur', true), 'eintausendzweihundertfünfzig Euro 50/100');
  assert.equal(say(1, 'de', 'eur', true), 'ein Euro 00/100');
  assert.equal(say(1, 'en', 'usd', true), 'one dollar and 00/100');
  assert.equal(say(0.07, 'en', 'usd', true), 'zero dollars and 07/100');
  assert.equal(say(12, 'en', 'none', true), 'twelve and 00/100');
  assert.equal(say(12.3, 'de', 'none', true), 'zwölf 30/100');
});

test('negative, rounded to the cent, out of range, not a number', () => {
  assert.equal(say(-12.5, 'de', 'eur'), 'minus zwölf Euro und fünfzig Cent');
  assert.equal(say(-12.5, 'en'), 'minus twelve point five');
  assert.equal(say(-0.001, 'en', 'eur'), 'zero euros', 'nothing left to be negative');
  assert.equal(say(0.125, 'en', 'eur'), 'thirteen cents');
  assert.equal(say(MAX, 'en', 'eur'), 'nine hundred and ninety-nine billion nine hundred and ninety-nine million nine hundred and ninety-nine thousand nine hundred and ninety-nine euros and ninety-nine cents');
  assert.equal(say(-MAX, 'de', 'eur').startsWith('minus neunhundertneunundneunzig Milliarden'), true);
  assert.equal(say(1e12, 'en', 'eur'), 'range');
  assert.equal(say(999999999999.995, 'en', 'eur'), 'range');
  assert.equal(say(1e12, 'de'), 'range');
  assert.equal(say(NaN, 'de', 'eur'), 'nan');
});

test('long German words may break at their joins when shown', () => {
  assert.equal(breakable('eintausendzweihundertfünfzig Euro').replace(/­/g, '|'), 'ein|tausend|zweihundert|fünfzig Euro');
  assert.equal(breakable('einundzwanzig').replace(/­/g, '|'), 'einund|zwanzig');
  assert.equal(breakable('einhundert').replace(/­/g, '|'), 'einhundert', 'not inside hundert');
  assert.equal(breakable('one thousand two hundred and fifty'), 'one thousand two hundred and fifty');
});

test('Roman numerals: 1 to 3,999 and back, upper or lower case', () => {
  const cases = { 1: 'I', 4: 'IV', 9: 'IX', 14: 'XIV', 40: 'XL', 90: 'XC', 400: 'CD', 1984: 'MCMLXXXIV', 1994: 'MCMXCIV', 2026: 'MMXXVI', 3888: 'MMMDCCCLXXXVIII', 3999: 'MMMCMXCIX' };
  for (const [n, roman] of Object.entries(cases)) {
    assert.equal(toRoman(Number(n)), roman, n);
    assert.deepEqual(fromRoman(roman), { value: Number(n), canonical: roman, valid: true });
    assert.equal(fromRoman(roman.toLowerCase()).value, Number(n));
  }
  for (let n = 1; n <= 3999; n++) assert.equal(fromRoman(toRoman(n)).value, n);
  assert.equal(toRoman(0), null);
  assert.equal(toRoman(4000), null);
  assert.equal(toRoman(1.5), null);
  assert.equal(toRoman(-3), null);
});

test('Roman numerals written another way, or not at all', () => {
  assert.deepEqual(fromRoman('IIII'), { value: 4, canonical: 'IV', valid: false });
  assert.deepEqual(fromRoman('VV'), { value: 10, canonical: 'X', valid: false });
  assert.deepEqual(fromRoman('IC'), { value: 99, canonical: 'XCIX', valid: false });
  assert.deepEqual(fromRoman(' xiv '), { value: 14, canonical: 'XIV', valid: true });
  assert.deepEqual(fromRoman('MMMM'), { error: 'range' });
  assert.deepEqual(fromRoman('MXQ'), { error: 'letters' });
  assert.deepEqual(fromRoman(''), { error: 'letters' });
});

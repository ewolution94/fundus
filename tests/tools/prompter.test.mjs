import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countWords, clampWpm, durationMs, pxPerSecond, timeLeftMs, clock, estimate, jump, MIN_WPM, MAX_WPM, DEFAULT_WPM } from '../../src/tools/prompter/prompter.ts';

test('words as people count them, German too', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   \n\t '), 0);
  assert.equal(countWords('Guten Morgen'), 2);
  assert.equal(countWords('Grüß Gott, schöne Straße – 3 Äpfel.'), 6, 'umlauts and ß are letters; a lone dash isn’t a word');
  assert.equal(countWords('Die Straßen-Bahn kostet 3,50 €.'), 4, 'a hyphenated word is one, a lone € none');
  assert.equal(countWords('Erstens:\n\n• Mut\n• Geduld'), 3, 'bullets aren’t words');
  assert.equal(countWords('z. B. „so“'), 3);
  assert.equal(countWords('l’été dernier'), 2);
});

test('the speed stays within 60 and 250 words a minute', () => {
  assert.equal(clampWpm(140), 140);
  assert.equal(clampWpm(10), MIN_WPM);
  assert.equal(clampWpm(1000), MAX_WPM);
  assert.equal(clampWpm(144.6), 145, 'whole words');
  assert.equal(clampWpm(NaN), DEFAULT_WPM);
  assert.equal(clampWpm(Infinity), DEFAULT_WPM);
  assert.equal(DEFAULT_WPM, 140);
});

test('how long a text takes', () => {
  assert.equal(durationMs(140, 140), 60_000);
  assert.equal(durationMs(70, 140), 30_000);
  assert.equal(durationMs(0, 140), 0);
  assert.equal(durationMs(100, 20), (100 / 60) * 60_000, 'a speed below the floor is read as the floor');
  assert.equal(estimate(373, 140), '2:40', '373 words at 140 a minute: 2:39.9, about 2:40');
  assert.equal(estimate(10, 140), '0:05', 'never under five seconds');
  assert.equal(estimate(1, 250), '0:05');
  assert.equal(estimate(0, 140), '');
  assert.equal(estimate(9000, 140), '1:04:15');
});

test('px a second from the measured height', () => {
  // 1,400 px of text holding 140 words, read at 140 a minute: the whole height in a minute.
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  near(pxPerSecond(1400, 140, 140), 1400 / 60);
  near(pxPerSecond(1400, 140, 70), 1400 / 120);
  assert.equal(pxPerSecond(0, 140, 140), 0);
  assert.equal(pxPerSecond(1400, 0, 140), 0);
  // The time to cross the height at that speed is the estimate.
  const height = 5321;
  const words = 373;
  assert.ok(Math.abs((height / pxPerSecond(height, words, 140)) * 1000 - durationMs(words, 140)) < 1e-6);
});

test('time left from where the text stands', () => {
  assert.equal(timeLeftMs(0, 140, 140), 60_000);
  assert.equal(timeLeftMs(0.5, 140, 140), 30_000);
  assert.equal(timeLeftMs(1, 140, 140), 0);
  assert.equal(timeLeftMs(1.2, 140, 140), 0, 'past the end is the end');
  assert.equal(timeLeftMs(-1, 140, 140), 60_000);
  assert.equal(timeLeftMs(0.25, 140, 200), 31_500, 'a faster speed shortens what’s left');
  assert.equal(timeLeftMs(0, 140, 400), 33_600, 'at most 250 a minute');
  assert.equal(clock(60_000), '1:00');
  assert.equal(clock(59_001), '1:00', 'seconds round up');
  assert.equal(clock(1), '0:01');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(3_723_000), '1:02:03');
});

test('a jump stays inside the text', () => {
  assert.equal(jump(100, 50, 1000), 150);
  assert.equal(jump(100, -500, 1000), 0);
  assert.equal(jump(900, 500, 1000), 1000);
  assert.equal(jump(0, -Infinity, 1000), 0);
});

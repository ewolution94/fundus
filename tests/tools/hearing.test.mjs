// F-602 Hearing test: the sweep's maths, the device's top, the median of three runs, the rough guide
// by age, the tone slider's log scale both ways, and the gain that never passes its ceiling.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freqAt, timeAt, topFor, median, roundHz, resultOf, typicalAge, sliderToHz, hzToSlider, tidyHz, clampHz, gainFor, panFor, CEILING, START_HZ, MAX_HZ, GUIDE, SLIDER_STEPS, TONE_MIN, TONE_MAX } from '../../src/tools/hearing/hearing.ts';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('the sweep climbs a quarter octave a second from 2 kHz', () => {
  assert.equal(freqAt(0), START_HZ);
  near(freqAt(4), 4000);
  near(freqAt(8), 8000);
  near(freqAt(12), 16000);
  near(freqAt(2), 2000 * Math.SQRT2);
  assert.equal(freqAt(-3), START_HZ, 'nothing below the start');
  near(timeAt(16000), 12);
  near(timeAt(22000), 4 * Math.log2(11));
  for (const t of [0.5, 3.3, 7, 13.1]) near(timeAt(freqAt(t)), t, 1e-9);
  assert.equal(timeAt(1000), 0);
});

test('the top a device plays', () => {
  assert.equal(topFor(48000), MAX_HZ, '22,800 would be allowed: 22 kHz at most');
  assert.equal(topFor(44100), 20947);
  assert.equal(topFor(32000), 15200);
  assert.equal(topFor(96000), MAX_HZ);
});

test('the median of three, and of any count', () => {
  assert.equal(median([15200, 16100, 15600]), 15600);
  assert.equal(median([3, 1, 2, 4]), 2.5);
  assert.ok(Number.isNaN(median([])));
  assert.equal(roundHz(15649), 15600);
  assert.equal(roundHz(15650), 15700);
  assert.equal(resultOf([{ hz: 15000, top: false }, { hz: 15500, top: false }]), null, 'not before three runs');
  assert.deepEqual(resultOf([{ hz: 16100, top: false }, { hz: 15200, top: false }, { hz: 15600, top: false }]), { hz: 15600, top: false });
  assert.deepEqual(resultOf([{ hz: 22000, top: true }, { hz: 15200, top: false }, { hz: 22000, top: true }]), { hz: 22000, top: true }, 'the top, when the middle run reached it');
  assert.deepEqual(resultOf([{ hz: 22000, top: true }, { hz: 15200, top: false }, { hz: 14000, top: false }]), { hz: 15200, top: false });
});

test('the rough guide by age', () => {
  assert.equal(typicalAge(19000), 'u20');
  assert.equal(typicalAge(21000), 'u20', 'above the guide: young');
  assert.equal(typicalAge(16000), '30');
  assert.equal(typicalAge(14500), '40');
  assert.equal(typicalAge(12100), '50');
  assert.equal(typicalAge(10500), '60');
  assert.equal(typicalAge(8500), '70');
  assert.equal(typicalAge(4000), '70', 'below the guide: the oldest row');
  assert.equal(typicalAge(11600), '50', 'between rows: the nearest edge');
  assert.equal(typicalAge(11400), '60');
  // The guide runs down with age.
  for (let i = 1; i < GUIDE.length; i++) assert.ok(GUIDE[i].hi <= GUIDE[i - 1].lo);
});

test('the tone slider is logarithmic, both ways', () => {
  near(sliderToHz(0), TONE_MIN);
  near(sliderToHz(SLIDER_STEPS), TONE_MAX, 1e-6);
  near(sliderToHz(SLIDER_STEPS / 2), Math.sqrt(TONE_MIN * TONE_MAX), 1e-6);
  near(sliderToHz(SLIDER_STEPS / 3), 200, 1e-6);
  assert.equal(hzToSlider(20), 0);
  assert.equal(hzToSlider(20000), SLIDER_STEPS);
  assert.equal(hzToSlider(200), Math.round(SLIDER_STEPS / 3));
  for (const hz of [20, 55, 440, 1000, 17400, 20000]) {
    const back = sliderToHz(hzToSlider(hz));
    assert.ok(Math.abs(Math.log2(back / hz)) < 0.006, `${hz} → ${back}`);
  }
  assert.equal(hzToSlider(5), 0, 'clamped below');
  assert.equal(hzToSlider(50000), SLIDER_STEPS, 'clamped above');
  assert.equal(sliderToHz(-10), TONE_MIN);
  assert.equal(clampHz(30000), TONE_MAX);
  assert.equal(tidyHz(440.4), 440);
  assert.equal(tidyHz(55.55), 55.6);
});

test('the gain never passes the ceiling', () => {
  assert.equal(CEILING, 0.3);
  assert.equal(gainFor(1), CEILING);
  assert.equal(gainFor(5), CEILING, 'asked for too much: the ceiling');
  assert.equal(gainFor(-1), 0);
  assert.equal(gainFor(NaN), 0);
  assert.equal(gainFor(Infinity), 0);
  near(gainFor(0.25), 0.075);
  for (const wave of ['sine', 'square', 'triangle', 'sawtooth']) {
    for (let v = 0; v <= 1.5; v += 0.05) assert.ok(gainFor(v, wave) <= CEILING && gainFor(v, wave) >= 0);
  }
  assert.ok(gainFor(1, 'square') < gainFor(1, 'sine'), 'a square wave is turned down');
  assert.deepEqual(['left', 'right', 'both'].map(panFor), [-1, 1, 0]);
});

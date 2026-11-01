import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  overLimit,
  limitMinutes,
  formatTime,
  formatLength,
  parseTime,
  setEdge,
  isTrimmed,
  spanKey,
  sampleRange,
  whole,
  peaks,
  toInt16,
  pcm,
  interleave,
  wavHeader,
  wav,
  wavBytes,
  mp3Bytes,
  outChannels,
  formatName,
  formatRate,
  suffixFor,
  RATE,
} from '../../src/tools/audio/audio.ts';

test('the length limit: an hour on a computer, twenty minutes on a phone', () => {
  assert.equal(limitMinutes(false), 60);
  assert.equal(limitMinutes(true), 20);
  assert.equal(overLimit(74 * 60 - 20, false), 74);
  assert.equal(overLimit(60 * 60, false), null);
  assert.equal(overLimit(74 * 60 + 2, false), 74, 'a browser’s estimate a little over stays 74');
  assert.equal(overLimit(60 * 60 + 1, false), 60.1, 'just over: a tenth more, never “60 minutes is longer than 60”');
  assert.equal(overLimit(60 * 60 + 40, false), 61);
  assert.equal(overLimit(20 * 60, true), null);
  assert.equal(overLimit(20 * 60 + 30, true), 21);
  assert.equal(overLimit(NaN, true), null, 'an unknown length is decided after decoding');
  assert.equal(overLimit(Infinity, false), null);
});

test('times as m:ss.s, with either decimal mark', () => {
  assert.equal(formatTime(0), '0:00.0');
  assert.equal(formatTime(3.4133), '0:03.4');
  assert.equal(formatTime(59.96), '1:00.0');
  assert.equal(formatTime(725), '12:05.0');
  assert.equal(formatTime(3600), '60:00.0');
  assert.equal(formatTime(6.05, 'comma'), '0:06,1');
  assert.equal(formatTime(-1), '0:00.0');
});

test('lengths as people read them', () => {
  assert.equal(formatLength(3.4133), '3.4 s');
  assert.equal(formatLength(6, 'comma'), '6,0 s');
  assert.equal(formatLength(125.4), '2:05');
  assert.equal(formatLength(3725), '1:02:05');
});

test('typed times are read leniently', () => {
  assert.equal(parseTime('1:05.3'), 65.3);
  assert.equal(parseTime(' 1:05,3 '), 65.3);
  assert.equal(parseTime('65.3'), 65.3);
  assert.equal(parseTime('0:05'), 5);
  assert.equal(parseTime('2:5'), 125);
  assert.equal(parseTime('.5'), 0.5);
  assert.equal(parseTime('1:02:03'), 3723);
  for (const bad of ['', 'abc', '1:75', '1:2:3:4', '-3', '1:', ':30']) assert.ok(Number.isNaN(parseTime(bad)), bad);
  for (const t of [0, 3.4, 59.9, 61.2, 725.5]) assert.equal(parseTime(formatTime(t)), t, `round trip of ${t}`);
});

test('an edge moves in tenths, stays inside, and never meets the other', () => {
  const d = 6.0133;
  const all = whole(d);
  assert.deepEqual(setEdge(all, 'start', 1.234, d), { start: 1.2, end: d });
  assert.deepEqual(setEdge(all, 'start', -4, d), { start: 0, end: d });
  assert.deepEqual(setEdge(all, 'end', 2.46, d), { start: 0, end: 2.5 });
  assert.deepEqual(setEdge(all, 'end', 99, d), { start: 0, end: d });
  assert.deepEqual(setEdge(all, 'end', 5.98, d), { start: 0, end: d }, 'close to the end is the end');
  const part = { start: 2, end: 3 };
  assert.deepEqual(setEdge(part, 'start', 3.5, d), { start: 2.9, end: 3 }, 'at least a tenth stays');
  assert.deepEqual(setEdge(part, 'end', 1, d), { start: 2, end: 2.1 });
  assert.deepEqual(setEdge(part, 'start', NaN, d), part);
});

test('a trim is part of the key; the whole sound is "all"', () => {
  const d = 6.0133;
  assert.equal(isTrimmed(whole(d), d), false);
  assert.equal(spanKey(whole(d), d), 'all');
  assert.equal(isTrimmed({ start: 0.1, end: d }, d), true);
  assert.equal(spanKey({ start: 1, end: 2.5 }, d), '1.00-2.50');
  assert.notEqual(spanKey({ start: 1, end: 2.5 }, d), spanKey({ start: 1, end: 2.6 }, d));
});

test('a span in samples, inside the sound', () => {
  assert.deepEqual(sampleRange({ start: 1, end: 2.5 }, 10 * RATE), [RATE, 2.5 * RATE]);
  assert.deepEqual(sampleRange({ start: 0, end: 6.0133 }, 265_187), [0, 265_187]);
  assert.deepEqual(sampleRange({ start: 9, end: 12 }, 5 * RATE), [5 * RATE, 5 * RATE]);
});

test('peaks: the loudest sample per part, over every channel, a slice at a time alike', () => {
  const n = 1000;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  left[50] = 0.5;
  right[150] = -0.8;
  left[999] = 1.7;
  const p = peaks([left, right], 10);
  assert.equal(p.length, 10);
  assert.equal(p[0], 0.5);
  assert.ok(Math.abs(p[1] - 0.8) < 1e-6);
  assert.equal(p[5], 0);
  assert.equal(p[9], 1, 'clipped to 1');
  const sliced = new Float32Array(10);
  peaks([left, right], 10, sliced, 0, 4);
  peaks([left, right], 10, sliced, 4, 10);
  assert.deepEqual([...sliced], [...p]);
  // More parts than samples still gives a value for each.
  assert.equal(peaks([new Float32Array([0.25, 0.5])], 5).length, 5);
});

test('floats to 16 bits, clipped, and nothing for NaN', () => {
  assert.equal(toInt16(0), 0);
  assert.equal(toInt16(1), 32767);
  assert.equal(toInt16(-1), -32767);
  assert.equal(toInt16(3), 32767);
  assert.equal(toInt16(-3), -32767);
  assert.equal(toInt16(0.5), 16384);
  assert.equal(toInt16(NaN), 0);
});

test('mono stays mono, stereo stereo, more mixes down to stereo', () => {
  assert.equal(outChannels(1), 1);
  assert.equal(outChannels(2), 2);
  assert.equal(outChannels(6), 2);
  const mono = pcm([new Float32Array([0, 0.5, -0.5, 1])], 1, 3);
  assert.equal(mono.length, 1);
  assert.deepEqual([...mono[0]], [16384, -16384]);
  const stereo = pcm([new Float32Array([0.25, 0.5]), new Float32Array([-0.25, -0.5])], 0, 2);
  assert.deepEqual(stereo.map((c) => [...c]), [[8192, 16384], [-8192, -16384]]);
  // 5.1: L R C LFE SL SR. Centre and surrounds at −3 dB, the LFE dropped.
  const ch = (v) => new Float32Array([v]);
  const [l, r] = pcm([ch(0.2), ch(0.1), ch(0.2), ch(0.9), ch(0.1), ch(0.3)], 0, 1);
  assert.equal(l[0], toInt16(0.2 + Math.SQRT1_2 * 0.2 + Math.SQRT1_2 * 0.1));
  assert.equal(r[0], toInt16(0.1 + Math.SQRT1_2 * 0.2 + Math.SQRT1_2 * 0.3));
  // Quad: L R SL SR, halved into the sides.
  const [ql, qr] = pcm([ch(0.4), ch(0.2), ch(0.2), ch(0.6)], 0, 1);
  assert.deepEqual([ql[0], qr[0]], [toInt16(0.3), toInt16(0.4)]);
  // Three: L R C.
  const [tl] = pcm([ch(0.1), ch(0), ch(0.2)], 0, 1);
  assert.equal(tl[0], toInt16(0.1 + Math.SQRT1_2 * 0.2));
});

test('interleaving: L R L R', () => {
  assert.deepEqual([...interleave([new Int16Array([1, 2, 3]), new Int16Array([-1, -2, -3])])], [1, -1, 2, -2, 3, -3]);
  const one = new Int16Array([4, 5]);
  assert.equal(interleave([one]), one);
});

test('a WAV: RIFF, PCM 16-bit, the channels, 44.1 kHz and the data that follows', () => {
  const h = new DataView(wavHeader(1000, 2).buffer);
  const ascii = (at) => String.fromCharCode(h.getUint8(at), h.getUint8(at + 1), h.getUint8(at + 2), h.getUint8(at + 3));
  assert.equal(ascii(0), 'RIFF');
  assert.equal(h.getUint32(4, true), 1036);
  assert.equal(ascii(8), 'WAVE');
  assert.equal(ascii(12), 'fmt ');
  assert.equal(h.getUint16(20, true), 1);
  assert.equal(h.getUint16(22, true), 2);
  assert.equal(h.getUint32(24, true), 44100);
  assert.equal(h.getUint32(28, true), 44100 * 4);
  assert.equal(h.getUint16(32, true), 4);
  assert.equal(h.getUint16(34, true), 16);
  assert.equal(ascii(36), 'data');
  assert.equal(h.getUint32(40, true), 1000);

  const left = new Float32Array([0, 0.5, -1, 1]);
  const right = new Float32Array([0.25, 0, 0, 0]);
  const file = wav([left, right], 1, 4);
  assert.equal(file.length, 44 + 3 * 2 * 2);
  assert.equal(file.length, wavBytes(3, 2));
  const v = new DataView(file.buffer);
  assert.equal(v.getUint32(40, true), 12);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => v.getInt16(44 + i * 2, true)), [16384, 0, -32767, 0, 32767, 0]);
  const mono = new DataView(wav([left]).buffer);
  assert.equal(mono.getUint16(22, true), 1);
  assert.equal(mono.getUint32(40, true), 8);
  assert.equal(wavBytes(10, 6), 44 + 40, 'six channels are saved as two');
});

test('an MP3’s size follows its bitrate and length', () => {
  assert.equal(mp3Bytes(6, 192), 144_000);
  assert.equal(mp3Bytes(60, 128), 960_000);
});

test('format names, from the ending first, then the type', () => {
  assert.equal(formatName('voice.m4a', 'audio/x-m4a'), 'M4A');
  assert.equal(formatName('clip.MOV', 'video/quicktime'), 'MOV');
  assert.equal(formatName('tone.ogg'), 'OGG');
  assert.equal(formatName('blob', 'audio/x-aiff'), 'AIFF');
  assert.equal(formatName('blob', 'audio/mpeg'), 'MP3');
  assert.equal(formatName('song.xyz'), 'XYZ');
  assert.equal(formatName('noending', ''), '');
});

test('the rate and the name suffix', () => {
  assert.equal(formatRate(44100, 'point'), '44.1 kHz');
  assert.equal(formatRate(44100, 'comma'), '44,1 kHz');
  assert.equal(formatRate(48000, 'point'), '48 kHz');
  assert.equal(suffixFor(false), '');
  assert.equal(suffixFor(true), 'trimmed');
});

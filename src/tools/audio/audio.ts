// How Convert audio works with sound once the browser has decoded it: the length limits, times as
// m:ss.s, the trim selection, the waveform's peaks, floats to 16-bit samples (mono stays mono, more
// than two channels mix down to stereo) and the WAV file around them. Plain TypeScript with erasable
// types and no DOM, so the tests run it as it is. The MP3 itself is LAME's, in mp3.worker.js.

import type { DecimalMark } from '../../lib/numbers.ts';
import { formatNumber } from '../../lib/numbers.ts';

/** Everything is decoded at this rate (the decoder resamples to it) and saved at it. */
export const RATE = 44100;
/** LAME takes its samples in frames of this many. */
export const FRAME = 1152;
export const BITRATES = [128, 192, 320] as const;
export type Kbps = (typeof BITRATES)[number];
export type Format = 'mp3' | 'wav';

// ── Length ──────────────────────────────────────────────────────────────────────────────

/** The longest sound converted at once, in minutes. A decoded minute of stereo holds about 21 MB. */
export const LIMIT = { phone: 20, computer: 60 } as const;

export const limitMinutes = (phone: boolean) => (phone ? LIMIT.phone : LIMIT.computer);

/** The length in minutes when it's over this device's limit, as the message says it: whole
 *  minutes, or a tenth more when that's all it's over by (60.1); null when it fits or isn't known. */
export function overLimit(seconds: number, phone: boolean): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const limit = limitMinutes(phone);
  const minutes = seconds / 60;
  if (minutes <= limit) return null;
  return Math.round(minutes) > limit ? Math.round(minutes) : Math.max(limit + 0.1, Math.ceil(minutes * 10) / 10);
}

// ── Times ───────────────────────────────────────────────────────────────────────────────

/** "0:03.4", "12:05.0": minutes, seconds and tenths, with the setting's decimal mark. */
export function formatTime(seconds: number, mark: DecimalMark = 'point'): string {
  const tenths = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 10));
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  const t = tenths % 10;
  return `${m}:${String(s).padStart(2, '0')}${mark === 'comma' ? ',' : '.'}${t}`;
}

/** A length as people read it: "3.4 s" under a minute, "2:05" above. */
export function formatLength(seconds: number, mark: DecimalMark = 'point'): string {
  if (seconds < 59.95) return `${formatNumber(Math.round(seconds * 10) / 10, mark, { min: 1, max: 1 })} s`;
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Seconds from what someone typed: "1:05.3", "1:05,3", "65.3", "0:05", "1:02:03"; NaN otherwise. */
export function parseTime(text: string): number {
  const s = text.trim().replace(',', '.');
  let match = /^(\d*\.?\d+)$/.exec(s);
  if (match) return Number(match[1]);
  match = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (match && Number(match[2]) < 60) return Number(match[1]) * 60 + Number(match[2]);
  match = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (match && Number(match[2]) < 60 && Number(match[3]) < 60) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return NaN;
}

// ── The trim ────────────────────────────────────────────────────────────────────────────

/** A part of the sound, in seconds. */
export interface Span {
  start: number;
  end: number;
}

/** The shortest part kept. */
export const MIN_SPAN = 0.1;
/** Handles and fields move in tenths (the fields show them); the arrow keys too, Shift in seconds. */
export const STEP = 0.1;
export const BIG_STEP = 1;

const tenth = (t: number) => Math.round(t * 10) / 10;

/** The whole sound. */
export const whole = (duration: number): Span => ({ start: 0, end: duration });

/**
 * Moves one edge to `to` seconds, on a tenth (the end may sit on the very end of the sound), never
 * past the other edge less the shortest part, never outside the sound.
 */
export function setEdge(span: Span, edge: 'start' | 'end', to: number, duration: number): Span {
  const min = Math.min(MIN_SPAN, duration);
  if (!Number.isFinite(to)) return span;
  if (edge === 'start') {
    const start = Math.min(Math.max(0, tenth(to)), span.end - min);
    return { start: Math.max(0, start), end: span.end };
  }
  const end = to >= duration - 0.05 ? duration : Math.max(Math.min(duration, tenth(to)), span.start + min);
  return { start: span.start, end: Math.min(duration, end) };
}

/** Is anything cut off? */
export const isTrimmed = (span: Span, duration: number) => span.start > 0.001 || span.end < duration - 0.001;

/** The span as a part of a job's key: a result for another trim is never offered. */
export const spanKey = (span: Span, duration: number) => (isTrimmed(span, duration) ? `${span.start.toFixed(2)}-${span.end.toFixed(2)}` : 'all');

/** The span's samples, [from, to), inside `length`. */
export function sampleRange(span: Span, length: number, rate = RATE): [number, number] {
  const from = Math.min(length, Math.max(0, Math.round(span.start * rate)));
  const to = Math.min(length, Math.max(from, Math.round(span.end * rate)));
  return [from, to];
}

// ── The waveform ────────────────────────────────────────────────────────────────────────

/**
 * The loudest sample (0–1) in each of `buckets` equal parts of the sound, over every channel. Fills
 * buckets [first, last) of `out` only, so a long sound can be read a slice at a time between
 * frames.
 */
export function peaks(channels: Float32Array[], buckets: number, out = new Float32Array(buckets), first = 0, last = buckets): Float32Array {
  const length = channels[0]?.length ?? 0;
  const per = length / buckets;
  for (let b = first; b < last; b++) {
    const from = Math.floor(b * per);
    const to = Math.max(from + 1, Math.floor((b + 1) * per));
    let max = 0;
    for (const ch of channels) {
      for (let i = from; i < to && i < length; i++) {
        const v = ch[i] < 0 ? -ch[i] : ch[i];
        if (v > max) max = v;
      }
    }
    out[b] = max > 1 ? 1 : max;
  }
  return out;
}

// ── Samples ─────────────────────────────────────────────────────────────────────────────

/** Mono stays mono, stereo stereo, anything more mixes down to stereo. */
export const outChannels = (n: number): 1 | 2 => (n <= 1 ? 1 : 2);

/** A float sample (−1…1) as 16 bits, clipped. */
export function toInt16(x: number): number {
  if (!(x === x)) return 0;
  // Halves round away from zero, so a sound and its inverse stay mirror images.
  return x < 0 ? -Math.round((x < -1 ? 1 : -x) * 32767) : Math.round((x > 1 ? 1 : x) * 32767);
}

const HALF = Math.SQRT1_2;

/**
 * Samples [from, to) as 16-bit channels: one for mono, two otherwise. More than two mix down the
 * way Web Audio's speaker rules do: quad halves its surrounds into the sides; 5.1 (L R C LFE SL SR)
 * adds centre and surrounds at −3 dB and drops the LFE; other layouts put the centre (the third)
 * into both sides and the rest alternately left and right, at −3 dB.
 */
export function pcm(channels: Float32Array[], from: number, to: number): Int16Array[] {
  const n = to - from;
  if (channels.length === 1) {
    const out = new Int16Array(n);
    const c = channels[0];
    for (let i = 0; i < n; i++) out[i] = toInt16(c[from + i]);
    return [out];
  }
  const left = new Int16Array(n);
  const right = new Int16Array(n);
  const [l, r] = channels;
  if (channels.length === 2) {
    for (let i = 0; i < n; i++) {
      left[i] = toInt16(l[from + i]);
      right[i] = toInt16(r[from + i]);
    }
    return [left, right];
  }
  if (channels.length === 4) {
    const [, , sl, sr] = channels;
    for (let i = 0; i < n; i++) {
      const k = from + i;
      left[i] = toInt16(0.5 * (l[k] + sl[k]));
      right[i] = toInt16(0.5 * (r[k] + sr[k]));
    }
    return [left, right];
  }
  // The third is the centre; with six or more the fourth is the LFE, which a stereo pair drops.
  const centre = channels[2];
  const rest = channels.slice(channels.length >= 6 ? 4 : 3);
  for (let i = 0; i < n; i++) {
    const k = from + i;
    let a = l[k] + HALF * centre[k];
    let b = r[k] + HALF * centre[k];
    for (let j = 0; j < rest.length; j++) {
      if (j % 2 === 0) a += HALF * rest[j][k];
      else b += HALF * rest[j][k];
    }
    left[i] = toInt16(a);
    right[i] = toInt16(b);
  }
  return [left, right];
}

/** One or two channels as one, sample by sample (L R L R …), as a WAV holds them. */
export function interleave(parts: Int16Array[]): Int16Array {
  if (parts.length === 1) return parts[0];
  const [l, r] = parts;
  const out = new Int16Array(l.length * 2);
  for (let i = 0; i < l.length; i++) {
    out[2 * i] = l[i];
    out[2 * i + 1] = r[i];
  }
  return out;
}

// ── WAV ─────────────────────────────────────────────────────────────────────────────────

/** The 44 bytes in front of 16-bit PCM: RIFF, fmt and the data chunk's head. */
export function wavHeader(dataBytes: number, channels: number, rate = RATE): Uint8Array {
  const b = new Uint8Array(44);
  const v = new DataView(b.buffer);
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => (b[at + i] = c.charCodeAt(0)));
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  return b;
}

/** Samples interleaved as little-endian bytes (what Int16Array already is on every device we run on,
 *  but not by promise). */
export function littleEndian(samples: Int16Array): Uint8Array {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] === 1) return bytes;
  const out = new Uint8Array(samples.length * 2);
  const v = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) v.setInt16(i * 2, samples[i], true);
  return out;
}

/** A whole WAV in one go (the tool builds it a slice at a time, the same way). */
export function wav(channels: Float32Array[], from = 0, to = channels[0]?.length ?? 0, rate = RATE): Uint8Array {
  const data = littleEndian(interleave(pcm(channels, from, to)));
  const out = new Uint8Array(44 + data.length);
  out.set(wavHeader(data.length, outChannels(channels.length), rate));
  out.set(data, 44);
  return out;
}

/** What a WAV of this length will weigh. */
export const wavBytes = (samples: number, channels: number) => 44 + samples * outChannels(channels) * 2;

/** What an MP3 of this length will weigh, near enough (constant bitrate). */
export const mp3Bytes = (seconds: number, kbps: number) => Math.round((seconds * kbps * 1000) / 8);

// ── Words ───────────────────────────────────────────────────────────────────────────────

const FORMATS: Record<string, string> = {
  m4a: 'M4A', mp4: 'MP4', m4v: 'MP4', mov: 'MOV', mp3: 'MP3', wav: 'WAV', wave: 'WAV', flac: 'FLAC',
  ogg: 'OGG', oga: 'OGG', opus: 'Opus', webm: 'WebM', weba: 'WebM', aif: 'AIFF', aiff: 'AIFF',
  caf: 'CAF', amr: 'AMR', aac: 'AAC', mkv: 'MKV', '3gp': '3GP',
};

/** The file's format as people name it ("M4A", "MOV"), from its ending, else its type; '' if neither. */
export function formatName(name: string, type = ''): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  if (FORMATS[ext]) return FORMATS[ext];
  const sub = /^(?:audio|video)\/(?:x-)?([a-z0-9.+-]+)/i.exec(type)?.[1]?.toLowerCase() ?? '';
  if (sub === 'mpeg') return 'MP3';
  if (FORMATS[sub]) return FORMATS[sub];
  return ext ? ext.toUpperCase() : sub.toUpperCase();
}

/** "44.1 kHz". */
export const formatRate = (rate: number, mark: DecimalMark) => `${formatNumber(rate / 1000, mark, { max: 1 })} kHz`;

/** What the saved name says was done: nothing when only the format changes, "trimmed" when cut. */
export const suffixFor = (trimmed: boolean) => (trimmed ? 'trimmed' : '');

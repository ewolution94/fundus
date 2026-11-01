// The browser's side of Convert audio: a file's length read cheaply, the sound decoded, and the two
// encoders (WAV here, a slice at a time; MP3 in the LAME worker, fed a slice at a time). Each slice is
// converted to 16 bits just before it's used, so a long sound is never copied whole and the page
// gets a turn between slices.

import lameUrl from '/node_modules/@breezystack/lamejs/dist/lamejs.iife.js?url';
import { FRAME, RATE, interleave, littleEndian, outChannels, pcm, wavHeader } from './audio.ts';

/** About 6.7 s of sound: a slice is quick to convert and to encode, and small in flight. */
const SLICE = FRAME * 256;

/** The LAME file's address on our origin (dev: from node_modules; built: under /assets/). */
export const lame = () => new URL(lameUrl, location.origin).href;

export const startWorker = () => new Worker(new URL('./mp3.worker.js', import.meta.url));

/** A phone or tablet: the shorter limit. */
export const isPhone = () => matchMedia('(pointer: coarse)').matches;

/** Thrown when the options changed under a job: nobody wants its result any more. */
export class Stale extends Error {}

/** Why a file wasn't converted, for the words the tool shows: the browser can't read its sound,
 *  or it's longer than this device converts at once (`minutes`). */
export class Problem extends Error {
  code: 'unreadable' | 'tooLong';
  minutes: number;
  constructor(code: 'unreadable' | 'tooLong', minutes = 0) {
    super(code);
    this.code = code;
    this.minutes = minutes;
  }
}

const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * The length in seconds from the file's own head, without decoding it (an <audio> that loads only
 * the metadata); NaN when the browser can't tell. A recording without a length in its head (a
 * browser's own WebM) is asked to seek to its end, which makes it find out.
 */
export function probe(file: Blob, timeout = 6000): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('audio');
    el.preload = 'metadata';
    el.muted = true;
    const done = (seconds: number) => {
      clearTimeout(timer);
      el.onloadedmetadata = el.ondurationchange = el.onerror = null;
      el.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    const timer = setTimeout(() => done(NaN), timeout);
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration)) return done(el.duration);
      el.ondurationchange = () => Number.isFinite(el.duration) && done(el.duration);
      el.currentTime = 1e101;
    };
    el.onerror = () => done(NaN);
    el.src = url;
  });
}

/** The sound, decoded and resampled to 44.1 kHz, its channels as they are; a Problem when the
 *  browser can't read it. */
export async function decode(file: Blob): Promise<AudioBuffer> {
  let buffer: AudioBuffer;
  try {
    const bytes = await file.arrayBuffer();
    buffer = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(bytes);
  } catch {
    throw new Problem('unreadable');
  }
  if (!buffer.length) throw new Problem('unreadable');
  return buffer;
}

export const channelsOf = (buffer: AudioBuffer) => Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));

interface Run {
  stale: () => boolean;
  /** 0–1. */
  progress: (done: number) => void;
}

/** Samples [from, to) as a 16-bit PCM WAV. Each slice goes into a Blob of its own straight away, so
 *  the bytes leave the page's memory as they're made. */
export async function toWav(channels: Float32Array[], from: number, to: number, { stale, progress }: Run): Promise<Blob> {
  const n = outChannels(channels.length);
  const parts: Blob[] = [new Blob([wavHeader((to - from) * n * 2, n) as BlobPart])];
  for (let at = from; at < to; at += SLICE) {
    if (stale()) throw new Stale();
    const end = Math.min(to, at + SLICE);
    parts.push(new Blob([littleEndian(interleave(pcm(channels, at, end))) as BlobPart]));
    progress((end - from) / Math.max(1, to - from));
    await breathe();
  }
  return new Blob(parts, { type: 'audio/wav' });
}

/** Samples [from, to) as a constant-bitrate MP3, encoded by LAME in its worker. */
export async function toMp3(channels: Float32Array[], from: number, to: number, kbps: number, { stale, progress }: Run): Promise<Blob> {
  const worker = startWorker();
  let waiting: { resolve: (data: any) => void; reject: (error: Error) => void } | null = null;
  const reply = () => new Promise<any>((resolve, reject) => (waiting = { resolve, reject }));
  const settle = (fn: (w: NonNullable<typeof waiting>) => void) => {
    const w = waiting;
    waiting = null;
    if (w) fn(w);
  };
  worker.onmessage = (e) => settle((w) => (e.data?.type === 'error' ? w.reject(new Error(e.data.message)) : w.resolve(e.data)));
  worker.onerror = (e) => {
    e.preventDefault();
    settle((w) => w.reject(new Error(e.message || 'The encoder stopped')));
  };
  try {
    let next = reply();
    worker.postMessage({ type: 'start', url: lame(), channels: outChannels(channels.length), rate: RATE, kbps });
    await next;
    for (let at = from; at < to; at += SLICE) {
      if (stale()) throw new Stale();
      const end = Math.min(to, at + SLICE);
      const slice = pcm(channels, at, end);
      next = reply();
      // Handed over, not copied: the slice is the worker's now.
      worker.postMessage({ type: 'slice', pcm: slice }, slice.map((s) => s.buffer));
      await next;
      progress((end - from) / Math.max(1, to - from));
    }
    if (stale()) throw new Stale();
    next = reply();
    worker.postMessage({ type: 'end' });
    const done = await next;
    return done.blob as Blob;
  } finally {
    worker.terminate();
  }
}

/** Starts the worker and has it load LAME, so "Everything offline" keeps both files. */
export function warmUp(): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = startWorker();
    const finish = (ok: boolean) => {
      worker.terminate();
      if (ok) resolve();
      else reject(new Error('The MP3 encoder didn’t load'));
    };
    worker.onmessage = (e) => finish(e.data?.type === 'loaded');
    worker.onerror = (e) => {
      e.preventDefault();
      finish(false);
    };
    worker.postMessage({ type: 'load', url: lame() });
  });
}

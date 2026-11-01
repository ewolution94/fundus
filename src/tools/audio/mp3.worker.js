// The MP3 encoder: LAME (lamejs, LGPL-3.0), loaded as its own unchanged file from our origin with
// importScripts, in a classic worker so the page never waits on it. The page streams 16-bit samples
// in slices and waits for each slice's "took" before the next, so only a slice is in flight at a time.
//
//   → { type: 'load', url }                               ← { type: 'loaded' }  (Everything offline)
//   → { type: 'start', url, channels, rate, kbps }        ← { type: 'ready' }
//   → { type: 'slice', pcm: [Int16Array, Int16Array?] }   ← { type: 'took' }
//   → { type: 'end' }                                     ← { type: 'done', blob }
//   anything that fails                                   ← { type: 'error', message }

/* global lamejs */

const FRAME = 1152;
let encoder = null;
let parts = [];

function load(url) {
  if (typeof self.lamejs === 'undefined') importScripts(url);
}

self.onmessage = (event) => {
  const m = event.data;
  try {
    if (m.type === 'load') {
      load(m.url);
      self.postMessage({ type: 'loaded' });
    } else if (m.type === 'start') {
      load(m.url);
      encoder = new lamejs.Mp3Encoder(m.channels, m.rate, m.kbps);
      parts = [];
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'slice') {
      const [left, right] = m.pcm;
      for (let i = 0; i < left.length; i += FRAME) {
        const out = right ? encoder.encodeBuffer(left.subarray(i, i + FRAME), right.subarray(i, i + FRAME)) : encoder.encodeBuffer(left.subarray(i, i + FRAME));
        if (out.length) parts.push(out);
      }
      self.postMessage({ type: 'took' });
    } else if (m.type === 'end') {
      const out = encoder.flush();
      if (out.length) parts.push(out);
      const blob = new Blob(parts, { type: 'audio/mpeg' });
      parts = [];
      encoder = null;
      self.postMessage({ type: 'done', blob });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error && error.message ? error.message : error) });
  }
};

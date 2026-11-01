// F-601 Convert audio, with the sample sounds: voice.m4a (a mono AAC voice memo, 3.4 s), tone.wav,
// tone.mp3, tone.flac and tone.ogg (Opus) (stereo, 6 s, 44.1 kHz) and clip.mp4 (4 s of video with
// AAC sound). Every saved file is read back: an MP3's frames (MPEG-1 Layer III, the bitrate, the
// channels, how many frames, so how long), a WAV's header and the length its data holds.

import { unzipSync } from 'fflate';

const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));

/** An MP3's frames, after an ID3 tag if there is one: what the first says, and how long they last. */
function mp3(bytes) {
  let i = 0;
  if (ascii(bytes, 0, 3) === 'ID3') i = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
  const RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const HZ = [44100, 48000, 32000];
  let first = null;
  let frames = 0;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) break;
    const version = (bytes[i + 1] >> 3) & 3;
    const layer = (bytes[i + 1] >> 1) & 3;
    const kbps = RATES[bytes[i + 2] >> 4];
    const rate = HZ[(bytes[i + 2] >> 2) & 3];
    const padding = (bytes[i + 2] >> 1) & 1;
    const channels = bytes[i + 3] >> 6 === 3 ? 1 : 2;
    first ??= { mpeg1: version === 3, layer3: layer === 1, kbps, rate, channels, at: i };
    frames++;
    i += Math.floor((144 * kbps * 1000) / rate) + padding;
  }
  return { ...first, frames, seconds: (frames * 1152) / 44100, end: i };
}

/** A WAV's header, and the seconds its data holds. */
function wavInfo(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = v.getUint16(22, true);
  const rate = v.getUint32(24, true);
  const data = v.getUint32(40, true);
  return {
    riff: ascii(bytes, 0, 4),
    wave: ascii(bytes, 8, 4),
    pcm: v.getUint16(20, true),
    channels,
    rate,
    bits: v.getUint16(34, true),
    dataTag: ascii(bytes, 36, 4),
    data,
    seconds: data / (channels * 2 * rate),
    total: bytes.length,
  };
}

/**
 * A real MP3 `minutes` long that weighs little: silent MPEG-2 Layer III frames at 8 kbps and 16 kHz,
 * 36 bytes for each 36 ms (4.4 MB for 74 minutes). The browser reads its length from its head and
 * size, which is all the tool asks before refusing it.
 */
function longMp3(minutes) {
  const frames = Math.ceil((minutes * 60) / 0.036);
  const bytes = Buffer.alloc(frames * 36);
  for (let i = 0; i < frames; i++) bytes.set([0xff, 0xf3, 0x18, 0xc0], i * 36);
  return bytes;
}

const near = (assert, value, expected, tolerance, what) => assert.ok(Math.abs(value - expected) <= tolerance, `${what}: ${value}, expected ${expected} ± ${tolerance}`);

/** Waits for the trim to be drawn (the one file decoded). */
const waveform = (page) => page.getByRole('slider', { name: 'Start of the part kept' }).waitFor();

export default {
  async 'a mono voice memo becomes a mono MP3 at 192 kbps, its size fitting the length'({ open, drop, save, assert, sees }) {
    await open('/convert-audio');
    await drop('voice.m4a');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'voice.mp3');
    const m = mp3(out.bytes);
    assert.ok(m.mpeg1 && m.layer3, 'an MPEG-1 Layer III frame first');
    assert.equal(m.kbps, 192);
    assert.equal(m.rate, 44100);
    assert.equal(m.channels, 1, 'mono stays mono');
    assert.equal(m.end, out.bytes.length, 'nothing but frames');
    near(assert, m.seconds, 3.4, 0.15, 'seconds of frames');
    near(assert, out.bytes.length, (3.4 * 192000) / 8, 6000, 'bytes');
    await sees('Mono');
    await sees('44.1 kHz');
  },

  async 'a stereo FLAC becomes a 16-bit stereo WAV that holds its 6 seconds'({ open, drop, choose, save, assert, sees }) {
    await open('/convert-audio');
    await choose('Format', 'WAV');
    await drop('tone.flac');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'tone.wav');
    const h = wavInfo(out.bytes);
    assert.deepEqual([h.riff, h.wave, h.dataTag], ['RIFF', 'WAVE', 'data']);
    assert.deepEqual([h.pcm, h.bits, h.channels, h.rate], [1, 16, 2, 44100]);
    assert.equal(h.total, 44 + h.data);
    near(assert, h.seconds, 6, 0.02, 'seconds');
    await sees('Stereo');
    await sees('16-bit PCM');
  },

  async 'Opus, MP3 and WAV are read too, at the bitrate chosen'({ open, drop, choose, save, assert, page }) {
    for (const [name, kbps] of [
      ['tone.ogg', 128],
      ['tone.mp3', 320],
      ['tone.wav', 192],
    ]) {
      await open('/convert-audio');
      await choose('Bitrate', `${kbps} kbps`);
      await drop(name);
      const out = await save({ timeout: 60_000 });
      assert.equal(out.name, 'tone.mp3');
      const m = mp3(out.bytes);
      assert.equal(m.kbps, kbps, name);
      assert.equal(m.channels, 2, `${name} stays stereo`);
      near(assert, m.seconds, 6, 0.15, `${name} seconds`);
      near(assert, out.bytes.length, (6 * kbps * 1000) / 8, 8000, `${name} bytes`);
      await page.getByRole('button', { name: /Remove/ }).click();
    }
  },

  async 'a video’s sound comes out as an MP3'({ open, drop, save, assert }) {
    await open('/convert-audio');
    await drop('clip.mp4');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'clip.mp3');
    const m = mp3(out.bytes);
    assert.ok(m.mpeg1 && m.layer3);
    near(assert, m.seconds, 4, 0.15, 'seconds');
  },

  async 'several at once: each its own file, same names told apart'({ open, drop, save, assert, sees, shot }) {
    await open('/convert-audio');
    await drop(['tone.wav', 'voice.m4a', 'clip.mp4', 'tone.ogg']);
    const outs = await save({ count: 4, timeout: 90_000 });
    assert.deepEqual(outs.map((o) => o.name).sort(), ['clip.mp3', 'tone-2.mp3', 'tone.mp3', 'voice.mp3']);
    for (const o of outs) assert.ok(mp3(o.bytes).layer3, o.name);
    await sees('Trimming works with one file in');
    await shot('many', 1280);
    await shot('many-phone', 390);
  },

  async 'from the Many files count on, one ZIP'({ open, drop, save, assert, page }) {
    await open('/convert-audio');
    await page.evaluate(() => localStorage.setItem('fundus:shared', JSON.stringify({ zipFrom: 2 })));
    await page.reload();
    await page.waitForSelector('main[data-ready]');
    await drop(['tone.flac', 'voice.m4a']);
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'audio.zip');
    assert.deepEqual(Object.keys(unzipSync(out.bytes)).sort(), ['tone.mp3', 'voice.mp3']);
  },

  async 'trimmed by typing the times: the WAV holds exactly the part kept'({ open, drop, choose, fill, save, assert, page, sees, shot }) {
    await open('/convert-audio');
    await choose('Format', 'WAV');
    await drop('tone.wav');
    await waveform(page);
    await fill('Start', '1');
    await page.keyboard.press('Enter');
    await fill('End', '0:03,5');
    await page.keyboard.press('Enter');
    await sees('0:02.5 of 0:06.0');
    assert.equal(await page.getByLabel('Start', { exact: true }).inputValue(), '0:01.0');
    assert.equal(await page.getByLabel('End', { exact: true }).inputValue(), '0:03.5');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'tone-trimmed.wav');
    const h = wavInfo(out.bytes);
    assert.equal(h.data, 2.5 * 44100 * 4, 'two and a half seconds of stereo, to the sample');
    await shot('trim', 1280);
    await shot('trim-phone', 390);
  },

  async 'trimmed with the keys and the mouse: the MP3 lasts as long as the part kept'({ open, drop, save, assert, page, sees }) {
    await open('/convert-audio');
    await drop('tone.wav');
    await waveform(page);
    const start = page.getByRole('slider', { name: 'Start of the part kept' });
    await start.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    assert.equal(await start.getAttribute('aria-valuetext'), '0:00.5');
    await page.keyboard.press('Shift+ArrowRight');
    assert.equal(await start.getAttribute('aria-valuetext'), '0:01.5');
    // The end edge, dragged to the middle of the waveform.
    const end = page.getByRole('slider', { name: 'End of the part kept' });
    const track = await page.locator('canvas').boundingBox();
    const box = await end.boundingBox();
    await page.mouse.move(box.x + 12, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width / 2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.equal(await end.getAttribute('aria-valuetext'), '0:03.0');
    await sees('0:01.5 of 0:06.0');
    const out = await save({ timeout: 60_000 });
    assert.equal(out.name, 'tone-trimmed.mp3');
    const m = mp3(out.bytes);
    // LAME pads the end to whole frames: up to two frames more.
    assert.ok(m.seconds >= 1.5 && m.seconds <= 1.5 + 0.06, `${m.seconds} s`);
  },

  async 'a result for other options is never offered'({ open, drop, save, assert, page }) {
    await open('/convert-audio');
    await drop('tone.wav');
    await page.waitForFunction(() => document.querySelector('button.save')?.disabled === false, null, { timeout: 60_000 });
    // Picked, and the Save bar looked at in the same frame: the MP3 encoder can't have made the new
    // one yet; a short WAV may be ready already, and then it's the WAV that's offered.
    const pick = (option) =>
      page.evaluate(async (words) => {
        [...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.trim() === words).click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const button = document.querySelector('button.save');
        return { disabled: button.disabled, label: button.textContent.trim() };
      }, option);
    assert.equal((await pick('320 kbps')).disabled, true, 'the 192 kbps result isn’t offered for 320');
    const out = await save({ timeout: 60_000 });
    assert.equal(mp3(out.bytes).kbps, 320);
    const now = await pick('WAV');
    assert.ok(now.disabled || now.label === 'Save tone.wav', `nor an MP3 for a WAV: ${JSON.stringify(now)}`);
    const wav = await save({ timeout: 60_000 });
    assert.equal(wav.name, 'tone.wav');
    assert.equal(wavInfo(wav.bytes).riff, 'RIFF');
  },

  async 'Play plays the part kept, then stops'({ open, drop, fill, page, assert }) {
    await open('/convert-audio');
    await drop('tone.wav');
    await waveform(page);
    await fill('Start', '2');
    await page.keyboard.press('Enter');
    await fill('End', '2.6');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 5000 });
    const at = await page.locator('.playhead').count();
    assert.equal(at, 1, 'a playhead while it plays');
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 5000 });
  },

  async 'not a sound: says so'({ open, drop, sees }) {
    await open('/convert-audio');
    await drop('notes.txt');
    await sees('notes.txt isn’t a sound or a video.');
  },

  async 'a sound this browser can’t read: says so plainly, naming the format'({ open, page, sees, assert }) {
    await open('/convert-audio');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'memo.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('not a sound at all, just words '.repeat(40)) });
    await sees('This browser can’t read the sound in memo.m4a (M4A).');
    assert.equal(await page.locator('button.save').count(), 0, 'nothing to save');
  },

  async 'longer than an hour: refused before decoding'({ open, page, sees }) {
    await open('/convert-audio');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'meeting.mp3', mimeType: 'audio/mpeg', buffer: longMp3(74) });
    await sees('meeting.mp3 runs 74 minutes, longer than Fundus converts at once on this device: up to 60 minutes on a computer, 20 on a phone.');
  },

  async 'on a phone, from 20 minutes on'({ page, open, sees }) {
    await page.addInitScript(() => {
      const own = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q.includes('pointer: coarse') ? { ...own(q), matches: true, media: q, addEventListener() {}, removeEventListener() {} } : own(q));
    });
    await open('/convert-audio');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'lecture.mp3', mimeType: 'audio/mpeg', buffer: longMp3(25) });
    await sees('lecture.mp3 runs 25 minutes');
  },

  async 'Everything offline fetches the MP3 worker and LAME'({ open, page, check, assert }) {
    const asked = [];
    const workers = [];
    page.context().on('request', (r) => asked.push(r.url()));
    page.on('worker', (w) => workers.push(w.url()));
    await open('/convert-audio');
    await page.locator('ewo-settings-button').click();
    await check('Everything offline', true);
    // The requests, not the closing toast: that one waits for a service worker, which the dev
    // server doesn't run.
    const lame = (u) => /lamejs\.iife[^/?]*\.js$/.test(u);
    for (let i = 0; i < 600 && !asked.some(lame); i++) await page.waitForTimeout(100);
    assert.ok(workers.some((u) => /mp3\.worker/.test(u)), 'the worker started');
    assert.ok(asked.some(lame), 'LAME fetched');
  },

  async 'fits a phone'({ open, drop, page, save, fitsPhone, shot }) {
    await open('/convert-audio');
    await drop('voice.m4a');
    await waveform(page);
    await save({ timeout: 60_000 });
    await shot('one', 1280);
    await shot('one-phone', 390);
    await fitsPhone();
  },
};

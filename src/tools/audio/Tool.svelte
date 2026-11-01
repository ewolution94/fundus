<!--
  F-601 Convert audio: voice memos, M4A, WAV, FLAC, OGG and the sound of a video to MP3 (LAME, in a
  worker) or 16-bit WAV, at 44.1 kHz, mono kept mono. Many files at once; with one file in, a
  waveform to trim it on. Each file's length is read from its head first, so one longer than this
  device converts at once is refused before anything is decoded.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { AudioLines, Play, Square } from '@lucide/svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { perFile } from '../../lib/jobs.svelte.ts';
  import { formatBytes, outName, isAudio, isVideo } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import Wave from './Wave.svelte';
  import {
    BITRATES,
    LIMIT,
    RATE,
    formatLength,
    formatName,
    formatRate,
    formatTime,
    isTrimmed,
    outChannels,
    overLimit,
    parseTime,
    peaks,
    sampleRange,
    setEdge,
    spanKey,
    suffixFor,
    whole,
    type Format,
    type Kbps,
    type Span,
  } from './audio.ts';
  import { Problem, Stale, channelsOf, decode, isPhone, probe, toMp3, toWav } from './media.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop sound or a video here, or choose it',
      dropHint: 'Voice memos, M4A, MP3, WAV, FLAC, OGG, or a video’s sound. Several at once.',
      add: 'Add sound',
      format: 'Format',
      bitrate: 'Bitrate',
      pcm: '16-bit PCM, uncompressed',
      length: 'Length',
      of: 'of {whole}',
      channels: 'Channels',
      mono: 'Mono',
      stereo: 'Stereo',
      mixed: '{n} channels, saved as stereo',
      rate: 'Sample rate',
      result: 'Result',
      trim: 'Trim',
      start: 'Start',
      end: 'End',
      kept: 'Kept',
      play: 'Play',
      stop: 'Stop',
      whole: 'Whole sound',
      oneAtATime: 'Trimming works with one file in.',
      reading: 'Reading the sound…',
      working: 'Converting {name}…',
      workingAt: 'Converting {name}… {pct} %',
      workingN: 'Converting {i} of {n}…',
      files: '{n} files',
      notSound: '{name} isn’t a sound or a video.',
      unreadable: 'This browser can’t read the sound in {name} ({format}).',
      unreadableBare: 'This browser can’t read the sound in {name}.',
      tooLong: '{name} runs {minutes} minutes, longer than Fundus converts at once on this device: up to {computer} minutes on a computer, {phone} on a phone.',
      failed: 'Couldn’t convert {name}.',
      badTime: 'Type a time like 0:05.0.',
      cantPlay: 'This browser can’t play it here; the saved file has the sound.',
    },
    de: {
      drop: 'Ton oder ein Video hier ablegen oder auswählen',
      dropHint: 'Sprachmemos, M4A, MP3, WAV, FLAC, OGG oder den Ton eines Videos. Mehrere auf einmal.',
      add: 'Ton dazu',
      format: 'Format',
      bitrate: 'Bitrate',
      pcm: '16-Bit-PCM, unkomprimiert',
      length: 'Länge',
      of: 'von {whole}',
      channels: 'Kanäle',
      mono: 'Mono',
      stereo: 'Stereo',
      mixed: '{n} Kanäle, als Stereo gespeichert',
      rate: 'Abtastrate',
      result: 'Ergebnis',
      trim: 'Kürzen',
      start: 'Anfang',
      end: 'Ende',
      kept: 'Bleibt',
      play: 'Abspielen',
      stop: 'Stopp',
      whole: 'Ganzer Ton',
      oneAtATime: 'Kürzen geht mit einer Datei.',
      reading: 'Der Ton wird gelesen…',
      working: '{name} wird umgewandelt…',
      workingAt: '{name} wird umgewandelt… {pct} %',
      workingN: '{i} von {n} wird umgewandelt…',
      files: '{n} Dateien',
      notSound: '{name} ist kein Ton und kein Video.',
      unreadable: 'Dieser Browser kann den Ton in {name} ({format}) nicht lesen.',
      unreadableBare: 'Dieser Browser kann den Ton in {name} nicht lesen.',
      tooLong: '{name} dauert {minutes} Minuten, länger als Fundus auf diesem Gerät auf einmal umwandelt: bis zu {computer} Minuten am Computer, {phone} am Handy.',
      failed: '{name} ließ sich nicht umwandeln.',
      badTime: 'Gib eine Zeit wie 0:05,0 ein.',
      cantPlay: 'Dieser Browser kann es hier nicht abspielen; die gespeicherte Datei hat den Ton.',
    },
  });

  // The format and bitrate are kept; the sound is not.
  const o = remember('audio', { format: 'mp3' as Format, kbps: 192 as Kbps });
  const format = $derived<Format>(o.format === 'wav' ? 'wav' : 'mp3');
  const kbps = $derived<Kbps>(BITRATES.includes(o.kbps) ? o.kbps : 192);
  const mark = $derived(shared.decimal);

  /** A file as it came in, with its length (from its head, or from decoding it when the head says
   *  nothing). */
  interface Entry {
    file: File;
    seconds: number;
  }

  /** What converting made, and what it was made from. */
  interface Made {
    output: Output;
    seconds: number;
    channels: number;
  }

  /** The one file in, decoded: its waveform and the address the player plays it from. */
  interface Sound {
    file: File;
    buffer: AudioBuffer;
    peaks: Float32Array;
    duration: number;
    url: string;
  }

  const EDGES = ['start', 'end'] as const;

  let entries = $state<Entry[]>([]);
  let adding = $state(0);
  let errors = $state<string[]>([]);
  const progress = new SvelteMap<File, number>();

  // ── Words for what went wrong ─────────────────────────────────────────────────────────

  /** A note under the list, once each. */
  function note(text: string) {
    if (!errors.includes(text)) errors = [...errors, text];
  }

  function problemText(file: File, error: unknown): string {
    if (error instanceof Problem && error.code === 'tooLong') {
      return w('tooLong', { name: file.name, minutes: formatNumber(error.minutes, mark, { max: 1 }), computer: LIMIT.computer, phone: LIMIT.phone });
    }
    if (error instanceof Problem) {
      const name = formatName(file.name, file.type);
      return name ? w('unreadable', { name: file.name, format: name }) : w('unreadableBare', { name: file.name });
    }
    return w('failed', { name: file.name });
  }

  // ── Files in ──────────────────────────────────────────────────────────────────────────

  async function add(list: File[]) {
    errors = [];
    adding++;
    const fresh: Entry[] = [];
    const phone = isPhone();
    for (const file of list) {
      if (!isAudio(file) && !isVideo(file)) {
        note(w('notSound', { name: file.name }));
        continue;
      }
      try {
        let seconds = await probe(file);
        if (!Number.isFinite(seconds)) {
          // The head says nothing: decoding tells (and tells whether it's readable at all).
          seconds = (await decode(file)).duration;
        }
        const minutes = overLimit(seconds, phone);
        if (minutes) throw new Problem('tooLong', minutes);
        fresh.push({ file, seconds });
      } catch (error) {
        note(problemText(file, error));
      }
    }
    // All at once, so Save never offers half of what was dropped.
    entries = [...entries, ...fresh];
    adding--;
  }

  /** A file that turned out not to work leaves the list, and a note says why. */
  function drop(file: File, error: unknown) {
    if (!entries.some((e) => e.file === file)) return;
    note(problemText(file, error));
    remove(entries.findIndex((e) => e.file === file));
  }

  function remove(i: number) {
    const file = entries[i].file;
    jobs.forget(file);
    progress.delete(file);
    entries = entries.filter((_, k) => k !== i);
  }

  // The inbox (a sound dropped on the home, or a result from another tool) goes straight in, once.
  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  // ── The one file: decoded once, for its waveform, the trim and its conversion ──────────

  let sound = $state.raw<Sound | null>(null);
  /** The decoding under way for the one file; its conversion waits for the same one. */
  let decoding: { file: File; promise: Promise<AudioBuffer> } | null = null;
  /** What the edges show while they move… */
  let span = $state<Span>({ start: 0, end: 0 });
  /** …and what the result is made for, once a move ends. */
  let kept = $state<Span>({ start: 0, end: 0 });

  const BUCKETS = 2400;
  const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  $effect(() => {
    const only = entries.length === 1 ? entries[0].file : null;
    untrack(() => {
      if (only && (sound?.file === only || decoding?.file === only)) return;
      release();
      if (only) void load(only);
    });
  });

  async function load(file: File) {
    const promise = decode(file);
    decoding = { file, promise };
    let buffer: AudioBuffer;
    try {
      buffer = await promise;
    } catch (error) {
      if (decoding?.file === file) drop(file, error);
      return;
    }
    const current = () => decoding?.file === file;
    if (!current()) return;
    const minutes = overLimit(buffer.duration, isPhone());
    if (minutes) return drop(file, new Problem('tooLong', minutes));
    // The waveform a slice at a time (about two million samples each), so a long sound never
    // holds the page up.
    const channels = channelsOf(buffer);
    const out = new Float32Array(BUCKETS);
    const per = Math.max(1, Math.floor((BUCKETS * 2_000_000) / Math.max(1, buffer.length * channels.length)));
    for (let b = 0; b < BUCKETS; b += per) {
      peaks(channels, BUCKETS, out, b, Math.min(BUCKETS, b + per));
      if (per < BUCKETS) await breathe();
      if (!current()) return;
    }
    const duration = buffer.length / RATE;
    span = whole(duration);
    kept = whole(duration);
    sound = { file, buffer, peaks: out, duration, url: URL.createObjectURL(file) };
  }

  function release() {
    stop();
    if (sound) URL.revokeObjectURL(sound.url);
    sound = null;
    decoding = null;
  }

  $effect(() => () => untrack(release));

  const single = $derived(entries.length === 1);
  const trimming = $derived(single && sound !== null && sound.file === entries[0]?.file);
  const trimmed = $derived(trimming && isTrimmed(kept, sound!.duration));

  // ── Converting ────────────────────────────────────────────────────────────────────────

  // Everything a result depends on, as one string: a result for other options is never offered.
  const trimKey = $derived(trimming ? spanKey(kept, sound!.duration) : 'all');
  const jobKey = $derived(`${format}|${format === 'mp3' ? kbps : 16}|${trimKey}|${shared.names}`);

  const jobs = perFile<Made>(
    () => entries.map((e) => e.file),
    () => jobKey,
    // Read the options as they are now, without the job's effect following them (the key does).
    (file, stale) => untrack(() => convert(file, stale)),
  );

  async function convert(file: File, stale: () => boolean): Promise<Made> {
    const fmt = format;
    const rate = kbps;
    const names = shared.names;
    const cut = trimKey === 'all' ? null : { ...kept };
    const own = decoding?.file === file ? decoding.promise : null;
    progress.set(file, 0);
    try {
      const buffer = await (own ?? decode(file));
      if (stale()) throw new Stale();
      const minutes = overLimit(buffer.duration, isPhone());
      if (minutes) throw new Problem('tooLong', minutes);
      const duration = buffer.length / RATE;
      const [from, to] = sampleRange(cut ?? whole(duration), buffer.length);
      const channels = channelsOf(buffer);
      const run = { stale, progress: (p: number) => progress.set(file, p) };
      const blob = fmt === 'mp3' ? await toMp3(channels, from, to, rate, run) : await toWav(channels, from, to, run);
      const name = outName(file.name, suffixFor(cut !== null && isTrimmed(cut, duration)), fmt, names);
      return { output: { blob, name }, seconds: (to - from) / RATE, channels: buffer.numberOfChannels };
    } catch (error) {
      if (!(error instanceof Stale) && !stale()) queueMicrotask(() => drop(file, error));
      throw error;
    } finally {
      progress.delete(file);
    }
  }

  const outputs = $derived.by(() => {
    if (adding || !entries.length || !jobs.ready) return null;
    const list = entries.map((e) => jobs.get(e.file)?.value?.output).filter((x): x is Output => !!x);
    // tone.wav and tone.ogg both become tone.mp3: the second is tone-2.mp3, as in a ZIP.
    const used = new Set<string>();
    const named = list.map((out) => {
      let name = out.name;
      for (let k = 2; used.has(name); k++) name = out.name.replace(/(\.[^.]+)?$/, `-${k}$1`);
      used.add(name);
      return name === out.name ? out : { ...out, name };
    });
    return named.length ? named : null;
  });
  const nextItems = $derived(outputs?.length === 1 ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: outputs[0].blob.type }) }] : null);

  // ── The facts ─────────────────────────────────────────────────────────────────────────

  const first = $derived(entries[0]);
  const firstDone = $derived(first ? jobs.get(first.file)?.value : undefined);
  const channelCount = $derived(trimming ? sound!.buffer.numberOfChannels : (firstDone?.channels ?? 0));
  const channelWord = (n: number) => (n <= 1 ? w('mono') : n === 2 ? w('stereo') : w('mixed', { n }));
  const totalSeconds = $derived(entries.reduce((sum, e) => sum + (Number.isFinite(e.seconds) ? e.seconds : 0), 0));
  const before = $derived(entries.reduce((sum, e) => sum + e.file.size, 0));
  const after = $derived(outputs ? outputs.reduce((sum, out) => sum + out.blob.size, 0) : 0);
  const working = $derived.by(() => {
    const i = entries.findIndex((e) => progress.has(e.file));
    return i < 0 ? null : { i, entry: entries[i], pct: Math.floor((progress.get(entries[i].file) ?? 0) * 100) };
  });
  const percent = (a: number, b: number) => `−${formatNumber(Math.max(0, (1 - b / a) * 100), mark, { max: 0 })} %`;

  function rowMeta(e: Entry): string {
    const done = jobs.get(e.file)?.value;
    const length = formatLength(e.seconds, mark);
    if (done) return `${formatLength(done.seconds, mark)} · ${channelWord(done.channels)} · ${formatBytes(e.file.size, mark)} → ${formatBytes(done.output.blob.size, mark)}`;
    const p = progress.get(e.file);
    if (p !== undefined) return `${length} · ${formatBytes(e.file.size, mark)} · ${Math.floor(p * 100)} %`;
    return `${length} · ${formatBytes(e.file.size, mark)}`;
  }

  // ── The trim's controls ───────────────────────────────────────────────────────────────

  function commit() {
    kept = { ...span };
  }

  function reset() {
    if (!sound) return;
    span = whole(sound.duration);
    commit();
  }

  /** The field being typed in, and what's typed; otherwise the fields show the edges. */
  let typing = $state<{ edge: 'start' | 'end'; text: string } | null>(null);
  let badTime = $state(false);

  function typed(edge: 'start' | 'end') {
    if (!sound || typing?.edge !== edge) return;
    const t = parseTime(typing.text);
    typing = null;
    if (!Number.isFinite(t)) {
      badTime = true;
      return;
    }
    badTime = false;
    span = setEdge(span, edge, t, sound.duration);
    commit();
  }

  // ── Playing the part kept ─────────────────────────────────────────────────────────────

  let player = $state<HTMLAudioElement>();
  let playing = $state(false);
  let at = $state<number | null>(null);
  let cantPlay = $state(false);
  let frame = 0;

  async function play() {
    if (!player || !sound) return;
    if (playing) return stop();
    cantPlay = false;
    try {
      player.currentTime = span.start;
      await player.play();
      playing = true;
      tick();
    } catch {
      cantPlay = true;
      stop();
    }
  }

  function tick() {
    if (!playing || !player) return;
    if (player.currentTime >= span.end || player.ended) return stop();
    at = Math.max(span.start, player.currentTime);
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    player?.pause();
    playing = false;
    at = null;
  }
</script>

<div class="cols">
  <div class="stack">
    {#if single && first}
      <figure class="plate">
        {#if trimming}
          <Wave peaks={sound!.peaks} duration={sound!.duration} {span} {at} onchange={(s) => (span = s)} oncommit={commit} />
        {:else}
          <div class="waiting"><span class="note" aria-live="polite">{w('reading')}</span></div>
        {/if}
      </figure>
      {#if trimming}
        <div class="times" role="group" aria-label={w('trim')}>
          {#each EDGES as edge (edge)}
            <label class="time">
              <span class="label">{w(edge)}</span>
              <input
                class="field"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                spellcheck="false"
                value={typing?.edge === edge ? typing.text : formatTime(span[edge], mark)}
                onfocus={(e) => {
                  typing = { edge, text: e.currentTarget.value };
                  e.currentTarget.select();
                }}
                oninput={(e) => (typing = { edge, text: e.currentTarget.value })}
                onblur={() => typed(edge)}
                onkeydown={(e) => e.key === 'Enter' && typed(edge)}
              />
            </label>
          {/each}
          <div class="time">
            <span class="label">{w('kept')}</span>
            <output class="length">{formatTime(span.end - span.start, mark)}</output>
          </div>
          <div class="acts">
            <button type="button" class="btn play" onclick={play} aria-pressed={playing}>
              {#if playing}<Square aria-hidden="true" />{w('stop')}{:else}<Play aria-hidden="true" />{w('play')}{/if}
            </button>
            <button type="button" class="btn play" onclick={reset} disabled={!isTrimmed(span, sound!.duration)}>{w('whole')}</button>
          </div>
        </div>
        {#if badTime}<p class="note bad" role="alert">{w('badTime')}</p>{/if}
        {#if cantPlay}<p class="note">{w('cantPlay')}</p>{/if}
        <audio bind:this={player} src={sound!.url} preload="auto" onended={stop}></audio>
      {/if}
    {/if}
    {#each entries as e, i (e.file)}
      <FileRow name={e.file.name} meta={rowMeta(e)} icon={AudioLines} onremove={() => remove(i)} />
    {/each}
    {#if entries.length}
      {#if entries.length > 1}<p class="note">{w('oneAtATime')}</p>{/if}
      <DropWell accept="audio/*,video/*" multiple compact title={w('add')} onfiles={add} />
    {:else}
      <DropWell accept="audio/*,video/*" multiple title={w('drop')} hint={w('dropHint')} onfiles={add} />
    {/if}
    {#if adding}<p class="note" aria-live="polite">{w('reading')}</p>{/if}
    {#each errors as err (err)}<p class="note bad" role="alert">{err}</p>{/each}
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('format')}</dt>
        <dd>
          <Seg
            label={w('format')}
            value={format}
            options={[
              { value: 'mp3', label: 'MP3' },
              { value: 'wav', label: 'WAV' },
            ]}
            onchange={(v) => (o.format = v)}
          />
          {#if format === 'wav'}<span class="note">{w('pcm')}</span>{/if}
        </dd>
      </div>
      {#if format === 'mp3'}
        <div>
          <dt>{w('bitrate')}</dt>
          <dd>
            <Seg label={w('bitrate')} value={kbps} options={BITRATES.map((k) => ({ value: k, label: `${k} kbps` }))} onchange={(v) => (o.kbps = v)} />
          </dd>
        </div>
      {/if}
      {#if first}
        <div>
          <dt>{w('length')}</dt>
          <dd class="fact">
            {#if trimming && trimmed}
              <span><b>{formatTime(kept.end - kept.start, mark)}</b> {w('of', { whole: formatTime(sound!.duration, mark) })}</span>
            {:else if trimming}
              <span>{formatTime(sound!.duration, mark)}</span>
            {:else}
              <span>{formatLength(totalSeconds, mark)}</span>
            {/if}
          </dd>
        </div>
        {#if single && channelCount}
          <div>
            <dt>{w('channels')}</dt>
            <dd class="fact"><span>{channelWord(channelCount)}</span></dd>
          </div>
        {/if}
        <div>
          <dt>{w('rate')}</dt>
          <dd class="fact"><span>{formatRate(RATE, mark)}</span></dd>
        </div>
        <div>
          <dt>{w('result')}</dt>
          <dd>
            {#if outputs}
              <div class="big">
                <b>{formatBytes(after, mark)}</b>
                <s>{formatBytes(before, mark)}</s>
                {#if after < before * 0.99}<em>{percent(before, after)}</em>{/if}
              </div>
              {#if outputs.length > 1}<span class="note">{w('files', { n: outputs.length })}</span>{/if}
            {:else if working}
              <span class="note" aria-live="polite">
                {#if entries.length > 1}{w('workingN', { i: working.i + 1, n: entries.length })} {working.pct} %{:else}{w('workingAt', { name: working.entry.file.name, pct: working.pct })}{/if}
              </span>
            {:else}
              <span class="note" aria-live="polite">{w('working', { name: first.file.name })}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if entries.length}
      <SaveButton {outputs} busy={jobs.busy || adding > 0} zipName="audio" tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} />
    {/if}
  </div>
</div>

<style>
  .waiting {
    display: grid;
    place-items: center;
    height: 132px;
    border: 1px solid var(--ink);
    background: var(--sunk);
  }

  @media (min-width: 760px) {
    .waiting {
      height: 168px;
    }
  }

  .times {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px 12px;
    align-items: end;
  }

  .time {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .time .field {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    min-height: 44px;
  }

  .length {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 2px;
    font-family: var(--mono);
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .acts {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .btn.play {
    min-height: 44px;
    padding-inline: 14px;
  }

  @media (min-width: 1100px) {
    .times {
      grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    }

    .acts {
      grid-column: auto;
    }
  }

  .fact {
    font-variant-numeric: tabular-nums;
  }

  .fact b {
    font-weight: 700;
  }

  audio {
    display: none;
  }
</style>

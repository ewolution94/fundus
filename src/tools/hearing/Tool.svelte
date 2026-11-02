<!--
  F-602 Hearing test: a sine tone climbs from 2 kHz to the top the device plays, in one ear or both;
  "Gone" (or Space) marks where it vanished. Three runs per ear, the median is the result, set
  against a rough guide by age. And a tone generator: any frequency from 20 Hz to 20 kHz, four
  waves, presets. Safety first: the volume starts low, the gain never passes a ceiling, every start
  and stop fades, and sound stops when the page is hidden or the tool closes.
-->
<script lang="ts">
  import { Play, Square } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { unlockAudio } from '../../lib/sound.ts';
  import { parseNumber, formatNumber } from '../../lib/numbers.ts';
  import type { Item } from '../../lib/inbox.svelte.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { Voice } from './voice.ts';
  import {
    START_HZ,
    MAX_HZ,
    HOLD_S,
    RUNS,
    GUIDE,
    TONE_MIN,
    TONE_MAX,
    SLIDER_STEPS,
    START_VOLUME,
    PRESETS,
    freqAt,
    timeAt,
    topFor,
    roundHz,
    resultOf,
    typicalAge,
    sliderToHz,
    hzToSlider,
    tidyHz,
    gainFor,
    panFor,
    type Run,
    type Ear,
    type Wave,
  } from './hearing.ts';

  let { tool: _tool, items: _items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Mode',
      test: 'Test',
      tones: 'Tones',
      warn: 'Use headphones at a low volume. This isn’t a medical test, and your device or headphones may stop before your ears do.',
      ear: 'Ear',
      left: 'Left',
      right: 'Right',
      both: 'Both',
      volume: 'Volume',
      start: 'Start',
      startRun: 'Start run {n} of {total}',
      again: 'Test again',
      gone: 'Gone',
      goneHint: 'Tap Gone, or press Space, the moment you can’t hear it.',
      startHint: 'The tone starts at 2,000 Hz and climbs. Three runs per ear.',
      runOf: 'Run {n} of {total}',
      results: 'Results',
      resultsNote: 'the middle of three runs',
      top: 'the top this device plays',
      topShort: 'top',
      deviceTop: 'This device plays up to {hz}.',
      guide: 'Rough guide',
      guideNote: 'The typical upper limit by age, roughly. Hearing varies a lot from person to person.',
      u20: 'under 20',
      '30': '30',
      '40': '40',
      '50': '50',
      '60': '60',
      '70': '70',
      typical: 'typical at about {age}',
      typicalYoung: 'typical under 20',
      none: 'No runs yet.',
      noAudio: 'This browser can’t play sound.',
      noSound: 'The sound didn’t start. Check the sound is on, then tap Start again.',
      noPan: 'This browser can’t pick one ear: the tone plays in both.',
      stoppedHidden: 'The sound stopped while the page was hidden.',
      recorded: '{ear}, run {n}: {hz}',
      frequency: 'Frequency',
      slider: 'Frequency slider',
      wave: 'Wave',
      sine: 'Sine',
      square: 'Square',
      triangle: 'Triangle',
      sawtooth: 'Sawtooth',
      presets: 'Presets',
      a440: 'A 440 Hz',
      k1: '1 kHz',
      mosquito: 'Mosquito 17.4 kHz',
      play: 'Play',
      stop: 'Stop',
      range: 'From 20 to 20,000 Hz.',
      toneNote: 'Use headphones at a low volume. High tones may be beyond your speakers.',
    },
    de: {
      mode: 'Modus',
      test: 'Test',
      tones: 'Töne',
      warn: 'Nimm Kopfhörer und stell sie leise. Das ist kein medizinischer Test, und dein Gerät oder deine Kopfhörer können früher aufhören als deine Ohren.',
      ear: 'Ohr',
      left: 'Links',
      right: 'Rechts',
      both: 'Beide',
      volume: 'Lautstärke',
      start: 'Start',
      startRun: 'Lauf {n} von {total} starten',
      again: 'Noch mal testen',
      gone: 'Weg',
      goneHint: 'Tipp auf Weg oder drück die Leertaste, sobald du ihn nicht mehr hörst.',
      startHint: 'Der Ton beginnt bei 2.000 Hz und steigt. Drei Läufe pro Ohr.',
      runOf: 'Lauf {n} von {total}',
      results: 'Ergebnisse',
      resultsNote: 'die Mitte aus drei Läufen',
      top: 'das Höchste, was dieses Gerät spielt',
      topShort: 'oben',
      deviceTop: 'Dieses Gerät spielt bis {hz}.',
      guide: 'Grobe Orientierung',
      guideNote: 'Die typische obere Grenze nach Alter, grob. Das Gehör ist von Mensch zu Mensch sehr verschieden.',
      u20: 'unter 20',
      typical: 'typisch für etwa {age}',
      typicalYoung: 'typisch unter 20',
      none: 'Noch keine Läufe.',
      noAudio: 'Dieser Browser kann keinen Ton abspielen.',
      noSound: 'Der Ton ist nicht angegangen. Prüf, ob der Ton an ist, und tipp noch mal auf Start.',
      noPan: 'Dieser Browser kann kein einzelnes Ohr wählen: der Ton spielt auf beiden.',
      stoppedHidden: 'Der Ton hat aufgehört, als die Seite verdeckt war.',
      recorded: '{ear}, Lauf {n}: {hz}',
      frequency: 'Frequenz',
      slider: 'Frequenz-Regler',
      wave: 'Welle',
      sine: 'Sinus',
      square: 'Rechteck',
      triangle: 'Dreieck',
      sawtooth: 'Sägezahn',
      presets: 'Vorlagen',
      a440: 'Kammerton A 440 Hz',
      k1: '1 kHz',
      mosquito: 'Mosquito 17,4 kHz',
      play: 'Abspielen',
      stop: 'Stopp',
      range: 'Von 20 bis 20.000 Hz.',
      toneNote: 'Nimm Kopfhörer und stell sie leise. Hohe Töne schaffen Lautsprecher oft nicht.',
    },
  });

  type Mode = 'test' | 'tones';
  // The mode, the ear and the wave are kept. The volume isn't: it always starts low.
  const o = remember('hearing', { mode: 'test' as Mode, ear: 'both' as Ear, wave: 'sine' as Wave });

  let volume = $state(Math.round(START_VOLUME * 100));
  let problem = $state('');
  let said = $state('');
  let panless = $state(false);

  const mark = $derived(locale() === 'de' ? 'comma' : 'point');
  const hzText = (hz: number) => `${formatNumber(Math.round(hz), mark, { max: 0 })} Hz`;
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // ── The test ─────────────────────────────────────────────────────────────────────────────

  let phase = $state<'idle' | 'starting' | 'running'>('idle');
  let live = $state(START_HZ);
  let top = $state<number | null>(null);
  let runs = $state<Record<Ear, Run[]>>({ left: [], right: [], both: [] });
  let voice: Voice | null = null;
  let startedAt = 0;
  let span = 0;
  let lag = 0;
  let frame = 0;
  // A Space that said "Gone" mustn't also press the button it leaves focused.
  let spaceHeld = false;

  const done = $derived(runs[o.ear].length);
  const startLabel = $derived(done >= RUNS ? w('again') : done === 0 ? w('start') : w('startRun', { n: done + 1, total: RUNS }));

  async function start() {
    if (phase !== 'idle' || spaceHeld) return;
    problem = '';
    const ctx = unlockAudio({ playback: true });
    if (!ctx) {
      problem = w('noAudio');
      return;
    }
    stopTone();
    phase = 'starting';
    if (ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => undefined), wait(1000)]);
    if (phase !== 'starting') return;
    if (ctx.state !== 'running') {
      phase = 'idle';
      problem = w('noSound');
      return;
    }
    if (runs[o.ear].length >= RUNS) runs[o.ear] = [];
    top = topFor(ctx.sampleRate);
    span = timeAt(top);
    voice = new Voice(ctx, { hz: START_HZ, wave: 'sine', level: gainFor(volume / 100), pan: panFor(o.ear) });
    panless = !voice.pans && o.ear !== 'both';
    voice.sweep(START_HZ, top, span);
    // What's heard lags what's played by the output's latency (Bluetooth: a lot).
    lag = Math.min(0.5, Math.max(0, ctx.outputLatency || 0));
    startedAt = performance.now();
    live = START_HZ;
    phase = 'running';
    frame = requestAnimationFrame(tick);
  }

  function elapsed() {
    return (performance.now() - startedAt) / 1000 - lag;
  }

  function tick() {
    const t = elapsed();
    live = freqAt(Math.min(t, span));
    if (t >= span + HOLD_S) {
      finish(top ?? MAX_HZ, true);
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function gone() {
    if (phase !== 'running') return;
    const t = elapsed();
    finish(Math.min(top ?? MAX_HZ, freqAt(Math.min(t, span))), t >= span);
  }

  function finish(hz: number, reachedTop: boolean) {
    cancelAnimationFrame(frame);
    voice?.stop();
    voice = null;
    phase = 'idle';
    live = hz;
    const list = [...runs[o.ear], { hz, top: reachedTop }];
    runs[o.ear] = list;
    said = w('recorded', { ear: w(o.ear), n: list.length, hz: reachedTop ? w('top') : hzText(roundHz(hz)) });
    const result = resultOf(list);
    if (result) said += `. ${w(o.ear)}: ${result.top ? w('top') : hzText(roundHz(result.hz))}`;
  }

  /** Stops a run without counting it. */
  function abort() {
    if (phase === 'idle') return;
    cancelAnimationFrame(frame);
    voice?.stop();
    voice = null;
    phase = 'idle';
    live = START_HZ;
  }

  // Space says "Gone" while a run plays.
  $effect(() => {
    if (o.mode !== 'test') return;
    const isSpace = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ';
    const down = (e: KeyboardEvent) => {
      if (!isSpace(e) || phase !== 'running') return;
      e.preventDefault();
      spaceHeld = true;
      gone();
    };
    const up = (e: KeyboardEvent) => {
      if (!isSpace(e) || !spaceHeld) return;
      e.preventDefault();
      setTimeout(() => (spaceHeld = false));
    };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    return () => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
    };
  });

  const EARS: Ear[] = ['left', 'right', 'both'];
  const results = $derived(EARS.filter((e) => runs[e].length).map((e) => ({ ear: e, runs: runs[e], result: resultOf(runs[e]) })));

  // The guide's scale: 4 to 22 kHz.
  const SCALE = { lo: 4000, hi: 22000, x0: 58, x1: 300, row: 15, top: 22 };
  const xOf = (hz: number) => SCALE.x0 + ((Math.min(SCALE.hi, Math.max(SCALE.lo, hz)) - SCALE.lo) / (SCALE.hi - SCALE.lo)) * (SCALE.x1 - SCALE.x0);
  const scaleHeight = SCALE.top + GUIDE.length * SCALE.row + 22;
  const EAR_MARK: Record<Ear, string> = { left: 'L', right: 'R', both: 'L+R' };

  // ── Tones ────────────────────────────────────────────────────────────────────────────────

  let hz = $state(440);
  let typed = $state('440');
  let playing = $state(false);
  let tone: Voice | null = null;
  const typedOk = $derived.by(() => {
    const v = parseNumber(typed);
    return Number.isFinite(v) && v >= TONE_MIN && v <= TONE_MAX;
  });

  const show = (v: number) => formatNumber(tidyHz(v), mark, { max: 1, group: false });

  function setHz(v: number, fromTyping = false) {
    hz = tidyHz(v);
    if (!fromTyping) typed = show(hz);
    tone?.glide(hz);
  }

  function type(s: string) {
    typed = s;
    const v = parseNumber(s);
    if (Number.isFinite(v) && v >= TONE_MIN && v <= TONE_MAX) setHz(v, true);
  }

  function play() {
    problem = '';
    const ctx = unlockAudio({ playback: true });
    if (!ctx) {
      problem = w('noAudio');
      return;
    }
    abort();
    tone?.stop();
    tone = new Voice(ctx, { hz, wave: o.wave, level: gainFor(volume / 100, o.wave), pan: panFor(o.ear) });
    panless = !tone.pans && o.ear !== 'both';
    playing = true;
  }

  function stopTone() {
    tone?.stop();
    tone = null;
    playing = false;
  }

  // Volume, wave and ear follow at once, into whatever plays.
  $effect(() => {
    const level = volume / 100;
    const wave = o.wave;
    tone?.wave(wave, gainFor(level, wave));
    voice?.level(gainFor(level));
  });
  $effect(() => {
    const pan = panFor(o.ear);
    tone?.pan(pan);
  });

  // Sound stops when the page is hidden, and when the tool closes.
  $effect(() => {
    const hidden = () => {
      if (document.visibilityState !== 'hidden') return;
      if (phase !== 'idle' || playing) said = w('stoppedHidden');
      abort();
      stopTone();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      abort();
      stopTone();
    };
  });

  function setMode(m: Mode) {
    if (m === o.mode) return;
    abort();
    stopTone();
    o.mode = m;
  }
</script>

<!-- A big figure's grouping mark sits closer than its (equal-width) digits. -->
{#snippet figure(text: string)}{#each text.split(/([.,])/) as part, i (i)}{#if part === '.' || part === ','}<i class="sep">{part}</i>{:else}{part}{/if}{/each}{/snippet}

<div class="hear">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'test', label: w('test') },
      { value: 'tones', label: w('tones') },
    ]}
    onchange={setMode}
  />

  {#if o.mode === 'test'}
    <div class="cols">
      <div class="stack">
        <p class="warn">{w('warn')}</p>
        <div class="readout" class:on={phase === 'running'}>
          <span class="figure" data-live={Math.round(live)}>{@render figure(formatNumber(Math.round(live), mark, { max: 0 }))}</span>
          <span class="unit">Hz</span>
        </div>
        <button
          type="button"
          class="btn main"
          class:ink={phase !== 'running'}
          class:gone={phase === 'running'}
          disabled={phase === 'starting'}
          onclick={() => (phase === 'running' ? gone() : start())}>{phase === 'running' ? w('gone') : startLabel}</button
        >
        <p class="note" aria-live="polite">
          {#if phase === 'running'}{w('runOf', { n: done + 1, total: RUNS })} · {w('goneHint')}{:else}{w('startHint')}{/if}
        </p>
        {#if problem}<p class="note bad" role="alert">{problem}</p>{/if}
        {#if panless}<p class="note">{w('noPan')}</p>{/if}
      </div>

      <div class="stack">
        <dl class="spec">
          <div>
            <dt>{w('ear')}</dt>
            <dd>
              <Seg
                label={w('ear')}
                value={o.ear}
                options={EARS.map((e) => ({ value: e, label: w(e), disabled: phase !== 'idle' }))}
                onchange={(e) => (o.ear = e)}
              />
            </dd>
          </div>
          <div>
            <dt><label for="hear-volume">{w('volume')}</label></dt>
            <dd class="vol">
              <input id="hear-volume" class="range" type="range" min="0" max="100" step="1" value={volume} oninput={(e) => (volume = Number(e.currentTarget.value))} />
              <b class="m">{volume} %</b>
            </dd>
          </div>
        </dl>

        <section class="stack" aria-labelledby="hear-results">
          <h2 class="h" id="hear-results">{w('results')}<em>{w('resultsNote')}</em></h2>
          {#each results as r (r.ear)}
            <div class="ear-result" data-result={r.ear}>
              <p class="line-big">
                <span>{w(r.ear)}:</span>
                {#if r.result}
                  <b class="hl" data-median={Math.round(r.result.hz)}>{r.result.top ? w('top') : hzText(roundHz(r.result.hz))}</b>
                {:else}
                  <span class="m pending">{w('runOf', { n: r.runs.length, total: RUNS })}</span>
                {/if}
              </p>
              <p class="m runs">
                {#each r.runs as run, i (i)}<span data-run={Math.round(run.hz)}>{run.top ? `${w('topShort')} ${hzText(run.hz)}` : hzText(roundHz(run.hz))}</span>{/each}
              </p>
              {#if r.result && !r.result.top}
                {@const age = typicalAge(r.result.hz)}
                <p class="note">{age === 'u20' ? w('typicalYoung') : w('typical', { age: w(age) })}</p>
              {/if}
            </div>
          {:else}
            <p class="note">{w('none')}</p>
          {/each}
          {#if top}<p class="note">{w('deviceTop', { hz: hzText(top) })}</p>{/if}
        </section>

        <section class="stack" aria-labelledby="hear-guide">
          <h2 class="h" id="hear-guide">{w('guide')}</h2>
          <svg class="scale" viewBox="0 0 320 {scaleHeight}" role="img" aria-label={w('guideNote')}>
            {#each [4000, 8000, 12000, 16000, 20000] as k (k)}
              <line x1={xOf(k)} x2={xOf(k)} y1={SCALE.top - 4} y2={scaleHeight - 18} class="grid" />
              <text x={xOf(k)} y={scaleHeight - 6} text-anchor="middle" class="tick">{k / 1000} kHz</text>
            {/each}
            {#each GUIDE as g, i (g.age)}
              {@const y = SCALE.top + i * SCALE.row + SCALE.row / 2}
              <text x={SCALE.x0 - 8} y={y + 3.5} text-anchor="end" class="age">{w(g.age)}</text>
              <rect x={xOf(g.lo) - (g.lo === g.hi ? 2 : 0)} y={y - 4} width={Math.max(4, xOf(g.hi) - xOf(g.lo))} height="8" class="band" />
            {/each}
            {#each results.filter((r) => r.result) as r (r.ear)}
              {@const x = xOf(r.result!.hz)}
              <rect x={x - 2} y={SCALE.top - 6} width="4" height={GUIDE.length * SCALE.row + 8} class="you" />
              <text x={x} y={SCALE.top - 9} text-anchor="middle" class="you-label">{EAR_MARK[r.ear]}</text>
            {/each}
          </svg>
          <p class="note">{w('guideNote')}</p>
        </section>
      </div>
    </div>
  {:else}
    <div class="cols">
      <div class="stack">
        <dl class="spec">
          <div>
            <dt>{w('frequency')}</dt>
            <dd>
              <NumIn label={w('frequency')} value={typed} unit="Hz" inputmode="decimal" oninput={type} />
              <input
                class="range"
                type="range"
                aria-label={w('slider')}
                min="0"
                max={SLIDER_STEPS}
                step="1"
                value={hzToSlider(hz)}
                oninput={(e) => setHz(sliderToHz(Number(e.currentTarget.value)))}
              />
              {#if !typedOk}<span class="note bad" role="alert">{w('range')}</span>{/if}
            </dd>
          </div>
          <div>
            <dt>{w('presets')}</dt>
            <dd class="presets">
              {#each PRESETS as p (p.id)}
                <button type="button" class="btn small" aria-pressed={Math.round(hz) === p.hz} onclick={() => setHz(p.hz)}>{w(p.id)}</button>
              {/each}
            </dd>
          </div>
          <div>
            <dt>{w('wave')}</dt>
            <dd>
              <Seg
                label={w('wave')}
                value={o.wave}
                options={(['sine', 'triangle', 'square', 'sawtooth'] as Wave[]).map((v) => ({ value: v, label: w(v) }))}
                onchange={(v) => (o.wave = v)}
              />
            </dd>
          </div>
          <div>
            <dt>{w('ear')}</dt>
            <dd>
              <Seg label={w('ear')} value={o.ear} options={EARS.map((e) => ({ value: e, label: w(e) }))} onchange={(e) => (o.ear = e)} />
            </dd>
          </div>
          <div>
            <dt><label for="tone-volume">{w('volume')}</label></dt>
            <dd class="vol">
              <input id="tone-volume" class="range" type="range" min="0" max="100" step="1" value={volume} oninput={(e) => (volume = Number(e.currentTarget.value))} />
              <b class="m">{volume} %</b>
            </dd>
          </div>
        </dl>
      </div>

      <div class="stack">
        <div class="readout" class:on={playing}>
          <span class="figure" data-tone={hz}>{@render figure(formatNumber(tidyHz(hz), mark, { max: 1 }))}</span>
          <span class="unit">Hz</span>
        </div>
        <button type="button" class="btn main ink" aria-pressed={playing} onclick={() => (playing ? stopTone() : play())}>
          {#if playing}<Square aria-hidden="true" />{w('stop')}{:else}<Play aria-hidden="true" />{w('play')}{/if}
        </button>
        {#if problem}<p class="note bad" role="alert">{problem}</p>{/if}
        {#if panless}<p class="note">{w('noPan')}</p>{/if}
        <p class="note">{w('toneNote')}</p>
      </div>
    </div>
  {/if}
</div>
<p class="sr" aria-live="polite">{said}</p>

<style>
  .hear {
    display: grid;
    gap: 18px;
  }

  .warn {
    padding: 10px 12px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    font-size: 14px;
    font-weight: 600;
  }

  .readout {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 18px 0 10px;
    border-bottom: 1.5px solid var(--ink);
    color: var(--ink-2);
    min-width: 0;
  }

  .readout.on {
    color: var(--ink);
  }

  .figure {
    font-size: clamp(52px, 17vw, 88px);
    font-weight: 800;
    letter-spacing: -0.045em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .sep {
    font-style: normal;
    font-variant-numeric: normal;
    margin: 0 -0.06em;
  }

  .unit {
    font-size: 22px;
    font-weight: 700;
  }

  .main {
    width: 100%;
    min-height: 64px;
    font-size: 20px;
    font-weight: 800;
  }

  .main :global(svg) {
    width: 20px;
    height: 20px;
  }

  /* "Gone": the one thing to press, under the highlighter. */
  .main.gone {
    background: var(--mark);
    color: var(--mark-ink);
    border-color: var(--ink);
    min-height: 96px;
    font-size: 28px;
  }

  .vol {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .vol b {
    flex: none;
    min-width: 5ch;
    text-align: right;
  }

  .range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    min-width: 0;
    height: 40px;
    margin: 0;
    background: transparent;
  }

  .range::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--ink);
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -9px;
    background: var(--card);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }

  .range::-moz-range-track {
    height: 2px;
    background: var(--ink);
  }

  .range::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--card);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .presets .btn {
    min-height: 40px;
  }

  .presets .btn[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
  }

  .ear-result {
    display: grid;
    gap: 2px;
    padding: 4px 0 10px;
    border-bottom: 1px dashed var(--rule);
  }

  .line-big {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    font-size: 18px;
    font-weight: 700;
  }

  .line-big b {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    padding: 0 6px;
  }

  .pending {
    color: var(--ink-2);
  }

  .runs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    color: var(--ink-2);
  }

  .scale {
    width: 100%;
    max-width: 440px;
    height: auto;
    overflow: visible;
  }

  .scale .grid {
    stroke: var(--rule);
    stroke-width: 1;
  }

  .scale .tick,
  .scale .age {
    fill: var(--ink-2);
    font-family: var(--mono);
    font-size: 8px;
  }

  .scale .age {
    fill: var(--ink);
  }

  .scale .band {
    fill: var(--ink);
  }

  .scale .you {
    fill: var(--mark);
    stroke: var(--ink);
    stroke-width: 0.75;
  }

  .scale .you-label {
    fill: var(--ink);
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 700;
  }
</style>

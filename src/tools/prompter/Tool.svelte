<!--
  F-308 Teleprompter: a text, a speed in words a minute, and Start. The stage covers the window
  (and the screen, where the browser allows it): the text large and dark, a reading line a third of
  the way down, the text moving up at the speed. It moves by a transform on an animation-frame clock
  that counts real time, so a slow frame never changes the speed; the speed in px/s comes from the
  measured text (its height over its words, times the words a second). Space or a tap pauses, the
  arrows change the speed and jump, a page-turner remote works, Esc stops. The text is never kept;
  the options are.
-->
<script lang="ts">
  import { untrack, flushSync, tick } from 'svelte';
  import { Play, Pause, Minus, Plus, X, RotateCcw } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { readText } from '../../lib/textfile.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { Awake, canFullscreen, enterFullscreen, exitFullscreen, onFullscreenChange } from '../../lib/awake.svelte.ts';
  import { lockScroll } from '../../../vendor/ewo/elements/scroll-lock.js';
  import { trapTab } from './trap.ts';
  import { countWords, clampWpm, pxPerSecond, timeLeftMs, clock, estimate, jump, MIN_WPM, MAX_WPM, DEFAULT_WPM, STEP_WPM } from './prompter.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      text: 'Text',
      placeholder: 'Type or paste what you’ll read out.',
      'words.one': '{n} word',
      'words.other': '{n} words',
      speed: 'Speed',
      slower: 'Slower',
      faster: 'Faster',
      wpm: '{n} wpm',
      wpmLong: '{n} words a minute',
      size: 'Text size',
      margin: 'Margin',
      narrow: 'Narrow',
      wide: 'Wide',
      screen: 'Screen',
      mirror: 'Mirror',
      mirrorHint: 'Left and right swapped, for a glass prompter',
      flip: 'Flip',
      flipHint: 'Upside down, for a screen mounted that way',
      countdown: '3-2-1 countdown',
      countdownHint: 'Before the text starts moving',
      length: 'Length',
      about: 'about',
      atSpeed: 'at {n} words a minute',
      empty: 'Type or paste a text first.',
      start: 'Start',
      keys: 'While it runs: Space or a tap pauses, ↑ and ↓ change the speed, Page Up and Page Down jump, Esc stops. A drag moves the text while it’s paused.',
      lockOn: 'The screen stays on while the prompter is open.',
      lockOff: 'This browser can’t keep the screen on: keep it awake yourself.',
      stage: 'Teleprompter',
      pause: 'Pause',
      resume: 'Resume',
      again: 'Again',
      close: 'Close',
      left: '{t} left',
      paused: 'Paused',
      startsIn: 'Starts in {n}',
      theEnd: 'The end.',
    },
    de: {
      text: 'Text',
      placeholder: 'Tipp oder füg ein, was du vorliest.',
      'words.one': '{n} Wort',
      'words.other': '{n} Wörter',
      speed: 'Tempo',
      slower: 'Langsamer',
      faster: 'Schneller',
      wpm: '{n} W./Min.',
      wpmLong: '{n} Wörter pro Minute',
      size: 'Schriftgröße',
      margin: 'Rand',
      narrow: 'Schmal',
      wide: 'Breit',
      screen: 'Bildschirm',
      mirror: 'Spiegeln',
      mirrorHint: 'Links und rechts vertauscht, für einen Prompter mit Glas',
      flip: 'Drehen',
      flipHint: 'Kopfüber, für einen Bildschirm, der so hängt',
      countdown: 'Countdown 3-2-1',
      countdownHint: 'Bevor der Text losläuft',
      length: 'Länge',
      about: 'etwa',
      atSpeed: 'bei {n} Wörtern pro Minute',
      empty: 'Tipp oder füg zuerst einen Text ein.',
      start: 'Start',
      keys: 'Beim Lesen: Leertaste oder Tippen pausiert, ↑ und ↓ ändern das Tempo, Bild auf und Bild ab springen, Esc beendet. In der Pause verschiebst du den Text mit dem Finger oder der Maus.',
      lockOn: 'Der Bildschirm bleibt an, solange der Prompter offen ist.',
      lockOff: 'Dieser Browser kann den Bildschirm nicht anlassen: halt ihn selbst wach.',
      stage: 'Teleprompter',
      pause: 'Pause',
      resume: 'Weiter',
      again: 'Noch mal',
      close: 'Schließen',
      left: 'noch {t}',
      paused: 'Pausiert',
      startsIn: 'Geht los in {n}',
      theEnd: 'Ende.',
    },
  });

  type Size = 's' | 'm' | 'l' | 'xl';
  const SIZES: Size[] = ['s', 'm', 'l', 'xl'];

  // How it's set is kept; the text is not.
  const o = remember('prompter', { wpm: DEFAULT_WPM, size: 'm' as Size, margin: 'narrow' as 'narrow' | 'wide', mirror: false, flip: false, countdown: true });
  untrack(() => {
    o.wpm = clampWpm(o.wpm);
    if (!SIZES.includes(o.size)) o.size = 'm';
    if (o.margin !== 'narrow' && o.margin !== 'wide') o.margin = 'narrow';
  });

  let text = $state('');

  // A text pasted on the home, or a .txt dropped there, goes in once.
  const given = untrack(() => texts(items));
  if (given.length) text = given.join('\n\n');
  else {
    const file = untrack(() => files(items))[0];
    if (file) void readText(file).then((r) => 'text' in r && (text = r.text));
  }

  const count = $derived(countWords(text));
  const length = $derived(estimate(count, o.wpm));
  const canLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  // ── The stage ──────────────────────────────────────────────────────────────────────────────

  type Phase = 'setup' | 'count' | 'run' | 'pause' | 'end';
  let phase = $state<Phase>('setup');
  let counter = $state(3);
  let left = $state('');
  let readout = $state('');
  let barShown = $state(true);
  let said = $state('');

  let stage = $state<HTMLDivElement>();
  let view = $state<HTMLDivElement>();
  let roll = $state<HTMLDivElement>();
  let startButton = $state<HTMLButtonElement>();

  // The layout and the position, outside Svelte's state: they change every frame.
  let height = 0;
  let viewH = 0;
  let line = 0;
  let offset = 0;
  let last = 0;
  let frame = 0;
  let countTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let readoutTimer: ReturnType<typeof setTimeout> | undefined;
  let unlock: (() => void) | null = null;

  const awake = new Awake();

  function start() {
    if (!count || phase !== 'setup') return;
    offset = 0;
    phase = o.countdown ? 'count' : 'run';
    // The stage is in the page now, so full screen is asked for straight from the tap.
    flushSync();
    unlock = lockScroll();
    void awake.set(true);
    if (stage && canFullscreen()) void enterFullscreen(stage);
    stage?.focus({ preventScroll: true });
    measure();
    begin();
  }

  /** The countdown, if it's on, then the text moves. */
  function begin() {
    stopLoop();
    clearTimeout(countTimer);
    if (o.countdown) {
      phase = 'count';
      counter = 3;
      said = w('startsIn', { n: 3 });
      countTimer = setTimeout(stepCount, 1000);
    } else run();
  }

  function stepCount() {
    counter--;
    if (counter <= 0) return run();
    said = w('startsIn', { n: counter });
    countTimer = setTimeout(stepCount, 1000);
  }

  function run() {
    phase = 'run';
    said = '';
    last = performance.now();
    frame = requestAnimationFrame(loop);
    reveal();
  }

  /** One frame: the text moves by the time since the last one (a hidden tab's gap counts as a moment). */
  function loop() {
    const now = performance.now();
    const dt = Math.min(250, Math.max(0, now - last));
    last = now;
    offset += (dt / 1000) * pxPerSecond(height, count, o.wpm);
    if (offset >= height) {
      offset = height;
      paint();
      finish();
      return;
    }
    paint();
    frame = requestAnimationFrame(loop);
  }

  function stopLoop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function pause() {
    if (phase !== 'run') return;
    stopLoop();
    phase = 'pause';
    barShown = true;
  }

  function toggle() {
    if (phase === 'run') pause();
    else if (phase === 'pause') run();
  }

  function finish() {
    stopLoop();
    phase = 'end';
    barShown = true;
    said = w('theEnd');
  }

  function again() {
    offset = 0;
    paint();
    begin();
  }

  function close() {
    if (phase === 'setup') return;
    stopLoop();
    clearTimeout(countTimer);
    clearTimeout(idleTimer);
    clearTimeout(readoutTimer);
    phase = 'setup';
    readout = '';
    said = '';
    barShown = true;
    unlock?.();
    unlock = null;
    void awake.set(false);
    // Focus back on Start once full screen has ended (leaving it drops the focus).
    void exitFullscreen()
      .then(() => tick())
      .then(() => startButton?.focus({ preventScroll: true }));
  }

  /** The text where `offset` says: its first line on the reading line at 0. */
  function paint() {
    if (!roll) return;
    const y = viewH / 3 - line / 2 - offset;
    roll.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    left = clock(timeLeftMs(height ? offset / height : 0, count, o.wpm));
  }

  /** The text's height and the stage's, again after a resize or a turn of the phone: the place in
   *  the text stays. */
  function measure() {
    if (!view || !roll) return;
    const at = height ? offset / height : 0;
    height = roll.offsetHeight;
    viewH = view.clientHeight;
    line = parseFloat(getComputedStyle(roll).lineHeight) || 0;
    offset = at * height;
    paint();
  }

  $effect(() => {
    if (!view || !roll) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(view);
    ro.observe(roll);
    return () => ro.disconnect();
  });

  /** Moves the text by `by` px (forward is positive). From the end, back means paused again. */
  function move(by: number) {
    offset = jump(offset, by, height);
    if (phase === 'end' && offset < height) phase = 'pause';
    paint();
  }

  /** A screen's worth: what's below the reading line comes up to it, in whole lines. */
  const screenful = () => Math.max(1, Math.round((viewH * 0.6) / (line || 1))) * line;

  function speed(by: number) {
    o.wpm = clampWpm(o.wpm + by);
    readout = w('wpm', { n: o.wpm });
    clearTimeout(readoutTimer);
    readoutTimer = setTimeout(() => (readout = ''), 1200);
    paint();
  }

  // A mouse that really moves brings the controls back. Browsers send moves that go nowhere after a
  // scroll, and WebKit gives pointer moves no movementX, so the position is compared.
  let mouseAt = '';
  function mouseMoved(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    const at = `${Math.round(e.clientX)},${Math.round(e.clientY)}`;
    if (at === mouseAt) return;
    const first = !mouseAt;
    mouseAt = at;
    if (!first) reveal();
  }

  /** The bar comes back, and fades again after a moment while the text moves. */
  function reveal() {
    barShown = true;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (phase === 'run') barShown = false;
    }, 2500);
  }

  function key(e: KeyboardEvent) {
    if (phase === 'setup') return;
    // The stage has the keys: the page's own (Esc for home, / for search) wait behind it.
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target instanceof Element && e.target.closest('button');
    switch (e.key) {
      case ' ':
      case 'Spacebar':
        if (onButton) return;
        e.preventDefault();
        toggle();
        break;
      case 'ArrowUp':
      case '+':
      case '=':
        e.preventDefault();
        speed(STEP_WPM);
        break;
      case 'ArrowDown':
      case '-':
      case '_':
        e.preventDefault();
        speed(-STEP_WPM);
        break;
      case 'PageDown':
        e.preventDefault();
        move(screenful());
        break;
      case 'PageUp':
        e.preventDefault();
        move(-screenful());
        break;
      case 'ArrowRight':
        e.preventDefault();
        move(line);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        move(-line);
        break;
      case 'Home':
        e.preventDefault();
        move(-height);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        if (stage) trapTab(e, stage);
        break;
    }
  }

  // ── Taps and drags on the text ─────────────────────────────────────────────────────────────

  let press: { id: number; y: number; last: number; moved: boolean } | null = null;

  function down(e: PointerEvent) {
    if (e.button !== 0 || !view) return;
    reveal();
    press = { id: e.pointerId, y: e.clientY, last: e.clientY, moved: false };
    try {
      view.setPointerCapture(e.pointerId);
    } catch {}
  }

  function drag(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    // A few pixels are still a tap; past them, the whole way from the start counts.
    if (!press.moved) {
      if (Math.abs(e.clientY - press.y) <= 6) return;
      press.moved = true;
    }
    // While paused, the text follows the finger (upside down, the frame moves the other way).
    if (phase === 'pause' || phase === 'end') {
      const dy = e.clientY - press.last;
      move(o.flip ? dy : -dy);
    }
    press.last = e.clientY;
  }

  function up(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const tap = !press.moved;
    press = null;
    if (tap) toggle();
  }

  function wheel(e: WheelEvent) {
    const dy = e.deltaMode === 1 ? e.deltaY * line : e.deltaMode === 2 ? e.deltaY * viewH : e.deltaY;
    move(o.flip ? -dy : dy);
  }

  // ── Leaving ────────────────────────────────────────────────────────────────────────────────

  $effect(() => {
    // Ahead of the page's own keys (capture, on the window), so Esc closes the stage, not the tool.
    addEventListener('keydown', key, true);
    // Full screen ended by the browser's own means (its Esc, a gesture): the stage closes with it.
    const offFs = onFullscreenChange((on) => {
      if (!on) close();
    });
    return () => {
      removeEventListener('keydown', key, true);
      offFs();
      stopLoop();
      clearTimeout(countTimer);
      clearTimeout(idleTimer);
      clearTimeout(readoutTimer);
      unlock?.();
      unlock = null;
      void exitFullscreen();
      awake.destroy();
    };
  });

  const transform = $derived(o.mirror || o.flip ? `scale(${o.mirror ? -1 : 1}, ${o.flip ? -1 : 1})` : 'none');
  const running = $derived(phase === 'run');
</script>

<div class="cols">
  <div class="stack">
    <textarea
      class="field script"
      aria-label={w('text')}
      placeholder={w('placeholder')}
      spellcheck="true"
      value={text}
      oninput={(e) => (text = e.currentTarget.value)}
      onkeydown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          start();
        }
      }}
    ></textarea>
    <small class="m tally">{w('words', { n: count })}</small>
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt><label for="prompter-speed">{w('speed')}</label></dt>
        <dd class="speed">
          <button type="button" class="step" aria-label={w('slower')} disabled={o.wpm <= MIN_WPM} onclick={() => (o.wpm = clampWpm(o.wpm - STEP_WPM))}><Minus aria-hidden="true" /></button>
          <input id="prompter-speed" class="range" type="range" min={MIN_WPM} max={MAX_WPM} step={STEP_WPM} value={o.wpm} aria-valuetext={w('wpmLong', { n: o.wpm })} oninput={(e) => (o.wpm = clampWpm(Number(e.currentTarget.value)))} />
          <button type="button" class="step" aria-label={w('faster')} disabled={o.wpm >= MAX_WPM} onclick={() => (o.wpm = clampWpm(o.wpm + STEP_WPM))}><Plus aria-hidden="true" /></button>
          <b class="rate m" aria-hidden="true">{w('wpm', { n: o.wpm })}</b>
        </dd>
      </div>
      <div>
        <dt>{w('size')}</dt>
        <dd>
          <Seg
            label={w('size')}
            value={o.size}
            options={[
              { value: 's', label: 'S' },
              { value: 'm', label: 'M' },
              { value: 'l', label: 'L' },
              { value: 'xl', label: 'XL' },
            ]}
            onchange={(v) => (o.size = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('margin')}</dt>
        <dd>
          <Seg
            label={w('margin')}
            value={o.margin}
            options={[
              { value: 'narrow', label: w('narrow') },
              { value: 'wide', label: w('wide') },
            ]}
            onchange={(v) => (o.margin = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('screen')}</dt>
        <dd>
          <Check checked={o.mirror} label={w('mirror')} hint={w('mirrorHint')} onchange={(v) => (o.mirror = v)} />
          <Check checked={o.flip} label={w('flip')} hint={w('flipHint')} onchange={(v) => (o.flip = v)} />
          <Check checked={o.countdown} label={w('countdown')} hint={w('countdownHint')} onchange={(v) => (o.countdown = v)} />
        </dd>
      </div>
      <div>
        <dt>{w('length')}</dt>
        <dd>
          {#if count}
            <div class="big length"><span class="about">{w('about')}</span><b>{length}</b></div>
            <small class="note">{w('atSpeed', { n: o.wpm })}</small>
          {:else}
            <span class="note">{w('empty')}</span>
          {/if}
        </dd>
      </div>
    </dl>
    <button type="button" class="btn ink go" disabled={!count} bind:this={startButton} onclick={start}><Play aria-hidden="true" />{w('start')}</button>
    <p class="note">{w('keys')}</p>
    <p class="note">{canLock ? w('lockOn') : w('lockOff')}</p>
  </div>
</div>

{#if phase !== 'setup'}
  <div
    class="stage size-{o.size} margin-{o.margin}"
    class:idle={running && !barShown}
    role="dialog"
    aria-modal="true"
    aria-label={w('stage')}
    tabindex="-1"
    bind:this={stage}
    onpointermove={mouseMoved}
  >
    <!-- The reading area: mirrored or flipped as a whole, so the reading line goes along. A tap pauses
         and a drag moves the text; the keyboard does both (Space, the arrows). -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="view" style:transform bind:this={view} onpointerdown={down} onpointermove={drag} onpointerup={up} onpointercancel={() => (press = null)} onwheel={wheel}>
      <div class="roll" bind:this={roll}>{text.trim()}</div>
      <div class="shade" aria-hidden="true"></div>
      <i class="cue start" aria-hidden="true"></i>
      <i class="cue end" aria-hidden="true"></i>
      <!-- In the reading area, so a mirrored prompter shows it the right way round to the reader. -->
      {#if phase === 'count'}
        <div class="counter" aria-hidden="true">{counter}</div>
      {/if}
    </div>

    {#if readout || phase === 'pause'}
      <div class="readout m" aria-hidden="true">{readout || w('paused')}</div>
    {/if}

    {#if phase === 'end'}
      <div class="fin">
        <p>{w('theEnd')}</p>
        <button type="button" class="btn ink" onmousedown={(e) => e.preventDefault()} onclick={again}><RotateCcw aria-hidden="true" />{w('again')}</button>
      </div>
    {/if}

    <div class="bar" class:hide={running && !barShown}>
      {#if phase === 'end'}
        <button type="button" class="key" aria-label={w('again')} title={w('again')} onmousedown={(e) => e.preventDefault()} onclick={again}><RotateCcw aria-hidden="true" /></button>
      {:else}
        <button type="button" class="key" aria-label={running ? w('pause') : w('resume')} title={running ? w('pause') : w('resume')} disabled={phase === 'count'} onmousedown={(e) => e.preventDefault()} onclick={toggle}>
          {#if running}<Pause aria-hidden="true" />{:else}<Play aria-hidden="true" />{/if}
        </button>
      {/if}
      <button type="button" class="key" aria-label={w('slower')} title={w('slower')} disabled={o.wpm <= MIN_WPM} onmousedown={(e) => e.preventDefault()} onclick={() => speed(-STEP_WPM)}><Minus aria-hidden="true" /></button>
      <span class="rate m">{w('wpm', { n: o.wpm })}</span>
      <button type="button" class="key" aria-label={w('faster')} title={w('faster')} disabled={o.wpm >= MAX_WPM} onmousedown={(e) => e.preventDefault()} onclick={() => speed(STEP_WPM)}><Plus aria-hidden="true" /></button>
      <span class="left m">{w('left', { t: left })}</span>
      <button type="button" class="key" aria-label={w('close')} title={w('close')} onmousedown={(e) => e.preventDefault()} onclick={close}><X aria-hidden="true" /></button>
    </div>
    <p class="sr" aria-live="assertive">{said}</p>
  </div>
{/if}

<style>
  /* ── Setup ── */

  .script {
    min-height: 300px;
    font-size: 17px;
  }

  .tally {
    color: var(--ink-2);
  }

  .speed {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 40px auto;
    align-items: center;
    gap: 6px;
    justify-items: stretch;
    width: 100%;
  }

  .step {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--ink);
    background: var(--card);
    border-radius: 2px;
  }

  .step :global(svg) {
    width: 16px;
    height: 16px;
  }

  .speed .rate {
    font-size: 13px;
    text-align: right;
    white-space: nowrap;
    min-width: 8ch;
  }

  /* An ink rule with a highlighter knob: the choice. */
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
    background: var(--mark);
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
    background: var(--mark);
    border: 1.5px solid var(--ink);
    border-radius: 0;
  }

  .length .about {
    font-size: 15px;
    color: var(--ink-2);
  }

  .go {
    min-height: 48px;
    font-size: 16px;
  }

  .go :global(svg) {
    width: 18px;
    height: 18px;
  }

  /* ── The stage: dark in both themes, over the whole window ── */

  .stage {
    position: fixed;
    inset: 0;
    z-index: 100;
    color-scheme: dark;
    background: var(--bg);
    color: var(--ink);
    container-type: size;
    overflow: hidden;
    touch-action: none;
    overscroll-behavior: contain;
    outline: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    --m: max(16px, 5cqw);
    --fs: min(calc(18px + 3.8cqw), 9cqh);
  }

  .stage.idle {
    cursor: none;
  }

  .margin-wide {
    --m: max(28px, 17cqw);
  }

  .size-s {
    --fs: min(calc(16px + 2.8cqw), 6.5cqh);
  }

  .size-l {
    --fs: min(calc(20px + 5cqw), 11cqh);
  }

  .size-xl {
    --fs: min(calc(22px + 6.6cqw), 14cqh);
  }

  .view {
    position: absolute;
    inset: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
    overflow: hidden;
    cursor: grab;
  }

  .idle .view {
    cursor: none;
  }

  .roll {
    position: absolute;
    top: 0;
    left: calc(var(--m) + env(safe-area-inset-left));
    right: calc(var(--m) + env(safe-area-inset-right));
    font-family: var(--sans);
    font-size: var(--fs);
    font-weight: 600;
    line-height: 1.35em;
    letter-spacing: -0.005em;
    white-space: pre-line;
    overflow-wrap: break-word;
    will-change: transform;
  }

  /* What's been read fades out above the line. */
  .shade {
    position: absolute;
    inset: 0 0 auto;
    height: 24%;
    background: linear-gradient(var(--bg), transparent);
    pointer-events: none;
  }

  /* The reading line: a highlighter wedge in each margin. */
  .cue {
    position: absolute;
    top: calc(100% / 3);
    width: clamp(8px, calc(var(--m) - 6px), 16px);
    height: calc(var(--fs) * 0.55);
    translate: 0 -50%;
    background: var(--mark);
    pointer-events: none;
  }

  .cue.start {
    left: calc(env(safe-area-inset-left) + 2px);
    clip-path: polygon(0 0, 100% 50%, 0 100%);
  }

  .cue.end {
    right: calc(env(safe-area-inset-right) + 2px);
    clip-path: polygon(100% 0, 0 50%, 100% 100%);
  }

  .counter {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: var(--sans);
    font-size: 34cqmin;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    pointer-events: none;
  }

  .readout {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 14px);
    left: 50%;
    translate: -50% 0;
    padding: 6px 10px;
    font-size: 13px;
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 2px;
    white-space: nowrap;
    pointer-events: none;
  }

  .fin {
    position: absolute;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom) + 96px);
    translate: -50% 0;
    display: grid;
    justify-items: center;
    gap: 12px;
    padding: 16px 22px;
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 2px;
  }

  .fin p {
    font-size: 18px;
    font-weight: 700;
  }

  .fin :global(.btn) {
    min-height: 44px;
  }

  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px max(12px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    background: var(--card);
    border-top: 1px solid var(--rule);
    transition: opacity 0.35s ease;
  }

  .bar.hide {
    opacity: 0;
    pointer-events: none;
  }

  .key {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--rule);
    border-radius: 2px;
    color: var(--ink);
  }

  .key :global(svg) {
    width: 18px;
    height: 18px;
  }

  @media (hover: hover) and (pointer: fine) {
    .key:not(:disabled):hover {
      border-color: var(--ink);
    }
  }

  .bar .rate {
    min-width: 7ch;
    text-align: center;
    font-size: 12px;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .bar .left {
    margin-left: auto;
    font-size: 13px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
</style>

<!--
  F-403 Colours: one colour typed or pasted in any CSS form, shown big and written as HEX, RGB, HSL
  and OKLCH, each with Copy. Picked from a photo (a tap, a click or the arrow keys move a marker; the
  colour is the average of a small square under it) or, where the browser has it, from anywhere on
  the screen. Its WCAG 2 contrast against a second colour, with AA and AAA for text. Nothing is kept:
  not the colours, not the photo.
-->
<script lang="ts">
  import { untrack, tick } from 'svelte';
  import { Pipette, ArrowLeftRight, Check as Tick, X } from '@lucide/svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import Receipt from '../../components/kit/Receipt.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { decode, fit } from '../../lib/images.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { parseColour, toHex, toRgb, toHsl, toOklch, nameOf, contrast, grades, ratioText, bestAgainst, averageAt, pickRadius, type Colour } from './colours.ts';

  let { items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      colour: 'Colour',
      placeholder: '#ffe14a, rgb(…), oklch(…), gold',
      unreadable: 'That isn’t a colour this tool can read. Try #ffe14a, rgb(255 225 74) or a name like gold.',
      clamped: 'Outside what most screens show (sRGB): shown as the nearest colour inside.',
      named: 'Named {name} in CSS',
      codes: 'Codes',
      fromPhoto: 'From a photo',
      drop: 'Drop a photo, or choose one',
      dropHint: 'Then tap the colour you want. JPG, HEIC, PNG, WebP.',
      another: 'Another photo',
      notPhoto: '{name} isn’t a photo this browser can open.',
      opening: 'Opening {name}…',
      photo: 'Photo: tap or click a colour, or move the marker with the arrow keys',
      picked: 'Picked {hex}',
      tapHint: 'Tap the colour you want; arrow keys move the marker, Shift moves it further.',
      screen: 'Pick from the screen',
      contrast: 'Contrast',
      wcag: 'WCAG 2',
      against: 'Against',
      againstHint: 'Empty: white or black, whichever stands out more',
      auto: '{colour} stands out more',
      white: 'White',
      black: 'Black',
      swap: 'Swap',
      ratio: 'Ratio',
      passes: 'Passes {level}',
      passesLarge: 'Passes AA for large text',
      fails: 'Fails AA',
      level: 'Level',
      normal: 'Normal text',
      large: 'Large text',
      largeHint: 'Large: from 24 px, or 18.7 px bold',
      pass: 'Pass',
      fail: 'Fail',
      sample: 'Sample',
      sampleNormal: 'Normal text reads like this.',
      sampleLarge: 'Large text',
      onIt: '{a} on {b}',
      seeThrough: 'See-through colours are laid over the other first, the background over white.',
    },
    de: {
      colour: 'Farbe',
      placeholder: '#ffe14a, rgb(…), oklch(…), gold',
      unreadable: 'Das ist keine Farbe, die dieses Werkzeug lesen kann. Versuch #ffe14a, rgb(255 225 74) oder einen Namen wie gold.',
      clamped: 'Außerhalb dessen, was die meisten Bildschirme zeigen (sRGB): als nächste Farbe darin gezeigt.',
      named: 'In CSS heißt sie {name}',
      codes: 'Codes',
      fromPhoto: 'Aus einem Foto',
      drop: 'Foto ablegen oder auswählen',
      dropHint: 'Dann tipp auf die Farbe, die du willst. JPG, HEIC, PNG, WebP.',
      another: 'Anderes Foto',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      opening: '{name} wird geöffnet…',
      photo: 'Foto: tipp oder klick auf eine Farbe, oder bewege die Markierung mit den Pfeiltasten',
      picked: '{hex} gewählt',
      tapHint: 'Tipp auf die Farbe, die du willst; die Pfeiltasten bewegen die Markierung, mit Umschalt weiter.',
      screen: 'Vom Bildschirm wählen',
      contrast: 'Kontrast',
      wcag: 'WCAG 2',
      against: 'Gegen',
      againstHint: 'Leer: Weiß oder Schwarz, was sich stärker abhebt',
      auto: '{colour} hebt sich stärker ab',
      white: 'Weiß',
      black: 'Schwarz',
      swap: 'Tauschen',
      ratio: 'Verhältnis',
      passes: 'Besteht {level}',
      passesLarge: 'Besteht AA für großen Text',
      fails: 'Fällt bei AA durch',
      level: 'Stufe',
      normal: 'Normaler Text',
      large: 'Großer Text',
      largeHint: 'Groß: ab 24 px, oder 18,7 px fett',
      pass: 'Besteht',
      fail: 'Durchgefallen',
      sample: 'Beispiel',
      sampleNormal: 'Normaler Text liest sich so.',
      sampleLarge: 'Großer Text',
      onIt: '{a} auf {b}',
      seeThrough: 'Durchscheinende Farben liegen erst über der anderen, der Hintergrund über Weiß.',
    },
  });

  // Nothing is remembered: a colour or a photo is content.
  let text = $state('#ffe14a');
  let againstText = $state('');

  // A colour from the home (pasted there) comes in; a photo goes into the plate.
  const given = untrack(() => texts(items)).find((s) => parseColour(s));
  if (given) text = given.trim();

  const colour = $derived(parseColour(text));
  // The last colour that could be read stays on screen while the field holds something half-typed.
  let lastGood: Colour = parseColour('#ffe14a')!;
  const shown = $derived.by(() => {
    if (colour) lastGood = colour;
    return lastGood;
  });

  const typedAgainst = $derived(againstText.trim() ? parseColour(againstText) : null);
  const auto = $derived(bestAgainst(shown));
  const other = $derived(typedAgainst ?? auto);
  const ratio = $derived(contrast(shown, other));
  const g = $derived(grades(ratio));
  const best = $derived(g.aaaNormal ? w('passes', { level: 'AAA' }) : g.aaNormal ? w('passes', { level: 'AA' }) : g.aaLarge ? w('passesLarge') : null);

  const css = (c: Colour) => toHex(c);
  const name = $derived(nameOf(shown));

  function swap() {
    const a = toHex(shown);
    const b = toHex(other);
    text = b;
    againstText = a;
  }

  // ── The photo ────────────────────────────────────────────────────────────────────────

  interface Photo {
    name: string;
    width: number;
    height: number;
  }

  let photo = $state<Photo | null>(null);
  let opening = $state('');
  let problem = $state('');
  let canvas = $state<HTMLCanvasElement>();
  let pixels: ImageData | null = null;
  let marker = $state<{ x: number; y: number } | null>(null);
  let said = $state('');

  async function open(list: File[]) {
    const file = list[0];
    if (!file) return;
    problem = '';
    opening = w('opening', { name: file.name });
    try {
      const d = await decode(file);
      const size = fit(d.width, d.height, 1600, 1600);
      const width = Math.max(1, Math.round(size.width));
      const height = Math.max(1, Math.round(size.height));
      photo = { name: file.name, width, height };
      marker = null;
      said = '';
      await tick();
      if (!canvas) throw new Error('no canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(d.bitmap, 0, 0, width, height);
      d.bitmap.close();
      pixels = ctx.getImageData(0, 0, width, height);
    } catch {
      problem = w('notPhoto', { name: file.name });
      photo = null;
      pixels = null;
    }
    opening = '';
  }

  const givenFile = untrack(() => files(items))[0];
  if (givenFile) void open([givenFile]);

  function pickAt(x: number, y: number) {
    if (!photo || !pixels) return;
    const px = Math.min(photo.width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(photo.height - 1, Math.max(0, Math.round(y)));
    marker = { x: px, y: py };
    const c = averageAt(pixels.data, photo.width, photo.height, px, py, pickRadius(photo.width, photo.height));
    text = toHex({ ...c, alpha: 1 });
    said = w('picked', { hex: text });
  }

  function fromPointer(e: MouseEvent | PointerEvent) {
    if (!canvas || !photo) return;
    const box = canvas.getBoundingClientRect();
    pickAt(((e.clientX - box.left) / box.width) * photo.width, ((e.clientY - box.top) / box.height) * photo.height);
  }

  function key(e: KeyboardEvent) {
    if (!photo) return;
    const step = Math.max(1, Math.round(Math.max(photo.width, photo.height) / 100)) * (e.shiftKey ? 10 : 1);
    const at = marker ?? { x: photo.width / 2, y: photo.height / 2 };
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickAt(at.x, at.y);
      return;
    }
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    // The first press picks where the marker would start: the middle.
    pickAt(marker ? at.x + move[0] : at.x, marker ? at.y + move[1] : at.y);
  }

  // ── The screen's eyedropper (Chromium on a computer) ─────────────────────────────────

  interface EyeDropperLike {
    open(): Promise<{ sRGBHex: string }>;
  }
  const Dropper = (globalThis as unknown as { EyeDropper?: new () => EyeDropperLike }).EyeDropper;

  async function fromScreen() {
    if (!Dropper) return;
    try {
      const { sRGBHex } = await new Dropper().open();
      const c = parseColour(sRGBHex);
      if (c) {
        text = toHex(c);
        said = w('picked', { hex: text });
      }
    } catch {
      // Esc or a click outside: nothing picked.
    }
  }
</script>

<div class="layout">
  <div class="stack in">
    <div class="h"><label for="colour-in">{w('colour')}</label>{#if name}<em>{w('named', { name })}</em>{/if}</div>
    <input
      id="colour-in"
      class="field code"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder={w('placeholder')}
      value={text}
      oninput={(e) => (text = e.currentTarget.value)}
      onfocus={(e) => e.currentTarget.select()}
    />
    {#if text.trim() && !colour}
      <p class="note bad" role="alert">{w('unreadable')}</p>
    {:else if shown.clamped}
      <p class="note">{w('clamped')}</p>
    {/if}
  </div>

  <div class="stack out">
    <div class="swatch" aria-hidden="true"><span style:background={css(shown)}></span></div>
    <Receipt title={w('codes')}>
      {@render code('HEX', toHex(shown), true)}
      {@render code('RGB', toRgb(shown))}
      {@render code('HSL', toHsl(shown))}
      {@render code('OKLCH', toOklch(shown))}
    </Receipt>
  </div>

  <div class="stack photo">
    <h2 class="h">{w('fromPhoto')}</h2>
    {#if photo}
      <figure class="plate">
        <div class="frame">
          <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
          <div
            class="pick"
            role="application"
            tabindex="0"
            aria-label={w('photo')}
            style:max-width={`min(100%, calc(min(62vh, 640px) * ${photo.width / photo.height}))`}
            onkeydown={key}
          >
            <canvas
              bind:this={canvas}
              onclick={fromPointer}
              onpointermove={(e) => {
                if (e.pointerType === 'mouse' && e.buttons === 1) fromPointer(e);
              }}
            ></canvas>
            {#if marker}
              <span class="marker" style:left={`${(marker.x / photo.width) * 100}%`} style:top={`${(marker.y / photo.height) * 100}%`} style:background={toHex(shown)} aria-hidden="true"></span>
            {/if}
          </div>
        </div>
        <figcaption>
          <code>{photo.width} × {photo.height}</code>
          <span class="file">{photo.name}</span>
        </figcaption>
      </figure>
      <p class="note">{w('tapHint')}</p>
      <DropWell accept="image/*,.heic,.heif" compact title={w('another')} onfiles={open} />
    {:else}
      <DropWell accept="image/*,.heic,.heif" title={w('drop')} hint={w('dropHint')} onfiles={open} />
    {/if}
    {#if opening}<p class="note" aria-live="polite">{opening}</p>{/if}
    {#if problem}<p class="note bad" role="alert">{problem}</p>{/if}
    {#if Dropper}
      <button type="button" class="btn" onclick={fromScreen}><Pipette aria-hidden="true" />{w('screen')}</button>
    {/if}
    <p class="sr" aria-live="polite">{said}</p>
  </div>

  <section class="stack contrast" aria-label={w('contrast')}>
    <h2 class="h">{w('contrast')} <em>{w('wcag')}</em></h2>
    <div class="cols even under">
      <dl class="spec">
        <div>
          <dt><label for="colour-against">{w('against')}</label></dt>
          <dd>
            <div class="against">
              <span class="chip" style:background={css(other)} aria-hidden="true"></span>
              <input
                id="colour-against"
                class="field code"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder={toHex(auto)}
                value={againstText}
                oninput={(e) => (againstText = e.currentTarget.value)}
              />
              <button type="button" class="btn" onclick={swap} title={w('swap')}><ArrowLeftRight aria-hidden="true" /><span>{w('swap')}</span></button>
            </div>
            {#if againstText.trim() && !typedAgainst}
              <span class="note bad" role="alert">{w('unreadable')}</span>
            {:else if !againstText.trim()}
              <span class="note">{w('auto', { colour: auto.r ? w('white') : w('black') })}</span>
            {/if}
          </dd>
        </div>
        <div>
          <dt>{w('ratio')}</dt>
          <dd>
            <div class="big">
              <b class="ratio">{ratioText(ratio)}:1</b>
              {#if best}<em>{best}</em>{:else}<s>{w('fails')}</s>{/if}
            </div>
          </dd>
        </div>
        <div>
          <dt>{w('level')}</dt>
          <dd>
            <table class="grades">
              <thead>
                <tr><th></th><th scope="col">{w('normal')}</th><th scope="col">{w('large')}</th></tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">AA</th>
                  {@render grade(g.aaNormal, '4.5')}
                  {@render grade(g.aaLarge, '3')}
                </tr>
                <tr>
                  <th scope="row">AAA</th>
                  {@render grade(g.aaaNormal, '7')}
                  {@render grade(g.aaaLarge, '4.5')}
                </tr>
              </tbody>
            </table>
            <span class="note">{w('largeHint')}</span>
          </dd>
        </div>
      </dl>
      <div class="stack">
        <div class="sample" style:background={css(other)} style:color={css(shown)}>
          <small>{w('onIt', { a: toHex(shown), b: toHex(other) })}</small>
          <p class="n">{w('sampleNormal')}</p>
          <p class="l">{w('sampleLarge')}</p>
        </div>
        <div class="sample" style:background={css(shown)} style:color={css(other)}>
          <small>{w('onIt', { a: toHex(other), b: toHex(shown) })}</small>
          <p class="n">{w('sampleNormal')}</p>
          <p class="l">{w('sampleLarge')}</p>
        </div>
        {#if shown.alpha < 1 || other.alpha < 1}<p class="note">{w('seeThrough')}</p>{/if}
      </div>
    </div>
  </section>
</div>

{#snippet code(label: string, value: string, answer = false)}
  <div class="code-row" class:answer>
    <span class="lab">{label}</span>
    <code class="val">{value}</code>
    <CopyButton text={value} />
  </div>
{/snippet}

{#snippet grade(ok: boolean, level: string)}
  <td class:ok class:no={!ok}>
    {#if ok}<Tick aria-hidden="true" />{:else}<X aria-hidden="true" />{/if}
    <span>{ok ? w('pass') : w('fail')}</span>
    <small>{level}:1</small>
  </td>
{/snippet}

<style>
  /* The input, then the colour and its codes, then the photo on a phone; on a computer the photo
     sits under the input and the codes stay beside both. */
  .layout {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  @media (min-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      grid-template-rows: auto 1fr auto;
      grid-template-areas: 'in out' 'photo out' 'contrast contrast';
      gap: 26px 44px;
      align-items: start;
    }

    .in {
      grid-area: in;
    }

    .out {
      grid-area: out;
    }

    .photo {
      grid-area: photo;
    }

    .contrast {
      grid-area: contrast;
    }

    .photo > .btn {
      justify-self: start;
    }
  }

  /* Martian Mono runs wide: at 13px on a phone a code fits one line ("oklch(90.9% 0.165 97.6)"). */
  .code-row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: baseline;
    padding: 11px 0;
    border-bottom: 1px dashed var(--rule);
  }

  .code-row:last-child {
    border-bottom: 0;
  }

  .lab {
    font-size: 15px;
    font-weight: 700;
  }

  .val {
    font-family: var(--mono);
    font-size: 13px;
    overflow-wrap: anywhere;
    justify-self: start;
  }

  @media (min-width: 420px) {
    .code-row {
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 10px;
    }

    .val {
      font-size: 15px;
    }
  }

  .answer .lab {
    font-size: 17px;
    font-weight: 800;
  }

  .answer .val {
    font-size: 17px;
    background: var(--mark);
    color: var(--mark-ink);
    padding: 0 5px;
  }

  .code {
    font-family: var(--mono);
  }

  .swatch {
    border: 1.5px solid var(--ink);
    height: clamp(140px, 30vw, 220px);
    /* A checkerboard under the colour, for one that's see-through. */
    background: repeating-conic-gradient(var(--rule) 0 25%, var(--card) 0 50%) 0 0 / 16px 16px;
  }

  .swatch span {
    display: block;
    height: 100%;
  }

  .pick {
    position: relative;
    width: 100%;
    cursor: crosshair;
    outline-offset: 3px;
  }

  .frame .pick canvas {
    width: 100%;
    height: auto;
    max-height: none;
  }

  .marker {
    position: absolute;
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border: 3px solid #fff;
    outline: 1.5px solid #121212;
    border-radius: 50%;
    pointer-events: none;
  }

  .file {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .against {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .against .field {
    flex: 1;
    min-width: 0;
  }

  .chip {
    flex: none;
    width: 28px;
    height: 28px;
    border: 1.5px solid var(--ink);
  }

  .against .btn {
    flex: none;
    min-height: 40px;
  }

  .ratio {
    font-family: var(--mono);
    letter-spacing: -0.04em;
  }

  .big s {
    text-decoration: none;
    font-weight: 600;
    color: var(--bad);
  }

  .grades {
    border-collapse: collapse;
    font-size: 14px;
  }

  .grades th {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ink-2);
    text-align: left;
    padding: 4px 12px 4px 0;
  }

  .grades td {
    padding: 4px 14px 4px 0;
    white-space: nowrap;
    font-weight: 600;
  }

  .grades td :global(svg) {
    display: inline-block;
    width: 15px;
    height: 15px;
    vertical-align: -2px;
    margin-right: 3px;
    stroke-width: 2.6;
  }

  .grades td.ok {
    color: var(--ok);
  }

  .grades td.no {
    color: var(--bad);
  }

  .grades small {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 400;
    color: var(--ink-2);
    margin-left: 4px;
  }

  .sample {
    border: 1.5px solid var(--ink);
    padding: 12px 14px 14px;
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .sample small {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    opacity: 0.8;
  }

  .sample .n {
    font-size: 16px;
  }

  .sample .l {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
  }

  /* Right under the heading its rule is the line: the spec's own would double it (QR's .read). */
  .under > .spec:first-child {
    border-top: 0;
  }

  @media (min-width: 760px) {
    .under > .spec {
      border-top: 0;
    }
  }
</style>

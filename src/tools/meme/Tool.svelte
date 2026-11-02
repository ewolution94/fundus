<!--
  F-108 Meme maker: one photo with text on it. Classic: a top and a bottom text in Anton, upper
  case, white with a black outline, shrunk until it fits (meme.ts). Caption: a white bar above the
  photo with the text in the page's own face. The preview follows the typing; the saved picture is
  made at the photo's full size (4096 px at most) in the shared Photo format and quality, with the
  metadata as the location setting says. One photo at a time; the text is never kept.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { ui } from '../../lib/prefs.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { decode, draw, encode, canEncode, preview, isPhoto, extOf, fit as fitBox, targetType } from '../../lib/images.ts';
  import { formatBytes, kindOf, outName, type Kind } from '../../lib/files.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { classic, caption, capped, strokeOf, DEFAULT_METRICS, type Layout, type Measure, type Metrics, type Size, type Style } from './meme.ts';
  import { loadFaces, ANTON, CAPTION } from './fonts.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a photo here, or choose one',
      dropHint: 'JPG, HEIC, PNG, WebP. A screenshot works too.',
      another: 'Use another photo',
      oneAtATime: 'One photo at a time: {name} is open.',
      style: 'Style',
      classic: 'Classic',
      caption: 'Caption',
      text: 'Text',
      top: 'Top text',
      bottom: 'Bottom text',
      captionText: 'Caption',
      topPh: 'At the top',
      bottomPh: 'At the bottom',
      captionPh: 'Above the photo',
      classicNote: 'In capitals, as big as fits: up to three lines each.',
      captionNote: 'In a white bar above the photo, up to four lines.',
      size: 'Size',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      sizeNote: 'Medium is the size the photo gets by itself.',
      result: 'Result',
      saves: 'Saves',
      quality: 'quality {q}',
      without: 'without place, camera, time',
      with: 'with place, camera, time',
      change: 'Change',
      notPhoto: '{name} isn’t a photo this browser can open.',
      reading: 'Reading the photo…',
      working: 'Making the meme…',
      failed: 'Couldn’t make the meme.',
      preview: 'Preview of the meme',
    },
    de: {
      drop: 'Ein Foto hier ablegen oder auswählen',
      dropHint: 'JPG, HEIC, PNG, WebP. Ein Screenshot geht auch.',
      another: 'Anderes Foto nehmen',
      oneAtATime: 'Ein Foto nach dem anderen: {name} ist offen.',
      style: 'Stil',
      classic: 'Klassisch',
      caption: 'Zeile darüber',
      text: 'Text',
      top: 'Text oben',
      bottom: 'Text unten',
      captionText: 'Zeile',
      topPh: 'Oben',
      bottomPh: 'Unten',
      captionPh: 'Über dem Foto',
      classicNote: 'In Großbuchstaben, so groß es passt: bis zu drei Zeilen je Text.',
      captionNote: 'In einem weißen Balken über dem Foto, bis zu vier Zeilen.',
      size: 'Größe',
      small: 'Klein',
      medium: 'Mittel',
      large: 'Groß',
      sizeNote: 'Mittel ist die Größe, die das Foto von selbst bekommt.',
      result: 'Ergebnis',
      saves: 'Speichert',
      quality: 'Qualität {q}',
      without: 'ohne Ort, Kamera, Zeit',
      with: 'mit Ort, Kamera, Zeit',
      change: 'Ändern',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      reading: 'Das Foto wird gelesen…',
      working: 'Das Meme entsteht…',
      failed: 'Das Meme ließ sich nicht erstellen.',
      preview: 'Vorschau des Memes',
    },
  });

  // The style and the size are kept; the text is not.
  const o = remember('meme', { style: 'classic' as Style, size: 'medium' as Size });

  interface Photo {
    /** Which photo this is, for the result's key. */
    id: number;
    file: File;
    kind: Kind;
    thumb: string;
    /** Full size, for the result. */
    bitmap: ImageBitmap;
    /** Small enough to redraw at every key. */
    base: ImageBitmap;
    width: number;
    height: number;
  }

  let photo = $state.raw<Photo | null>(null);
  let opened = 0;
  let top = $state('');
  let bottom = $state('');
  let reading = $state(false);
  let errors = $state<string[]>([]);
  let facesReady = $state(false);
  let webpOk = $state(true);
  let view = $state<HTMLCanvasElement>();
  void canEncode('image/webp').then((ok) => (webpOk = ok));
  // Drawn with the page's fonts as they are until Anton is in; then drawn again.
  void loadFaces()
    .catch(() => undefined)
    .then(() => (facesReady = true));

  const mark = $derived(shared.decimal);

  async function open(list: File[]) {
    errors = [];
    const file = list[0];
    if (!file) return;
    if (list.length > 1) errors = [w('oneAtATime', { name: file.name })];
    reading = true;
    try {
      if (!(await isPhoto(file))) throw new Error();
      const kind = await kindOf(file);
      const d = await decode(file);
      const small = fitBox(d.width, d.height, 1400, 1400);
      const base = await createImageBitmap(draw(d.bitmap, small.width, small.height, 'image/png'));
      const t = fitBox(d.width, d.height, 240, 240);
      const thumb = preview((await encode(draw(d.bitmap, t.width, t.height, 'image/jpeg'), 'image/jpeg', 70, null, true)).blob).url;
      close();
      photo = { id: ++opened, file, kind, thumb, bitmap: d.bitmap, base, width: d.width, height: d.height };
    } catch {
      errors = [...errors, w('notPhoto', { name: file.name })];
    } finally {
      reading = false;
    }
  }

  function close() {
    const p = untrack(() => photo);
    if (!p) return;
    p.bitmap.close();
    p.base.close();
    URL.revokeObjectURL(p.thumb);
    photo = null;
  }

  $effect(() => () => close());

  const given = untrack(() => filesOf(items));
  if (given.length) void open(given);

  // ── Drawing ──
  const scratch = document.createElement('canvas').getContext('2d')!;
  const antonAt = (px: number) => `${px}px ${ANTON}`;
  const captionAt = (px: number) => `600 ${px}px ${CAPTION}`;

  /** A face's widths, measured once at 100 px and scaled (a canvas's text grows in proportion). */
  function measurer(font: (px: number) => string): Measure {
    scratch.font = font(100);
    const cache = new Map<string, number>();
    return (text, px) => {
      let width = cache.get(text);
      if (width === undefined) {
        width = scratch.measureText(text).width;
        cache.set(text, width);
      }
      return (width * px) / 100;
    };
  }

  function metrics(): Metrics {
    scratch.font = `100px ${ANTON}`;
    const cap = scratch.measureText('H').actualBoundingBoxAscent / 100;
    scratch.font = `600 100px ${CAPTION}`;
    const m = scratch.measureText('Hg');
    const ascent = m.fontBoundingBoxAscent / 100;
    const descent = m.fontBoundingBoxDescent / 100;
    return {
      cap: cap > 0.3 && cap < 1.2 ? cap : DEFAULT_METRICS.cap,
      ascent: ascent > 0.3 && ascent < 1.5 ? ascent : DEFAULT_METRICS.ascent,
      descent: descent > 0 && descent < 0.8 ? descent : DEFAULT_METRICS.descent,
    };
  }

  function layoutOf(p: Photo, style: Style, size: Size, a: string, b: string): Layout {
    const m = metrics();
    return style === 'classic' ? classic(p.width, p.height, a, b, size, measurer(antonAt), m) : caption(p.width, p.height, a, size, measurer(captionAt), m);
  }

  /** The picture at `k` times the layout's size: the photo, then the text. */
  function paint(ctx: CanvasRenderingContext2D, l: Layout, picture: CanvasImageSource, k: number, jpeg: boolean) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    // A JPG has no transparency: white under all of it. A caption's bar is white either way.
    ctx.fillStyle = '#ffffff';
    if (jpeg) ctx.fillRect(0, 0, l.width, l.height);
    else if (l.photoY) ctx.fillRect(0, 0, l.width, l.photoY);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(picture, 0, l.photoY, l.width, l.height - l.photoY);
    if (l.style === 'classic') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#ffffff';
      for (const block of [l.top, l.bottom]) {
        if (!block) continue;
        ctx.font = antonAt(block.px);
        ctx.lineWidth = strokeOf(block.px);
        // The outline under the fill, every line's before any fill, so lines set tight don't cut each other.
        block.lines.forEach((line, i) => ctx.strokeText(line, l.x, block.baselines[i]));
        block.lines.forEach((line, i) => ctx.fillText(line, l.x, block.baselines[i]));
      }
    } else if (l.top) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#121212';
      ctx.font = captionAt(l.top.px);
      l.top.lines.forEach((line, i) => ctx.fillText(line, l.x, l.top!.baselines[i]));
    }
  }

  // The preview: drawn a moment after each key, from the small copy of the photo.
  $effect(() => {
    const p = photo;
    const canvas = view;
    const style = o.style;
    const size = o.size;
    const a = top;
    const b = bottom;
    void facesReady;
    if (!p || !canvas) return;
    const timer = setTimeout(() => {
      const l = layoutOf(p, style, size, a, b);
      const k = Math.min(1, 1400 / Math.max(l.width, l.height));
      canvas.width = Math.max(1, Math.round(l.width * k));
      canvas.height = Math.max(1, Math.round(l.height * k));
      paint(canvas.getContext('2d')!, l, p.base, k, false);
    }, 40);
    return () => clearTimeout(timer);
  });

  // ── The result ──
  const type = $derived.by(() => {
    if (!photo) return 'image/jpeg';
    const t = targetType(photo.kind, shared.photoFormat);
    return t === 'image/webp' && !webpOk ? 'image/jpeg' : t;
  });

  // The text counts once typing pauses, so a 4K photo isn't encoded at every key.
  let settledTop = $state('');
  let settledBottom = $state('');
  $effect(() => {
    const a = top;
    const b = bottom;
    const timer = setTimeout(() => {
      settledTop = a;
      settledBottom = b;
    }, 350);
    return () => clearTimeout(timer);
  });

  const keyOf = (a: string, b: string) => JSON.stringify([photo?.id, o.style, o.size, a, o.style === 'classic' ? b : '', type, shared.quality, shared.stripLocation, shared.names, facesReady]);
  const liveKey = $derived(keyOf(top, bottom));

  let made = $state.raw<{ key: string; output: Output; width: number; height: number } | null>(null);
  let busy = $state(false);
  let failed = $state(false);

  $effect(() => {
    const p = photo;
    const ready = facesReady;
    const style = o.style;
    const size = o.size;
    const a = settledTop;
    const b = settledBottom;
    const t = type;
    const quality = shared.quality;
    const stripIt = shared.stripLocation;
    const names = shared.names;
    const k = keyOf(a, b);
    failed = false;
    if (!p || !ready) {
      busy = !!p;
      return;
    }
    let cancelled = false;
    busy = true;
    const timer = setTimeout(async () => {
      const canvas = document.createElement('canvas');
      try {
        const l = layoutOf(p, style, size, a, b);
        const out = capped(l.width, l.height);
        canvas.width = out.width;
        canvas.height = out.height;
        paint(canvas.getContext('2d')!, l, p.bitmap, out.scale, t === 'image/jpeg');
        const enc = await encode(canvas, t, quality, p.file, stripIt);
        if (cancelled) return;
        made = { key: k, output: { blob: enc.blob, name: outName(p.file.name, 'meme', extOf(enc.type), names) }, width: out.width, height: out.height };
      } catch {
        if (!cancelled) failed = true;
      } finally {
        // Let the memory go now: phones keep few big canvases.
        canvas.width = 0;
        canvas.height = 0;
        if (!cancelled) busy = false;
      }
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const current = $derived(made && made.key === liveKey ? made : null);
  const outputs = $derived(current ? [current.output] : null);
  const nextItems = $derived(current ? [{ file: new File([current.output.blob], current.output.name, { type: current.output.blob.type }) }] : null);

  /** Enter goes on: from the top text to the bottom one, from the last field away (the phone's keyboard closes). */
  function enter(e: KeyboardEvent, then: () => void) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    then();
  }

  const typeName = (t: string) => (t === 'image/png' ? 'PNG' : t === 'image/webp' ? 'WebP' : 'JPG');
  const savesLine = $derived.by(() => {
    const parts = [typeName(type)];
    if (type !== 'image/png') parts.push(w('quality', { q: shared.quality }));
    parts.push(shared.stripLocation ? w('without') : w('with'));
    return parts.join(' · ');
  });
</script>

<div class="body">
  <Seg
    large
    label={w('style')}
    value={o.style}
    options={[
      { value: 'classic', label: w('classic') },
      { value: 'caption', label: w('caption') },
    ] as { value: Style; label: string }[]}
    onchange={(v) => (o.style = v)}
  />

  <div class="cols">
    <div class="stack">
      {#if photo}
        <figure class="plate">
          <div class="frame" role="img" aria-label={w('preview')}><canvas bind:this={view}></canvas></div>
          <figcaption>
            <code>{current ? `${current.width} × ${current.height}` : `${photo.width} × ${photo.height}`}</code>
            <span>{photo.file.name}</span>
          </figcaption>
        </figure>
      {:else}
        <DropWell accept="image/*,.heic,.heif" title={w('drop')} hint={w('dropHint')} onfiles={open} />
      {/if}

      <dl class="spec">
        {#if o.style === 'classic'}
          <div>
            <dt><label for="meme-top">{w('top')}</label></dt>
            <dd>
              <input
                id="meme-top"
                class="field"
                type="text"
                autocomplete="off"
                spellcheck="false"
                enterkeyhint="next"
                placeholder={w('topPh')}
                bind:value={top}
                onkeydown={(e) => enter(e, () => document.getElementById('meme-bottom')?.focus())}
              />
            </dd>
          </div>
          <div>
            <dt><label for="meme-bottom">{w('bottom')}</label></dt>
            <dd>
              <input id="meme-bottom" class="field" type="text" autocomplete="off" spellcheck="false" enterkeyhint="done" placeholder={w('bottomPh')} bind:value={bottom} onkeydown={(e) => enter(e, () => e.currentTarget.blur())} />
              <span class="note">{w('classicNote')}</span>
            </dd>
          </div>
        {:else}
          <div>
            <dt><label for="meme-caption">{w('captionText')}</label></dt>
            <dd>
              <input id="meme-caption" class="field" type="text" autocomplete="off" enterkeyhint="done" placeholder={w('captionPh')} bind:value={top} onkeydown={(e) => enter(e, () => e.currentTarget.blur())} />
              <span class="note">{w('captionNote')}</span>
            </dd>
          </div>
        {/if}
      </dl>

      {#if photo}
        <FileRow name={photo.file.name} thumb={photo.thumb} meta={`${photo.width} × ${photo.height} · ${formatBytes(photo.file.size, mark)}`} onremove={close} />
        <DropWell accept="image/*,.heic,.heif" compact title={w('another')} onfiles={open} />
      {/if}
      {#if reading}<p class="note" aria-live="polite">{w('reading')}</p>{/if}
      {#each errors as err (err)}<p class="note bad" role="alert">{err}</p>{/each}
    </div>

    <div class="stack">
      <dl class="spec">
        <div>
          <dt>{w('size')}</dt>
          <dd>
            <Seg
              label={w('size')}
              value={o.size}
              options={[
                { value: 'small', label: w('small') },
                { value: 'medium', label: w('medium') },
                { value: 'large', label: w('large') },
              ] as { value: Size; label: string }[]}
              onchange={(v) => (o.size = v)}
            />
            <span class="note">{w('sizeNote')}</span>
          </dd>
        </div>
        {#if photo}
          <div>
            <dt>{w('result')}</dt>
            <dd aria-live="polite">
              {#if current}
                <div class="big"><b>{current.width} × {current.height}</b><span class="px">px</span></div>
                <span class="note m">{typeName(current.output.blob.type)} · {formatBytes(current.output.blob.size, mark)}</span>
              {:else if failed}
                <span class="note bad" role="alert">{w('failed')}</span>
              {:else}
                <span class="note">{w('working')}</span>
              {/if}
            </dd>
          </div>
        {/if}
        <div>
          <dt>{w('saves')}</dt>
          <dd>
            <span class="note">{savesLine} <button type="button" class="link change" onclick={() => (ui.settings = true)}>{w('change')}</button></span>
            <SharedNote chip="photo" />
          </dd>
        </div>
      </dl>

      {#if photo}
        <SaveButton {outputs} busy={busy || reading} tool={tool.id} />
        <NextTools items={nextItems} from={tool.id} prefer={['shrink', 'resize', 'frame']} />
      {/if}
    </div>
  </div>
</div>

<style>
  .body {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .px {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink-2);
  }

  .change {
    margin-left: 6px;
    font-size: 13px;
  }

  dt label {
    cursor: pointer;
  }
</style>

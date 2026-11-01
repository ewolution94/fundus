<!--
  F-107 Make icons: one picture (best an SVG or a square PNG; any photo works, HEIC too) to a
  website's and an app's icons, saved as one ZIP: favicon.ico (16, 32, 48), favicon.svg when it was
  one, the Apple icon on a solid ground, 192 and 512 px, a maskable 512 inside the safe zone, and a
  manifest to start from (icons.ts). An SVG is drawn at each size, so even 16 px is sharp; a photo
  is halved step by step first, so small icons stay crisp. The preview shows what they'll get: a
  browser's tabs, a phone's home screen, and each icon at its real size; the tags to copy follow.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { zipSync } from 'fflate';
  import { X, Globe } from '@lucide/svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { perFile } from '../../lib/jobs.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { decode, encode, isPhoto, makeCanvas, preview, fit } from '../../lib/images.ts';
  import { formatBytes, kindOf, isSvg, outName, stem, type Kind } from '../../lib/files.ts';
  import { svgSize, isSvgText, holdsHtml, needsFonts, scaleTo, drawSvg, paintSvg, SvgError } from '../../lib/svg.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { place, ico, contents, linkTags, manifestIcons, manifest, groundFrom, FAVICON_SIZES, ICONS, MANIFEST, type Shape } from './icons.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a picture here, or choose one',
      dropHint: 'Best an SVG or a square PNG; any photo works.',
      another: 'Use another picture',
      reading: 'Reading the picture…',
      working: 'Making the icons…',
      notPicture: '{name} isn’t a picture this browser can open.',
      html: '{name}: this SVG holds HTML inside, which browsers won’t turn into pixels.',
      fonts: 'Its text uses this device’s fonts: fonts it links to aren’t loaded.',
      failed: 'Couldn’t make the icons.',
      ground: 'Ground',
      fromPicture: 'From the picture',
      white: 'White',
      black: 'Black',
      own: 'Own',
      ownLabel: 'Own colour',
      groundNote: 'Under the Apple and the maskable icon; the others keep transparency.',
      seeThrough: 'Its corner is see-through, so white.',
      shape: 'Shape',
      fit: 'Fit',
      fill: 'Fill',
      notSquare: '{size}: not square. Fit shows all of it, Fill crops the middle.',
      files: 'Files',
      result: 'Result',
      inZip: '{n} files in one ZIP',
      preview: 'Preview',
      previewNote: 'as they’ll look',
      tabs: 'A browser’s tabs, light and dark, with the favicon',
      newTab: 'New tab',
      phone: 'A phone’s home screen: the Apple icon under iOS’s rounded mask, the maskable icon in a circle',
      realSize: 'Each at its real size',
      forPage: 'For your page',
      forPageNote: 'in its head',
      copyTags: 'Copy the tags',
      manifestH: 'Manifest',
      manifestNote: 'its icons',
      copyIcons: 'Copy the icons',
    },
    de: {
      drop: 'Bild hier ablegen oder auswählen',
      dropHint: 'Am besten ein SVG oder ein quadratisches PNG; jedes Foto geht.',
      another: 'Anderes Bild nehmen',
      reading: 'Das Bild wird gelesen…',
      working: 'Die Icons entstehen…',
      notPicture: '{name} ist kein Bild, das dieser Browser öffnen kann.',
      html: '{name}: Dieses SVG enthält HTML, das Browser nicht in Pixel umwandeln.',
      fonts: 'Sein Text nutzt die Schriften dieses Geräts: verlinkte Schriften werden nicht geladen.',
      failed: 'Die Icons ließen sich nicht erstellen.',
      ground: 'Grund',
      fromPicture: 'Aus dem Bild',
      white: 'Weiß',
      black: 'Schwarz',
      own: 'Eigene',
      ownLabel: 'Eigene Farbe',
      groundNote: 'Unter dem Apple- und dem Maskable-Icon; die anderen bleiben transparent.',
      seeThrough: 'Seine Ecke ist durchsichtig, also Weiß.',
      shape: 'Form',
      fit: 'Einpassen',
      fill: 'Füllen',
      notSquare: '{size}: nicht quadratisch. Einpassen zeigt alles, Füllen schneidet die Mitte aus.',
      files: 'Dateien',
      result: 'Ergebnis',
      inZip: '{n} Dateien in einem ZIP',
      preview: 'Vorschau',
      previewNote: 'so sehen sie aus',
      tabs: 'Browser-Tabs, hell und dunkel, mit dem Favicon',
      newTab: 'Neuer Tab',
      phone: 'Ein Startbildschirm: das Apple-Icon unter der runden Maske von iOS, das Maskable-Icon im Kreis',
      realSize: 'Jedes in echter Größe',
      forPage: 'Für deine Seite',
      forPageNote: 'in ihren Head',
      copyTags: 'Tags kopieren',
      manifestH: 'Manifest',
      manifestNote: 'seine Icons',
      copyIcons: 'Icons kopieren',
    },
  });

  type Ground = 'picture' | 'white' | 'black' | 'own';
  type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  type Pixels = ImageBitmap | ReturnType<typeof makeCanvas>;

  const o = remember('icons', { ground: 'picture' as Ground, own: '#ffe14a', shape: 'fit' as Shape });

  /** The picture, read once. */
  interface Picture {
    file: File;
    /** An SVG's text; null for a photo. */
    svg: string | null;
    /** A photo's pixels, then halved again and again: a small icon is drawn from the nearest. */
    levels: Pixels[];
    /** Its size (an SVG's unrounded). */
    width: number;
    height: number;
    kind: string;
    /** Its top-left pixel as #rrggbb, when that's opaque. */
    corner: string | null;
    fonts: boolean;
    thumb: string;
  }

  interface Made {
    zip: Output;
    /** What's in the ZIP and how big. */
    files: { name: string; bytes: number }[];
    /** The PNGs for the preview, by name; the favicon's sizes as favicon-16 … */
    shows: Record<string, Blob>;
  }

  let picture = $state<Picture | null>(null);
  let reading = $state(false);
  let problem = $state<string | null>(null);

  const mark = $derived(shared.decimal);
  const square = $derived(!picture || Math.abs(picture.width - picture.height) < 0.5);
  const ground = $derived.by(() => {
    if (o.ground === 'white') return '#ffffff';
    if (o.ground === 'black') return '#000000';
    if (o.ground === 'own') return /^#[0-9a-f]{6}$/i.test(o.own) ? o.own.toLowerCase() : '#ffffff';
    return picture?.corner ?? '#ffffff';
  });

  const kindLabel = (k: Kind) => (k === 'jpeg' ? 'JPG' : k === 'webp' ? 'WebP' : k.toUpperCase());

  /** An SVG's text, or null for anything else (a file can come without a type or an ending). */
  async function svgText(file: File): Promise<string | null> {
    if (!isSvg(file) && ((await kindOf(file)) !== 'other' || file.size > 20e6)) return null;
    const text = await file.text();
    return isSvgText(text) ? text : null;
  }

  /** The top-left pixel of something drawn, as it is. */
  function cornerOf(source: Pixels): string | null {
    const ctx = makeCanvas(1, 1).getContext('2d') as Ctx;
    ctx.drawImage(source, 0, 0, 1, 1, 0, 0, 1, 1);
    return groundFrom(ctx.getImageData(0, 0, 1, 1).data);
  }

  function halvings(bitmap: ImageBitmap): Pixels[] {
    const levels: Pixels[] = [bitmap];
    let { width, height } = bitmap;
    while (width > 128 && height > 128) {
      width = Math.round(width / 2);
      height = Math.round(height / 2);
      const canvas = makeCanvas(width, height);
      const ctx = canvas.getContext('2d') as Ctx;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(levels[levels.length - 1], 0, 0, width, height);
      levels.push(canvas);
    }
    return levels;
  }

  /** The smallest level still at least `width` wide, so the last step shrinks by half at most. */
  const nearest = (levels: Pixels[], width: number) => levels.findLast((l) => l.width >= width) ?? levels[0];

  async function load(file: File): Promise<Picture> {
    const text = await svgText(file);
    if (text !== null) {
      if (holdsHtml(text)) throw new SvgError('html');
      const size = svgSize(text);
      const at = scaleTo(size, { width: Math.min(size.width, 512) });
      const corner = cornerOf(await drawSvg(text, at.width, at.height));
      const k = Math.min(240 / size.width, 240 / size.height);
      const small = await drawSvg(text, size.width * k, size.height * k);
      const thumb = preview((await encode(small, 'image/png', 100, null, true)).blob).url;
      return { file, svg: text, levels: [], width: size.width, height: size.height, kind: 'SVG', corner, fonts: needsFonts(text), thumb };
    }
    if (!(await isPhoto(file))) throw new Error('Not a picture');
    const kind = await kindOf(file);
    const d = await decode(file);
    const levels = halvings(d.bitmap);
    const t = fit(d.width, d.height, 240, 240);
    const small = makeCanvas(t.width, t.height);
    const ctx = small.getContext('2d') as Ctx;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(nearest(levels, t.width), 0, 0, t.width, t.height);
    const thumb = preview((await encode(small, 'image/png', 100, null, true)).blob).url;
    return { file, svg: null, levels, width: d.width, height: d.height, kind: kindLabel(kind), corner: cornerOf(d.bitmap), fonts: false, thumb };
  }

  function release(p: Picture) {
    URL.revokeObjectURL(p.thumb);
    jobs.forget(p.file);
    for (const l of p.levels) if (l instanceof ImageBitmap) l.close();
  }

  async function open(list: File[]) {
    const file = list[0];
    if (!file) return;
    problem = null;
    reading = true;
    try {
      const next = await load(file);
      // A picture that can't be read leaves the one before in place.
      const before = untrack(() => picture);
      if (before) release(before);
      picture = next;
    } catch (error) {
      problem = error instanceof SvgError && error.reason === 'html' ? w('html', { name: file.name }) : w('notPicture', { name: file.name });
    } finally {
      reading = false;
    }
  }

  function remove() {
    if (picture) release(picture);
    picture = null;
    problem = null;
  }

  /** One icon: the ground (or none), the picture placed for its shape, cut to its box. */
  async function render(p: Picture, size: number, shape: Shape, fill: string | null, safe: boolean) {
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext('2d') as Ctx;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, size, size);
    }
    const { box, draw } = place(p.width, p.height, size, shape, safe);
    // Whole pixels, so an SVG drawn at its own size isn't resampled.
    const r = { x: Math.round(draw.x), y: Math.round(draw.y), w: Math.max(1, Math.round(draw.w)), h: Math.max(1, Math.round(draw.h)) };
    ctx.save();
    if (shape === 'fill') {
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
    }
    if (p.svg) await paintSvg(ctx, p.svg, r.x, r.y, r.w, r.h);
    else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(nearest(p.levels, r.w), r.x, r.y, r.w, r.h);
    }
    ctx.restore();
    return canvas;
  }

  // Everything the ZIP depends on.
  const key = () => `${ground}|${square ? 'square' : o.shape}|${shared.names}`;

  const jobs = perFile<Made>(
    () => (picture ? [picture.file] : []),
    key,
    async (file, stale) => {
      const p = untrack(() => picture);
      if (!p || p.file !== file) throw new Error('Gone');
      const fill = ground;
      const shape: Shape = square ? 'fit' : o.shape;
      const names = shared.names;
      const shows: Record<string, Blob> = {};
      const png = async (size: number, onGround: boolean, safe: boolean, name: string) => {
        if (stale()) throw new Error('Stale');
        const { blob } = await encode(await render(p, size, shape, onGround ? fill : null, safe), 'image/png', 100, null, true);
        shows[name] = blob;
        return new Uint8Array(await blob.arrayBuffer());
      };
      const favicons = [];
      for (const size of FAVICON_SIZES) favicons.push({ size, png: await png(size, false, false, `favicon-${size}`) });
      const files: [string, Uint8Array][] = [['favicon.ico', ico(favicons)]];
      // The SVG goes as it came.
      if (p.svg) files.push(['favicon.svg', new Uint8Array(await file.arrayBuffer())]);
      for (const icon of ICONS) files.push([icon.name, await png(icon.size, icon.ground, icon.safe, icon.name)]);
      files.push([MANIFEST, new TextEncoder().encode(manifest(stem(file.name)))]);
      // PNGs are compressed already; the text files aren't.
      const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
      for (const [name, bytes] of files) entries[name] = [bytes, { level: /\.(png|ico)$/.test(name) ? 0 : 6 }];
      const zipped = zipSync(entries);
      return {
        zip: { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), name: outName(file.name, 'icons', 'zip', names) },
        files: files.map(([name, bytes]) => ({ name, bytes: bytes.length })),
        shows,
      };
    },
  );

  // The inbox (a picture dropped on the home, or a result from another tool) goes straight in, once.
  const given = untrack(() => filesOf(items));
  if (given.length) void open(given);

  const done = $derived(picture ? jobs.get(picture.file) : undefined);
  const made = $derived(done?.value);
  const outputs = $derived(made ? [made.zip] : null);
  const title = $derived(picture ? stem(picture.file.name) : '');
  const tags = $derived(linkTags(!!picture?.svg));
  const iconsText = manifestIcons();

  // Object URLs for the preview, made as it shows them; the ones a newer result replaced go.
  const urls = new Map<Blob, string>();
  function url(blob: Blob | undefined): string {
    if (!blob) return '';
    let u = urls.get(blob);
    if (!u) {
      u = URL.createObjectURL(blob);
      urls.set(blob, u);
    }
    return u;
  }
  $effect(() => {
    if (!made) return;
    const keep = new Set(Object.values(made.shows));
    for (const [blob, u] of urls) {
      if (keep.has(blob)) continue;
      URL.revokeObjectURL(u);
      urls.delete(blob);
    }
  });
  $effect(() => () => {
    for (const u of urls.values()) URL.revokeObjectURL(u);
    const p = untrack(() => picture);
    if (p) release(p);
  });

  const bytesOf = (name: string) => {
    const f = made?.files.find((m) => m.name === name);
    return f ? formatBytes(f.bytes, mark) : '';
  };
  const size = (p: Picture) => `${Math.round(p.width)} × ${Math.round(p.height)}`;
</script>

<div class="cols">
  <div class="stack">
    {#if picture}
      <FileRow name={picture.file.name} thumb={picture.thumb} meta={`${size(picture)} · ${picture.kind} · ${formatBytes(picture.file.size, mark)}`} onremove={remove} />
      <DropWell accept="image/*,.heic,.heif,.svg" compact title={w('another')} onfiles={open} />
    {:else}
      <DropWell accept="image/*,.heic,.heif,.svg" title={w('drop')} hint={w('dropHint')} onfiles={open} />
    {/if}
    {#if reading}<p class="note" aria-live="polite">{w('reading')}</p>{/if}
    {#if problem}<p class="note bad" role="alert">{problem}</p>{/if}
    {#if picture?.fonts}<p class="note">{w('fonts')}</p>{/if}

    {#if picture}
      <h2 class="h">{w('preview')}<em>{w('previewNote')}</em></h2>
      {#if made}
        {@const f16 = url(made.shows['favicon-16'])}
        {@const f32 = url(made.shows['favicon-32'])}
        <!-- The favicon on a light and a dark browser: does it read on both? -->
        <div class="tabs" role="img" aria-label={w('tabs')}>
          {#each [false, true] as dark (dark)}
            <div class="strip" class:dark>
              <div class="tab on">
                <img src={f16} srcset={`${f16} 1x, ${f32} 2x`} width="16" height="16" alt="" />
                <span>{title}</span>
                <X aria-hidden="true" />
              </div>
              <div class="tab">
                <Globe aria-hidden="true" />
                <span>{w('newTab')}</span>
              </div>
            </div>
          {/each}
        </div>
        <!-- A home screen at a phone's own icon size (60 points). -->
        <div class="screen" role="img" aria-label={w('phone')}>
          <figure>
            <span class="m">iOS</span>
            <img class="ios" src={url(made.shows['apple-touch-icon.png'])} width="60" height="60" alt="" />
            <figcaption>{title}</figcaption>
          </figure>
          <figure>
            <span class="m">Android</span>
            <img class="round" src={url(made.shows['icon-maskable-512.png'])} width="60" height="60" alt="" />
            <figcaption>{title}</figcaption>
          </figure>
        </div>
      {:else if done?.error}
        <p class="note bad" role="alert">{w('failed')}</p>
      {:else}
        <p class="note" aria-live="polite">{w('working')}</p>
      {/if}
    {/if}
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('ground')}</dt>
        <dd>
          <Seg
            label={w('ground')}
            value={o.ground}
            options={[
              { value: 'picture', label: w('fromPicture') },
              { value: 'white', label: w('white') },
              { value: 'black', label: w('black') },
              { value: 'own', label: w('own') },
            ] as { value: Ground; label: string }[]}
            onchange={(v) => (o.ground = v)}
          />
          <div class="colour">
            {#if o.ground === 'own'}
              <input type="color" class="pick" value={ground} aria-label={w('ownLabel')} oninput={(e) => (o.own = e.currentTarget.value)} />
            {:else}
              <span class="swatch" style:background={ground}></span>
            {/if}
            <code class="m">{ground.toUpperCase()}</code>
          </div>
          {#if o.ground === 'picture' && picture && !picture.corner}<span class="note">{w('seeThrough')}</span>{/if}
          <span class="note">{w('groundNote')}</span>
        </dd>
      </div>
      {#if picture && !square}
        <div>
          <dt>{w('shape')}</dt>
          <dd>
            <Seg
              label={w('shape')}
              value={o.shape}
              options={[
                { value: 'fit', label: w('fit') },
                { value: 'fill', label: w('fill') },
              ] as { value: Shape; label: string }[]}
              onchange={(v) => (o.shape = v)}
            />
            <span class="note">{w('notSquare', { size: size(picture) })}</span>
          </dd>
        </div>
      {/if}
      <div class="files">
        <dt>{w('files')}</dt>
        <dd>
          <table class="made">
            <tbody>
              {#each contents(!!picture?.svg) as f (f.name)}
                <tr><th scope="row">{f.name}</th><td>{f.sizes.join(' · ')}</td><td>{bytesOf(f.name)}</td></tr>
              {/each}
            </tbody>
          </table>
        </dd>
      </div>
      {#if picture}
        <div>
          <dt>{w('result')}</dt>
          <dd>
            {#if made}
              <div class="big"><b>{formatBytes(made.zip.blob.size, mark)}</b></div>
              <span class="note">{w('inZip', { n: made.files.length })}</span>
            {:else if done?.error}
              <span class="note bad">{w('failed')}</span>
            {:else}
              <span class="note" aria-live="polite">{w('working')}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if picture}
      <SaveButton {outputs} busy={jobs.busy || reading} tool={tool.id} />
    {/if}
  </div>

  {#if picture}
    <!-- What to write in the page, side by side on a computer. -->
    <div class="cols even wide">
      <section class="stack">
        <h2 class="h">{w('forPage')}<em>{w('forPageNote')}</em></h2>
        <pre class="mono-out code">{tags}</pre>
        <div class="copy"><CopyButton variant="button" text={tags} label={w('copyTags')} /></div>
      </section>
      <section class="stack">
        <h2 class="h">{w('manifestH')}<em>{w('manifestNote')}</em></h2>
        <pre class="mono-out code">{iconsText}</pre>
        <div class="copy"><CopyButton variant="button" text={iconsText} label={w('copyIcons')} /></div>
      </section>
    </div>
  {/if}

  {#if made}
    <section class="stack wide" aria-label={w('realSize')}>
      <h2 class="h">{w('realSize')}</h2>
      <div class="sizes">
        <figure>
          <div class="icos">
            {#each FAVICON_SIZES as s (s)}<img src={url(made.shows[`favicon-${s}`])} width={s} height={s} alt={`favicon.ico, ${s} px`} />{/each}
          </div>
          <figcaption class="m">favicon.ico · {FAVICON_SIZES.join(' · ')}</figcaption>
        </figure>
        {#each ICONS as icon (icon.name)}
          <figure>
            <img src={url(made.shows[icon.name])} width={icon.size} height={icon.size} alt={`${icon.name}, ${icon.size} px`} />
            <figcaption class="m">{icon.name} · {icon.size}</figcaption>
          </figure>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  /* A browser's tab strip: one in the page's own tone, one in its opposite. */
  .tabs {
    display: grid;
    gap: 8px;
  }

  .strip {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    padding: 6px 8px 0;
    background: var(--sunk);
    border: 1px solid var(--rule);
    min-width: 0;
  }

  .tab {
    flex: 0 1 210px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 10px;
    font-size: 12px;
    color: var(--ink-2);
    border-radius: 2px 2px 0 0;
  }

  .tab.on {
    background: var(--card);
    color: var(--ink);
  }

  .tab img {
    width: 16px;
    height: 16px;
    flex: none;
  }

  .tab span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab :global(svg) {
    width: 13px;
    height: 13px;
    flex: none;
  }

  .strip.dark {
    background: var(--ink);
    border-color: var(--ink);
  }

  .strip.dark .tab {
    color: color-mix(in srgb, var(--bg) 70%, var(--ink));
  }

  .strip.dark .tab.on {
    background: color-mix(in srgb, var(--bg) 14%, var(--ink));
    color: var(--bg);
  }

  /* A home screen: the icons at a phone's size, under its masks (the round corners are the phone's). */
  .screen {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding: 16px 16px 14px;
    background: var(--sunk);
    border: 1px solid var(--rule);
  }

  .screen figure {
    display: grid;
    justify-items: center;
    gap: 6px;
    width: 76px;
  }

  .screen .m {
    color: var(--ink-2);
  }

  .screen img {
    width: 60px;
    height: 60px;
  }

  .ios {
    /* iOS's rounded square, near enough at this size. */
    border-radius: 22.5%;
  }

  .round {
    border-radius: 50%;
  }

  .screen figcaption {
    max-width: 100%;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .colour {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .swatch {
    width: 28px;
    height: 28px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
  }

  .pick {
    width: 44px;
    height: 40px;
    padding: 2px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
    cursor: pointer;
  }

  .pick::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .pick::-webkit-color-swatch {
    border: 0;
    border-radius: 0;
  }

  /* On a phone the list goes under its label: the names need the width. */
  @media (max-width: 759px) {
    .files {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
  }

  .made {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--mono);
    font-size: 11px;
  }

  .made th,
  .made td {
    padding: 2px 0;
    vertical-align: baseline;
  }

  .made th {
    font-weight: 400;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .made td {
    padding-left: 10px;
    color: var(--ink-2);
    text-align: right;
    white-space: nowrap;
  }

  .code {
    margin: 0;
    padding: 10px 12px;
    background: var(--card);
    border: 1px solid var(--rule);
    font-size: 12px;
  }

  .copy {
    display: flex;
  }

  .sizes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 22px 30px;
  }

  .sizes figure {
    display: grid;
    gap: 6px;
    justify-items: start;
    min-width: 0;
    max-width: 100%;
  }

  /* Each icon's square marked, so a transparent edge shows where it ends. */
  .sizes img {
    max-width: 100%;
    height: auto;
    outline: 1px dashed var(--rule);
  }

  .icos {
    display: flex;
    align-items: flex-end;
    gap: 14px;
  }

  .sizes figcaption {
    color: var(--ink-2);
  }
</style>

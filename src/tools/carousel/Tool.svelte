<!--
  F-110 Carousel slicer: one wide photo cut into tiles that swipe as one picture. A strip of 2 to 10
  tiles in a shape (4:5, 1:1, 3:4) is fitted into the photo, slid along the way it has room, and cut
  (carousel.ts). The preview shows the strip on the photo and the tiles in a row that swipes; each
  tile is saved as a JPG 1080 px wide (never scaled up), numbered in order, without metadata.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Minus, Plus } from '@lucide/svelte';
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
  import { decode, draw, encode, preview, isPhoto, fit } from '../../lib/images.ts';
  import { formatBytes, outName, stem } from '../../lib/files.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { RATIOS, MIN_TILES, MAX_TILES, defaultTiles, strip, tiles, tileSize, backgroundFor, tileName, type Ratio } from './carousel.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a wide photo here, or choose one',
      dropHint: 'A panorama works best. JPG, HEIC, PNG, WebP.',
      another: 'Use another photo',
      oneAtATime: 'One photo at a time: {name} is open.',
      shape: 'Tile shape',
      tiles: 'Tiles',
      fewer: 'One tile fewer',
      more: 'One tile more',
      auto: 'As many as the photo’s width holds.',
      backTo: 'Back to {n}',
      position: 'Position',
      left: 'Left',
      right: 'Right',
      up: 'Up',
      down: 'Down',
      fills: 'The strip fills the photo: nothing to move.',
      onPhoto: 'The strip on the photo',
      swipe: 'As it swipes',
      swipeNote: 'swipe sideways',
      tileOf: 'Tile {i} of {n}',
      result: 'Result',
      eachTile: '{n} tiles, each',
      notScaled: 'Under 1080 px: the photo has no more pixels per tile, and it isn’t scaled up.',
      saves: 'Saves',
      quality: 'JPG · quality {q} · no place, camera or time',
      change: 'Change',
      notPhoto: '{name} isn’t a photo this browser can open.',
      reading: 'Reading the photo…',
      working: 'Cutting {n} tiles…',
      failed: 'Couldn’t cut the tiles.',
      inAll: '{size} in all',
    },
    de: {
      drop: 'Ein breites Foto hier ablegen oder auswählen',
      dropHint: 'Am besten ein Panorama. JPG, HEIC, PNG, WebP.',
      another: 'Anderes Foto nehmen',
      oneAtATime: 'Ein Foto nach dem anderen: {name} ist offen.',
      shape: 'Kachelform',
      tiles: 'Kacheln',
      fewer: 'Eine Kachel weniger',
      more: 'Eine Kachel mehr',
      auto: 'So viele, wie die Breite des Fotos hergibt.',
      backTo: 'Zurück auf {n}',
      position: 'Lage',
      left: 'Links',
      right: 'Rechts',
      up: 'Oben',
      down: 'Unten',
      fills: 'Der Streifen füllt das Foto: nichts zu verschieben.',
      onPhoto: 'Der Streifen auf dem Foto',
      swipe: 'So wischt es sich',
      swipeNote: 'zur Seite wischen',
      tileOf: 'Kachel {i} von {n}',
      result: 'Ergebnis',
      eachTile: '{n} Kacheln, jede',
      notScaled: 'Unter 1080 px: Das Foto hat nicht mehr Pixel pro Kachel, und es wird nicht hochgerechnet.',
      saves: 'Speichert',
      quality: 'JPG · Qualität {q} · ohne Ort, Kamera und Zeit',
      change: 'Ändern',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      reading: 'Das Foto wird gelesen…',
      working: '{n} Kacheln werden geschnitten…',
      failed: 'Die Kacheln ließen sich nicht schneiden.',
      inAll: 'zusammen {size}',
    },
  });

  // The tile's shape is kept; the count and the position belong to each photo.
  const o = remember('carousel', { ratio: '4:5' as Ratio });

  interface Photo {
    id: number;
    file: File;
    thumb: string;
    /** A copy big enough for the preview and the tiles' backgrounds. */
    view: string;
    bitmap: ImageBitmap;
    width: number;
    height: number;
  }

  let photo = $state.raw<Photo | null>(null);
  let opened = 0;
  let reading = $state(false);
  let errors = $state<string[]>([]);
  /** Tiles chosen by hand; null follows the photo. */
  let count = $state<number | null>(null);
  /** 0 to 1 along the way the strip can slide. */
  let position = $state(0.5);

  const mark = $derived(shared.decimal);

  async function open(list: File[]) {
    errors = [];
    const file = list[0];
    if (!file) return;
    if (list.length > 1) errors = [w('oneAtATime', { name: file.name })];
    reading = true;
    try {
      if (!(await isPhoto(file))) throw new Error();
      const d = await decode(file);
      const big = fit(d.width, d.height, 2400, 1600);
      const view = preview((await encode(draw(d.bitmap, big.width, big.height, 'image/jpeg'), 'image/jpeg', 82, null, true)).blob).url;
      const t = fit(d.width, d.height, 240, 240);
      const thumb = preview((await encode(draw(d.bitmap, t.width, t.height, 'image/jpeg'), 'image/jpeg', 70, null, true)).blob).url;
      close();
      photo = { id: ++opened, file, thumb, view, bitmap: d.bitmap, width: d.width, height: d.height };
      count = null;
      position = 0.5;
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
    URL.revokeObjectURL(p.thumb);
    URL.revokeObjectURL(p.view);
    photo = null;
  }

  $effect(() => () => close());

  const given = untrack(() => filesOf(items));
  if (given.length) void open(given);

  // ── The strip ──
  const ratio = $derived(RATIOS[o.ratio]);
  const auto = $derived(photo ? defaultTiles(photo.width, photo.height, ratio) : 4);
  const n = $derived(count ?? auto);
  const band = $derived(photo ? strip(photo.width, photo.height, n, ratio, position) : null);
  const parts = $derived(band ? tiles(band, n) : []);
  const size = $derived(band ? tileSize(band, n, ratio) : null);

  function step(by: number) {
    count = Math.min(MAX_TILES, Math.max(MIN_TILES, n + by));
  }

  // The tiles' result follows the slider once it rests.
  let settled = $state(0.5);
  $effect(() => {
    const p = position;
    const timer = setTimeout(() => (settled = p), 180);
    return () => clearTimeout(timer);
  });

  // ── The result ──
  const keyOf = (pos: number) => JSON.stringify([photo?.id, o.ratio, n, pos, shared.quality, shared.names]);
  let made = $state.raw<{ key: string; outputs: Output[] } | null>(null);
  let busy = $state(false);
  let failed = $state(false);

  $effect(() => {
    const p = photo;
    const r = ratio;
    const many = n;
    const pos = settled;
    const quality = shared.quality;
    const k = keyOf(pos);
    failed = false;
    if (!p) {
      busy = false;
      return;
    }
    let cancelled = false;
    busy = true;
    const timer = setTimeout(async () => {
      try {
        const s = strip(p.width, p.height, many, r, pos);
        const out = tileSize(s, many, r);
        const base = stem(p.file.name);
        const list: Output[] = [];
        for (const [i, t] of tiles(s, many).entries()) {
          if (cancelled) return;
          const canvas = draw(p.bitmap, out.width, out.height, 'image/jpeg', t);
          const enc = await encode(canvas, 'image/jpeg', quality, null, true);
          list.push({ blob: enc.blob, name: tileName(base, i) });
        }
        if (!cancelled) made = { key: k, outputs: list };
      } catch {
        if (!cancelled) failed = true;
      } finally {
        if (!cancelled) busy = false;
      }
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const current = $derived(made && made.key === keyOf(position) ? made : null);
  const outputs = $derived(current?.outputs ?? null);
  const nextItems = $derived(outputs ? outputs.map((x) => ({ file: new File([x.blob], x.name, { type: x.blob.type }) })) : null);
  const total = $derived(outputs ? outputs.reduce((sum, x) => sum + x.blob.size, 0) : 0);
  const zipName = $derived(photo ? outName(photo.file.name, 'carousel', 'zip', shared.names) : 'carousel');

  const ends = $derived(band?.axis === 'x' ? [w('left'), w('right')] : [w('up'), w('down')]);
  const along = $derived(Math.round(position * 100));
</script>

<div class="cols">
  <div class="stack">
    {#if photo && band}
      <figure class="plate">
        <div class="frame">
          <div class="stage" style:--ar={`${photo.width} / ${photo.height}`}>
            <img src={photo.view} alt={photo.file.name} />
            <svg viewBox={`0 0 ${photo.width} ${photo.height}`} preserveAspectRatio="none" role="img" aria-label={w('onPhoto')}>
              <path class="veil" fill-rule="evenodd" d={`M0 0H${photo.width}V${photo.height}H0Z M${band.x} ${band.y}h${band.w}v${band.h}h${-band.w}Z`} />
              {#each parts.slice(1) as t (t.x)}
                <line class="cut-under" x1={t.x} y1={t.y} x2={t.x} y2={t.y + t.h} />
                <line class="cut" x1={t.x} y1={t.y} x2={t.x} y2={t.y + t.h} />
              {/each}
              <rect class="edge-under" x={band.x} y={band.y} width={band.w} height={band.h} />
              <rect class="edge" x={band.x} y={band.y} width={band.w} height={band.h} />
            </svg>
          </div>
        </div>
        <figcaption>
          <code>{photo.width} × {photo.height}</code>
          <span>{photo.file.name}</span>
        </figcaption>
      </figure>

      <h2 class="h">{w('swipe')}<em>{w('swipeNote')}</em></h2>
      <div class="swipe" role="list" aria-label={w('swipe')} style:--tile={`${ratio}`}>
        {#each parts as t, i (i)}
          {@const bg = backgroundFor(photo.width, photo.height, t)}
          <div class="tile" role="listitem" aria-label={w('tileOf', { i: i + 1, n })} style:background-image={`url("${photo.view}")`} style:background-size={bg.size} style:background-position={bg.position}>
            <span class="num m">{i + 1}/{n}</span>
          </div>
        {/each}
      </div>

      <FileRow name={photo.file.name} thumb={photo.thumb} meta={`${photo.width} × ${photo.height} · ${formatBytes(photo.file.size, mark)}`} onremove={close} />
      <DropWell accept="image/*,.heic,.heif" compact title={w('another')} onfiles={open} />
    {:else}
      <DropWell accept="image/*,.heic,.heif" title={w('drop')} hint={w('dropHint')} onfiles={open} />
    {/if}
    {#if reading}<p class="note" aria-live="polite">{w('reading')}</p>{/if}
    {#each errors as err (err)}<p class="note bad" role="alert">{err}</p>{/each}
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('shape')}</dt>
        <dd>
          <Seg
            label={w('shape')}
            value={o.ratio}
            options={(['4:5', '1:1', '3:4'] as Ratio[]).map((r) => ({ value: r, label: r }))}
            onchange={(v) => (o.ratio = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('tiles')}</dt>
        <dd>
          <div class="stepper">
            <button type="button" class="btn" aria-label={w('fewer')} disabled={n <= MIN_TILES} onclick={() => step(-1)}><Minus aria-hidden="true" /></button>
            <output class="count" aria-live="polite" aria-label={w('tiles')}>{n}</output>
            <button type="button" class="btn" aria-label={w('more')} disabled={n >= MAX_TILES} onclick={() => step(1)}><Plus aria-hidden="true" /></button>
          </div>
          {#if count === null || count === auto}
            <span class="note">{w('auto')}</span>
          {:else}
            <button type="button" class="link back" onclick={() => (count = null)}>{w('backTo', { n: auto })}</button>
          {/if}
        </dd>
      </div>
      <div>
        <dt><label for="carousel-position">{w('position')}</label></dt>
        <dd class="slide">
          {#if band?.axis}
            <input
              id="carousel-position"
              class="range"
              type="range"
              min="0"
              max="100"
              step="1"
              value={along}
              aria-valuetext={`${along} %`}
              oninput={(e) => (position = Number(e.currentTarget.value) / 100)}
            />
            <div class="ends note" aria-hidden="true"><span>{ends[0]}</span><span>{ends[1]}</span></div>
          {:else}
            <span class="note">{band ? w('fills') : '–'}</span>
          {/if}
        </dd>
      </div>
      {#if photo && size}
        <div>
          <dt>{w('result')}</dt>
          <dd aria-live="polite">
            <span class="note">{w('eachTile', { n })}</span>
            <div class="big"><b>{size.width} × {size.height}</b><span class="px">px</span></div>
            {#if size.width < 1080}<span class="note">{w('notScaled')}</span>{/if}
            {#if current}
              <span class="note m">{w('inAll', { size: formatBytes(total, mark) })}</span>
            {:else if failed}
              <span class="note bad" role="alert">{w('failed')}</span>
            {:else}
              <span class="note">{w('working', { n })}</span>
            {/if}
          </dd>
        </div>
      {/if}
      <div>
        <dt>{w('saves')}</dt>
        <dd>
          <span class="note">{w('quality', { q: shared.quality })} <button type="button" class="link change" onclick={() => (ui.settings = true)}>{w('change')}</button></span>
          <SharedNote chip="photo" />
        </dd>
      </div>
    </dl>

    {#if photo}
      <SaveButton {outputs} busy={busy || reading} {zipName} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['topdf', 'shrink']} />
    {/if}
  </div>
</div>

<style>
  /* The photo at its own shape, as big as the plate allows, with the strip drawn over it. */
  .stage {
    position: relative;
    width: min(100%, calc(min(62vh, 640px) * (var(--ar))));
    aspect-ratio: var(--ar);
  }

  .stage img {
    display: block;
    width: 100%;
    height: 100%;
    max-height: none;
    object-fit: fill;
  }

  .stage svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .veil {
    fill: var(--bg);
    opacity: 0.62;
  }

  /* Lines in both inks, so they show on any photo. */
  .edge-under,
  .cut-under {
    fill: none;
    stroke: var(--card);
    stroke-width: 4px;
    vector-effect: non-scaling-stroke;
  }

  .edge,
  .cut {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }

  .cut {
    stroke-dasharray: 6 4;
  }

  /* The tiles in a row that swipes like the post will, one settling at a time. */
  .swipe {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    padding-bottom: 8px;
    min-width: 0;
  }

  .tile {
    position: relative;
    flex: 0 0 min(76%, 260px);
    aspect-ratio: var(--tile);
    scroll-snap-align: center;
    background-color: var(--sunk);
    background-repeat: no-repeat;
    border: 1px solid var(--ink);
  }

  .num {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 1px 5px;
    background: var(--card);
    color: var(--ink);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stepper .btn {
    width: 40px;
    min-height: 40px;
    padding: 0;
  }

  .stepper :global(svg) {
    width: 16px;
    height: 16px;
  }

  .count {
    min-width: 2ch;
    text-align: center;
    font-size: 24px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .back {
    font-size: 13px;
    min-height: 40px;
  }

  .slide {
    justify-items: stretch;
  }

  .ends {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
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

  .px {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink-2);
  }

  .change {
    margin-left: 6px;
    font-size: 13px;
  }
</style>

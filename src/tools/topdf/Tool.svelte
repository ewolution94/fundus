<!--
  F-106 Photos to PDF: several photos, in the order chosen, into one PDF (pdf-lib), a page each. The
  page is A4 or Letter (the shared Page size) or the photo's own shape; turned to suit each photo or
  as chosen; with no, a small or a normal margin. Each photo goes in as a JPG at the shared Photo
  quality, at most 300 dpi of the size it's drawn at (topdf.ts), so the PDF stays reasonable and
  carries none of the photos' metadata. Reorder by dragging (computer) or with the arrows (phone).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { ArrowUp, ArrowDown, X, GripVertical } from '@lucide/svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared, setShared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { perFile } from '../../lib/jobs.svelte.ts';
  import { decode, draw, encode, preview, isPhoto, fit } from '../../lib/images.ts';
  import { formatBytes } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { layout, pixelsFor, move, pdfName, pageSize, type Layout, type Orientation, type Margin, type PageChoice, type Paper } from './topdf.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop photos or scans here, or choose them',
      dropHint: 'JPG, HEIC, PNG, WebP. A page each, in the order you like.',
      add: 'Add photos',
      pages: 'Pages',
      order: 'Drag or use the arrows',
      orderPhone: 'Use the arrows',
      page: 'Page',
      pageN: 'Page {n} of {total}',
      fitPhoto: 'Fit the photo',
      fitHint: 'Each page takes its photo’s shape.',
      orientation: 'Turn',
      auto: 'Auto',
      portrait: 'Portrait',
      landscape: 'Landscape',
      autoHint: 'Each page turns to suit its photo.',
      margin: 'Margin',
      none: 'None',
      small: 'Small',
      normal: 'Normal',
      quality: 'Quality',
      qSmall: 'Small',
      qGood: 'Good',
      qBest: 'Best',
      photosGo: 'Photos go in as JPG, at most 300 dpi: nothing else of them, no place, no camera.',
      result: 'Result',
      nPages: '{n} pages',
      onePage: '1 page',
      up: 'Move up: {name}',
      upShort: 'Move up',
      downShort: 'Move down',
      down: 'Move down: {name}',
      remove: 'Remove: {name}',
      nowPage: 'Every tool now makes {size} pages',
      nowQuality: 'Every photo tool now saves at {name} quality ({q})',
      notPhoto: '{name} isn’t a photo this browser can open.',
      working: 'Laying out page {n} of {total}…',
      making: 'Making the PDF…',
      reading: 'Reading the photos…',
      failed: 'Couldn’t put {name} in.',
      failedPdf: 'Couldn’t make the PDF.',
    },
    de: {
      drop: 'Fotos oder Scans hier ablegen oder auswählen',
      dropHint: 'JPG, HEIC, PNG, WebP. Je eine Seite, in deiner Reihenfolge.',
      add: 'Fotos dazu',
      pages: 'Seiten',
      order: 'Ziehen oder die Pfeile nehmen',
      orderPhone: 'Mit den Pfeilen sortieren',
      page: 'Seite',
      pageN: 'Seite {n} von {total}',
      fitPhoto: 'Wie das Foto',
      fitHint: 'Jede Seite hat die Form ihres Fotos.',
      orientation: 'Ausrichtung',
      auto: 'Auto',
      portrait: 'Hoch',
      landscape: 'Quer',
      autoHint: 'Jede Seite dreht sich passend zu ihrem Foto.',
      margin: 'Rand',
      none: 'Keiner',
      small: 'Schmal',
      normal: 'Normal',
      quality: 'Qualität',
      qSmall: 'Klein',
      qGood: 'Gut',
      qBest: 'Beste',
      photosGo: 'Fotos kommen als JPG hinein, höchstens 300 dpi: sonst nichts von ihnen, kein Ort, keine Kamera.',
      result: 'Ergebnis',
      nPages: '{n} Seiten',
      onePage: '1 Seite',
      up: 'Nach oben: {name}',
      upShort: 'Nach oben',
      downShort: 'Nach unten',
      down: 'Nach unten: {name}',
      remove: 'Entfernen: {name}',
      nowPage: 'Jedes Werkzeug macht jetzt {size}-Seiten',
      nowQuality: 'Jedes Foto-Werkzeug speichert jetzt in Qualität {name} ({q})',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      working: 'Seite {n} von {total} wird gesetzt…',
      making: 'Das PDF entsteht…',
      reading: 'Die Fotos werden gelesen…',
      failed: '{name} ließ sich nicht einfügen.',
      failedPdf: 'Das PDF ließ sich nicht machen.',
    },
  });

  const o = remember('topdf', { fit: false, orientation: 'auto' as Orientation, margin: 'small' as Margin });

  interface Entry {
    file: File;
    thumb: string;
    width: number;
    height: number;
  }

  interface Placed {
    jpg: Uint8Array;
    layout: Layout;
    width: number;
    height: number;
  }

  let entries = $state<Entry[]>([]);
  let adding = $state(0);
  let errors = $state<string[]>([]);
  let selected = $state(0);
  const mark = $derived(shared.decimal);
  const touch = matchMedia('(hover: none)').matches;

  const choice = $derived<PageChoice>(o.fit ? 'fit' : shared.pageSize);
  const qualityName = (q: number) => (q === 70 ? w('qSmall') : q === 95 ? w('qBest') : w('qGood'));

  async function add(list: File[]) {
    errors = [];
    adding++;
    const fresh: Entry[] = [];
    for (const file of list) {
      try {
        if (!(await isPhoto(file))) throw new Error();
        const d = await decode(file);
        // Big enough for the page on the plate; the rows show it small.
        const size = fit(d.width, d.height, 900, 900);
        const small = draw(d.bitmap, size.width, size.height, 'image/jpeg');
        d.bitmap.close();
        const thumb = preview((await encode(small, 'image/jpeg', 72, null, true)).blob).url;
        fresh.push({ file, thumb, width: d.width, height: d.height });
      } catch {
        errors = [...errors, w('notPhoto', { name: file.name })];
      }
    }
    entries = [...entries, ...fresh];
    adding--;
  }

  function remove(i: number) {
    URL.revokeObjectURL(entries[i].thumb);
    jobs.forget(entries[i].file);
    entries = entries.filter((_, k) => k !== i);
    selected = Math.min(selected, Math.max(0, entries.length - 1));
  }

  function shift(from: number, to: number) {
    if (to < 0 || to >= entries.length) return;
    entries = move(entries, from, to);
    selected = to;
  }

  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  const layoutOf = (e: Entry) => layout(e.width, e.height, choice, shared.pageSize, o.orientation, o.margin);

  // Each photo, drawn at the pixels its page needs and encoded once per layout and quality. The order
  // isn't in the key: moving a page only puts the PDF together again.
  const jobs = perFile<Placed>(
    () => entries.map((e) => e.file),
    () => `${choice}|${shared.pageSize}|${o.orientation}|${o.margin}|${shared.quality}`,
    async (file, stale) => {
      const entry = untrack(() => entries.find((e) => e.file === file))!;
      const placed = layoutOf(entry);
      const quality = shared.quality;
      const px = pixelsFor(placed.box, entry.width, entry.height);
      const d = await decode(file);
      try {
        if (stale()) throw new Error('stale');
        const canvas = draw(d.bitmap, px.width, px.height, 'image/jpeg');
        const out = await encode(canvas, 'image/jpeg', quality, null, true);
        return { jpg: new Uint8Array(await out.blob.arrayBuffer()), layout: placed, width: px.width, height: px.height };
      } finally {
        d.bitmap.close();
      }
    },
  );

  // The PDF, put together whenever the pages or their order change; ready before Save is tapped.
  let pdf = $state<Output | null>(null);
  let making = $state(false);
  let pdfFailed = $state(false);

  $effect(() => {
    const values = jobs.values;
    const name = entries[0] ? pdfName(entries[0].file.name, shared.names) : '';
    pdf = null;
    pdfFailed = false;
    if (!values || adding) return;
    let live = true;
    making = true;
    (async () => {
      try {
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.create();
        doc.setProducer('Fundus');
        doc.setCreator('Fundus');
        for (const v of values) {
          const image = await doc.embedJpg(v.jpg);
          const page = doc.addPage(v.layout.page);
          page.drawImage(image, { x: v.layout.box.x, y: v.layout.box.y, width: v.layout.box.w, height: v.layout.box.h });
        }
        const bytes = await doc.save();
        if (live) pdf = { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), name };
      } catch {
        if (live) pdfFailed = true;
      } finally {
        if (live) making = false;
      }
    })();
    return () => {
      live = false;
      making = false;
    };
  });

  const outputs = $derived(pdf ? [pdf] : null);
  const nextItems = $derived(pdf ? [{ file: new File([pdf.blob], pdf.name, { type: 'application/pdf' }) }] : null);

  const fmt = (n: number, max: number) => formatNumber(n, mark, { max });
  const sizeOf = (l: Layout) => pageSize(l.page, shared.pageSize === 'letter' ? 'imperial' : 'metric', fmt);
  const turnOf = (l: Layout) => (l.page[0] > l.page[1] ? w('landscape') : w('portrait'));
  const paperName = (p: Paper) => (p === 'a4' ? 'A4' : 'Letter');

  const current = $derived(entries[Math.min(selected, entries.length - 1)]);
  const currentLayout = $derived(current ? layoutOf(current) : null);
  const workingOn = $derived(entries.findIndex((e) => !jobs.get(e.file)));

  // Dragging rows (a computer's mouse; phones use the arrows).
  let dragFrom = $state(-1);
  let dragOver = $state(-1);

  function dropOn(i: number, e: DragEvent) {
    e.preventDefault();
    if (dragFrom >= 0) shift(dragFrom, i);
    dragFrom = -1;
    dragOver = -1;
  }

  /** Where the photo sits on its page, in percent (the page's origin is at its bottom left). */
  const placeStyle = (l: Layout) => {
    const [W, H] = l.page;
    return `left:${(l.box.x / W) * 100}%;top:${((H - l.box.y - l.box.h) / H) * 100}%;width:${(l.box.w / W) * 100}%;height:${(l.box.h / H) * 100}%`;
  };
</script>

<div class="cols">
  <div class="stack">
    {#if entries.length && current && currentLayout}
      <figure class="plate">
        <div class="frame paper-ground">
          <div class="paper big-paper" style:aspect-ratio={`${currentLayout.page[0]} / ${currentLayout.page[1]}`} style:--ratio={currentLayout.page[0] / currentLayout.page[1]}>
            <img src={current.thumb} alt={current.file.name} style={placeStyle(currentLayout)} />
          </div>
        </div>
        <figcaption>
          <code>{w('pageN', { n: Math.min(selected, entries.length - 1) + 1, total: entries.length })}</code>
          <span>{o.fit ? w('fitPhoto') : paperName(shared.pageSize)} · {turnOf(currentLayout)} · {sizeOf(currentLayout)}</span>
        </figcaption>
      </figure>

      <h2 class="h">{w('pages')} <em>{touch ? w('orderPhone') : w('order')}</em></h2>
      <ol class="pages">
        {#each entries as e, i (e.file)}
          {@const l = layoutOf(e)}
          {@const done = jobs.get(e.file)}
          <li
            class="row"
            class:chosen={i === Math.min(selected, entries.length - 1)}
            class:over={dragOver === i && dragFrom !== i}
            draggable={!touch}
            ondragstart={(ev) => {
              dragFrom = i;
              ev.dataTransfer?.setData('text/plain', String(i));
              if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
            }}
            ondragover={(ev) => {
              if (dragFrom < 0) return;
              ev.preventDefault();
              dragOver = i;
            }}
            ondragleave={() => (dragOver = dragOver === i ? -1 : dragOver)}
            ondrop={(ev) => dropOn(i, ev)}
            ondragend={() => {
              dragFrom = -1;
              dragOver = -1;
            }}
          >
            {#if !touch}<GripVertical class="grip" aria-hidden="true" />{/if}
            <button type="button" class="pick" onclick={() => (selected = i)} aria-label={`${w('page')} ${i + 1}: ${e.file.name}`}>
              <span class="paper mini" style:aspect-ratio={`${l.page[0]} / ${l.page[1]}`} style:--ratio={l.page[0] / l.page[1]}>
                <img src={e.thumb} alt="" style={placeStyle(l)} />
              </span>
              <span class="text">
                <b><span class="num">{i + 1}</span>{e.file.name}</b>
                <small>{done?.error ? w('failed', { name: e.file.name }) : `${e.width} × ${e.height}${done?.value && done.value.width !== e.width ? ` → ${done.value.width} × ${done.value.height}` : ''} · ${formatBytes(e.file.size, mark)}`}</small>
              </span>
            </button>
            <span class="acts">
              <button type="button" class="act" disabled={i === 0} onclick={() => shift(i, i - 1)} aria-label={w('up', { name: e.file.name })} title={w('upShort')}><ArrowUp aria-hidden="true" /></button>
              <button type="button" class="act" disabled={i === entries.length - 1} onclick={() => shift(i, i + 1)} aria-label={w('down', { name: e.file.name })} title={w('downShort')}><ArrowDown aria-hidden="true" /></button>
              <button type="button" class="act" onclick={() => remove(i)} aria-label={w('remove', { name: e.file.name })}><X aria-hidden="true" /></button>
            </span>
          </li>
        {/each}
      </ol>
      <DropWell accept="image/*,.heic,.heif" multiple compact title={w('add')} onfiles={add} />
    {:else}
      <DropWell accept="image/*,.heic,.heif" multiple title={w('drop')} hint={w('dropHint')} onfiles={add} />
    {/if}
    {#if adding}<p class="note" aria-live="polite">{w('reading')}</p>{/if}
    {#each errors as err (err)}<p class="note bad" role="alert">{err}</p>{/each}
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('page')}</dt>
        <dd>
          <Seg
            label={w('page')}
            value={choice}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'fit', label: w('fitPhoto') },
            ] as { value: PageChoice; label: string }[]}
            onchange={(v) => {
              if (v === 'fit') o.fit = true;
              else {
                o.fit = false;
                setShared('pageSize', v, w('nowPage', { size: paperName(v) }));
              }
            }}
          />
          {#if o.fit}<span class="note">{w('fitHint')}</span>{:else}<SharedNote chip="pdf" />{/if}
        </dd>
      </div>
      <div>
        <dt>{w('orientation')}</dt>
        <dd>
          <Seg
            label={w('orientation')}
            value={o.orientation}
            options={[
              { value: 'auto', label: w('auto'), disabled: o.fit },
              { value: 'portrait', label: w('portrait'), disabled: o.fit },
              { value: 'landscape', label: w('landscape'), disabled: o.fit },
            ] as { value: Orientation; label: string; disabled?: boolean }[]}
            onchange={(v) => (o.orientation = v)}
          />
          {#if !o.fit && o.orientation === 'auto'}<span class="note">{w('autoHint')}</span>{/if}
        </dd>
      </div>
      <div>
        <dt>{w('margin')}</dt>
        <dd>
          <Seg
            label={w('margin')}
            value={o.margin}
            options={[
              { value: 'none', label: w('none') },
              { value: 'small', label: w('small') },
              { value: 'normal', label: w('normal') },
            ] as { value: Margin; label: string }[]}
            onchange={(v) => (o.margin = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('quality')}</dt>
        <dd>
          <Seg
            label={w('quality')}
            value={shared.quality}
            options={[70, 85, 95].map((q) => ({ value: q, label: qualityName(q), title: `${q}` }))}
            onchange={(q) => setShared('quality', q, w('nowQuality', { name: qualityName(q), q }))}
          />
          <span class="note">{w('photosGo')}</span>
          <SharedNote chip="photo" />
        </dd>
      </div>
      {#if entries.length}
        <div>
          <dt>{w('result')}</dt>
          <dd aria-live="polite">
            {#if pdf}
              <div class="big"><b>{formatBytes(pdf.blob.size, mark)}</b><span class="count">{entries.length === 1 ? w('onePage') : w('nPages', { n: entries.length })}</span></div>
            {:else if pdfFailed}
              <span class="note bad" role="alert">{w('failedPdf')}</span>
            {:else if entries.some((e) => jobs.get(e.file)?.error)}
              <span class="note bad" role="alert">{w('failed', { name: entries.find((e) => jobs.get(e.file)?.error)!.file.name })}</span>
            {:else if workingOn >= 0}
              <span class="note">{w('working', { n: workingOn + 1, total: entries.length })}</span>
            {:else if making}
              <span class="note">{w('making')}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if entries.length}
      <SaveButton {outputs} busy={jobs.busy || making || adding > 0} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['arrange', 'sign']} />
    {/if}
  </div>
</div>

<style>
  .paper-ground {
    padding: 18px;
  }

  /* A page: paper white in both themes, as the PDF will be. */
  .paper {
    position: relative;
    display: block;
    background: #fff;
    border: 1px solid var(--rule);
    overflow: hidden;
  }

  .paper img {
    position: absolute;
    object-fit: fill;
    max-width: none;
    max-height: none;
  }

  .big-paper {
    width: min(100%, calc(min(52vh, 480px) * var(--ratio, 1)));
  }

  /* Over the plate's own rule for its picture: here the page is the picture. */
  .plate > .frame .paper img {
    max-width: none;
    max-height: none;
  }

  .pages {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }

  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    padding: 6px 6px 6px 8px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    min-width: 0;
  }

  .row.chosen {
    box-shadow: inset 4px 0 0 var(--ink);
  }

  .row.over {
    border-style: dashed;
    background: var(--sunk);
  }

  .row[draggable='true'] {
    cursor: grab;
  }

  .row :global(.grip) {
    width: 16px;
    height: 16px;
    color: var(--ink-2);
  }

  .row:not([draggable='true']) {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .pick {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    min-width: 0;
    min-height: 44px;
    text-align: left;
  }

  .mini {
    justify-self: center;
    width: min(52px, calc(52px * var(--ratio, 1)));
  }

  .text {
    display: grid;
    min-width: 0;
  }

  .text b {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .num {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    margin-right: 8px;
    color: var(--ink-2);
  }

  .text small {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .acts {
    display: flex;
    gap: 0;
  }

  .act {
    width: 40px;
    height: 44px;
    display: grid;
    place-items: center;
  }

  .act :global(svg) {
    width: 18px;
    height: 18px;
  }

  .count {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink-2);
  }

  @media (hover: hover) and (pointer: fine) {
    .act:not(:disabled):hover {
      background: var(--sunk);
    }
  }
</style>

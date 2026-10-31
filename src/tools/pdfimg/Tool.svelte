<!--
  F-203 PDF to photos: every page, or the pages picked, as a JPG or PNG at 72, 150 or 300 dpi.
  The pages are drawn by pdf.js one after another as soon as the PDF is in (and again when an option
  changes), so Save hands them out at once. Several go as a ZIP from the Many files count on.
-->
<script lang="ts">
  import { untrack, onDestroy } from 'svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, t } from '../../lib/i18n.svelte.ts';
  import { shared, setShared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes, stem } from '../../lib/files.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { readPdf, problemOf, closePdf, pageInfos, drawPage, canvasBlob, release, breathe, Thumbs, nearView, type Opened, type PageInfo, type Problem } from '../../lib/pdfpages.ts';
  import { DPIS, pixelSize, parsePages, formatPages, pageName } from './pdfimg.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a PDF here, or choose one',
      dropHint: 'Every page becomes a JPG or PNG.',
      another: 'Open another PDF',
      notPdf: '{name} isn’t a PDF.',
      locked: '{name} is locked with a password. Open it, save a copy without one, and try that.',
      broken: '{name} is damaged: this PDF can’t be read.',
      drawFailed: 'Page {n} couldn’t be drawn.',
      'count.one': '{n} page',
      'count.other': '{n} pages',
      pages: 'Pages',
      every: 'Every page',
      choose: 'Choose',
      chooseHint: 'Tap pages to pick them, or type them: 1–3, 5',
      typed: 'Pages to save',
      notThere: 'Only pages 1 to {n} are there.',
      picked: '{n} of {total} picked',
      nonePicked: 'Pick at least one page.',
      format: 'Format',
      quality: 'Quality',
      resolution: 'Resolution',
      forPage: 'for page {n}',
      result: 'Result',
      'photos.one': '{n} photo',
      'photos.other': '{n} photos',
      drawing: 'Drawing page {n} of {total}…',
      clamped: 'A page this big is drawn at {width} × {height}, the most a phone can hold.',
      nowSaves: 'Every photo tool now saves {format}',
      nowQuality: 'Every photo tool now saves at “{q}” quality',
      page: 'Page {n}',
      pickPage: 'Page {n}, picked',
      board: 'The PDF’s pages',
    },
    de: {
      drop: 'PDF hier ablegen oder auswählen',
      dropHint: 'Jede Seite wird ein JPG oder PNG.',
      another: 'Anderes PDF öffnen',
      notPdf: '{name} ist kein PDF.',
      locked: '{name} ist mit einem Passwort geschützt. Öffne es, speichere eine Kopie ohne und nimm die.',
      broken: '{name} ist beschädigt: Dieses PDF lässt sich nicht lesen.',
      drawFailed: 'Seite {n} ließ sich nicht zeichnen.',
      'count.one': '{n} Seite',
      'count.other': '{n} Seiten',
      pages: 'Seiten',
      every: 'Jede Seite',
      choose: 'Auswählen',
      chooseHint: 'Tippe Seiten an oder schreib sie: 1–3, 5',
      typed: 'Seiten zum Speichern',
      notThere: 'Es gibt nur die Seiten 1 bis {n}.',
      picked: '{n} von {total} gewählt',
      nonePicked: 'Wähl mindestens eine Seite.',
      format: 'Format',
      quality: 'Qualität',
      resolution: 'Auflösung',
      forPage: 'für Seite {n}',
      result: 'Ergebnis',
      'photos.one': '{n} Foto',
      'photos.other': '{n} Fotos',
      drawing: 'Seite {n} von {total} wird gezeichnet…',
      clamped: 'Eine so große Seite wird mit {width} × {height} gezeichnet, mehr schafft ein Handy nicht.',
      nowSaves: 'Jedes Foto-Werkzeug speichert jetzt {format}',
      nowQuality: 'Jedes Foto-Werkzeug speichert jetzt in „{q}“',
      page: 'Seite {n}',
      pickPage: 'Seite {n}, gewählt',
      board: 'Die Seiten des PDFs',
    },
  });

  // The resolution is kept; the PDF and the pages picked are not.
  const o = remember('pdfimg', { dpi: 150 });
  const dpi = $derived((DPIS as readonly number[]).includes(o.dpi) ? o.dpi : 150);

  let file = $state<File | null>(null);
  let opened = $state.raw<Opened | null>(null);
  let infos = $state.raw<PageInfo[]>([]);
  let problem = $state<{ kind: Problem; name: string } | null>(null);
  let loading = $state(false);

  let mode = $state<'all' | 'some'>('all');
  let picked = $state.raw<number[]>([]);
  let typed = $state('');
  let typedBad = $state(false);

  const thumbs = new Thumbs(300);
  // Each opened PDF gets its own thumbnails.
  let generation = 0;
  let thumbKey = $state('');
  onDestroy(() => {
    thumbs.destroy();
    closePdf(opened?.doc);
  });

  async function add(list: File[]) {
    const f = list[0];
    if (!f) return;
    problem = null;
    loading = true;
    try {
      const next = await readPdf(f);
      const pages = await pageInfos(next.doc);
      const old = opened;
      thumbs.drop(thumbKey);
      thumbKey = `${++generation}:`;
      file = f;
      opened = next;
      infos = pages;
      mode = 'all';
      picked = [];
      typed = '';
      typedBad = false;
      closePdf(old?.doc);
    } catch (error) {
      problem = { kind: problemOf(error), name: f.name };
    } finally {
      loading = false;
    }
  }

  function clear() {
    thumbs.drop(thumbKey);
    closePdf(opened?.doc);
    file = null;
    opened = null;
    infos = [];
    picked = [];
    typed = '';
  }

  // A PDF dropped on the home, or handed on from another tool, goes straight in.
  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  const count = $derived(infos.length);
  const targets = $derived(mode === 'all' || count === 1 ? infos.map((_, i) => i + 1) : picked);
  const format = $derived(shared.photoFormat === 'png' ? 'image/png' : 'image/jpeg');
  const ext = $derived(format === 'image/png' ? 'png' : 'jpg');
  const mark = $derived(shared.decimal);

  function toggle(n: number) {
    picked = picked.includes(n) ? picked.filter((p) => p !== n) : [...picked, n].sort((a, b) => a - b);
    typed = formatPages(picked);
    typedBad = false;
  }

  function typing(text: string) {
    typed = text;
    const read = parsePages(text, count);
    picked = read.pages;
    typedBad = read.bad;
  }

  // ── The photos, drawn before Save is tapped ──────────────────────────────────────────────────

  let outputs = $state.raw<Output[] | null>(null);
  let progress = $state<{ done: number; total: number } | null>(null);
  let failed = $state<number | null>(null);
  /** Drawn pages for the options in `cacheFor`; other options start it over. */
  const cache = new Map<number, Blob>();
  let cacheFor = '';

  $effect(() => {
    const doc = opened?.doc;
    const list = targets;
    const options = `${thumbKey}|${dpi}|${format}|${shared.quality}`;
    const names = shared.names;
    const name = file?.name ?? 'pdf';
    const type = format;
    const quality = shared.quality;
    const resolution = dpi;
    const extension = ext;
    outputs = null;
    failed = null;
    if (!doc || !list.length) {
      progress = null;
      return;
    }
    if (options !== cacheFor) {
      cache.clear();
      cacheFor = options;
    }
    let cancelled = false;
    (async () => {
      const out: Output[] = [];
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        progress = { done: i, total: list.length };
        let blob = cache.get(n);
        if (!blob) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const info = infos[n - 1];
          const px = pixelSize(info.width, info.height, resolution);
          const canvas = await drawPage(page, px.width, px.height);
          blob = await canvasBlob(canvas, type, type === 'image/jpeg' ? quality / 100 : undefined);
          release(canvas);
          page.cleanup();
          if (cancelled) return;
          cache.set(n, blob);
          await breathe();
          if (cancelled) return;
        }
        out.push({ blob, name: pageName(name, n, extension, names, list.length > 1) });
      }
      outputs = out;
      progress = null;
    })().catch(() => {
      if (cancelled) return;
      failed = progress ? list[progress.done] : list[0];
      progress = null;
    });
    return () => {
      cancelled = true;
    };
  });

  const total = $derived(outputs?.reduce((sum, o) => sum + o.blob.size, 0) ?? 0);
  const first = $derived(infos[(targets[0] ?? 1) - 1]);
  const firstPx = $derived(first ? pixelSize(first.width, first.height, dpi) : null);
  const nextItems = $derived(outputs?.length === 1 ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: outputs[0].blob.type }) }] : null);
  const zipName = $derived(file ? `${stem(file.name)}-pages` : 'pages');

  const QUALITIES = $derived([
    { value: 70, label: t('set.quality.small') },
    { value: 85, label: t('set.quality.good') },
    { value: 95, label: t('set.quality.best') },
  ]);
</script>

<div class="cols">
  <div class="stack">
    {#if file && opened}
      <FileRow name={file.name} meta={`${w('count', { n: count })} · ${formatBytes(file.size, mark)}`} onremove={clear} />
      <ul class="pages" aria-label={w('board')}>
        {#each infos as info, i (`${thumbKey}${i}`)}
          {@const n = i + 1}
          {@const key = `${thumbKey}${i}`}
          {@const on = mode === 'some' && picked.includes(n)}
          <li use:nearView={() => opened && thumbs.want(key, opened.doc, i)}>
            {#if mode === 'some' && count > 1}
              <button type="button" class="pg" class:on aria-pressed={on} aria-label={w('page', { n })} onclick={() => toggle(n)}>
                <span class="paper">
                  {#if thumbs.url(key)}<img src={thumbs.url(key)} alt="" />{:else}<span class="blank" class:wide={info.width > info.height} style:aspect-ratio={`${info.width} / ${info.height}`}></span>{/if}
                </span>
                <span class="m n" class:hl={on}>{n}</span>
              </button>
            {:else}
              <div class="pg">
                <span class="paper">
                  {#if thumbs.url(key)}<img src={thumbs.url(key)} alt={w('page', { n })} />{:else}<span class="blank" class:wide={info.width > info.height} style:aspect-ratio={`${info.width} / ${info.height}`}></span>{/if}
                </span>
                <span class="m n">{n}</span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      <DropWell accept="application/pdf,.pdf" compact title={w('another')} onfiles={add} />
    {:else}
      <DropWell accept="application/pdf,.pdf" title={w('drop')} hint={w('dropHint')} onfiles={add} />
    {/if}
    {#if problem}<p class="note bad" role="alert">{w(problem.kind, { name: problem.name })}</p>{/if}
  </div>

  <div class="stack">
    <dl class="spec">
      {#if count > 1}
        <div>
          <dt>{w('pages')}</dt>
          <dd>
            <Seg
              label={w('pages')}
              value={mode}
              options={[
                { value: 'all', label: w('every') },
                { value: 'some', label: w('choose') },
              ]}
              onchange={(v) => (mode = v)}
            />
            {#if mode === 'some'}
              <input class="field" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-label={w('typed')} placeholder="1–3, 5" value={typed} oninput={(e) => typing(e.currentTarget.value)} />
              {#if typedBad}
                <span class="note bad">{w('notThere', { n: count })}</span>
              {:else if picked.length}
                <span class="note">{w('picked', { n: picked.length, total: count })}</span>
              {:else}
                <span class="note">{w('chooseHint')}</span>
              {/if}
            {/if}
          </dd>
        </div>
      {/if}
      <div>
        <dt>{w('format')}</dt>
        <dd>
          <Seg
            label={w('format')}
            value={ext}
            options={[
              { value: 'jpg', label: 'JPG' },
              { value: 'png', label: 'PNG' },
            ]}
            onchange={(v) => {
              if (v !== ext) setShared('photoFormat', v, w('nowSaves', { format: v === 'png' ? 'PNG' : 'JPG' }));
            }}
          />
          <SharedNote chip="photo" />
        </dd>
      </div>
      {#if format === 'image/jpeg'}
        <div>
          <dt>{w('quality')}</dt>
          <dd>
            <Seg
              label={w('quality')}
              value={shared.quality}
              options={QUALITIES}
              onchange={(v) => setShared('quality', v, w('nowQuality', { q: QUALITIES.find((q) => q.value === v)?.label ?? String(v) }))}
            />
            <SharedNote chip="photo" />
          </dd>
        </div>
      {/if}
      <div>
        <dt>{w('resolution')}</dt>
        <dd>
          <Seg label={w('resolution')} value={dpi} options={DPIS.map((d) => ({ value: d, label: `${d} dpi` }))} onchange={(v) => (o.dpi = v)} />
          {#if firstPx}<span class="note"><code class="m">{firstPx.width} × {firstPx.height} px</code>{count > 1 ? ` ${w('forPage', { n: targets[0] ?? 1 })}` : ''}</span>{/if}
          {#if firstPx?.clamped}<span class="note">{w('clamped', { width: firstPx.width, height: firstPx.height })}</span>{/if}
        </dd>
      </div>
      {#if opened}
        <div>
          <dt>{w('result')}</dt>
          <dd>
            {#if outputs}
              <div class="big">
                <b>{formatBytes(total, mark)}</b>
                <span class="m">{w('photos', { n: outputs.length })}</span>
              </div>
              <span class="note">{outputs.length === 1 ? outputs[0].name : `${outputs[0].name} … ${outputs[outputs.length - 1].name}`}</span>
            {:else if failed !== null}
              <span class="note bad" role="alert">{w('drawFailed', { n: failed })}</span>
            {:else if progress}
              <span class="note" aria-live="polite">{w('drawing', { n: progress.done + 1, total: progress.total })}</span>
              <span class="bar" aria-hidden="true"><span style:width={`${(progress.done / progress.total) * 100}%`}></span></span>
            {:else if !targets.length}
              <span class="note">{w('nonePicked')}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if opened}
      <SaveButton {outputs} busy={!!progress || loading} {zipName} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['shrink', 'resize', 'blur']} />
    {/if}
  </div>
</div>

<style>
  .pages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(96px, 30%), 1fr));
    gap: 14px 10px;
  }

  .pages li {
    min-width: 0;
  }

  .pg {
    width: 100%;
    display: grid;
    gap: 4px;
    justify-items: center;
    text-align: center;
  }

  /* A square for every page, so turned pages line up with the rest. */
  .paper {
    width: 100%;
    aspect-ratio: 1;
    display: grid;
    /* Definite tracks, so the picture's max-height of 100 % means the square. */
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    place-items: center;
    background: var(--sunk);
    border: 1px solid var(--rule);
    padding: 6px;
  }

  .paper img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    outline: 1px solid var(--rule);
  }

  /* Until its picture is drawn: the page's shape, empty. */
  .blank {
    height: 100%;
    background: var(--card);
    outline: 1px solid var(--rule);
  }

  .blank.wide {
    height: auto;
    width: 100%;
  }

  button.pg .paper {
    border-color: var(--rule);
  }

  button.pg.on .paper {
    border: 2px solid var(--ink);
    padding: 5px;
  }

  .n {
    padding: 0 4px;
    color: var(--ink-2);
  }

  .n.hl {
    color: var(--mark-ink);
  }

  @media (hover: hover) and (pointer: fine) {
    button.pg:not(.on):hover .paper {
      border-color: var(--ink);
    }
  }

  .bar {
    display: block;
    width: 100%;
    max-width: 260px;
    height: 3px;
    background: var(--rule);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--ink);
  }
</style>

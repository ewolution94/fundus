<!--
  F-101 Convert photos: HEIC, PNG, WebP, AVIF, SVG or JPG in; JPG, PNG or WebP out, many at once. The
  format is the shared Photo format setting, the JPG and WebP quality the shared Photo quality. A
  photo that already is the target type keeps its bytes (convert.ts); everything else is drawn and
  encoded once, with the metadata as the location setting says. An SVG is drawn at the Size row's
  scale or width (src/lib/svg.ts), sharp at that size; one with HTML inside is refused up front.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared, setShared, type PhotoFormat } from '../../lib/settings.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { perFile } from '../../lib/jobs.svelte.ts';
  import { decode, draw, encode, canEncode, preview, isPhoto, extOf, fit } from '../../lib/images.ts';
  import { formatBytes, kindOf, isSvg } from '../../lib/files.ts';
  import { formatNumber, parseNumber } from '../../lib/numbers.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { svgSize, isSvgText, holdsHtml, needsFonts, scaleTo, drawSvg, type Size } from '../../lib/svg.ts';
  import { strip } from '../../lib/exif.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { targetFor, keepsBytes, convertedName, uniqueNames, sizeChange, kindLabel, svgWant, QUALITIES, SVG_SCALES, MAX_WIDTH, type Source, type SvgScale } from './convert.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop photos here, or choose them',
      dropHint: 'HEIC, PNG, WebP, AVIF, SVG, JPG. Many at once.',
      add: 'Add photos',
      format: 'Format',
      same: 'Same',
      sameHint: 'Each keeps its format; HEIC and AVIF become JPG, SVG becomes PNG.',
      quality: 'Quality',
      small: 'Small',
      good: 'Good',
      best: 'Best',
      pngOnly: 'PNG keeps every pixel: quality is for JPG and WebP.',
      location: 'Location',
      removeLocation: 'Remove place, camera and time',
      result: 'Result',
      kept: 'Already {kind}: kept as it is.',
      keptStripped: 'Already {kind}: the picture stays, only its metadata goes.',
      someKept: '{n} already in that format: kept as they are.',
      converted: '{n} converted.',
      notPhoto: '{name} isn’t a photo this browser can open.',
      noWebp: 'This browser can’t write WebP (Safari): it saves JPG.',
      nowSaves: 'Every photo tool now saves {format}',
      nowSame: 'Every photo tool now keeps each photo’s format',
      nowQuality: 'Every photo tool now saves at {name} quality ({q})',
      nowStrips: 'Every photo tool now removes place, camera and time',
      nowKeeps: 'Every photo tool now keeps place, camera and time',
      working: 'Converting {name}…',
      reading: 'Reading the photos…',
      failed: 'Couldn’t convert {name}.',
      count: '{n} photos',
      size: 'Size',
      width: 'Width',
      widthLabel: 'Width in pixels',
      badWidth: 'Type a width from 1 to {max} px.',
      svgOne: '{name}: {from} → {to} px',
      svgMany: 'For every SVG in the list. {name}: {from} → {to} px',
      capped: 'Kept at {size} px: browsers draw no bigger.',
      html: '{name}: this SVG holds HTML inside, which browsers won’t turn into pixels.',
      fonts: 'Text in {name} uses this device’s fonts: fonts it links to aren’t loaded.',
    },
    de: {
      drop: 'Fotos hier ablegen oder auswählen',
      dropHint: 'HEIC, PNG, WebP, AVIF, SVG, JPG. Viele auf einmal.',
      add: 'Fotos dazu',
      format: 'Format',
      same: 'Gleich',
      sameHint: 'Jedes behält sein Format; HEIC und AVIF werden JPG, SVG wird PNG.',
      quality: 'Qualität',
      small: 'Klein',
      good: 'Gut',
      best: 'Beste',
      pngOnly: 'PNG behält jedes Pixel: Qualität gilt für JPG und WebP.',
      location: 'Standort',
      removeLocation: 'Ort, Kamera und Zeit entfernen',
      result: 'Ergebnis',
      kept: 'Schon {kind}: bleibt, wie es ist.',
      keptStripped: 'Schon {kind}: das Bild bleibt, nur die Metadaten gehen.',
      someKept: '{n} schon in dem Format: bleiben, wie sie sind.',
      converted: '{n} umgewandelt.',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      noWebp: 'Dieser Browser kann kein WebP schreiben (Safari): er speichert JPG.',
      nowSaves: 'Jedes Foto-Werkzeug speichert jetzt {format}',
      nowSame: 'Jedes Foto-Werkzeug behält jetzt das Format jedes Fotos',
      nowQuality: 'Jedes Foto-Werkzeug speichert jetzt in Qualität {name} ({q})',
      nowStrips: 'Jedes Foto-Werkzeug entfernt jetzt Ort, Kamera und Zeit',
      nowKeeps: 'Jedes Foto-Werkzeug behält jetzt Ort, Kamera und Zeit',
      working: '{name} wird umgewandelt…',
      reading: 'Die Fotos werden gelesen…',
      failed: '{name} ließ sich nicht umwandeln.',
      count: '{n} Fotos',
      size: 'Größe',
      width: 'Breite',
      widthLabel: 'Breite in Pixeln',
      badWidth: 'Gib eine Breite von 1 bis {max} px ein.',
      svgOne: '{name}: {from} → {to} px',
      svgMany: 'Für jedes SVG in der Liste. {name}: {from} → {to} px',
      capped: 'Bleibt bei {size} px: größer zeichnen Browser nicht.',
      html: '{name}: Dieses SVG enthält HTML, das Browser nicht in Pixel umwandeln.',
      fonts: 'Text in {name} nutzt die Schriften dieses Geräts: verlinkte Schriften werden nicht geladen.',
    },
  });

  interface Entry {
    file: File;
    kind: Source;
    thumb: string;
    width: number;
    height: number;
    /** An SVG's text, its own size (unrounded) and whether its text needs the device's fonts. */
    svg: { text: string; size: Size; fonts: boolean } | null;
  }

  interface Converted {
    blob: Blob;
    /** The name before repeats are numbered. */
    name: string;
    kept: boolean;
    /** The pixels an SVG was drawn at. */
    drawn?: { width: number; height: number };
  }

  // The SVG's size, kept for next time (a choice, not content).
  const o = remember('convert', { svgScale: '1' as SvgScale, svgWidth: '1000' });

  let entries = $state<Entry[]>([]);
  let adding = $state(0);
  let errors = $state<string[]>([]);
  let webpOk = $state(true);
  void canEncode('image/webp').then((ok) => (webpOk = ok));

  const mark = $derived(shared.decimal);
  const qualityName = (q: number) => (q === 70 ? w('small') : q === 95 ? w('best') : w('good'));
  const formatWord = (f: PhotoFormat) => (f === 'jpg' ? 'JPG' : f === 'png' ? 'PNG' : f === 'webp' ? 'WebP' : w('same'));

  /** An SVG's text, or null for anything else (a file can come without a type or an ending). */
  async function svgText(file: File): Promise<string | null> {
    if (!isSvg(file) && ((await kindOf(file)) !== 'other' || file.size > 20e6)) return null;
    const text = await file.text();
    return isSvgText(text) ? text : null;
  }

  async function add(list: File[]) {
    errors = [];
    adding++;
    const fresh: Entry[] = [];
    for (const file of list) {
      try {
        const text = await svgText(file);
        if (text !== null) {
          if (holdsHtml(text)) {
            errors = [...errors, w('html', { name: file.name })];
            continue;
          }
          const size = svgSize(text);
          // A vector: its picture is drawn for the box, larger than it is if need be.
          const k = Math.min(240 / size.width, 240 / size.height);
          const small = await drawSvg(text, size.width * k, size.height * k, '#fff');
          const thumb = preview((await encode(small, 'image/jpeg', 80, null, true)).blob).url;
          fresh.push({ file, kind: 'svg', thumb, width: Math.round(size.width), height: Math.round(size.height), svg: { text, size, fonts: needsFonts(text) } });
          continue;
        }
        if (!(await isPhoto(file))) throw new Error();
        const kind = await kindOf(file);
        const d = await decode(file);
        const size = fit(d.width, d.height, 240, 240);
        const small = draw(d.bitmap, size.width, size.height, 'image/jpeg');
        d.bitmap.close();
        const thumb = preview((await encode(small, 'image/jpeg', 70, null, true)).blob).url;
        fresh.push({ file, kind, thumb, width: d.width, height: d.height, svg: null });
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
    made.delete(entries[i].file);
    entries = entries.filter((_, k) => k !== i);
  }

  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  const entryOf = (file: File) => entries.find((e) => e.file === file);

  // The Size row: what it asks of every SVG, or null for a width that isn't one.
  const want = $derived(svgWant(o.svgScale, parseNumber(o.svgWidth)));
  const svgs = $derived(entries.filter((e) => e.svg));

  const photoKey = () => `${shared.photoFormat}|${shared.quality}|${shared.stripLocation}|${shared.names}|${webpOk}`;
  const svgKey = () => (want ? ('width' in want ? `w${want.width}` : `x${want.scale}`) : 'none');
  // The SVG's size only counts while there's an SVG in.
  const key = () => `${photoKey()}|${svgs.length ? svgKey() : ''}`;

  // Each file's own result by the options it depends on: a new SVG size leaves the photos alone.
  const made = new Map<File, { key: string; value: Converted }>();

  const jobs = perFile<Converted>(
    () => entries.map((e) => e.file),
    key,
    async (file) => {
      const entry = untrack(() => entryOf(file));
      const own = entry?.svg ? `${photoKey()}|${svgKey()}` : photoKey();
      const before = made.get(file);
      if (before?.key === own) return before.value;
      const value = await convert(file, entry);
      made.set(file, { key: own, value });
      return value;
    },
  );

  async function convert(file: File, entry: Entry | undefined): Promise<Converted> {
    const setting = shared.photoFormat;
    const quality = shared.quality;
    const stripIt = shared.stripLocation;
    const names = shared.names;
    const kind = entry?.kind ?? 'other';
    const type = targetFor(kind, setting, webpOk);
    if (entry?.svg) {
      const asked = untrack(() => want);
      if (!asked) throw new Error('No width');
      const to = scaleTo(entry.svg.size, asked);
      // A PNG or WebP keeps the transparency; a JPG gets white under it.
      const canvas = await drawSvg(entry.svg.text, to.width, to.height, type === 'image/jpeg' ? '#fff' : null);
      const out = await encode(canvas, type, quality, null, true);
      return { blob: out.blob, name: convertedName(file.name, extOf(out.type), names), kept: false, drawn: { width: to.width, height: to.height } };
    }
    if (keepsBytes(kind, type)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stripped = stripIt ? strip(bytes, 'everything') : null;
      const blob = stripped ? new Blob([stripped as BlobPart], { type }) : new Blob([bytes as BlobPart], { type });
      return { blob, name: convertedName(file.name, extOf(type), names), kept: true };
    }
    const d = await decode(file);
    try {
      const canvas = draw(d.bitmap, d.width, d.height, type);
      const out = await encode(canvas, type, quality, file, stripIt);
      return { blob: out.blob, name: convertedName(file.name, extOf(out.type), names), kept: false };
    } finally {
      d.bitmap.close();
    }
  }

  const outputs = $derived.by((): Output[] | null => {
    if (adding) return null;
    const values = jobs.values;
    if (!values) return null;
    const names = uniqueNames(values.map((v) => v.name));
    return values.map((v, i) => ({ blob: v.blob, name: names[i] }));
  });

  const nextItems = $derived(outputs?.length ? outputs.map((o) => ({ file: new File([o.blob], o.name, { type: o.blob.type }) })) : null);

  // Whether quality matters for what's in: it does for a photo drawn into a JPG or WebP, not for a
  // PNG or a photo that keeps its bytes. Only "all re-encoded ones are PNG" gets a line.
  const encoded = $derived(entries.map((e) => targetFor(e.kind, shared.photoFormat, webpOk)).filter((t, i) => !keepsBytes(entries[i].kind, t)));
  const pngOnly = $derived(encoded.length > 0 && encoded.every((t) => t === 'image/png'));

  const totals = $derived.by(() => {
    const values = jobs.values;
    if (!values) return null;
    const before = entries.reduce((n, e) => n + e.file.size, 0);
    const after = values.reduce((n, v) => n + v.blob.size, 0);
    return { before, after, kept: values.filter((v) => v.kept).length, done: values.filter((v) => !v.kept).length };
  });

  const working = $derived(entries.find((e) => !jobs.get(e.file)));

  function rowMeta(e: Entry): string {
    const done = jobs.get(e.file);
    const before = `${formatBytes(e.file.size, mark)} ${kindLabel(e.kind)}`;
    const drawn = done?.value?.drawn ? ` · ${done.value.drawn.width} × ${done.value.drawn.height}` : '';
    if (done?.value) return `${before} → ${formatBytes(done.value.blob.size, mark)} ${extOf(done.value.blob.type).toUpperCase().replace('WEBP', 'WebP')}${drawn}`;
    if (done?.error) return w('failed', { name: e.file.name });
    return `${before} · ${e.width} × ${e.height}`;
  }

  const percent = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), mark, { max: 0 })} %`;

  // What the first SVG becomes, for the Size row.
  const firstSvg = $derived(svgs[0]);
  const firstTo = $derived(firstSvg?.svg && want ? scaleTo(firstSvg.svg.size, want) : null);
  const capped = $derived(want ? svgs.map((e) => scaleTo(e.svg!.size, want)).find((t) => t.capped) : undefined);
</script>

<div class="cols">
  <div class="stack">
    {#if entries.length}
      {#if entries.length === 1}
        <figure class="plate">
          <div class="frame"><img src={entries[0].thumb} alt={entries[0].file.name} /></div>
          <figcaption>
            <code>{entries[0].width} × {entries[0].height}</code>
            <span>{formatBytes(entries[0].file.size, mark)} {kindLabel(entries[0].kind)}</span>
            <span>{entries[0].file.name}</span>
          </figcaption>
        </figure>
      {:else}
        <h2 class="h">{w('count', { n: entries.length })}</h2>
      {/if}
      {#each entries as e, i (e.file)}
        <FileRow name={e.file.name} thumb={e.thumb} meta={rowMeta(e)} onremove={() => remove(i)} />
      {/each}
      <DropWell accept="image/*,.heic,.heif,.svg" multiple compact title={w('add')} onfiles={add} />
    {:else}
      <DropWell accept="image/*,.heic,.heif,.svg" multiple title={w('drop')} hint={w('dropHint')} onfiles={add} />
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
            value={shared.photoFormat === 'webp' && !webpOk ? 'jpg' : shared.photoFormat}
            options={[
              { value: 'same', label: w('same') },
              { value: 'jpg', label: 'JPG' },
              { value: 'png', label: 'PNG' },
              { value: 'webp', label: 'WebP', disabled: !webpOk, title: webpOk ? undefined : w('noWebp') },
            ] as { value: PhotoFormat; label: string; disabled?: boolean; title?: string }[]}
            onchange={(v) => setShared('photoFormat', v, v === 'same' ? w('nowSame') : w('nowSaves', { format: formatWord(v) }))}
          />
          {#if shared.photoFormat === 'same'}<span class="note">{w('sameHint')}</span>{/if}
          {#if !webpOk}<span class="note">{w('noWebp')}</span>{/if}
          <SharedNote chip="photo" />
        </dd>
      </div>
      {#if svgs.length}
        <div>
          <dt>{w('size')}</dt>
          <dd>
            <Seg
              label={w('size')}
              value={o.svgScale}
              options={SVG_SCALES.map((s) => ({ value: s, label: s === 'width' ? w('width') : `${s}×` }))}
              onchange={(v) => (o.svgScale = v)}
            />
            {#if o.svgScale === 'width'}
              <NumIn label={w('widthLabel')} value={o.svgWidth} size="mid" width="150px" unit="px" inputmode="numeric" oninput={(v) => (o.svgWidth = v)} />
              {#if !want}<span class="note bad">{w('badWidth', { max: formatNumber(MAX_WIDTH, mark) })}</span>{/if}
            {/if}
            {#if firstSvg && firstTo}
              <span class="note">{w(svgs.length > 1 ? 'svgMany' : 'svgOne', { name: firstSvg.file.name, from: `${firstSvg.width} × ${firstSvg.height}`, to: `${firstTo.width} × ${firstTo.height}` })}</span>
            {/if}
            {#if capped}<span class="note">{w('capped', { size: `${capped.width} × ${capped.height}` })}</span>{/if}
            {#each svgs.filter((e) => e.svg?.fonts) as e (e.file)}<span class="note">{w('fonts', { name: e.file.name })}</span>{/each}
          </dd>
        </div>
      {/if}
      <div>
        <dt>{w('quality')}</dt>
        <dd>
          <Seg
            label={w('quality')}
            value={shared.quality}
            options={QUALITIES.map((q) => ({ value: q as number, label: qualityName(q), title: `${q}` }))}
            onchange={(q) => setShared('quality', q, w('nowQuality', { name: qualityName(q), q }))}
          />
          {#if pngOnly}<span class="note">{w('pngOnly')}</span>{/if}
          <SharedNote chip="photo" />
        </dd>
      </div>
      <div>
        <dt>{w('location')}</dt>
        <dd>
          <Check checked={shared.stripLocation} label={w('removeLocation')} onchange={(v) => setShared('stripLocation', v, v ? w('nowStrips') : w('nowKeeps'))} />
          <SharedNote chip="photo" />
        </dd>
      </div>
      {#if entries.length}
        <div>
          <dt>{w('result')}</dt>
          <dd>
            {#if totals}
              {@const n = sizeChange(totals.before, totals.after)}
              <div class="big">
                <b>{formatBytes(totals.after, mark)}</b>
                <!-- An SVG's bytes say nothing about its pixels: no before and after with one in. -->
                {#if !svgs.length}
                  {#if formatBytes(totals.before, mark) !== formatBytes(totals.after, mark)}<s>{formatBytes(totals.before, mark)}</s>{/if}
                  {#if n < 0}<em>{percent(n)}</em>{:else if n > 0}<span class="up">{percent(n)}</span>{/if}
                {/if}
              </div>
              {#if entries.length === 1}
                {#if totals.kept}<span class="note">{shared.stripLocation ? w('keptStripped', { kind: kindLabel(entries[0].kind) }) : w('kept', { kind: kindLabel(entries[0].kind) })}</span>{/if}
              {:else}
                <span class="note">{totals.done ? w('converted', { n: totals.done }) : ''} {totals.kept ? w('someKept', { n: totals.kept }) : ''}</span>
              {/if}
            {:else if svgs.length && !want}
              <span class="note">{w('badWidth', { max: formatNumber(MAX_WIDTH, mark) })}</span>
            {:else if entries.some((e) => jobs.get(e.file)?.error)}
              <span class="note bad" role="alert">{w('failed', { name: entries.find((e) => jobs.get(e.file)?.error)!.file.name })}</span>
            {:else}
              <span class="note" aria-live="polite">{w('working', { name: working?.file.name ?? '' })}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if entries.length}
      <SaveButton {outputs} busy={jobs.busy || adding > 0} zipName="photos-converted" tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['shrink', 'resize', 'topdf']} />
    {/if}
  </div>
</div>

<style>
  .up {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink-2);
  }
</style>

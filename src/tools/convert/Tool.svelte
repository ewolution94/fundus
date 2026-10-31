<!--
  F-101 Convert photos: HEIC, PNG, WebP, AVIF or JPG in; JPG, PNG or WebP out, many at once. The
  format is the shared Photo format setting, the JPG and WebP quality the shared Photo quality. A
  photo that already is the target type keeps its bytes (convert.ts); everything else is drawn and
  encoded once, with the metadata as the location setting says.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared, setShared, type PhotoFormat } from '../../lib/settings.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { perFile } from '../../lib/jobs.svelte.ts';
  import { decode, draw, encode, canEncode, preview, isPhoto, extOf, fit } from '../../lib/images.ts';
  import { formatBytes, kindOf, type Kind } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import { strip } from '../../lib/exif.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { targetFor, keepsBytes, convertedName, uniqueNames, sizeChange, kindLabel, QUALITIES } from './convert.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop photos here, or choose them',
      dropHint: 'HEIC, PNG, WebP, AVIF, JPG. Many at once.',
      add: 'Add photos',
      format: 'Format',
      same: 'Same',
      sameHint: 'Each keeps its format; HEIC and AVIF become JPG.',
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
    },
    de: {
      drop: 'Fotos hier ablegen oder auswählen',
      dropHint: 'HEIC, PNG, WebP, AVIF, JPG. Viele auf einmal.',
      add: 'Fotos dazu',
      format: 'Format',
      same: 'Gleich',
      sameHint: 'Jedes behält sein Format; HEIC und AVIF werden JPG.',
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
    },
  });

  interface Entry {
    file: File;
    kind: Kind;
    thumb: string;
    width: number;
    height: number;
  }

  interface Converted {
    blob: Blob;
    /** The name before repeats are numbered. */
    name: string;
    kept: boolean;
  }

  let entries = $state<Entry[]>([]);
  let adding = $state(0);
  let errors = $state<string[]>([]);
  let webpOk = $state(true);
  void canEncode('image/webp').then((ok) => (webpOk = ok));

  const mark = $derived(shared.decimal);
  const qualityName = (q: number) => (q === 70 ? w('small') : q === 95 ? w('best') : w('good'));
  const formatWord = (f: PhotoFormat) => (f === 'jpg' ? 'JPG' : f === 'png' ? 'PNG' : f === 'webp' ? 'WebP' : w('same'));

  async function add(list: File[]) {
    errors = [];
    adding++;
    const fresh: Entry[] = [];
    for (const file of list) {
      try {
        if (!(await isPhoto(file))) throw new Error();
        const kind = await kindOf(file);
        const d = await decode(file);
        const size = fit(d.width, d.height, 240, 240);
        const small = draw(d.bitmap, size.width, size.height, 'image/jpeg');
        d.bitmap.close();
        const thumb = preview((await encode(small, 'image/jpeg', 70, null, true)).blob).url;
        fresh.push({ file, kind, thumb, width: d.width, height: d.height });
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
  }

  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  const kindOfFile = (file: File) => entries.find((e) => e.file === file)?.kind ?? 'other';

  const key = () => `${shared.photoFormat}|${shared.quality}|${shared.stripLocation}|${shared.names}|${webpOk}`;

  const jobs = perFile<Converted>(
    () => entries.map((e) => e.file),
    key,
    async (file) => {
      const setting = shared.photoFormat;
      const quality = shared.quality;
      const stripIt = shared.stripLocation;
      const names = shared.names;
      const kind = untrack(() => kindOfFile(file));
      const type = targetFor(kind, setting, webpOk);
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
    },
  );

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
    if (done?.value) return `${before} → ${formatBytes(done.value.blob.size, mark)} ${extOf(done.value.blob.type).toUpperCase().replace('WEBP', 'WebP')}`;
    if (done?.error) return w('failed', { name: e.file.name });
    return `${before} · ${e.width} × ${e.height}`;
  }

  const percent = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), mark, { max: 0 })} %`;
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
                {#if formatBytes(totals.before, mark) !== formatBytes(totals.after, mark)}<s>{formatBytes(totals.before, mark)}</s>{/if}
                {#if n < 0}<em>{percent(n)}</em>{:else if n > 0}<span class="up">{percent(n)}</span>{/if}
              </div>
              {#if entries.length === 1}
                {#if totals.kept}<span class="note">{shared.stripLocation ? w('keptStripped', { kind: kindLabel(entries[0].kind) }) : w('kept', { kind: kindLabel(entries[0].kind) })}</span>{/if}
              {:else}
                <span class="note">{totals.done ? w('converted', { n: totals.done }) : ''} {totals.kept ? w('someKept', { n: totals.kept }) : ''}</span>
              {/if}
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

<!--
  F-104 Remove location: first what each photo gives away (place, camera and lens, software, the
  time), read from its bytes; then the removal, "Location only" or "Everything". JPG, PNG and WebP
  are changed in place (lib/exif.ts strip): the picture stays bit for bit. HEIC and AVIF can't be,
  so they are drawn into a JPG. Every result is read back, and what's still in it is shown.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { perFile } from '../../lib/jobs.svelte.ts';
  import { decode, draw, encode, preview, fit } from '../../lib/images.ts';
  import { formatBytes, sniff, type Kind } from '../../lib/files.ts';
  import { readMeta, strip, carryExif, type Meta } from '../../lib/exif.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { FACTS, degrees, camera, parseTaken, present, compare, inPlace, redrawn, cleanName, JPG_QUALITY, type FactKey, type Scope } from './location.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop photos here, or choose them',
      dropHint: 'JPG, PNG, WebP, HEIC. Several at once.',
      add: 'Add photos',
      gives: 'What it gives away',
      place: 'Place',
      camera: 'Camera',
      lens: 'Lens',
      software: 'Software',
      taken: 'Taken',
      altitude: '{m} m above the sea',
      nothing: 'Nothing it gives away: no place, camera or time.',
      goes: 'goes',
      stays: 'stays',
      remove: 'Remove',
      locationOnly: 'Location only',
      everything: 'Everything',
      locationHint: 'Only the place goes; camera and time stay.',
      everythingHint: 'Place, camera, software and time go; only which way up it stands stays.',
      how: 'How',
      inPlace: 'JPG, PNG and WebP are changed in place: the picture stays bit for bit.',
      heic: 'HEIC can’t be changed in place: it’s saved as a JPG (quality {q}).',
      result: 'Result',
      nothingLeft: 'Nothing left',
      noPlace: 'No place left',
      placeStill: 'The place is still in it',
      left: 'Still in it: {list}.',
      'left.place': 'place',
      'left.camera': 'camera',
      'left.lens': 'lens',
      'left.software': 'software',
      'left.taken': 'time',
      hadNone: 'There was nothing to begin with; it’s saved clean all the same.',
      inN: 'In all {n} photos.',
      notPhoto: '{name} isn’t a photo this browser can open.',
      gif: '{name} is a GIF: GIFs don’t carry a place or a camera.',
      working: 'Removing it from {name}…',
      reading: 'Reading the photos…',
      failed: 'Couldn’t change {name}.',
      count: '{n} photos',
    },
    de: {
      drop: 'Fotos hier ablegen oder auswählen',
      dropHint: 'JPG, PNG, WebP, HEIC. Mehrere auf einmal.',
      add: 'Fotos dazu',
      gives: 'Was es verrät',
      place: 'Ort',
      camera: 'Kamera',
      lens: 'Objektiv',
      software: 'Software',
      taken: 'Aufgenommen',
      altitude: '{m} m über dem Meer',
      nothing: 'Es verrät nichts: kein Ort, keine Kamera, keine Zeit.',
      goes: 'geht',
      stays: 'bleibt',
      remove: 'Entfernen',
      locationOnly: 'Nur den Ort',
      everything: 'Alles',
      locationHint: 'Nur der Ort geht; Kamera und Zeit bleiben.',
      everythingHint: 'Ort, Kamera, Software und Zeit gehen; nur die Ausrichtung bleibt.',
      how: 'Wie',
      inPlace: 'JPG, PNG und WebP werden direkt geändert: das Bild bleibt Bit für Bit gleich.',
      heic: 'HEIC lässt sich nicht direkt ändern: es wird als JPG gespeichert (Qualität {q}).',
      result: 'Ergebnis',
      nothingLeft: 'Nichts mehr drin',
      noPlace: 'Kein Ort mehr drin',
      placeStill: 'Der Ort ist noch drin',
      left: 'Noch drin: {list}.',
      'left.place': 'Ort',
      'left.camera': 'Kamera',
      'left.lens': 'Objektiv',
      'left.software': 'Software',
      'left.taken': 'Zeit',
      hadNone: 'Es war von Anfang an nichts drin; es wird trotzdem sauber gespeichert.',
      inN: 'In allen {n} Fotos.',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      gif: '{name} ist ein GIF: GIFs tragen keinen Ort und keine Kamera.',
      working: 'Wird aus {name} entfernt…',
      reading: 'Die Fotos werden gelesen…',
      failed: '{name} ließ sich nicht ändern.',
      count: '{n} Fotos',
    },
  });

  const o = remember('location', { scope: 'location' as Scope });

  interface Entry {
    file: File;
    kind: Kind;
    thumb: string;
    before: Meta;
  }

  interface Clean {
    blob: Blob;
    name: string;
    after: Meta;
  }

  let entries = $state<Entry[]>([]);
  let adding = $state(0);
  let errors = $state<string[]>([]);
  const mark = $derived(shared.decimal);

  async function add(list: File[]) {
    errors = [];
    adding++;
    const fresh: Entry[] = [];
    for (const file of list) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const kind = sniff(bytes);
        if (kind === 'gif') {
          errors = [...errors, w('gif', { name: file.name })];
          continue;
        }
        if (!inPlace(kind) && !redrawn(kind)) throw new Error();
        const d = await decode(file);
        const size = fit(d.width, d.height, 240, 240);
        const small = draw(d.bitmap, size.width, size.height, 'image/jpeg');
        d.bitmap.close();
        const thumb = preview((await encode(small, 'image/jpeg', 70, null, true)).blob).url;
        fresh.push({ file, kind, thumb, before: readMeta(bytes) });
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

  const jobs = perFile<Clean>(
    () => entries.map((e) => e.file),
    () => `${o.scope}|${shared.names}`,
    async (file) => {
      const scope = o.scope;
      const names = shared.names;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = sniff(bytes);
      let out: Uint8Array;
      let type: string;
      if (inPlace(kind)) {
        out = strip(bytes, scope)!;
        type = kind === 'jpeg' ? 'image/jpeg' : kind === 'png' ? 'image/png' : 'image/webp';
      } else {
        const d = await decode(file);
        try {
          const canvas = draw(d.bitmap, d.width, d.height, 'image/jpeg');
          const jpg = new Uint8Array(await (await encode(canvas, 'image/jpeg', JPG_QUALITY, null, true)).blob.arrayBuffer());
          // "Location only" keeps the camera and the time: the HEIC's EXIF goes in without its GPS.
          out = scope === 'location' ? carryExif(bytes, jpg, true) : jpg;
          type = 'image/jpeg';
        } finally {
          d.bitmap.close();
        }
      }
      return { blob: new Blob([out as BlobPart], { type }), name: cleanName(file.name, kind, scope, names), after: readMeta(out) };
    },
  );

  const outputs = $derived<Output[] | null>(adding ? null : (jobs.values?.map((c) => ({ blob: c.blob, name: c.name })) ?? null));
  const nextItems = $derived(outputs?.length ? outputs.map((x) => ({ file: new File([x.blob], x.name, { type: x.blob.type }) })) : null);

  const dateFormat = $derived(new Intl.DateTimeFormat(locale() === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }));

  function value(meta: Meta, key: FactKey): string {
    if (key === 'place' && meta.gps) {
      const at = degrees(meta.gps.lat, meta.gps.lon, mark);
      return meta.gps.alt !== undefined && Number.isFinite(meta.gps.alt) ? `${at} · ${w('altitude', { m: Math.round(meta.gps.alt) })}` : at;
    }
    if (key === 'camera') return camera(meta.make, meta.model) ?? '';
    if (key === 'lens') return meta.lens ?? '';
    if (key === 'software') return meta.software ?? '';
    if (key === 'taken') {
      const date = parseTaken(meta.taken);
      return date ? dateFormat.format(date) : (meta.taken ?? '');
    }
    return '';
  }

  const summary = $derived.by(() => {
    const values = jobs.values;
    if (!values || adding) return null;
    const left = new Set<FactKey>();
    for (const c of values) for (const k of present(c.after)) left.add(k);
    const had = entries.some((e) => present(e.before).length > 0);
    return { left: FACTS.filter((k) => left.has(k)), had, n: values.length };
  });

  const hasHeic = $derived(entries.some((e) => redrawn(e.kind)));
  const working = $derived(entries.find((e) => !jobs.get(e.file)));
</script>

<div class="cols">
  <div class="stack">
    {#if entries.length}
      <h2 class="h">{entries.length > 1 ? w('count', { n: entries.length }) : w('gives')}</h2>
      {#each entries as e, i (e.file)}
        {@const done = jobs.get(e.file)?.value}
        {@const facts = present(e.before)}
        {@const diff = done ? compare(e.before, done.after) : null}
        <article class="pic">
          <FileRow
            name={e.file.name}
            thumb={e.thumb}
            meta={done ? `${formatBytes(e.file.size, mark)} → ${formatBytes(done.blob.size, mark)}` : formatBytes(e.file.size, mark)}
            onremove={() => remove(i)}
          />
          {#if facts.length}
            <dl class="facts">
              {#each facts as key (key)}
                {@const gone = diff?.gone.includes(key)}
                <div>
                  <dt>{w(key)}</dt>
                  <dd>
                    {#if gone}<s>{value(e.before, key)}</s>{:else}<span>{value(e.before, key)}</span>{/if}
                    {#if diff}<small class:went={gone}>{gone ? w('goes') : w('stays')}</small>{/if}
                  </dd>
                </div>
              {/each}
            </dl>
          {:else}
            <p class="facts none note">{w('nothing')}</p>
          {/if}
        </article>
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
        <dt>{w('remove')}</dt>
        <dd>
          <Seg
            large
            label={w('remove')}
            value={o.scope}
            options={[
              { value: 'location', label: w('locationOnly') },
              { value: 'everything', label: w('everything') },
            ] as { value: Scope; label: string }[]}
            onchange={(v) => (o.scope = v)}
          />
          <span class="note">{o.scope === 'location' ? w('locationHint') : w('everythingHint')}</span>
        </dd>
      </div>
      <div>
        <dt>{w('how')}</dt>
        <dd>
          <span class="note">{w('inPlace')}</span>
          {#if hasHeic}<span class="note">{w('heic', { q: JPG_QUALITY })}</span>{/if}
        </dd>
      </div>
      {#if entries.length}
        <div>
          <dt>{w('result')}</dt>
          <dd aria-live="polite">
            {#if summary}
              <div class="big"><b>{summary.left.length === 0 ? w('nothingLeft') : summary.left.includes('place') ? w('placeStill') : w('noPlace')}</b></div>
              {#if summary.left.length}<span class="note">{w('left', { list: summary.left.map((k) => w(`left.${k}`)).join(', ') })}</span>{/if}
              {#if summary.n > 1}<span class="note">{w('inN', { n: summary.n })}</span>{/if}
              {#if !summary.had}<span class="note">{w('hadNone')}</span>{/if}
            {:else if entries.some((e) => jobs.get(e.file)?.error)}
              <span class="note bad" role="alert">{w('failed', { name: entries.find((e) => jobs.get(e.file)?.error)!.file.name })}</span>
            {:else}
              <span class="note">{w('working', { name: working?.file.name ?? '' })}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if entries.length}
      <SaveButton {outputs} busy={jobs.busy || adding > 0} zipName="photos-clean" tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['shrink', 'resize', 'blur']} />
    {/if}
  </div>
</div>

<style>
  .pic {
    display: grid;
    min-width: 0;
  }

  .facts {
    display: grid;
    padding: 4px 12px;
    border: 1.5px solid var(--ink);
    border-top: 0;
    background: var(--card);
    min-width: 0;
  }

  .facts > div {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 10px;
    align-items: baseline;
    padding: 7px 0;
    border-bottom: 1px dashed var(--rule);
  }

  .facts > div:last-child {
    border-bottom: 0;
  }

  .facts dt {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .facts dd {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .facts s {
    color: var(--ink-2);
    font-weight: 500;
  }

  .facts small {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink-2);
    margin-left: auto;
  }

  .facts small.went {
    color: var(--ink);
  }

  .facts.none {
    padding: 10px 12px;
  }
</style>

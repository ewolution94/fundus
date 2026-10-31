<!--
  F-102 Shrink a photo: to a size someone names (an upload form's "under 2 MB"). Quality first, then
  pixels (shrink.ts). Several photos at once, each shrunk on its own. A photo already under the
  target keeps its pixels: only its metadata goes (if the setting says so), without re-encoding.
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
  import { shared, setShared } from '../../lib/settings.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { perFile } from '../../lib/jobs.svelte.ts';
  import { decode, draw, encode, canEncode, preview, isPhoto, extOf, fit } from '../../lib/images.ts';
  import { formatBytes, outName, kindOf } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import { strip } from '../../lib/exif.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { shrinkTo, targetBytes, TARGETS } from './shrink.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop photos here, or choose them',
      dropHint: 'JPG, HEIC, PNG, WebP. Several at once.',
      target: 'Target',
      format: 'Format',
      location: 'Location',
      removeLocation: 'Remove place, camera and time',
      result: 'Result',
      already: 'Already under {target}: only its metadata goes.',
      alreadyKeep: 'Already under {target}: saved as it is.',
      quality: 'quality {q}',
      notPhoto: '{name} isn’t a photo this browser can open.',
      noWebp: 'This browser can’t write WebP (Safari): it saves JPG.',
      nowSaves: 'Every photo tool now saves {format}',
      nowStrips: 'Every photo tool now removes place, camera and time',
      nowKeeps: 'Every photo tool now keeps place, camera and time',
      working: 'Shrinking {name}…',
      tooSmall: 'Even at its smallest it’s {size}: try a bigger target.',
      failed: 'Couldn’t shrink {name}.',
      add: 'Add photos',
    },
    de: {
      drop: 'Fotos hier ablegen oder auswählen',
      dropHint: 'JPG, HEIC, PNG, WebP. Mehrere auf einmal.',
      target: 'Ziel',
      format: 'Format',
      location: 'Standort',
      removeLocation: 'Ort, Kamera und Zeit entfernen',
      result: 'Ergebnis',
      already: 'Schon unter {target}: nur die Metadaten gehen.',
      alreadyKeep: 'Schon unter {target}: wird so gespeichert.',
      quality: 'Qualität {q}',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      noWebp: 'Dieser Browser kann kein WebP schreiben (Safari): er speichert JPG.',
      nowSaves: 'Jedes Foto-Werkzeug speichert jetzt {format}',
      nowStrips: 'Jedes Foto-Werkzeug entfernt jetzt Ort, Kamera und Zeit',
      nowKeeps: 'Jedes Foto-Werkzeug behält jetzt Ort, Kamera und Zeit',
      working: '{name} wird verkleinert…',
      tooSmall: 'Selbst ganz klein sind es {size}: versuch ein größeres Ziel.',
      failed: '{name} ließ sich nicht verkleinern.',
      add: 'Fotos dazu',
    },
  });

  /** A photo as it came in, with a small picture of it. */
  interface Entry {
    file: File;
    thumb: string;
    width: number;
    height: number;
  }

  /** What shrinking made: the file, and how (for the line under the result). */
  interface Shrunk {
    output: Output;
    width: number;
    height: number;
    quality: number | null;
    /** Over the target even at the smallest. */
    over: boolean;
  }

  let entries = $state<Entry[]>([]);
  let adding = $state(0);
  let errors = $state<string[]>([]);
  let webpOk = $state(true);
  void canEncode('image/webp').then((ok) => (webpOk = ok));

  const format = $derived(shared.photoFormat === 'webp' && webpOk ? 'image/webp' : 'image/jpeg');
  const mark = $derived(shared.decimal);

  async function add(list: File[]) {
    errors = [];
    adding++;
    const fresh: Entry[] = [];
    for (const file of list) {
      try {
        if (!(await isPhoto(file))) throw new Error();
        const d = await decode(file);
        const size = fit(d.width, d.height, 240, 240);
        const small = draw(d.bitmap, size.width, size.height, 'image/jpeg');
        d.bitmap.close();
        const thumb = preview((await encode(small, 'image/jpeg', 70, null, true)).blob).url;
        fresh.push({ file, thumb, width: d.width, height: d.height });
      } catch {
        errors = [...errors, w('notPhoto', { name: file.name })];
      }
    }
    // All at once, so Save never offers half of what was dropped.
    entries = [...entries, ...fresh];
    adding--;
  }

  function remove(i: number) {
    URL.revokeObjectURL(entries[i].thumb);
    jobs.forget(entries[i].file);
    entries = entries.filter((_, k) => k !== i);
  }

  // The inbox (a photo dropped on the home, or a result from another tool) goes straight in, once.
  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  // Everything a result depends on.
  const key = () => `${shared.sizeTarget}|${format}|${shared.stripLocation}|${shared.names}`;

  const jobs = perFile<Shrunk>(
    () => entries.map((e) => e.file),
    key,
    async (file, stale) => {
      const target = targetBytes(shared.sizeTarget);
      const type = format;
      const stripIt = shared.stripLocation;
      const names = shared.names;
      const kind = await kindOf(file);
      const d = await decode(file);
      if (file.size <= target && kind !== 'heic' && kind !== 'avif') {
        // Small enough already: keep the pixels, drop only the metadata (or nothing).
        d.bitmap.close();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const stripped = stripIt ? strip(bytes, 'everything') : null;
        const blob = stripped ? new Blob([stripped as BlobPart], { type: file.type }) : file;
        const ext = file.name.split('.').pop()?.toLowerCase() || extOf(file.type);
        return { output: { blob, name: outName(file.name, 'small', ext, names) }, width: d.width, height: d.height, quality: null, over: false };
      }
      const made = new Map<string, Blob>();
      const encodeAt = async (scale: number, quality: number) => {
        if (stale()) throw new Error('stale');
        const canvas = draw(d.bitmap, d.width * scale, d.height * scale, type);
        const out = await encode(canvas, type, quality * 100, file, stripIt);
        made.set(`${scale}:${quality}`, out.blob);
        return out.blob.size;
      };
      try {
        const best = await shrinkTo(encodeAt, target);
        return {
          output: { blob: made.get(`${best.scale}:${best.quality}`)!, name: outName(file.name, 'small', extOf(type), names) },
          width: Math.max(1, Math.round(d.width * best.scale)),
          height: Math.max(1, Math.round(d.height * best.scale)),
          quality: Math.round(best.quality * 100),
          over: best.bytes > target,
        };
      } finally {
        d.bitmap.close();
      }
    },
  );

  const outputs = $derived(adding ? null : (jobs.values?.map((s) => s.output) ?? null));
  const first = $derived(entries[0]);
  const firstDone = $derived(first ? jobs.get(first.file) : undefined);
  const nextItems = $derived(outputs?.length === 1 ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: outputs[0].blob.type }) }] : null);

  const percent = (before: number, after: number) => `−${formatNumber(Math.max(0, (1 - after / before) * 100), mark, { max: 0 })} %`;

  function detail(file: File, s: Shrunk): string {
    const target = formatBytes(targetBytes(shared.sizeTarget), mark);
    if (s.quality === null) return shared.stripLocation ? w('already', { target }) : w('alreadyKeep', { target });
    const how = `${s.width} × ${s.height} · ${w('quality', { q: s.quality })}`;
    return s.over ? `${how} · ${w('tooSmall', { size: formatBytes(s.output.blob.size, mark) })}` : how;
  }
</script>

<div class="cols">
  <div class="stack">
    {#if entries.length}
      {#if first}
        <figure class="plate">
          <div class="frame"><img src={first.thumb} alt={first.file.name} /></div>
          <figcaption>
            <code>{first.width} × {first.height}</code>
            <span>{formatBytes(first.file.size, mark)}</span>
            <span>{first.file.name}</span>
          </figcaption>
        </figure>
      {/if}
      {#each entries as e, i (e.file)}
        {@const done = jobs.get(e.file)}
        <FileRow
          name={e.file.name}
          thumb={e.thumb}
          meta={done?.value ? `${formatBytes(e.file.size, mark)} → ${formatBytes(done.value.output.blob.size, mark)}` : done?.error ? w('failed', { name: e.file.name }) : formatBytes(e.file.size, mark)}
          onremove={() => remove(i)}
        />
      {/each}
      <DropWell accept="image/*,.heic,.heif" multiple compact title={w('add')} onfiles={add} />
    {:else}
      <DropWell accept="image/*,.heic,.heif" multiple title={w('drop')} hint={w('dropHint')} onfiles={add} />
    {/if}
    {#each errors as err (err)}<p class="note bad" role="alert">{err}</p>{/each}
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('target')}</dt>
        <dd>
          <Seg
            label={w('target')}
            value={shared.sizeTarget}
            options={TARGETS.map((mb) => ({ value: mb, label: mb < 1 ? `${mb * 1000} KB` : `${mb} MB` }))}
            onchange={(v) => setShared('sizeTarget', v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('format')}</dt>
        <dd>
          <Seg
            label={w('format')}
            value={format === 'image/webp' ? 'webp' : 'jpg'}
            options={[
              { value: 'jpg', label: 'JPG' },
              { value: 'webp', label: 'WebP', disabled: !webpOk, title: webpOk ? undefined : w('noWebp') },
            ]}
            onchange={(v) => setShared('photoFormat', v, w('nowSaves', { format: v === 'webp' ? 'WebP' : 'JPG' }))}
          />
          <SharedNote chip="photo" />
          {#if !webpOk}<span class="note">{w('noWebp')}</span>{/if}
        </dd>
      </div>
      <div>
        <dt>{w('location')}</dt>
        <dd>
          <Check checked={shared.stripLocation} label={w('removeLocation')} onchange={(v) => setShared('stripLocation', v, v ? w('nowStrips') : w('nowKeeps'))} />
          <SharedNote chip="photo" />
        </dd>
      </div>
      {#if first}
        <div>
          <dt>{w('result')}</dt>
          <dd>
            {#if firstDone?.value}
              {@const out = firstDone.value.output}
              <div class="big">
                <b>{formatBytes(out.blob.size, mark)}</b>
                <s>{formatBytes(first.file.size, mark)}</s>
                {#if out.blob.size < first.file.size * 0.99}<em>{percent(first.file.size, out.blob.size)}</em>{/if}
              </div>
              <span class="note">{detail(first.file, firstDone.value)}</span>
            {:else if firstDone?.error}
              <span class="note bad" role="alert">{w('failed', { name: first.file.name })}</span>
            {:else}
              <span class="note" aria-live="polite">{w('working', { name: first.file.name })}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if entries.length}
      <SaveButton {outputs} busy={jobs.busy || adding > 0} zipName="photos-small" tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['resize', 'blur', 'topdf']} />
    {/if}
  </div>
</div>

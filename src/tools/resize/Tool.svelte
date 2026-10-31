<!--
  F-103 Resize & crop. "Size": a width and a height in pixels, the shape kept or not; several photos
  at once all fit the same box. "Crop": a frame on the photo, free or in a shape (1:1, 4:3, 3:2, 16:9,
  9:16, or a profile picture: square, 800 px), dragged and resized on the photo (CropFrame.svelte);
  each photo keeps its own frame. The result's size in pixels and on paper at 300 dpi; it's saved in
  the shared Photo format and quality, with the metadata as the location setting says.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { Crop, RotateCw } from '@lucide/svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import NumIn from '../../components/kit/NumIn.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import CropFrame from './CropFrame.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { ui } from '../../lib/prefs.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { decode, draw, encode, canEncode, preview, isPhoto, extOf, fit } from '../../lib/images.ts';
  import { formatBytes, kindOf, outName, type Kind } from '../../lib/files.ts';
  import { formatNumber, parseNumber } from '../../lib/numbers.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { PRESETS, preset, ratioOf, centred, snap, capped, sized, cropOutput, heightFor, widthFor, printSize, outType, MAX_SIDE, type PresetId, type Rect } from './resize.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a photo here, or choose one',
      dropHint: 'JPG, HEIC, PNG, WebP. Several at once for one size.',
      add: 'Add photos',
      mode: 'Do',
      size: 'Size',
      crop: 'Crop',
      width: 'Width',
      height: 'Height',
      keepShape: 'Keep the shape',
      keepHint: 'The height follows the width.',
      keepMany: 'Each photo fits inside this size, keeping its shape.',
      exactMany: 'Each photo becomes exactly this size.',
      badSize: 'Type a width and a height in pixels, up to {max}.',
      bigger: 'Bigger than the photo: it gets softer, not sharper.',
      shape: 'Shape',
      free: 'Free',
      profile: 'Profile picture',
      turn: 'Turn',
      turnHint: 'Upright or across',
      profileHint: 'Square, 800 px: what most sites show as your picture.',
      dragHint: 'Drag the frame, or its corners and sides.',
      cropThis: 'Crop this one: {name}',
      cropping: 'Cropping {name}',
      result: 'Result',
      print: 'On paper at 300 dpi: {w} × {h} {unit}',
      capped: 'Brought down to {w} × {h}: more than phones can draw.',
      small: 'Smaller than 800 px: kept at {n} px so it stays sharp.',
      saves: 'Saves',
      ownFormat: 'Each in its own format',
      quality: 'quality {q}',
      without: 'without place, camera, time',
      with: 'with place, camera, time',
      change: 'Change',
      notPhoto: '{name} isn’t a photo this browser can open.',
      working: 'Working on {name}…',
      reading: 'Reading the photo…',
      failed: 'Couldn’t resize {name}.',
      count: '{n} photos',
    },
    de: {
      drop: 'Ein Foto hier ablegen oder auswählen',
      dropHint: 'JPG, HEIC, PNG, WebP. Mehrere auf einmal für eine Größe.',
      add: 'Fotos dazu',
      mode: 'Tun',
      size: 'Größe',
      crop: 'Zuschnitt',
      width: 'Breite',
      height: 'Höhe',
      keepShape: 'Form behalten',
      keepHint: 'Die Höhe folgt der Breite.',
      keepMany: 'Jedes Foto passt in diese Größe und behält seine Form.',
      exactMany: 'Jedes Foto wird genau so groß.',
      badSize: 'Gib Breite und Höhe in Pixeln ein, bis {max}.',
      bigger: 'Größer als das Foto: es wird weicher, nicht schärfer.',
      shape: 'Form',
      free: 'Frei',
      profile: 'Profilbild',
      turn: 'Drehen',
      turnHint: 'Hoch oder quer',
      profileHint: 'Quadratisch, 800 px: wie die meisten Seiten dein Bild zeigen.',
      dragHint: 'Zieh den Rahmen, seine Ecken und Seiten.',
      cropThis: 'Dieses zuschneiden: {name}',
      cropping: '{name} wird zugeschnitten',
      result: 'Ergebnis',
      print: 'Auf Papier mit 300 dpi: {w} × {h} {unit}',
      capped: 'Auf {w} × {h} verkleinert: mehr können Handys nicht zeichnen.',
      small: 'Kleiner als 800 px: bleibt bei {n} px, damit es scharf bleibt.',
      saves: 'Speichert',
      ownFormat: 'Jedes im eigenen Format',
      quality: 'Qualität {q}',
      without: 'ohne Ort, Kamera, Zeit',
      with: 'mit Ort, Kamera, Zeit',
      change: 'Ändern',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      working: '{name} wird bearbeitet…',
      reading: 'Das Foto wird gelesen…',
      failed: '{name} ließ sich nicht ändern.',
      count: '{n} Fotos',
    },
  });

  // The way of working and the frame's shape are kept; sizes start from each photo's own.
  const o = remember('resize', { mode: 'size' as 'size' | 'crop', preset: 'free' as PresetId, turned: false, keep: true });

  interface Entry {
    file: File;
    kind: Kind;
    thumb: string;
    /** A bigger picture to crop on. */
    view: string;
    width: number;
    height: number;
    /** The frame as it's dragged, and as it was when the drag ended (what the result is made from). */
    crop: Rect;
    settled: Rect;
  }

  interface Made {
    output: Output;
    width: number;
    height: number;
  }

  let entries = $state<Entry[]>([]);
  let selected = $state(0);
  let adding = $state(0);
  let errors = $state<string[]>([]);
  let typedW = $state('');
  let typedH = $state('');
  let webpOk = $state(true);
  void canEncode('image/webp').then((ok) => (webpOk = ok));

  const mark = $derived(shared.decimal);
  const ratio = $derived(ratioOf(o.preset, o.turned));
  const current = $derived(entries[Math.min(selected, entries.length - 1)]);

  async function add(list: File[]) {
    errors = [];
    adding++;
    const fresh: Entry[] = [];
    for (const file of list) {
      try {
        if (!(await isPhoto(file))) throw new Error();
        const kind = await kindOf(file);
        const d = await decode(file);
        const big = fit(d.width, d.height, 1400, 1400);
        const view = preview((await encode(draw(d.bitmap, big.width, big.height, 'image/jpeg'), 'image/jpeg', 82, null, true)).blob).url;
        const small = fit(d.width, d.height, 240, 240);
        const thumb = preview((await encode(draw(d.bitmap, small.width, small.height, 'image/jpeg'), 'image/jpeg', 70, null, true)).blob).url;
        d.bitmap.close();
        const crop = centred(d.width, d.height, untrack(() => ratio));
        fresh.push({ file, kind, thumb, view, width: d.width, height: d.height, crop, settled: crop });
      } catch {
        errors = [...errors, w('notPhoto', { name: file.name })];
      }
    }
    // A first photo opens at its own size; a width typed while it was being read is kept.
    if (!entries.length && fresh.length) {
      const typed = parseNumber(typedW);
      const [fw, fh] = [fresh[0].width, fresh[0].height];
      typedW = valid(typed) ? String(typed) : String(fw);
      typedH = valid(typed) && o.keep ? String(heightFor(typed, fw, fh)) : valid(parseNumber(typedH)) ? typedH : String(fh);
      settledW = parseNumber(typedW);
      settledH = parseNumber(typedH);
    }
    entries = [...entries, ...fresh];
    adding--;
  }

  function remove(i: number) {
    URL.revokeObjectURL(entries[i].thumb);
    URL.revokeObjectURL(entries[i].view);
    results.delete(entries[i].file);
    entries = entries.filter((_, k) => k !== i);
    selected = Math.min(selected, Math.max(0, entries.length - 1));
    if (!entries.length) {
      typedW = '';
      typedH = '';
    }
  }

  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  // ── Size ──
  // Typed sizes count once typing pauses, so a 4K photo isn't encoded at every keystroke.
  let settledW = $state(NaN);
  let settledH = $state(NaN);
  $effect(() => {
    const wv = parseNumber(typedW);
    const hv = parseNumber(typedH);
    const t = setTimeout(() => {
      settledW = wv;
      settledH = hv;
    }, 300);
    return () => clearTimeout(t);
  });

  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_SIDE;
  const sizeOk = $derived(valid(parseNumber(typedW)) && valid(parseNumber(typedH)));

  // With one photo and its shape kept, the two sides move together. With several, each photo has
  // its own shape: the two numbers are a box each one fits inside.
  const linked = $derived(o.keep && entries.length === 1);

  function typeWidth(s: string) {
    typedW = s;
    const n = parseNumber(s);
    if (linked && current && Number.isFinite(n) && n > 0) typedH = String(heightFor(n, current.width, current.height));
  }

  function typeHeight(s: string) {
    typedH = s;
    const n = parseNumber(s);
    if (linked && current && Number.isFinite(n) && n > 0) typedW = String(widthFor(n, current.width, current.height));
  }

  function setKeep(v: boolean) {
    o.keep = v;
    // Back to the photo's shape from the width typed.
    if (v && current && entries.length === 1) typeWidth(typedW);
  }

  // ── Crop ──
  function choosePreset(id: PresetId) {
    o.preset = id;
    if (!preset(id).turns) o.turned = false;
    reframe();
  }

  function turn() {
    o.turned = !o.turned;
    reframe();
  }

  function reframe() {
    const r = ratioOf(o.preset, o.turned);
    entries = entries.map((e) => {
      const crop = centred(e.width, e.height, r);
      return { ...e, crop, settled: crop };
    });
  }

  function frameMoved(r: Rect) {
    const i = Math.min(selected, entries.length - 1);
    entries[i].crop = r;
  }

  function frameSettled() {
    const i = Math.min(selected, entries.length - 1);
    entries[i].settled = { ...entries[i].crop };
  }

  const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

  // ── What each photo becomes ──
  const format = (e: Entry) => outType(e.kind, shared.photoFormat, webpOk);

  /** The result's size for a photo, from its frame as it is right now (it follows a drag). */
  function plan(e: Entry, live: boolean) {
    if (o.mode === 'size') {
      const s = sized(e.width, e.height, settledW, settledH, o.keep);
      const c = capped(s.width, s.height);
      return { ...c, crop: undefined as Rect | undefined };
    }
    const frame = snap(live ? e.crop : e.settled, e.width, e.height, ratio);
    const out = cropOutput(frame, o.preset);
    const c = capped(out.width, out.height);
    return { ...c, crop: frame };
  }

  const keyOf = (e: Entry) => {
    const p = plan(e, false);
    return `${o.mode}|${p.width}x${p.height}|${p.crop ? `${p.crop.x},${p.crop.y},${p.crop.w},${p.crop.h}` : ''}|${format(e)}|${shared.quality}|${shared.stripLocation}|${shared.names}`;
  };

  const results = new SvelteMap<File, { key: string; value?: Made; error?: unknown }>();
  let busy = $state(false);
  // A decoded photo is kept while it's the one being cropped, so moving the frame doesn't decode again.
  let held: { file: File; bitmap: ImageBitmap } | null = null;

  async function bitmapOf(e: Entry): Promise<{ bitmap: ImageBitmap; keep: boolean }> {
    if (held?.file === e.file) return { bitmap: held.bitmap, keep: true };
    const d = await decode(e.file);
    if (e.file === untrack(() => current)?.file) {
      held?.bitmap.close();
      held = { file: e.file, bitmap: d.bitmap };
      return { bitmap: d.bitmap, keep: true };
    }
    return { bitmap: d.bitmap, keep: false };
  }

  $effect(() => {
    const ready = o.mode === 'crop' || (valid(settledW) && valid(settledH));
    const jobs = entries.map((e) => ({ e, key: keyOf(e), p: plan(e, false), type: format(e) }));
    const quality = shared.quality;
    const stripIt = shared.stripLocation;
    const names = shared.names;
    let cancelled = false;
    busy = ready && jobs.length > 0;
    if (!ready) return;
    (async () => {
      for (const job of jobs) {
        if (cancelled) return;
        if (untrack(() => results.get(job.e.file))?.key === job.key) continue;
        try {
          const { bitmap, keep } = await bitmapOf(job.e);
          try {
            if (cancelled) return;
            const canvas = draw(bitmap, job.p.width, job.p.height, job.type, job.p.crop);
            const out = await encode(canvas, job.type, quality, job.e.file, stripIt);
            const name = outName(job.e.file.name, `${job.p.width}x${job.p.height}`, extOf(out.type), names);
            if (!cancelled) results.set(job.e.file, { key: job.key, value: { output: { blob: out.blob, name }, width: job.p.width, height: job.p.height } });
          } finally {
            if (!keep) bitmap.close();
          }
        } catch (error) {
          if (!cancelled) results.set(job.e.file, { key: job.key, error });
        }
      }
      if (!cancelled) busy = false;
    })();
    return () => {
      cancelled = true;
    };
  });

  $effect(() => () => held?.bitmap.close());

  const resultOf = (e: Entry) => {
    const r = results.get(e.file);
    return r && r.key === keyOf(e) ? r : undefined;
  };

  const outputs = $derived.by((): Output[] | null => {
    if (adding || !entries.length) return null;
    // Nothing while a typed size or a moved frame hasn't settled yet: Save never hands out the last one.
    if (o.mode === 'size' && (!sizeOk || parseNumber(typedW) !== settledW || parseNumber(typedH) !== settledH)) return null;
    if (o.mode === 'crop' && entries.some((e) => !same(e.crop, e.settled))) return null;
    const out: Output[] = [];
    for (const e of entries) {
      const r = resultOf(e);
      if (!r?.value) return null;
      out.push(r.value.output);
    }
    return out;
  });

  const nextItems = $derived(outputs?.length ? outputs.map((x) => ({ file: new File([x.blob], x.name, { type: x.blob.type }) })) : null);

  const live = $derived(current ? plan(current, true) : null);
  const done = $derived(current ? resultOf(current) : undefined);
  const paper = $derived(live ? printSize(live.width, live.height, shared.units) : null);
  const num = (n: number) => formatNumber(n, mark, { max: 1 });
  const typeName = (t: string) => (t === 'image/png' ? 'PNG' : t === 'image/webp' ? 'WebP' : 'JPG');
  const enlarged = $derived(o.mode === 'size' && current && live ? live.width > current.width || live.height > current.height : false);
  const profileSmall = $derived(o.mode === 'crop' && o.preset === 'profile' && current && live?.crop ? live.crop.w < 800 : false);

  const savesLine = $derived.by(() => {
    const type = current ? format(current) : shared.photoFormat === 'same' ? null : outType('jpeg', shared.photoFormat, webpOk);
    const parts: string[] = [];
    parts.push(type ? typeName(type) : w('ownFormat'));
    if (type !== 'image/png') parts.push(w('quality', { q: shared.quality }));
    parts.push(shared.stripLocation ? w('without') : w('with'));
    return parts.join(' · ');
  });

  const presetLabel = (id: PresetId) => (id === 'free' ? w('free') : id === 'profile' ? w('profile') : o.turned && preset(id).turns ? id.split(':').reverse().join(':') : id);
</script>

<div class="body">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'size', label: w('size') },
      { value: 'crop', label: w('crop') },
    ] as { value: 'size' | 'crop'; label: string }[]}
    onchange={(v) => (o.mode = v)}
  />
  <div class="cols">
    <div class="stack">
      {#if current}
        {#if o.mode === 'crop'}
          <div class="work editor">
            <CropFrame src={current.view} width={current.width} height={current.height} rect={current.crop} {ratio} onchange={frameMoved} oncommit={frameSettled} />
          </div>
          <p class="note caption">
            <code>{current.width} × {current.height}</code>
            {#if live?.crop}<span>→ {live.crop.w} × {live.crop.h}{#if live.width !== live.crop.w} → {live.width} × {live.height}{/if}</span>{/if}
            <span>{entries.length > 1 ? w('cropping', { name: current.file.name }) : w('dragHint')}</span>
          </p>
        {:else}
          <figure class="plate">
            <div class="frame"><img src={current.view} alt={current.file.name} /></div>
            <figcaption>
              <code>{current.width} × {current.height}</code>
              <span>{formatBytes(current.file.size, mark)}</span>
              <span>{current.file.name}</span>
            </figcaption>
          </figure>
        {/if}
        {#if entries.length > 1}
          <h2 class="h">{w('count', { n: entries.length })}</h2>
          {#each entries as e, i (e.file)}
            {@const r = resultOf(e)}
            {@const p = plan(e, true)}
            <FileRow
              name={e.file.name}
              thumb={e.thumb}
              meta={r?.error ? w('failed', { name: e.file.name }) : `${e.width} × ${e.height} → ${p.width} × ${p.height}${r?.value ? ` · ${formatBytes(r.value.output.blob.size, mark)}` : ''}`}
              onremove={() => remove(i)}
            >
              {#snippet actions()}
                {#if o.mode === 'crop'}
                  <button type="button" class="pick" class:on={i === Math.min(selected, entries.length - 1)} aria-pressed={i === Math.min(selected, entries.length - 1)} aria-label={w('cropThis', { name: e.file.name })} title={w('crop')} onclick={() => (selected = i)}><Crop aria-hidden="true" /></button>
                {/if}
              {/snippet}
            </FileRow>
          {/each}
        {:else}
          <FileRow name={current.file.name} thumb={current.thumb} meta={`${formatBytes(current.file.size, mark)}${done?.value ? ` → ${formatBytes(done.value.output.blob.size, mark)}` : ''}`} onremove={() => remove(0)} />
        {/if}
        <DropWell accept="image/*,.heic,.heif" multiple compact title={w('add')} onfiles={add} />
      {:else}
        <DropWell accept="image/*,.heic,.heif" multiple title={w('drop')} hint={w('dropHint')} onfiles={add} />
      {/if}
      {#if adding}<p class="note" aria-live="polite">{w('reading')}</p>{/if}
      {#each errors as err (err)}<p class="note bad" role="alert">{err}</p>{/each}
    </div>

    <div class="stack">
      <dl class="spec">
        {#if o.mode === 'size'}
          <div>
            <dt>{w('size')}</dt>
            <dd>
              <div class="wh">
                <NumIn label={w('width')} value={typedW} size="mid" width="100%" unit="px" inputmode="numeric" oninput={typeWidth} />
                <span class="times" aria-hidden="true">×</span>
                <NumIn label={w('height')} value={typedH} size="mid" width="100%" unit="px" inputmode="numeric" oninput={typeHeight} />
              </div>
              <Check checked={o.keep} label={w('keepShape')} hint={entries.length > 1 ? undefined : w('keepHint')} onchange={setKeep} />
              {#if entries.length > 1}<span class="note">{o.keep ? w('keepMany') : w('exactMany')}</span>{/if}
              {#if entries.length && !sizeOk}<span class="note bad" role="alert">{w('badSize', { max: MAX_SIDE })}</span>{/if}
            </dd>
          </div>
        {:else}
          <div>
            <dt>{w('shape')}</dt>
            <dd>
              <Seg label={w('shape')} value={o.preset} options={PRESETS.map((p) => ({ value: p.id, label: presetLabel(p.id) }))} onchange={choosePreset} />
              {#if preset(o.preset).turns}
                <button type="button" class="btn small" onclick={turn} aria-pressed={o.turned} title={w('turnHint')}><RotateCw aria-hidden="true" />{w('turn')}</button>
              {/if}
              {#if o.preset === 'profile'}<span class="note">{w('profileHint')}</span>{/if}
            </dd>
          </div>
        {/if}
        {#if current && live}
          <div>
            <dt>{w('result')}</dt>
            <dd aria-live="polite">
              <div class="big"><b>{live.width} × {live.height}</b><span class="px">px</span></div>
              {#if paper}<span class="note">{w('print', { w: num(paper.w), h: num(paper.h), unit: paper.unit })}</span>{/if}
              {#if live.capped}<span class="note">{w('capped', { w: live.width, h: live.height })}</span>{/if}
              {#if enlarged}<span class="note">{w('bigger')}</span>{/if}
              {#if profileSmall && live.crop}<span class="note">{w('small', { n: live.crop.w })}</span>{/if}
              {#if done?.value}
                <span class="note m">{typeName(done.value.output.blob.type)} · {formatBytes(done.value.output.blob.size, mark)}</span>
              {:else if done?.error}
                <span class="note bad" role="alert">{w('failed', { name: current.file.name })}</span>
              {:else if busy}
                <span class="note">{w('working', { name: current.file.name })}</span>
              {/if}
            </dd>
          </div>
        {/if}
        <div>
          <dt>{w('saves')}</dt>
          <dd>
            <span class="note saves">
              {savesLine}
              <button type="button" class="link" onclick={() => (ui.settings = true)}>{w('change')}</button>
            </span>
            <SharedNote chip="photo" />
          </dd>
        </div>
      </dl>

      {#if entries.length}
        <SaveButton {outputs} busy={busy || adding > 0} zipName="photos-resized" tool={tool.id} />
        <NextTools items={nextItems} from={tool.id} prefer={['shrink', 'blur', 'topdf']} />
      {/if}
    </div>
  </div>
</div>

<style>
  .editor {
    padding: 22px;
    background: var(--sunk);
  }

  .caption {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: 12px;
  }

  .caption code {
    font-family: var(--mono);
    color: var(--ink);
  }

  .body {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .wh {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: baseline;
    gap: 10px;
    width: min(100%, 290px);
  }

  .times {
    font-size: 18px;
    color: var(--ink-2);
  }

  .px {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink-2);
  }

  .saves {
    display: inline;
  }

  .saves .link {
    margin-left: 6px;
    font-size: 13px;
    min-height: 40px;
  }

  .pick.on {
    background: var(--mark);
    color: var(--mark-ink);
  }

  .btn[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
  }
</style>

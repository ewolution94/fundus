<!--
  F-105 Blur parts: boxes drawn over a photo (BoxEditor.svelte), each pixelated in large blocks or
  blacked out, for good (blur.ts says why it's never a soft blur). The result is drawn at full size
  with every box applied and saved in the shared Photo format and quality, with the metadata as the
  location setting says. One photo at a time.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Plus, Trash2 } from '@lucide/svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import BoxEditor from './BoxEditor.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { ui } from '../../lib/prefs.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { decode, draw, encode, canEncode, preview, isPhoto, extOf, fit, targetType } from '../../lib/images.ts';
  import { formatBytes, kindOf, outName, type Kind } from '../../lib/files.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { blockPx, pixelate, region, middleBox, boxesKey, type Box, type BlockSize, type Region, type Style } from './blur.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a photo here, or choose one',
      dropHint: 'JPG, HEIC, PNG, WebP. A screenshot works too.',
      oneAtATime: 'One photo at a time: {name} is open.',
      hint: 'Drag on the photo to cover a part. Drag a box to move it, its corners to resize it.',
      hide: 'Hide with',
      pixelate: 'Pixelate',
      black: 'Black out',
      forBox: 'For the chosen box, and new ones.',
      forNew: 'For new boxes.',
      blocks: 'Blocks',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      blocksHint: 'Each block is one flat colour: what was under it can’t be brought back.',
      boxes: 'Boxes',
      none: 'None yet: drag on the photo.',
      nBoxes: '{n} boxes',
      oneBox: '1 box',
      addBox: 'Add a box',
      removeBox: 'Remove this box',
      result: 'Result',
      saves: 'Saves',
      quality: 'quality {q}',
      without: 'without place, camera, time',
      with: 'with place, camera, time',
      change: 'Change',
      notPhoto: '{name} isn’t a photo this browser can open.',
      working: 'Hiding it…',
      reading: 'Reading the photo…',
      failed: 'Couldn’t save {name}.',
    },
    de: {
      drop: 'Ein Foto hier ablegen oder auswählen',
      dropHint: 'JPG, HEIC, PNG, WebP. Ein Bildschirmfoto geht auch.',
      oneAtATime: 'Ein Foto nach dem anderen: {name} ist offen.',
      hint: 'Zieh auf dem Foto, um eine Stelle abzudecken. Zieh ein Feld, um es zu verschieben, an den Ecken für die Größe.',
      hide: 'Verbergen mit',
      pixelate: 'Verpixeln',
      black: 'Schwärzen',
      forBox: 'Für das gewählte Feld und neue.',
      forNew: 'Für neue Felder.',
      blocks: 'Blöcke',
      small: 'Klein',
      medium: 'Mittel',
      large: 'Groß',
      blocksHint: 'Jeder Block ist eine Farbe: was darunter war, lässt sich nicht zurückholen.',
      boxes: 'Felder',
      none: 'Noch keins: zieh auf dem Foto.',
      nBoxes: '{n} Felder',
      oneBox: '1 Feld',
      addBox: 'Feld hinzufügen',
      removeBox: 'Dieses Feld entfernen',
      result: 'Ergebnis',
      saves: 'Speichert',
      quality: 'Qualität {q}',
      without: 'ohne Ort, Kamera, Zeit',
      with: 'mit Ort, Kamera, Zeit',
      change: 'Ändern',
      notPhoto: '{name} ist kein Foto, das dieser Browser öffnen kann.',
      working: 'Wird verborgen…',
      reading: 'Das Foto wird gelesen…',
      failed: '{name} ließ sich nicht speichern.',
    },
  });

  // How boxes hide and how coarse the blocks are, kept; the boxes themselves are not.
  const o = remember('blur', { style: 'pixelate' as Style, blocks: 'large' as BlockSize });

  interface Photo {
    file: File;
    kind: Kind;
    thumb: string;
    /** Full size, for the result. */
    bitmap: ImageBitmap;
    /** Small enough to redraw at every move. */
    base: ImageBitmap;
    width: number;
    height: number;
  }

  let photo = $state.raw<Photo | null>(null);
  let boxes = $state<Box[]>([]);
  /** The boxes as they were when the last drag or run of keys ended: what the result is made from. */
  let settled = $state<Box[]>([]);
  let chosen = $state<number | null>(null);
  let nextId = 1;
  let adding = $state(false);
  let errors = $state<string[]>([]);
  let webpOk = $state(true);
  void canEncode('image/webp').then((ok) => (webpOk = ok));

  const mark = $derived(shared.decimal);

  async function open(list: File[]) {
    errors = [];
    const file = list[0];
    if (!file) return;
    if (list.length > 1) errors = [w('oneAtATime', { name: file.name })];
    adding = true;
    try {
      if (!(await isPhoto(file))) throw new Error();
      const kind = await kindOf(file);
      const d = await decode(file);
      const small = fit(d.width, d.height, 1400, 1400);
      const base = await createImageBitmap(draw(d.bitmap, small.width, small.height, 'image/png'));
      const t = fit(d.width, d.height, 240, 240);
      const thumb = preview((await encode(draw(d.bitmap, t.width, t.height, 'image/jpeg'), 'image/jpeg', 70, null, true)).blob).url;
      close();
      photo = { file, kind, thumb, bitmap: d.bitmap, base, width: d.width, height: d.height };
      boxes = [];
      settled = [];
      chosen = null;
    } catch {
      errors = [...errors, w('notPhoto', { name: file.name })];
    } finally {
      adding = false;
    }
  }

  function close() {
    if (!photo) return;
    photo.bitmap.close();
    photo.base.close();
    URL.revokeObjectURL(photo.thumb);
    photo = null;
    boxes = [];
    settled = [];
    chosen = null;
  }

  $effect(() => () => close());

  const given = untrack(() => filesOf(items));
  if (given.length) void open(given);

  const chosenBox = $derived(boxes.find((b) => b.id === chosen) ?? null);

  function settle() {
    settled = boxes.map((b) => ({ ...b }));
  }

  function drawn(r: Region): number {
    const id = nextId++;
    boxes = [...boxes, { id, ...r, style: o.style }];
    chosen = id;
    return id;
  }

  function addBox() {
    if (!photo) return;
    drawn(middleBox(photo.width, photo.height));
    settle();
  }

  function removeBox(id: number) {
    boxes = boxes.filter((b) => b.id !== id);
    if (chosen === id) chosen = null;
    settle();
  }

  function setStyle(s: Style) {
    o.style = s;
    if (chosen !== null) {
      boxes = boxes.map((b) => (b.id === chosen ? { ...b, style: s } : b));
      settle();
    }
  }

  const block = $derived(photo ? blockPx(photo.width, photo.height, o.blocks) : 0);
  const type = $derived.by(() => {
    if (!photo) return 'image/jpeg';
    const t = targetType(photo.kind, shared.photoFormat);
    return t === 'image/webp' && !webpOk ? 'image/jpeg' : t;
  });

  // The result, made once the boxes settle: the full photo with every box applied.
  const key = $derived(photo ? `${boxesKey(settled)}|${block}|${type}|${shared.quality}|${shared.stripLocation}|${shared.names}` : '');
  let made = $state.raw<{ key: string; output: Output } | null>(null);
  let busy = $state(false);
  let failed = $state(false);

  $effect(() => {
    const k = key;
    const p = photo;
    const list = settled.map((b) => ({ ...b }));
    const blk = block;
    const t = type;
    const quality = shared.quality;
    const stripIt = shared.stripLocation;
    const names = shared.names;
    failed = false;
    if (!p || !list.length) {
      busy = false;
      return;
    }
    let cancelled = false;
    busy = true;
    // A moment's wait: a run of changes makes one result, not one each.
    const timer = setTimeout(async () => {
      try {
        const canvas = draw(p.bitmap, p.width, p.height, t);
        const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        for (const b of list) {
          const r = region(b, p.width, p.height);
          if (!r.w || !r.h) continue;
          if (b.style === 'black') {
            ctx.fillStyle = '#000';
            ctx.fillRect(r.x, r.y, r.w, r.h);
          } else {
            const data = ctx.getImageData(r.x, r.y, r.w, r.h);
            pixelate(data.data, r.w, r.h, blk);
            ctx.putImageData(data, r.x, r.y);
          }
          if (cancelled) return;
        }
        const out = await encode(canvas, t, quality, p.file, stripIt);
        if (cancelled) return;
        made = { key: k, output: { blob: out.blob, name: outName(p.file.name, 'blurred', extOf(out.type), names) } };
      } catch {
        if (!cancelled) failed = true;
      } finally {
        if (!cancelled) busy = false;
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const current = $derived(made && made.key === key && boxesKey(boxes) === boxesKey(settled) ? made.output : null);
  const outputs = $derived(current && settled.length ? [current] : null);
  const nextItems = $derived(current ? [{ file: new File([current.blob], current.name, { type: current.blob.type }) }] : null);

  const typeName = (t: string) => (t === 'image/png' ? 'PNG' : t === 'image/webp' ? 'WebP' : 'JPG');
  const savesLine = $derived.by(() => {
    const parts = [typeName(type)];
    if (type !== 'image/png') parts.push(w('quality', { q: shared.quality }));
    parts.push(shared.stripLocation ? w('without') : w('with'));
    return parts.join(' · ');
  });
</script>

<div class="cols">
  <div class="stack">
    {#if photo}
      <div class="work editor">
        <BoxEditor
          base={photo.base}
          width={photo.width}
          height={photo.height}
          {boxes}
          {chosen}
          {block}
          ondraw={drawn}
          onchange={(next) => (boxes = next)}
          onchoose={(id) => (chosen = id)}
          onremove={removeBox}
          oncommit={settle}
        />
      </div>
      <div class="bar">
        {#if chosenBox}
          <button type="button" class="btn small" onclick={() => removeBox(chosenBox.id)}><Trash2 aria-hidden="true" />{w('removeBox')}</button>
        {:else}
          <p class="note">{w('hint')}</p>
        {/if}
      </div>
      <FileRow name={photo.file.name} thumb={photo.thumb} meta={`${photo.width} × ${photo.height} · ${formatBytes(photo.file.size, mark)}`} onremove={close} />
      <DropWell accept="image/*,.heic,.heif" compact title={w('drop')} onfiles={open} />
    {:else}
      <DropWell accept="image/*,.heic,.heif" title={w('drop')} hint={w('dropHint')} onfiles={open} />
    {/if}
    {#if adding}<p class="note" aria-live="polite">{w('reading')}</p>{/if}
    {#each errors as err (err)}<p class="note bad" role="alert">{err}</p>{/each}
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('hide')}</dt>
        <dd>
          <Seg
            label={w('hide')}
            value={chosenBox?.style ?? o.style}
            options={[
              { value: 'pixelate', label: w('pixelate') },
              { value: 'black', label: w('black') },
            ] as { value: Style; label: string }[]}
            onchange={setStyle}
          />
          <span class="note">{chosenBox ? w('forBox') : w('forNew')}</span>
        </dd>
      </div>
      <div>
        <dt>{w('blocks')}</dt>
        <dd>
          <Seg
            label={w('blocks')}
            value={o.blocks}
            options={[
              { value: 'small', label: w('small') },
              { value: 'medium', label: w('medium') },
              { value: 'large', label: w('large') },
            ] as { value: BlockSize; label: string }[]}
            onchange={(v) => (o.blocks = v)}
          />
          <span class="note">{w('blocksHint')}{photo ? ` (${block} px)` : ''}</span>
        </dd>
      </div>
      {#if photo}
        <div>
          <dt>{w('boxes')}</dt>
          <dd>
            <span class="count">{boxes.length === 0 ? w('none') : boxes.length === 1 ? w('oneBox') : w('nBoxes', { n: boxes.length })}</span>
            <button type="button" class="btn small" onclick={addBox}><Plus aria-hidden="true" />{w('addBox')}</button>
          </dd>
        </div>
        {#if settled.length}
          <div>
            <dt>{w('result')}</dt>
            <dd aria-live="polite">
              {#if current}
                <span class="note m">{photo.width} × {photo.height} · {typeName(current.blob.type)} · {formatBytes(current.blob.size, mark)}</span>
              {:else if failed}
                <span class="note bad" role="alert">{w('failed', { name: photo.file.name })}</span>
              {:else}
                <span class="note">{w('working')}</span>
              {/if}
            </dd>
          </div>
        {/if}
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
      <SaveButton {outputs} busy={busy || adding} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['shrink', 'resize', 'topdf']} />
    {/if}
  </div>
</div>

<style>
  .editor {
    padding: 22px;
    background: var(--sunk);
  }

  .bar {
    display: flex;
    align-items: center;
    min-height: 40px;
  }

  .bar .btn {
    min-height: 40px;
  }

  .count {
    font-size: 15px;
    font-weight: 600;
  }

  .change {
    margin-left: 6px;
    font-size: 13px;
  }
</style>

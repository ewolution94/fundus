<!--
  F-109 Screenshot frame: a screenshot on a ground (six gradients, two colours from its own top and
  bottom edges, one colour, or none), with padding, rounded corners, a shadow, and a frame drawn
  here (a plain browser window or phone, nobody's artwork); at its own size or fitted to 16:9, 1:1
  or 4:5 (frame.ts). The screenshot keeps its own pixels; the result is a PNG (sharp text,
  transparency) or a JPG on a ground. One picture at a time; nothing about it is kept.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SharedNote from '../../components/kit/SharedNote.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import Grounds from './Grounds.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { ui } from '../../lib/prefs.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { decode, draw, encode, preview, isPhoto, extOf, fit, makeCanvas } from '../../lib/images.ts';
  import { formatBytes, outName } from '../../lib/files.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import {
    layout,
    edgeColours,
    groundPaint,
    isLight,
    chrome,
    GRADIENTS,
    PHONE,
    SAFE_AREA,
    type Layout,
    type Options,
    type Paint,
    type Radii,
    type Rect,
    type RGB,
    type GroundId,
    type Pad,
    type Corners,
    type Shadow,
    type Device,
    type Shape,
  } from './frame.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a screenshot here, or choose one',
      dropHint: 'PNG, JPG, HEIC, WebP. Any picture works.',
      another: 'Use another picture',
      oneAtATime: 'One picture at a time: {name} is open.',
      ground: 'Ground',
      paper: 'Paper',
      ink: 'Ink',
      highlighter: 'Highlighter',
      dusk: 'Dusk',
      sea: 'Sea',
      mint: 'Mint',
      picture: 'From the picture',
      colour: 'Colour',
      none: 'None',
      noCorners: 'None',
      pickColour: 'The ground’s colour',
      pictureNote: 'Its top and bottom edges, as a gradient.',
      noneNote: 'See-through: saved as a PNG.',
      padding: 'Padding',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      corners: 'Corners',
      shadow: 'Shadow',
      soft: 'Soft',
      strong: 'Strong',
      frame: 'Frame',
      browser: 'Browser',
      phone: 'Phone',
      size: 'Size',
      asIs: 'As is',
      format: 'Format',
      jpgNone: 'A JPG can’t be see-through: choose a ground for JPG.',
      pngNote: 'Sharp text, and see-through where there’s no ground.',
      quality: 'quality {q}',
      change: 'Change',
      result: 'Result',
      smaller: 'Made smaller to {w} × {h}: bigger than this browser draws.',
      notPicture: '{name} isn’t a picture this browser can open.',
      reading: 'Reading the picture…',
      working: 'Framing it…',
      failed: 'Couldn’t frame it.',
      preview: 'Preview of the framed screenshot',
    },
    de: {
      drop: 'Screenshot hier ablegen oder auswählen',
      dropHint: 'PNG, JPG, HEIC, WebP. Jedes Bild geht.',
      another: 'Anderes Bild nehmen',
      oneAtATime: 'Ein Bild nach dem anderen: {name} ist offen.',
      ground: 'Grund',
      paper: 'Papier',
      ink: 'Tinte',
      highlighter: 'Textmarker',
      dusk: 'Abend',
      sea: 'Meer',
      mint: 'Minze',
      picture: 'Aus dem Bild',
      colour: 'Farbe',
      none: 'Keiner',
      noCorners: 'Keine',
      pickColour: 'Farbe des Grunds',
      pictureNote: 'Seine obere und untere Kante, als Verlauf.',
      noneNote: 'Durchsichtig: wird als PNG gespeichert.',
      padding: 'Abstand',
      small: 'Klein',
      medium: 'Mittel',
      large: 'Groß',
      corners: 'Ecken',
      shadow: 'Schatten',
      soft: 'Weich',
      strong: 'Kräftig',
      frame: 'Rahmen',
      browser: 'Browser',
      phone: 'Handy',
      size: 'Größe',
      asIs: 'Wie es ist',
      format: 'Format',
      jpgNone: 'Ein JPG kann nicht durchsichtig sein: wähl für JPG einen Grund.',
      pngNote: 'Scharfer Text, und durchsichtig, wo kein Grund ist.',
      quality: 'Qualität {q}',
      change: 'Ändern',
      result: 'Ergebnis',
      smaller: 'Auf {w} × {h} verkleinert: größer zeichnet dieser Browser nicht.',
      notPicture: '{name} ist kein Bild, das dieser Browser öffnen kann.',
      reading: 'Das Bild wird gelesen…',
      working: 'Wird gerahmt…',
      failed: 'Das Rahmen hat nicht geklappt.',
      preview: 'Vorschau des gerahmten Screenshots',
    },
  });

  // Every choice is kept; the picture is not.
  const o = remember('frame', {
    ground: 'paper' as GroundId,
    colour: '#d9e4f2',
    pad: 'medium' as Pad,
    corners: 'medium' as Corners,
    shadow: 'soft' as Shadow,
    device: 'none' as Device,
    shape: 'as-is' as Shape,
    format: 'png' as 'png' | 'jpg',
  });

  interface Picture {
    id: number;
    file: File;
    thumb: string;
    bitmap: ImageBitmap;
    /** Small enough to redraw at every change. */
    base: ImageBitmap;
    width: number;
    height: number;
    edges: { top: RGB | null; bottom: RGB | null };
  }

  let picture = $state.raw<Picture | null>(null);
  let opened = 0;
  let reading = $state(false);
  let errors = $state<string[]>([]);
  let view = $state<HTMLCanvasElement>();

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
      const small = fit(d.width, d.height, 1400, 1400);
      const base = await createImageBitmap(draw(d.bitmap, small.width, small.height, 'image/png'));
      // The edges' colours from a copy a few hundred pixels wide (each of its rows is a few of the picture's).
      const probe = fit(d.width, d.height, 256, 256);
      const pc = draw(d.bitmap, probe.width, probe.height, 'image/png');
      const data = (pc.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D).getImageData(0, 0, pc.width, pc.height).data;
      const edges = edgeColours(data, pc.width, pc.height, 2);
      const t = fit(d.width, d.height, 240, 240);
      const thumb = preview((await encode(draw(d.bitmap, t.width, t.height, 'image/png'), 'image/png', 100, null, true)).blob).url;
      close();
      picture = { id: ++opened, file, thumb, bitmap: d.bitmap, base, width: d.width, height: d.height, edges };
    } catch {
      errors = [...errors, w('notPicture', { name: file.name })];
    } finally {
      reading = false;
    }
  }

  function close() {
    const p = untrack(() => picture);
    if (!p) return;
    p.bitmap.close();
    p.base.close();
    URL.revokeObjectURL(p.thumb);
    picture = null;
  }

  $effect(() => () => close());

  const given = untrack(() => filesOf(items));
  if (given.length) void open(given);

  // ── What it looks like ──
  const options = $derived<Options>({ pad: o.pad, corners: o.corners, shadow: o.shadow, device: o.device, shape: o.shape });
  const ground = $derived(groundPaint(o.ground, picture?.edges ?? null, o.colour));
  const type = $derived(o.format === 'jpg' && ground ? 'image/jpeg' : 'image/png');
  const plan = $derived(picture ? layout(picture.width, picture.height, options) : null);

  type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  function rounded(ctx: Ctx, r: Rect, radii: Radii, inset = 0) {
    ctx.beginPath();
    ctx.roundRect(r.x + inset, r.y + inset, Math.max(0, r.w - 2 * inset), Math.max(0, r.h - 2 * inset), radii.map((q) => Math.max(0, q - inset)));
  }

  /** The picture at `k` times the layout's size. Shadows don't follow the canvas's scale, so they're scaled by hand. */
  function paint(ctx: Ctx, l: Layout, source: CanvasImageSource, k: number, g: Paint | null) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, l.width, l.height);
    if (g) {
      if (g.from === g.to) ctx.fillStyle = g.from;
      else {
        const grad = g.vertical ? ctx.createLinearGradient(0, 0, 0, l.height) : ctx.createLinearGradient(0, 0, l.width, l.height);
        grad.addColorStop(0, g.from);
        grad.addColorStop(1, g.to);
        ctx.fillStyle = grad;
      }
      ctx.fillRect(0, 0, l.width, l.height);
    }
    const bar = chrome(isLight(g));
    const fill = l.bezel ? PHONE.body : l.bar ? bar.bar : '#ffffff';
    if (l.shadow) {
      // Cast by the body's shape, a device pixel inside it, so no edge of it shows past the picture.
      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${l.shadow.alpha})`;
      ctx.shadowBlur = l.shadow.blur * k;
      ctx.shadowOffsetY = l.shadow.offsetY * k;
      ctx.fillStyle = fill;
      rounded(ctx, l.body, l.bodyRadii, 1 / k);
      ctx.fill();
      ctx.restore();
    }
    if (l.bezel) {
      ctx.fillStyle = PHONE.body;
      rounded(ctx, l.body, l.bodyRadii);
      ctx.fill();
      // A rim of light round the edge, and a lens in the top bezel.
      const rim = Math.max(1, l.bezel * 0.14);
      ctx.strokeStyle = PHONE.rim;
      ctx.lineWidth = rim;
      rounded(ctx, l.body, l.bodyRadii, rim / 2);
      ctx.stroke();
      ctx.fillStyle = PHONE.lens;
      ctx.beginPath();
      ctx.arc(l.body.x + l.body.w / 2, l.body.y + l.bezel / 2, l.bezel * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (l.bar) {
      ctx.fillStyle = bar.bar;
      rounded(ctx, l.bar.rect, l.bar.radii);
      ctx.fill();
      ctx.fillStyle = bar.dot;
      for (const d of l.bar.dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = bar.pill;
      ctx.beginPath();
      ctx.roundRect(l.bar.pill.x, l.bar.pill.y, l.bar.pill.w, l.bar.pill.h, l.bar.pill.h / 2);
      ctx.fill();
    }
    ctx.save();
    rounded(ctx, l.shot, l.shotRadii);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, l.shot.x, l.shot.y, l.shot.w, l.shot.h);
    ctx.restore();
  }

  // The preview follows every change at once, from the small copy.
  $effect(() => {
    const p = picture;
    const canvas = view;
    const l = plan;
    const g = ground;
    if (!p || !canvas || !l) return;
    const frame = requestAnimationFrame(() => {
      const k = Math.min(1, 1200 / Math.max(l.width, l.height));
      canvas.width = Math.max(1, Math.round(l.width * k));
      canvas.height = Math.max(1, Math.round(l.height * k));
      paint(canvas.getContext('2d')!, l, p.base, k, g);
    });
    return () => cancelAnimationFrame(frame);
  });

  // ── The result ──
  /** A canvas this big, if the browser draws one (iPhones stop at about 16 million pixels). */
  function canvasFor(width: number, height: number) {
    try {
      const canvas = makeCanvas(width, height);
      const ctx = canvas.getContext('2d') as Ctx | null;
      if (!ctx) return null;
      ctx.fillStyle = '#000';
      ctx.fillRect(width - 1, height - 1, 1, 1);
      if (ctx.getImageData(width - 1, height - 1, 1, 1).data[3] !== 255) return null;
      ctx.clearRect(width - 1, height - 1, 1, 1);
      return { canvas, ctx };
    } catch {
      return null;
    }
  }

  const keyOf = () => JSON.stringify([picture?.id, options, ground, type, shared.quality, shared.names]);
  let made = $state.raw<{ key: string; output: Output; width: number; height: number; scale: number } | null>(null);
  let busy = $state(false);
  let failed = $state(false);

  $effect(() => {
    const p = picture;
    const opts = options;
    const g = ground;
    const t = type;
    const quality = shared.quality;
    const names = shared.names;
    const k = keyOf();
    failed = false;
    if (!p) {
      busy = false;
      return;
    }
    let cancelled = false;
    busy = true;
    // A moment's wait: a colour being dragged makes one result, not one per step.
    const timer = setTimeout(async () => {
      let drawn: { canvas: ReturnType<typeof makeCanvas>; ctx: Ctx } | null = null;
      try {
        let l = layout(p.width, p.height, opts);
        drawn = canvasFor(l.width, l.height);
        if (!drawn) {
          l = layout(p.width, p.height, opts, { maxArea: SAFE_AREA });
          drawn = canvasFor(l.width, l.height);
        }
        if (!drawn) throw new Error('Too big');
        paint(drawn.ctx, l, p.bitmap, 1, g);
        const enc = await encode(drawn.canvas, t, quality, null, true);
        if (cancelled) return;
        made = { key: k, output: { blob: enc.blob, name: outName(p.file.name, 'framed', extOf(enc.type), names) }, width: l.width, height: l.height, scale: l.scale };
      } catch {
        if (!cancelled) failed = true;
      } finally {
        if (drawn) {
          drawn.canvas.width = 0;
          drawn.canvas.height = 0;
        }
        if (!cancelled) busy = false;
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const current = $derived(made && made.key === keyOf() ? made : null);
  const outputs = $derived(current ? [current.output] : null);
  const nextItems = $derived(current ? [{ file: new File([current.output.blob], current.output.name, { type: current.output.blob.type }) }] : null);

  const groundOptions = $derived(
    [
      ...GRADIENTS.map((g) => ({ id: g.id, label: w(g.id as 'paper'), paint: groundPaint(g.id, null, '') })),
      { id: 'picture' as GroundId, label: w('picture'), paint: picture ? groundPaint('picture', picture.edges, '') : null, empty: !picture },
      { id: 'colour' as GroundId, label: w('colour'), paint: groundPaint('colour', null, o.colour) },
      { id: 'none' as GroundId, label: w('none'), paint: null },
    ],
  );
  const groundName = $derived(groundOptions.find((g) => g.id === o.ground)?.label ?? '');
</script>

<div class="cols">
  <div class="stack">
    {#if picture}
      <figure class="plate">
        <div class="frame" role="img" aria-label={w('preview')}><canvas bind:this={view} class:see-through={!ground}></canvas></div>
        <figcaption>
          <code>{plan ? `${plan.width} × ${plan.height}` : ''}</code>
          <span>{picture.file.name}</span>
        </figcaption>
      </figure>
      <FileRow name={picture.file.name} thumb={picture.thumb} meta={`${picture.width} × ${picture.height} · ${formatBytes(picture.file.size, mark)}`} onremove={close} />
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
        <dt>{w('ground')}</dt>
        <dd>
          <Grounds label={w('ground')} options={groundOptions} value={o.ground} onchange={(v) => (o.ground = v)} />
          <span class="note"><b class="name">{groundName}</b>{#if o.ground === 'picture'} · {w('pictureNote')}{:else if o.ground === 'none'} · {w('noneNote')}{/if}</span>
          {#if o.ground === 'colour'}
            <div class="colour">
              <input type="color" class="well-colour" value={/^#[0-9a-f]{6}$/i.test(o.colour) ? o.colour : '#ffffff'} aria-label={w('pickColour')} oninput={(e) => (o.colour = e.currentTarget.value)} />
              <code class="m">{o.colour.toUpperCase()}</code>
            </div>
          {/if}
        </dd>
      </div>
      <div>
        <dt>{w('padding')}</dt>
        <dd>
          <Seg
            label={w('padding')}
            value={o.pad}
            options={[
              { value: 'small', label: w('small') },
              { value: 'medium', label: w('medium') },
              { value: 'large', label: w('large') },
            ] as { value: Pad; label: string }[]}
            onchange={(v) => (o.pad = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('corners')}</dt>
        <dd>
          <Seg
            label={w('corners')}
            value={o.corners}
            options={[
              { value: 'none', label: w('noCorners') },
              { value: 'small', label: w('small') },
              { value: 'medium', label: w('medium') },
              { value: 'large', label: w('large') },
            ] as { value: Corners; label: string }[]}
            onchange={(v) => (o.corners = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('shadow')}</dt>
        <dd>
          <Seg
            label={w('shadow')}
            value={o.shadow}
            options={[
              { value: 'none', label: w('none') },
              { value: 'soft', label: w('soft') },
              { value: 'strong', label: w('strong') },
            ] as { value: Shadow; label: string }[]}
            onchange={(v) => (o.shadow = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('frame')}</dt>
        <dd>
          <Seg
            label={w('frame')}
            value={o.device}
            options={[
              { value: 'none', label: w('none') },
              { value: 'browser', label: w('browser') },
              { value: 'phone', label: w('phone') },
            ] as { value: Device; label: string }[]}
            onchange={(v) => (o.device = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('size')}</dt>
        <dd>
          <Seg
            label={w('size')}
            value={o.shape}
            options={[
              { value: 'as-is', label: w('asIs') },
              { value: '16:9', label: '16:9' },
              { value: '1:1', label: '1:1' },
              { value: '4:5', label: '4:5' },
            ] as { value: Shape; label: string }[]}
            onchange={(v) => (o.shape = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('format')}</dt>
        <dd>
          <Seg
            label={w('format')}
            value={type === 'image/jpeg' ? 'jpg' : 'png'}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpg', label: 'JPG', disabled: !ground, title: ground ? undefined : w('jpgNone') },
            ] as { value: 'png' | 'jpg'; label: string; disabled?: boolean; title?: string }[]}
            onchange={(v) => (o.format = v)}
          />
          {#if type === 'image/jpeg'}
            <span class="note">{w('quality', { q: shared.quality })} <button type="button" class="link change" onclick={() => (ui.settings = true)}>{w('change')}</button></span>
            <SharedNote chip="photo" />
          {:else if !ground && o.format === 'jpg'}
            <span class="note">{w('jpgNone')}</span>
          {:else}
            <span class="note">{w('pngNote')}</span>
          {/if}
        </dd>
      </div>
      {#if picture && plan}
        <div>
          <dt>{w('result')}</dt>
          <dd aria-live="polite">
            <div class="big"><b>{current ? current.width : plan.width} × {current ? current.height : plan.height}</b><span class="px">px</span></div>
            {#if current}
              <span class="note m">{current.output.blob.type === 'image/jpeg' ? 'JPG' : 'PNG'} · {formatBytes(current.output.blob.size, mark)}</span>
              {#if current.scale < 1}<span class="note">{w('smaller', { w: current.width, h: current.height })}</span>{/if}
            {:else if failed}
              <span class="note bad" role="alert">{w('failed')}</span>
            {:else}
              <span class="note">{w('working')}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if picture}
      <SaveButton {outputs} busy={busy || reading} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['shrink', 'topdf', 'convert']} />
    {/if}
  </div>
</div>

<style>
  .see-through {
    background: repeating-conic-gradient(var(--sunk) 0 25%, var(--card) 0 50%) 0 0 / 16px 16px;
  }

  .name {
    font-weight: 600;
    color: var(--ink);
  }

  .colour {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .well-colour {
    width: 44px;
    height: 40px;
    padding: 2px;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    background: var(--card);
    cursor: pointer;
  }

  .well-colour::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .well-colour::-webkit-color-swatch {
    border: 0;
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

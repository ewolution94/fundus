<!--
  F-202 Sign a PDF: make a signature (drawn on the pad, or a typed name in a handwriting face), put
  it on the pages (dragged into place, the corner resizes it), with the date and the name as text if
  wanted, as often as needed. Save writes them into the PDF with pdf-lib, everything else untouched;
  the signed file is ready before Save is tapped. Only the signature's picture can be kept, and only
  when asked.
-->
<script lang="ts">
  import { untrack, onDestroy, tick } from 'svelte';
  import { ChevronLeft, ChevronRight, Undo2, Eraser, X, PenLine, CalendarDays, User } from '@lucide/svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes, outName } from '../../lib/files.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { readPdf, problemOf, closePdf, pageInfos, drawPage, canvasBlob, release, type Opened, type PageInfo } from '../../lib/pdfpages.ts';
  import { clampBox, heightFor, formatDate, LINE, type Stroke } from './sign.ts';
  import { stamp, type Mark } from './stamp.ts';
  import { INKS, HAND, strokesPicture, textPicture, tinted, textWidthPerPt, type Ink, type Picture } from './ink.ts';
  import { loadKept, keep, forget } from './keep.ts';
  import Pad from './Pad.svelte';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a PDF here, or choose one',
      dropHint: 'Sign it, add the date, save it.',
      another: 'Open another PDF',
      notPdf: '{name} isn’t a PDF.',
      locked: '{name} is locked with a password. Open it, save a copy without one, and try that.',
      broken: '{name} is damaged: this PDF can’t be read.',
      noChanges: '{name} is protected against changes, so it can’t be signed here.',
      writeFailed: 'The signed PDF couldn’t be written.',
      'count.one': '{n} page',
      'count.other': '{n} pages',
      signature: 'Signature',
      draw: 'Draw',
      type: 'Type',
      pad: 'Signing pad: draw your signature',
      undoStroke: 'Undo the last stroke',
      clear: 'Clear',
      keptShown: 'Your kept signature. Draw to make a new one.',
      yourName: 'Your name',
      typeHint: 'Type your name: it’s set in handwriting.',
      ink: 'Ink',
      black: 'Black',
      blue: 'Blue',
      keepLabel: 'Keep',
      keep: 'Keep my signature on this device',
      keepHint: 'Only its picture, in this browser. Nothing else is kept.',
      kept: 'Kept on this device.',
      forget: 'Forget it',
      forgotten: 'Forgotten.',
      keepFailed: 'This browser won’t keep it (a private window?).',
      name: 'Name',
      nameHint: 'To print it beside the signature.',
      place: 'Place',
      addSignature: 'Signature',
      addDate: 'Date',
      addName: 'Name',
      placeHint: 'It goes on the page shown. Drag it into place; the corner resizes it.',
      makeFirst: 'Make a signature first.',
      placed: 'Placed',
      onPage: 'Page {n}: {count}',
      result: 'Result',
      writing: 'Writing the PDF…',
      placeFirst: 'Place your signature on a page.',
      'marks.one': '{n} mark',
      'marks.other': '{n} marks',
      pageOf: 'Page {n} of {total}',
      prev: 'Previous page',
      next: 'Next page',
      page: 'Page',
      sign: 'Signature',
      date: 'Date',
      remove: 'Remove',
      markLabel: '{what} on page {n}: drag to move, arrow keys move it, + and − resize it, Delete removes it',
      resize: 'Resize',
      shownPage: 'Page {n}, with what’s placed on it',
    },
    de: {
      drop: 'PDF hier ablegen oder auswählen',
      dropHint: 'Unterschreiben, Datum dazu, speichern.',
      another: 'Anderes PDF öffnen',
      notPdf: '{name} ist kein PDF.',
      locked: '{name} ist mit einem Passwort geschützt. Öffne es, speichere eine Kopie ohne und nimm die.',
      broken: '{name} ist beschädigt: Dieses PDF lässt sich nicht lesen.',
      noChanges: '{name} ist gegen Änderungen geschützt und lässt sich hier nicht unterschreiben.',
      writeFailed: 'Das unterschriebene PDF ließ sich nicht schreiben.',
      'count.one': '{n} Seite',
      'count.other': '{n} Seiten',
      signature: 'Unterschrift',
      draw: 'Zeichnen',
      type: 'Tippen',
      pad: 'Unterschriftenfeld: Unterschreib hier',
      undoStroke: 'Letzten Strich zurück',
      clear: 'Leeren',
      keptShown: 'Deine gemerkte Unterschrift. Zeichne, um eine neue zu machen.',
      yourName: 'Dein Name',
      typeHint: 'Tipp deinen Namen: Er wird in Handschrift gesetzt.',
      ink: 'Tinte',
      black: 'Schwarz',
      blue: 'Blau',
      keepLabel: 'Merken',
      keep: 'Unterschrift auf diesem Gerät merken',
      keepHint: 'Nur ihr Bild, in diesem Browser. Sonst wird nichts gemerkt.',
      kept: 'Auf diesem Gerät gemerkt.',
      forget: 'Vergessen',
      forgotten: 'Vergessen.',
      keepFailed: 'Dieser Browser merkt sie sich nicht (ein privates Fenster?).',
      name: 'Name',
      nameHint: 'Um ihn neben die Unterschrift zu drucken.',
      place: 'Platzieren',
      addSignature: 'Unterschrift',
      addDate: 'Datum',
      addName: 'Name',
      placeHint: 'Es kommt auf die gezeigte Seite. Zieh es an seinen Platz, die Ecke ändert die Größe.',
      makeFirst: 'Mach zuerst eine Unterschrift.',
      placed: 'Platziert',
      onPage: 'Seite {n}: {count}',
      result: 'Ergebnis',
      writing: 'Das PDF wird geschrieben…',
      placeFirst: 'Setz deine Unterschrift auf eine Seite.',
      'marks.one': '{n} Eintrag',
      'marks.other': '{n} Einträge',
      pageOf: 'Seite {n} von {total}',
      prev: 'Vorige Seite',
      next: 'Nächste Seite',
      page: 'Seite',
      sign: 'Unterschrift',
      date: 'Datum',
      remove: 'Entfernen',
      markLabel: '{what} auf Seite {n}: ziehen verschiebt, Pfeiltasten verschieben, + und − ändern die Größe, Entf entfernt',
      resize: 'Größe ändern',
      shownPage: 'Seite {n} mit dem, was darauf liegt',
    },
  });

  // How it's signed is kept (draw or type, the ink); the PDF, the drawing and the name are not.
  const o = remember('sign', { how: 'draw' as 'draw' | 'type', ink: 'black' as Ink });
  const ink = $derived(INKS[o.ink] ?? INKS.black);

  // ── The PDF ─────────────────────────────────────────────────────────────────────────────────

  let file = $state<File | null>(null);
  let opened = $state.raw<Opened | null>(null);
  let infos = $state.raw<PageInfo[]>([]);
  let problem = $state<string | null>(null);
  let current = $state(0);
  const views = new Map<number, string>();
  let viewUrl = $state<string | null>(null);
  let generation = 0;

  async function add(list: File[]) {
    const f = list[0];
    if (!f) return;
    problem = null;
    let next: Opened;
    try {
      next = await readPdf(f);
    } catch (error) {
      problem = w(problemOf(error), { name: f.name });
      return;
    }
    // pdf-lib writes the signature in; a PDF that forbids changes can't take it.
    const { PDFDocument } = await import('pdf-lib');
    let writable = false;
    let encrypted = false;
    try {
      const lib = await PDFDocument.load(next.bytes, { ignoreEncryption: true, updateMetadata: false });
      encrypted = lib.isEncrypted;
      writable = !encrypted;
    } catch {
      // Damaged in a way pdf.js forgives and pdf-lib doesn't.
    }
    if (!writable) {
      closePdf(next.doc);
      problem = w(encrypted ? 'noChanges' : 'broken', { name: f.name });
      return;
    }
    const pages = await pageInfos(next.doc);
    clearViews();
    closePdf(opened?.doc);
    generation++;
    file = f;
    opened = next;
    infos = pages;
    current = 0;
    placed = [];
    active = null;
  }

  function clearViews() {
    for (const url of views.values()) URL.revokeObjectURL(url);
    views.clear();
    viewUrl = null;
  }

  function close() {
    clearViews();
    closePdf(opened?.doc);
    file = null;
    opened = null;
    infos = [];
    placed = [];
  }

  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  // The page shown, drawn big enough for a phone's sharp screen, once per page.
  $effect(() => {
    const doc = opened?.doc;
    const n = current;
    const info = infos[n];
    const gen = generation;
    if (!doc || !info) return;
    if (views.has(n)) {
      viewUrl = views.get(n)!;
      return;
    }
    viewUrl = null;
    void (async () => {
      const page = await doc.getPage(n + 1);
      const scale = 1400 / Math.max(info.width, info.height);
      const canvas = await drawPage(page, Math.round(info.width * scale), Math.round(info.height * scale));
      const blob = await canvasBlob(canvas, 'image/jpeg', 0.88);
      release(canvas);
      page.cleanup();
      if (gen !== generation) return;
      views.set(n, URL.createObjectURL(blob));
      if (current === n) viewUrl = views.get(n)!;
    })().catch(() => undefined);
  });

  onDestroy(() => {
    clearViews();
    closePdf(opened?.doc);
    if (sig) URL.revokeObjectURL(sig.url);
  });

  // ── The signature ───────────────────────────────────────────────────────────────────────────

  let strokes = $state.raw<Stroke[]>([]);
  let name = $state('');
  let keptPng = $state.raw<Uint8Array | null>(null);
  let keptUrl = $state<string | null>(null);
  let keepOn = $state(false);
  let keepNote = $state<string | null>(null);
  let sig = $state.raw<Picture | null>(null);

  void loadKept().then((png) => {
    if (!png) return;
    keptPng = png;
    keepOn = true;
    keptUrl = URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }));
  });

  /** Where the signature comes from now: the strokes, the typed name, or the kept one. */
  const source = $derived(o.how === 'draw' ? (strokes.length ? 'strokes' : keptPng ? 'kept' : null) : name.trim() ? 'typed' : keptPng ? 'kept' : null);

  // Made again whenever its source or the ink changes (a typed name a moment after the typing).
  $effect(() => {
    const from = source;
    const color = ink.css;
    const lines = strokes;
    const typed = name.trim();
    // The kept one only when it's the source: keeping a new signature mustn't make it again (a loop).
    const png = from === 'kept' ? keptPng : null;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        let made: Picture | null = null;
        try {
          made = from === 'strokes' ? await strokesPicture(lines, color) : from === 'typed' ? await textPicture(typed, HAND, color) : from === 'kept' && png ? await tinted(png, color) : null;
        } catch {
          // The page is going (a reload while it's drawn), or the browser wouldn't make the picture:
          // nothing to place until the next change makes one.
        }
        if (cancelled) {
          if (made) URL.revokeObjectURL(made.url);
          return;
        }
        if (sig) URL.revokeObjectURL(sig.url);
        sig = made;
      },
      from === 'typed' ? 150 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  // A kept signature follows the signature made (only once someone asked to keep it).
  $effect(() => {
    const on = keepOn;
    const made = sig;
    const from = source;
    if (!on || !made || from === 'kept') return;
    void keep(made.png).then((ok) => {
      if (!ok) {
        keepNote = w('keepFailed');
        keepOn = false;
        return;
      }
      keptPng = made.png;
      if (keptUrl) URL.revokeObjectURL(keptUrl);
      keptUrl = URL.createObjectURL(new Blob([made.png as BlobPart], { type: 'image/png' }));
    });
  });

  async function setKeep(on: boolean) {
    keepNote = null;
    keepOn = on;
    if (!on) await forgetIt();
  }

  async function forgetIt() {
    await forget();
    keepOn = false;
    keptPng = null;
    if (keptUrl) URL.revokeObjectURL(keptUrl);
    keptUrl = null;
    keepNote = w('forgotten');
  }

  // ── What's placed ───────────────────────────────────────────────────────────────────────────

  type Kind = 'sign' | 'date' | 'name';
  interface Placed {
    id: number;
    page: number;
    kind: Kind;
    x: number;
    y: number;
    /** A signature's width; text sizes by its height. */
    w: number;
    /** A text line's height (a signature's follows its width and shape). */
    h: number;
  }

  let placed = $state.raw<Placed[]>([]);
  let active = $state<number | null>(null);
  let nextId = 1;
  let pageEl = $state<HTMLDivElement>();
  let pw = $state(0);
  let ph = $state(0);

  const dateText = $derived(formatDate(new Date(), locale()));
  const info = $derived(infos[current]);
  const shownOf = (page: number) => ({ width: infos[page]?.width ?? 1, height: infos[page]?.height ?? 1 });
  const textOf = (m: Placed) => (m.kind === 'date' ? dateText : name.trim());

  /** A mark's box on its page, in fractions of the page as shown. */
  function boxOf(m: Placed) {
    const shown = shownOf(m.page);
    if (m.kind === 'sign') return { x: m.x, y: m.y, w: m.w, h: sig ? heightFor(m.w, sig.aspect, shown) : m.w / 4 };
    const sizePt = (m.h * shown.height) / LINE;
    return { x: m.x, y: m.y, w: Math.max(0.02, (textWidthPerPt(textOf(m) || ' ') * sizePt) / shown.width), h: m.h };
  }

  async function place(kind: Kind) {
    if (!opened) return;
    const shown = shownOf(current);
    const here = placed.filter((m) => m.page === current);
    const sigBox = here.findLast((m) => m.kind === 'sign');
    const textH = (12 * LINE) / shown.height;
    let box: Placed;
    if (kind === 'sign') {
      // About 6 cm wide, low on the right, where forms ask for it.
      const w0 = Math.min(0.42, 170 / shown.width);
      box = { id: nextId++, page: current, kind, x: 0.52, y: 0.7, w: w0, h: 0 };
    } else {
      const below = sigBox ? boxOf(sigBox) : null;
      const after = here.filter((m) => m.kind !== 'sign').length;
      box = { id: nextId++, page: current, kind, x: below ? below.x : 0.52, y: (below ? below.y + below.h + 0.01 : 0.82) + after * textH * 1.15, w: 0, h: textH };
    }
    // A second of the same kind sits a little further down.
    const same = here.filter((m) => m.kind === kind).length;
    box.y += same * 0.04;
    const b = clampBox(boxOf(box));
    box.x = b.x;
    box.y = b.y;
    placed = [...placed, box];
    active = box.id;
    await tick();
    pageEl?.querySelector<HTMLElement>(`[data-mark="${box.id}"]`)?.focus();
  }

  function removeMark(id: number) {
    placed = placed.filter((m) => m.id !== id);
    if (active === id) active = null;
  }

  function update(id: number, change: Partial<Placed>) {
    placed = placed.map((m) => {
      if (m.id !== id) return m;
      const next = { ...m, ...change };
      const b = clampBox(boxOf(next));
      return { ...next, x: b.x, y: b.y };
    });
  }

  // Dragging a mark, or its corner. From where it was when the pointer went down plus the whole
  // way the pointer went since (never step by step, which drifts).
  let grab: { id: number; pointerId: number; x: number; y: number; start: Placed; resize: boolean } | null = null;

  function down(e: PointerEvent, m: Placed, resize: boolean) {
    if (e.button !== 0 || grab) return;
    e.stopPropagation();
    e.preventDefault();
    active = m.id;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // A made-up pointer: the window still hears it.
    }
    grab = { id: m.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, start: m, resize };
    addEventListener('pointermove', moved);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-mark]')?.focus({ preventScroll: true });
  }

  function moved(e: PointerEvent) {
    if (!grab || e.pointerId !== grab.pointerId || !pw || !ph) return;
    const dx = (e.clientX - grab.x) / pw;
    const dy = (e.clientY - grab.y) / ph;
    const s = grab.start;
    if (!grab.resize) update(s.id, { x: s.x + dx, y: s.y + dy });
    else if (s.kind === 'sign') update(s.id, { w: Math.max(0.04, Math.min(1 - s.x, s.w + dx)) });
    else {
      const b = boxOf(s);
      const grow = Math.max(0.3, (b.w + dx) / b.w);
      update(s.id, { h: Math.max(0.008, Math.min(0.2, s.h * grow)) });
    }
  }

  function up(e: PointerEvent) {
    if (!grab || e.pointerId !== grab.pointerId) return;
    grab = null;
    removeEventListener('pointermove', moved);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
  }

  onDestroy(() => {
    removeEventListener('pointermove', moved);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
  });

  function nudge(e: KeyboardEvent, m: Placed) {
    const step = e.shiftKey ? 0.05 : 0.005;
    if (e.key === 'ArrowLeft') update(m.id, { x: m.x - step });
    else if (e.key === 'ArrowRight') update(m.id, { x: m.x + step });
    else if (e.key === 'ArrowUp') update(m.id, { y: m.y - step });
    else if (e.key === 'ArrowDown') update(m.id, { y: m.y + step });
    else if (e.key === '+' || e.key === '=') update(m.id, m.kind === 'sign' ? { w: m.w * 1.1 } : { h: m.h * 1.1 });
    else if (e.key === '-' || e.key === '−') update(m.id, m.kind === 'sign' ? { w: Math.max(0.04, m.w / 1.1) } : { h: Math.max(0.008, m.h / 1.1) });
    else if (e.key === 'Delete' || e.key === 'Backspace') removeMark(m.id);
    else if (e.key === 'Escape') {
      active = null;
      (e.currentTarget as HTMLElement).blur();
    } else return;
    e.preventDefault();
  }

  const onThisPage = $derived(placed.filter((m) => m.page === current));
  const byPage = $derived.by(() => {
    const pages = new Map<number, number>();
    for (const m of placed) pages.set(m.page, (pages.get(m.page) ?? 0) + 1);
    return [...pages].sort((a, b) => a[0] - b[0]);
  });
  const signs = $derived(placed.some((m) => m.kind === 'sign'));
  const missing = $derived(signs && !sig);

  // ── The signed PDF, written before Save is tapped ───────────────────────────────────────────

  let outputs = $state.raw<Output[] | null>(null);
  let writing = $state(false);
  let writeFailed = $state(false);

  $effect(() => {
    const bytes = opened?.bytes;
    const marks = placed;
    const picture = sig;
    const color = { r: ink.r, g: ink.g, b: ink.b };
    const css = ink.css;
    const fileName = file?.name ?? 'signed.pdf';
    const names = shared.names;
    const shown = infos.map((i) => ({ view: i.view, rotation: i.rotation }));
    const texts = marks.map((m) => textOf(m));
    outputs = null;
    writeFailed = false;
    const usable = marks.filter((m, i) => (m.kind === 'sign' ? !!picture : !!texts[i]));
    // A local first: reading `writing` back here would make this effect depend on it.
    const go = !!bytes && usable.length > 0 && !(marks.some((m) => m.kind === 'sign') && !picture);
    writing = go;
    if (!go || !bytes) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const out: Mark[] = [];
        for (const m of usable) {
          const box = boxOf(m);
          if (m.kind === 'sign') out.push({ page: m.page, box, png: picture!.png });
          else {
            const text = textOf(m);
            const fallback = await textPicture(text, 'Helvetica, Arial, sans-serif', css, 96);
            if (fallback) URL.revokeObjectURL(fallback.url);
            out.push({ page: m.page, box, text, textPng: fallback?.png });
          }
          if (cancelled) return;
        }
        const signed = await stamp(bytes, out, shown, color);
        if (cancelled) return;
        outputs = [{ blob: new Blob([signed as BlobPart], { type: 'application/pdf' }), name: outName(fileName, 'signed', 'pdf', names) }];
      } catch {
        if (!cancelled) writeFailed = true;
      }
      if (!cancelled) writing = false;
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const mark = $derived(shared.decimal);
  const nextItems = $derived(outputs?.length === 1 ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: 'application/pdf' }) }] : null);
  const what = (k: Kind) => (k === 'sign' ? w('sign') : k === 'date' ? w('date') : w('name'));
</script>

<div class="cols">
  <div class="stack">
    {#if file && opened && info}
      <FileRow name={file.name} meta={`${w('count', { n: infos.length })} · ${formatBytes(file.size, mark)}`} onremove={close} />
      {#if infos.length > 1}
        <nav class="turn" aria-label={w('page')}>
          <button type="button" class="btn ic" disabled={current === 0} onclick={() => (current -= 1)} aria-label={w('prev')} title={w('prev')}><ChevronLeft aria-hidden="true" /></button>
          <select class="field" aria-label={w('page')} value={current} onchange={(e) => (current = Number(e.currentTarget.value))}>
            {#each infos as _, i (i)}<option value={i}>{w('pageOf', { n: i + 1, total: infos.length })}</option>{/each}
          </select>
          <button type="button" class="btn ic" disabled={current === infos.length - 1} onclick={() => (current += 1)} aria-label={w('next')} title={w('next')}><ChevronRight aria-hidden="true" /></button>
        </nav>
      {/if}
      <!-- A tap on the bare page lets the chosen mark go (Escape does it from the keyboard). -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <div
        class="page"
        role="group"
        aria-label={w('shownPage', { n: current + 1 })}
        bind:this={pageEl}
        bind:clientWidth={pw}
        bind:clientHeight={ph}
        style:--ratio={info.width / info.height}
        onclick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') active = null;
        }}
      >
        {#if viewUrl}<img class="sheet-img" src={viewUrl} alt="" draggable="false" />{/if}
        {#each onThisPage as m (m.id)}
          {@const b = boxOf(m)}
          <div
            class="mark"
            class:on={active === m.id}
            data-mark={m.id}
            role="button"
            tabindex="0"
            aria-label={w('markLabel', { what: what(m.kind), n: m.page + 1 })}
            style:left={`${b.x * 100}%`}
            style:top={`${b.y * 100}%`}
            style:width={`${b.w * 100}%`}
            style:height={`${b.h * 100}%`}
            onpointerdown={(e) => down(e, m, false)}
            onkeydown={(e) => nudge(e, m)}
            onfocus={() => (active = m.id)}
          >
            {#if m.kind === 'sign'}
              {#if sig}<img src={sig.url} alt="" draggable="false" />{:else}<span class="empty">{w('sign')}</span>{/if}
            {:else}
              <span class="words" style:font-size={`${(m.h * ph) / LINE}px`} style:color={ink.css}>{textOf(m)}</span>
            {/if}
            {#if active === m.id}
              <button type="button" class="x" aria-label={w('remove')} title={w('remove')} onpointerdown={(e) => e.stopPropagation()} onclick={() => removeMark(m.id)}><X aria-hidden="true" /></button>
              <span class="corner" aria-hidden="true" title={w('resize')} onpointerdown={(e) => down(e, m, true)}></span>
            {/if}
          </div>
        {/each}
      </div>
      <DropWell accept="application/pdf,.pdf" compact title={w('another')} onfiles={add} />
    {:else}
      <DropWell accept="application/pdf,.pdf" title={w('drop')} hint={w('dropHint')} onfiles={add} />
    {/if}
    {#if problem}<p class="note bad" role="alert">{problem}</p>{/if}
  </div>

  <div class="stack">
    <dl class="spec">
      <div>
        <dt>{w('signature')}</dt>
        <dd class="full">
          <Seg
            label={w('signature')}
            value={o.how}
            options={[
              { value: 'draw', label: w('draw') },
              { value: 'type', label: w('type') },
            ]}
            onchange={(v) => (o.how = v)}
          />
          {#if o.how === 'draw'}
            <Pad {strokes} color={ink.css} label={w('pad')} kept={keptUrl} onchange={(s) => (strokes = s)} />
            <span class="row">
              <button type="button" class="btn small" disabled={!strokes.length} onclick={() => (strokes = strokes.slice(0, -1))}><Undo2 aria-hidden="true" />{w('undoStroke')}</button>
              <button type="button" class="btn small" disabled={!strokes.length} onclick={() => (strokes = [])}><Eraser aria-hidden="true" />{w('clear')}</button>
            </span>
            {#if !strokes.length && keptUrl}<span class="note">{w('keptShown')}</span>{/if}
          {:else}
            <input class="field" type="text" autocomplete="name" spellcheck="false" aria-label={w('yourName')} placeholder={w('yourName')} value={name} oninput={(e) => (name = e.currentTarget.value)} />
            <div class="typed" aria-hidden="true">
              {#if name.trim()}<span style:color={ink.css} style:font-family={HAND}>{name}</span>{:else if keptUrl}<img src={keptUrl} alt="" />{/if}
            </div>
            <span class="note">{w('typeHint')}</span>
          {/if}
        </dd>
      </div>
      <div>
        <dt>{w('ink')}</dt>
        <dd>
          <Seg
            label={w('ink')}
            value={o.ink}
            options={[
              { value: 'black', label: w('black') },
              { value: 'blue', label: w('blue') },
            ]}
            onchange={(v) => (o.ink = v)}
          />
        </dd>
      </div>
      <div>
        <dt>{w('keepLabel')}</dt>
        <dd>
          <Check checked={keepOn} label={w('keep')} hint={w('keepHint')} onchange={(v) => void setKeep(v)} />
          {#if keptPng}
            <span class="row"><span class="note">{w('kept')}</span><button type="button" class="link" onclick={() => void forgetIt()}>{w('forget')}</button></span>
          {:else if keepNote}
            <span class="note" role="status">{keepNote}</span>
          {/if}
        </dd>
      </div>
      {#if o.how === 'draw'}
        <div>
          <dt>{w('name')}</dt>
          <dd>
            <input class="field" type="text" autocomplete="name" spellcheck="false" aria-label={w('name')} placeholder={w('yourName')} value={name} oninput={(e) => (name = e.currentTarget.value)} />
            <span class="note">{w('nameHint')}</span>
          </dd>
        </div>
      {/if}
      {#if opened}
        <div>
          <dt>{w('place')}</dt>
          <dd>
            <span class="row">
              <button type="button" class="btn" disabled={!sig} onclick={() => place('sign')}><PenLine aria-hidden="true" />{w('addSignature')}</button>
              <button type="button" class="btn" onclick={() => place('date')}><CalendarDays aria-hidden="true" />{w('addDate')}</button>
              <button type="button" class="btn" disabled={!name.trim()} onclick={() => place('name')}><User aria-hidden="true" />{w('addName')}</button>
            </span>
            <span class="note">{sig ? w('placeHint') : w('makeFirst')} <code class="m day">{dateText}</code></span>
            {#if byPage.length}
              <span class="row">
                {#each byPage as [page, n] (page)}
                  <button type="button" class="btn small" class:here={page === current} aria-current={page === current ? 'page' : undefined} onclick={() => (current = page)}>{w('onPage', { n: page + 1, count: n })}</button>
                {/each}
              </span>
            {/if}
          </dd>
        </div>
        <div>
          <dt>{w('result')}</dt>
          <dd>
            {#if outputs}
              <div class="big"><b>{formatBytes(outputs[0].blob.size, mark)}</b><span class="m">{w('marks', { n: placed.length })}</span></div>
              <span class="note">{outputs[0].name}</span>
            {:else if writeFailed}
              <span class="note bad" role="alert">{w('writeFailed')}</span>
            {:else if missing}
              <span class="note">{w('makeFirst')}</span>
            {:else if writing}
              <span class="note" aria-live="polite">{w('writing')}</span>
            {:else}
              <span class="note">{w('placeFirst')}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if opened}
      <SaveButton {outputs} busy={writing} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['arrange', 'pdfimg']} />
    {/if}
  </div>
</div>

<style>
  .turn {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
  }

  .turn select {
    min-height: 40px;
  }

  .ic {
    min-width: 40px;
    min-height: 40px;
    padding: 0;
  }

  /* The page as shown, as big as fits: its marks are placed in fractions of it. */
  .page {
    position: relative;
    width: min(100%, calc(min(72vh, 780px) * var(--ratio)));
    aspect-ratio: var(--ratio);
    margin-inline: auto;
    background: #fff;
    outline: 1px solid var(--ink);
    user-select: none;
    -webkit-user-select: none;
  }

  .sheet-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .mark {
    position: absolute;
    touch-action: none;
    cursor: move;
    outline: 1px dashed transparent;
    outline-offset: 2px;
  }

  .mark:focus-visible,
  .mark.on {
    outline: 1.5px dashed #121212;
  }

  .mark img {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .empty {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    font-size: 11px;
    color: #53534f;
    border: 1px dashed #8a8a84;
  }

  .words {
    display: block;
    font-family: Helvetica, Arial, sans-serif;
    line-height: 1.2;
    white-space: nowrap;
  }

  /* Remove and the resize corner: printed on the page's paper, in ink, whatever the theme. */
  .x {
    position: absolute;
    top: -34px;
    right: -6px;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    background: #fff;
    color: #121212;
    border: 1.5px solid #121212;
  }

  .x :global(svg) {
    width: 16px;
    height: 16px;
  }

  .corner {
    position: absolute;
    right: -18px;
    bottom: -18px;
    width: 36px;
    height: 36px;
    touch-action: none;
    cursor: nwse-resize;
  }

  .corner::after {
    content: '';
    position: absolute;
    left: 13px;
    top: 13px;
    width: 10px;
    height: 10px;
    background: #121212;
    border: 1.5px solid #fff;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
  }

  .row :global(svg) {
    width: 16px;
    height: 16px;
  }

  .btn.small {
    min-height: 40px;
  }

  /* The date as it'll be printed, kept on one line. */
  .day {
    white-space: nowrap;
  }

  .btn.here {
    background: var(--mark);
    color: var(--mark-ink);
    border-color: var(--mark-ink);
  }

  /* The pad and the typed name take the whole row. */
  .full {
    justify-items: stretch;
  }

  .full > :global(.seg) {
    justify-self: start;
  }

  .typed {
    height: 96px;
    display: grid;
    place-items: center;
    background: #fff;
    border: 1.5px solid var(--ink);
    overflow: hidden;
    padding: 0 12px;
  }

  .typed span {
    font-size: 44px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .typed img {
    max-height: 70%;
    max-width: 100%;
  }
</style>

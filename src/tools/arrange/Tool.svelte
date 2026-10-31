<!--
  F-201 Arrange a PDF: one board of page thumbnails across one or more PDFs (more files merge in
  order). Pages are reordered by dragging (a mouse anywhere on the card, a finger on its grip), by
  the toolbar or by keys; turned in quarters; deleted with Undo. Save writes the board with pdf-lib's
  copyPages (the pages themselves, never pictures of them): as one PDF, the selected pages, or every
  page on its own. The result is written as soon as the board changes, so Save hands it out at once.
-->
<script lang="ts">
  import { untrack, onDestroy, onMount, tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { RotateCw, RotateCcw, Trash, Undo2, ArrowLeft, ArrowRight, GripVertical } from '@lucide/svelte';
  import type { PDFDocument as LibDoc } from 'pdf-lib';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, t } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes, stem } from '../../lib/files.ts';
  import type { Output } from '../../lib/save.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { toast } from '../../../vendor/ewo/elements/toaster.js';
  import { readPdf, problemOf, closePdf, breathe, Thumbs, nearView, type Opened } from '../../lib/pdfpages.ts';
  import { turned, moveStep, moveTo, dropIndex, columns, plan, type PageRef, type Rect, type SaveAs } from './arrange.ts';
  import { writePages } from './write.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop PDFs here, or choose them',
      dropHint: 'Several merge in the order they come.',
      add: 'Add PDFs',
      notPdf: '{name} isn’t a PDF.',
      locked: '{name} is locked with a password. Open it, save a copy without one, and try that.',
      broken: '{name} is damaged: this PDF can’t be read.',
      noChanges: '{name} is protected against changes, so its pages can’t go into a new PDF.',
      writeFailed: 'This PDF couldn’t be written.',
      'count.one': '{n} page',
      'count.other': '{n} pages',
      board: 'Pages, in order',
      tools: 'Selected pages',
      all: 'Select all',
      none: 'Select none',
      'selected.one': '{n} selected',
      'selected.other': '{n} selected',
      tapToSelect: 'Tap pages to select them',
      earlier: 'Move earlier',
      later: 'Move later',
      left: 'Turn left',
      right: 'Turn right',
      delete: 'Delete',
      undo: 'Undo',
      'deleted.one': '{n} page deleted',
      'deleted.other': '{n} pages deleted',
      empty: 'No pages left. Undo, or add a PDF.',
      keys: 'Keys: arrows to go, Space to select, Alt + arrows to move, R to turn, Delete',
      card: 'Page {n}: {file}, page {page}',
      cardTurned: 'Page {n}: {file}, page {page}, turned {deg}°',
      grip: 'Drag to move',
      moved: 'Moved to place {n}',
      turnedTo: 'Turned',
      undone: 'Undone',
      pages: 'Pages',
      fromFiles: 'From {files}',
      and: '{a} and {b}',
      saveAs: 'Save as',
      one: 'One PDF',
      selectedPages: 'Selected pages',
      each: 'Each page',
      selectFirst: 'Select the pages to save on the board.',
      result: 'Result',
      'files.one': '{n} file',
      'files.other': '{n} files',
      writing: 'Writing the PDF…',
    },
    de: {
      drop: 'PDFs hier ablegen oder auswählen',
      dropHint: 'Mehrere werden in ihrer Reihenfolge zusammengefügt.',
      add: 'PDFs dazu',
      notPdf: '{name} ist kein PDF.',
      locked: '{name} ist mit einem Passwort geschützt. Öffne es, speichere eine Kopie ohne und nimm die.',
      broken: '{name} ist beschädigt: Dieses PDF lässt sich nicht lesen.',
      noChanges: '{name} ist gegen Änderungen geschützt, seine Seiten können in kein neues PDF.',
      writeFailed: 'Dieses PDF ließ sich nicht schreiben.',
      'count.one': '{n} Seite',
      'count.other': '{n} Seiten',
      board: 'Seiten, in ihrer Reihenfolge',
      tools: 'Gewählte Seiten',
      all: 'Alle wählen',
      none: 'Keine wählen',
      'selected.one': '{n} gewählt',
      'selected.other': '{n} gewählt',
      tapToSelect: 'Tippe Seiten an, um sie zu wählen',
      earlier: 'Nach vorn',
      later: 'Nach hinten',
      left: 'Nach links drehen',
      right: 'Nach rechts drehen',
      delete: 'Löschen',
      undo: 'Zurück',
      'deleted.one': '{n} Seite gelöscht',
      'deleted.other': '{n} Seiten gelöscht',
      empty: 'Keine Seiten mehr. Nimm es zurück oder füg ein PDF dazu.',
      keys: 'Tasten: Pfeile zum Gehen, Leertaste wählt, Alt + Pfeile verschiebt, R dreht, Entf',
      card: 'Seite {n}: {file}, Seite {page}',
      cardTurned: 'Seite {n}: {file}, Seite {page}, um {deg}° gedreht',
      grip: 'Zum Verschieben ziehen',
      moved: 'Jetzt an Stelle {n}',
      turnedTo: 'Gedreht',
      undone: 'Zurückgenommen',
      pages: 'Seiten',
      fromFiles: 'Aus {files}',
      and: '{a} und {b}',
      saveAs: 'Speichern als',
      one: 'Ein PDF',
      selectedPages: 'Gewählte Seiten',
      each: 'Jede Seite',
      selectFirst: 'Wähl die Seiten zum Speichern auf der Tafel.',
      result: 'Ergebnis',
      'files.one': '{n} Datei',
      'files.other': '{n} Dateien',
      writing: 'Das PDF wird geschrieben…',
    },
  });

  // How it saves is kept; the files, the board and the selection are not.
  const o = remember('arrange', { saveAs: 'one' as SaveAs });

  interface Source extends Opened {
    file: File;
    lib: LibDoc;
    gone: boolean;
  }

  let sources = $state.raw<Source[]>([]);
  let pages = $state.raw<PageRef[]>([]);
  let selected = $state.raw<ReadonlySet<string>>(new Set());
  let history = $state.raw<{ pages: PageRef[]; selected: ReadonlySet<string> }[]>([]);
  let problems = $state<string[]>([]);
  let adding = $state(0);
  let said = $state('');
  let focusId = $state<string | null>(null);
  let anchor: string | null = null;
  let nextId = 0;

  const thumbs = new Thumbs(280);
  const live = $derived(sources.filter((s) => !s.gone));
  const several = $derived(live.length > 1);
  const letter = (src: number) => String.fromCharCode(65 + (src % 26));
  const thumbKey = (p: PageRef) => `${p.src}:${p.index}`;

  let board = $state<HTMLUListElement>();
  let headHeight = $state(0);
  onMount(() => {
    // The app's sticky header: the toolbar sticks under it.
    headHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
  });
  onDestroy(() => {
    thumbs.destroy();
    for (const s of sources) closePdf(s.doc);
    stopDrag();
  });

  async function add(list: File[]) {
    problems = [];
    adding++;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const fresh: Source[] = [];
      const added: PageRef[] = [];
      for (const file of list) {
        let opened: Opened;
        try {
          opened = await readPdf(file);
        } catch (error) {
          problems = [...problems, w(problemOf(error), { name: file.name })];
          continue;
        }
        // pdf-lib's own error for this doesn't survive its build (instanceof fails): it's asked.
        let lib: LibDoc | null = null;
        try {
          lib = await PDFDocument.load(opened.bytes, { updateMetadata: false, ignoreEncryption: true });
        } catch {
          // Damaged in a way pdf.js forgives and pdf-lib doesn't.
        }
        if (!lib || lib.isEncrypted) {
          closePdf(opened.doc);
          problems = [...problems, w(lib ? 'noChanges' : 'broken', { name: file.name })];
          continue;
        }
        const src = sources.length + fresh.length;
        fresh.push({ ...opened, file, lib, gone: false });
        const count = Math.min(opened.doc.numPages, lib.getPageCount());
        for (let i = 0; i < count; i++) added.push({ id: `p${nextId++}`, src, index: i, turn: 0 });
        await breathe();
      }
      // All at once, so Save never offers half of what was dropped.
      sources = [...sources, ...fresh];
      pages = [...pages, ...added];
    } finally {
      adding--;
    }
  }

  function removeFile(src: number) {
    closePdf(sources[src].doc);
    thumbs.drop(`${src}:`);
    sources = sources.map((s, i) => (i === src ? { ...s, gone: true } : s));
    pages = pages.filter((p) => p.src !== src);
    history = history.map((h) => ({ pages: h.pages.filter((p) => p.src !== src), selected: h.selected }));
    selected = new Set([...selected].filter((id) => pages.some((p) => p.id === id)));
  }

  // A PDF dropped on the home, or handed on from another tool, goes straight in.
  const given = untrack(() => filesOf(items));
  if (given.length) void add(given);

  // ── Changes, each one undoable ──────────────────────────────────────────────────────────────

  function commit(next: PageRef[], nextSelected: ReadonlySet<string> = selected) {
    history = [...history.slice(-49), { pages, selected }];
    pages = next;
    selected = nextSelected;
  }

  function undo() {
    const last = history.at(-1);
    if (!last) return;
    history = history.slice(0, -1);
    pages = last.pages;
    selected = new Set([...last.selected].filter((id) => last.pages.some((p) => p.id === id)));
    say(w('undone'));
  }

  function say(text: string) {
    said = '';
    void tick().then(() => (said = text));
  }

  /** What the keys act on: the selection, or the page with the focus. */
  const acting = () => (selected.size ? selected : focusId ? new Set([focusId]) : new Set<string>());

  async function move(dir: -1 | 1, ids = acting(), steps = 1) {
    if (!ids.size) return;
    let next = pages;
    for (let s = 0; s < steps; s++) next = moveStep(next, ids, dir);
    if (next.every((p, i) => p === pages[i])) return;
    commit(next);
    const at = next.findIndex((p) => ids.has(p.id));
    say(w('moved', { n: at + 1 }));
    await refocus();
  }

  function rotate(by: 1 | -1, ids = acting()) {
    if (!ids.size) return;
    commit(pages.map((p) => (ids.has(p.id) ? { ...p, turn: turned(p.turn, by) } : p)));
    say(w('turnedTo'));
  }

  async function remove(ids = acting()) {
    if (!ids.size) return;
    const first = pages.findIndex((p) => ids.has(p.id));
    const next = pages.filter((p) => !ids.has(p.id));
    commit(next, new Set());
    if (focusId && ids.has(focusId)) focusId = next[Math.min(first, next.length - 1)]?.id ?? null;
    toast(w('deleted', { n: ids.size }), { duration: 5000, action: { label: w('undo'), run: undo } });
    await refocus();
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  const allSelected = $derived(pages.length > 0 && selected.size === pages.length);
  const selectAll = () => (selected = allSelected ? new Set() : new Set(pages.map((p) => p.id)));

  // ── Selecting and keys ──────────────────────────────────────────────────────────────────────

  let suppressClick = false;

  function click(e: MouseEvent, p: PageRef) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    focusId = p.id;
    if (e.shiftKey && anchor && anchor !== p.id) {
      const a = pages.findIndex((q) => q.id === anchor);
      const b = pages.findIndex((q) => q.id === p.id);
      if (a > -1) {
        const next = new Set(selected);
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(pages[i].id);
        selected = next;
        return;
      }
    }
    toggle(p.id);
    anchor = p.id;
  }

  const cardRects = (): Rect[] => [...(board?.querySelectorAll<HTMLElement>('[data-id]') ?? [])].map((el) => el.getBoundingClientRect());

  async function refocus() {
    await tick();
    board?.querySelector<HTMLElement>(`[data-id="${focusId}"]`)?.focus({ preventScroll: false });
  }

  async function focusAt(i: number) {
    const p = pages[Math.max(0, Math.min(pages.length - 1, i))];
    if (!p) return;
    focusId = p.id;
    await refocus();
  }

  function key(e: KeyboardEvent) {
    const i = pages.findIndex((p) => p.id === focusId);
    if (i < 0) return;
    const cols = columns(cardRects());
    const cmd = e.metaKey || e.ctrlKey;
    if (e.key === 'ArrowLeft') void (e.altKey ? move(-1) : focusAt(i - 1));
    else if (e.key === 'ArrowRight') void (e.altKey ? move(1) : focusAt(i + 1));
    else if (e.key === 'ArrowUp') void (e.altKey ? move(-1, acting(), cols) : focusAt(i - cols));
    else if (e.key === 'ArrowDown') void (e.altKey ? move(1, acting(), cols) : focusAt(i + cols));
    else if (e.key === 'Home') void focusAt(0);
    else if (e.key === 'End') void focusAt(pages.length - 1);
    else if ((e.key === ' ' || e.key === 'Enter') && !cmd) {
      toggle(pages[i].id);
      anchor = pages[i].id;
    } else if ((e.key === 'r' || e.key === 'R') && !cmd) rotate(e.shiftKey ? -1 : 1);
    else if (e.key === 'Delete' || e.key === 'Backspace') void remove();
    else if (e.key === 'a' && cmd) selected = new Set(pages.map((p) => p.id));
    else if (e.key === 'z' && cmd) {
      undo();
      void refocus();
    } else if (e.key === 'Escape') selected = new Set();
    else return;
    e.preventDefault();
  }

  // ── Dragging ────────────────────────────────────────────────────────────────────────────────
  // From a snapshot of the cards taken when the drag starts (in page coordinates, so scrolling on
  // the way doesn't matter), the pointer's position picks the place to drop. A mouse drags a card
  // anywhere; a finger only by its grip (touch-action: none there), so a swipe over the board still
  // scrolls the page.

  interface Drag {
    ids: Set<string>;
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
    insert: number;
  }
  let drag = $state<Drag | null>(null);
  let rects: Rect[] = [];
  let boardBox = { left: 0, top: 0 };
  let scroller = 0;

  function down(e: PointerEvent, p: PageRef, grip: boolean) {
    if (drag || (!grip && (e.pointerType !== 'mouse' || e.button !== 0))) return;
    if (grip) {
      e.stopPropagation();
      e.preventDefault();
    }
    const ids = selected.has(p.id) ? new Set(selected) : new Set([p.id]);
    drag = { ids, id: p.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false, insert: -1 };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // A pointer made up by a test, or already gone: the window's listeners still follow it.
    }
    addEventListener('pointermove', moved);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
    if (grip) begin();
  }

  function begin() {
    if (!drag || !board) return;
    rects = cardRects().map((r) => ({ left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY }));
    const b = board.getBoundingClientRect();
    boardBox = { left: b.left + scrollX, top: b.top + scrollY };
    drag.active = true;
    drag.insert = dropIndex(rects, drag.x + scrollX, drag.y + scrollY);
    scroller = requestAnimationFrame(edgeScroll);
  }

  function moved(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
      begin();
    }
    drag.insert = dropIndex(rects, e.clientX + scrollX, e.clientY + scrollY);
  }

  /** Near the window's top or bottom edge, the page scrolls along. */
  function edgeScroll() {
    if (!drag?.active) return;
    const edge = 70;
    const top = headHeight + edge;
    const speed = drag.y < top ? -Math.min(18, (top - drag.y) / 3) : drag.y > innerHeight - edge ? Math.min(18, (drag.y - innerHeight + edge) / 3) : 0;
    if (speed) {
      scrollBy(0, speed);
      drag.insert = dropIndex(rects, drag.x + scrollX, drag.y + scrollY);
    }
    scroller = requestAnimationFrame(edgeScroll);
  }

  async function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const done = drag;
    stopDrag();
    if (!done.active) return;
    // The click that follows the drag isn't a tap on the card.
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    const next = moveTo(pages, done.ids, done.insert);
    if (next.some((p, i) => p !== pages[i])) {
      commit(next);
      focusId = done.id;
      say(w('moved', { n: next.findIndex((p) => p.id === done.id) + 1 }));
      await refocus();
    }
  }

  function cancel(e: PointerEvent) {
    if (drag && e.pointerId === drag.pointerId) stopDrag();
  }

  function stopDrag() {
    cancelAnimationFrame(scroller);
    removeEventListener('pointermove', moved);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', cancel);
    drag = null;
  }

  /** The drop line, beside the card it goes before (or after the last), inside the board. */
  const line = $derived.by(() => {
    if (!drag?.active || drag.insert < 0 || !rects.length) return null;
    const before = rects[drag.insert];
    const after = rects[drag.insert - 1];
    const r = before ?? after;
    const x = before ? before.left - 6 : after.right + 4;
    return { left: x - boardBox.left, top: r.top - boardBox.top, height: r.bottom - r.top };
  });

  const dragged = $derived(drag?.active ? pages.find((p) => p.id === drag!.id) : undefined);

  // ── The result, written before Save is tapped ───────────────────────────────────────────────

  let outputs = $state.raw<Output[] | null>(null);
  let writing = $state(false);
  let writeFailed = $state(false);
  const NONE: ReadonlySet<string> = new Set();

  $effect(() => {
    const list = pages;
    const mode = o.saveAs;
    const sel = mode === 'selected' ? selected : NONE;
    const names = shared.names;
    const srcs = sources;
    const first = srcs.find((s) => !s.gone)?.file.name ?? 'pages.pdf';
    const planned = plan(list, mode, sel, first, names);
    outputs = null;
    writeFailed = false;
    writing = planned.length > 0;
    if (!planned.length) return;
    let cancelled = false;
    // A moment's wait: several quick changes write once.
    const timer = setTimeout(async () => {
      try {
        const libs = srcs.map((s) => s.lib);
        const out: Output[] = [];
        for (const one of planned) {
          const bytes = await writePages(libs, one.pages);
          if (cancelled) return;
          out.push({ blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), name: one.name });
          await breathe();
          if (cancelled) return;
        }
        outputs = out;
      } catch {
        if (!cancelled) writeFailed = true;
      }
      if (!cancelled) writing = false;
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const mark = $derived(shared.decimal);
  const total = $derived(outputs?.reduce((sum, o) => sum + o.blob.size, 0) ?? 0);
  const nextItems = $derived(outputs?.length === 1 ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: 'application/pdf' }) }] : null);
  const zipName = $derived(`${stem(live[0]?.file.name ?? 'pages')}-pages`);
  const fileNames = $derived.by(() => {
    const names = live.map((s) => s.file.name);
    if (names.length <= 2) return names.length === 2 ? w('and', { a: names[0], b: names[1] }) : (names[0] ?? '');
    return w('files', { n: names.length });
  });

  function cardLabel(p: PageRef, i: number) {
    const params = { n: i + 1, file: sources[p.src]?.file.name ?? '', page: p.index + 1, deg: p.turn };
    return p.turn ? w('cardTurned', params) : w('card', params);
  }
</script>

<div class="cols">
  <div class="stack">
    {#if sources.length && live.length}
      {#each sources as s, src (s)}
        {#if !s.gone}
          <FileRow name={s.file.name} meta={`${several ? `${letter(src)} · ` : ''}${w('count', { n: Math.min(s.doc.numPages, s.lib.getPageCount()) })} · ${formatBytes(s.file.size, mark)}`} onremove={() => removeFile(src)} />
        {/if}
      {/each}
      <DropWell accept="application/pdf,.pdf" multiple compact title={w('add')} onfiles={add} />

      <div class="tools" role="toolbar" aria-label={w('tools')} style:top={`${headHeight}px`}>
        <button type="button" class="btn small" disabled={!pages.length} onclick={selectAll}>{allSelected ? w('none') : w('all')}</button>
        <span class="m count" aria-live="polite">{selected.size ? w('selected', { n: selected.size }) : w('tapToSelect')}</span>
        <span class="acts">
          <button type="button" class="btn ic" disabled={!selected.size} onclick={() => move(-1, selected)} aria-label={w('earlier')} title={w('earlier')}><ArrowLeft aria-hidden="true" /></button>
          <button type="button" class="btn ic" disabled={!selected.size} onclick={() => move(1, selected)} aria-label={w('later')} title={w('later')}><ArrowRight aria-hidden="true" /></button>
          <button type="button" class="btn ic" disabled={!selected.size} onclick={() => rotate(-1, selected)} aria-label={w('left')} title={w('left')}><RotateCcw aria-hidden="true" /></button>
          <button type="button" class="btn ic" disabled={!selected.size} onclick={() => rotate(1, selected)} aria-label={w('right')} title={w('right')}><RotateCw aria-hidden="true" /></button>
          <button type="button" class="btn ic" disabled={!selected.size} onclick={() => remove(selected)} aria-label={w('delete')} title={w('delete')}><Trash aria-hidden="true" /></button>
          <button type="button" class="btn ic" disabled={!history.length} onclick={undo} aria-label={w('undo')} title={w('undo')}><Undo2 aria-hidden="true" /></button>
        </span>
      </div>

      {#if pages.length}
        <ul class="board" class:dragging={drag?.active} role="listbox" aria-multiselectable="true" aria-label={w('board')} bind:this={board}>
          {#each pages as p, i (p.id)}
            {@const on = selected.has(p.id)}
            {@const url = thumbs.url(thumbKey(p))}
            <li
              role="option"
              aria-selected={on}
              aria-label={cardLabel(p, i)}
              tabindex={p.id === (focusId ?? pages[0].id) ? 0 : -1}
              class="card"
              class:on
              class:lifted={drag?.active && drag.ids.has(p.id)}
              data-id={p.id}
              animate:flip={{ duration: drag ? 0 : 180 }}
              use:nearView={() => {
                const s = sources[p.src];
                if (s && !s.gone) thumbs.want(thumbKey(p), s.doc, p.index);
              }}
              onclick={(e) => click(e, p)}
              onkeydown={key}
              onpointerdown={(e) => down(e, p, false)}
              onfocus={() => (focusId = p.id)}
            >
              <span class="paper">
                {#if url}<img src={url} alt="" draggable="false" style:rotate={`${p.turn}deg`} />{:else}<span class="blank"></span>{/if}
              </span>
              <span class="grip" title={w('grip')} aria-hidden="true" onpointerdown={(e) => down(e, p, true)}><GripVertical /></span>
              <span class="tag">
                <span class="m num" class:hl={on}>{i + 1}</span>
                {#if several}<span class="m src">{letter(p.src)}{p.index + 1}</span>{/if}
              </span>
            </li>
          {/each}
          {#if line}<span class="drop" aria-hidden="true" style:left={`${line.left}px`} style:top={`${line.top}px`} style:height={`${line.height}px`}></span>{/if}
        </ul>
        <p class="m keys">{w('keys')}</p>
      {:else}
        <p class="note">{w('empty')}</p>
      {/if}
    {:else}
      <DropWell accept="application/pdf,.pdf" multiple title={w('drop')} hint={w('dropHint')} onfiles={add} />
    {/if}
    {#each problems as p (p)}<p class="note bad" role="alert">{p}</p>{/each}
    <p class="sr" aria-live="polite">{said}</p>
  </div>

  <div class="stack">
    <dl class="spec">
      {#if live.length}
        <div>
          <dt>{w('pages')}</dt>
          <dd>
            <div class="big"><b>{pages.length}</b></div>
            <span class="note">{w('fromFiles', { files: fileNames })}</span>
          </dd>
        </div>
      {/if}
      <div>
        <dt>{w('saveAs')}</dt>
        <dd>
          <Seg
            label={w('saveAs')}
            value={o.saveAs}
            options={[
              { value: 'one', label: w('one') },
              { value: 'selected', label: w('selectedPages') },
              { value: 'each', label: w('each') },
            ]}
            onchange={(v) => (o.saveAs = v)}
          />
          {#if o.saveAs === 'selected' && live.length && !selected.size}<span class="note">{w('selectFirst')}</span>{/if}
        </dd>
      </div>
      {#if live.length && pages.length}
        <div>
          <dt>{w('result')}</dt>
          <dd>
            {#if outputs}
              <div class="big">
                <b>{formatBytes(total, mark)}</b>
                {#if outputs.length > 1}<span class="m">{w('files', { n: outputs.length })}</span>{/if}
              </div>
              <span class="note">{outputs.length === 1 ? outputs[0].name : `${outputs[0].name} … ${outputs[outputs.length - 1].name}`}</span>
            {:else if writeFailed}
              <span class="note bad" role="alert">{w('writeFailed')}</span>
            {:else if writing}
              <span class="note" aria-live="polite">{w('writing')}</span>
            {/if}
          </dd>
        </div>
      {/if}
    </dl>

    {#if live.length}
      <SaveButton {outputs} busy={writing || adding > 0} {zipName} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['sign', 'pdfimg']} />
    {/if}
  </div>
</div>

{#if dragged && drag}
  {@const url = thumbs.url(thumbKey(dragged))}
  <div class="ghost" aria-hidden="true" style:transform={`translate3d(${drag.x - 36}px, ${drag.y - 36}px, 0)`}>
    {#if url}<img src={url} alt="" style:rotate={`${dragged.turn}deg`} />{/if}
    {#if drag.ids.size > 1}<span class="m">{drag.ids.size}</span>{/if}
  </div>
{/if}

<style>
  /* The toolbar sticks under the app's header while the board scrolls past. */
  .tools {
    position: sticky;
    z-index: 3;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    padding: 8px 0;
    background: var(--bg);
    border-bottom: 1.5px solid var(--ink);
  }

  .count {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--ink-2);
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ic {
    min-width: 40px;
    min-height: 40px;
    padding: 0;
  }

  /* Select all: a finger's size, like the buttons beside it. */
  .btn.small {
    min-height: 40px;
  }

  .board {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(104px, 30%), 1fr));
    gap: 16px 12px;
  }

  .card {
    position: relative;
    display: grid;
    gap: 4px;
    min-width: 0;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    outline-offset: 3px;
  }

  .dragging .card {
    cursor: grabbing;
  }

  .paper {
    aspect-ratio: 1;
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    place-items: center;
    padding: 8px;
    background: var(--sunk);
    border: 1px solid var(--rule);
  }

  .card.on .paper {
    border: 2px solid var(--ink);
    padding: 7px;
  }

  .paper img {
    max-width: 100%;
    max-height: 100%;
    outline: 1px solid var(--rule);
    transition: rotate 0.18s ease;
    pointer-events: none;
  }

  .blank {
    width: 70%;
    height: 100%;
    background: var(--card);
    outline: 1px solid var(--rule);
  }

  .lifted {
    opacity: 0.35;
  }

  .grip {
    position: absolute;
    top: 0;
    right: 0;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    touch-action: none;
    cursor: grab;
    color: var(--ink-2);
  }

  .grip :global(svg) {
    width: 18px;
    height: 18px;
    padding: 2px;
    background: var(--card);
    border: 1px solid var(--rule);
    box-sizing: content-box;
  }

  .tag {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    min-width: 0;
  }

  .num {
    padding: 0 4px;
  }

  .num.hl {
    color: var(--mark-ink);
  }

  .src {
    color: var(--ink-2);
  }

  .drop {
    position: absolute;
    width: 3px;
    background: var(--ink);
    pointer-events: none;
  }

  .keys {
    color: var(--ink-2);
  }

  @media (hover: none) {
    .keys {
      display: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .card:not(.on):hover .paper {
      border-color: var(--ink);
    }
  }

  .ghost {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 20;
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    padding: 6px;
    background: var(--card);
    border: 1.5px solid var(--ink);
    pointer-events: none;
  }

  .ghost img {
    max-width: 100%;
    max-height: 100%;
  }

  .ghost span {
    position: absolute;
    right: -8px;
    top: -8px;
    padding: 0 5px;
    background: var(--mark);
    color: var(--mark-ink);
  }
</style>

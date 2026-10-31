// The board of Arrange a PDF as data: which page of which file sits where, turned how far, and what
// Save makes of it. Plain TypeScript with erasable types, tested as it is; the component only draws
// it and the writer (write.ts) only copies what it says.

/** One page on the board. */
export interface PageRef {
  /** Stable across moves, for the keyed list and the selection. */
  id: string;
  /** Which file it came from (its place in the list of files). */
  src: number;
  /** Its page in that file, from 0. */
  index: number;
  /** How far it's turned on the board, clockwise, on top of its own turn: 0, 90, 180 or 270. */
  turn: number;
}

/** Degrees into 0, 90, 180 or 270: a PDF turns pages in quarter turns only. */
export function quarter(deg: number): number {
  const q = Math.round(deg / 90) * 90;
  return ((q % 360) + 360) % 360;
}

/** A page's turn after a quarter more (1) or less (-1). */
export const turned = (turn: number, by: 1 | -1) => quarter(turn + by * 90);

/**
 * The /Rotate a page gets on Save: its own, from its file (which may be negative or past 360, and
 * pdf-lib hands it back as it was written), plus the board's.
 */
export const composeRotation = (own: number, added: number) => quarter(own + added);

/**
 * Moves every selected page one place earlier (-1) or later (1). A run of selected pages moves
 * together; a page already at the start (or blocked by a selected page that is) stays.
 */
export function moveStep(pages: PageRef[], selected: ReadonlySet<string>, dir: -1 | 1): PageRef[] {
  const out = [...pages];
  if (dir < 0) {
    for (let i = 1; i < out.length; i++) {
      if (selected.has(out[i].id) && !selected.has(out[i - 1].id)) [out[i - 1], out[i]] = [out[i], out[i - 1]];
    }
  } else {
    for (let i = out.length - 2; i >= 0; i--) {
      if (selected.has(out[i].id) && !selected.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
  }
  return out;
}

/**
 * Moves pages (in their board order) to an insertion point: `before` is a place on the board as it
 * is now, 0 to pages.length (the end). Dropping a page right before or after itself changes nothing.
 */
export function moveTo(pages: PageRef[], ids: ReadonlySet<string>, before: number): PageRef[] {
  const moving = pages.filter((p) => ids.has(p.id));
  if (!moving.length) return pages;
  const shift = pages.slice(0, before).filter((p) => ids.has(p.id)).length;
  const rest = pages.filter((p) => !ids.has(p.id));
  const at = Math.max(0, Math.min(rest.length, before - shift));
  return [...rest.slice(0, at), ...moving, ...rest.slice(at)];
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a drop lands on a board of cards in rows (a wrapping grid): the place to insert before, 0
 * to rects.length. The row is the one the pointer is in, or the nearest; in it, before the first
 * card whose middle is right of the pointer, else after the row's last card.
 */
export function dropIndex(rects: Rect[], x: number, y: number): number {
  if (!rects.length) return 0;
  // Cards in one row share their top (within a few pixels).
  const rows: number[][] = [];
  rects.forEach((r, i) => {
    const row = rows.find((ids) => Math.abs(rects[ids[0]].top - r.top) < 4);
    if (row) row.push(i);
    else rows.push([i]);
  });
  let best = rows[0];
  let distance = Infinity;
  for (const row of rows) {
    const top = Math.min(...row.map((i) => rects[i].top));
    const bottom = Math.max(...row.map((i) => rects[i].bottom));
    const d = y < top ? top - y : y > bottom ? y - bottom : 0;
    if (d < distance) {
      distance = d;
      best = row;
    }
  }
  const sorted = [...best].sort((a, b) => rects[a].left - rects[b].left);
  for (const i of sorted) if (x < (rects[i].left + rects[i].right) / 2) return i;
  return sorted[sorted.length - 1] + 1;
}

/** How many cards share the first row: how far up and down move the focus. */
export function columns(rects: Rect[]): number {
  if (!rects.length) return 1;
  return Math.max(1, rects.filter((r) => Math.abs(r.top - rects[0].top) < 4).length);
}

export type SaveAs = 'one' | 'selected' | 'each';

export interface Planned {
  name: string;
  pages: PageRef[];
}

/** A file name without its extension (as files.ts's `stem`, kept here so this file stands alone). */
const stem = (name: string) => (name.split(/[\\/]/).pop() ?? name).replace(/\.[^.]+$/, '') || 'file';

/** Board places (from 1) as a name's tail: "2", "2-4", or null when they don't run on. */
export function runLabel(places: number[]): string | null {
  if (!places.length) return null;
  for (let i = 1; i < places.length; i++) if (places[i] !== places[i - 1] + 1) return null;
  return places.length === 1 ? String(places[0]) : `${places[0]}-${places[places.length - 1]}`;
}

/**
 * What Save makes, named after the first file: the whole board as letter-arranged.pdf; the selected
 * pages as letter-p2.pdf (one), letter-p2-4.pdf (a run) or letter-selected.pdf; every page as
 * letter-p1.pdf, letter-p2.pdf … Page numbers are places on the board. With File names on "Keep the
 * name", one file keeps letter.pdf, and every page still gets its number.
 */
export function plan(pages: PageRef[], saveAs: SaveAs, selected: ReadonlySet<string>, firstName: string, names: 'suffix' | 'same'): Planned[] {
  const base = stem(firstName);
  const same = names === 'same';
  if (!pages.length) return [];
  if (saveAs === 'each') return pages.map((p, i) => ({ name: `${base}-p${i + 1}.pdf`, pages: [p] }));
  if (saveAs === 'selected') {
    const places = pages.flatMap((p, i) => (selected.has(p.id) ? [i + 1] : []));
    if (!places.length) return [];
    const run = runLabel(places);
    const tail = run ? `p${run}` : 'selected';
    return [{ name: same ? `${base}.pdf` : `${base}-${tail}.pdf`, pages: places.map((n) => pages[n - 1]) }];
  }
  return [{ name: same ? `${base}.pdf` : `${base}-arranged.pdf`, pages }];
}

# Writing a tool

Every tool is one folder here, named after its id in `shared/catalog.mjs` (the catalog already
holds its number, address, names, description, synonyms, what it takes and gives, and which shared
settings it reads). The app finds the folder by itself: the home, search, the address, chaining and
the page head all come from the catalog. **Shrink a photo (`shrink/`) and Percent & VAT
(`percent/`) are the references**: one for files, one for numbers. Read both before starting.

```
src/tools/<id>/Tool.svelte     the tool (loaded only when it opens)
src/tools/<id>/<id>.ts         its logic, with no DOM: tested in node
tests/tools/<id>.test.mjs      unit tests of that logic (node --test)
tests/e2e/<id>.e2e.mjs         the tool end to end in a browser with real files
```

## The promise

- **Nothing leaves the device.** No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `sendBeacon`, remote import or remote worker, in a tool or a library it uses.
  `tests/local-only.test.mjs` scans the source; every e2e test fails on any request that isn't a GET
  to our own origin. The CSP allows `connect-src 'self'` only. The camera (QR scanning) is allowed;
  its stream never leaves the page.
- **Files live in memory only.** Never store a file, a picture or what someone typed or pasted
  (a password, a text, a JSON). Options are kept (below); content is not.
- **Results are ready before Save is tapped.** On the iPhone, Save opens the share sheet, and Safari
  only allows that straight from the tap: compute first, then let `SaveButton` hand them out.

## The component

```svelte
<script lang="ts">
  let { tool, items }: { tool: Tool; items: Item[] } = $props();
</script>
```

- `tool` is the catalog entry. `items` is what waited in the inbox (dropped or pasted on the home,
  or a result from another tool): `files(items)` and `texts(items)` from `lib/inbox.svelte.ts`.
  Read them once, at setup, inside `untrack(() => …)`.
- The page around the tool (crumbs, the h1, the description, Pin, "Worked on this device") is the
  shell's. The tool renders only its own body.
- **Words:** every visible string through `words({ en, de })` from `lib/i18n.svelte.ts`, with
  `{name}` placeholders; `w('key', { name })`. Both languages, written for people: short, plain,
  present tense, `du` in German, no exclamation marks. The UI words follow the round-2 looks
  (`plans/fundus/looks.html` in the workspace): "Save", "Add photos", "Copy".
- **Options the tool keeps:** `const o = remember('<id>', { mode: 'a' as 'a' | 'b', … })` at the top
  of the script; `o.mode = 'b'` saves it. Only choices, never content.
- **Shared settings:** read `shared.photoFormat`, `shared.quality` (0–100), `shared.stripLocation`,
  `shared.pageSize` ('a4' | 'letter'), `shared.units` ('metric' | 'imperial'), `shared.decimal`
  ('comma' | 'point'), `shared.week` ('iso' | 'us'), `shared.homeZone`, `shared.names`
  ('suffix' | 'same'), `shared.passwordWords` ('en' | 'de'), from `lib/settings.svelte.ts`. Change
  one from inside the tool only with `setShared(key, value, message)`, whose toast says what changed
  for every tool ("Every photo tool now saves WebP", with Undo), and put `<SharedNote chip="photo" />`
  under that control.

## Layout: a spec sheet

```svelte
<div class="cols">
  <div class="stack"> the thing worked on: DropWell, the plate, FileRows, a text area </div>
  <div class="stack">
    <dl class="spec">
      <div><dt>Format</dt><dd><Seg … /></dd></div>
      <div><dt>Result</dt><dd><div class="big"><b>1.2 MB</b><s>3.8 MB</s><em>−68 %</em></div></dd></div>
    </dl>
    <SaveButton … />  <NextTools … />
  </div>
</div>
```

Two columns from 760 px, one on a phone. Global classes (`src/app.css`), don't give your own
elements these names for something else: `cols` (`.even` for equal halves, `> .wide` spans both),
`stack`, `spec`, `h` (a section heading over an ink rule, `<em>` for its note on the right), `big`,
`plate` (a framed picture: `.frame` holds the img or canvas, `figcaption` the facts), `work` (a
framed working area), `field` (a text input or textarea), `mono-out` (monospaced output text),
`btn` (`.small`, `.ink`), `link`, `note` (`.bad`), `error`, `label`, `m`, `u`, `hl` (the
highlighter), `sr` (screen readers only), `save`, `foot`.

Colours only from the tokens: `--ink`, `--ink-2` (secondary text), `--bg`, `--card`, `--sunk`,
`--rule`, `--mark` (the highlighter yellow, always with `--mark-ink` on it), `--ok`, `--bad`;
`--mono` and `--sans` for type. They switch with light and dark by themselves. One yellow mark per
screen region: the choice, or the answer. No other colour, no shadows, no rounded corners above 2 px.

## The kit (`src/components/kit/`)

| Component | For |
|---|---|
| `DropWell` | Files in: tap for the picker, drop on it, or paste anywhere while it's shown. `accept`, `multiple`, `title`, `hint`, `compact` (the "add more" well under a list), `onfiles(files)` |
| `FileRow` | One file: `name`, `meta`, `thumb` (object URL), `onremove`, an `actions` snippet for its buttons |
| `Seg` | A choice of a few (radios): `label`, `value`, `options [{ value, label, disabled?, title? }]`, `onchange`, `large` for a tool's main mode |
| `Check` | On or off (a switch): `checked`, `label`, `hint`, `onchange` |
| `NumIn` | A number to type, big and underlined: `value` (the text as typed), `label`, `unit`, `prefix`, `size` ('big' or 'mid'), `width`, `oninput`. Read it with `parseNumber()` |
| `Receipt` + `Line` | Results as a receipt: `Line label value copy hl total`; `copy` is what Copy copies (a plain number), `null` for no Copy |
| `CopyButton` | Copy a text: `text`, `variant` ('tag' or 'button') |
| `SaveButton` | The Save bar: `outputs` (`{ blob, name }[]`, or null while not ready), `busy`, `zipName`, `tool`, `label`. Share sheet on a phone, download elsewhere, a ZIP from the Many files count on |
| `NextTools` | Chaining: `items` (the result as `[{ file }]`), `from` (this tool's id), `prefer` (ids first) |
| `SharedNote` | "for every photo tool" under a shared setting: `chip` |

Folio's elements are vendored too (`vendor/ewo/elements/`: `slider.js`, `switch.js`,
`segmented.js`, `toaster.js` …); prefer the kit, which is drawn in this look. A toast:
`import { toast } from '../../../vendor/ewo/elements/toaster.js'; toast('Copied', { tone: 'ok' })`.
Icons: `@lucide/svelte`, 16–18 px, `aria-hidden="true"`.

## The libraries (`src/lib/`)

- **Files:** `kindOf(file)` / `sniff(bytes)` (the real type, from the bytes: 'jpeg', 'png', 'webp',
  'heic', 'avif', 'gif', 'pdf', 'other'), `dimensions(bytes)`, `formatBytes(n, shared.decimal)`,
  `outName(original, 'small', 'jpg', shared.names)` → `IMG_4127-small.jpg`.
- **Photos** (`images.ts`): `isPhoto(file)`, `decode(file)` → `{ bitmap, width, height }` (HEIC
  included: Safari natively, elsewhere libheif in WASM; upright already; `bitmap.close()` when
  done), `draw(bitmap, w, h, type, crop?)` → a canvas (white under a JPG), `encode(canvas, type,
  quality0to100, original, shared.stripLocation)` → `{ blob, type }` (puts the original's EXIF back
  when the setting keeps it), `targetType(kind, shared.photoFormat)`, `extOf(type)`,
  `canEncode('image/webp')` (Safari can't), `fit(w, h, maxW, maxH)`, `preview(blob).url`.
- **Metadata** (`exif.ts`): `readMeta(bytes)` → `{ make, model, lens, software, taken, orientation,
  gps: { lat, lon, alt } }`; `strip(bytes, 'location' | 'everything')` changes JPEG, PNG and WebP in
  place (null for HEIC: re-encode it).
- **PDFs** (`pdf.ts`): `openPdf(bytes)` (pdf.js, for reading and drawing), `renderPage(page, scale,
  rotation)` → a canvas. Writing PDFs: `const { PDFDocument } = await import('pdf-lib')`.
- **Work per file:** `perFile(files, key, work)` (`jobs.svelte.ts`). Every result depends on the
  options; the key names them, so a result made for other options is never offered. Use it for any
  tool that works on each file (Shrink shows how).
- **Numbers:** `parseNumber(typed)` reads "249,90", "1.234,5", "1,234.5" alike; `formatNumber(n,
  shared.decimal, { min, max, group })`, `formatMoney`, `roundCents`.
- **Text out:** `copyText(text)` (`save.ts`).

## Phones and computers alike

- 390 px wide, nothing sticks out sideways (each e2e file ends with a `fitsPhone()` test). Long
  names wrap or ellipsize (`min-width: 0` on grid children).
- Fields at 16 px or more on touch screens (`.field` and `NumIn` are), or the iPhone zooms in.
- Tap targets at least 40 px high. Keyboard: everything reachable, Enter does the obvious.
- Light and dark both: tokens only.
- Busy work (a big photo, a 40-page PDF) says what it's doing (`aria-live="polite"`), never freezes
  the page for more than a moment: `await` between files and pages.

## Tests

- **Unit** (`tests/tools/<id>.test.mjs`): the logic in `<id>.ts`, the way `percent` and `shrink`
  are tested. TypeScript there must be erasable (node strips the types): no `enum`, no `namespace`,
  no parameter properties, imports with their `.ts` ending, `import type` for types.
- **End to end** (`tests/e2e/<id>.e2e.mjs`): an object of named tests, `async (t) => {}`. Helpers:
  `open(path)`, `drop(names, nth?)` (sample files from `tests/fixtures/out`: `photo.heic`,
  `small.heic`, `photo.jpg` (3840 × 2160, iPhone 15 EXIF with GPS), `mid.jpg`, `mid-gps.jpg`
  (1600 px, Pixel 9 with GPS), `photo.png`, `photo.webp`, `letter.pdf` (3 pages, the last turned
  90°), `annex.pdf` (2 pages), `notes.txt`), `choose(group, option)`, `check(label, on)`,
  `fill(label, value)`, `save({ count })` → `{ name, bytes }` (or a list), `text(selector)`,
  `sees(text)`, `clipboard()` (Chromium), `fitsPhone()`, `shot(name, width)` (a full-page PNG in
  `test-results/` to look at), `bytes(name)`, `page` (Playwright), `assert`, `engine`.
  Check the output's bytes (its type with `sniff`, its size with `dimensions`, its metadata with
  `readMeta`, a PDF's pages with pdf-lib), not just that something happened.
- Run: `npm run check`, `npm test`, `node tests/e2e/run.mjs <ids> --port <n>` (Vite's dev server;
  `--prod` builds and runs the real server with its CSP, `--webkit` runs Safari's engine, `--dark`
  the dark theme).
  `npm run fixtures` makes the sample files once.

# Fundus

Everyday tools that run on your device: photos, PDFs, text, numbers, time and audio. Nothing you put in
leaves it. Live at [fundus.ewolution.cloud](https://fundus.ewolution.cloud).

- **A parts index.** Thirty-seven tools in six shelves, each with an article number whose hundreds are
  its shelf (F-102 Shrink a photo, F-502 Percent & VAT), what it takes and what it gives. A developer
  shelf of thirteen more (900) waits behind a switch in Settings.
- **Drop anything on the home.** A photo, a PDF, a sound, a table, a text, a link or a number,
  dropped, pasted or picked: the tools that take it come first, each with its reason ("It's a HEIC: make it a JPG",
  "It knows where it was taken").
- **One result into the next.** A tool's result goes on into the next tool with the file already
  in: shrink a photo, then blur a part of it, then put it in a PDF.
- **Settings that hold across tools.** The photo format, quality, removing the place when saving,
  the size target, paper size, units, the decimal mark, the CSV separator, the week, the home time
  zone, file names,
  when several files become one ZIP. Inside a tool such a choice says "for every photo tool" and
  its change comes with an undo.
- **Nothing leaves the device.** No uploads, no accounts. The CSP allows the page to talk to its
  own origin only (the visit counter), a test scans the code for network calls, and the
  end-to-end tests fail on any request that isn't a GET to our own origin. Files live in memory and
  are gone with the tab; options, pins and recents stay on the device.
- **The family's shell.** English and German, light and dark, installs to the home screen and works
  offline, every tool at its own address with its own link preview, Census counts visits without
  cookies.

## The tools

| No. | Tool | Shelf |
|---|---|---|
| F-101–110 | Convert photos, Shrink a photo, Resize & crop, Remove location, Blur parts, Photos to PDF, Make icons, Meme maker, Screenshot frame, Carousel slicer | Photo |
| F-201–203 | Arrange a PDF, Sign a PDF, PDF to photos | PDF |
| F-301–309 | Count words, Clean up text, Compare texts, Fix umlauts, CSV & Excel, Fancy text, Invisible characters, Teleprompter, Emoji picker | Text |
| F-401–404 | Make a QR code, Make a password, Colours, Coin, dice, pick one | From scratch |
| F-501–509 | Dates & weeks, Percent & VAT, Convert units, Time zones, Split a bill, Timers, Amount in words, Life in numbers, Flip clock | Numbers & time |
| F-601–602 | Convert audio, Hearing test | Audio |
| F-901–913 | Format JSON, Base64, Encode URLs, Timestamps, UUIDs, Hashes, JWTs, Regex, CSV ↔ JSON, YAML ↔ JSON, Number bases, Easing curves, Shadows | Developer (off by default) |

The catalog (`shared/catalog.mjs`) holds each tool's number, address, names, synonyms, what it takes
and gives, and the shared settings it reads; the home, search, detection, chaining, the page heads
and the sitemap all read it. A tool is one folder in `src/tools/`; `src/tools/README.md` is the
contract for writing one.

## How it works

- **Photos** are decoded in the page: Safari opens HEIC itself, other browsers get libheif in
  WebAssembly, loaded only when a HEIC arrives. Results are drawn on a canvas and encoded there. EXIF
  is read and removed byte by byte (`src/lib/exif.ts`): JPEG, PNG and WebP lose their place without
  being re-encoded; with "Remove location when saving" off, a re-encoded JPEG gets the original's
  EXIF back.
- **PDFs:** pdf.js reads and draws them (its fonts and character maps come from our own `/pdfjs/`),
  pdf-lib writes them, copying pages rather than redrawing them.
- **SVG** goes onto a canvas as a picture (`src/lib/svg.ts`): its size is read from the file and
  set before it loads, so it draws sharp at any size; one with `<foreignObject>` is refused up front
  (it would taint the canvas), and nothing it links to is loaded. Make icons draws one picture into
  every size a website and a home screen ask for, with the manifest, in one ZIP.
- **Sound:** the browser's own Web Audio decodes it (MP3, M4A, WAV, FLAC, Ogg, and a video's sound);
  WAV is written by hand, MP3 by LAME in a worker, shipped as its own unchanged file because its
  licence (LGPL) asks for that. A decoded minute of stereo is about 21 MB, so a file may run 20
  minutes on a phone and 60 on a computer.
- **Tables:** CSV is read and written by our own parser (`src/lib/csv.ts`): quotes, the separator
  and decimal mark found, UTF-16 and German Excel's Windows-1252. Each column gets a type, and one
  Excel would wreck (the postcode 01067, an IBAN, 16 digits) stays Text. `.xlsx` is read and written
  by read-excel-file and write-excel-file, in the page.
- **Saving:** on a phone, Save opens the share sheet (Save Image, Save to Files), so results are
  computed before the tap; on a computer it downloads. From five files on they go as one ZIP.
- **Offline:** the service worker keeps the shell and every file a tool has loaded; "Everything
  offline" in Settings loads all of them once.

## Run it

```bash
npm install
npm run dev         # http://localhost:7410
npm run check       # svelte-check
npm test            # unit tests: the libraries, each tool's logic, the page heads, the local-only scan
npm run fixtures    # sample files for the end-to-end tests (macOS: sips; Playwright's Chromium)
npm run test:e2e    # every tool in a real browser with real files; ids to pick, --prod, --webkit, --dark
npm run build && npm start   # the production server on :8080 (PORT to change it)
```

The end-to-end tests run locally before a push; CI runs the type check, the unit tests, the build
and a smoke test of the production server.

## Deploy (NAS)

A push to `release` runs the checks (`ci.yml`) and publishes `ghcr.io/ewolution94/fundus:latest`
(amd64 and arm64); the shared Watchtower deploys it. The stack is `deploy/portainer-stack.yml`, not
`docker-compose.yml` (that one builds from source).

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | Where the server listens (the NAS stack sets its registry port). |
| `HOST` | `0.0.0.0` | |
| `FUNDUS_ORIGIN` | `https://fundus.ewolution.cloud` | The origin in canonical links, link previews and the sitemap. |
| `FUNDUS_CENSUS` | off | Census's ingest origin (`http://census:4901` on the `ewolution` network). |
| `DASHBOARD_URL` | off | Dashboard's apps' port (`http://dashboard:8081` on the `ewolution` network): the language and theme a device that hasn't picked starts from (the family's, or Fundus's own). Off or down: the built-in ones, as before. |

## Project layout

```
shared/catalog.mjs   every tool: number, address, names, synonyms, takes and gives, shared settings
server/              server.mjs (static, page heads, sitemap, headers, Census), pages.mjs, census.mjs
src/tools/<id>/      one folder per tool: Tool.svelte and its logic (README.md: the contract)
src/lib/             files, images, exif, pdf, save, jobs, numbers, search, shapes, detect, inbox,
                     settings (shared), memory (options, pins, recents), i18n, router, theme
src/components/      the shell (Header, Home, Search, ToolPage, ToolHead, Settings, Licences) and kit/
vendor/ewo/          Folio's tokens and elements (npm run vendor -- fundus, in Folio)
tests/               node --test; e2e/ (Playwright, local), fixtures/ (npm run fixtures)
```

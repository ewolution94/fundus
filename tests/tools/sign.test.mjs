import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, crc32 } from 'node:zlib';
import { PDFDocument, PDFName, PDFArray, StandardFonts, degrees, decodePDFRawStream } from 'pdf-lib';
import { quarter, shownSize, toPdf, placeImage, placeText, clampBox, heightFor, formatDate, nextPoint, pieces, inkBounds, PEN, LINE, BASELINE } from '../../src/tools/sign/sign.ts';
import { stamp } from '../../src/tools/sign/stamp.ts';

// pdf.js's viewport at scale 1 (display_utils.js, PageViewport), written out here on its own, so
// the sums in sign.ts are checked against the way the page is actually drawn: a PDF point (x, y)
// lands at (a·x + c·y + e, b·x + d·y + f) on the page as shown.
function viewport(view, rotation) {
  const [x0, y0, x1, y1] = view;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const [a, b, c, d] = { 0: [1, 0, 0, -1], 90: [0, 1, 1, 0], 180: [-1, 0, 0, 1], 270: [0, -1, -1, 0] }[quarter(rotation)];
  const sideways = a === 0;
  const ox = sideways ? Math.abs(cy - y0) : Math.abs(cx - x0);
  const oy = sideways ? Math.abs(cx - x0) : Math.abs(cy - y0);
  const width = sideways ? y1 - y0 : x1 - x0;
  const height = sideways ? x1 - x0 : y1 - y0;
  const m = [a, b, c, d, ox - a * cx - c * cy, oy - b * cx - d * cy];
  return { width, height, shown: (x, y) => ({ u: (m[0] * x + m[2] * y + m[4]) / width, v: (m[1] * x + m[3] * y + m[5]) / height }) };
}

const close = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} ≠ ${b}`);

const VIEWS = [
  [0, 0, 595, 842],
  // A crop box that doesn't start at the origin.
  [20, 30, 412, 640],
];

test('quarters, and the size of a page as shown', () => {
  assert.equal(quarter(-90), 270);
  assert.equal(quarter(450), 90);
  assert.deepEqual(shownSize([0, 0, 595, 842], 0), { width: 595, height: 842 });
  assert.deepEqual(shownSize([0, 0, 595, 842], 90), { width: 842, height: 595 });
  assert.deepEqual(shownSize([20, 30, 412, 640], 270), { width: 610, height: 392 });
});

test('a point on the page as shown goes back to where pdf.js drew it, at every turn', () => {
  for (const view of VIEWS) {
    for (const rotation of [0, 90, 180, 270, -90, 450]) {
      const vp = viewport(view, rotation);
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [0.25, 0.8], [0.7, 0.1]]) {
        const p = toPdf(u, v, view, rotation);
        const back = vp.shown(p.x, p.y);
        close(back.u, u, `u at ${rotation}° ${view}`);
        close(back.v, v, `v at ${rotation}° ${view}`);
      }
    }
  }
});

test('turned 90°: the top-left as shown is the PDF’s bottom-left corner', () => {
  // letter.pdf's last page: an A4 page with /Rotate 90.
  assert.deepEqual(toPdf(0, 0, [0, 0, 595, 842], 90), { x: 0, y: 0 });
  assert.deepEqual(toPdf(1, 0, [0, 0, 595, 842], 90), { x: 0, y: 842 });
  assert.deepEqual(toPdf(0, 1, [0, 0, 595, 842], 90), { x: 595, y: 0 });
});

/** Where a picture drawn by pdf-lib with these numbers lands, as shown: its four corners. */
function corners(placed) {
  const r = (placed.rotate * Math.PI) / 180;
  const at = (ix, iy) => ({
    x: placed.x + ix * placed.width * Math.cos(r) - iy * placed.height * Math.sin(r),
    y: placed.y + ix * placed.width * Math.sin(r) + iy * placed.height * Math.cos(r),
  });
  return { bottomLeft: at(0, 0), bottomRight: at(1, 0), topLeft: at(0, 1) };
}

test('a picture lands in its box, upright as shown, at every turn', () => {
  const box = { x: 0.55, y: 0.7, w: 0.3, h: 0.08 };
  for (const view of VIEWS) {
    for (const rotation of [0, 90, 180, 270]) {
      const vp = viewport(view, rotation);
      const c = corners(placeImage(box, view, rotation));
      const bl = vp.shown(c.bottomLeft.x, c.bottomLeft.y);
      const br = vp.shown(c.bottomRight.x, c.bottomRight.y);
      const tl = vp.shown(c.topLeft.x, c.topLeft.y);
      const at = `${rotation}° ${view}`;
      close(bl.u, box.x, `left ${at}`);
      close(bl.v, box.y + box.h, `bottom ${at}`);
      close(br.u, box.x + box.w, `right ${at}`);
      close(br.v, box.y + box.h, `right stays level ${at}`);
      close(tl.u, box.x, `top stays above ${at}`);
      close(tl.v, box.y, `top ${at}`);
    }
  }
});

test('text: its baseline in the box, its size from the box’s height', () => {
  const view = [0, 0, 595, 842];
  const box = { x: 0.1, y: 0.5, w: 0.2, h: (12 * LINE) / 842 };
  const t = placeText(box, view, 0);
  close(t.size, 12, 'size');
  close(t.x, 59.5, 'x');
  close(t.y, 842 - (0.5 * 842 + 12 * LINE - BASELINE * 12), 'y');
  // Turned: the line still runs left to right as shown.
  for (const rotation of [90, 180, 270]) {
    const vp = viewport(view, rotation);
    const at = placeText(box, view, rotation);
    const r = (at.rotate * Math.PI) / 180;
    const start = vp.shown(at.x, at.y);
    const along = vp.shown(at.x + 10 * Math.cos(r), at.y + 10 * Math.sin(r));
    close(start.u, box.x, `start ${rotation}°`);
    assert.ok(along.u > start.u, `runs right at ${rotation}°`);
    close(along.v, start.v, `level at ${rotation}°`);
  }
});

test('boxes stay on the page', () => {
  assert.deepEqual(clampBox({ x: 0.9, y: -0.2, w: 0.3, h: 0.1 }), { x: 0.7, y: 0, w: 0.3, h: 0.1 });
  assert.deepEqual(clampBox({ x: 0.5, y: 0.5, w: 2, h: 0.1 }), { x: 0, y: 0.5, w: 1, h: 0.1 });
  const tiny = clampBox({ x: 0.5, y: 0.5, w: 0, h: 0 });
  assert.ok(tiny.w > 0 && tiny.h > 0);
  // A 4:1 signature 30 % of an A4 page wide.
  close(heightFor(0.3, 4, { width: 595, height: 842 }), (0.3 * 595) / 4 / 842, 'height keeps the shape');
});

test('the date as the language writes it', () => {
  const day = new Date(2026, 9, 31, 15, 0);
  assert.equal(formatDate(day, 'de'), '31.10.2026');
  assert.equal(formatDate(day, 'en'), 'Oct 31, 2026');
});

test('strokes: eased, thinner when fast, smooth through the samples', () => {
  const stroke = [];
  let last = null;
  const raw = [
    { x: 0.1, y: 0.5, t: 0 },
    { x: 0.11, y: 0.5, t: 16 },
    { x: 0.2, y: 0.45, t: 32 },
    { x: 0.35, y: 0.5, t: 48 },
    { x: 0.5, y: 0.52, t: 64 },
  ];
  raw.forEach((r, i) => {
    stroke.push(nextPoint(stroke, r, last, i === raw.length - 1));
    last = r;
  });
  assert.deepEqual([stroke[0].x, stroke[0].y], [0.1, 0.5], 'it starts where the finger did');
  assert.deepEqual([stroke[4].x, stroke[4].y], [0.5, 0.52], 'and ends where it lifted');
  assert.ok(stroke[2].x < 0.2 && stroke[2].x > 0.11, 'eased towards the finger');
  for (const p of stroke) assert.ok(p.w >= PEN.min - 1e-9 && p.w <= PEN.max + 1e-9, String(p.w));
  assert.ok(stroke[4].w < stroke[1].w, 'faster, thinner');
  const ps = pieces(stroke);
  assert.equal(ps.length, stroke.length - 1);
  assert.deepEqual(ps[0].from, stroke[0]);
  for (let i = 1; i < ps.length; i++) assert.deepEqual(ps[i].from, ps[i - 1].to, 'the pieces join');
  assert.deepEqual(ps.at(-1).to, stroke.at(-1), 'it ends where it ended');
  // A pen's pressure sets the width.
  assert.equal(nextPoint([], { x: 0, y: 0, t: 0, pressure: 1 }, null).w, PEN.max);
  // A tap is a dot.
  assert.equal(pieces([{ x: 0.3, y: 0.3, w: 0.01 }]).length, 1);
  const b = inkBounds([stroke]);
  close(b.left, 0.1 - stroke[0].w / 2, 'left');
  close(b.right, 0.5 + stroke[4].w / 2, 'right');
  close(b.top, Math.min(...stroke.map((p) => p.y - p.w / 2)), 'top');
  close(b.bottom, Math.max(...stroke.map((p) => p.y + p.w / 2)), 'bottom');
  assert.equal(inkBounds([]), null);
});

// ── The writer, on a real PDF ───────────────────────────────────────────────────────────────────

/** A PNG of w × h ink pixels, made by hand. */
function png(w, h) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'latin1');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows.set([20, 40, 120, 255], y * (w * 4 + 1) + 1 + x * 4);
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}

/** The operators a page's content streams hold, decoded. */
function operators(doc, page) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
  return streams.map((s) => new TextDecoder('latin1').decode(decodePDFRawStream(s).decode())).join('\n');
}

/** The pictures drawn on a page: where pdf-lib's cm matrices put the unit square. */
function drawnImages(text) {
  const found = [];
  for (const block of text.split(/\bQ\b/)) {
    if (!/\bDo\b/.test(block)) continue;
    const matrices = [...block.matchAll(/((?:-?[\d.]+(?:e-?\d+)?\s+){6})cm/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
    // Row vectors: the last cm applies first.
    const apply = (x, y) => matrices.reduceRight(([px, py], [a, b, c, d, e, f]) => [a * px + c * py + e, b * px + d * py + f], [x, y]);
    found.push({ bottomLeft: apply(0, 0), bottomRight: apply(1, 0), topLeft: apply(0, 1) });
  }
  return found;
}

test('stamp: the signature on the right page, in its box, upright on the turned one too', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) doc.addPage([595, 842]).drawText(`page ${i + 1}`, { x: 50, y: 700, size: 30, font });
  doc.getPage(2).setRotation(degrees(90));
  const bytes = await doc.save();
  const shown = [
    { view: [0, 0, 595, 842], rotation: 0 },
    { view: [0, 0, 595, 842], rotation: 0 },
    { view: [0, 0, 595, 842], rotation: 90 },
  ];
  const sig = png(8, 2);
  const onFirst = { x: 0.5, y: 0.75, w: 0.4, h: heightFor(0.4, 4, shownSize(shown[0].view, 0)) };
  const onTurned = { x: 0.6, y: 0.6, w: 0.3, h: heightFor(0.3, 4, shownSize(shown[2].view, 90)) };
  const out = await PDFDocument.load(
    await stamp(
      bytes,
      [
        { page: 0, box: onFirst, png: sig },
        { page: 2, box: onTurned, png: sig },
        { page: 2, box: { x: 0.6, y: 0.8, w: 0.2, h: 0.03 }, text: 'Oct 31, 2026' },
      ],
      shown,
      { r: 0.1, g: 0.2, b: 0.5 },
    ),
  );
  assert.equal(out.getPageCount(), 3);
  assert.equal(out.getPage(2).getRotation().angle, 90, 'the page keeps its turn');
  assert.deepEqual(drawnImages(operators(out, out.getPage(1))), [], 'nothing on page 2');
  for (const [i, box] of [
    [0, onFirst],
    [2, onTurned],
  ]) {
    const vp = viewport(shown[i].view, shown[i].rotation);
    const [img] = drawnImages(operators(out, out.getPage(i)));
    assert.ok(img, `a picture on page ${i + 1}`);
    const bl = vp.shown(...img.bottomLeft);
    const br = vp.shown(...img.bottomRight);
    const tl = vp.shown(...img.topLeft);
    close(bl.u, box.x, `left, page ${i + 1}`, 1e-3);
    close(bl.v, box.y + box.h, `bottom, page ${i + 1}`, 1e-3);
    close(br.u, box.x + box.w, `right, page ${i + 1}`, 1e-3);
    close(tl.v, box.y, `top, page ${i + 1}`, 1e-3);
    close(tl.u, box.x, `upright, page ${i + 1}`, 1e-3);
  }
  // The date is text, not a picture, in the ink chosen.
  const third = operators(out, out.getPage(2));
  assert.match(third, /\bTj\b/);
  assert.match(third, /0\.1 0\.2 0\.5 rg/);
  // One picture in the file, used twice.
  const xobjects = out.context.enumerateIndirectObjects().filter(([, o]) => o.dict?.get(PDFName.of('Subtype'))?.toString() === '/Image');
  assert.equal(xobjects.length, 1);
});

test('stamp: text Helvetica can’t write goes in as its picture', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const out = await PDFDocument.load(
    await stamp(await doc.save(), [{ page: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.03 }, text: 'Łukasz Żółć', textPng: png(10, 1) }], [{ view: [0, 0, 595, 842], rotation: 0 }], { r: 0, g: 0, b: 0 }),
  );
  assert.equal(drawnImages(operators(out, out.getPage(0))).length, 1);
  // Without the picture, it says so instead of writing something wrong.
  await assert.rejects(stamp(await doc.save(), [{ page: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.03 }, text: 'Łukasz' }], [{ view: [0, 0, 595, 842], rotation: 0 }], { r: 0, g: 0, b: 0 }));
});

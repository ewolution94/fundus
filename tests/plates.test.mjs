import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOOLS } from '../shared/catalog.mjs';

// Each tool's two figures: its drawer on the wall (src/tools/<id>/drawer.svg) and its specimen plate
// in its head (src/tools/<id>/plate.ts). Whether they look right is the e2e's and the contact sheet's
// (tests/plates/sheet.mjs); here, that they're there and keep to their family.

const read = (id, file) => readFile(new URL(`../src/tools/${id}/${file}`, import.meta.url), 'utf8');

// What specimen.css draws; a figure that needs another class needs it there first.
const PLATE_CLASSES = new Set(['o', 'c', 'h', 'cl', 'd', 'a', 'f', 't', 't2', 'k', 'bal', 'mm', 'w', 'fq', 'bar', 'dg', 'pw', 'pwd', 'pwc', 'dn', 'up', 'rise', 'ex', 'ey', 'dot', 'mod']);

test('every tool has a drawer: one icon on the 48 grid, no words in it', async () => {
  for (const tool of TOOLS) {
    const svg = await read(tool.id, 'drawer.svg');
    assert.match(svg, /^<svg class="i[ "][^>]*viewBox="0 0 48 48" aria-hidden="true" focusable="false">/, tool.id);
    assert.doesNotMatch(svg, /<text|<script|\son\w+=|href=/, `${tool.id}: lines only`);
  }
});

test("every tool has a plate, in both languages, drawn with the family's parts", async () => {
  for (const tool of TOOLS) {
    const figure = (await import(`../src/tools/${tool.id}/plate.ts`)).default;
    for (const lang of ['en', 'de']) {
      const svg = figure(lang);
      assert.ok(svg.length > 200 && /class="o\b/.test(svg), `${tool.id} (${lang}): drawn with object lines`);
      assert.doesNotMatch(svg, /<script|\son\w+=|href=|<svg/, `${tool.id} (${lang}): only shapes and notes`);
      for (const [, list] of svg.matchAll(/class="([^"]+)"/g))
        for (const name of list.split(' ')) assert.ok(PLATE_CLASSES.has(name), `${tool.id} (${lang}): class "${name}" isn't one specimen.css draws`);
      // Every part comes in within the draw (about 1.4 s; Specimen.svelte ends it at 2 s).
      for (const [, at, dur = '0'] of svg.matchAll(/--d:([\d.]+)s(?:;--t:([\d.]+)s)?/g))
        assert.ok(Number(at) + Number(dur) <= 1.8, `${tool.id} (${lang}): a part ends at ${Number(at) + Number(dur)} s`);
    }
  }
});

test("a plate's notes are capitals, as on a drawing", async () => {
  for (const tool of TOOLS) {
    const figure = (await import(`../src/tools/${tool.id}/plate.ts`)).default;
    for (const lang of ['en', 'de'])
      for (const [, cls, text] of figure(lang).matchAll(/<text class="([^"]+)"[^>]*>([^<]*)<\/text>/g))
        if (cls === 't' || cls === 't t2') {
          // Units and number prefixes keep their own case (kHz, ms, 0x).
          const words = text.replace(/&\w+;/g, '').replace(/\b(kHz|ms|px)\b|\b0[box]/g, '');
          assert.equal(words, words.toUpperCase(), `${tool.id} (${lang}): "${text}"`);
        }
  }
});

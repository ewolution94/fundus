import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPages } from '../server/pages.mjs';
import { TOOLS } from '../shared/catalog.mjs';

const pages = createPages({ origin: 'https://fundus.ewolution.cloud' });

test('each tool’s address has its own title, description and canonical URL', async () => {
  const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const tool of TOOLS) {
    const { status, html } = pages.render(template, `/${tool.path}`);
    assert.equal(status, 200);
    assert.ok(html.includes(`<title>${tool.name.en.replace(/&/g, '&amp;')} · Fundus</title>`), tool.id);
    assert.ok(html.includes(`<link rel="canonical" href="https://fundus.ewolution.cloud/${tool.path}"`), tool.id);
    assert.ok(html.includes('Runs on your device.'), tool.id);
  }
});

test('German heads in German, a trailing slash is the same page, unknown is a 404', () => {
  assert.equal(pages.describe('/percent-and-vat/', 'de').title, 'Prozent & MwSt. · Fundus');
  assert.equal(pages.describe('/nope', 'en').status, 404);
  assert.equal(pages.describe('/', 'en').status, 200);
  assert.equal(pages.describe('/licences', 'en').status, 200);
});

test('the sitemap lists the home and every tool', () => {
  const xml = pages.sitemap();
  assert.equal((xml.match(/<url>/g) ?? []).length, TOOLS.length + 1);
});

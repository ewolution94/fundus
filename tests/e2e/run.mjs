// The tools end to end, in a real browser with real files (tests/fixtures/out, `npm run fixtures`).
//
//   node tests/e2e/run.mjs [tool ids…] [--prod] [--webkit] [--dark] [--port N] [--headed] [--grep words]
//
// Each tests/e2e/<id>.e2e.mjs exports an object of named tests: `async (t) => {}` with the helpers
// below. Every test runs in a fresh browser context and fails, on top of its own asserts, when the
// page asks anything of another origin, sends anything but a GET to its own (the visit beacon
// aside), or logs an error. That's Fundus's promise, checked on every tool: nothing leaves the device.
//
// By default it runs Vite's dev server (quick, for building a tool). --prod builds and runs the real
// server, with its CSP; run that before a push. --webkit runs Safari's engine instead of Chromium,
// --dark the dark theme. Each port gets its own Vite cache, so runs on different ports don't trip
// over each other.
// Locally only: CI runs the unit tests and the server's smoke test.

import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtures = path.join(root, 'tests/fixtures/out');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : fallback;
};
const prod = flag('--prod');
const engine = flag('--webkit') ? webkit : chromium;
const port = Number(option('--port', prod ? 7413 : 7412));
const grep = option('--grep', '');
const ids = args.filter((a, i) => !a.startsWith('--') && !['--port', '--grep'].includes(args[i - 1]));
const base = `http://localhost:${port}`;

try {
  await stat(path.join(fixtures, 'photo.jpg'));
} catch {
  console.error('No sample files yet: run `npm run fixtures` first.');
  process.exit(1);
}

// The server: Vite's, or the production one on a fresh build.
let stop;
if (prod) {
  if (!flag('--no-build')) {
    const { build } = await import('vite');
    await build({ root, logLevel: 'warn' });
  }
  const child = spawn(process.execPath, ['server/server.mjs', '--port', String(port)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  stop = () => child.kill('SIGTERM');
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) break;
    } catch {}
    if (i > 100) throw new Error('The server did not start');
    await new Promise((r) => setTimeout(r, 100));
  }
} else {
  const { createServer } = await import('vite');
  const server = await createServer({ root, logLevel: 'warn', cacheDir: path.join(root, `node_modules/.vite-e2e-${port}`), server: { port, strictPort: true, hmr: false } });
  await server.listen();
  stop = () => server.close();
}

const files = (await readdir(path.join(root, 'tests/e2e'))).filter((f) => f.endsWith('.e2e.mjs')).sort();
const chosen = files.filter((f) => !ids.length || ids.includes(f.replace('.e2e.mjs', '')));
if (!chosen.length) {
  console.error(`No tests for ${ids.join(', ')}`);
  await stop();
  process.exit(1);
}

const browser = await engine.launch({ headless: !flag('--headed') });
let passed = 0;
const failures = [];

for (const file of chosen) {
  const id = file.replace('.e2e.mjs', '');
  const tests = (await import(path.join(root, 'tests/e2e', file))).default;
  console.log(`\n${id}`);
  for (const [name, run] of Object.entries(tests)) {
    if (grep && !name.includes(grep)) continue;
    const started = Date.now();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      colorScheme: flag('--dark') ? 'dark' : 'light',
      timezoneId: 'Europe/Berlin',
      acceptDownloads: true,
      permissions: engine === chromium ? ['clipboard-read', 'clipboard-write'] : [],
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const problems = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol === 'data:' || url.protocol === 'blob:') return;
      if (url.origin !== base) problems.push(`asked another origin: ${request.method()} ${request.url()}`);
      else if (request.method() !== 'GET' && url.pathname !== '/_e') problems.push(`sent: ${request.method()} ${url.pathname}`);
      else if (url.pathname === '/_e' && (request.postData()?.length ?? 0) > 2000) problems.push('the visit beacon carried more than a visit');
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      // The dev server's own chatter isn't the app's.
      if (message.type() === 'error' && !/\[vite\]/.test(message.text())) problems.push(`console: ${message.text()}`);
    });
    const t = helpers(page, id);
    try {
      await run(t);
      if (problems.length) throw new Error(problems.join('\n      '));
      passed++;
      console.log(`  ✓ ${name} (${Date.now() - started} ms)`);
    } catch (error) {
      failures.push(`${id}: ${name}`);
      console.log(`  ✗ ${name}\n      ${String(error?.message ?? error).split('\n').join('\n      ')}`);
      if (problems.length && !String(error?.message).includes(problems[0])) console.log(`      ${problems.join('\n      ')}`);
      const shot = path.join(root, 'test-results', `${id}-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.log(`      screenshot: ${path.relative(root, shot)}`);
    }
    await context.close();
  }
}

await browser.close();
await stop();
console.log(`\n${passed} passed, ${failures.length} failed${failures.length ? `:\n  ${failures.join('\n  ')}` : ''}`);
process.exit(failures.length ? 1 : 0);

/** What a test gets. */
function helpers(page, id) {
  const fixture = (name) => path.join(fixtures, name);
  const t = {
    page,
    assert,
    base,
    engine: engine.name(),
    fixture,
    /** A sample file's bytes. */
    bytes: async (name) => new Uint8Array(await readFile(fixture(name))),
    /** Opens a path and waits for its tool to be in. */
    async open(p) {
      await page.goto(base + p);
      if (p !== '/') await page.waitForSelector('main[data-ready]');
    },
    /** Puts sample files into the tool's file picker (the first one on the page, or `nth`). */
    async drop(names, nth = 0) {
      const list = (Array.isArray(names) ? names : [names]).map(fixture);
      await page.locator('input[type=file]').nth(nth).setInputFiles(list);
    },
    /** Picks an option in a Seg by its group's label and the option's words. */
    async choose(group, option) {
      await page.getByRole('radiogroup', { name: group }).getByRole('radio', { name: option, exact: true }).click();
    },
    /** Flips a Check (a switch) by its words to on or off: the exact words first ("A–Z" isn't
     *  "a–z"), else the words a name with a hint starts with. */
    async check(label, on) {
      const exact = page.getByRole('switch', { name: label, exact: true });
      const box = (await exact.count()) ? exact : page.getByRole('switch', { name: label }).first();
      if ((await box.getAttribute('aria-checked')) !== String(on)) await box.click();
    },
    /** Fills a field by its label. */
    async fill(label, value) {
      await page.getByLabel(label, { exact: true }).fill(value);
    },
    /** The Save bar, once it's ready, clicked; resolves to the saved file(s). One download, or one each. */
    async save({ count = 1, timeout = 30_000 } = {}) {
      const button = page.locator('button.save');
      await button.waitFor();
      await page.waitForFunction(() => !document.querySelector('button.save')?.disabled, null, { timeout });
      const downloads = [];
      const got = new Promise((resolve) => {
        page.on('download', async function on(d) {
          downloads.push({ name: d.suggestedFilename(), bytes: new Uint8Array(await readFile(await d.path())) });
          if (downloads.length === count) {
            page.off('download', on);
            resolve();
          }
        });
      });
      await button.click();
      await Promise.race([got, new Promise((_, reject) => setTimeout(() => reject(new Error(`Saved ${downloads.length} of ${count} files`)), timeout))]);
      return count === 1 ? downloads[0] : downloads;
    },
    /** The text of the first match, trimmed. */
    async text(selector) {
      return (await page.locator(selector).first().innerText()).trim();
    },
    /** Waits until the page shows a text. */
    async sees(text, timeout = 20_000) {
      await page.getByText(text, { exact: false }).first().waitFor({ timeout });
    },
    /** What the clipboard holds (Chromium only; WebKit gives no access). */
    async clipboard() {
      return page.evaluate(() => navigator.clipboard.readText());
    },
    /** A screenshot to look at: test-results/<tool>-<name>[-dark].png, the whole page, at `width`. */
    async shot(name, width = 1280) {
      const size = page.viewportSize();
      if (width !== size.width) await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await page.waitForTimeout(150);
      const file = path.join(root, 'test-results', `${id}-${name}${flag('--dark') ? '-dark' : ''}.png`);
      await page.screenshot({ path: file, fullPage: true });
      if (width !== size.width) await page.setViewportSize(size);
      return file;
    },
    /** At 390 px wide nothing may stick out sideways. */
    async fitsPhone() {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      const over = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > width + 1);
        return { scroll: document.documentElement.scrollWidth, width, wide: wide.slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`) };
      });
      assert.ok(over.scroll <= over.width, `wider than the phone: ${over.scroll} > ${over.width} (${over.wide.join(', ')})`);
      await page.setViewportSize({ width: 1280, height: 900 });
    },
  };
  return t;
}

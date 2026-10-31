// Fundus's promise in code: nothing the app runs talks to a network. The service worker (public/sw.js)
// is the one exception, and it only fetches from our own origin. The end-to-end tests watch every
// request on top of this.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|svelte|mjs|js)$/.test(entry.name)) yield full;
  }
}

const NETWORK = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bsendBeacon\b/,
  /\bRTCPeerConnection\b/,
  /\bimport\s*\(\s*['"`]https?:/,
  /\bfrom\s+['"]https?:/,
  /\bimportScripts\s*\(/,
  /new\s+Worker\s*\(\s*['"`]https?:/,
];

test('no tool, library or shell code reaches for the network', async () => {
  const found = [];
  for (const dir of ['src', 'shared']) {
    for await (const file of walk(path.join(root, dir))) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        // Comments may talk about it.
        if (/^\s*(\/\/|\*|<!--)/.test(line)) return;
        for (const re of NETWORK) if (re.test(line)) found.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
      });
    }
  }
  assert.deepEqual(found, []);
});

test('the CSP lets the page talk only to its own origin', async () => {
  const server = await readFile(path.join(root, 'server/server.mjs'), 'utf8');
  assert.match(server, /connect-src 'self'/);
  assert.doesNotMatch(server, /connect-src[^;]*https?:/);
});

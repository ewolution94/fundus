// Production server: serves the built page from ../dist, each tool's address with its own title and
// link preview (pages.mjs), and the Census forwarder, and puts Dashboard's defaults into the page
// (Folio's config-server; the manifest is public/ewo.config.json). No dependencies and no state:
// every tool works on the device, so nothing a tool is given ever reaches this server.
//
//   PORT=8080 HOST=0.0.0.0 node server/server.mjs
//
// The environment variables are in the README.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createCensus } from './census.mjs';
import { createPages } from './pages.mjs';
import { createConfig } from '../vendor/ewo/elements/config-server.js';

const portFlag = process.argv.indexOf('--port');
const PORT = Number(portFlag > -1 ? process.argv[portFlag + 1] : (process.env.PORT ?? 8080));
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const ORIGIN = process.env.FUNDUS_ORIGIN ?? 'https://fundus.ewolution.cloud';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.bcmap': 'application/octet-stream',
  '.icc': 'application/vnd.iccprofile',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.xml', '.wasm', '.pfb', '.ttf', '.bcmap']);

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  // https only from the first secure visit on (browsers ignore it over plain http).
  'strict-transport-security': 'max-age=31536000',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  // The QR tool reads a code with the camera; nothing else asks for a device.
  'permissions-policy': 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  'content-security-policy': [
    "default-src 'self'",
    // WebAssembly: the HEIC decoder and pdf.js's image decoders compile in the page.
    "script-src 'self' 'wasm-unsafe-eval'",
    // Svelte writes style="" attributes (a crop box, a progress bar); the shared elements use
    // constructable stylesheets.
    "style-src 'self' 'unsafe-inline'",
    // Every picture a tool shows is a blob: or data: URL made on the device.
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    // The promise, enforced: the page can talk to its own origin only, which serves files and counts
    // visits (Census). No tool ever sends what it's given anywhere.
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
};

const census = createCensus({ target: process.env.FUNDUS_CENSUS ?? '', site: 'fundus' });
const pages = createPages({ origin: ORIGIN });
const compressed = new Map();

// Dashboard's values for Fundus (the language and theme a device that hasn't picked starts from),
// checked against the manifest. Until Dashboard answers, and whenever it's down, the built-in ones:
// the page as it ships. Never part of /healthz.
const config = createConfig({
  manifest: JSON.parse(await readFile(path.join(DIST, 'ewo.config.json'), 'utf8')),
  url: process.env.DASHBOARD_URL ?? '',
});
config.start();

// The built page, read once, and with the current values in it (#ewo-config, a data block the CSP
// allows), made again only when they change.
let built = null;
let template = { etag: '', html: '' };

async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.join(DIST, path.normalize(decoded));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return null;
  try {
    const info = await stat(file);
    if (info.isFile()) return { file, size: info.size, mtime: info.mtime };
  } catch {}
  return null;
}

function send(req, res, status, headers, raw, ext) {
  const accept = req.headers['accept-encoding'] ?? '';
  const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (encoding && COMPRESSIBLE.has(ext)) {
    const body = encoding === 'br' ? zlib.brotliCompressSync(raw) : zlib.gzipSync(raw);
    res.writeHead(status, { ...headers, 'content-encoding': encoding, 'content-length': body.length, vary: 'accept-encoding' });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  res.writeHead(status, { ...headers, 'content-length': raw.length });
  res.end(req.method === 'HEAD' ? undefined : raw);
}

/** The page for an address: a tool's, the licences', the home's, or the home's with a 404. */
async function servePage(req, res, pathname) {
  built ??= await readFile(path.join(DIST, 'index.html'), 'utf8');
  if (template.etag !== config.etag()) template = { etag: config.etag(), html: config.inject(built) };
  const lang = /^\s*de\b/i.test(req.headers['accept-language'] ?? '') ? 'de' : 'en';
  const page = pages.render(template.html, pathname, lang);
  const headers = { 'content-type': MIME['.html'], 'cache-control': 'no-cache', vary: 'accept-language' };
  send(req, res, page.status, headers, Buffer.from(page.html), '.html');
}

async function serveStatic(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/sitemap.xml') {
    return send(req, res, 200, { 'content-type': MIME['.xml'], 'cache-control': 'no-cache' }, Buffer.from(pages.sitemap()), '.xml');
  }
  if (pathname === '/robots.txt') {
    return send(req, res, 200, { 'content-type': MIME['.txt'], 'cache-control': 'no-cache' }, Buffer.from(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`), '.txt');
  }
  if (pathname === '/' || pathname === '/index.html') return servePage(req, res, '/');

  const entry = await resolveFile(pathname);
  // A path without an extension is a page: a tool's address, or a typo, which gets the home with a
  // 404. A missing file with an extension stays a plain 404, so an old /assets/ name after a deploy
  // never gets the HTML.
  if (!entry) {
    if (!path.extname(pathname)) return servePage(req, res, pathname);
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  // The page by another spelling of its name still carries Dashboard's values.
  if (entry.file === path.join(DIST, 'index.html')) return servePage(req, res, '/');

  const ext = path.extname(entry.file);
  const headers = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'last-modified': entry.mtime.toUTCString(),
  };

  const accept = req.headers['accept-encoding'] ?? '';
  const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (encoding && COMPRESSIBLE.has(ext) && entry.size < 8 * 1024 * 1024) {
    const key = `${entry.file}:${entry.mtime.getTime()}:${encoding}`;
    let body = compressed.get(key);
    if (!body) {
      const raw = await readFile(entry.file);
      body = encoding === 'br' ? zlib.brotliCompressSync(raw) : zlib.gzipSync(raw);
      compressed.set(key, body);
    }
    res.writeHead(200, { ...headers, 'content-encoding': encoding, 'content-length': body.length, vary: 'accept-encoding' });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }

  res.writeHead(200, { ...headers, 'content-length': entry.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(entry.file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') return res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

  try {
    if (await census(req, res)) return;
    // The installed app's share target is answered by the service worker, which keeps the files on
    // the device. Before it's running the post lands here: open the app, and drop what came (unread).
    if (req.method === 'POST' && req.url?.startsWith('/share-target')) {
      req.resume();
      res.writeHead(303, { location: '/' }).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end('Internal error');
    else res.destroy();
  }
});

// Docker stops containers with SIGTERM, which Node ignores as PID 1 unless handled; without
// this, every Watchtower update waits out the 10 s grace period and then kills us.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Fundus listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});

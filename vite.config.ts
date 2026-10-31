import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
// @ts-expect-error: a plain .mjs module shared with the production server
import { createCensus } from './server/census.mjs';

// The dev server answers Census's /_e with the same code as production (it counts nothing locally).
function censusRoute(): Plugin {
  const census = createCensus({ site: 'fundus' });
  const middleware = async (req: any, res: any, next: (error?: unknown) => void) => {
    try {
      if (await census(req, res)) return;
      next();
    } catch (error) {
      next(error);
    }
  };
  return {
    name: 'fundus-census',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

// pdf.js reads a PDF's standard fonts, character maps and colour profiles as files, and decodes some
// images in WebAssembly. They're served from our own origin under /pdfjs/ (the CSP allows nothing
// else): straight from node_modules in dev, copied into dist/ by the build.
const PDFJS = path.resolve('node_modules/pdfjs-dist');
const PDFJS_DIRS = ['standard_fonts', 'cmaps', 'iccs', 'wasm'];
/** What "Everything offline" keeps: the fonts, colour profiles and decoders (the character maps,
 *  170 files for CJK text, load as a PDF needs them). */
async function pdfjsIndex(): Promise<string> {
  const files: string[] = [];
  for (const dir of ['standard_fonts', 'iccs', 'wasm']) {
    for (const name of await readdir(path.join(PDFJS, dir))) if (!name.startsWith('LICENSE')) files.push(`/pdfjs/${dir}/${name}`);
  }
  return JSON.stringify(files);
}
function pdfjsFiles(): Plugin {
  return {
    name: 'fundus-pdfjs-files',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/pdfjs/')) return next();
        if (url.pathname === '/pdfjs/index.json') {
          res.setHeader('content-type', 'application/json');
          return res.end(await pdfjsIndex());
        }
        const rel = path.normalize(decodeURIComponent(url.pathname.slice('/pdfjs/'.length)));
        const file = path.join(PDFJS, rel);
        if (!file.startsWith(PDFJS + path.sep) || !PDFJS_DIRS.includes(rel.split(path.sep)[0])) return next();
        try {
          if (!(await stat(file)).isFile()) return next();
          res.setHeader('content-type', file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
          res.end(await readFile(file));
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      for (const dir of PDFJS_DIRS) await cp(path.join(PDFJS, dir), path.resolve('dist/pdfjs', dir), { recursive: true });
      await writeFile(path.resolve('dist/pdfjs/index.json'), await pdfjsIndex());
    },
  };
}

export default defineConfig({
  plugins: [svelte(), censusRoute(), pdfjsFiles()],
  // 7400 is the NAS port; locally the app runs beside it.
  server: { port: 7410, strictPort: true },
  preview: { port: 7411, strictPort: true },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    cssTarget: ['chrome123', 'safari17.5', 'firefox120'],
    // The CSP allows fonts from 'self' only, not data: (learnings/toolchain.md).
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
  },
});

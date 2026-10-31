<!--
  The libraries Fundus is built on and their licences. libheif is LGPL-3.0: it ships as its own file,
  unchanged, and its source is linked here, so anyone can swap it for their own build.
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte.ts';
  import { nav } from '../lib/router.svelte.ts';

  const LIBS = [
    { name: 'Svelte', licence: 'MIT', url: 'https://github.com/sveltejs/svelte', use: 'The page' },
    { name: 'pdf.js', licence: 'Apache-2.0', url: 'https://github.com/mozilla/pdf.js', use: 'F-201, F-202, F-203: reading and drawing PDFs' },
    { name: 'pdf-lib', licence: 'MIT', url: 'https://github.com/Hopding/pdf-lib', use: 'F-106, F-201, F-202: writing PDFs' },
    { name: 'libheif (libheif-js)', licence: 'LGPL-3.0', url: 'https://github.com/catdad-experiments/libheif-js', use: 'HEIC photos in browsers that can’t open them (not Safari). Source of libheif: github.com/strukturag/libheif' },
    { name: 'fflate', licence: 'MIT', url: 'https://github.com/101arrowz/fflate', use: 'ZIP files' },
    { name: 'uqr', licence: 'MIT', url: 'https://github.com/unjs/uqr', use: 'F-401: drawing QR codes' },
    { name: 'jsQR', licence: 'Apache-2.0', url: 'https://github.com/cozmo/jsQR', use: 'F-401: reading QR codes' },
    { name: 'jsdiff', licence: 'BSD-3-Clause', url: 'https://github.com/kpdecker/jsdiff', use: 'F-303: comparing texts' },
    { name: 'EFF large wordlist', licence: 'CC BY 3.0 US', url: 'https://www.eff.org/dice', use: 'F-402: English passphrases' },
    { name: 'German wordlist (dys2p/wordlists-de, de-7776-v1)', licence: 'CC0-1.0', url: 'https://github.com/dys2p/wordlists-de', use: 'F-402: German passphrases' },
    { name: 'Lucide', licence: 'ISC', url: 'https://github.com/lucide-icons/lucide', use: 'Icons' },
    { name: 'Schibsted Grotesk', licence: 'OFL-1.1', url: 'https://github.com/schibsted/schibsted-grotesk', use: 'Type' },
    { name: 'Martian Mono', licence: 'OFL-1.1', url: 'https://github.com/evilmartians/mono', use: 'Type' },
  ];

  $effect(() => {
    document.title = `${t('licences.title')} · Fundus`;
  });
</script>

<main class="sheet">
  <header class="head">
    <nav class="crumbs m"><a href="/" onclick={nav}>Fundus</a> / <span>{t('licences.title')}</span></nav>
    <h1>{t('licences.title')}</h1>
    <p class="note">{t('licences.intro')}</p>
  </header>
  <dl class="spec">
    {#each LIBS as lib (lib.name)}
      <div>
        <dt>{lib.licence}</dt>
        <dd><a href={lib.url} target="_blank" rel="noopener noreferrer"><b>{lib.name}</b></a><span class="note">{lib.use}</span></dd>
      </div>
    {/each}
  </dl>
</main>

<style>
  .head {
    display: grid;
    gap: 6px;
  }

  .crumbs {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .crumbs a {
    text-decoration: none;
  }

  h1 {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .spec > div {
    grid-template-columns: 110px minmax(0, 1fr);
  }

  a {
    text-underline-offset: 3px;
  }
</style>

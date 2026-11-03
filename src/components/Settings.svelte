<!--
  Settings, the family's way (Folio's ewo-sheet, General first with ewo-settings-basics), then the
  shared settings every tool reads, each with the tools that use it ("Used by F-101, F-102", each
  number naming its tool). A sheet on a phone, a drawer at the right on a computer (look B, round 2).
-->
<script lang="ts">
  import Seg from './kit/Seg.svelte';
  import Check from './kit/Check.svelte';
  import UsedBy from './kit/UsedBy.svelte';
  import { ui, type Language, type View } from '../lib/prefs.svelte.ts';
  import { theme, type ThemePreference } from '../lib/theme.svelte.ts';
  import { prefs } from '../lib/prefs.svelte.ts';
  import { setLanguage, t } from '../lib/i18n.svelte.ts';
  import { shared, isDefault, type SharedKey, type PhotoFormat } from '../lib/settings.svelte.ts';
  import { TOOLS } from '../lib/catalog.ts';
  import { forgetOptions, yours } from '../lib/memory.svelte.ts';
  import { loadAll } from '../lib/loaders.ts';
  import { nav } from '../lib/router.svelte.ts';
  import { toast } from '../../vendor/ewo/elements/toaster.js';

  const touchOnly = matchMedia('(hover: none)').matches;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);

  // The content stays until the sheet's `close`, which fires after its exit animation.
  let shown = $state(false);
  $effect(() => {
    if (ui.settings) shown = true;
  });

  function closed() {
    shown = false;
    ui.settings = false;
  }

  const usedBy = (key: SharedKey) => TOOLS.filter((tool) => (tool.shared as string[]).includes(key));

  const zones = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      return [shared.homeZone];
    }
  })();

  let offlineBusy = $state(false);
  async function offline(on: boolean) {
    shared.offline = on;
    if (!on) return;
    offlineBusy = true;
    toast(t('set.offline.working'), { duration: 1800 });
    await loadAll();
    offlineBusy = false;
    toast(t('set.offline.done'), { tone: 'ok' });
  }
</script>

<ewo-sheet class="settings" open={ui.settings} label={t('settings.title')} oncancel={() => (ui.settings = false)} onclose={closed}>
  <span slot="heading" class="heading"><b>{t('settings.title')}</b><span>{t('settings.line')}</span></span>

  {#if shown}
    <section>
      <h3 class="h">{t('settings.general')}</h3>
      <ewo-settings-basics
        language={prefs.language}
        theme={theme.preference}
        onlanguage-change={(e) => setLanguage(e.detail.value as Language)}
        ontheme-change={(e) => theme.set(e.detail.value as ThemePreference)}
      ></ewo-settings-basics>
    </section>

    <section>
      <h3 class="h">{t('settings.photos')}</h3>
      <div class="set">
        <div class="l"><b>{t('set.photoFormat')}</b><small>{shared.photoFormat === 'same' ? t('set.photoFormat.sameHint') : t('set.photoFormat.hint')}</small></div>
        <Seg
          label={t('set.photoFormat')}
          value={shared.photoFormat}
          options={[
            { value: 'same', label: t('set.photoFormat.same') },
            { value: 'jpg', label: 'JPG' },
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WebP' },
          ] as { value: PhotoFormat; label: string }[]}
          onchange={(v) => (shared.photoFormat = v)}
        />
        <UsedBy tools={usedBy('photoFormat')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.quality')}</b><small>JPG · WebP</small></div>
        <Seg
          label={t('set.quality')}
          value={shared.quality}
          options={[
            { value: 70, label: t('set.quality.small') },
            { value: 85, label: t('set.quality.good') },
            { value: 95, label: t('set.quality.best') },
          ]}
          onchange={(v) => (shared.quality = v)}
        />
        <UsedBy tools={usedBy('quality')} />
      </div>
      <div class="set">
        <Check checked={shared.stripLocation} label={t('set.strip')} hint={t('set.strip.hint')} onchange={(v) => (shared.stripLocation = v)} />
        <UsedBy tools={usedBy('stripLocation')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.sizeTarget')}</b></div>
        <Seg
          label={t('set.sizeTarget')}
          value={shared.sizeTarget}
          options={[
            { value: 0.5, label: '500 KB' },
            { value: 1, label: '1 MB' },
            { value: 2, label: '2 MB' },
            { value: 5, label: '5 MB' },
          ]}
          onchange={(v) => (shared.sizeTarget = v)}
        />
        <UsedBy tools={usedBy('sizeTarget')} />
      </div>
    </section>

    <section>
      <h3 class="h">{t('settings.paper')}</h3>
      <div class="set">
        <div class="l"><b>{t('set.pageSize')}</b>{#if isDefault('pageSize')}<small>{t('settings.followsDevice')}</small>{/if}</div>
        <Seg label={t('set.pageSize')} value={shared.pageSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }]} onchange={(v) => (shared.pageSize = v)} />
        <UsedBy tools={usedBy('pageSize')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.units')}</b>{#if isDefault('units')}<small>{t('settings.followsDevice')}</small>{/if}</div>
        <Seg label={t('set.units')} value={shared.units} options={[{ value: 'metric', label: t('set.units.metric') }, { value: 'imperial', label: t('set.units.imperial') }]} onchange={(v) => (shared.units = v)} />
        <UsedBy tools={usedBy('units')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.decimal')}</b>{#if isDefault('decimal')}<small>{t('settings.followsDevice')}</small>{/if}</div>
        <Seg label={t('set.decimal')} value={shared.decimal} options={[{ value: 'comma', label: t('set.decimal.comma') }, { value: 'point', label: t('set.decimal.point') }]} onchange={(v) => (shared.decimal = v)} />
        <UsedBy tools={usedBy('decimal')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.week')}</b>{#if isDefault('week')}<small>{t('settings.followsDevice')}</small>{/if}</div>
        <Seg label={t('set.week')} value={shared.week} options={[{ value: 'iso', label: t('set.week.iso') }, { value: 'us', label: t('set.week.us') }]} onchange={(v) => (shared.week = v)} />
        <UsedBy tools={usedBy('week')} />
      </div>
      <div class="set">
        <label class="l" for="home-zone"><b>{t('set.homeZone')}</b>{#if isDefault('homeZone')}<small>{t('settings.followsDevice')}</small>{/if}</label>
        <select id="home-zone" class="field" value={shared.homeZone} onchange={(e) => (shared.homeZone = e.currentTarget.value)}>
          {#each zones as z (z)}<option value={z}>{z.replace(/_/g, ' ')}</option>{/each}
        </select>
        <UsedBy tools={usedBy('homeZone')} />
      </div>
    </section>

    <section>
      <h3 class="h">{t('settings.files')}</h3>
      <div class="set">
        <div class="l"><b>{t('set.names')}</b><small class="m">{shared.names === 'suffix' ? 'IMG_4127-small.jpg' : 'IMG_4127.jpg'}</small></div>
        <Seg label={t('set.names')} value={shared.names} options={[{ value: 'suffix', label: t('set.names.suffix') }, { value: 'same', label: t('set.names.same') }]} onchange={(v) => (shared.names = v)} />
        <UsedBy tools={usedBy('names')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.zipFrom')}</b><small>{t('set.zipFrom.hint')}</small></div>
        <Seg
          label={t('set.zipFrom')}
          value={shared.zipFrom}
          options={[
            { value: 2, label: '2' },
            { value: 5, label: '5' },
            { value: 10, label: '10' },
            { value: 0, label: t('set.zipFrom.never') },
          ]}
          onchange={(v) => (shared.zipFrom = v)}
        />
        <UsedBy tools={usedBy('zipFrom')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.passwordWords')}</b>{#if isDefault('passwordWords')}<small>{t('settings.followsDevice')}</small>{/if}</div>
        <Seg label={t('set.passwordWords')} value={shared.passwordWords} options={[{ value: 'en', label: t('set.passwordWords.en') }, { value: 'de', label: t('set.passwordWords.de') }]} onchange={(v) => (shared.passwordWords = v)} />
        <UsedBy tools={usedBy('passwordWords')} />
      </div>
      <div class="set">
        <div class="l"><b>{t('set.csv')}</b>{#if isDefault('csv')}<small>{t('set.csv.hint')}</small>{/if}</div>
        <Seg label={t('set.csv')} value={shared.csv} options={[{ value: 'semicolon', label: t('set.csv.semicolon') }, { value: 'comma', label: t('set.csv.comma') }]} onchange={(v) => (shared.csv = v)} />
        <UsedBy tools={usedBy('csv')} />
      </div>
    </section>

    <section>
      <h3 class="h">{t('settings.shelf')}</h3>
      <div class="set">
        <div class="l"><b>{t('set.view')}</b><small>{t('set.view.hint')}</small></div>
        <Seg
          label={t('set.view')}
          value={prefs.view}
          options={[
            { value: 'list', label: t('home.list') },
            { value: 'wall', label: t('home.wall') },
          ] as { value: View; label: string }[]}
          onchange={(v) => (prefs.view = ui.view = v)}
        />
      </div>
      <div class="set">
        <Check checked={shared.dev} label={t('set.dev')} hint={t('set.dev.hint')} onchange={(v) => (shared.dev = v)} />
        <UsedBy tools={TOOLS.filter((tool) => tool.chip === 'dev')} />
      </div>
      <div class="set">
        <Check checked={shared.offline} disabled={offlineBusy} label={t('set.offline')} hint={t('set.offline.hint')} onchange={offline} />
      </div>
    </section>

    <section>
      <h3 class="h">{t('settings.memory')}</h3>
      <div class="buttons">
        <button type="button" class="btn small" onclick={() => (yours.clear(), toast(t('set.forgot')))}>{t('set.forget')}</button>
        <button type="button" class="btn small" onclick={() => (forgetOptions(), toast(t('set.forgot')))}>{t('set.forgetOptions')}</button>
      </div>
    </section>

    {#if !touchOnly}
      <section class="keys">
        <h3 class="h">{t('settings.keys')}</h3>
        <dl>
          <div><dt><kbd>/</kbd></dt><dd>{t('keys.search')}</dd></div>
          <div><dt><kbd>,</kbd></dt><dd>{t('keys.settings')}</dd></div>
          <div><dt><kbd>{mac ? '⌘' : 'Ctrl'}</kbd><kbd>V</kbd></dt><dd>{t('keys.paste')}</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>{t('keys.home')}</dd></div>
        </dl>
      </section>
    {/if}

    <p class="privacy">{t('settings.privacy')} <a href="/licences" onclick={(e) => ((ui.settings = false), nav(e))}>{t('settings.licences')}</a></p>
  {/if}
</ewo-sheet>

<style>
  .heading {
    display: grid;
  }

  .heading b {
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1;
  }

  .heading span {
    font-family: var(--mono);
    font-size: 9.5px;
    text-transform: uppercase;
    color: var(--ink-2);
    margin-top: 4px;
    font-weight: 400;
  }

  section {
    display: grid;
    padding-bottom: 14px;
  }

  section > .h {
    margin-bottom: 4px;
  }

  .set {
    display: grid;
    gap: 6px;
    justify-items: start;
    padding: 12px 0;
    border-bottom: 1px solid var(--rule);
    min-width: 0;
  }

  .set:last-child {
    border-bottom: 0;
  }

  .l b {
    display: block;
    font-size: 15px;
    font-weight: 600;
  }

  .l small {
    display: block;
    font-size: 12px;
    color: var(--ink-2);
  }

  select.field {
    max-width: 320px;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 10px;
  }

  dl {
    display: grid;
    gap: 0.45rem;
    padding-top: 10px;
  }

  dl > div {
    display: grid;
    grid-template-columns: 6rem 1fr;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  dt {
    display: flex;
    gap: 0.2rem;
  }

  dd {
    margin: 0;
    color: var(--ink-2);
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.3rem;
    border: 1px solid var(--ink);
    font-family: var(--mono);
    font-size: 0.7rem;
  }

  .privacy {
    font-size: 13px;
    color: var(--ink-2);
    padding: 8px 0 12px;
  }

  .privacy a {
    color: var(--ink);
    text-underline-offset: 3px;
  }

  @media (min-width: 760px) {
    .set {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 16px;
    }

    .set > :global(.used) {
      grid-column: 1 / -1;
    }
  }
</style>

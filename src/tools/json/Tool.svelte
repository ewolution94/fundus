<!--
  F-901 Format JSON: paste or open JSON, and it's checked as it's typed. Indented (2, 4, a tab) or
  minified, keys sorted at every level on request; numbers and strings stay exactly as written
  (json.ts). A mistake is named, with its line and column and the line itself, marked.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { CircleCheck } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes, outName } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { parse, format, excerpt, utf8Length, summary, fromFile, INDENTS, type Indent, type JsonError } from './json.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      indent: 'Indent',
      two: '2 spaces',
      four: '4 spaces',
      tabIndent: 'Tab',
      min: 'Minify',
      input: 'JSON',
      output: 'Result',
      placeholder: '{"paste": "JSON here"}',
      open: 'Open a .json file',
      clear: 'Clear',
      keys: 'Keys',
      sort: 'Sort keys',
      sortHint: 'A to Z, at every level',
      size: 'Size',
      empty: 'Paste JSON or open a file: it’s checked as you type.',
      valid: 'Valid JSON',
      'object.one': 'an object, 1 key',
      'object.other': 'an object, {n} keys',
      'array.one': 'an array, 1 item',
      'array.other': 'an array, {n} items',
      value: 'a single value',
      where: 'Line {line}, column {column}',
      end: 'It ends too early: a value is missing.',
      endOpen: 'It ends too early: the {bracket} from line {line} is never closed.',
      unexpected: '{found} can’t stand here.',
      trailingComma: 'A comma before {found}: JSON allows none after the last item.',
      singleQuote: 'Single quotes: JSON wants double quotes (").',
      keyQuote: 'The key {found} needs double quotes around it.',
      comment: 'A comment ({found}): JSON has none.',
      number: '{found} isn’t a number JSON knows: no leading zeros, no +, no bare dot.',
      escape: '{found} isn’t an escape JSON knows.',
      lineBreak: 'A line break inside a string: is a closing " missing?',
      tab: 'A tab inside a string: write it as \\t.',
      control: 'A control character inside a string.',
      unclosedString: 'This string is never closed: a " is missing.',
      literal: '{found} isn’t JSON: use true, false, null, a number or a string in quotes.',
      colon: 'A colon is missing after the key, before {found}.',
      commaObject: 'A comma or } is missing before {found}.',
      commaArray: 'A comma or ] is missing before {found}.',
      extra: 'Something follows the end of the JSON: {found}.',
      deep: 'Nested more than 1,000 levels deep.',
      tooBig: 'Too big to edit here ({size}): it’s formatted all the same.',
      shown: 'Showing the first {size}: Copy and Save take all of it.',
      readFailed: '{name} couldn’t be read as text.',
    },
    de: {
      indent: 'Einrücken',
      two: '2 Leerzeichen',
      four: '4 Leerzeichen',
      tabIndent: 'Tab',
      min: 'Verkleinern',
      input: 'JSON',
      output: 'Ergebnis',
      placeholder: '{"hier": "JSON einfügen"}',
      open: 'Eine .json-Datei öffnen',
      clear: 'Leeren',
      keys: 'Schlüssel',
      sort: 'Schlüssel sortieren',
      sortHint: 'A bis Z, auf jeder Ebene',
      size: 'Größe',
      empty: 'Füg JSON ein oder öffne eine Datei: es wird beim Tippen geprüft.',
      valid: 'Gültiges JSON',
      'object.one': 'ein Objekt, 1 Schlüssel',
      'object.other': 'ein Objekt, {n} Schlüssel',
      'array.one': 'ein Array, 1 Eintrag',
      'array.other': 'ein Array, {n} Einträge',
      value: 'ein einzelner Wert',
      where: 'Zeile {line}, Spalte {column}',
      end: 'Es endet zu früh: ein Wert fehlt.',
      endOpen: 'Es endet zu früh: die Klammer {bracket} aus Zeile {line} wird nie geschlossen.',
      unexpected: '{found} kann hier nicht stehen.',
      trailingComma: 'Ein Komma vor {found}: JSON erlaubt keins nach dem letzten Eintrag.',
      singleQuote: 'Einfache Anführungszeichen: JSON will doppelte (").',
      keyQuote: 'Der Schlüssel {found} braucht doppelte Anführungszeichen.',
      comment: 'Ein Kommentar ({found}): JSON kennt keine.',
      number: '{found} ist keine Zahl, die JSON kennt: keine führenden Nullen, kein +, kein Punkt allein.',
      escape: '{found} ist kein Escape, das JSON kennt.',
      lineBreak: 'Ein Zeilenumbruch in einem String: fehlt ein schließendes "?',
      tab: 'Ein Tab in einem String: schreib ihn als \\t.',
      control: 'Ein Steuerzeichen in einem String.',
      unclosedString: 'Dieser String wird nie geschlossen: ein " fehlt.',
      literal: '{found} ist kein JSON: nimm true, false, null, eine Zahl oder einen String in Anführungszeichen.',
      colon: 'Nach dem Schlüssel fehlt ein Doppelpunkt, vor {found}.',
      commaObject: 'Vor {found} fehlt ein Komma oder eine }.',
      commaArray: 'Vor {found} fehlt ein Komma oder eine ].',
      extra: 'Nach dem Ende des JSON kommt noch etwas: {found}.',
      deep: 'Mehr als 1.000 Ebenen tief verschachtelt.',
      tooBig: 'Zu groß zum Bearbeiten ({size}): formatiert wird es trotzdem.',
      shown: 'Zu sehen sind die ersten {size}: Kopieren und Speichern nehmen alles.',
      readFailed: '{name} ließ sich nicht als Text lesen.',
    },
  });

  // How it's written is kept; the JSON is not.
  const o = remember('json', { indent: '2' as Indent, sort: false });

  /** Past this the text stays out of the text area (a browser crawls with megabytes in one). */
  const EDIT_LIMIT = 2_000_000;
  /** Past this the result shows only its start; Copy and Save have all of it. */
  const SHOW_LIMIT = 200_000;

  let input = $state('');
  /** A file too big for the text area: its text, kept here instead. */
  let bigText = $state<string | null>(null);
  let fileName = $state<string | null>(null);
  let readError = $state('');

  async function open(list: File[]) {
    const file = list[0];
    if (!file) return;
    readError = '';
    try {
      const text = fromFile(await file.text());
      fileName = file.name;
      if (text.length > EDIT_LIMIT) {
        bigText = text;
        input = '';
      } else {
        bigText = null;
        input = text;
      }
    } catch {
      readError = w('readFailed', { name: file.name });
    }
  }

  function clear() {
    input = '';
    bigText = null;
    fileName = null;
    readError = '';
  }

  // What was pasted or dropped on the home goes in, once.
  const given = untrack(() => ({ text: texts(items)[0], file: filesOf(items)[0] }));
  if (given.file) void open([given.file]);
  else if (given.text) input = given.text;

  const mark = $derived(shared.decimal);
  const source = $derived(bigText ?? input);
  const parsed = $derived(source.trim() ? parse(source) : null);
  const output = $derived(parsed?.ok ? format(parsed.value, INDENTS[o.indent], o.sort) : '');
  const before = $derived(utf8Length(source));
  const after = $derived(utf8Length(output));
  const top = $derived(parsed?.ok ? summary(parsed.value) : null);

  const saveName = $derived(outName(fileName ?? 'data.json', o.indent === 'min' ? 'min' : 'formatted', 'json', shared.names));
  // A saved file ends with a line break when it's indented, as text files do; Copy takes it without.
  const outputs = $derived(output ? [{ blob: new Blob([o.indent === 'min' ? output : `${output}\n`], { type: 'application/json' }), name: saveName }] : null);
  const nextItems = $derived(outputs ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: 'application/json' }) }] : null);

  const quote = (s: string) => (locale() === 'de' ? `„${s}“` : `“${s}”`);

  function message(e: JsonError): string {
    if (e.code === 'end' && e.open) return w('endOpen', { bracket: e.open.bracket, line: e.open.line });
    return w(e.code, { found: quote(e.found) });
  }

  function change(): string {
    if (!before || before === after) return '';
    const pct = formatNumber(Math.abs((after / before - 1) * 100), mark, { max: 0 });
    return after < before ? `−${pct} %` : `+${pct} %`;
  }
</script>

<div class="json">
  <Seg
    large
    label={w('indent')}
    value={o.indent}
    options={[
      { value: '2', label: w('two') },
      { value: '4', label: w('four') },
      { value: 'tab', label: w('tabIndent') },
      { value: 'min', label: w('min') },
    ]}
    onchange={(v) => (o.indent = v)}
  />

  <div class="cols even">
    <div class="stack">
      <h2 class="h">
        {w('input')}
        <em>{fileName ? `${fileName} · ` : ''}{source ? formatBytes(before, mark) : ''}</em>
      </h2>
      {#if bigText !== null}
        <FileRow name={fileName ?? ''} meta={w('tooBig', { size: formatBytes(before, mark) })} onremove={clear} />
      {:else}
        <textarea
          class="field code"
          aria-label={w('input')}
          placeholder={w('placeholder')}
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          bind:value={input}
        ></textarea>
      {/if}
      <div class="row">
        <div class="grow"><DropWell compact accept=".json,application/json,text/plain,text/*" title={w('open')} onfiles={open} /></div>
        {#if source}<button type="button" class="btn" onclick={clear}>{w('clear')}</button>{/if}
      </div>
      {#if readError}<p class="note bad" role="alert">{readError}</p>{/if}
    </div>

    <div class="stack">
      <dl class="spec">
        <div>
          <dt>{w('keys')}</dt>
          <dd><Check checked={o.sort} label={w('sort')} hint={w('sortHint')} onchange={(v) => (o.sort = v)} /></dd>
        </div>
        {#if parsed?.ok}
          <div>
            <dt>{w('size')}</dt>
            <dd>
              <div class="big">
                <b>{formatBytes(after, mark)}</b>
                {#if before !== after}<s>{formatBytes(before, mark)}</s>{/if}
                {#if change()}<em>{change()}</em>{/if}
              </div>
            </dd>
          </div>
        {/if}
      </dl>

      {#if !parsed}
        <p class="note">{w('empty')}</p>
      {:else if !parsed.ok}
        {@const e = parsed.error}
        {@const x = excerpt(source, e.offset)}
        <div class="error" role="alert">
          <p>{message(e)}</p>
          <p class="where">{w('where', { line: e.line, column: e.column })}</p>
          <pre class="mono-out excerpt"><span class="ln">{e.line}</span>{x.cutStart ? '…' : ''}{x.before}<mark class:gap={!x.at}>{x.at === '\t' ? '⇥' : x.at || ' '}</mark>{x.after}{x.cutEnd ? '…' : ''}</pre>
        </div>
      {:else}
        <div class="bar">
          <p class="ok" aria-live="polite">
            <CircleCheck aria-hidden="true" />
            <span>{w('valid')} · {!top || top.kind === 'value' ? w('value') : w(top.kind, { n: top.count })}</span>
          </p>
          <CopyButton variant="button" text={output} />
        </div>
        <div class="work out" aria-label={w('output')} role="region">
          <pre class="mono-out">{output.length > SHOW_LIMIT ? output.slice(0, SHOW_LIMIT) : output}</pre>
        </div>
        {#if output.length > SHOW_LIMIT}<p class="note">{w('shown', { size: formatBytes(SHOW_LIMIT, mark) })}</p>{/if}
        <SaveButton {outputs} tool={tool.id} />
        <NextTools items={nextItems} from={tool.id} prefer={['hash', 'base64']} />
      {/if}
    </div>
  </div>
</div>

<style>
  .json {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .code {
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.55;
    min-height: 240px;
    tab-size: 2;
  }

  @media (hover: none) {
    .code {
      font-size: 16px;
    }
  }

  @media (min-width: 760px) {
    .code {
      min-height: 420px;
    }
  }

  .row {
    display: flex;
    gap: 8px;
    align-items: stretch;
    min-width: 0;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .row .btn {
    min-height: 44px;
  }

  .out {
    max-height: 420px;
    overflow: auto;
    padding: 10px 12px;
    tab-size: 2;
  }

  .out pre {
    margin: 0;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .ok {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--ok);
    min-width: 0;
  }

  .ok :global(svg) {
    width: 18px;
    height: 18px;
    flex: none;
  }

  .error {
    display: grid;
    gap: 6px;
    overflow-wrap: anywhere;
  }

  .where {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 400;
  }

  .excerpt {
    margin: 2px 0 0;
    padding: 8px 10px;
    background: var(--card);
    color: var(--ink);
    border: 1px solid var(--rule);
    font-weight: 400;
  }

  .ln {
    display: inline-block;
    margin-right: 10px;
    padding-right: 8px;
    border-right: 1px solid var(--rule);
    color: var(--ink-2);
  }

  mark {
    background: var(--mark);
    color: var(--mark-ink);
    outline: 1.5px solid var(--mark-ink);
  }

  mark.gap {
    display: inline-block;
    width: 0.7ch;
  }
</style>

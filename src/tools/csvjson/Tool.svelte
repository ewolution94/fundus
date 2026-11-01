<!--
  F-909 CSV ↔ JSON: paste or open either, and the direction is found from it (a Seg switches it).
  CSV → JSON: objects keyed by the header (arrays without one), typed values on request, dotted
  headers nested. JSON → CSV: rows from an array of objects or arrays, nested objects as dotted
  columns, with the shared CSV separator; no BOM, it's for code (csvjson.ts).
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
  import { shared, setShared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes, outName, sniff } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import { decodeBytes, decodeAs, chosenOf, stripBom, type Chosen, type Encoding, type Mark, type Separator } from '../../lib/csv.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { excerpt, utf8Length, type JsonError } from '../json/json.ts';
  import { direction, directionOf, readCsv, toJson, stringify, jsonToCsv, type Direction } from './csvjson.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      direction: 'Direction',
      toJson: 'CSV → JSON',
      toCsv: 'JSON → CSV',
      input: 'CSV or JSON',
      csv: 'CSV',
      json: 'JSON',
      placeholderCsv: 'name,city\nAnna,Berlin',
      placeholderJson: '[{"name": "Anna", "city": "Berlin"}]',
      open: 'Open a .csv or .json file',
      clear: 'Clear',
      separator: 'Separator',
      sep_semicolon: 'Semicolon',
      sep_comma: 'Comma',
      sep_tab: 'Tab',
      sep_pipe: 'Pipe',
      readSep: 'Columns split by',
      decimal: 'Decimal mark',
      readMark: 'Decimal mark of the numbers',
      dec_comma: 'Comma',
      dec_point: 'Point',
      like: 'Like {example}',
      guessed: 'A guess: no decimals in it',
      encoding: 'Encoding',
      readEnc: 'Encoding of the file',
      'enc_utf-8': 'UTF-8',
      'enc_utf-16': 'UTF-16',
      'enc_windows-1252': 'Windows-1252',
      withBom: 'With a BOM',
      isFound: 'Found in the file',
      isFoundText: 'Found in the text',
      isChosen: 'Your choice · found: {found}',
      'rows.one': '{count} row',
      'rows.other': '{count} rows',
      'cols.one': '{count} column',
      'cols.other': '{count} columns',
      'objects.one': '{count} object',
      'objects.other': '{count} objects',
      'arrays.one': '{count} array',
      'arrays.other': '{count} arrays',
      header: 'Header',
      firstRow: 'First row is a header',
      firstRowHint: 'Objects keyed by it; arrays without',
      values: 'Values',
      typed: 'Typed values',
      typedHint: 'Numbers, true and false by column; empty is null',
      typedComma: 'Numbers with a decimal comma (4,80), true and false by column; empty is null',
      writes: 'Separator',
      forCsv: 'for every tool that writes a CSV',
      nowSemicolon: 'Every tool that writes a CSV now uses semicolons',
      nowComma: 'Every tool that writes a CSV now uses commas',
      csvOut: 'Nested objects become dotted columns (address.city), arrays JSON text. UTF-8, no BOM.',
      size: 'Size',
      empty: 'Paste a CSV or JSON, or open a file: the direction is found from it.',
      output: 'Result',
      where: 'Line {line}, column {column}',
      unclosed: 'A quote here is never closed: is a closing " missing?',
      stray: 'Text after a closing quote on line {line}, column {column}: it stays in the cell.',
      end: 'It ends too early: a value is missing.',
      endOpen: 'It ends too early: the {bracket} from line {line} is never closed.',
      trailingComma: 'A comma before {found}: JSON allows none after the last item.',
      singleQuote: 'Single quotes: JSON wants double quotes (").',
      keyQuote: 'The key {found} needs double quotes around it.',
      comment: 'A comment ({found}): JSON has none.',
      unclosedString: 'This string is never closed: a " is missing.',
      extra: 'Something follows the end of the JSON: {found}.',
      other: '{found} can’t stand here.',
      scalar: 'A single value: JSON → CSV wants an array of objects, or of arrays.',
      emptyArray: 'An empty array: there are no rows to write.',
      noRows: 'Only a header: there are no rows yet.',
      readFailed: '{name} couldn’t be read as text.',
      tooBig: 'Too big to edit here ({size}): it’s converted all the same.',
      shown: 'Showing the first {size}: Copy and Save take all of it.',
    },
    de: {
      direction: 'Richtung',
      toJson: 'CSV → JSON',
      toCsv: 'JSON → CSV',
      input: 'CSV oder JSON',
      placeholderCsv: 'name,stadt\nAnna,Berlin',
      placeholderJson: '[{"name": "Anna", "stadt": "Berlin"}]',
      open: 'Eine .csv- oder .json-Datei öffnen',
      clear: 'Leeren',
      separator: 'Trennzeichen',
      sep_semicolon: 'Semikolon',
      sep_comma: 'Komma',
      sep_tab: 'Tab',
      sep_pipe: 'Senkrechter Strich',
      readSep: 'Spalten getrennt durch',
      decimal: 'Dezimalzeichen',
      readMark: 'Dezimalzeichen der Zahlen',
      dec_comma: 'Komma',
      dec_point: 'Punkt',
      like: 'Wie {example}',
      guessed: 'Geschätzt: keine Nachkommastellen darin',
      encoding: 'Kodierung',
      readEnc: 'Kodierung der Datei',
      withBom: 'Mit BOM',
      isFound: 'In der Datei erkannt',
      isFoundText: 'Im Text erkannt',
      isChosen: 'Deine Wahl · erkannt: {found}',
      'rows.one': '{count} Zeile',
      'rows.other': '{count} Zeilen',
      'cols.one': '{count} Spalte',
      'cols.other': '{count} Spalten',
      'objects.one': '{count} Objekt',
      'objects.other': '{count} Objekte',
      'arrays.one': '{count} Array',
      'arrays.other': '{count} Arrays',
      header: 'Kopfzeile',
      firstRow: 'Erste Zeile ist die Kopfzeile',
      firstRowHint: 'Objekte mit ihren Namen als Schlüssel; ohne sie Arrays',
      values: 'Werte',
      typed: 'Typisierte Werte',
      typedHint: 'Zahlen, true und false je Spalte; leer ist null',
      typedComma: 'Zahlen mit Dezimalkomma (4,80), true und false je Spalte; leer ist null',
      writes: 'Trennzeichen',
      forCsv: 'für jedes Werkzeug, das CSV schreibt',
      nowSemicolon: 'Jedes Werkzeug, das CSV schreibt, nimmt jetzt Semikolons',
      nowComma: 'Jedes Werkzeug, das CSV schreibt, nimmt jetzt Kommas',
      csvOut: 'Verschachtelte Objekte werden Spalten mit Punkt (address.city), Arrays JSON-Text. UTF-8, ohne BOM.',
      size: 'Umfang',
      empty: 'Füg eine CSV oder JSON ein oder öffne eine Datei: die Richtung wird daraus erkannt.',
      output: 'Ergebnis',
      where: 'Zeile {line}, Spalte {column}',
      unclosed: 'Dieses Anführungszeichen wird nie geschlossen: fehlt ein schließendes "?',
      stray: 'Text nach einem schließenden Anführungszeichen in Zeile {line}, Spalte {column}: er bleibt in der Zelle.',
      end: 'Es endet zu früh: ein Wert fehlt.',
      endOpen: 'Es endet zu früh: die Klammer {bracket} aus Zeile {line} wird nie geschlossen.',
      trailingComma: 'Ein Komma vor {found}: JSON erlaubt keins nach dem letzten Eintrag.',
      singleQuote: 'Einfache Anführungszeichen: JSON will doppelte (").',
      keyQuote: 'Der Schlüssel {found} braucht doppelte Anführungszeichen.',
      comment: 'Ein Kommentar ({found}): JSON kennt keine.',
      unclosedString: 'Dieser String wird nie geschlossen: ein " fehlt.',
      extra: 'Nach dem Ende des JSON kommt noch etwas: {found}.',
      other: '{found} kann hier nicht stehen.',
      scalar: 'Ein einzelner Wert: JSON → CSV braucht ein Array aus Objekten oder aus Arrays.',
      emptyArray: 'Ein leeres Array: es gibt keine Zeilen zu schreiben.',
      noRows: 'Nur eine Kopfzeile: noch keine Zeilen.',
      readFailed: '{name} ließ sich nicht als Text lesen.',
      tooBig: 'Zu groß zum Bearbeiten ({size}): umgewandelt wird es trotzdem.',
      shown: 'Zu sehen sind die ersten {size}: Kopieren und Speichern nehmen alles.',
    },
  });

  // How it converts is kept; what's converted is not.
  const o = remember('csvjson', { typed: true });

  /** Past this the text stays out of the text area (a browser crawls with megabytes in one). */
  const EDIT_LIMIT = 2_000_000;
  /** Past this the result shows only its start; Copy and Save have all of it. */
  const SHOW_LIMIT = 200_000;
  const SEP_NAMES: Record<Separator, 'semicolon' | 'comma' | 'tab' | 'pipe'> = { ';': 'semicolon', ',': 'comma', '\t': 'tab', '|': 'pipe' };
  const JSON_CODES = ['end', 'trailingComma', 'singleQuote', 'keyQuote', 'comment', 'unclosedString', 'extra'] as const;

  let input = $state('');
  /** A file too big for the text area: its text, kept here instead. */
  let bigText = $state.raw<string | null>(null);
  let fileName = $state<string | null>(null);
  /** The file's own direction (its name says), until it's cleared. */
  let fileDir = $state<Direction | null>(null);
  let choice = $state<Direction | null>(null);
  let headerChoice = $state<boolean | null>(null);
  /** An opened file's bytes and the encoding found in them, to read them again in another one. */
  let fileBytes = $state.raw<Uint8Array | null>(null);
  let fileEnc = $state<Encoding | null>(null);
  // Corrections of what was found in a CSV: they belong to it, so they're never kept.
  let sepChoice = $state<Separator | null>(null);
  let markChoice = $state<Mark | null>(null);
  let encChoice = $state<Chosen | null>(null);
  let readError = $state('');

  function corrected() {
    sepChoice = null;
    markChoice = null;
    encChoice = null;
  }

  function setText(text: string) {
    if (text.length > EDIT_LIMIT) {
      bigText = text;
      input = '';
    } else {
      bigText = null;
      input = text;
    }
  }

  async function open(list: File[]) {
    const file = list[0];
    if (!file) return;
    readError = '';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { text, encoding } = decodeBytes(bytes);
      if (sniff(bytes.subarray(0, 1024)) !== 'other' || text.slice(0, 8192).includes('\u0000')) throw new Error('binary');
      fileName = file.name;
      fileDir = directionOf(file.name, file.type, text);
      fileBytes = bytes;
      fileEnc = encoding;
      choice = null;
      headerChoice = null;
      corrected();
      setText(text);
    } catch {
      readError = w('readFailed', { name: file.name });
    }
  }

  /** The file read again in the encoding someone chose (edits to its text go with it). */
  function reread(enc: Chosen) {
    if (!fileBytes) return;
    encChoice = enc;
    setText(decodeAs(fileBytes, enc));
  }

  function clear() {
    input = '';
    bigText = null;
    fileName = null;
    fileDir = null;
    fileBytes = null;
    fileEnc = null;
    choice = null;
    headerChoice = null;
    corrected();
    readError = '';
  }

  // What was pasted or dropped on the home goes in, once.
  const given = untrack(() => ({ text: texts(items)[0], file: filesOf(items)[0] }));
  if (given.file) void open([given.file]);
  else if (given.text) input = given.text;

  const source = $derived(stripBom(bigText ?? input));
  const dir = $derived<Direction>(choice ?? fileDir ?? direction(source));
  const sep = $derived<Separator>(shared.csv === 'semicolon' ? ';' : ',');
  const mark = $derived(shared.decimal);
  const count = (n: number) => formatNumber(n, mark);

  // CSV → JSON
  const csvRead = $derived(
    dir === 'csv' && source.trim() ? readCsv(source, { hint: /\.tsv$/i.test(fileName ?? '') ? '\t' : undefined, sep: sepChoice, mark: markChoice }) : null,
  );
  const foundEnc = $derived(fileEnc ? chosenOf(fileEnc) : null);
  const sepName = (s: Separator) => w(`sep_${SEP_NAMES[s]}`);
  const markName = (m: Mark) => w(m === 'comma' ? 'dec_comma' : 'dec_point');
  /** "Found in the file", or "Your choice · found: Comma" once someone chose something else. */
  const status = (chosen: string | null, found: string, foundName: string) =>
    chosen !== null && chosen !== found ? w('isChosen', { found: foundName }) : fileBytes ? w('isFound') : w('isFoundText');
  const header = $derived(csvRead ? (headerChoice ?? csvRead.header) : false);
  const jsonOut = $derived(csvRead && csvRead.issue?.code !== 'unclosed' ? stringify(toJson(csvRead, header, o.typed)) : '');
  const records = $derived(csvRead ? csvRead.rows.length - (header ? 1 : 0) : 0);

  // JSON → CSV
  const csvMade = $derived(dir === 'json' && source.trim() ? jsonToCsv(source, sep) : null);
  const csvOut = $derived(csvMade?.ok ? csvMade.csv : '');

  const output = $derived(dir === 'csv' ? jsonOut : csvOut);
  const base = $derived(fileName ?? (dir === 'csv' ? 'data.csv' : 'data.json'));
  const saveName = $derived(outName(base, '', dir === 'csv' ? 'json' : 'csv', shared.names));
  const outputs = $derived(
    output && (dir === 'json' || records > 0)
      ? [{ blob: new Blob([dir === 'csv' ? `${output}\n` : output], { type: dir === 'csv' ? 'application/json' : 'text/csv;charset=utf-8' }), name: saveName }]
      : null,
  );
  const nextItems = $derived(outputs ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: outputs[0].blob.type }) }] : null);

  const quote = (s: string) => (locale() === 'de' ? `„${s}“` : `“${s}”`);

  function jsonMessage(e: JsonError): string {
    if (e.code === 'end' && e.open) return w('endOpen', { bracket: e.open.bracket, line: e.open.line });
    const code = (JSON_CODES as readonly string[]).includes(e.code) ? (e.code as (typeof JSON_CODES)[number]) : 'other';
    return w(code, { found: quote(e.found || '…') });
  }

  /** The mistake to show, with its place, or null. */
  const mistake = $derived.by(() => {
    if (csvRead?.issue?.code === 'unclosed') {
      const i = csvRead.issue;
      return { text: w('unclosed'), line: i.line, column: i.column, offset: i.offset };
    }
    if (csvMade && !csvMade.ok) {
      if ('error' in csvMade) return { text: jsonMessage(csvMade.error), line: csvMade.error.line, column: csvMade.error.column, offset: csvMade.error.offset };
      return { text: w(csvMade.code === 'scalar' ? 'scalar' : 'emptyArray'), line: 0, column: 0, offset: -1 };
    }
    return null;
  });

  const summary = $derived.by(() => {
    if (dir === 'csv' && csvRead) return header ? w('objects', { n: records, count: count(records) }) : w('arrays', { n: records, count: count(records) });
    if (csvMade?.ok) return `${w('rows', { n: csvMade.rows, count: count(csvMade.rows) })} · ${w('cols', { n: csvMade.columns, count: count(csvMade.columns) })}`;
    return '';
  });
</script>

<div class="cj">
  <Seg
    large
    label={w('direction')}
    value={dir}
    options={[
      { value: 'csv', label: w('toJson') },
      { value: 'json', label: w('toCsv') },
    ]}
    onchange={(v) => {
      choice = v;
      headerChoice = null;
      sepChoice = null;
      markChoice = null;
    }}
  />

  <div class="cols even">
    <div class="stack">
      <h2 class="h">
        {dir === 'csv' ? w('csv') : w('json')}
        <em>{fileName ? `${fileName} · ` : ''}{source ? formatBytes(utf8Length(source), mark) : ''}</em>
      </h2>
      {#if bigText !== null}
        <FileRow name={fileName ?? ''} meta={w('tooBig', { size: formatBytes(utf8Length(bigText), mark) })} onremove={clear} />
      {:else}
        <!-- A CSV's rows stay one line each; JSON wraps, as Format JSON's does. -->
        <textarea
          class="field code"
          class:rows={dir === 'csv'}
          aria-label={w('input')}
          placeholder={dir === 'json' ? w('placeholderJson') : w('placeholderCsv')}
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          wrap={dir === 'csv' ? 'off' : 'soft'}
          bind:value={input}
          oninput={(e) => {
            if (!e.currentTarget.value) clear();
          }}
        ></textarea>
      {/if}
      <div class="row">
        <div class="grow"><DropWell compact accept=".csv,.tsv,.json,.txt,text/csv,text/tab-separated-values,application/json,text/plain" title={w('open')} onfiles={open} /></div>
        {#if source}<button type="button" class="btn" onclick={clear}>{w('clear')}</button>{/if}
      </div>
      {#if readError}<p class="note bad" role="alert">{readError}</p>{/if}
    </div>

    <div class="stack">
      <dl class="spec">
        {#if dir === 'csv'}
          {#if csvRead}
            <div>
              <dt>{w('separator')}</dt>
              <dd>
                <Seg
                  label={w('readSep')}
                  value={csvRead.sep}
                  options={(Object.keys(SEP_NAMES) as Separator[]).map((s) => ({ value: s, label: s === '\t' ? sepName(s) : `${sepName(s)} ${s}` }))}
                  onchange={(s) => (sepChoice = s)}
                />
                <span class="note">{status(sepChoice, csvRead.foundSep, sepName(csvRead.foundSep))} · {w('cols', { n: csvRead.columns, count: count(csvRead.columns) })}</span>
              </dd>
            </div>
            <div>
              <dt>{w('decimal')}</dt>
              <dd>
                <Seg
                  label={w('readMark')}
                  value={csvRead.mark}
                  options={[
                    { value: 'comma', label: w('dec_comma') },
                    { value: 'point', label: w('dec_point') },
                  ]}
                  onchange={(m) => (markChoice = m)}
                />
                <span class="note">
                  {w('like', { example: csvRead.mark === 'comma' ? '4,80' : '4.80' })} ·
                  {markChoice === null && !csvRead.found ? w('guessed') : status(markChoice, csvRead.foundMark, markName(csvRead.foundMark))}
                </span>
              </dd>
            </div>
            {#if fileBytes && fileEnc && foundEnc}
              <div>
                <dt>{w('encoding')}</dt>
                <dd>
                  <Seg
                    label={w('readEnc')}
                    value={encChoice ?? foundEnc}
                    options={[
                      { value: 'utf-8', label: w('enc_utf-8') },
                      { value: 'windows-1252', label: w('enc_windows-1252') },
                      ...(foundEnc === 'utf-16' ? [{ value: 'utf-16' as const, label: w('enc_utf-16') }] : []),
                    ]}
                    onchange={reread}
                  />
                  <span class="note">{fileEnc === 'utf-8-bom' ? `${w('withBom')} · ` : ''}{status(encChoice, foundEnc, w(`enc_${foundEnc}`))}</span>
                </dd>
              </div>
            {/if}
            <div>
              <dt>{w('header')}</dt>
              <dd><Check checked={header} label={w('firstRow')} hint={w('firstRowHint')} onchange={(v) => (headerChoice = v)} /></dd>
            </div>
          {/if}
          <div>
            <dt>{w('values')}</dt>
            <dd><Check checked={o.typed} label={w('typed')} hint={csvRead?.sure && csvRead.mark === 'comma' ? w('typedComma') : w('typedHint')} onchange={(v) => (o.typed = v)} /></dd>
          </div>
        {:else}
          <div>
            <dt>{w('writes')}</dt>
            <dd>
              <Seg
                label={w('writes')}
                value={shared.csv}
                options={[
                  { value: 'semicolon', label: `${w('sep_semicolon')} ;` },
                  { value: 'comma', label: `${w('sep_comma')} ,` },
                ]}
                onchange={(v) => setShared('csv', v, v === 'semicolon' ? w('nowSemicolon') : w('nowComma'))}
              />
              <span class="note">{w('forCsv')}</span>
            </dd>
          </div>
        {/if}
      </dl>

      {#if !source.trim()}
        <p class="note">{w('empty')}</p>
      {:else if mistake}
        {@const x = mistake.offset >= 0 ? excerpt(source, mistake.offset) : null}
        <div class="error" role="alert">
          <p>{mistake.text}</p>
          {#if x}
            <p class="where">{w('where', { line: mistake.line, column: mistake.column })}</p>
            <pre class="mono-out excerpt"><span class="ln">{mistake.line}</span>{x.cutStart ? '…' : ''}{x.before}<mark class:gap={!x.at}>{x.at === '\t' ? '⇥' : x.at || ' '}</mark>{x.after}{x.cutEnd ? '…' : ''}</pre>
          {/if}
        </div>
      {:else if output}
        <div class="bar">
          <p class="ok" aria-live="polite">
            <CircleCheck aria-hidden="true" />
            <span>{summary}</span>
          </p>
          <CopyButton variant="button" text={output} />
        </div>
        <div class="work out" aria-label={w('output')} role="region">
          <pre class="mono-out">{output.length > SHOW_LIMIT ? output.slice(0, SHOW_LIMIT) : output}</pre>
        </div>
        {#if output.length > SHOW_LIMIT}<p class="note">{w('shown', { size: formatBytes(SHOW_LIMIT, mark) })}</p>{/if}
        {#if dir === 'csv' && records === 0}<p class="note">{w('noRows')}</p>{/if}
        {#if csvRead?.issue?.code === 'stray'}<p class="note">{w('stray', { line: csvRead.issue.line, column: csvRead.issue.column })}</p>{/if}
        {#if dir === 'json'}<p class="note">{w('csvOut')}</p>{/if}
        <SaveButton {outputs} tool={tool.id} />
        <NextTools items={nextItems} from={tool.id} prefer={dir === 'csv' ? ['json', 'yaml'] : ['csv']} />
      {/if}
    </div>
  </div>
</div>

<style>
  .cj {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .code {
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.55;
    min-height: 240px;
  }

  .code.rows {
    white-space: pre;
    overflow-x: auto;
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

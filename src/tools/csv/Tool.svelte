<!--
  F-305 CSV & Excel: a bank's or a shop's export opened properly (src/lib/csv.ts finds the
  separator, the encoding and the decimal mark), its columns typed (csv.ts), and saved for Excel: an
  .xlsx with numbers as numbers, dates as dates and 01067 as text, or a CSV in the shape Excel reads
  (a semicolon and a decimal comma for German Excel, UTF-8 with a BOM, CRLF). An .xlsx goes the
  other way, into a CSV.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import FileRow from '../../components/kit/FileRow.svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import Grid from './Grid.svelte';
  import { words } from '../../lib/i18n.svelte.ts';
  import { shared, setShared } from '../../lib/settings.svelte.ts';
  import { remember } from '../../lib/memory.svelte.ts';
  import { texts, files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes, outName, sniff } from '../../lib/files.ts';
  import { formatNumber } from '../../lib/numbers.ts';
  import { decodeBytes, decodeAs, chosenOf, writeCsv, type Encoding, type Chosen, type Separator, type Mark } from '../../lib/csv.ts';
  import type { Output } from '../../lib/save.ts';
  import type { SheetData } from 'write-excel-file/browser';
  import type { Tool } from '../../lib/catalog.ts';
  import { fromCsv, fromSheet, guessHeader, guessTypes, toXlsx, toCsvRows, excelWrecks, formatDate, isOldXls, isZip, type Table, type FromCsv, type Value, type ColumnType } from './csv.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      drop: 'Drop a CSV or Excel file here, or choose one',
      dropHint: 'CSV, TSV or XLSX: a bank’s or a shop’s export.',
      paste: 'Paste rows',
      placeholder: 'Or paste rows from a CSV or a spreadsheet here',
      clear: 'Clear',
      found: 'Found',
      file: 'File',
      workbook: 'Excel workbook',
      sheet: 'Sheet',
      separator: 'Separator',
      sep_semicolon: 'Semicolon',
      sep_comma: 'Comma',
      sep_tab: 'Tab',
      sep_pipe: 'Pipe',
      encoding: 'Encoding',
      'enc_utf-8': 'UTF-8',
      'enc_utf-8-bom': 'UTF-8 with BOM',
      'enc_utf-16': 'UTF-16',
      'enc_windows-1252': 'Windows-1252',
      decimal: 'Decimal',
      dec_comma: 'Comma',
      dec_point: 'Point',
      guessed: 'A guess: no decimals in it',
      readSep: 'Columns split by',
      readMark: 'Decimal mark of the numbers',
      readEnc: 'Encoding of the file',
      isFound: 'Found in the file',
      isFoundText: 'Found in the rows',
      isChosen: 'Your choice · found: {found}',
      like: 'Like {example}',
      withBom: 'With a BOM',
      size: 'Size',
      'rows.one': '{count} row',
      'rows.other': '{count} rows',
      'cols.one': '{count} column',
      'cols.other': '{count} columns',
      header: 'Header',
      firstRow: 'First row is a header',
      firstRowHint: 'Its names head the columns',
      saveAs: 'Save as',
      format: 'Format',
      excel: 'Excel',
      csv: 'CSV',
      writes: 'Separator',
      forSemicolon: 'With a decimal comma, for Excel in German',
      forComma: 'With a decimal point, for Excel in English',
      forCsv: 'for every tool that writes a CSV',
      nowSemicolon: 'Every tool that writes a CSV now uses semicolons',
      nowComma: 'Every tool that writes a CSV now uses commas',
      excelNote: 'Numbers as numbers, dates as dates, text kept as it is.',
      csvNote: 'UTF-8 with a BOM, so Excel shows the umlauts.',
      preview: 'Preview',
      row: 'Row',
      type: 'Type of {name}',
      column: 'column {n}',
      number: 'Number',
      text: 'Text',
      date: 'Date',
      shown: 'The first {shown} of {count} rows. Save takes all of them.',
      'short.one': 'Row {list} was short: filled with empty cells.',
      'short.other': '{n} rows were short ({list}): filled with empty cells.',
      wrecks: 'Excel still drops a leading 0 when it opens a CSV (01067 becomes 1067): save as Excel to keep it.',
      unclosed: 'A quote on line {line}, column {column} is never closed: the rest is in one cell.',
      stray: 'Text after a closing quote on line {line}, column {column}: it stays in the cell.',
      oldXls: 'Old .xls files: save it as .xlsx in Excel first.',
      notTable: '{name} isn’t a table this tool can read.',
      notExcel: '{name} couldn’t be read as an Excel file.',
      readFailed: '{name} couldn’t be read.',
      big: '{name} is too big: up to 50 MB.',
      emptySheet: 'This sheet is empty.',
      empty: 'Drop a file or paste rows: the separator, the encoding and the decimal mark are found by themselves.',
      reading: 'Reading {name}…',
      failed: 'Couldn’t write the file.',
    },
    de: {
      drop: 'CSV- oder Excel-Datei hier ablegen oder auswählen',
      dropHint: 'CSV, TSV oder XLSX: ein Export von der Bank oder aus einem Shop.',
      paste: 'Zeilen einfügen',
      placeholder: 'Oder hier Zeilen aus einer CSV oder Tabelle einfügen',
      clear: 'Leeren',
      found: 'Erkannt',
      file: 'Datei',
      workbook: 'Excel-Arbeitsmappe',
      sheet: 'Blatt',
      separator: 'Trennzeichen',
      sep_semicolon: 'Semikolon',
      sep_comma: 'Komma',
      sep_tab: 'Tab',
      sep_pipe: 'Senkrechter Strich',
      encoding: 'Kodierung',
      'enc_utf-8-bom': 'UTF-8 mit BOM',
      decimal: 'Dezimal',
      dec_comma: 'Komma',
      dec_point: 'Punkt',
      guessed: 'Geschätzt: keine Nachkommastellen darin',
      readSep: 'Spalten getrennt durch',
      readMark: 'Dezimalzeichen der Zahlen',
      readEnc: 'Kodierung der Datei',
      isFound: 'In der Datei erkannt',
      isFoundText: 'In den Zeilen erkannt',
      isChosen: 'Deine Wahl · erkannt: {found}',
      like: 'Wie {example}',
      withBom: 'Mit BOM',
      size: 'Umfang',
      'rows.one': '{count} Zeile',
      'rows.other': '{count} Zeilen',
      'cols.one': '{count} Spalte',
      'cols.other': '{count} Spalten',
      header: 'Kopfzeile',
      firstRow: 'Erste Zeile ist die Kopfzeile',
      firstRowHint: 'Ihre Namen stehen über den Spalten',
      saveAs: 'Speichern als',
      format: 'Format',
      excel: 'Excel',
      csv: 'CSV',
      writes: 'Trennzeichen',
      forSemicolon: 'Mit Dezimalkomma, für Excel auf Deutsch',
      forComma: 'Mit Dezimalpunkt, für Excel auf Englisch',
      forCsv: 'für jedes Werkzeug, das CSV schreibt',
      nowSemicolon: 'Jedes Werkzeug, das CSV schreibt, nimmt jetzt Semikolons',
      nowComma: 'Jedes Werkzeug, das CSV schreibt, nimmt jetzt Kommas',
      excelNote: 'Zahlen als Zahlen, Daten als Daten, Text bleibt, wie er ist.',
      csvNote: 'UTF-8 mit BOM, damit Excel die Umlaute zeigt.',
      preview: 'Vorschau',
      row: 'Zeile',
      type: 'Typ von {name}',
      column: 'Spalte {n}',
      number: 'Zahl',
      text: 'Text',
      date: 'Datum',
      shown: 'Die ersten {shown} von {count} Zeilen. Speichern nimmt alle.',
      'short.one': 'Zeile {list} war zu kurz: mit leeren Zellen aufgefüllt.',
      'short.other': '{n} Zeilen waren zu kurz ({list}): mit leeren Zellen aufgefüllt.',
      wrecks: 'Excel entfernt eine führende 0 trotzdem, wenn es eine CSV öffnet (aus 01067 wird 1067): speichere als Excel, um sie zu behalten.',
      unclosed: 'Ein Anführungszeichen in Zeile {line}, Spalte {column} wird nie geschlossen: der Rest steht in einer Zelle.',
      stray: 'Text nach einem schließenden Anführungszeichen in Zeile {line}, Spalte {column}: er bleibt in der Zelle.',
      oldXls: 'Alte .xls-Dateien: speichere sie zuerst in Excel als .xlsx.',
      notTable: '{name} ist keine Tabelle, die dieses Werkzeug lesen kann.',
      notExcel: '{name} ließ sich nicht als Excel-Datei lesen.',
      readFailed: '{name} ließ sich nicht lesen.',
      big: '{name} ist zu groß: bis 50 MB.',
      emptySheet: 'Dieses Blatt ist leer.',
      empty: 'Leg eine Datei ab oder füg Zeilen ein: Trennzeichen, Kodierung und Dezimalzeichen werden von selbst erkannt.',
      reading: '{name} wird gelesen…',
      failed: 'Die Datei ließ sich nicht schreiben.',
    },
  });

  // What it saves is kept; the table is not.
  const o = remember('csv', { out: 'xlsx' as 'xlsx' | 'csv' });

  const MAX_BYTES = 50_000_000;
  const PREVIEW = 50;
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const SEP_NAMES: Record<Separator, 'semicolon' | 'comma' | 'tab' | 'pipe'> = { ';': 'semicolon', ',': 'comma', '\t': 'tab', '|': 'pipe' };

  type Source =
    | { kind: 'csv'; bytes: Uint8Array; text: string; encoding: Encoding; name: string; size: number; hint?: Separator }
    | { kind: 'xlsx'; sheets: { name: string; rows: Value[][] }[]; name: string; size: number };

  // Raw: a big table isn't made reactive cell by cell.
  let source = $state.raw<Source | null>(null);
  let pasted = $state('');
  let sheetAt = $state(0);
  let headerChoice = $state<boolean | null>(null);
  let typeChoice = $state<Record<number, ColumnType>>({});
  /** Picked here for this file; an Excel file in goes out as a CSV unless someone picks again. */
  let outChoice = $state<'xlsx' | 'csv' | null>(null);
  // Corrections of what was found: they belong to this file, so they're never kept.
  let sepChoice = $state<Separator | null>(null);
  let markChoice = $state<Mark | null>(null);
  let encChoice = $state<Chosen | null>(null);
  let problem = $state('');
  let reading = $state('');

  function reset() {
    headerChoice = null;
    typeChoice = {};
    outChoice = null;
    sepChoice = null;
    markChoice = null;
    encChoice = null;
    sheetAt = 0;
    problem = '';
  }

  async function open(list: File[]) {
    const f = list[0];
    if (!f) return;
    reset();
    if (f.size > MAX_BYTES) {
      problem = w('big', { name: f.name });
      return;
    }
    reading = f.name;
    try {
      const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
      if (isOldXls(head) || /\.xls$/i.test(f.name)) {
        source = null;
        problem = w('oldXls');
        return;
      }
      if (isZip(head)) {
        try {
          const { default: readExcel } = await import('read-excel-file/browser');
          const sheets = (await readExcel(f, { trim: false })).map((s) => ({ name: s.sheet, rows: s.data as unknown as Value[][] }));
          source = { kind: 'xlsx', sheets, name: f.name, size: f.size };
          sheetAt = Math.max(0, sheets.findIndex((s) => s.rows.length));
          pasted = '';
        } catch {
          source = null;
          problem = w('notExcel', { name: f.name });
        }
        return;
      }
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { text, encoding } = decodeBytes(bytes);
      if (sniff(bytes.subarray(0, 1024)) !== 'other' || text.slice(0, 8192).includes('\u0000')) {
        source = null;
        problem = w('notTable', { name: f.name });
        return;
      }
      const tab = /\.tsv$/i.test(f.name) || f.type === 'text/tab-separated-values';
      source = { kind: 'csv', bytes, text, encoding, name: f.name, size: f.size, hint: tab ? '\t' : undefined };
      pasted = '';
    } catch {
      source = null;
      problem = w('readFailed', { name: f.name });
    } finally {
      reading = '';
    }
  }

  function clear() {
    source = null;
    pasted = '';
    reset();
  }

  // A file or rows from the home go in, once.
  const given = untrack(() => ({ text: texts(items)[0], file: filesOf(items)[0] }));
  if (given.file) void open([given.file]);
  else if (given.text) pasted = given.text;

  // Long pasted text waits for a pause in typing; everyday rows follow every key.
  let settled = $state('');
  $effect(() => {
    const t = pasted;
    if (t.length < 100_000) {
      settled = t;
      return;
    }
    const timer = setTimeout(() => (settled = t), 250);
    return () => clearTimeout(timer);
  });

  const read = $derived.by((): { table: Table; found: FromCsv | null } | null => {
    if (source?.kind === 'xlsx') {
      const sheet = source.sheets[sheetAt] ?? source.sheets[0];
      return sheet ? { table: fromSheet(sheet.rows), found: null } : null;
    }
    const text = source?.kind === 'csv' ? (encChoice ? decodeAs(source.bytes, encChoice) : source.text) : settled;
    if (!text.trim()) return null;
    const found = fromCsv(text, { hint: source?.kind === 'csv' ? source.hint : undefined, sep: sepChoice, mark: markChoice });
    return { table: found, found };
  });

  const table = $derived(read?.table ?? null);
  const found = $derived(read?.found ?? null);
  /** The file's decimal mark; an Excel file's numbers have none, so the setting's. */
  const mark = $derived<Mark>(found?.mark ?? shared.decimal);
  const header = $derived(table ? (headerChoice ?? guessHeader(table, mark)) : false);
  const guessed = $derived(table ? guessTypes(table, header, mark) : []);
  const types = $derived(guessed.map((t, c) => typeChoice[c] ?? t));
  const out = $derived(outChoice ?? (source?.kind === 'xlsx' ? 'csv' : o.out));
  const sep = $derived<Separator>(shared.csv === 'semicolon' ? ';' : ',');
  const bodyRows = $derived(table ? table.rows.length - (header ? 1 : 0) : 0);

  const saveName = $derived.by(() => {
    if (!source) return `table.${out}`;
    const same = source.name.toLowerCase().endsWith(`.${out}`);
    return outName(source.name, same ? 'excel' : '', out, shared.names);
  });
  const sheetName = $derived(source?.kind === 'xlsx' ? (source.sheets[sheetAt]?.name ?? 'Sheet1') : 'Sheet1');

  // What the file is made from; a new one each time anything in it changes, so a result made for
  // other choices is never offered.
  const job = $derived(table && table.rows.length ? { table, header, types, mark, out, sep, name: saveName, sheet: sheetName } : null);
  let made = $state.raw<{ job: NonNullable<typeof job>; output: Output } | null>(null);
  let failed = $state(false);

  async function build(j: NonNullable<typeof job>): Promise<Output> {
    if (j.out === 'csv') {
      const text = `﻿${writeCsv(toCsvRows(j.table, j.header, j.types, j.mark, j.sep), j.sep, '\r\n')}`;
      return { blob: new Blob([text], { type: 'text/csv;charset=utf-8' }), name: j.name };
    }
    const { default: writeExcelFile } = await import('write-excel-file/browser');
    const sheet = toXlsx(j.table, j.header, j.types, j.mark);
    const blob = await writeExcelFile(sheet.data as SheetData, {
      sheet: j.sheet.slice(0, 31) || 'Sheet1',
      columns: sheet.columns,
      ...(sheet.stickyRowsCount ? { stickyRowsCount: sheet.stickyRowsCount } : {}),
    }).toBlob();
    return { blob: blob.type ? blob : new Blob([blob], { type: XLSX }), name: j.name };
  }

  $effect(() => {
    const j = job;
    failed = false;
    if (!j) return;
    let live = true;
    build(j).then(
      (output) => {
        if (live) made = { job: j, output };
      },
      () => {
        if (live) failed = true;
      },
    );
    return () => {
      live = false;
    };
  });

  const outputs = $derived(made && job && made.job === job ? [made.output] : null);
  const nextItems = $derived(outputs ? [{ file: new File([outputs[0].blob], outputs[0].name, { type: outputs[0].blob.type }) }] : null);

  const count = (n: number) => formatNumber(n, shared.decimal);
  const shortList = $derived.by(() => {
    if (!table?.short.length) return '';
    const list = table.short.slice(0, 5).map((r) => String(r + 1));
    return table.short.length > 5 ? `${list.join(', ')} …` : list.join(', ');
  });
  const wrecked = $derived(table && out === 'csv' ? excelWrecks(table, header, types) : false);
  const shownRows = $derived(table ? table.rows.slice(0, PREVIEW + (header ? 1 : 0)) : []);

  /** A cell on screen: a CSV's as written; an Excel file's numbers and dates in the setting's style. */
  function show(v: Value): string {
    if (v === null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return formatNumber(v, shared.decimal, { max: 10 });
    if (v instanceof Date) return formatDate(v, shared.decimal === 'comma' ? 'dmy' : 'iso');
    return v ? 'TRUE' : 'FALSE';
  }

  function setType(c: number, t: ColumnType) {
    typeChoice = { ...typeChoice, [c]: t };
  }

  const sepName = (sep: Separator) => w(`sep_${SEP_NAMES[sep]}`);
  const markName = (m: Mark) => w(m === 'comma' ? 'dec_comma' : 'dec_point');
  /** "Found in the file", or "Your choice · found: Comma" once someone chose something else. */
  const status = (chosen: string | null, found: string, foundName: string) => (chosen !== null && chosen !== found ? w('isChosen', { found: foundName }) : source ? w('isFound') : w('isFoundText'));
</script>

<div class="cols">
  <div class="stack">
    {#if source}
      <FileRow name={source.name} meta={`${formatBytes(source.size, shared.decimal)}${source.kind === 'xlsx' ? ' · XLSX' : ''}`} onremove={clear} />
    {:else}
      {#if !pasted}
        <DropWell accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" title={w('drop')} hint={w('dropHint')} onfiles={open} />
      {/if}
      <div class="pastebox">
        <h2 class="h">
          <label for="csv-paste">{w('paste')}</label>
          {#if pasted}<em><button type="button" class="link" onclick={clear}>{w('clear')}</button></em>{/if}
        </h2>
        <textarea id="csv-paste" class="field rowsin" class:filled={!!pasted} spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" placeholder={w('placeholder')} bind:value={pasted}
          oninput={(e) => {
            if (!e.currentTarget.value) reset();
          }}></textarea>
      </div>
    {/if}

    {#if reading}<p class="note" aria-live="polite">{w('reading', { name: reading })}</p>{/if}
    {#if problem}<p class="note bad" role="alert">{problem}</p>{/if}

    {#if table && table.rows.length}
      <Grid
        rows={shownRows}
        columns={table.columns}
        {header}
        {types}
        {show}
        ontype={setType}
        labels={{ caption: w('preview'), row: w('row'), type: w('type'), number: w('number'), text: w('text'), date: w('date'), column: w('column') }}
      />
      {#if bodyRows > PREVIEW}<p class="note">{w('shown', { shown: PREVIEW, count: count(bodyRows) })}</p>{/if}
      {#if found?.issue}<p class="note bad">{w(found.issue.code, { line: found.issue.line, column: found.issue.column })}</p>{/if}
      {#if table.short.length}<p class="note">{w('short', { n: table.short.length, list: shortList })}</p>{/if}
    {:else if source?.kind === 'xlsx'}
      <p class="note">{w('emptySheet')}</p>
    {:else if !source && !pasted && !problem}
      <p class="note">{w('empty')}</p>
    {/if}
  </div>

  <div class="stack">
    {#if table && table.rows.length}
      <section class="part">
        <h2 class="h">{w('found')}</h2>
        <dl class="spec facts">
          {#if source?.kind === 'xlsx'}
            <div>
              <dt>{w('file')}</dt>
              <dd><span>{w('workbook')}</span></dd>
            </div>
            {#if source.sheets.length > 1}
              <div>
                <dt>{w('sheet')}</dt>
                <dd>
                  <Seg
                    label={w('sheet')}
                    value={sheetAt}
                    options={source.sheets.map((s, i) => ({ value: i, label: s.name }))}
                    onchange={(i) => {
                      headerChoice = null;
                      typeChoice = {};
                      sheetAt = i;
                    }}
                  />
                </dd>
              </div>
            {/if}
          {/if}
          {#if found}
            <div>
              <dt>{w('separator')}</dt>
              <dd>
                <Seg
                  label={w('readSep')}
                  value={found.sep}
                  options={(Object.keys(SEP_NAMES) as Separator[]).map((sep) => ({ value: sep, label: sep === '\t' ? sepName(sep) : `${sepName(sep)} ${sep}` }))}
                  onchange={(sep) => {
                    sepChoice = sep;
                    typeChoice = {};
                  }}
                />
                <span class="note">{status(sepChoice, found.foundSep, sepName(found.foundSep))}</span>
              </dd>
            </div>
            <div>
              <dt>{w('decimal')}</dt>
              <dd>
                <Seg
                  label={w('readMark')}
                  value={found.mark}
                  options={[
                    { value: 'comma', label: w('dec_comma') },
                    { value: 'point', label: w('dec_point') },
                  ]}
                  onchange={(m) => (markChoice = m)}
                />
                <span class="note">
                  {w('like', { example: found.mark === 'comma' ? '1.234,56' : '1,234.56' })} ·
                  {markChoice === null && !found.sure ? w('guessed') : status(markChoice, found.foundMark, markName(found.foundMark))}
                </span>
              </dd>
            </div>
            {#if source?.kind === 'csv'}
              {@const foundEnc = chosenOf(source.encoding)}
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
                    onchange={(e) => (encChoice = e)}
                  />
                  <span class="note">
                    {source.encoding === 'utf-8-bom' ? `${w('withBom')} · ` : ''}{status(encChoice, foundEnc, w(`enc_${foundEnc}`))}
                  </span>
                </dd>
              </div>
            {/if}
          {/if}
          <div>
            <dt>{w('size')}</dt>
            <dd><span>{w('rows', { n: bodyRows, count: count(bodyRows) })} · {w('cols', { n: table.columns, count: count(table.columns) })}</span></dd>
          </div>
          <div>
            <dt>{w('header')}</dt>
            <dd><Check checked={header} label={w('firstRow')} hint={w('firstRowHint')} onchange={(v) => (headerChoice = v)} /></dd>
          </div>
        </dl>
      </section>
    {/if}

    <section class="part">
      <h2 class="h">{w('saveAs')}</h2>
      <dl class="spec">
        <div>
          <dt>{w('format')}</dt>
          <dd>
            <Seg
              label={w('format')}
              value={out}
              options={[
                { value: 'xlsx', label: `${w('excel')} .xlsx` },
                { value: 'csv', label: `${w('csv')} .csv` },
              ]}
              onchange={(v) => {
                outChoice = v;
                o.out = v;
              }}
            />
            <span class="note">{out === 'xlsx' ? w('excelNote') : w('csvNote')}</span>
          </dd>
        </div>
        {#if out === 'csv'}
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
              <span class="note">{shared.csv === 'semicolon' ? w('forSemicolon') : w('forComma')} · {w('forCsv')}</span>
            </dd>
          </div>
        {/if}
      </dl>
    </section>

    {#if table && table.rows.length}
      {#if wrecked}<p class="note">{w('wrecks')}</p>{/if}
      {#if failed}<p class="note bad" role="alert">{w('failed')}</p>{/if}
      <SaveButton {outputs} busy={!outputs && !failed} tool={tool.id} />
      <NextTools items={nextItems} from={tool.id} prefer={['csvjson']} />
    {/if}
  </div>
</div>

<style>
  .pastebox {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .pastebox .h em {
    display: flex;
    gap: 12px;
  }

  .rowsin {
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.55;
    min-height: 120px;
    white-space: pre;
    overflow-x: auto;
  }

  .rowsin.filled {
    min-height: 140px;
  }

  @media (hover: none) {
    .rowsin {
      font-size: 16px;
    }
  }

  .part {
    display: grid;
    min-width: 0;
  }

  /* The heading's ink rule is the list's top rule. */
  .part .spec {
    border-top: 0;
  }

  .facts dd > span:not(.note) {
    font-size: 15px;
  }
</style>

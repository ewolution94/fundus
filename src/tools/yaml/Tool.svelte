<!--
  F-910 YAML ↔ JSON: paste or open either; the direction follows what came in (a brace or bracket
  first is JSON), and the switch turns it round. Several YAML documents become a list; comments
  can't come along, and it says so. A mistake is named with its line and column, the line marked.
  JSON comes out indented by two, YAML in block style with its keys in order (yaml.ts).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { CircleCheck } from '@lucide/svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, locale } from '../../lib/i18n.svelte.ts';
  import { shared } from '../../lib/settings.svelte.ts';
  import { texts, files as filesOf, type Item } from '../../lib/inbox.svelte.ts';
  import { formatBytes, outName } from '../../lib/files.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { convert, detect, directionOf, excerpt, fromFile, type Direction, type YamlError } from './yaml.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      direction: 'Direction',
      toJson: 'YAML → JSON',
      toYaml: 'JSON → YAML',
      yaml: 'YAML',
      json: 'JSON',
      result: 'Result',
      placeholder: 'Paste YAML or JSON',
      open: 'Open a .yaml or .json file',
      clear: 'Clear',
      empty: 'Paste YAML or JSON, or open a file: the other one follows. The direction goes by what comes in.',
      done: 'Converted',
      'docs.one': '1 document',
      'docs.other': '{n} documents',
      docsList: '{n} documents: they’re one list in the JSON.',
      'comments.one': '1 comment left out: JSON has no comments.',
      'comments.other': '{n} comments left out: JSON has no comments.',
      nonFinite: '.inf and .nan have no JSON form: written as null.',
      where: 'Line {line}, column {column}',
      BAD_INDENT: 'The indentation doesn’t fit here.',
      BAD_INDENT_CLOSE: 'A {found} is missing, or the lines after it aren’t indented enough.',
      TAB_AS_INDENT: 'A tab as indentation: YAML wants spaces.',
      DUPLICATE_KEY: 'The key {found} is already in this map.',
      MISSING_QUOTE: 'A closing {found} is missing.',
      MISSING_CLOSE: 'A {found} is missing at the end.',
      MISSING_VALUE: 'A key without a value: is a colon missing?',
      MISSING_CHAR: 'Something is missing here.',
      BLOCK_AS_IMPLICIT_KEY: 'A map or a list can’t start here: is the indentation right, or is there a colon too many?',
      MULTILINE_IMPLICIT_KEY: 'A key has to stay on one line: is the indentation right?',
      UNEXPECTED_TOKEN: '{found} can’t stand here.',
      BAD_SCALAR_START: 'A value can’t start with {found} without quotes: put it in quotes.',
      BAD_DQ_ESCAPE: '{found} isn’t an escape YAML knows.',
      BAD_ALIAS: 'The anchor for {found} isn’t set before it.',
      ALIASES: 'Too many aliases: the result would grow without end, so it’s stopped.',
      MULTIPLE_ANCHORS: 'Two anchors on one value: one is allowed.',
      MULTIPLE_TAGS: 'Two tags on one value: one is allowed.',
      BLOCK_IN_FLOW: 'A block inside brackets: within [ ] and { } everything stays on its line.',
      KEY_OVER_1024_CHARS: 'A key longer than 1,024 characters.',
      BAD_DIRECTIVE: 'A directive (%) that YAML doesn’t know.',
      OTHER: 'YAML can’t read this.',
      tooBig: '{name} is too big: up to 5 MB.',
      readFailed: '{name} couldn’t be read as text.',
    },
    de: {
      direction: 'Richtung',
      toJson: 'YAML → JSON',
      toYaml: 'JSON → YAML',
      yaml: 'YAML',
      json: 'JSON',
      result: 'Ergebnis',
      placeholder: 'YAML oder JSON einfügen',
      open: 'Eine .yaml- oder .json-Datei öffnen',
      clear: 'Leeren',
      empty: 'Füg YAML oder JSON ein oder öffne eine Datei: das andere folgt. Die Richtung ergibt sich aus dem, was kommt.',
      done: 'Umgewandelt',
      'docs.one': '1 Dokument',
      'docs.other': '{n} Dokumente',
      docsList: '{n} Dokumente: im JSON sind sie eine Liste.',
      'comments.one': '1 Kommentar weggelassen: JSON kennt keine Kommentare.',
      'comments.other': '{n} Kommentare weggelassen: JSON kennt keine Kommentare.',
      nonFinite: '.inf und .nan gibt es in JSON nicht: geschrieben als null.',
      where: 'Zeile {line}, Spalte {column}',
      BAD_INDENT: 'Die Einrückung passt hier nicht.',
      BAD_INDENT_CLOSE: 'Ein {found} fehlt, oder die Zeilen danach sind nicht weit genug eingerückt.',
      TAB_AS_INDENT: 'Ein Tab als Einrückung: YAML will Leerzeichen.',
      DUPLICATE_KEY: 'Den Schlüssel {found} gibt es in dieser Map schon.',
      MISSING_QUOTE: 'Ein schließendes {found} fehlt.',
      MISSING_CLOSE: 'Am Ende fehlt ein {found}.',
      MISSING_VALUE: 'Ein Schlüssel ohne Wert: fehlt ein Doppelpunkt?',
      MISSING_CHAR: 'Hier fehlt etwas.',
      BLOCK_AS_IMPLICIT_KEY: 'Hier kann keine Map und keine Liste anfangen: stimmt die Einrückung, oder ist ein Doppelpunkt zu viel?',
      MULTILINE_IMPLICIT_KEY: 'Ein Schlüssel muss auf einer Zeile bleiben: stimmt die Einrückung?',
      UNEXPECTED_TOKEN: '{found} kann hier nicht stehen.',
      BAD_SCALAR_START: 'Ein Wert kann ohne Anführungszeichen nicht mit {found} anfangen: setz ihn in Anführungszeichen.',
      BAD_DQ_ESCAPE: '{found} ist kein Escape, das YAML kennt.',
      BAD_ALIAS: 'Der Anker für {found} steht nicht davor.',
      ALIASES: 'Zu viele Aliase: das Ergebnis würde endlos wachsen, deshalb ist Schluss.',
      MULTIPLE_ANCHORS: 'Zwei Anker an einem Wert: einer ist erlaubt.',
      MULTIPLE_TAGS: 'Zwei Tags an einem Wert: einer ist erlaubt.',
      BLOCK_IN_FLOW: 'Ein Block in Klammern: innerhalb von [ ] und { } bleibt alles auf seiner Zeile.',
      KEY_OVER_1024_CHARS: 'Ein Schlüssel mit mehr als 1.024 Zeichen.',
      BAD_DIRECTIVE: 'Eine Direktive (%), die YAML nicht kennt.',
      OTHER: 'YAML kann das nicht lesen.',
      tooBig: '{name} ist zu groß: bis 5 MB.',
      readFailed: '{name} ließ sich nicht als Text lesen.',
    },
  });

  const MAX_BYTES = 5_000_000;
  /** Past this the result shows only its start; Copy and Save have all of it. */
  const SHOW_LIMIT = 200_000;

  let input = $state('');
  let fileName = $state<string | null>(null);
  let readError = $state('');
  let direction = $state<Direction>('toJson');
  /** Turned round by hand: then typing doesn't turn it back. */
  let picked = false;

  function take(text: string) {
    input = text;
    if (!picked) direction = detect(text);
  }

  async function open(list: File[]) {
    const file = list[0];
    if (!file) return;
    readError = '';
    if (file.size > MAX_BYTES) {
      readError = w('tooBig', { name: file.name });
      return;
    }
    try {
      const text = fromFile(await file.text());
      fileName = file.name;
      picked = false;
      input = text;
      direction = directionOf(file.name) ?? detect(text);
    } catch {
      readError = w('readFailed', { name: file.name });
    }
  }

  function clear() {
    input = '';
    fileName = null;
    readError = '';
    picked = false;
  }

  // What was pasted or dropped on the home goes in, once.
  const given = untrack(() => ({ text: texts(items)[0], file: filesOf(items)[0] }));
  if (given.file) void open([given.file]);
  else if (given.text) take(given.text);

  const mark = $derived(shared.decimal);
  const result = $derived(input.trim() ? convert(input, direction) : null);
  const outExt = $derived(direction === 'toJson' ? 'json' : 'yaml');
  const inName = $derived(fileName ?? (direction === 'toJson' ? 'data.yaml' : 'data.json'));
  const sameExt = $derived((/\.(json|ya?ml)$/i.exec(inName)?.[1].toLowerCase().replace('yml', 'yaml') ?? '') === outExt);
  const saveName = $derived(outName(inName, sameExt ? 'converted' : '', outExt, shared.names));
  const type = $derived(direction === 'toJson' ? 'application/json' : 'application/yaml');
  const outputs = $derived(result?.ok ? [{ blob: new Blob([`${result.out}\n`], { type }), name: saveName }] : null);
  const nextItems = $derived(outputs ? [{ file: new File([outputs[0].blob], outputs[0].name, { type }) }] : null);
  const size = $derived(new Blob([input]).size);

  const quote = (s: string) => (locale() === 'de' ? `„${s}“` : `“${s}”`);
  const shownChar = (s: string) => quote(s === '\t' ? 'Tab' : s);

  function message(e: YamlError): string {
    const found = shownChar(e.found);
    if (e.code === 'BAD_INDENT' && e.found) return w('BAD_INDENT_CLOSE', { found: e.found });
    if (e.code === 'MISSING_CHAR') {
      if (/followed by map values/.test(e.detail)) return w('MISSING_VALUE');
      if (e.found === '"' || e.found === "'") return w('MISSING_QUOTE', { found: e.found });
      if (e.found) return w('MISSING_CLOSE', { found: e.found });
      return w('MISSING_CHAR');
    }
    const known = ['BAD_INDENT', 'TAB_AS_INDENT', 'DUPLICATE_KEY', 'BLOCK_AS_IMPLICIT_KEY', 'MULTILINE_IMPLICIT_KEY', 'UNEXPECTED_TOKEN', 'BAD_SCALAR_START', 'BAD_DQ_ESCAPE', 'BAD_ALIAS', 'ALIASES', 'MULTIPLE_ANCHORS', 'MULTIPLE_TAGS', 'BLOCK_IN_FLOW', 'KEY_OVER_1024_CHARS', 'BAD_DIRECTIVE'] as const;
    const code = known.find((k) => k === e.code) ?? 'OTHER';
    return w(code, { found });
  }
</script>

<div class="yaml">
  <Seg
    large
    label={w('direction')}
    value={direction}
    options={[
      { value: 'toJson', label: w('toJson') },
      { value: 'toYaml', label: w('toYaml') },
    ]}
    onchange={(d) => {
      direction = d;
      picked = true;
    }}
  />

  <div class="cols even">
    <div class="stack">
      <h2 class="h">
        {direction === 'toJson' ? w('yaml') : w('json')}
        <em>{fileName ? `${fileName} · ` : ''}{input ? formatBytes(size, mark) : ''}</em>
      </h2>
      <textarea
        class="field code"
        aria-label={direction === 'toJson' ? w('yaml') : w('json')}
        placeholder={w('placeholder')}
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        value={input}
        oninput={(e) => take(e.currentTarget.value)}
      ></textarea>
      <div class="row">
        <div class="grow"><DropWell compact accept=".yaml,.yml,.json,application/json,application/yaml,text/yaml,text/plain" title={w('open')} onfiles={open} /></div>
        {#if input}<button type="button" class="btn" onclick={clear}>{w('clear')}</button>{/if}
      </div>
      {#if readError}<p class="note bad" role="alert">{readError}</p>{/if}
    </div>

    <div class="stack">
      {#if !result}
        <p class="note">{w('empty')}</p>
      {:else if !result.ok}
        {@const e = result.error}
        <div class="error" role="alert">
          <p>{message(e)}</p>
          {#if e.line}
            {@const x = excerpt(fromFile(input), e.offset)}
            <p class="where">{w('where', { line: e.line, column: e.column })}</p>
            <pre class="mono-out excerpt"><span class="ln">{e.line}</span>{x.cutStart ? '…' : ''}{x.before}<mark class:gap={!x.at || x.at === '\t'}>{x.at === '\t' ? '⇥' : x.at || ' '}</mark>{x.after}{x.cutEnd ? '…' : ''}</pre>
          {/if}
          {#if !e.line || message(e) === w('OTHER')}<p class="detail">{e.detail}</p>{/if}
        </div>
      {:else}
        <div class="bar">
          <p class="ok" aria-live="polite">
            <CircleCheck aria-hidden="true" />
            <span>{w('done')}{result.documents > 1 ? ` · ${w('docs', { n: result.documents })}` : ''}</span>
          </p>
          <CopyButton variant="button" text={result.out} />
        </div>
        {#if direction === 'toJson' && (result.documents > 1 || result.comments || result.nonFinite)}
          <ul class="notes">
            {#if result.documents > 1}<li class="note">{w('docsList', { n: result.documents })}</li>{/if}
            {#if result.comments}<li class="note">{w('comments', { n: result.comments })}</li>{/if}
            {#if result.nonFinite}<li class="note">{w('nonFinite')}</li>{/if}
          </ul>
        {/if}
        <div class="work out" aria-label={w('result')} role="region">
          <pre class="mono-out">{result.out.length > SHOW_LIMIT ? result.out.slice(0, SHOW_LIMIT) : result.out}</pre>
        </div>
        <SaveButton {outputs} tool={tool.id} />
        <NextTools items={nextItems} from={tool.id} prefer={direction === 'toJson' ? ['json', 'hash'] : ['hash', 'base64']} />
      {/if}
    </div>
  </div>
</div>

<style>
  .yaml {
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

  .notes {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .error {
    display: grid;
    gap: 6px;
    overflow-wrap: anywhere;
  }

  .where,
  .detail {
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
    min-width: 0.7ch;
  }
</style>

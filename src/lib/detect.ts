/**
 * Detection: whatever is dropped, pasted or picked on the home, the tools that take it come first,
 * each with its reason ("It's a HEIC: make it a JPG"). The reasons come from the thing itself: its
 * kind, its size, its pixels, whether it knows where it was taken.
 */

import { TOOLS, type Tool } from './catalog.ts';
import { kindOf, dimensions, formatBytes, isAudio, isVideo, isSvg, isSheet, type Kind } from './files.ts';
import { readMeta } from './exif.ts';
import { shapes } from './shapes.ts';
import { shared } from './settings.svelte.ts';
import type { Item } from './inbox.svelte.ts';

export interface Suggestion {
  tool: Tool;
  why: { en: string; de: string };
}

const PHOTO: Kind[] = ['jpeg', 'png', 'webp', 'heic', 'avif', 'gif'];
const tool = (id: string) => TOOLS.find((t) => t.id === id)!;
const s = (id: string, en: string, de: string): Suggestion => ({ tool: tool(id), why: { en, de } });

async function forFile(file: File): Promise<Suggestion[]> {
  const kind = await kindOf(file);
  const mark = shared.decimal;
  if (PHOTO.includes(kind)) {
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    const size = formatBytes(file.size, mark);
    const dims = dimensions(head);
    const meta = kind === 'heic' || kind === 'avif' ? readMeta(new Uint8Array(await file.arrayBuffer())) : readMeta(head);
    const out: Suggestion[] = [];
    if (kind === 'heic') out.push(s('convert', "It's a HEIC: make it a JPG", 'Ein HEIC: mach ein JPG daraus'));
    else if (kind === 'avif' || kind === 'webp') out.push(s('convert', `It's a ${kind.toUpperCase()}: make it a JPG`, `Ein ${kind.toUpperCase()}: mach ein JPG daraus`));
    if (file.size > 1e6) out.push(s('shrink', `${size}: make it smaller`, `${size}: mach es kleiner`));
    if (meta.gps) out.push(s('location', 'It knows where it was taken', 'Es weiß, wo es aufgenommen wurde'));
    if (dims) out.push(s('resize', `${dims.width} × ${dims.height}: make it fit`, `${dims.width} × ${dims.height}: passend machen`));
    else out.push(s('resize', 'Make it fit: a size, a crop', 'Passend machen: Größe, Zuschnitt'));
    if (kind !== 'heic' && kind !== 'avif' && kind !== 'webp') out.push(s('convert', 'Save it as another format', 'In einem anderen Format speichern'));
    if (file.size <= 1e6) out.push(s('shrink', `${size}: smaller still`, `${size}: noch kleiner`));
    if (!meta.gps) out.push(s('location', 'See what it gives away', 'Sieh, was es verrät'));
    out.push(s('blur', 'Hide a face or a number', 'Ein Gesicht oder eine Nummer verbergen'));
    out.push(s('topdf', 'Put it in a PDF', 'In ein PDF legen'));
    if (dims && Math.abs(dims.width - dims.height) <= Math.max(dims.width, dims.height) / 10) out.push(s('icons', 'Square: make icons from it', 'Quadratisch: Icons daraus machen'));
    out.push(s('colours', 'Pick a colour from it', 'Eine Farbe daraus wählen'));
    out.push(s('qr', 'Read a QR code in it', 'Einen QR-Code darin lesen'));
    return out;
  }
  if (kind === 'pdf') {
    const text = new TextDecoder('latin1').decode(new Uint8Array(await file.arrayBuffer()));
    const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    const n = pages || 1;
    return [
      s('arrange', n > 1 ? `${n} pages: reorder, split or merge` : 'Merge it with another, rotate it', n > 1 ? `${n} Seiten: sortieren, teilen, zusammenfügen` : 'Mit einem anderen zusammenfügen, drehen'),
      s('sign', 'Sign it, add the date', 'Unterschreiben, Datum dazu'),
      s('pdfimg', n > 1 ? `Every page as a photo (${n})` : 'The page as a photo', n > 1 ? `Jede Seite als Foto (${n})` : 'Die Seite als Foto'),
    ];
  }
  if (isSvg(file)) return [s('convert', 'A vector picture: make it a PNG', 'Ein Vektorbild: mach ein PNG daraus'), s('icons', 'Make icons from it for a website', 'Icons für eine Website daraus machen')];
  if (isAudio(file)) {
    const ext = (file.name.match(/\.(\w+)$/)?.[1] ?? 'audio').toUpperCase();
    return [ext === 'MP3' ? s('audio', 'An MP3: trim it, or make it a WAV', 'Ein MP3: kürzen, oder ein WAV daraus machen') : s('audio', `${ext}: make it an MP3`, `${ext}: mach ein MP3 daraus`)];
  }
  if (isVideo(file)) return [s('audio', 'A video: keep its sound as an MP3', 'Ein Video: den Ton als MP3 behalten')];
  if (isSheet(file)) {
    const xlsx = /\.xlsx$/i.test(file.name);
    return [
      xlsx ? s('csv', 'An Excel file: save it as a CSV', 'Eine Excel-Datei: als CSV speichern') : s('csv', 'A CSV: open it properly, save it for Excel', 'Eine CSV: richtig öffnen, für Excel speichern'),
      s('csvjson', 'As JSON', 'Als JSON'),
    ];
  }
  if (/\.ya?ml$/i.test(file.name)) return [s('yaml', 'YAML: as JSON', 'YAML: als JSON')];
  if (/json/.test(file.type) || /\.json$/i.test(file.name)) return [s('json', 'Format and check it', 'Formatieren und prüfen'), s('yaml', 'As YAML', 'Als YAML'), s('csvjson', 'As a CSV', 'Als CSV'), s('hash', 'Its checksum', 'Die Prüfsumme')];
  if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
    const text = await file.text();
    // Bytes that aren't UTF-8 (a Windows-1252 file, say) come out as U+FFFD.
    const wrong = text.includes('\uFFFD') ? [s('umlauts', 'Read in the wrong encoding: fix its umlauts', 'Mit dem falschen Zeichensatz gelesen: Umlaute reparieren')] : [];
    return [...wrong, ...forText(text)];
  }
  return [s('hash', 'Its checksum, to compare with the download page', 'Die Prüfsumme, zum Vergleich mit der Download-Seite'), s('base64', 'As Base64', 'Als Base64')];
}

function forText(text: string): Suggestion[] {
  const kinds = shapes(text);
  const out: Suggestion[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (kinds.includes('mojibake')) out.push(s('umlauts', 'These umlauts look broken: fix them', 'Diese Umlaute sehen kaputt aus: reparieren'));
  for (const k of kinds) {
    if (k === 'link') out.push(s('qr', 'A link: make it a QR code', 'Ein Link: mach einen QR-Code daraus'), s('url', 'Read or encode the link', 'Den Link lesen oder kodieren'));
    if (k === 'timestamp') out.push(s('stamp', 'A Unix time: see the date', 'Eine Unix-Zeit: das Datum dazu'));
    if (k === 'date') out.push(s('dates', 'A date: days until, the week', 'Ein Datum: Tage bis dahin, die Woche'), s('stamp', 'As a timestamp', 'Als Zeitstempel'));
    if (k === 'json') {
      out.push(s('json', 'JSON: format and check it', 'JSON: formatieren und prüfen'), s('yaml', 'As YAML', 'Als YAML'));
      if (text.trim().startsWith('[')) out.push(s('csvjson', 'As a CSV', 'Als CSV'));
    }
    if (k === 'csv') out.push(s('csv', 'Rows of a table: save them for Excel', 'Zeilen einer Tabelle: für Excel speichern'), s('csvjson', 'As JSON', 'Als JSON'));
    if (k === 'yaml') out.push(s('yaml', 'YAML: as JSON', 'YAML: als JSON'));
    if (k === 'jwt') out.push(s('jwt', 'A JWT: read it, check its signature', 'Ein JWT: lesen, Signatur prüfen'));
    if (k === 'colour') out.push(s('colours', 'A colour: every code and its contrast', 'Eine Farbe: jeder Code und ihr Kontrast'));
    if (k === 'roman') out.push(s('words', 'Roman numerals: as a number', 'Römische Zahl: als Zahl'));
    if (k === 'bases') out.push(s('bases', 'In every base', 'In jeder Basis'));
    if (k === 'number') {
      out.push(s('percent', 'A number: VAT, percent', 'Eine Zahl: MwSt., Prozent'), s('units', 'In other units', 'In anderen Einheiten'), s('bill', 'Split it', 'Aufteilen'));
      out.push(s('words', 'In words, for a contract', 'In Worten, für einen Vertrag'));
      if (/^-?\d+$/.test(text.trim())) out.push(s('bases', 'In binary and hex', 'Binär und hex'));
    }
    if (k === 'uuid') out.push(s('uuid', 'A UUID: its version and time', 'Eine UUID: Version und Zeit'));
    if (k === 'base64') out.push(s('base64', 'Looks like Base64: decode it', 'Sieht nach Base64 aus: dekodieren'));
    if (k === 'text') {
      out.push(s('count', `${words} ${words === 1 ? 'word' : 'words'}: count them`, `${words} ${words === 1 ? 'Wort' : 'Wörter'}: zählen`));
      out.push(s('clean', 'Tidy its case and spacing', 'Schreibung und Abstände aufräumen'));
      out.push(s('compare', 'Compare it with another version', 'Mit einer anderen Fassung vergleichen'));
      if (!kinds.includes('link')) out.push(s('qr', 'Put it in a QR code', 'In einen QR-Code packen'));
      out.push(s('hash', 'Its hash', 'Der Hash'));
    }
  }
  return out;
}

/**
 * The tools for what's in the inbox, each once, best reason first. The developer shelf's tools only
 * with its switch on.
 */
export async function suggest(items: Item[]): Promise<Suggestion[]> {
  const all: Suggestion[] = [];
  for (const item of items) all.push(...('file' in item ? await forFile(item.file) : forText(item.text)));
  const seen = new Set<string>();
  return all.filter((x) => {
    if (seen.has(x.tool.id) || (x.tool.chip === 'dev' && !shared.dev)) return false;
    seen.add(x.tool.id);
    return true;
  });
}

/** Whether a tool takes an item, after its catalogue entry's `accepts`. */
export async function accepts(t: Tool, item: Item): Promise<boolean> {
  if ('text' in item) {
    const k = shapes(item.text);
    return t.accepts.some((a) => (k as string[]).includes(a));
  }
  const kind = await kindOf(item.file);
  return t.accepts.some((a) => {
    if (a === '*') return true;
    if (a === 'image/*') return PHOTO.includes(kind);
    if (a === 'application/pdf' || a === '.pdf') return kind === 'pdf';
    if (a === 'audio/*') return isAudio(item.file);
    if (a === 'video/*') return isVideo(item.file);
    if (a.startsWith('.')) return item.file.name.toLowerCase().endsWith(a);
    // A table is text too, but its rows go to the table tools, not Count words.
    if (a === 'text') return item.file.type.startsWith('text/') && !isSheet(item.file);
    return item.file.type === a;
  });
}

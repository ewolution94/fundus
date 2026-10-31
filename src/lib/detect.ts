/**
 * Detection: whatever is dropped, pasted or picked on the home, the tools that take it come first,
 * each with its reason ("It's a HEIC: make it a JPG"). The reasons come from the thing itself: its
 * kind, its size, its pixels, whether it knows where it was taken.
 */

import { TOOLS, type Tool } from './catalog.ts';
import { kindOf, dimensions, formatBytes, type Kind } from './files.ts';
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
  if (/json/.test(file.type) || /\.json$/i.test(file.name)) return [s('json', 'Format and check it', 'Formatieren und prüfen'), s('hash', 'Its checksum', 'Die Prüfsumme')];
  if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) return forText(await file.text());
  return [s('hash', 'Its checksum, to compare with the download page', 'Die Prüfsumme, zum Vergleich mit der Download-Seite'), s('base64', 'As Base64', 'Als Base64')];
}

function forText(text: string): Suggestion[] {
  const kinds = shapes(text);
  const out: Suggestion[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  for (const k of kinds) {
    if (k === 'link') out.push(s('qr', 'A link: make it a QR code', 'Ein Link: mach einen QR-Code daraus'), s('url', 'Read or encode the link', 'Den Link lesen oder kodieren'));
    if (k === 'timestamp') out.push(s('stamp', 'A Unix time: see the date', 'Eine Unix-Zeit: das Datum dazu'));
    if (k === 'date') out.push(s('dates', 'A date: days until, the week', 'Ein Datum: Tage bis dahin, die Woche'), s('stamp', 'As a timestamp', 'Als Zeitstempel'));
    if (k === 'json') out.push(s('json', 'JSON: format and check it', 'JSON: formatieren und prüfen'));
    if (k === 'number') out.push(s('percent', 'A number: VAT, percent', 'Eine Zahl: MwSt., Prozent'), s('units', 'In other units', 'In anderen Einheiten'), s('bill', 'Split it', 'Aufteilen'));
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
    if (a.startsWith('.')) return item.file.name.toLowerCase().endsWith(a);
    if (a === 'text') return item.file.type.startsWith('text/');
    return item.file.type === a;
  });
}

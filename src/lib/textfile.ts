// A dropped or picked file as text, for the text tools (Count words, Clean up text, Compare texts).
// Plain TypeScript with erasable types, tested in node.
//
// A .txt from anywhere: UTF-8 (with or without its mark), UTF-16 with its mark, and the old Windows
// encoding (windows-1252) when the bytes aren't UTF-8. Photos, PDFs and other binary files are
// turned away rather than shown as garbage.

import { sniff } from './files.ts';

/** More than this, and a text area and the counting turn slow on a phone. */
export const MAX_TEXT_BYTES = 5_000_000;

export type TextRead = { text: string } | { error: 'binary' | 'big' };

export function decodeText(bytes: Uint8Array): TextRead {
  if (bytes.length > MAX_TEXT_BYTES) return { error: 'big' };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes) };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes) };
  if (sniff(bytes.subarray(0, 64)) !== 'other') return { error: 'binary' };
  const head = bytes.subarray(0, 8192);
  if (head.includes(0)) return { error: 'binary' };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  // Control characters other than tabs and line breaks: a binary file without a NUL up front.
  const sample = text.slice(0, 8192);
  const controls = sample.match(/[\u0001-\u0008\u000e-\u001f\u007f]/g)?.length ?? 0;
  if (sample.length && controls / sample.length > 0.02) return { error: 'binary' };
  return { text };
}

export async function readText(file: Blob): Promise<TextRead> {
  if (file.size > MAX_TEXT_BYTES) return { error: 'big' };
  return decodeText(new Uint8Array(await file.arrayBuffer()));
}

/** Line breaks as \n, whatever made the text (Windows' \r\n, old Macs' \r). */
export const unixLines = (text: string) => text.replace(/\r\n?/g, '\n');

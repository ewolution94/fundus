// Regex: JavaScript's own engine, its flags, every match with its groups (named ones by name) and a
// replace done the way String.prototype.replace does it, with the replaced stretches known so they
// can be marked. It runs in regex.worker.ts, which the page stops after a second. Plain TypeScript
// with erasable types, tested as it is.

export const FLAGS = ['g', 'i', 'm', 's', 'u', 'v', 'y', 'd'] as const;
export type Flag = (typeof FLAGS)[number];

/** Flags each once, only known ones, in the order the engine writes them (RegExp.prototype.flags). */
export const tidyFlags = (flags: string) => [...'dgimsuvy'].filter((f) => flags.includes(f)).join('');

/** "/abc/gi" as pasted: the pattern and its flags; null for anything else. */
export function splitLiteral(text: string): { pattern: string; flags: string } | null {
  const m = /^\/([\s\S]+)\/([a-z]*)$/.exec(text.trim());
  if (!m || /[^dgimsuvy]/.test(m[2]) || new Set(m[2]).size !== m[2].length) return null;
  return { pattern: m[1], flags: m[2] };
}

/** The engine's message without its "Invalid regular expression: /…/: " lead, capitalised. */
export function readable(message: string): string {
  const s = message
    .replace(/^SyntaxError:\s*/, '')
    .replace(/^Invalid regular expression:\s*(\/[\s\S]*\/[a-z]*:\s*)?/, '')
    .replace(/^Invalid regular expression flags/, 'Invalid flags')
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1) : message;
}

/** The pattern compiled, or the engine's message, readable. */
export function compile(pattern: string, flags: string): { ok: true; re: RegExp } | { ok: false; error: string } {
  try {
    return { ok: true, re: new RegExp(pattern, flags) };
  } catch (e) {
    return { ok: false, error: readable(e instanceof Error ? e.message : String(e)) };
  }
}

/**
 * Each capturing group's name in order (null for a numbered one), read from the pattern: "(" that
 * isn't escaped, isn't in a class, and isn't "(?:", "(?=", "(?!", "(?<=", "(?<!" or a modifier.
 * Classes nest only with the v flag.
 */
export function groupNames(pattern: string, sets = false): (string | null)[] {
  const names: (string | null)[] = [];
  let depth = 0;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (depth) {
      if (c === ']') depth--;
      else if (c === '[' && sets) depth++;
      continue;
    }
    if (c === '[') depth = 1;
    else if (c === '(') {
      if (pattern[i + 1] !== '?') names.push(null);
      else if (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') {
        const close = pattern.indexOf('>', i + 3);
        names.push(close > -1 ? pattern.slice(i + 3, close) : null);
      }
    }
  }
  return names;
}

/**
 * What `$1`, `$<name>`, `$&`, `` $` ``, `$'` and `$$` in a replacement stand for, by the spec's
 * GetSubstitution (what String.prototype.replace does).
 */
export function substitute(template: string, matched: string, position: number, str: string, captures: (string | undefined)[], named: Record<string, string | undefined> | undefined): string {
  let out = '';
  const m = captures.length;
  for (let i = 0; i < template.length; i++) {
    const c = template[i];
    const n = template[i + 1];
    if (c !== '$' || n === undefined) {
      out += c;
      continue;
    }
    if (n === '$') {
      out += '$';
      i++;
    } else if (n === '&') {
      out += matched;
      i++;
    } else if (n === '`') {
      out += str.slice(0, position);
      i++;
    } else if (n === "'") {
      out += str.slice(Math.min(position + matched.length, str.length));
      i++;
    } else if (n >= '0' && n <= '9') {
      const one = n.charCodeAt(0) - 48;
      const n2 = template[i + 2];
      if (n2 !== undefined && n2 >= '0' && n2 <= '9') {
        const two = one * 10 + (n2.charCodeAt(0) - 48);
        if (two >= 1 && two <= m) {
          out += captures[two - 1] ?? '';
          i += 2;
          continue;
        }
      }
      if (one >= 1 && one <= m) {
        out += captures[one - 1] ?? '';
        i++;
      } else out += '$';
    } else if (n === '<') {
      const close = named === undefined ? -1 : template.indexOf('>', i + 2);
      if (close === -1) out += '$';
      else {
        out += named![template.slice(i + 2, close)] ?? '';
        i = close;
      }
    } else out += '$';
  }
  return out;
}

export interface Group {
  value: string | null;
  /** With the d flag. */
  start?: number;
  end?: number;
}

export interface Found {
  index: number;
  end: number;
  groups: Group[];
}

export type Run =
  | {
      ok: true;
      /** Every match, however many. */
      count: number;
      /** The first `limit`, in detail. */
      matches: Found[];
      names: (string | null)[];
      /** The text with the replacement done, and where the first `limit` replacements stand in it. */
      replaced: { text: string; marks: [number, number][] } | null;
      /** A search came back empty only after a long while: Safari's engine stops at a backtracking
       *  limit (about 400 ms) and answers "no match" even where there is one. */
      gaveUp: boolean;
    }
  | { ok: false; error: string };

export const LIMIT = 1000;

/** An empty answer slower than this may be an engine giving up, not a real "no match". */
export const GAVE_UP_MS = 200;

/** The next index after an empty match: past a whole surrogate pair in u or v mode. */
function step(text: string, i: number, unicode: boolean): number {
  if (unicode && i + 1 < text.length) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) return i + 2;
  }
  return i + 1;
}

/**
 * Every match the engine finds (only the first without g, as exec and replace do), and the text
 * replaced when `replacement` isn't null.
 */
export function run(pattern: string, flags: string, text: string, replacement: string | null, limit = LIMIT, gaveUpMs = GAVE_UP_MS): Run {
  const compiled = compile(pattern, flags);
  if (!compiled.ok) return compiled;
  const { re } = compiled;
  const global = re.global;
  const sets = re.flags.includes('v');
  const unicode = re.unicode || sets;
  const names = groupNames(pattern, sets);
  const matches: Found[] = [];
  const marks: [number, number][] = [];
  let out = '';
  let last = 0;
  let count = 0;
  let gaveUp = false;
  re.lastIndex = 0;
  for (;;) {
    const started = performance.now();
    const m = re.exec(text);
    if (!m) {
      gaveUp = performance.now() - started >= gaveUpMs;
      break;
    }
    count++;
    const end = m.index + m[0].length;
    if (matches.length < limit) {
      const indices = (m as RegExpExecArray & { indices?: [number, number][] }).indices;
      matches.push({
        index: m.index,
        end,
        groups: m.slice(1).map((v, k) => {
          const g: Group = { value: v ?? null };
          const at = indices?.[k + 1];
          if (at) {
            g.start = at[0];
            g.end = at[1];
          }
          return g;
        }),
      });
    }
    if (replacement !== null) {
      const piece = substitute(replacement, m[0], m.index, text, m.slice(1), m.groups);
      out += text.slice(last, m.index);
      if (marks.length < limit) marks.push([out.length, out.length + piece.length]);
      out += piece;
      last = end;
    }
    if (!global) break;
    if (m[0] === '') re.lastIndex = step(text, re.lastIndex, unicode);
  }
  return {
    ok: true,
    count,
    matches,
    names: names.length === (matches[0]?.groups.length ?? names.length) ? names : (matches[0]?.groups ?? []).map(() => null),
    replaced: replacement === null ? null : { text: out + text.slice(last), marks },
    gaveUp,
  };
}

/** The text cut into stretches: plain (`n` −1) and matched (`n` its number from 0), for marking. */
export function stretches(text: string, ranges: { index: number; end: number }[]): { text: string; n: number }[] {
  const out: { text: string; n: number }[] = [];
  let at = 0;
  ranges.forEach((r, n) => {
    if (r.index > at) out.push({ text: text.slice(at, r.index), n: -1 });
    out.push({ text: text.slice(r.index, r.end), n });
    at = Math.max(at, r.end);
  });
  if (at < text.length) out.push({ text: text.slice(at), n: -1 });
  return out;
}

/** Whether this engine knows the v flag (Safari 17, Chrome 112). */
export function hasSets(): boolean {
  try {
    new RegExp('', 'v');
    return true;
  } catch {
    return false;
  }
}

// Finding a tool by what people type: its number ("502", "F-502"), its name or a word in it, a
// synonym in either language ("verkleinern", "mwst"), or its description. Plain TypeScript with
// erasable types, so the tests run it as it is.

export interface Searchable {
  id: string;
  no: number;
  name: { en: string; de: string };
  desc: { en: string; de: string };
  words: string[];
}

export interface Hit<T> {
  tool: T;
  /** Why it matched, for the hit's second line: a synonym it matched on, or null. */
  via: string | null;
  score: number;
}

/** Lower case without accents, so "groesse", "größe" and "Grösse" meet. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The tools matching a query, best first. */
export function findTools<T extends Searchable>(query: string, tools: T[]): Hit<T>[] {
  const q = fold(query);
  if (!q) return [];
  const digits = q.replace(/^f\s*-?\s*/, '');
  const hits: Hit<T>[] = [];
  for (const tool of tools) {
    let score = 0;
    let via: string | null = null;
    const no = String(tool.no);
    if (/^\d+$/.test(digits)) {
      if (no === digits) score = 100;
      else if (no.startsWith(digits)) score = 80;
    }
    const names = [tool.name.en, tool.name.de].map(fold);
    for (const name of names) {
      if (name === q) score = Math.max(score, 95);
      else if (name.startsWith(q)) score = Math.max(score, 90);
      else if (name.split(' ').some((w) => w.startsWith(q))) score = Math.max(score, 75);
      else if (name.includes(q)) score = Math.max(score, 60);
    }
    for (const word of tool.words) {
      const w = fold(word);
      if (w === q || (q.length >= 3 && w.startsWith(q))) {
        if (score < 70) via = word;
        score = Math.max(score, w === q ? 72 : 68);
      } else if (q.length >= 4 && w.includes(q)) {
        if (score < 50) via = word;
        score = Math.max(score, 50);
      }
    }
    if (score < 40 && q.length >= 3 && [tool.desc.en, tool.desc.de].some((d) => fold(d).includes(q))) score = 40;
    if (score > 0) hits.push({ tool, via, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.tool.no - b.tool.no);
}

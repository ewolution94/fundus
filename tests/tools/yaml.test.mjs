import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, detect, directionOf, countComments, writeJson, excerpt, position } from '../../src/tools/yaml/yaml.ts';

// The same as tests/fixtures/out/config.yaml (unit tests never read the generated samples).
const CONFIG = `# Fundus sample
name: fundus
port: 4330
tools:
  - shrink
  - percent
owner:
  name: Anna Müller
  since: 2026-10-31
---
second: document
`;

const CONFIG_JSON = [
  { name: 'fundus', port: 4330, tools: ['shrink', 'percent'], owner: { name: 'Anna Müller', since: '2026-10-31' } },
  { second: 'document' },
];

const ok = (text, direction = detect(text)) => {
  const r = convert(text, direction);
  assert.ok(r.ok, JSON.stringify(r));
  return r;
};

const fail = (text, direction = detect(text)) => {
  const r = convert(text, direction);
  assert.ok(!r.ok, `should fail: ${text}`);
  return r.error;
};

test('config.yaml to JSON: two documents become a list, the comment is counted', () => {
  const r = ok(CONFIG);
  assert.equal(r.documents, 2);
  assert.equal(r.comments, 1);
  assert.equal(r.nonFinite, 0);
  assert.equal(r.out, JSON.stringify(CONFIG_JSON, null, 2));
});

test('and back: JSON to YAML in block style, indent 2, a date-like string quoted', () => {
  const json = ok(CONFIG).out;
  assert.equal(detect(json), 'toYaml');
  const r = ok(json);
  assert.equal(
    r.out,
    ['- name: fundus', '  port: 4330', '  tools:', '    - shrink', '    - percent', '  owner:', '    name: Anna Müller', '    since: "2026-10-31"', '- second: document'].join('\n'),
  );
  // Round trip: the YAML reads back to the same JSON.
  assert.equal(ok(r.out, 'toJson').out, json);
});

test('key order is kept both ways, number-like keys too', () => {
  assert.equal(ok('{"b": 1, "2": "two", "a": 3}').out, 'b: 1\n"2": two\na: 3');
  assert.equal(ok('b: 1\n2: two\na: 3').out, '{\n  "b": 1,\n  "2": "two",\n  "a": 3\n}');
});

test('big whole numbers keep every digit; decimals keep their form in YAML', () => {
  assert.equal(ok('n: 12345678901234567890').out, '{\n  "n": 12345678901234567890\n}');
  assert.equal(ok('{"big": 12345678901234567890, "f": 1.50}').out, 'big: 12345678901234567890\nf: 1.50');
});

test('strings YAML 1.1 readers would misread are quoted', () => {
  const out = ok('{"country": "no", "on": "on", "t": "true", "n": "null", "d": "2026-10-31", "num": "042", "plain": "hello world"}').out;
  assert.match(out, /^country: "no"$/m);
  assert.match(out, /^"on": "on"$/m);
  assert.match(out, /^t: "true"$/m);
  assert.match(out, /^"n": "null"$/m, 'n alone is a YAML 1.1 boolean, as a key too');
  assert.match(out, /^d: "2026-10-31"$/m);
  assert.match(out, /^num: "042"$/m);
  assert.match(out, /^plain: hello world$/m);
});

test('empty maps and lists, nested lists, line breaks', () => {
  assert.equal(ok('{"e": {}, "l": [], "x": [[1, 2], {"a": []}]}').out, 'e: {}\nl: []\nx:\n  - - 1\n    - 2\n  - a: []');
  const multi = ok('{"s": "one\\ntwo"}').out;
  assert.equal(multi, 's: |-\n  one\n  two');
  assert.equal(ok(multi, 'toJson').out, '{\n  "s": "one\\ntwo"\n}');
});

test('.inf and .nan become null and are counted; merge keys and anchors resolve', () => {
  const r = ok('a: .inf\nb: -.inf\nc: .nan\nd: 1');
  assert.equal(r.nonFinite, 3);
  assert.equal(r.out, '{\n  "a": null,\n  "b": null,\n  "c": null,\n  "d": 1\n}');
  assert.equal(ok('base: &b\n  x: 1\n  y: 2\nc:\n  <<: *b\n  y: 3').out, JSON.stringify({ base: { x: 1, y: 2 }, c: { x: 1, y: 3 } }, null, 2));
});

test('comments are counted by the lexer: not a # in a string or a block', () => {
  assert.equal(countComments('a: 1 # one\n# two\nb: "#no"\nc: |\n  # no\n'), 2);
  assert.equal(countComments('a: 1'), 0);
  assert.equal(ok('# only a comment').out, 'null');
});

test('a mistake: its code, line and column', () => {
  const tab = fail('a:\n\tb: 1');
  assert.deepEqual([tab.code, tab.line, tab.column], ['TAB_AS_INDENT', 2, 1]);
  const cause = fail('name: fundus\nowner:\n\tname: Anna');
  assert.deepEqual([cause.code, cause.line], ['TAB_AS_INDENT', 3], 'the cause, not the repeated key it leads to');
  const dup = fail('name: a\nport: 1\nname: b');
  assert.deepEqual([dup.code, dup.line, dup.column, dup.found], ['DUPLICATE_KEY', 3, 1, 'name']);
  const quote = fail('a: "abc');
  assert.deepEqual([quote.code, quote.line, quote.column, quote.found], ['MISSING_CHAR', 1, 8, '"']);
  const brace = fail('{"a": 1');
  assert.deepEqual([brace.code, brace.found], ['MISSING_CHAR', '}']);
  const extra = fail('[1, 2]]');
  assert.deepEqual([extra.code, extra.column, extra.found], ['UNEXPECTED_TOKEN', 7, ']']);
  const indent = fail('a: 1\n b: 2');
  assert.equal(indent.line, 1);
  const alias = fail('a: 1\nb: *nope');
  assert.deepEqual([alias.code, alias.line, alias.column, alias.found], ['BAD_ALIAS', 2, 4, '*nope']);
  const at = fail('a: @x');
  assert.deepEqual([at.code, at.found], ['BAD_SCALAR_START', '@']);
});

test('the second document’s mistake has its own line', () => {
  const e = fail('a: 1\n---\nb: 1\nb: 2');
  assert.deepEqual([e.code, e.line, e.column], ['DUPLICATE_KEY', 4, 1]);
});

test('aliases that would explode are stopped', () => {
  const lol = ['a: &a ["x","x"]', 'b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]', 'c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]', 'd: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]', 'e: [*d,*d,*d,*d,*d,*d,*d,*d,*d]'].join('\n');
  assert.equal(fail(lol, 'toJson').code, 'ALIASES');
});

test('the direction from the text and from a file’s name', () => {
  assert.equal(detect('{"a": 1}'), 'toYaml');
  assert.equal(detect('\n  [1, 2]'), 'toYaml');
  assert.equal(detect('\uFEFF{"a": 1}'), 'toYaml');
  assert.equal(detect('a: 1'), 'toJson');
  assert.equal(detect('- a'), 'toJson');
  assert.equal(directionOf('config.yaml'), 'toJson');
  assert.equal(directionOf('docker-compose.YML'), 'toJson');
  assert.equal(directionOf('package.json'), 'toYaml');
  assert.equal(directionOf('notes.txt'), null);
});

test('a byte order mark is dropped', () => {
  assert.equal(ok('\uFEFFa: 1').out, '{\n  "a": 1\n}');
});

test('writeJson: maps in order, keys as strings, binary as Base64', () => {
  const m = new Map([['b', 1], [2, 2n], [null, true]]);
  assert.equal(writeJson(m), '{\n  "b": 1,\n  "2": 2,\n  "": true\n}');
  assert.equal(writeJson([new Uint8Array([104, 105])]), '[\n  "aGk="\n]');
  assert.equal(writeJson({}), '{}');
  assert.equal(writeJson([]), '[]');
  assert.equal(writeJson('a"b'), '"a\\"b"');
});

test('excerpt and position', () => {
  const text = 'a: 1\nb: [1, 2\nc: 3';
  assert.deepEqual(position(text, 5), { line: 2, column: 1 });
  assert.deepEqual(position('ä😀x', 3), { line: 1, column: 3 });
  const x = excerpt(text, 8);
  assert.deepEqual([x.before, x.at, x.after], ['b: ', '[', '1, 2']);
});

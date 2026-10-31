import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format, excerpt, position, utf8Length, INDENTS, MAX_DEPTH } from '../../src/tools/json/json.ts';

const fmt = (text, indent = '2', sort = false) => {
  const p = parse(text);
  assert.ok(p.ok, `should parse: ${text}`);
  return format(p.value, INDENTS[indent], sort);
};
const err = (text) => {
  const p = parse(text);
  assert.ok(!p.ok, `should fail: ${text}`);
  return p.error;
};

const SAMPLE = '{"name":"Fundus","tools":[1,2.5,-3e2,{"deep":[true,false,null]}],"empty":{},"none":[],"s":"a\\"b\\u00e9\\n"}';

test('indents like JSON.stringify: 2, 4, tab; minify drops all white space', () => {
  // Canonical numbers and escapes, so JSON.stringify writes them as they are.
  const plain = '{"name":"Fundus","tools":[1,2.5,-300,{"deep":[true,false,null]}],"empty":{},"none":[],"s":"a\\"b\\n"}';
  const value = JSON.parse(plain);
  assert.equal(fmt(plain, '2'), JSON.stringify(value, null, 2));
  assert.equal(fmt(plain, '4'), JSON.stringify(value, null, 4));
  assert.equal(fmt(plain, 'tab'), JSON.stringify(value, null, '\t'));
  assert.equal(fmt(JSON.stringify(value, null, 2), 'min'), plain);
  assert.equal(fmt(fmt(SAMPLE, '4'), 'min'), SAMPLE);
  assert.equal(fmt('  [ ]  ', '2'), '[]');
  assert.equal(fmt('{ }', '4'), '{}');
  assert.equal(fmt(' "just a string" '), '"just a string"');
  assert.equal(fmt('[[]]', '2'), '[\n  []\n]');
});

test('numbers and strings come out exactly as written', () => {
  // JSON.parse would make this 12345678901234567000 and 1.0 would become 1.
  assert.equal(fmt('{"id": 12345678901234567890, "x": 1.0, "e": 1E+2, "n": -0}', 'min'), '{"id":12345678901234567890,"x":1.0,"e":1E+2,"n":-0}');
  assert.equal(fmt('["\\u00e9", "\\/", "é", "👋"]', 'min'), '["\\u00e9","\\/","é","👋"]');
});

test('a repeated key stays, in its place (JSON.parse would keep only the last)', () => {
  assert.equal(fmt('{"a":1,"b":2,"a":3}', 'min'), '{"a":1,"b":2,"a":3}');
  assert.equal(fmt('{"b":1,"a":2,"b":3}', 'min', true), '{"a":2,"b":1,"b":3}');
});

test('sort keys reaches every level, arrays keep their order', () => {
  const text = '{"z":{"y":1,"b":[{"d":1,"c":2},3,1]},"a":0,"A":1,"é":2,"e":3}';
  assert.equal(fmt(text, 'min', true), '{"A":1,"a":0,"e":3,"z":{"b":[{"c":2,"d":1},3,1],"y":1},"é":2}');
  // By the decoded key: "a" is "a".
  assert.equal(fmt('{"b":1,"\\u0061":2}', 'min', true), '{"\\u0061":2,"b":1}');
});

test('accepts exactly what JSON.parse accepts, on valid text and on a thousand broken ones', () => {
  const valid = [
    SAMPLE,
    '0',
    '-0.5e-3',
    'true',
    'null',
    '""',
    '"\\ud83d\\udc4b"',
    '[1,[2,[3,{"a":[]}]]]',
    ' \t\n\r{"a" : 1 }\n',
    '{"":""}',
    '1E5',
    '[-1, 0.0, 10e+10]',
  ];
  for (const v of valid) assert.ok(parse(v).ok, v);

  // Deterministic mutations of valid text: delete, insert or replace one character.
  let seed = 42;
  const rand = (n) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  const alphabet = '{}[]",:.-+0123456789eEtrufalsn \n\t\'/\\abcxu';
  let checked = 0;
  for (let k = 0; k < 2000; k++) {
    const base = valid[rand(valid.length)];
    const at = rand(base.length + 1);
    const c = alphabet[rand(alphabet.length)];
    const op = rand(3);
    const text = op === 0 ? base.slice(0, at) + base.slice(at + 1) : op === 1 ? base.slice(0, at) + c + base.slice(at) : base.slice(0, at) + c + base.slice(at + 1);
    let expected = true;
    try {
      JSON.parse(text);
    } catch {
      expected = false;
    }
    const got = parse(text);
    assert.equal(got.ok, expected, `${JSON.stringify(text)}: ours ${got.ok ? 'ok' : got.error.code}, JSON.parse ${expected}`);
    if (got.ok) assert.deepEqual(JSON.parse(format(got.value, '  ', false)), JSON.parse(text));
    checked++;
  }
  assert.equal(checked, 2000);
});

test('a trailing comma: where, and called by its name', () => {
  const e = err('{\n  "a": 1,\n  "b": 2,\n}');
  assert.equal(e.code, 'trailingComma');
  assert.deepEqual([e.line, e.column, e.found], [4, 1, '}']);
  assert.equal(err('[1, 2,]').code, 'trailingComma');
  assert.equal(err('[1, 2,]').column, 7);
});

test('the usual mistakes, each with its line and column', () => {
  const cases = [
    ["{'a': 1}", 'singleQuote', 1, 2, "'"],
    ['{a: 1}', 'keyQuote', 1, 2, 'a'],
    ['{\n  "a": 1 // one\n}', 'comment', 2, 10, '//'],
    ['/* c */ {}', 'comment', 1, 1, '/*'],
    ['{"a": 01}', 'number', 1, 7, '01'],
    ['[1.]', 'number', 1, 2, '1.'],
    ['[.5]', 'number', 1, 2, '.5'],
    ['[+1]', 'number', 1, 2, '+1'],
    ['[-]', 'number', 1, 2, '-'],
    ['{"a": undefined}', 'literal', 1, 7, 'undefined'],
    ['[NaN]', 'literal', 1, 2, 'NaN'],
    ['{"ok": True}', 'literal', 1, 8, 'True'],
    ['["a\\x"]', 'escape', 1, 4, '\\x'],
    ['["\\u12g4"]', 'escape', 1, 3, '\\u12g4'],
    ['["a\nb"]', 'lineBreak', 1, 4, '\n'],
    ['["a\tb"]', 'tab', 1, 4, '\t'],
    ['{"a" 1}', 'colon', 1, 6, '1'],
    ['{"a": 1 "b": 2}', 'commaObject', 1, 9, '"'],
    ['[1 2]', 'commaArray', 1, 4, '2'],
    ['{"a": 1}}', 'extra', 1, 9, '}'],
    ['{} {}', 'extra', 1, 4, '{'],
    ['["a", 😀]', 'unexpected', 1, 7, '😀'],
    ['["😀", x]', 'literal', 1, 7, 'x'],
  ];
  for (const [text, code, line, column, found] of cases) {
    const e = err(text);
    assert.deepEqual([e.code, e.line, e.column, e.found], [code, line, column, found], text);
  }
});

test('ending too early names the bracket left open and its line', () => {
  const e = err('{\n  "list": [\n    1,\n    2\n');
  assert.equal(e.code, 'end');
  assert.deepEqual(e.open, { bracket: '[', line: 2 });
  assert.deepEqual([e.line, e.column], [5, 1]);
  const s = err('{"a": "never closed');
  assert.equal(s.code, 'unclosedString');
  assert.equal(s.column, 7);
  assert.equal(err('').code, 'end');
  assert.equal(err('{"a":').code, 'end');
});

test('nesting deeper than the limit is an error, not a crash', () => {
  assert.ok(parse('['.repeat(MAX_DEPTH) + ']'.repeat(MAX_DEPTH)).ok);
  assert.equal(err('['.repeat(MAX_DEPTH + 5) + ']'.repeat(MAX_DEPTH + 5)).code, 'deep');
});

test('the excerpt: the line around the mistake, cut on a long line', () => {
  const text = '{\n  "a": 1,\n  "b": 2,\n}';
  const e = err(text);
  assert.deepEqual(excerpt(text, e.offset), { before: '', at: '}', after: '', cutStart: false, cutEnd: false });
  const long = `[${'1,'.repeat(200)}x${',2'.repeat(200)}]`;
  const x = excerpt(long, long.indexOf('x'), 10);
  assert.deepEqual([x.before, x.at, x.after, x.cutStart, x.cutEnd], ['1,1,1,1,1,', 'x', ',2,2,2,2,2', true, true]);
  // The end of the text: nothing to mark.
  assert.equal(excerpt('{"a":', 5).at, '');
  assert.equal(excerpt('[\r\n1 2]\r\n', 5).at, '2');
});

test('position counts characters, not UTF-16 units', () => {
  assert.deepEqual(position('"👋👋" x', 7), { line: 1, column: 6 });
  assert.deepEqual(position('a\nb\nc', 4), { line: 3, column: 1 });
});

test('UTF-8 length without encoding', () => {
  for (const s of ['', 'abc', 'é', '€', '👋', 'aࠀb', '\ud800x', SAMPLE]) assert.equal(utf8Length(s), Buffer.byteLength(s, 'utf8'), JSON.stringify(s));
});

test('a long word in a mistake is cut short for the message', () => {
  const e = err(`[${'9'.repeat(400)}x]`);
  assert.equal(e.code, 'number');
  assert.equal(e.found, `${'9'.repeat(20)}…`);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { length, viewBox, rootTag, svgSize, sized, isSvgText, holdsHtml, needsFonts, scaleTo, MAX_AREA, DEFAULT_SIZE } from '../src/lib/svg.ts';

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label ?? ''} ${actual} ≠ ${expected}`);

test('lengths in CSS pixels, from the absolute units', () => {
  assert.equal(length('64'), 64);
  assert.equal(length(' 12.5px '), 12.5);
  assert.equal(length('1in'), 96);
  close(length('72pt'), 96);
  close(length('25.4mm'), 96);
  close(length('2.54cm'), 96);
  assert.equal(length('1pc'), 16);
  assert.equal(length('1e2'), 100);
  assert.equal(length('.5'), 0.5);
});

test('relative units, zero and junk have no length', () => {
  for (const v of ['100%', '2em', '3ex', '0', '-4', 'auto', '', 'px', '12 px x', undefined, null]) assert.equal(length(v), null, String(v));
});

test('a viewBox is four numbers, by spaces or commas', () => {
  assert.deepEqual(viewBox('0 0 64 32'), { width: 64, height: 32 });
  assert.deepEqual(viewBox('-10,-10, 20 ,10'), { width: 20, height: 10 });
  assert.equal(viewBox('0 0 64'), null);
  assert.equal(viewBox('0 0 0 10'), null);
  assert.equal(viewBox('a b c d'), null);
});

test('the root is found after the XML declaration, comments and a doctype', () => {
  const text = '﻿<?xml version="1.0"?>\n<!-- made by hand -->\n<!DOCTYPE svg [ <!ENTITY a "b>"> ]>\n<svg width="10" height="20"><rect/></svg>';
  const root = rootTag(text);
  assert.ok(root);
  assert.equal(text.slice(root.start, root.end), '<svg width="10" height="20">');
  assert.deepEqual(root.attrs.map((a) => [a.name, a.value]), [['width', '10'], ['height', '20']]);
});

test('attributes in single quotes, with ">" inside, and a prefixed root', () => {
  const root = rootTag(`<svg:svg xmlns:svg="http://www.w3.org/2000/svg" data-x='a>b' viewBox = "0 0 4 4"/>`);
  assert.equal(root.prefix, 'svg:');
  assert.equal(root.selfClosing, true);
  assert.equal(root.attrs.find((a) => a.name === 'data-x').value, 'a>b');
  assert.equal(root.attrs.find((a) => a.name === 'viewBox').value, '0 0 4 4');
});

test('not an SVG: HTML, a PNG read as text, an empty file', () => {
  assert.equal(isSvgText('<html><svg></svg></html>'), false);
  assert.equal(isSvgText('\x89PNG\r\n'), false);
  assert.equal(isSvgText(''), false);
  assert.equal(isSvgText('<svgx></svgx>'), false);
  assert.equal(isSvgText('<svg'), false);
  assert.equal(isSvgText('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), true);
});

test('the size: width and height first, then the viewBox, then 300 × 150', () => {
  assert.deepEqual(svgSize('<svg width="300" height="100" viewBox="0 0 30 10"/>'), { width: 300, height: 100 });
  assert.deepEqual(svgSize('<svg viewBox="0 0 64 64"/>'), { width: 64, height: 64 });
  // One side given: the other follows the viewBox's shape.
  assert.deepEqual(svgSize('<svg width="200" viewBox="0 0 100 50"/>'), { width: 200, height: 100 });
  assert.deepEqual(svgSize('<svg height="10mm" viewBox="0 0 2 1"/>').width.toFixed(3), ((96 / 25.4) * 20).toFixed(3));
  // Percentages are no size: the viewBox speaks.
  assert.deepEqual(svgSize('<svg width="100%" height="100%" viewBox="0 0 24 24"/>'), { width: 24, height: 24 });
  assert.deepEqual(svgSize('<svg/>'), DEFAULT_SIZE);
  assert.deepEqual(svgSize('<svg width="50"/>'), { width: 50, height: 150 });
  assert.deepEqual(svgSize('not svg'), DEFAULT_SIZE);
});

test('sized: the pixels on the root, everything else kept', () => {
  const out = sized('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100" fill="red"><rect/></svg>', 600, 200);
  const root = rootTag(out);
  const get = (n) => root.attrs.find((a) => a.name === n)?.value;
  assert.equal(get('width'), '600');
  assert.equal(get('height'), '200');
  assert.equal(get('viewBox'), '0 0 300 100');
  assert.equal(get('fill'), 'red');
  assert.equal(root.attrs.filter((a) => a.name === 'width').length, 1);
  assert.ok(out.endsWith('><rect/></svg>'));
});

test('sized: a viewBox from its own size when it had none, so it scales instead of being cut', () => {
  const out = sized('<svg xmlns="http://www.w3.org/2000/svg" width="1in" height="48"><circle r="4"/></svg>', 192, 96);
  const root = rootTag(out);
  assert.equal(root.attrs.find((a) => a.name === 'viewBox').value, '0 0 96 48');
  assert.equal(root.attrs.find((a) => a.name === 'width').value, '192');
  // Nothing said about its size: what browsers assume.
  assert.match(sized('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 30, 15), /viewBox="0 0 300 150"/);
});

test('sized: a viewBox-only SVG gets its pixels, rounded, and never under 1', () => {
  const out = sized('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"/>', 255.6, 0.2);
  assert.match(out, /width="256"/);
  assert.match(out, /height="1"/);
  assert.match(out, /\/>$/);
});

test('sized: no size in the root’s style, the rest of it kept', () => {
  const out = sized(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" style='width: 10px; fill:red;height:4px;max-width:9px'/>`, 8, 8);
  const style = rootTag(out).attrs.find((a) => a.name === 'style').value;
  assert.doesNotMatch(style, /(^|;)\s*(width|height)\s*:/);
  assert.match(style, /fill:red/);
  assert.match(style, /max-width:9px/);
  // A style that only sized it goes.
  assert.doesNotMatch(sized('<svg xmlns="http://www.w3.org/2000/svg" style="width:5px;height:5px"/>', 5, 5), /style=/);
});

test('sized: the namespaces an SVG copied from a page lacks', () => {
  const out = sized('<svg viewBox="0 0 8 8"><use xlink:href="#a"/></svg>', 16, 16);
  assert.match(out, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(out, /xmlns:xlink="http:\/\/www.w3.org\/1999\/xlink"/);
  // Declared ones stay single.
  const twice = sized('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 8 8"><use xlink:href="#a"/></svg>', 16, 16);
  assert.equal(twice.match(/xmlns=/g).length, 1);
  assert.equal(twice.match(/xmlns:xlink=/g).length, 1);
});

test('sized leaves what isn’t an SVG alone', () => {
  assert.equal(sized('hello', 10, 10), 'hello');
});

test('HTML inside, and text without a font of its own', () => {
  assert.equal(holdsHtml('<svg><foreignObject width="1" height="1"><div/></foreignObject></svg>'), true);
  assert.equal(holdsHtml('<svg:svg><svg:foreignObject/></svg:svg>'), true);
  assert.equal(holdsHtml('<svg><rect/></svg>'), false);
  assert.equal(needsFonts('<svg><text x="1">Hi</text></svg>'), true);
  assert.equal(needsFonts('<svg><style>@font-face{font-family:A;src:url(data:font/woff2;base64,AA)}</style><text>Hi</text></svg>'), false);
  // <textPath> lives in a <text>; a <title> is no text drawn.
  assert.equal(needsFonts('<svg><title>Logo</title><rect/></svg>'), false);
});

test('scaleTo: times its size, or a width with the height following', () => {
  assert.deepEqual(scaleTo({ width: 64, height: 64 }, { scale: 4 }), { width: 256, height: 256, capped: false });
  assert.deepEqual(scaleTo({ width: 300, height: 100 }, { scale: 2 }), { width: 600, height: 200, capped: false });
  assert.deepEqual(scaleTo({ width: 64, height: 64 }, { width: 1000 }), { width: 1000, height: 1000, capped: false });
  assert.deepEqual(scaleTo({ width: 300, height: 150 }, { width: 101 }), { width: 101, height: 51, capped: false });
  assert.deepEqual(scaleTo({ width: 0.2, height: 0.1 }, { scale: 1 }), { width: 1, height: 1, capped: false });
});

test('scaleTo: kept within what every canvas holds', () => {
  const big = scaleTo({ width: 2000, height: 1000 }, { scale: 4 });
  assert.equal(big.capped, true);
  assert.ok(big.width * big.height <= MAX_AREA, `${big.width} × ${big.height}`);
  assert.ok(Math.abs(big.width / big.height - 2) < 0.01);
  const long = scaleTo({ width: 100, height: 1 }, { width: 40000 });
  assert.equal(long.capped, true);
  assert.equal(long.width, 16384);
});

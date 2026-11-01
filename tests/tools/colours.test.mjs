import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColour,
  toHex,
  toRgb,
  toHsl,
  toOklch,
  oklchOf,
  nameOf,
  NAMED,
  contrast,
  grades,
  ratioText,
  bestAgainst,
  averageAt,
  pickRadius,
  hslToRgb,
  rgbToHsl,
  linearToOklab,
  oklabToLinear,
  toLinear,
  fromLinear,
} from '../../src/tools/colours/colours.ts';

const hex = (s) => {
  const c = parseColour(s);
  assert.ok(c, `reads ${s}`);
  return toHex(c);
};

test('hex in every length, with or without #, any case', () => {
  assert.equal(hex('#ffe14a'), '#ffe14a');
  assert.equal(hex('#FFE14A'), '#ffe14a');
  assert.equal(hex('ffe14a'), '#ffe14a');
  assert.equal(hex('#fe4'), '#ffee44');
  assert.equal(hex('#fe48'), '#ffee4488');
  assert.equal(hex('#ffe14a80'), '#ffe14a80');
  assert.equal(hex('  #777;  '), '#777777');
  assert.equal(parseColour('#12345'), null);
  assert.equal(parseColour('#ggg'), null);
  // Three bare digits are a number, not a colour; with a letter they're hex.
  assert.equal(parseColour('123'), null);
  assert.equal(hex('abc'), '#aabbcc');
});

test('rgb() and rgba(), commas or spaces, numbers or percentages, alpha', () => {
  assert.equal(hex('rgb(255, 225, 74)'), '#ffe14a');
  assert.equal(hex('rgb(255 225 74)'), '#ffe14a');
  assert.equal(hex('rgb(100% 0% 50%)'), '#ff0080');
  assert.equal(hex('rgba(255, 0, 0, 0.5)'), '#ff000080');
  assert.equal(hex('rgb(255 0 0 / 25%)'), '#ff000040');
  assert.equal(hex('RGB(18,52,86)'), '#123456');
  // Past 255, CSS clips each channel, and it says so.
  const over = parseColour('rgb(300, 0, 0)');
  assert.equal(toHex(over), '#ff0000');
  assert.equal(over.clamped, true);
  assert.equal(parseColour('rgb(1, 2)'), null);
  assert.equal(parseColour('rgb(1 2 3 4)'), null);
  assert.equal(parseColour('rgb(1deg 2 3)'), null);
});

test('hsl(), hsla() and hwb(), with every hue unit', () => {
  assert.equal(hex('hsl(0, 100%, 50%)'), '#ff0000');
  assert.equal(hex('hsl(120deg 100% 25%)'), '#008000');
  assert.equal(hex('hsl(0.5turn 100% 50%)'), '#00ffff');
  assert.equal(hex('hsl(3.14159rad 100% 50%)'), '#00ffff');
  assert.equal(hex('hsl(200grad 100% 50%)'), '#00ffff');
  assert.equal(hex('hsla(240, 100%, 50%, 0.5)'), '#0000ff80');
  assert.equal(hex('hsl(270 50% 40%)'), '#663399');
  assert.equal(hex('hwb(0 0% 0%)'), '#ff0000');
  assert.equal(hex('hwb(200 20% 30%)'), '#3388b3');
  assert.equal(hex('hwb(0 60% 60%)'), '#808080');
});

test('oklch(), oklab(), lab() and lch(), checked against what Chromium computes', () => {
  // Chromium: color-mix(in oklch, #ffe14a …) is oklch(0.909262 0.164713 97.6115).
  assert.equal(hex('oklch(0.909262 0.164713 97.6115)'), '#ffe14a');
  assert.equal(hex('oklch(90.9262% 0.164713 97.6115deg)'), '#ffe14a');
  assert.equal(hex('oklch(62.8% 0.2577 29.23)'), '#ff0000');
  assert.equal(hex('oklch(0.440263 0.160296 303.381)'), '#663399');
  // Chromium: oklab(0.5 0.1 -0.1) is color(srgb 0.504972 0.272504 0.602169).
  assert.equal(hex('oklab(0.5 0.1 -0.1)'), '#81459a');
  assert.equal(hex('oklab(50% 25% -25%)'), '#81459a');
  // lab(50% 40 59.5) is color(srgb 0.748338 0.341621 -0.0001), inside sRGB once rounded.
  const lab = parseColour('lab(50% 40 59.5)');
  assert.equal(toHex(lab), '#bf5700');
  assert.equal(lab.clamped, false);
  assert.equal(hex('lch(52.2345% 72.2 56.2)'), '#c65d06');
});

test('the CSS named colours: all 148, and transparent', () => {
  assert.equal(Object.keys(NAMED).length, 148);
  assert.equal(hex('rebeccapurple'), '#663399');
  assert.equal(hex('Gold'), '#ffd700');
  assert.equal(hex('grey'), hex('gray'));
  assert.equal(toRgb(parseColour('transparent')), 'rgba(0, 0, 0, 0)');
  assert.equal(parseColour('notacolour'), null);
  assert.equal(parseColour(''), null);
});

test('a colour outside sRGB is brought in, keeping lightness and hue, and says so', () => {
  const c = parseColour('oklch(0.7 0.4 150)');
  assert.equal(c.clamped, true);
  const [L, C, H] = oklchOf(c);
  assert.ok(Math.abs(L - 0.7) < 0.01, `lightness ${L}`);
  assert.ok(Math.abs(H - 150) < 1.5, `hue ${H}`);
  assert.ok(C < 0.4 && C > 0.15, `chroma ${C}`);
  assert.equal(parseColour('oklch(1.2 0.1 50)').clamped, true);
  assert.equal(toHex(parseColour('oklch(1.2 0.1 50)')), '#ffffff');
  assert.equal(parseColour('#ffe14a').clamped, false);
});

test('written out: HEX, RGB, HSL and OKLCH', () => {
  const c = parseColour('#ffe14a');
  assert.equal(toHex(c), '#ffe14a');
  assert.equal(toRgb(c), 'rgb(255, 225, 74)');
  assert.equal(toHsl(c), 'hsl(50.1, 100%, 64.5%)');
  assert.equal(toOklch(c), 'oklch(90.9% 0.165 97.6)');
  assert.equal(toOklch(parseColour('#ff0000')), 'oklch(62.8% 0.258 29.2)');
  assert.equal(toOklch(parseColour('#777')), 'oklch(56.9% 0 0)');
  assert.equal(toOklch(parseColour('white')), 'oklch(100% 0 0)');
  assert.equal(toOklch(parseColour('black')), 'oklch(0% 0 0)');
  const half = parseColour('rgb(255 0 0 / 0.5)');
  assert.equal(toHex(half), '#ff000080');
  assert.equal(toRgb(half), 'rgba(255, 0, 0, 0.5)');
  assert.equal(toHsl(half), 'hsla(0, 100%, 50%, 0.5)');
  assert.equal(toOklch(half), 'oklch(62.8% 0.258 29.2 / 0.5)');
  // A typed HSL comes back as typed.
  assert.equal(toHsl(parseColour('hsl(120 100% 25%)')), 'hsl(120, 100%, 25%)');
});

test('round trips: sRGB ↔ linear, ↔ OKLab, ↔ HSL', () => {
  for (const v of [0, 0.02, 0.04045, 0.2, 0.5, 0.99, 1]) assert.ok(Math.abs(fromLinear(toLinear(v)) - v) < 1e-6, String(v));
  for (const [r, g, b] of [[1, 0, 0], [0.2, 0.5, 0.8], [1, 1, 1], [0, 0, 0]]) {
    const back = oklabToLinear(linearToOklab([r, g, b]));
    assert.ok(back.every((x, i) => Math.abs(x - [r, g, b][i]) < 1e-6), `${[r, g, b]} → ${back}`);
    const [h, s, l] = rgbToHsl(r, g, b);
    const rgb = hslToRgb(h, s, l);
    assert.ok(rgb.every((x, i) => Math.abs(x - [r, g, b][i]) < 1e-9), `${[r, g, b]} → hsl → ${rgb}`);
  }
  // White in OKLab is L = 1, no chroma.
  const [L, a, b] = linearToOklab([1, 1, 1]);
  assert.ok(Math.abs(L - 1) < 1e-6 && Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6);
});

test('its CSS name, when it has one', () => {
  assert.equal(nameOf(parseColour('#663399')), 'rebeccapurple');
  assert.equal(nameOf(parseColour('#ffd700')), 'gold');
  assert.equal(nameOf(parseColour('#808080')), 'gray');
  assert.equal(nameOf(parseColour('#ffe14a')), null);
});

test('contrast the WCAG 2 way: 21:1, #777 on white 4.48:1, never rounded up to pass', () => {
  const white = parseColour('white');
  const black = parseColour('black');
  assert.equal(contrast(white, black), 21);
  assert.equal(contrast(black, white), 21);
  assert.equal(contrast(white, white), 1);
  const grey = parseColour('#777');
  assert.equal(ratioText(contrast(grey, white)), '4.48');
  assert.equal(ratioText(contrast(grey, black)), '4.69');
  assert.deepEqual(grades(contrast(grey, white)), { aaNormal: false, aaLarge: true, aaaNormal: false, aaaLarge: false });
  assert.equal(ratioText(contrast(parseColour('#767676'), white)), '4.54');
  assert.equal(grades(contrast(parseColour('#767676'), white)).aaNormal, true);
  assert.equal(ratioText(contrast(parseColour('#595959'), white)), '7.00');
  assert.equal(grades(contrast(parseColour('#595959'), white)).aaaNormal, true);
  // 4.499 shows 4.49, not 4.50: the figure never claims a level the ratio misses.
  assert.equal(ratioText(4.4994), '4.49');
  assert.equal(ratioText(6.996), '6.99');
  assert.equal(ratioText(4.62), '4.62');
  assert.equal(ratioText(2.995), '2.99');
});

test('white or black, whichever stands out more', () => {
  assert.equal(toHex(bestAgainst(parseColour('#ffe14a'))), '#000000');
  assert.equal(toHex(bestAgainst(parseColour('#121212'))), '#ffffff');
  assert.equal(toHex(bestAgainst(parseColour('#777'))), '#000000');
  assert.equal(toHex(bestAgainst(parseColour('#0000ff'))), '#ffffff');
});

test('a see-through colour is laid over the other first', () => {
  const white = parseColour('white');
  // Half black on white is #808080 (rounded), whose ratio against white is about 3.9.
  const r = contrast(parseColour('rgb(0 0 0 / 0.5)'), white);
  assert.ok(r > 3.8 && r < 4.1, String(r));
  assert.equal(contrast(parseColour('transparent'), white), 1);
});

test('a pick from a photo: the average of a small square, see-through pixels weighed less', () => {
  // 4 × 4 pixels: the left half red, the right half blue; one pixel see-through.
  const w = 4;
  const h = 4;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data.set(x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], i);
    }
  assert.equal(toHex(averageAt(data, w, h, 0, 0, 0)), '#ff0000');
  assert.equal(toHex(averageAt(data, w, h, 3, 3, 0)), '#0000ff');
  // A 3 × 3 square at (1, 1): six red pixels and three blue.
  assert.equal(toHex(averageAt(data, w, h, 1, 1, 1)), '#aa0055');
  // At the edge the square is cut, not wrapped.
  assert.equal(toHex(averageAt(data, w, h, 0, 0, 1)), '#ff0000');
  data.set([0, 0, 0, 0], (0 * w + 1) * 4);
  assert.equal(toHex({ ...averageAt(data, w, h, 0, 0, 1), alpha: 1 }), '#ff0000', 'a see-through pixel does not pull it to black');
  assert.equal(pickRadius(900, 506), 2);
  assert.equal(pickRadius(100, 100), 1);
  assert.equal(pickRadius(1600, 1600), 6);
});

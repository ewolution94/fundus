// The header across widths: up to a 1080p screen its controls sit at the gutter; wider, they keep to
// a centred 1920 px group while the bar and its rule run the screen's width, as in Pitcher (the user,
// 2026-11-04: "the header is too stretched out for ultra wide monitors").

export default {
  'wider than 1080p the header keeps to the middle 1920 px': async (t) => {
    const { page, assert } = t;
    for (const [width, side] of [[3440, 760], [2560, 320], [1920, 32], [1280, 32]]) {
      await page.setViewportSize({ width, height: 1000 });
      await t.open('/count-words');
      const [left, right, bar, over] = await page.evaluate(() => {
        const box = (s) => document.querySelector(s).getBoundingClientRect();
        return [box('header.top .brand').left, innerWidth - box('header.top .gear').right, box('header.top').width, document.documentElement.scrollWidth - innerWidth];
      });
      assert.equal(Math.round(left), side, `at ${width} px the name starts ${side} px in`);
      assert.equal(Math.round(right), side, `at ${width} px Settings ends ${side} px in`);
      assert.equal(Math.round(bar), width, 'the bar runs the width');
      assert.equal(over, 0, 'no sideways scroll');
    }
    await page.screenshot({ path: 'test-results/header-1280.png', clip: { x: 0, y: 0, width: 1280, height: 120 } });
  },

  'the home too': async (t) => {
    const { page, assert } = t;
    await page.setViewportSize({ width: 3440, height: 1000 });
    await t.open('/');
    const [left, right] = await page.evaluate(() => [document.querySelector('header.top .brand').getBoundingClientRect().left, innerWidth - document.querySelector('header.top .gear').getBoundingClientRect().right]);
    assert.equal(Math.round(left), 760);
    assert.equal(Math.round(right), 760);
  },
};

import { test, expect } from '@playwright/test';

/* Most sites using this are React sites, so this is the primary integration
 * path — and the one with the sharpest edges. Both failure modes here are
 * invisible in development until they aren't:
 *
 *   - a missing cleanup exhausts the browser's ~8-16 WebGL context budget after
 *     a handful of route changes, after which every effect silently fails
 *   - config in the mount effect's deps rebuilds 65,000 particles on every
 *     colour tweak
 *
 * The fixture runs under StrictMode, which double-invokes effects on purpose.
 */

const FIXTURE = '/tests/e2e/fixtures/react.html';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw new Error('uncaught page error: ' + e.message); });
});

test('mounts under StrictMode with exactly one canvas', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(2200);

  // StrictMode mounts, unmounts, remounts. A leaked canvas from the discarded
  // first mount would show up as two.
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.hero canvas')).toHaveCount(1);
  await expect(page.getByText('host content on top')).toBeVisible();
});

test('sizes to the component box, not the viewport', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(1200);
  const fit = await page.evaluate(() => {
    const host = document.querySelector('.hero');
    const canvas = host.querySelector('canvas');
    return {
      dh: Math.abs(canvas.clientHeight - host.clientHeight),
      notViewport: canvas.clientHeight !== innerHeight,
    };
  });
  expect(fit.dh).toBeLessThanOrEqual(1);
  expect(fit.notViewport).toBe(true);
});

test('survives 20 mount/unmount cycles without leaking a context', async ({ page }) => {
  const contextWarnings = [];
  page.on('console', (m) => {
    if (/too many|context lost|WebGL context was lost/i.test(m.text())) contextWarnings.push(m.text());
  });

  await page.goto(FIXTURE);
  await page.waitForTimeout(1500);

  // Well past the browser's live-context ceiling. Under StrictMode each click
  // is really two mounts, so this is ~40 contexts created and released.
  for (let i = 0; i < 20; i++) {
    await page.click('#toggle');
    await page.waitForTimeout(120);
  }

  // It starts mounted, so an even number of toggles returns it to mounted.
  await expect(page.locator('canvas')).toHaveCount(1);

  // Unmount: the canvas must actually go, not linger detached.
  await page.click('#toggle');
  await page.waitForTimeout(400);
  await expect(page.locator('canvas')).toHaveCount(0);

  // Then mount once more and confirm it still renders — the real proof, since
  // an exhausted context budget shows up as a silent failure to create a new
  // one rather than as an error.
  await page.click('#toggle');
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas')).toHaveCount(1);

  const alive = await page.evaluate(() => {
    const canvas = document.querySelector('.hero canvas');
    const gl = canvas.getContext('webgl2');
    return { hasContext: !!gl, lost: gl ? gl.isContextLost() : null };
  });
  expect(alive.hasContext).toBe(true);
  expect(alive.lost).toBe(false);
  expect(contextWarnings).toEqual([]);
});

test('a config change updates uniforms without rebuilding the simulation', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(2000);

  const before = await page.evaluate(() => {
    const canvas = document.querySelector('.hero canvas');
    window.__canvas = canvas;          // identity check across the update
    return canvas.width;
  });

  await page.click('#recolour');
  await page.waitForTimeout(700);

  const after = await page.evaluate(() => ({
    sameCanvas: document.querySelector('.hero canvas') === window.__canvas,
    width: document.querySelector('.hero canvas').width,
  }));

  // Same canvas element means no remount; the colour went in as a uniform.
  expect(after.sameCanvas).toBe(true);
  expect(after.width).toBe(before);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('a particle-count change rebuilds in place and keeps rendering', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(2000);

  await page.click('#recount');
  await page.waitForTimeout(1500);

  // Count is baked into the texture size, so this one legitimately rebuilds the
  // simulation — but must not remount the component or drop the canvas.
  await expect(page.locator('canvas')).toHaveCount(1);
  const alive = await page.evaluate(() => {
    const gl = document.querySelector('.hero canvas').getContext('webgl2');
    return !!gl && !gl.isContextLost();
  });
  expect(alive).toBe(true);
});

test('a fresh config object each render does not cause churn', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(2000);

  /* The fixture builds `config` as a new object literal every render. If the
     binding compared by identity it would push config — and on a count change,
     rebuild — on every unrelated state update. Toggling an unrelated piece of
     state must leave the canvas alone. */
  const before = await page.evaluate(() => {
    window.__c = document.querySelector('.hero canvas');
    return document.querySelector('.hero canvas').width;
  });

  await page.click('#recolour'); // triggers a re-render
  await page.waitForTimeout(400);
  await page.click('#recolour'); // same value, still re-renders
  await page.waitForTimeout(400);

  expect(await page.evaluate(() => document.querySelector('.hero canvas') === window.__c)).toBe(true);
  expect(await page.evaluate(() => document.querySelector('.hero canvas').width)).toBe(before);
});

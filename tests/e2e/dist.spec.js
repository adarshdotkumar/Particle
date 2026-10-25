import { test, expect } from '@playwright/test';

/* Proves the real built artifact works the way the snippet promises: a plain
 * <script src> with three bundled, no import map, no module type. If this
 * passes, the exported snippet works on someone else's site. */

test('the standalone build runs from a plain script tag', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/examples/hero.html');
  await page.waitForTimeout(2500);

  expect(errors).toEqual([]);
  // Global exposed, auto-mount ran, three fields on the page.
  expect(await page.evaluate(() => typeof window.ParticleField)).toBe('object');
  expect(await page.evaluate(() => window.ParticleField.fields.length)).toBe(3);
  expect(await page.evaluate(() => window.ParticleField.fields.every(f => f.supported))).toBe(true);
  // No import map on the page, and three is not a global — it is bundled in.
  expect(await page.evaluate(() => document.querySelector('script[type="importmap"]'))).toBeNull();
  await page.screenshot({ path: '/tmp/pf-hero.png' });
});

test('background mode fixes to the viewport and follows scroll', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/examples/background.html');
  await page.waitForTimeout(2000);

  expect(errors).toEqual([]);
  const canvas = page.locator('canvas');
  expect(await canvas.evaluate((c) => getComputedStyle(c).position)).toBe('fixed');
  expect(await canvas.evaluate((c) => c.clientHeight)).toBe(800);

  const top = await page.evaluate(() => window.ParticleField.fields[0].getProgress());
  await page.screenshot({ path: '/tmp/pf-bg-top.png' });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1800);
  const bottom = await page.evaluate(() => window.ParticleField.fields[0].getProgress());
  await page.screenshot({ path: '/tmp/pf-bg-bottom.png' });

  expect(top).toBeGreaterThan(0.9);   // formed at the top
  expect(bottom).toBeLessThan(0.1);   // dust at the bottom
});

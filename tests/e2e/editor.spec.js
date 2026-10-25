import { test, expect } from '@playwright/test';

const EDITOR = '/src/editor/index.html';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw new Error('uncaught page error: ' + e.message); });
  // Clear once, on the origin — NOT via addInitScript, which would re-run on
  // every navigation within a test and wipe state a test is deliberately
  // carrying across one of its own page.goto()/reload() calls.
  await page.goto(EDITOR);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
});

test('boots, renders, and shows fps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(EDITOR);
  await page.waitForTimeout(2200);
  await expect(page.locator('#stage canvas')).toHaveCount(1);
  await expect(page.locator('#unsupported')).not.toHaveClass(/show/);
  await expect(page.locator('#fps')).toContainText('particles');
  // 18 sliders + 7 presets + 6 origins + 3 shape chips (Sphere, Cube, X —
  // Text is its own always-visible input, not a chip)
  await expect(page.locator('#sliders input[type=range]')).toHaveCount(18);
  await expect(page.locator('#presets button')).toHaveCount(7);
  await expect(page.locator('#origins button')).toHaveCount(6);
  await expect(page.locator('#shapes button')).toHaveCount(3); // Sphere, Cube, X
  await page.screenshot({ path: '/tmp/pf-editor.png' });
});

test('a preset resets keys it does not mention', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1200);
  // Starts on Shards, which sets depth 0.55.
  const before = await page.evaluate(() => window.__field.getConfig().depth);
  expect(before).toBeCloseTo(0.55, 2);

  await page.getByRole('button', { name: 'Smoke', exact: true }).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__field.getConfig().depth);
  expect(after).toBeCloseTo(0.18, 2); // the default, not Shards' 0.55
});

/* Parity with reference/particle-effect.html:1573-1580 — shape, text and count
   are the user's content, so a preset that does not name them leaves them
   alone. Caught as a regression by side-by-side comparison with the original. */
test('a preset keeps your shape and typed text', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1200);

  // Text has no chip of its own — typing into the always-visible input is
  // what switches to it.
  await page.locator('#shapeText').fill('KEEPME');
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: 'Smoke', exact: true }).click();
  await page.waitForTimeout(600);

  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).toBe('text');      // not reset to sphere
  expect(config.shapeText).toBe('KEEPME');    // the word survives
  expect(config.spring).toBeCloseTo(0.65, 2); // but the look did change

  // Even a preset that names a shape of its own (Shards ships as the 3D X)
  // must not switch you onto it — shape is never part of a look.
  await page.getByRole('button', { name: 'Shards', exact: true }).click();
  await page.waitForTimeout(600);
  const afterShards = await page.evaluate(() => window.__field.getConfig());
  expect(afterShards.shapeMode).toBe('text');
  expect(afterShards.shapeText).toBe('KEEPME');
  expect(afterShards.depth).toBeCloseTo(0.55, 2); // the look still changed
});

test('moving a slider updates the config and the hash', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);
  const before = page.url();

  // Glow lives in the Dots bucket, collapsed by default — only the first
  // bucket (Wind) starts open.
  await page.locator('#sliders details.bucket', { hasText: 'Dots' }).locator('summary').click();
  const glow = page.locator('#sliders input[type=range]').nth(13);
  await glow.fill('1.4');
  await glow.dispatchEvent('input');
  await page.waitForTimeout(400);

  expect(await page.evaluate(() => window.__field.getConfig().glow)).toBeCloseTo(1.4, 2);
  expect(page.url()).not.toBe(before);
  expect(page.url()).toContain('#');
});

/* A plain F5 must always land on the Shards default (the 3D X), even though
   every edit keeps the address bar's #hash in sync with the live config (see
   syncHash in storage.js) — the same hash a real shared link uses. The two
   are told apart by the browser's navigation-timing entry: page.reload()
   reports type 'reload'; page.goto(), even to the exact same URL, reports
   'navigate' (verified directly against Chromium before relying on it). */
test('a plain refresh always resets to the Shards default', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Chaos', exact: true }).click();
  await page.locator('[data-shape="sphere"]').click();
  await page.waitForTimeout(500);
  expect(page.url()).toContain('#'); // the hash did pick up the edit

  await page.reload();
  await page.waitForTimeout(1200);

  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).toBe('x');           // back to X, not sphere
  expect(config.spring).toBeCloseTo(0.10, 2);   // Shards', not Chaos's
  await expect(page.locator('[data-preset="Shards"]')).toHaveClass(/active/);
});

test('a shared link still opens its exact effect, not the default', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);

  const link = await page.evaluate(async () => {
    const { encodeConfig, normalizeConfig } = await import('/src/index.js');
    return encodeConfig(normalizeConfig({ spring: 7.5, shapeMode: 'sphere' }));
  });
  await page.goto(`${EDITOR}#${link}`);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__field.getConfig().spring)).toBeCloseTo(7.5, 2);
});

test('reset keeps the shape and active preset, discarding only ad-hoc edits', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);

  // Land on a non-default shape + preset combination.
  await page.getByRole('button', { name: 'Cube', exact: true }).click();
  await page.getByRole('button', { name: 'Smoke', exact: true }).click();
  await page.waitForTimeout(500);

  // Fiddle with a slider away from Smoke's own value.
  const flowStrength = page.locator('#sliders input[type=range]').nth(0); // Wind starts open
  await flowStrength.fill('2.5');
  await flowStrength.dispatchEvent('input');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Reset' }).click();

  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).toBe('cube');        // never jumps back to sphere
  expect(config.flowStrength).toBeCloseTo(1.05, 2); // Smoke's own value, not the edit or the hard default
  await expect(page.locator('[data-preset="Smoke"]')).toHaveClass(/active/);
});

test('reset falls back to hard defaults for the look when no preset is tracked', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);

  // Opening a shared link loads a whole config and marks no preset as active
  // (see panel.js setConfig) — build one the same way the shared-link test
  // above does, then navigate straight to it.
  const link = await page.evaluate(async () => {
    const { encodeConfig, normalizeConfig } = await import('/src/index.js');
    return encodeConfig(normalizeConfig({ shapeMode: 'cube' }));
  });
  await page.goto(`${EDITOR}#${link}`);
  await page.waitForTimeout(1000);
  await expect(page.locator('#presetStatus')).toBeHidden(); // nothing tracked

  await page.getByRole('button', { name: 'Reset' }).click();
  await page.waitForTimeout(300);

  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).toBe('cube');       // shape still kept
  expect(config.flowStrength).toBeCloseTo(0.55, 2); // hard numeric default
});

test('editing away from a preset offers a revert back to it', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);

  // A fresh visit boots into Shards, shown as applied from the start.
  await expect(page.locator('#presetStatus .name')).toHaveText('Shards');
  await expect(page.locator('[data-preset="Shards"]')).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Smoke', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('#presetStatus .name')).toHaveText('Smoke');
  await expect(page.locator('#revertBtn')).toBeHidden(); // not edited yet

  const flowStrength = page.locator('#sliders input[type=range]').nth(0); // Wind starts open
  await flowStrength.fill('2.5');
  await flowStrength.dispatchEvent('input');
  await page.waitForTimeout(300);
  await expect(page.locator('#presetStatus .name')).toHaveText('Smoke'); // still remembered
  await expect(page.locator('#revertBtn')).toBeVisible();

  await page.locator('#revertBtn').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__field.getConfig().flowStrength)).toBeCloseTo(1.05, 2);
  await expect(page.locator('#revertBtn')).toBeHidden(); // clean again
  await expect(page.locator('[data-preset="Smoke"]')).toHaveClass(/active/);
});

test('switching shape keeps the active preset and its look', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'Smoke', exact: true }).click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Cube', exact: true }).click();
  await page.waitForTimeout(400);

  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).toBe('cube');       // shape changed
  expect(config.spring).toBeCloseTo(0.65, 2);  // Smoke's look did not
  await expect(page.locator('[data-preset="Smoke"]')).toHaveClass(/active/);
  await expect(page.locator('#revertBtn')).toBeHidden(); // nothing to revert
});

test('the export panel produces a snippet reflecting the live config', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);

  await page.locator('#embed > summary').click();
  await page.waitForTimeout(200);

  const html = await page.locator('#embedCode').textContent();
  expect(html).toContain('data-particle-field');
  expect(html).toContain('particle-field.min.js');
  expect(html).toContain('cdn.jsdelivr.net/gh/');
  expect(html).toContain('"shapeMode": "x"'); // Shards default

  // Changing a preset must flow through to the snippet.
  await page.getByRole('button', { name: 'Nebula', exact: true }).click();
  await page.waitForTimeout(400);
  expect(await page.locator('#embedCode').textContent()).toContain('"colA": "#c98cff"');
});

/* The audience is non-technical, so the developer variants must not be the
   first thing anyone meets, and the big button must never copy something other
   than what it says. */
test('developer variants are folded away and do not hijack the main button', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);
  await page.locator('#embed > summary').click();

  await expect(page.locator('#embedDev')).not.toHaveAttribute('open', '');
  await expect(page.locator('#embedDevCode')).toBeHidden();

  await page.locator('#embedDev > summary').click();
  await page.waitForTimeout(200);
  expect(await page.locator('#embedDevCode').textContent()).toContain('new ParticleField(');

  await page.getByRole('button', { name: 'React', exact: true }).click();
  await page.waitForTimeout(200);
  const react = await page.locator('#embedDevCode').textContent();
  expect(react).toContain("from '@adarshdotkumar/particle-field/react'");
  expect(react).toContain('<ParticleField');

  // The React tab is open, but the primary block is still plain HTML.
  const primary = await page.locator('#embedCode').textContent();
  expect(primary).toContain('data-particle-field');
  expect(primary).not.toContain('<ParticleField');
});

test('height is disabled for a fullscreen background', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1000);
  await page.locator('#embed > summary').click();

  await expect(page.locator('#embedHeight')).toBeEnabled();
  await page.locator('#embedMode').selectOption('background');
  await page.waitForTimeout(200);
  await expect(page.locator('#embedHeight')).toBeDisabled();
  expect(await page.locator('#embedCode').textContent()).toContain('"mode": "background"');
});

// Served over http, so share links are meaningful here. The file:// case is
// covered in singlefile.spec.js.
test('shows the share button when served over http', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(800);
  await expect(page.locator('#shareBtn')).toBeVisible();
});

test('typing in the text field switches to the text shape and re-forms', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(EDITOR);
  await page.waitForTimeout(1200);

  // No chip to click — the input is always visible, and using it is the
  // selection.
  await expect(page.locator('#shapeText')).toBeVisible();

  await page.locator('#shapeText').fill('SHIP');
  await page.waitForTimeout(900);
  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeText).toBe('SHIP');
  expect(config.shapeMode).toBe('text');
  await page.screenshot({ path: '/tmp/pf-editor-text.png' });
});

test('changing particle count rebuilds and keeps running', async ({ page }) => {
  await page.goto(EDITOR);
  await page.waitForTimeout(1200);
  await page.locator('#count').selectOption('128');
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__field.getStats().count)).toBe(128 * 128);
  expect(await page.evaluate(() => window.__field.isRunning)).toBe(true);
});

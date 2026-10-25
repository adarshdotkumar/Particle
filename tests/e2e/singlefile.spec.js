import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* The designer's actual path: a downloaded file, double-clicked, offline.
 *
 * Every other spec in this directory runs over http://localhost:5199, where
 * this path's failure modes are invisible — file:// has an opaque origin,
 * different localStorage policy, and its own secure-context rules for the
 * clipboard. If the single file were quietly broken, this is the only suite
 * that would notice.
 */

const FILE = fileURLToPath(
  new URL('../../dist-editor/particle-field-editor.html', import.meta.url)
);
const URL_ = `file://${FILE}`;

test.beforeAll(() => {
  if (!existsSync(FILE)) {
    throw new Error('dist-editor/particle-field-editor.html missing — run `npm run build:editor`');
  }
});

/** A context with no network at all, to prove the file needs none. */
const offline = (browser, extra = {}) =>
  browser.newContext({ offline: true, viewport: { width: 1280, height: 800 }, ...extra });

test('boots from file:// with the network fully offline', async ({ browser }) => {
  const ctx = await offline(browser);
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  const offMachine = [];
  page.on('request', (r) => { if (!r.url().startsWith('file:')) offMachine.push(r.url()); });

  await page.goto(URL_);
  await page.waitForTimeout(2500);

  expect(errors).toEqual([]);
  expect(offMachine).toEqual([]); // nothing left the machine
  expect(await page.evaluate(() => window.__field.supported)).toBe(true);
  await expect(page.locator('#stage canvas')).toHaveCount(1);
  await expect(page.locator('#sliders input[type=range]')).toHaveCount(18);
  await expect(page.locator('#presets button')).toHaveCount(7);

  await page.screenshot({ path: '/tmp/pf-singlefile.png' });
  await ctx.close();
});

test('the effect is live and tunable, not a still frame', async ({ browser }) => {
  const ctx = await offline(browser);
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForTimeout(2000);

  expect(await page.evaluate(() => window.__field.getStats().fps)).toBeGreaterThan(10);
  expect(await page.evaluate(() => window.__field.isRunning)).toBe(true);

  await page.getByRole('button', { name: 'Nebula', exact: true }).click();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__field.getConfig().colA)).toBe('#c98cff');

  await ctx.close();
});

test('the copy button yields a pasteable snippet', async ({ browser }) => {
  const ctx = await offline(browser, { permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForTimeout(1500);

  await page.locator('#embed > summary').click();
  await page.getByRole('button', { name: /^Copy code/ }).click();
  await page.waitForTimeout(300);

  // Prefer the real clipboard; fall back to the on-screen block if the browser
  // refuses to read it back, since the select-all path is what a user would use.
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  const text = copied ?? (await page.locator('#embedCode').textContent());

  expect(text).toContain('data-particle-field');
  expect(text).toContain('cdn.jsdelivr.net/gh/');
  expect(text).toContain('particle-field.min.js');
  await ctx.close();
});

test('hides the share button, since file:// has no shareable URL', async ({ browser }) => {
  const ctx = await offline(browser);
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForTimeout(1200);

  await expect(page.locator('#shareBtn')).toBeHidden();
  await expect(page.locator('#downloadBtn')).toBeVisible();
  await expect(page.locator('#downloadBtn')).toHaveText('Save as .json');
  await ctx.close();
});

test('a plain reload resets to the default on the file:// path too', async ({ browser }) => {
  const ctx = await offline(browser);
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: 'Chaos', exact: true }).click();
  await page.waitForTimeout(800);

  await page.reload();
  await page.waitForTimeout(1800);

  // Same navigation-timing based detection as the hosted editor — a real
  // reload always lands back on Shards, whether over http or file://.
  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).toBe('x');
  expect(config.spring).toBeCloseTo(0.10, 2);
  await ctx.close();
});

test('reports whether localStorage is permitted on file:// in this browser', async ({ browser }) => {
  const ctx = await offline(browser);
  const page = await ctx.newPage();
  await page.goto(URL_);

  const env = await page.evaluate(() => ({
    localStorage: (() => {
      try { localStorage.setItem('_p', '1'); localStorage.removeItem('_p'); return true; }
      catch { return false; }
    })(),
    secureContext: window.isSecureContext,
    origin: location.origin,
  }));

  console.log(
    `file:// environment — localStorage: ${env.localStorage ? 'allowed' : 'BLOCKED'}, ` +
    `secureContext: ${env.secureContext}, origin: ${env.origin}`
  );

  /* Not asserted: these are browser policy, not our behaviour, and they differ
     between engines. What matters is that the editor boots either way, which
     the first test in this file covers. Recorded so a future change in browser
     policy shows up in the log rather than as a mystery bug report. */
  expect(typeof env.localStorage).toBe('boolean');
  await ctx.close();
});

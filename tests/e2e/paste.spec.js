import { test, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/* The whole loop, end to end, the way a designer does it:
 * open the downloaded file -> tune -> copy -> paste into a page -> it works. */

const EDITOR = 'file://' + fileURLToPath(
  new URL('../../dist-editor/particle-field-editor.html', import.meta.url));

test('an effect made in the single-file editor renders when pasted into a page', async ({ browser }) => {
  // ── 1. Open the downloaded editor, offline, and make something ──────────
  const ctx = await browser.newContext({ offline: true, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(EDITOR);
  await page.waitForTimeout(1800);

  // No Text chip — typing into the always-visible input is what selects it.
  await page.locator('#shapeText').fill('SHIPPED');
  await page.getByRole('button', { name: 'Shimmer', exact: true }).click();
  await page.waitForTimeout(800);

  // ── 2. Copy the embed code ─────────────────────────────────────────────
  await page.locator('#embed > summary').click();
  await page.waitForTimeout(300);
  const snippet = await page.locator('#embedCode').textContent();
  await ctx.close();

  expect(snippet).toContain('data-particle-field');
  expect(snippet).toContain('"shapeText": "SHIPPED"');

  // ── 3. Paste it into somebody's page ───────────────────────────────────
  // The repo tag isn't pushed yet, so point the CDN src at the local build —
  // the same file jsDelivr will serve, byte for byte.
  const pasted = snippet.replace(
    /https:\/\/cdn\.jsdelivr\.net\/gh\/[^"]+/,
    '/dist/particle-field.min.js'
  );
  expect(pasted).toContain('/dist/particle-field.min.js');

  // Written into the gitignored test-results/, which vite still serves since
  // the package root is the server root.
  const outDir = new URL('../../test-results/', import.meta.url);
  await mkdir(outDir, { recursive: true });
  await writeFile(new URL('pasted-check.html', outDir), `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>somebody's website</title>
<style>
  body { margin:0; background:#0a0a12; color:#fff;
         font:16px/1.6 ui-sans-serif,-apple-system,Arial,sans-serif; }
  .wrap { max-width:900px; margin:0 auto; padding:40px 24px; }
  h1 { position:relative; z-index:1; text-align:center; font-size:52px;
       letter-spacing:-.03em; margin:0; }
</style></head><body><div class="wrap">
<h1>Our existing headline</h1>
${pasted}
<p>Ordinary page content below the effect.</p>
</div></body></html>`);

  // ── 4. Does it work on that page? ──────────────────────────────────────
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  const errors = [];
  page2.on('pageerror', (e) => errors.push(e.message));
  page2.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page2.goto('/test-results/pasted-check.html');
  await page2.waitForTimeout(2500);

  expect(errors).toEqual([]);
  await expect(page2.locator('canvas')).toHaveCount(1);
  expect(await page2.evaluate(() => window.ParticleField.fields.length)).toBe(1);
  expect(await page2.evaluate(() => window.ParticleField.fields[0].supported)).toBe(true);
  expect(await page2.evaluate(() => window.ParticleField.fields[0].getConfig().shapeText)).toBe('SHIPPED');
  // The host page's own heading is still on top and still visible.
  await expect(page2.locator('h1')).toBeVisible();

  await page2.screenshot({ path: '/tmp/pf-pasted.png' });
  await ctx2.close();
});

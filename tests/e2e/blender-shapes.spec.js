import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Both ways a Blender model reaches the dots: loaded by URL at runtime (the
 * 'custom' shape, as an embed on someone's site would), and saved into the
 * code from the editor as a built-in shape. */

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/triangle.gltf');
const EDITOR = '/src/editor/index.html';
const NAME = 'e2e-triangle';

test('a custom shape loads its model from shapeModelUrl by itself', async ({ page }) => {
  await page.goto(EDITOR);

  const bounds = await page.evaluate(async () => {
    const { ParticleField } = await import('/src/index.js');
    const host = Object.assign(document.createElement('div'), { style: 'height:300px' });
    document.body.append(host);
    const field = new ParticleField({
      container: host,
      config: { shapeMode: 'custom', shapeModelUrl: '/tests/e2e/fixtures/triangle.gltf', depth: 0 },
    });
    // Until the fetch lands it is the sphere; wait for the re-seed.
    for (let i = 0; i < 50 && field._sim.bounds.size[2] > 0.01; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const { size } = field._sim.bounds;
    field.destroy();
    return size;
  });

  expect(bounds[2]).toBeLessThan(0.01);        // flat, like the triangle — not a sphere
  expect(bounds[0]).toBeCloseTo(2.85, 1);      // scaled to the standard width
});

test('Save as shape writes the upload into the code, and Remove takes it out', async ({ page, request }) => {
  const cleanup = () => request.delete(`/__particle-field/models/${NAME}`, {
    headers: { 'X-Particle-Field': '1' },
  });

  try {
    await page.goto(EDITOR);
    await page.setInputFiles('#modelUploadInput', FIXTURE);
    await expect(page.locator('#saveShapeBtn')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept('E2E Triangle'));
    await page.locator('#saveShapeBtn').click();

    // The shape list changed, so the page reloads onto the new shape.
    const chip = page.locator(`[data-shape="${NAME}"]`);
    await expect(chip).toBeVisible({ timeout: 15000 });
    await expect(chip).toHaveClass(/on/);
    await expect(chip).toContainText('E2E Triangle');
    expect(await page.evaluate(() => window.__field.getConfig().shapeMode)).toBe(NAME);
    await expect(page.locator('#removeShapeBtn')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#removeShapeBtn').click();
    // Reloads again, back onto the X — wait for the new page, not the old one
    // mid-teardown.
    await expect(page.locator('#toast')).toContainText('Removed "E2E Triangle"', { timeout: 15000 });
    await expect(page.locator('[data-shape="x"]')).toHaveClass(/on/);
    await expect(chip).toHaveCount(0);
    expect(await page.evaluate(() => window.__field.getConfig().shapeMode)).toBe('x');
  } finally {
    await cleanup(); // a no-op 400 if the test already removed it
  }
});

test('the save endpoint refuses requests without its header', async ({ request }) => {
  const response = await request.delete('/__particle-field/models/x');
  expect(response.status()).toBe(403);
});

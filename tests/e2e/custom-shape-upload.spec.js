import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/triangle.gltf',
);

test('uploading a model selects the custom shape and forms particles from it', async ({ page }) => {
  await page.goto('/src/editor/index.html');

  await page.setInputFiles('#modelUploadInput', FIXTURE);
  await expect(page.locator('#toast')).toContainText('triangle.gltf');

  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).toBe('custom');
  expect(config.shapeModelUrl).toContain('blob:');

  const chip = page.locator('[data-shape="custom"]');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveClass(/on/);
});

test('an invalid upload falls back to the sphere with a toast', async ({ page }) => {
  await page.goto('/src/editor/index.html');

  // A .gltf with no mesh at all — same empty-scene shape as the loader's own
  // rejection test in model-loader.spec.js, but exercised through the UI.
  const emptyScene = Buffer.from(JSON.stringify({
    asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0,
  }));

  await page.setInputFiles('#modelUploadInput', {
    name: 'empty.gltf',
    mimeType: 'model/gltf+json',
    buffer: emptyScene,
  });

  await expect(page.locator('#toast')).toContainText("Couldn't load");
  const config = await page.evaluate(() => window.__field.getConfig());
  expect(config.shapeMode).not.toBe('custom');
});

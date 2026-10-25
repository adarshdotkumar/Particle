import { test, expect } from '@playwright/test';

test('loadCustomModel populates the custom-shape cache from a real glTF file', async ({ page }) => {
  await page.goto('/src/editor/index.html');

  const result = await page.evaluate(async () => {
    const { loadCustomModel } = await import('/src/engine/model-loader.js');
    const { customModelCache } = await import('/src/engine/shapes/custom-cache.js');

    const url = '/tests/e2e/fixtures/triangle.gltf';
    await loadCustomModel(url);
    const mesh = customModelCache.get(url);
    return {
      hasMesh: !!mesh,
      positionLength: mesh?.position.length,
      indexLength: mesh?.index.length,
      meshDepth: mesh?.meshDepth,
    };
  });

  expect(result.hasMesh).toBe(true);
  expect(result.positionLength).toBe(9); // 3 vertices * 3
  expect(result.indexLength).toBe(3);
  expect(result.meshDepth).toBeGreaterThan(0);
});

test('loadCustomModel rejects a URL with no mesh geometry', async ({ page }) => {
  await page.goto('/src/editor/index.html');

  const rejected = await page.evaluate(async () => {
    const { loadCustomModel } = await import('/src/engine/model-loader.js');
    try {
      await loadCustomModel('data:model/gltf+json,' + encodeURIComponent(JSON.stringify({
        asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0,
      })));
      return false;
    } catch {
      return true;
    }
  });

  expect(rejected).toBe(true);
});

import { test, expect } from '@playwright/test';

/* The GPU paths cannot run in Node, so this file is the only proof the engine
 * actually works. Every test here maps to a real way an embed breaks on
 * somebody else's website — do not weaken one to make it pass. */

const FIXTURE = '/tests/e2e/fixtures/embed.html';

const settle = (page, ms = 1500) => page.waitForTimeout(ms);

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw new Error('uncaught page error: ' + e.message); });
});

test('mounts one canvas per container and reports support', async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator('canvas')).toHaveCount(2);
  expect(await page.evaluate(() => window.fields.every((f) => f.supported))).toBe(true);
  expect(await page.evaluate(() => window.fields.length)).toBe(2);
});

test('the canvas sizes to its container, not the viewport', async ({ page }) => {
  await page.goto(FIXTURE);
  await settle(page, 400);
  const fits = await page.evaluate(() => {
    const el = document.querySelector('#one');
    const canvas = el.querySelector('canvas');
    return {
      dw: Math.abs(canvas.clientWidth - el.clientWidth),
      dh: Math.abs(canvas.clientHeight - el.clientHeight),
      notViewport: canvas.clientHeight !== innerHeight,
    };
  });
  expect(fits.dw).toBeLessThanOrEqual(1);
  expect(fits.dh).toBeLessThanOrEqual(1);
  expect(fits.notViewport).toBe(true);
});

test('gives a static container a containing block so the canvas can position', async ({ page }) => {
  await page.goto(FIXTURE);
  const position = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#one')).position);
  expect(position).toBe('relative');
});

test('actually draws pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(FIXTURE);
  await settle(page, 2000);

  // A same-sized element with no effect is the control: an empty region
  // compresses to a fraction of a region full of dots.
  const drawn = await page.locator('#one').screenshot();
  const blank = await page.locator('#blank').screenshot();
  expect(drawn.length).toBeGreaterThan(blank.length * 5);
});

test('destroy removes the canvas, stops the loop, and is idempotent', async ({ page }) => {
  await page.goto(FIXTURE);
  await settle(page, 600);

  const result = await page.evaluate(async () => {
    let frames = 0;
    const native = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { frames++; return native(cb); };

    window.fields.forEach((f) => f.destroy());
    window.fields.forEach((f) => f.destroy()); // must not throw

    // Let anything still scheduled drain, then take the baseline.
    await new Promise((r) => native(() => native(r)));
    const baseline = frames;
    await new Promise((r) => setTimeout(r, 500));

    return {
      canvases: document.querySelectorAll('canvas').length,
      baseline,
      after: frames,
      running: window.fields.map((f) => f.isRunning),
      destroyed: window.fields.map((f) => f.destroyed),
    };
  });

  expect(result.canvases).toBe(0);
  expect(result.running).toEqual([false, false]);
  expect(result.destroyed).toEqual([true, true]);
  // Only the two calls this test itself made should appear after the baseline.
  expect(result.after).toBe(result.baseline);
});

test('destroy releases the WebGL context, so remount cycles do not leak', async ({ page }) => {
  await page.goto(FIXTURE);
  const warnings = [];
  page.on('console', (m) => {
    if (/too many|context lost|WARNING: Too many/i.test(m.text())) warnings.push(m.text());
  });

  const ok = await page.evaluate(async () => {
    const { ParticleField } = await import('/src/index.js');
    const host = document.querySelector('#blank');
    // Well past the browser's ~8-16 live context ceiling.
    for (let i = 0; i < 24; i++) {
      const field = new ParticleField({ container: host, config: { count: 64 } });
      if (!field.supported) return false;
      field.destroy();
    }
    return document.querySelectorAll('#blank canvas').length === 0;
  });

  expect(ok).toBe(true);
  expect(warnings).toEqual([]);
});

test('two instances stay independent', async ({ page }) => {
  await page.goto(FIXTURE);
  await settle(page, 400);
  await page.evaluate(() => window.fields[0].set({ colA: '#ff0000', colB: '#ff0000' }));
  await settle(page, 300);

  const colours = await page.evaluate(() => window.fields.map((f) => f.getConfig().colA));
  expect(colours[0]).toBe('#ff0000');
  expect(colours[1]).not.toBe('#ff0000');

  const shapes = await page.evaluate(() => window.fields.map((f) => f.getConfig().shapeMode));
  expect(shapes).toEqual(['sphere', 'text']);
});

test('pauses while scrolled out of view and resumes on approach', async ({ page }) => {
  await page.goto(FIXTURE);
  await settle(page, 800);

  // Field two starts below the fold.
  expect(await page.evaluate(() => window.fields[1].isRunning)).toBe(false);
  expect(await page.evaluate(() => window.fields[0].isRunning)).toBe(true);

  await page.evaluate(() => document.querySelector('#two').scrollIntoView({ block: 'center' }));
  await settle(page, 800);
  expect(await page.evaluate(() => window.fields[1].isRunning)).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 800);
  expect(await page.evaluate(() => window.fields[1].isRunning)).toBe(false);
});

/* Playwright cannot truly background a page — opening another tab leaves
   document.hidden === false — so this drives the visibility API directly. That
   still covers the part we wrote (the handler); the browser firing the event
   for a real hidden tab is the platform's job. */
test('pauses on a hidden tab', async ({ page }) => {
  await page.goto(FIXTURE);
  await settle(page, 600);
  expect(await page.evaluate(() => window.fields[0].isRunning)).toBe(true);

  const hide = (hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

  await hide(true);
  expect(await page.evaluate(() => window.fields[0].isRunning)).toBe(false);

  await hide(false);
  expect(await page.evaluate(() => window.fields[0].isRunning)).toBe(true);
});

test('set() applies live: uniforms without a rebuild, shapes with a reseed', async ({ page }) => {
  await page.goto(FIXTURE);
  await settle(page, 600);

  const same = await page.evaluate(() => {
    const canvas = document.querySelector('#one canvas');
    window.fields[0].set({ glow: 1.2, spring: 8 });
    return document.querySelector('#one canvas') === canvas; // no rebuild
  });
  expect(same).toBe(true);

  // A count change is the one thing that must rebuild, and must survive it.
  const after = await page.evaluate(async () => {
    window.fields[0].set({ count: 128 });
    await new Promise((r) => setTimeout(r, 500));
    return { count: window.fields[0].getStats().count, running: window.fields[0].isRunning };
  });
  expect(after.count).toBe(128 * 128);
  expect(after.running).toBe(true);
});

test('renders a static frame and schedules nothing under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  await page.goto(FIXTURE);
  await page.waitForTimeout(1200);

  expect(await page.evaluate(() => window.fields[0].isRunning)).toBe(false);
  expect(await page.evaluate(() => window.fields[0].supported)).toBe(true);

  // Still drew the design, just not moving.
  const drawn = await page.locator('#one').screenshot();
  const blank = await page.locator('#blank').screenshot();
  expect(drawn.length).toBeGreaterThan(blank.length * 5);

  // And the frame is genuinely static.
  const a = await page.locator('#one').screenshot();
  await page.waitForTimeout(600);
  const b = await page.locator('#one').screenshot();
  expect(Buffer.compare(a, b)).toBe(0);

  await ctx.close();
});

test('degrades gracefully when float textures are missing', async ({ page }) => {
  await page.addInitScript(() => {
    const patch = function (original) {
      return function (name) {
        if (name === 'EXT_color_buffer_float') return null;
        return original.call(this, name);
      };
    };
    if (window.WebGLRenderingContext) {
      WebGLRenderingContext.prototype.getExtension =
        patch(WebGLRenderingContext.prototype.getExtension);
    }
    if (window.WebGL2RenderingContext) {
      WebGL2RenderingContext.prototype.getExtension =
        patch(WebGL2RenderingContext.prototype.getExtension);
    }
  });

  await page.goto(FIXTURE);
  await page.waitForTimeout(600);

  // No throw (beforeEach would have failed the test), no canvas, and the
  // reason is exposed on the element for the host page to style against.
  expect(await page.evaluate(() => window.fields.every((f) => f.supported === false))).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('#one')).toHaveAttribute(
    'data-particle-field-unsupported', 'no-float-textures'
  );
});

test('ignores malformed embed JSON instead of breaking the page', async ({ page }) => {
  await page.goto(FIXTURE);
  const ok = await page.evaluate(async () => {
    const { ParticleField, mount } = await import('/src/index.js');
    const el = document.createElement('div');
    el.style.height = '200px';
    el.setAttribute('data-particle-field', '{ this is not json ');
    document.body.appendChild(el);
    const made = mount(el.parentElement).filter((f) => f.container === el);
    const usedDefaults = made[0] instanceof ParticleField
      && made[0].getConfig().shapeMode === 'sphere';
    made.forEach((f) => f.destroy());
    el.remove();
    return usedDefaults;
  });
  expect(ok).toBe(true);
});

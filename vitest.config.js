import { defineConfig } from 'vitest/config';

/* Vitest owns the pure-Node unit tests only. The Playwright specs under
 * tests/e2e need a real browser and a GL context, so they are excluded here —
 * without this, vitest's default glob picks up *.spec.js and fails on the
 * @playwright/test import. */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});

/* Entry for the standalone build: the full API, plus auto-mount.
 *
 * This is what the paste-in snippet loads, which is why it self-starts — the
 * whole point is that the user writes no JavaScript at all.
 *
 * `fields` is a module-scoped array rather than a write to
 * window.ParticleField.fields: this file runs INSIDE the IIFE, and the global
 * does not exist until the IIFE returns. Exporting the array means the same
 * data is reachable as window.ParticleField.fields with no timing dependency.
 */
export * from './index.js';
import { mount } from './index.js';

export const fields = [];

function start() {
  fields.push(...mount());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  // The snippet uses `defer`, so parsing is usually already done.
  start();
}

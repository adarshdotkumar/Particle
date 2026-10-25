import * as THREE from 'three';

/* Renderer creation and the hardware check.
 *
 * Adapted from reference/particle-effect.html:504-520, with one important
 * change: the original threw when float textures were missing. An embed that
 * throws takes the host page's JS down with it, so this REPORTS instead and
 * lets the caller decide.
 */

/** @returns {{renderer: THREE.WebGLRenderer|null, supported: boolean, reason: string|null}} */
export function createContext({ canvas, dpr = 2, alpha = true }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha });
  } catch {
    return { renderer: null, supported: false, reason: 'no-webgl' };
  }

  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, dpr));
  // Transparent by default: that is what lets the canvas layer over whatever
  // the host page already has on the screen.
  renderer.setClearColor(0x000000, alpha ? 0 : 1);

  // Positions live in float textures, so this extension is mandatory.
  const gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float')) {
    renderer.dispose();
    return { renderer: null, supported: false, reason: 'no-float-textures' };
  }

  return { renderer, supported: true, reason: null };
}

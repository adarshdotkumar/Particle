/* snippet.js — turns a config into paste-ready code for someone else's site.
 * Pure string building, no dependencies beyond config.js. */
import { diffConfig } from './config.js';
import { CDN_BASE, TAG, PACKAGE } from './cdn.js';

/* JSON destined for a single-quoted HTML attribute.
   - the apostrophe would close the attribute
   - "</script" would close the surrounding script block on any page that
     inlines this snippet inside one
   Both are escaped as JSON unicode, which still parses as the same string. */
function attrJson(value) {
  return JSON.stringify(value, null, 2)
    .replace(/'/g, '\\u0027')
    .replace(/</g, '\\u003c');
}

/** Build a copy-paste embed snippet.
 *  @param config  a full or partial config; only the non-default keys ship
 *  @param options.flavor  'script' (default) | 'esm' | 'react'
 *  @param options.mode    'container' (default) | 'background'
 *  @param options.height  container height in px, default 600
 *  @param options.cdn / options.version  where the standalone build is served;
 *         defaults to this repo's jsDelivr URL at the pinned tag (src/cdn.js)
 */
export function generateSnippet(config, options = {}) {
  const {
    flavor = 'script',
    mode = 'container',
    height = 600,
    cdn = CDN_BASE,
    version = TAG,
  } = options;

  const payload = { ...diffConfig(config) };
  if (mode !== 'container') payload.mode = mode;

  // A blob: URL only resolves in the browser tab it was created in — never
  // ship one in a snippet meant for someone else's site. Swap it for a clear
  // placeholder instead of silently exporting a link that will 404 forever.
  if (typeof payload.shapeModelUrl === 'string' && payload.shapeModelUrl.startsWith('blob:')) {
    payload.shapeModelUrl = 'REPLACE_WITH_YOUR_HOSTED_MODEL_URL.glb';
  }

  if (flavor === 'script') {
    const src = `${cdn}@${version}/dist/particle-field.min.js`;
    return [
      `<div style="height:${height}px"`,
      `     data-particle-field='${attrJson(payload)}'></div>`,
      `<script src="${src}" defer></script>`,
    ].join('\n');
  }

  // For the code flavors the config is a JS literal, so only the indentation
  // needs adjusting — no HTML escaping applies.
  const literal = (indent) => JSON.stringify(payload, null, 2).replace(/\n/g, `\n${indent}`);

  if (flavor === 'esm') {
    return [
      `import { ParticleField } from '${PACKAGE}';`,
      ``,
      `const field = new ParticleField({`,
      `  container: document.querySelector('#hero'),`,
      `  mode: '${mode}',`,
      `  config: ${literal('  ')},`,
      `});`,
      ``,
      `// call field.destroy() when the element goes away`,
    ].join('\n');
  }

  if (flavor === 'react') {
    // Uses the packaged component rather than a hand-rolled useEffect: it
    // handles teardown on unmount, and it applies config changes as uniform
    // updates instead of rebuilding the simulation. Both are easy to get wrong
    // by hand, and both fail silently — see src/react.jsx.
    return [
      `import { ParticleField } from '${PACKAGE}/react';`,
      ``,
      `export function Hero() {`,
      `  return (`,
      `    <ParticleField`,
      `      style={{ height: ${height} }}`,
      `      mode="${mode}"`,
      `      config={${literal('      ')}}`,
      `    />`,
      `  );`,
      `}`,
    ].join('\n');
  }

  throw new Error(`Unknown snippet flavor: ${flavor}`);
}

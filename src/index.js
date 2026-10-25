/* particle-field — GPU particle effects you can put on a website.
 *
 * Public entry point. Everything exported here is API: renaming any of it
 * breaks every snippet anyone has ever exported.
 */
export { ParticleField, mount } from './engine/particle-field.js';

export {
  DEFAULTS,
  PRESETS,
  SLIDERS,
  RANGES,
  ORIGIN_KEYS,
  DOT_STYLES,
  SHAPE_MODES,
  COUNTS,
  CONFIG_KEYS,
  normalizeConfig,
  diffConfig,
  applyLook,
  CONTENT_KEYS,
} from './config.js';

export { encodeConfig, decodeConfig } from './codec.js';
export { generateSnippet } from './snippet.js';

/* config.js — the shared vocabulary of the whole package.
 *
 * Deliberately imports nothing but the list of built-in model names (plain
 * data, no mesh numbers) — not even three. That is what lets Vitest run it in
 * plain Node with no browser and no GPU, and it keeps the embed payload small.
 * Everything here is pure data or pure functions.
 */
import { MODEL_SHAPES } from './engine/shapes/models/catalog.js';

/*
 *
 * Extracted from reference/particle-effect.html §1 (lines 340-467).
 */

/* Every slider: [key, min, max, step, label, plain-English hint, bucket].
   The bucket is only a heading in the panel — sliders are grouped by what you
   are trying to change, so you can find one without reading all eighteen. */
export const SLIDERS = [
  ['flowStrength',  0, 3,    0.01, 'Wind strength',  'Smoke ← → shimmer',                  'Wind'],
  ['flowFrequency', 0.05, 4, 0.01, 'Wind scale',     'Big swirls ← → fine detail',         'Wind'],
  ['flowDrift',     0, 1,    0.01, 'Wind drift',     'How fast the pattern morphs',        'Wind'],
  ['flowInfluence', 0, 1,    0.01, 'Wind influence', 'Few particles react ← → all of them', 'Wind'],

  ['reach',         0.05, 3, 0.01, 'Swirl reach',    'Hugs the shape ← → long streamers',  'Stream'],
  ['escape',        0, 0.6,  0.005, 'Wind escape',   'How much peels off into the stream', 'Stream'],
  ['streamSpeed',   0, 4,    0.01, 'Stream speed',   'How far it carries them off-screen', 'Stream'],

  ['spring',        0.02, 12, 0.02, 'Elastic',       'Loose cloud ← → crisp sphere',       'Hold'],
  ['progress',      0, 1,    0.001, 'Assemble',      '1 = formed, 0 = dust',               'Hold'],

  ['mouseStrength', 0, 5,    0.01, 'Cursor push',    '',                                   'Cursor'],
  ['mouseRadius',   0.1, 3,  0.01, 'Cursor radius',  '',                                   'Cursor'],

  ['lifeSpeed',     0.05, 2, 0.01, 'Recycle speed',  'How fast dots fade + respawn',       'Dots'],
  ['size',          0.004, 0.12, 0.001, 'Dot size',  'Small stays crisp; big blooms',      'Dots'],
  ['glow',          0, 1.5,  0.01, 'Glow',           '',                                   'Dots'],
  ['depthFade',     0, 1,    0.01, 'Depth shading',  'Flat disc ← → round ball',           'Dots'],

  ['depth',         0, 0.8,  0.005, 'Thickness',     'Paper-flat ← → chunky 3D',           '3D'],
  ['lightAngle',    0, 360,  1,    'Light angle',    'Which way the light comes from',     '3D'],
  ['shadow',        0, 1,    0.01, 'Shadow depth',   'Flat lit ← → deep shadows',          '3D'],
];

// Preset = a set of slider positions I know reads nicely, plus its two colours.
export const PRESETS = {
  Smoke: {
    flowStrength: 1.05, flowFrequency: 0.35, flowDrift: 0.14, spring: 0.65,
    lifeSpeed: 0.45, size: 0.030, glow: 0.40, depthFade: 0.55,
    colA: '#8e8bff', colB: '#2a2f6b',
  },
  Shimmer: {
    flowStrength: 0.28, flowFrequency: 1.70, flowDrift: 0.35, spring: 4.5,
    lifeSpeed: 0.95, size: 0.018, glow: 0.62, depthFade: 0.90,
    colA: '#ffffff', colB: '#7ad7ff',
  },
  Crisp: {
    flowStrength: 0.10, flowFrequency: 2.60, flowDrift: 0.10, spring: 9.0,
    lifeSpeed: 1.20, size: 0.014, glow: 0.70, depthFade: 0.95,
    colA: '#fff4d6', colB: '#ff9d5c',
  },
  Chaos: {
    flowStrength: 2.40, flowFrequency: 0.80, flowDrift: 0.55, spring: 0.30,
    lifeSpeed: 0.32, size: 0.026, glow: 0.45, depthFade: 0.40,
    colA: '#ff5c8a', colB: '#5cffd4',
  },
  Nebula: {
    flowStrength: 0.50, flowFrequency: 0.22, flowDrift: 0.08, spring: 1.10,
    lifeSpeed: 0.35, size: 0.055, glow: 0.28, depthFade: 0.65,
    colA: '#c98cff', colB: '#2bd9ff',
  },
  Rain: {
    flowStrength: 0.75, flowFrequency: 3.40, flowDrift: 0.70, spring: 6.0,
    lifeSpeed: 1.55, size: 0.012, glow: 0.75, depthFade: 0.95,
    colA: '#e8ffff', colB: '#3b7bff',
  },

  // The editor's default: the built-in 3D X in hard white dots, held on a
  // slack elastic so the wind tears long shards off it. No glow at all — the
  // shape reads from the light and shadow on its extruded sides.
  Shards: {
    flowStrength: 2.00, flowFrequency: 0.50, flowDrift: 0.20,
    flowInfluence: 0.50, spring: 0.10, lifeSpeed: 0.40,
    mouseRadius: 1.00, mouseStrength: 3.00,
    size: 0.005, glow: 1.00, depthFade: 0.00,
    // A chunky extrusion is where the shard edges and shadowed sides come
    // from. Drop to ~0.18 for a slimmer letter.
    depth: 0.55, lightAngle: 135, shadow: 0.70,
    // An elastic this slack would let particles drift clean out of frame;
    // reach leashes them back in. Push it to 3.0 for the uncontained version.
    reach: 0.75,
    escape: 0.10, streamSpeed: 1.10,
    colA: '#ffffff', colB: '#ffffff',
    dotStyle: 'solid',
    shapeMode: 'x', shapeText: 'X',   // 'X' also fills the text box, so
                                      // switching to Text gives the same letter
    count: 256,   // 65,536
    origins: [],  // empty = wind everywhere
  },
};

/* WHERE DO THE SWIRLS START?
   The wind can be restricted to part of the shape instead of blowing on all of
   it. Any combination; an empty list means "everywhere", which is the unbiased
   behaviour. 'edges' follows the shape's
   OUTLINE, so on a letter you get swirls off the top of every stem. */
export const ORIGIN_KEYS = ['top', 'bottom', 'left', 'right', 'center', 'edges'];

// 'glow'  = soft dots that add their brightness together (our default look)
// 'solid' = hard-edged flat dots, normal blending
export const DOT_STYLES  = ['glow', 'solid'];
/* Built-in models (the X, plus anything brought in from Blender with
   scripts/import-model.mjs) are each a shape mode of their own. */
export const SHAPE_MODES = ['sphere', 'cube', ...MODEL_SHAPES.map((m) => m.mode), 'text', 'custom'];

/* Configs saved before the X became one of several built-in models called it
   'model'. Read that as the X rather than silently dropping to the sphere. */
const LEGACY_SHAPE_MODES = { model: 'x' };

// Texture resolution: the particle count is count*count, baked into the sim.
export const COUNTS   = [64, 128, 256, 512];
export const MAX_TEXT = 24;

export const RANGES = Object.freeze(Object.fromEntries(
  SLIDERS.map(([key, min, max, step]) => [key, Object.freeze({ min, max, step })])
));

/* The 17 saved numeric params, exactly as reference/particle-effect.html:340
   had them. `progress` is deliberately absent: it is live playback state that
   the engine owns (scroll-driven or fixed), not part of a saved look. The
   original excluded it from LOOK_DEFAULTS by destructuring for the same
   reason — here it simply never enters the config. */
const NUMERIC_DEFAULTS = {
  flowStrength : 0.55,  // how hard the invisible wind pushes
  flowFrequency: 0.90,  // wind scale: low = big lazy swirls, high = fine crackle
  flowDrift    : 0.20,  // how fast the wind pattern itself morphs over time
  flowInfluence: 0.70,  // what fraction of particles react to the wind at all
  reach        : 1.50,  // hard cap on how far a particle may stray from home
  escape       : 0.12,  // fraction let off the leash to stream away as wind
  streamSpeed  : 1.10,  // how hard the wind shoves them once they're loose
  spring       : 3.20,  // elastic pull home. high = crisp shape, low = loose cloud
  mouseStrength: 1.40,  // how hard your cursor shoves particles
  mouseRadius  : 0.90,  // size of the invisible bubble around your cursor
  lifeSpeed    : 0.55,  // how quickly dots recycle. high = twinklier
  size         : 0.022, // dot size. keep small — overlapping dots blow out
  glow         : 0.68,  // brightness. additive, so overlaps stack up
  depthFade    : 0.85,  // dims the far side so the ball looks round, not flat
  depth        : 0.18,  // how thick the letter is. 0 = paper-flat, no shards
  lightAngle   : 135,   // where the light comes from, in degrees
  shadow       : 0.75,  // how dark unlit faces go. 0 = no shading at all
};

export const NUMERIC_KEYS = Object.keys(NUMERIC_DEFAULTS);

export const DEFAULTS = Object.freeze({
  ...NUMERIC_DEFAULTS,
  colA: '#9d8cff', colB: '#4be3ff',
  dotStyle: 'glow',
  origins: Object.freeze([]),
  shapeMode: 'sphere', shapeText: 'HELLO', shapeModelUrl: '',
  count: 256,
});

export const CONFIG_KEYS = Object.keys(DEFAULTS);

const HEX = /^#[0-9a-f]{6}$/i;

function num(value, fallback, range) {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return range ? Math.min(range.max, Math.max(range.min, n)) : n;
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/** Merge a partial config over the defaults, coercing and clamping every key.
 *  Anything the partial does not mention is RESET to its default, never
 *  inherited from whatever was applied before — see REBUILD.md:144. Unknown
 *  keys are dropped, and every value is validated, so this doubles as the
 *  trust boundary for configs arriving from a URL or a pasted file. */
export function normalizeConfig(partial) {
  const input = partial && typeof partial === 'object' && !Array.isArray(partial)
    ? partial
    : {};
  const out = {};

  for (const key of NUMERIC_KEYS) {
    out[key] = num(input[key], DEFAULTS[key], RANGES[key]);
  }

  out.colA = HEX.test(input.colA) ? input.colA.toLowerCase() : DEFAULTS.colA;
  out.colB = HEX.test(input.colB) ? input.colB.toLowerCase() : DEFAULTS.colB;

  out.dotStyle  = oneOf(input.dotStyle,  DOT_STYLES,  DEFAULTS.dotStyle);
  out.shapeMode = oneOf(LEGACY_SHAPE_MODES[input.shapeMode] ?? input.shapeMode, SHAPE_MODES, DEFAULTS.shapeMode);

  out.origins = Array.isArray(input.origins)
    ? [...new Set(input.origins)].filter((k) => ORIGIN_KEYS.includes(k))
    : [];

  out.shapeText = typeof input.shapeText === 'string'
    ? input.shapeText.trim().slice(0, MAX_TEXT)
    : DEFAULTS.shapeText;

  // A URL to a model file — blob: for a local upload preview, http(s): once
  // hosted on a real site. No protocol allowlist beyond "it's a string": see
  // this function's own doc comment above about configs being a trust
  // boundary — the same reasoning that already applies to shapeText applies
  // here, and the model-loader that actually fetches this URL is what
  // enforces success/failure, not this validator.
  out.shapeModelUrl = typeof input.shapeModelUrl === 'string'
    ? input.shapeModelUrl.trim().slice(0, 2000)
    : DEFAULTS.shapeModelUrl;

  // Snap to the nearest allowed texture resolution; the sim bakes it in.
  const wanted = num(input.count, DEFAULTS.count);
  out.count = COUNTS.reduce(
    (best, c) => (Math.abs(c - wanted) < Math.abs(best - wanted) ? c : best),
    COUNTS[0]
  );

  return out;
}

/* Shape, text and particle count are your CONTENT, not part of a look. A
   preset describes how the dust behaves and what colour it is; it should not
   silently throw away the word you typed. See
   reference/particle-effect.html:1573-1580, where the original made the same
   distinction. */
export const CONTENT_KEYS = ['shapeMode', 'shapeText', 'shapeModelUrl', 'count'];

/* Shape identity specifically is never part of a look, full stop — unlike
   `count`, a preset naming a shapeMode of its own (Shards ships as
   shapeMode: 'x', shapeText: 'X') must not switch you onto it. That is
   only the right default for a fresh visit, which reaches PRESETS.Shards
   directly rather than through this function — see storage.js's
   loadInitialConfig(). */
const SHAPE_KEYS = ['shapeMode', 'shapeText', 'shapeModelUrl'];

/** Apply a preset or look on top of the current config.
 *
 *  Look keys the source does not mention are RESET to their defaults, so
 *  clicking a preset always lands in the same place regardless of what was
 *  selected before. Content keys the source does not mention are CARRIED OVER
 *  from the current config instead — and shape keys are carried over
 *  unconditionally, even if the source names one.
 *
 *  Use this for presets. Use normalizeConfig directly when loading a whole
 *  saved config, where nothing should carry over. */
export function applyLook(current, look) {
  const source = look && typeof look === 'object' ? look : {};
  const base = normalizeConfig(current);
  const carried = {};
  for (const key of CONTENT_KEYS) {
    if (SHAPE_KEYS.includes(key) || source[key] === undefined) carried[key] = base[key];
  }
  return normalizeConfig({ ...source, ...carried });
}

function valueEquals(a, b) {
  return Array.isArray(b) ? a.length === b.length && a.every((v, i) => v === b[i]) : a === b;
}

/** The inverse of normalizeConfig for storage: only the keys that differ from
 *  the defaults. Keeps share-URLs and embed snippets short and readable. */
export function diffConfig(config) {
  const full = normalizeConfig(config);
  const out = {};
  for (const key of CONFIG_KEYS) {
    if (!valueEquals(full[key], DEFAULTS[key])) out[key] = full[key];
  }
  return out;
}

/** Which preset's LOOK this config exactly matches, ignoring shape/text/model
 *  /count (content, not look) — or null if it matches none. A shared link
 *  carries no memory of "which preset got you here," but if its look is
 *  still byte-identical to one, the editor can show it as active anyway
 *  rather than looking like nothing is selected. */
export function matchingPreset(config) {
  const current = normalizeConfig(config);
  const lookKeys = CONFIG_KEYS.filter((key) => !CONTENT_KEYS.includes(key));
  return Object.keys(PRESETS).find((name) => {
    const candidate = applyLook(current, PRESETS[name]);
    return lookKeys.every((key) => valueEquals(current[key], candidate[key]));
  }) ?? null;
}

import { describe, it, expect } from 'vitest';
import {
  DEFAULTS, PRESETS, RANGES, normalizeConfig, diffConfig, applyLook, matchingPreset,
} from '../src/config.js';

describe('normalizeConfig', () => {
  it('reads the old shapeMode "model" as the built-in X', () => {
    expect(normalizeConfig({ shapeMode: 'model' }).shapeMode).toBe('x');
  });

  it('returns every default key when given nothing', () => {
    const c = normalizeConfig({});
    expect(Object.keys(c).sort()).toEqual(Object.keys(DEFAULTS).sort());
    expect(c).toEqual(DEFAULTS);
  });

  it('overlays supplied keys on top of the defaults', () => {
    expect(normalizeConfig({ spring: 5 }).spring).toBe(5);
    expect(normalizeConfig({ spring: 5 }).glow).toBe(DEFAULTS.glow);
  });

  // This is the LOOK_DEFAULTS rule from REBUILD.md:144 — a config never
  // inherits from whatever was applied before it.
  it('resets unmentioned keys rather than inheriting them', () => {
    const shards   = normalizeConfig(PRESETS.Shards);
    const smoke    = normalizeConfig(PRESETS.Smoke);
    expect(smoke.depth).toBe(DEFAULTS.depth);
    expect(smoke.depth).not.toBe(shards.depth);
  });

  it('clamps numbers to their slider range', () => {
    expect(normalizeConfig({ spring: 9999 }).spring).toBe(RANGES.spring.max);
    expect(normalizeConfig({ spring: -5 }).spring).toBe(RANGES.spring.min);
  });

  it('falls back to the default for a non-finite number', () => {
    expect(normalizeConfig({ spring: NaN }).spring).toBe(DEFAULTS.spring);
    expect(normalizeConfig({ spring: 'loud' }).spring).toBe(DEFAULTS.spring);
  });

  it('drops unknown keys', () => {
    expect(normalizeConfig({ nope: 1 })).not.toHaveProperty('nope');
  });

  // progress is playback state owned by the engine, not part of a saved look.
  it('drops progress', () => {
    expect(normalizeConfig({ progress: 0.5 })).not.toHaveProperty('progress');
  });

  it('validates enums and hex colours', () => {
    expect(normalizeConfig({ dotStyle: 'sparkly' }).dotStyle).toBe(DEFAULTS.dotStyle);
    expect(normalizeConfig({ shapeMode: 'pyramid' }).shapeMode).toBe(DEFAULTS.shapeMode);
    expect(normalizeConfig({ colA: 'red' }).colA).toBe(DEFAULTS.colA);
    expect(normalizeConfig({ colA: '#ABCDEF' }).colA).toBe('#abcdef');
  });

  it('snaps count to an allowed power of two', () => {
    expect(normalizeConfig({ count: 300 }).count).toBe(256);
    expect(normalizeConfig({ count: 99999 }).count).toBe(512);
  });

  it('keeps only known origins, deduped and ordered', () => {
    expect(normalizeConfig({ origins: ['top', 'nope', 'top', 'left'] }).origins)
      .toEqual(['top', 'left']);
    expect(normalizeConfig({ origins: 'top' }).origins).toEqual([]);
  });

  it('coerces shapeText to a trimmed string and caps its length', () => {
    expect(normalizeConfig({ shapeText: '  hi  ' }).shapeText).toBe('hi');
    expect(normalizeConfig({ shapeText: 'x'.repeat(80) }).shapeText.length).toBe(24);
  });

  it('tolerates being handed junk instead of an object', () => {
    for (const junk of [null, undefined, 42, 'nope', []]) {
      expect(() => normalizeConfig(junk)).not.toThrow();
    }
    expect(normalizeConfig(null)).toEqual(DEFAULTS);
  });

  it('does not mutate its input', () => {
    const input = { spring: 5 };
    normalizeConfig(input);
    expect(input).toEqual({ spring: 5 });
  });
});

describe('applyLook', () => {
  const start = normalizeConfig({
    shapeMode: 'text', shapeText: 'WAVE', count: 512, spring: 9, glow: 1.4,
  });

  // The rule from reference/particle-effect.html:1573-1580 — a preset that
  // does not name your shape must not throw it away.
  it('carries content over when the look does not mention it', () => {
    const next = applyLook(start, PRESETS.Smoke);
    expect(next.shapeMode).toBe('text');
    expect(next.shapeText).toBe('WAVE');
    expect(next.count).toBe(512);
  });

  it('still resets look keys the source does not mention', () => {
    const next = applyLook(start, PRESETS.Smoke);
    expect(next.spring).toBe(PRESETS.Smoke.spring);
    expect(next.depth).toBe(DEFAULTS.depth);   // Smoke says nothing about depth
    expect(next.reach).toBe(DEFAULTS.reach);
  });

  it('lets a look that names count override it, but never shape', () => {
    // Shards ships as shapeMode: 'text', shapeText: 'X' — that is only the
    // right default for a brand-new visit (see storage.js), never a reason
    // to replace whatever shape or word you're already on.
    const next = applyLook(start, PRESETS.Shards);
    expect(next.shapeMode).toBe('text');
    expect(next.shapeText).toBe('WAVE');
    expect(next.count).toBe(256);
  });

  it('is idempotent', () => {
    const once = applyLook(start, PRESETS.Chaos);
    expect(applyLook(once, PRESETS.Chaos)).toEqual(once);
  });

  it('does not let the previous look leak between presets', () => {
    const viaShards = applyLook(applyLook(start, PRESETS.Shards), PRESETS.Smoke);
    const direct = applyLook(applyLook(start, PRESETS.Shards), PRESETS.Smoke);
    expect(viaShards.spring).toBe(PRESETS.Smoke.spring);
    expect(viaShards.reach).toBe(DEFAULTS.reach); // not Shards' 0.75
    expect(viaShards).toEqual(direct);
  });

  it('tolerates junk for either argument', () => {
    expect(() => applyLook(null, null)).not.toThrow();
    expect(applyLook(null, null)).toEqual(DEFAULTS);
  });
});

describe('diffConfig', () => {
  it('is empty for the defaults', () => {
    expect(diffConfig(normalizeConfig({}))).toEqual({});
  });

  it('reports only what changed', () => {
    expect(diffConfig(normalizeConfig({ spring: 5 }))).toEqual({ spring: 5 });
  });

  it('compares origins by value, not identity', () => {
    expect(diffConfig(normalizeConfig({ origins: [] }))).toEqual({});
    expect(diffConfig(normalizeConfig({ origins: ['top'] }))).toEqual({ origins: ['top'] });
  });

  it('round-trips through normalizeConfig', () => {
    const c = normalizeConfig(PRESETS.Chaos);
    expect(normalizeConfig(diffConfig(c))).toEqual(c);
  });
});

describe('matchingPreset', () => {
  it('finds the preset a config was built from', () => {
    expect(matchingPreset(PRESETS.Smoke)).toBe('Smoke');
    expect(matchingPreset(PRESETS.Shards)).toBe('Shards');
  });

  it('still matches after only the shape/text/count changes underneath it', () => {
    // A shared link (or a live shape-chip switch, within a session) can carry
    // a different shape than the preset it was built from while the LOOK is
    // still exactly that preset's — the editor should keep showing it as
    // applied instead of nothing.
    const stillShards = { ...PRESETS.Shards, shapeMode: 'sphere', shapeText: 'HI', count: 64 };
    expect(matchingPreset(stillShards)).toBe('Shards');
  });

  it('returns null once an actual look value has been edited away', () => {
    expect(matchingPreset({ ...PRESETS.Smoke, spring: 9 })).toBeNull();
  });

  it('returns null for the untouched hard defaults', () => {
    expect(matchingPreset(normalizeConfig({}))).toBeNull();
  });
});

describe('PRESETS', () => {
  it('every preset normalizes without losing its declared values', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const c = normalizeConfig(preset);
      for (const [k, v] of Object.entries(preset)) {
        if (typeof v === 'number') expect(c[k], `${name}.${k}`).toBe(v);
      }
    }
  });

  it('every preset round-trips through diff', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const c = normalizeConfig(preset);
      expect(normalizeConfig(diffConfig(c)), name).toEqual(c);
    }
  });
});

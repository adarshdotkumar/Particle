import { describe, it, expect, beforeEach } from 'vitest';
import { customModelCache } from '../src/engine/shapes/custom-cache.js';
import { seedFromCustom } from '../src/engine/shapes/custom.js';
import { computeAreaCdf } from '../src/engine/shapes/mesh-sample.js';
import { writeBase } from '../src/engine/shapes/index.js';
import { normalizeConfig, SHAPE_MODES, DEFAULTS, CONTENT_KEYS } from '../src/config.js';

const TRIANGLE_POSITION = new Float32Array([
  -0.5, 0, 0,
   0.5, 0, 0,
   0,   1, 0,
]);
const TRIANGLE_INDEX = [0, 1, 2];
const TRIANGLE_NORMAL = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

function alloc(count) {
  return { data: new Float32Array(count * 4), normals: new Float32Array(count * 3), count };
}

describe('config: custom shape mode', () => {
  it('lists custom among SHAPE_MODES', () => {
    expect(SHAPE_MODES).toContain('custom');
  });

  it('defaults shapeModelUrl to an empty string', () => {
    expect(DEFAULTS.shapeModelUrl).toBe('');
  });

  it('treats shapeModelUrl as content, surviving a preset apply', () => {
    expect(CONTENT_KEYS).toContain('shapeModelUrl');
  });

  it('normalizeConfig accepts a custom shapeMode and a shapeModelUrl string', () => {
    const cfg = normalizeConfig({ shapeMode: 'custom', shapeModelUrl: 'blob:abc123' });
    expect(cfg.shapeMode).toBe('custom');
    expect(cfg.shapeModelUrl).toBe('blob:abc123');
  });

  it('falls back to the default shapeModelUrl for a non-string value', () => {
    const cfg = normalizeConfig({ shapeModelUrl: 42 });
    expect(cfg.shapeModelUrl).toBe('');
  });
});

describe('seedFromCustom', () => {
  beforeEach(() => {
    customModelCache.set('blob:test-mesh', {
      position: TRIANGLE_POSITION,
      normal: TRIANGLE_NORMAL,
      index: TRIANGLE_INDEX,
      areaCdf: computeAreaCdf(TRIANGLE_POSITION, TRIANGLE_INDEX),
      meshDepth: 0.2,
    });
  });

  it('returns false for a URL that was never cached', () => {
    const { data, normals, count } = alloc(16);
    expect(seedFromCustom(data, normals, count, 'blob:never-loaded', 0.1)).toBe(false);
  });

  it('seeds particles for a cached URL', () => {
    const { data, normals, count } = alloc(64);
    const done = seedFromCustom(data, normals, count, 'blob:test-mesh', 0.1);
    expect(done).toBe(true);
    expect([...data].every(Number.isFinite)).toBe(true);
  });
});

describe('writeBase with shapeMode custom', () => {
  it('falls back to the sphere when nothing is cached for the URL', () => {
    const { data, normals, count } = alloc(32);
    const config = normalizeConfig({ shapeMode: 'custom', shapeModelUrl: 'blob:missing' });
    writeBase({ data, normals, count, config });
    // Sphere shape: every point sits at radius 1.25 (see tests/shapes.test.js).
    const r = Math.hypot(data[0], data[1], data[2]);
    expect(r).toBeCloseTo(1.25, 3);
  });

  it('seeds from the cached mesh when the URL is loaded', () => {
    const { data, normals, count } = alloc(32);
    const config = normalizeConfig({ shapeMode: 'custom', shapeModelUrl: 'blob:test-mesh' });
    const bounds = writeBase({ data, normals, count, config });
    expect(bounds.size.every((n) => n > 0)).toBe(true);
  });
});

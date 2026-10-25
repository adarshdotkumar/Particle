import { describe, it, expect } from 'vitest';
import { seedFromSphere } from '../src/engine/shapes/sphere.js';
import { seedFromCube } from '../src/engine/shapes/cube.js';
import { seedFromText } from '../src/engine/shapes/text.js';
import { writeBase } from '../src/engine/shapes/index.js';
import { normalizeConfig } from '../src/config.js';
import { sampleMesh, computeAreaCdf, normalizeMeshArrays } from '../src/engine/shapes/mesh-sample.js';
import { customModelCache } from '../src/engine/shapes/custom-cache.js';
import { MODELS } from '../src/engine/shapes/models/index.js';
import { MODEL_SHAPES } from '../src/engine/shapes/models/catalog.js';

/* A thin box, 1 wide and 0.2 deep — a stand-in for any extruded mesh, so the
   depth maths can be checked against known numbers. */
const BOX_POSITION = new Float32Array([
  -0.5, -0.5, -0.1,   0.5, -0.5, -0.1,   0.5, 0.5, -0.1,   -0.5, 0.5, -0.1,
  -0.5, -0.5,  0.1,   0.5, -0.5,  0.1,   0.5, 0.5,  0.1,   -0.5, 0.5,  0.1,
]);
const BOX_INDEX = new Uint32Array([
  0, 2, 1, 0, 3, 2,   4, 5, 6, 4, 6, 7,   0, 1, 5, 0, 5, 4,
  2, 3, 7, 2, 7, 6,   1, 2, 6, 1, 6, 5,   0, 4, 7, 0, 7, 3,
]);
const BOX_NORMAL = new Float32Array([...BOX_POSITION].map((v, i) => (
  Math.sign(v) / Math.sqrt(3) // corner normals point diagonally outward
)));
const BOX = (() => {
  const { position, meshDepth } = normalizeMeshArrays(BOX_POSITION, BOX_INDEX);
  return { position, normal: BOX_NORMAL, index: BOX_INDEX, areaCdf: computeAreaCdf(position, BOX_INDEX), meshDepth };
})();

const alloc = (count) => ({
  data: new Float32Array(count * 4),
  normals: new Float32Array(count * 3),
  count,
});

describe('seedFromSphere', () => {
  it('fills every slot with a finite position', () => {
    const { data, normals, count } = alloc(1024);
    seedFromSphere(data, normals, count);
    expect([...data].every(Number.isFinite)).toBe(true);
    expect(data.some((v) => v !== 0)).toBe(true);
  });

  it('puts every point on the sphere of radius 1.25', () => {
    const { data, normals, count } = alloc(1024);
    seedFromSphere(data, normals, count);
    for (let i = 0; i < count; i++) {
      const r = Math.hypot(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      expect(r).toBeCloseTo(1.25, 3);
    }
  });

  it('writes unit normals', () => {
    const { data, normals, count } = alloc(256);
    seedFromSphere(data, normals, count);
    for (let i = 0; i < count; i++) {
      expect(Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]))
        .toBeCloseTo(1, 4);
    }
  });

  it('writes silhouette-ness into the 4th slot, in 0..1', () => {
    const { data, normals, count } = alloc(512);
    seedFromSphere(data, normals, count);
    for (let i = 0; i < count; i++) {
      expect(data[i * 4 + 3]).toBeGreaterThanOrEqual(0);
      expect(data[i * 4 + 3]).toBeLessThanOrEqual(1);
    }
  });

  it('survives a count of 1 without dividing by zero', () => {
    const { data, normals } = alloc(1);
    expect(() => seedFromSphere(data, normals, 1)).not.toThrow();
    expect([...data].every(Number.isFinite)).toBe(true);
  });
});

describe('seedFromCube', () => {
  it('fills every slot with a finite position', () => {
    const { data, normals, count } = alloc(1024);
    seedFromCube(data, normals, count);
    expect([...data].every(Number.isFinite)).toBe(true);
    expect(data.some((v) => v !== 0)).toBe(true);
  });

  it('puts every point on the surface of the cube (max |axis| = 1.25)', () => {
    const { data, normals, count } = alloc(1024);
    seedFromCube(data, normals, count);
    for (let i = 0; i < count; i++) {
      const [x, y, z] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
      expect(Math.max(Math.abs(x), Math.abs(y), Math.abs(z))).toBeCloseTo(1.25, 3);
    }
  });

  it('writes axis-aligned unit normals', () => {
    const { data, normals, count } = alloc(512);
    seedFromCube(data, normals, count);
    for (let i = 0; i < count; i++) {
      const [nx, ny, nz] = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6);
      // Exactly one axis is ±1, the other two are 0 — that's what makes it
      // axis-aligned rather than an arbitrary unit vector.
      expect([Math.abs(nx), Math.abs(ny), Math.abs(nz)].filter((v) => v > 1e-9)).toHaveLength(1);
    }
  });

  it('writes edge-closeness into the 4th slot, in 0..1', () => {
    const { data, normals, count } = alloc(512);
    seedFromCube(data, normals, count);
    for (let i = 0; i < count; i++) {
      expect(data[i * 4 + 3]).toBeGreaterThanOrEqual(0);
      expect(data[i * 4 + 3]).toBeLessThanOrEqual(1);
    }
  });

  it('uses all 6 faces, not just one', () => {
    const { data, normals, count } = alloc(600);
    seedFromCube(data, normals, count);
    const faces = new Set();
    for (let i = 0; i < count; i++) {
      const [nx, ny, nz] = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
      faces.add(`${nx},${ny},${nz}`);
    }
    expect(faces.size).toBe(6);
  });

  it('survives a count of 1 without throwing', () => {
    const { data, normals } = alloc(1);
    expect(() => seedFromCube(data, normals, 1)).not.toThrow();
    expect([...data].every(Number.isFinite)).toBe(true);
  });
});

describe('built-in X model', () => {
  const X = MODELS.x;

  it('is registered and listed in the catalog', () => {
    expect(X).toBeDefined();
    expect(MODEL_SHAPES.map((m) => m.mode)).toContain('x');
  });

  it('is a closed slab: 12-point outline, filled front and back, 12 sides', () => {
    expect(X.index).toHaveLength((10 + 10 + 12 * 2) * 3); // 44 triangles
    expect(X.position).toHaveLength((12 + 12 + 12 * 4) * 3);
  });

  it('is 1.0 wide and centred', () => {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < X.position.length; i += 3) {
      min = Math.min(min, X.position[i]);
      max = Math.max(max, X.position[i]);
    }
    expect(max - min).toBeCloseTo(1, 6);
    expect(min + max).toBeCloseTo(0, 6);
  });

  it('has a monotonic area CDF ending at exactly 1', () => {
    for (let i = 1; i < X.areaCdf.length; i++) {
      expect(X.areaCdf[i]).toBeGreaterThanOrEqual(X.areaCdf[i - 1]);
    }
    expect(X.areaCdf.at(-1)).toBeCloseTo(1, 6);
  });

  it('indexes only vertices that exist, with unit normals', () => {
    const vertices = X.position.length / 3;
    for (const idx of X.index) expect(idx).toBeLessThan(vertices);
    for (let i = 0; i < X.normal.length; i += 3) {
      expect(Math.hypot(X.normal[i], X.normal[i + 1], X.normal[i + 2])).toBeCloseTo(1, 6);
    }
  });

  it('seeds inside its bounds and honours depth', () => {
    const { data, normals, count } = alloc(4096);
    expect(sampleMesh(data, normals, count, X, 0.4)).toBe(true);
    let maxZ = 0;
    for (let i = 0; i < count; i++) {
      expect(Math.abs(data[i * 4])).toBeLessThanOrEqual(1.425 + 1e-6); // 2.85 wide
      maxZ = Math.max(maxZ, Math.abs(data[i * 4 + 2]));
    }
    expect(maxZ).toBeGreaterThan(0.18);
    expect(maxZ).toBeLessThanOrEqual(0.2 + 1e-6);
  });
});

describe('sampleMesh depth', () => {
  it('reports success and stays inside the fitted mesh bounds', () => {
    const { data, normals, count } = alloc(2048);
    expect(sampleMesh(data, normals, count, BOX, 0.55)).toBe(true);
    for (let i = 0; i < count; i++) {
      expect(Math.abs(data[i * 4])).toBeLessThan(3);     // 2.85 wide, so ±1.425
      expect(Math.abs(data[i * 4 + 2])).toBeLessThan(1); // extruded depth only
    }
  });

  it('extrudes further with a larger depth', () => {
    const spread = (depth) => {
      const { data, normals, count } = alloc(2048);
      sampleMesh(data, normals, count, BOX, depth);
      let max = 0;
      for (let i = 0; i < count; i++) max = Math.max(max, Math.abs(data[i * 4 + 2]));
      return max;
    };
    expect(spread(0.6)).toBeGreaterThan(spread(0.1));
  });

  it('honours the depth argument exactly: max |z| is depth/2', () => {
    const { data, normals, count } = alloc(4096);
    sampleMesh(data, normals, count, BOX, 0.4);
    let max = 0;
    for (let i = 0; i < count; i++) max = Math.max(max, Math.abs(data[i * 4 + 2]));
    expect(max).toBeGreaterThan(0.18); // sampling should reach near the faces
    expect(max).toBeLessThanOrEqual(0.2 + 1e-6);
  });

  it('writes unit normals', () => {
    const { data, normals, count } = alloc(512);
    sampleMesh(data, normals, count, BOX, 0.55);
    for (let i = 0; i < count; i++) {
      expect(Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]))
        .toBeCloseTo(1, 4);
    }
  });

  it('produces a flat sheet at depth 0', () => {
    const { data, normals, count } = alloc(512);
    sampleMesh(data, normals, count, BOX, 0);
    for (let i = 0; i < count; i++) expect(data[i * 4 + 2]).toBeCloseTo(0, 6);
  });
});

describe('seedFromText', () => {
  // Node has no canvas, so the guard must fire rather than throwing.
  it('declines cleanly when there is no document', () => {
    const { data, normals, count } = alloc(64);
    expect(seedFromText(data, normals, count, 'HI', 0.2)).toBe(false);
  });

  it('declines on empty text', () => {
    const { data, normals, count } = alloc(64);
    expect(seedFromText(data, normals, count, '   ', 0.2)).toBe(false);
  });
});

describe('writeBase', () => {
  it('falls back to the sphere for sphere mode', () => {
    const { data, normals, count } = alloc(512);
    const bounds = writeBase({ data, normals, count, config: normalizeConfig({}) });
    expect(bounds.size[0]).toBeCloseTo(2.5, 1);
    expect(bounds.size[1]).toBeCloseTo(2.5, 1);
  });

  it('falls back to the sphere when text mode has no canvas', () => {
    const { data, normals, count } = alloc(512);
    const config = normalizeConfig({ shapeMode: 'text', shapeText: 'HI' });
    const bounds = writeBase({ data, normals, count, config });
    expect(bounds.size[0]).toBeCloseTo(2.5, 1); // sphere, not text
  });

  it('uses the cube for cube mode', () => {
    const { data, normals, count } = alloc(512);
    const config = normalizeConfig({ shapeMode: 'cube' });
    const bounds = writeBase({ data, normals, count, config });
    // Cube spans -1.25..1.25 on every axis: size 2.5, same footprint as the
    // sphere's bounding box, but reached by flat faces instead of a curve.
    expect(bounds.size[0]).toBeCloseTo(2.5, 1);
    expect(bounds.size[1]).toBeCloseTo(2.5, 1);
    expect(bounds.size[2]).toBeCloseTo(2.5, 1);
  });

  it('uses the built-in mesh for x mode', () => {
    const { data, normals, count } = alloc(2048);
    const config = normalizeConfig({ shapeMode: 'x', depth: 0.55 });
    const bounds = writeBase({ data, normals, count, config });
    expect(bounds.size[2]).toBeLessThan(0.6);  // thin in z
    expect(bounds.size[0]).toBeGreaterThan(2); // wide in x
  });

  it('uses a loaded mesh for custom mode', () => {
    customModelCache.set('test:box', BOX);
    const { data, normals, count } = alloc(2048);
    const config = normalizeConfig({ shapeMode: 'custom', shapeModelUrl: 'test:box', depth: 0.55 });
    const bounds = writeBase({ data, normals, count, config });
    customModelCache.delete('test:box');
    expect(bounds.size[2]).toBeLessThan(0.6);  // thin in z
    expect(bounds.size[0]).toBeGreaterThan(2); // wide in x
  });

  it('never returns a zero-sized axis', () => {
    customModelCache.set('test:box', BOX);
    const { data, normals, count } = alloc(256);
    const config = normalizeConfig({ shapeMode: 'custom', shapeModelUrl: 'test:box', depth: 0 });
    const bounds = writeBase({ data, normals, count, config });
    customModelCache.delete('test:box');
    for (const s of bounds.size) expect(s).toBeGreaterThan(0);
  });

  it('returns bounds that actually contain every point', () => {
    const { data, normals, count } = alloc(512);
    const { min, size } = writeBase({ data, normals, count, config: normalizeConfig({}) });
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) {
        expect(data[i * 4 + a]).toBeGreaterThanOrEqual(min[a] - 1e-5);
        expect(data[i * 4 + a]).toBeLessThanOrEqual(min[a] + size[a] + 1e-5);
      }
    }
  });
});

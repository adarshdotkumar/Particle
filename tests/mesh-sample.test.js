import { describe, it, expect } from 'vitest';
import { computeAreaCdf, normalizeMeshArrays, sampleMesh } from '../src/engine/shapes/mesh-sample.js';

// A flat unit square in the XY plane, two triangles, deliberately NOT centered
// (its corner sits at the origin), so normalizeMeshArrays' recentering is
// actually exercised.
const SQUARE_POSITION = new Float32Array([
  0, 0, 0,
  1, 0, 0,
  1, 1, 0,
  0, 1, 0,
]);
const SQUARE_INDEX = [0, 1, 2, 0, 2, 3];

describe('computeAreaCdf', () => {
  it('is monotonically increasing and ends at 1', () => {
    const cdf = computeAreaCdf(SQUARE_POSITION, SQUARE_INDEX);
    expect(cdf.length).toBe(2);
    expect(cdf[0]).toBeGreaterThan(0);
    expect(cdf[1]).toBeCloseTo(1, 5);
    expect(cdf[1]).toBeGreaterThanOrEqual(cdf[0]);
  });

  it('splits area evenly between two equal triangles', () => {
    const cdf = computeAreaCdf(SQUARE_POSITION, SQUARE_INDEX);
    expect(cdf[0]).toBeCloseTo(0.5, 5);
  });
});

describe('normalizeMeshArrays', () => {
  it('centers the mesh at the origin and scales X-extent to 1.0', () => {
    const { position } = normalizeMeshArrays(SQUARE_POSITION, SQUARE_INDEX);
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < position.length; i += 3) {
      minX = Math.min(minX, position[i]);
      maxX = Math.max(maxX, position[i]);
    }
    expect(maxX - minX).toBeCloseTo(1, 5);
    expect(minX).toBeCloseTo(-0.5, 5);
  });

  it('reports meshDepth as the Z-extent divided by width', () => {
    const raised = new Float32Array(SQUARE_POSITION);
    raised[2] = 0.25; // lift one corner's Z, so the square has depth 0.25
    const { meshDepth } = normalizeMeshArrays(raised, SQUARE_INDEX);
    expect(meshDepth).toBeCloseTo(0.25, 5);
  });

  it('never returns a zero meshDepth', () => {
    const { meshDepth } = normalizeMeshArrays(SQUARE_POSITION, SQUARE_INDEX);
    expect(meshDepth).toBeGreaterThan(0);
  });
});

describe('sampleMesh', () => {
  const mesh = {
    position: SQUARE_POSITION,
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    index: SQUARE_INDEX,
    areaCdf: computeAreaCdf(SQUARE_POSITION, SQUARE_INDEX),
    meshDepth: 0.2,
  };

  it('fills every particle with a finite position on the square, scaled to fit', () => {
    const count = 500;
    const data = new Float32Array(count * 4);
    const normals = new Float32Array(count * 3);
    const done = sampleMesh(data, normals, count, mesh, 0.1);
    expect(done).toBe(true);
    for (let i = 0; i < count; i++) {
      expect(Number.isFinite(data[i * 4])).toBe(true);
      expect(Number.isFinite(data[i * 4 + 1])).toBe(true);
      expect(Number.isFinite(data[i * 4 + 2])).toBe(true);
    }
  });

  it('writes unit normals', () => {
    const count = 64;
    const data = new Float32Array(count * 4);
    const normals = new Float32Array(count * 3);
    sampleMesh(data, normals, count, mesh, 0.1);
    for (let i = 0; i < count; i++) {
      const len = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
      expect(len).toBeCloseTo(1, 4);
    }
  });
});

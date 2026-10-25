/* Shared triangle-sampling math for any shape backed by real mesh geometry —
 * the built-in models (models/) and an uploaded model (custom.js) both call
 * sampleMesh with their own {position, normal, index, areaCdf, meshDepth}. Three.js-free by design, same as every
 * other file in this directory, so it stays unit-testable in plain Node. */

const TEXT_WIDTH = 2.85; // world units a "1.0 wide" mesh is scaled to

/** Running total of triangle area, normalized to end at 1 — lets sampleMesh
 *  pick a triangle in proportion to its area via binary search. */
export function computeAreaCdf(position, index) {
  const triCount = index.length / 3;
  const cdf = new Float32Array(triCount);
  let total = 0;

  for (let t = 0; t < triCount; t++) {
    const a = index[t * 3 + 0] * 3;
    const b = index[t * 3 + 1] * 3;
    const c = index[t * 3 + 2] * 3;

    const abx = position[b] - position[a];
    const aby = position[b + 1] - position[a + 1];
    const abz = position[b + 2] - position[a + 2];
    const acx = position[c] - position[a];
    const acy = position[c + 1] - position[a + 1];
    const acz = position[c + 2] - position[a + 2];

    total += 0.5 * Math.hypot(
      aby * acz - abz * acy,
      abz * acx - abx * acz,
      abx * acy - aby * acx
    );
    cdf[t] = total;
  }

  for (let t = 0; t < triCount; t++) cdf[t] = total > 0 ? cdf[t] / total : (t + 1) / triCount;
  return cdf;
}

/** Recenters an arbitrary mesh at the origin and scales it so its X-extent is
 *  1.0 — matching the "mesh is 1.0 wide" assumption sampleMesh relies on.
 *  meshDepth is the Z-extent as a fraction of that width. */
export function normalizeMeshArrays(position, index) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  const width = Math.max(maxX - minX, 1e-4);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const out = new Float32Array(position.length);
  for (let i = 0; i < position.length; i += 3) {
    out[i]     = (position[i]     - centerX) / width;
    out[i + 1] = (position[i + 1] - centerY) / width;
    out[i + 2] = (position[i + 2] - centerZ) / width;
  }

  return { position: out, meshDepth: Math.max((maxZ - minZ) / width, 1e-4) };
}

/** Scatter points over a mesh's surface, weighted by triangle area — the same
 *  idea as the sphere and the letters, just reading from real triangles.
 *  `mesh` is normalized already (see normalizeMeshArrays): 1.0 wide, centered
 *  at the origin. `index` may be a plain array or a typed array. */
export function sampleMesh(data, normals, count, mesh, depth) {
  const { position, normal, index, areaCdf, meshDepth } = mesh;
  const fit    = TEXT_WIDTH;
  const zScale = depth / meshDepth;

  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;

    const r = Math.random();
    let lo = 0, hi = areaCdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (areaCdf[mid] < r) lo = mid + 1; else hi = mid;
    }

    const a = index[lo * 3 + 0] * 3;
    const b = index[lo * 3 + 1] * 3;
    const c = index[lo * 3 + 2] * 3;

    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;

    data[i4 + 0] = (position[a]     * w + position[b]     * u + position[c]     * v) * fit;
    data[i4 + 1] = (position[a + 1] * w + position[b + 1] * u + position[c + 1] * v) * fit;
    data[i4 + 2] = (position[a + 2] * w + position[b + 2] * u + position[c + 2] * v) * zScale;

    const nx = normal[a]     * w + normal[b]     * u + normal[c]     * v;
    const ny = normal[a + 1] * w + normal[b + 1] * u + normal[c + 1] * v;
    const nz = normal[a + 2] * w + normal[b + 2] * u + normal[c + 2] * v;

    const len = Math.hypot(nx, ny, nz) || 1;
    normals[i3 + 0] = nx / len;
    normals[i3 + 1] = ny / len;
    normals[i3 + 2] = nz / len;

    data[i4 + 3] = 1 - Math.abs(nz / len);
  }
  return true;
}

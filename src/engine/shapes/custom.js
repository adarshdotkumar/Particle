import { customModelCache } from './custom-cache.js';
import { sampleMesh } from './mesh-sample.js';

/** Seeds particles from a user-uploaded model, if it's been loaded into the
 *  cache already (see model-loader.js). Returns false — same as an unusable
 *  text shape — when the URL isn't cached yet, so writeBase falls back to the
 *  sphere instead of seeding garbage. */
export function seedFromCustom(data, normals, count, url, depth) {
  const mesh = customModelCache.get(url);
  if (!mesh) return false;
  return sampleMesh(data, normals, count, mesh, depth);
}

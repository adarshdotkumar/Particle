import { customModelCache } from './shapes/custom-cache.js';
import { normalizeMeshArrays, computeAreaCdf } from './shapes/mesh-sample.js';
import { parseGltf } from './gltf.js';

// Loads in flight, by URL, so two fields asking for the same model share one
// fetch instead of each starting their own.
const pending = new Map();

const fetchBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.arrayBuffer();
};

/** Loads a .glb/.gltf at `url` and caches its normalized, sample-ready mesh
 *  arrays under that same URL, so custom.js's seedFromCustom can read them
 *  synchronously afterward. ParticleField calls this itself for a 'custom'
 *  shape and re-seeds when it resolves; calling it first just means the
 *  model is there on the very first frame instead of a moment later.
 *  Resolves immediately (no re-fetch) if the URL is already cached. */
export function loadCustomModel(url) {
  if (customModelCache.has(url)) return Promise.resolve();
  if (pending.has(url)) return pending.get(url);

  const load = (async () => {
    const bytes = await fetchBytes(url);
    // A .gltf's separate .bin is fetched relative to the .gltf itself.
    const merged = await parseGltf(bytes, (uri) => fetchBytes(new URL(uri, new URL(url, location.href)).href));
    const { position, meshDepth } = normalizeMeshArrays(merged.position, merged.index);
    const areaCdf = computeAreaCdf(position, merged.index);
    customModelCache.set(url, {
      position, normal: merged.normal, index: merged.index, areaCdf, meshDepth,
    });
  })().finally(() => pending.delete(url));

  pending.set(url, load);
  return load;
}

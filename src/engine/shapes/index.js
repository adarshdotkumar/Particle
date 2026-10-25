/* Shape dispatch — adapted from reference/particle-effect.html:1248-1273.
 *
 * One documented change from the original: writeBase used to mutate a
 * module-global `shapeBounds` made of THREE.Vector3s. It now RETURNS plain
 * arrays instead, which keeps this whole directory free of a three import and
 * makes the bounds unit-testable in Node.
 */
import { seedFromSphere } from './sphere.js';
import { seedFromCube }   from './cube.js';
import { seedFromText }   from './text.js';
import { seedFromCustom } from './custom.js';
import { sampleMesh }     from './mesh-sample.js';
import { MODELS }         from './models/index.js';

export { seedFromSphere, seedFromCube, seedFromText, seedFromCustom };

/** Seeds every particle's "home spot" and surface normal for the given shape,
 *  then measures the result so the swirl-origin masks know where "top" is.
 *
 *  Unusable text (empty, or no canvas available) falls back to the sphere,
 *  exactly as the original did.
 *
 *  @returns {{min: number[], size: number[]}} bounding box, as [x, y, z] arrays
 */
export function writeBase({ data, normals, count, config }) {
  let done = false;
  const model = MODELS[config.shapeMode];
  if (model) {
    done = sampleMesh(data, normals, count, model, config.depth);
  }
  if (!done && config.shapeMode === 'custom') {
    done = seedFromCustom(data, normals, count, config.shapeModelUrl, config.depth);
  }
  if (!done && config.shapeMode === 'text') {
    done = seedFromText(data, normals, count, config.shapeText, config.depth);
  }
  if (!done && config.shapeMode === 'cube') {
    seedFromCube(data, normals, count);
    done = true;
  }
  if (!done) seedFromSphere(data, normals, count);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    for (let a = 0; a < 3; a++) {
      const v = data[i4 + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }

  return {
    min,
    // Never zero: a flat shape would divide by zero in the origin masks.
    size: [
      Math.max(max[0] - min[0], 1e-4),
      Math.max(max[1] - min[1], 1e-4),
      Math.max(max[2] - min[2], 1e-4),
    ],
  };
}

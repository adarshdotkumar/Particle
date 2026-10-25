import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';

/* A small glTF 2.0 reader that keeps only what becomes dots: triangles,
 * their normals, and the node transforms that place them.
 *
 * One reader for both places a model comes in — the engine loading a
 * `shapeModelUrl` at runtime (model-loader.js) and the Blender import that
 * bakes a model into the code (scripts/lib/model-import.mjs) — so a file
 * either works in both or fails in both, with the same message. It is a few
 * kB instead of three's full GLTFLoader, which would add ~28 kB gzipped to
 * every embed for materials, textures and animation this never uses.
 *
 * Supported: .glb and .gltf (embedded or external buffers), indexed or not,
 * any node hierarchy. Not supported: Draco/meshopt compression and sparse
 * accessors — both get a clear error instead of a wrong shape. */

/** A problem with the file the person can fix — the message says how. */
export class GltfError extends Error {}
const fail = (message) => { throw new GltfError(message); };

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const view = (bytes) => (bytes instanceof ArrayBuffer
  ? new DataView(bytes)
  : new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));

function decodeDataUri(uri) {
  const binary = atob(uri.slice(uri.indexOf(',') + 1));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** @param bytes       the file, as an ArrayBuffer or Uint8Array
 *  @param loadBuffer  async (uri) => ArrayBuffer|Uint8Array, for a .gltf whose
 *                     data lives in a separate .bin; omit to refuse those */
async function readFile(bytes, loadBuffer) {
  const data = view(bytes);
  if (data.byteLength >= 12 && data.getUint32(0, true) === GLB_MAGIC) {
    let json = null;
    let bin = null;
    let offset = 12;
    while (offset + 8 <= data.byteLength) {
      const length = data.getUint32(offset, true);
      const type = data.getUint32(offset + 4, true);
      const chunk = new Uint8Array(data.buffer, data.byteOffset + offset + 8, length);
      if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk));
      if (type === CHUNK_BIN) bin = chunk;
      offset += 8 + length;
    }
    if (!json) fail('That .glb has no JSON chunk — is it a valid glTF binary?');
    return { json, buffers: [bin] };
  }

  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));
  } catch {
    fail("That isn't a glTF file. Export from Blender as glTF Binary (.glb).");
  }
  const buffers = await Promise.all((json.buffers ?? []).map(async ({ uri }) => {
    if (uri?.startsWith('data:')) return decodeDataUri(uri);
    if (!loadBuffer) fail('This .gltf keeps its data in a separate file. Export as glTF Binary (.glb) instead.');
    const loaded = await loadBuffer(uri);
    return loaded instanceof ArrayBuffer ? new Uint8Array(loaded) : loaded;
  }));
  return { json, buffers };
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
// componentType -> [DataView getter, byte size, max value for normalized ints]
const READERS = {
  5120: ['getInt8', 1, 127],
  5121: ['getUint8', 1, 255],
  5122: ['getInt16', 2, 32767],
  5123: ['getUint16', 2, 65535],
  5125: ['getUint32', 4, 0],
  5126: ['getFloat32', 4, 0],
};

function readAccessor({ json, buffers }, index) {
  const accessor = json.accessors[index];
  if (accessor.sparse) fail('Sparse accessors are not supported. Re-export without them.');
  const bufferView = json.bufferViews[accessor.bufferView];
  const data = view(buffers[bufferView.buffer]);
  const [getter, size, max] = READERS[accessor.componentType];
  const components = COMPONENTS[accessor.type];
  const stride = bufferView.byteStride || size * components;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  const out = new Array(accessor.count * components);
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < components; c++) {
      let value = data[getter](start + i * stride + c * size, true);
      if (accessor.normalized && max) value = Math.max(value / max, -1);
      out[i * components + c] = value;
    }
  }
  return out;
}

function localMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(
    new Vector3(...(node.translation ?? [0, 0, 0])),
    new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
    new Vector3(...(node.scale ?? [1, 1, 1])),
  );
}

/** Vertex normals averaged from face normals, for exports that left them out. */
function faceNormals(pos, idx) {
  const out = new Array(pos.length).fill(0);
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromArray(pos, idx[t] * 3);
    b.fromArray(pos, idx[t + 1] * 3);
    c.fromArray(pos, idx[t + 2] * 3);
    const face = b.clone().sub(a).cross(c.clone().sub(a));
    for (const i of [idx[t], idx[t + 1], idx[t + 2]]) {
      out[i * 3] += face.x; out[i * 3 + 1] += face.y; out[i * 3 + 2] += face.z;
    }
  }
  return out;
}

/** Every triangle in the file's default scene, in world space, merged into
 *  one set of arrays.
 *  @returns {Promise<{ position: Float32Array, normal: Float32Array,
 *                      index: Uint32Array, skipped: number }>}
 *           skipped = primitives ignored for being lines or points */
export async function parseGltf(bytes, loadBuffer) {
  const gltf = await readFile(bytes, loadBuffer);
  const { json } = gltf;
  const compressed = (json.extensionsUsed ?? []).filter((e) => /draco|meshopt/i.test(e));
  if (compressed.length) {
    fail(`This file is compressed (${compressed.join(', ')}). In Blender's glTF export, turn Compression off and export again.`);
  }

  const position = [];
  const normal = [];
  const index = [];
  let skipped = 0;
  const v = new Vector3();
  const n = new Vector3();

  const visit = (nodeIndex, parent) => {
    const node = json.nodes[nodeIndex];
    const world = parent.clone().multiply(localMatrix(node));

    if (node.mesh !== undefined) {
      const normalMatrix = new Matrix3().getNormalMatrix(world);
      for (const primitive of json.meshes[node.mesh].primitives) {
        if ((primitive.mode ?? 4) !== 4 || primitive.attributes.POSITION === undefined) {
          skipped++;
          continue;
        }
        const pos = readAccessor(gltf, primitive.attributes.POSITION);
        const idx = primitive.indices !== undefined
          ? readAccessor(gltf, primitive.indices)
          : Array.from({ length: pos.length / 3 }, (_, i) => i);
        const nor = primitive.attributes.NORMAL !== undefined
          ? readAccessor(gltf, primitive.attributes.NORMAL)
          : faceNormals(pos, idx);
        const base = position.length / 3;

        for (let i = 0; i < pos.length / 3; i++) {
          v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(world);
          position.push(v.x, v.y, v.z);
          n.set(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]).applyMatrix3(normalMatrix).normalize();
          normal.push(n.x, n.y, n.z);
        }
        for (const i of idx) index.push(base + i);
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };

  const scene = json.scenes?.[json.scene ?? 0];
  const roots = scene ? scene.nodes : (json.nodes ?? []).map((_, i) => i);
  for (const root of roots) visit(root, new Matrix4());

  if (index.length === 0) fail('No triangle geometry found in that file.');
  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint32Array(index),
    skipped,
  };
}

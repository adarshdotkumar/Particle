import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGltf, GltfError } from '../src/engine/gltf.js';

const FIXTURE = readFileSync(fileURLToPath(new URL('./e2e/fixtures/triangle.gltf', import.meta.url)));
const fixtureJson = () => JSON.parse(FIXTURE.toString('utf8'));
const encode = (json) => new TextEncoder().encode(JSON.stringify(json));

/** Repack a .gltf with an embedded buffer as a binary .glb. */
function toGlb(json) {
  const copy = structuredClone(json);
  const uri = copy.buffers[0].uri;
  delete copy.buffers[0].uri;
  const bin = Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const pad = (bytes, fill) => {
    const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
    out.set(bytes);
    return out;
  };
  const jsonChunk = pad(new TextEncoder().encode(JSON.stringify(copy)), 0x20);
  const binChunk = pad(bin, 0);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  view.setUint32(20 + jsonChunk.length, binChunk.length, true);
  view.setUint32(24 + jsonChunk.length, 0x004e4942, true);
  out.set(binChunk, 28 + jsonChunk.length);
  return out;
}

describe('parseGltf', () => {
  it('reads a .gltf with an embedded buffer', async () => {
    const mesh = await parseGltf(FIXTURE);
    expect([...mesh.position]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect([...mesh.index]).toEqual([0, 1, 2]);
    expect(mesh.skipped).toBe(0);
  });

  it('reads the same model packed as a .glb', async () => {
    const mesh = await parseGltf(toGlb(fixtureJson()));
    expect([...mesh.position]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  it('computes unit normals when the export left them out', async () => {
    const { normal } = await parseGltf(FIXTURE);
    for (let i = 0; i < normal.length; i += 3) {
      expect([normal[i], normal[i + 1], normal[i + 2]]).toEqual([0, 0, 1]);
    }
  });

  it('applies node transforms', async () => {
    const json = fixtureJson();
    json.nodes = [{ children: [1], translation: [10, 0, 0] }, { mesh: 0, scale: [2, 2, 2] }];
    json.scenes = [{ nodes: [0] }];
    const { position } = await parseGltf(encode(json));
    expect([...position]).toEqual([10, 0, 0, 12, 0, 0, 10, 2, 0]);
  });

  it('skips lines and points but keeps the triangles', async () => {
    const json = fixtureJson();
    json.meshes[0].primitives.push({ attributes: { POSITION: 0 }, mode: 1 });
    expect((await parseGltf(encode(json))).skipped).toBe(1);
  });

  it('explains a compressed export instead of mangling it', async () => {
    const json = { ...fixtureJson(), extensionsUsed: ['KHR_draco_mesh_compression'] };
    await expect(parseGltf(encode(json))).rejects.toThrow(/turn Compression off/);
  });

  it('asks for a .glb when the data lives in a separate file it cannot reach', async () => {
    const json = fixtureJson();
    json.buffers[0].uri = 'model.bin';
    await expect(parseGltf(encode(json))).rejects.toBeInstanceOf(GltfError);
  });

  it('loads an external buffer when given a way to', async () => {
    const json = fixtureJson();
    const data = json.buffers[0].uri;
    json.buffers[0].uri = 'model.bin';
    const bin = Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    const mesh = await parseGltf(encode(json), async (uri) => (uri === 'model.bin' ? bin : null));
    expect(mesh.index).toHaveLength(3);
  });

  it('rejects a file with no triangles, and one that is not glTF at all', async () => {
    await expect(parseGltf(encode({ asset: { version: '2.0' }, scenes: [{ nodes: [] }] })))
      .rejects.toThrow(/No triangle geometry/);
    await expect(parseGltf(new TextEncoder().encode('not a model'))).rejects.toThrow(/isn't a glTF file/);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Runs the real CLI against the glTF fixture, into a scratch folder, and
 * checks the module it writes is what the engine expects of a model. */
const SCRIPT = fileURLToPath(new URL('../scripts/import-model.mjs', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./e2e/fixtures/triangle.gltf', import.meta.url));

describe('scripts/import-model.mjs', () => {
  let dir;
  const run = (...args) => execFileSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, PF_MODELS_DIR: dir },
    encoding: 'utf8',
    stdio: 'pipe',
  });

  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'pf-models-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes a normalised model module with its label', async () => {
    run(FIXTURE, '--name', 'tri', '--label', 'Triangle');
    const mod = await import(pathToFileURL(join(dir, 'tri.js')).href);
    expect(mod.meta).toEqual({ label: 'Triangle', note: 'Blender' });
    expect(mod.default.position).toHaveLength(9);
    expect(mod.default.index).toEqual([0, 1, 2]);
    expect(mod.default.normal).toHaveLength(9);
    const xs = [0, 3, 6].map((i) => mod.default.position[i]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 4);
    expect(mod.default.meshDepth).toBeGreaterThan(0);
  });

  it('registers the model in the generated index and catalog', () => {
    expect(readFileSync(join(dir, 'catalog.js'), 'utf8'))
      .toContain("{ mode: 'tri', label: 'Triangle', note: 'Blender' }");
    expect(readFileSync(join(dir, 'index.js'), 'utf8')).toContain("'tri': withCdf(model_tri)");
  });

  it('refuses a name that is already a shape', () => {
    expect(() => run(FIXTURE, '--name', 'sphere')).toThrow(/already a built-in shape/);
    expect(() => run(FIXTURE, '--name', 'x')).toThrow(/already a built-in shape/);
    expect(existsSync(join(dir, 'sphere.js'))).toBe(false);
  });

  it('removes an imported model and unregisters it', () => {
    run('--remove', 'tri');
    expect(existsSync(join(dir, 'tri.js'))).toBe(false);
    expect(readFileSync(join(dir, 'catalog.js'), 'utf8')).not.toContain("'tri'");
  });
});

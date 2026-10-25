#!/usr/bin/env node
/* Turn a model exported from Blender into a built-in shape, from the command
 * line. The editor's "Save as shape" button does the same thing; the real
 * work for both lives in scripts/lib/model-import.mjs.
 *
 *   npm run import-model -- path/to/logo.glb --name logo --label "Logo"
 *   npm run import-model -- --remove logo
 *   npm run import-model -- --sync          # after deleting a model file by hand
 */
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import {
  MODELS_DIR, ModelImportError, importModel, removeModel, syncModels, slugify,
} from './lib/model-import.mjs';

// PF_MODELS_DIR is only for the tests, which import into a scratch folder.
const dir = process.env.PF_MODELS_DIR ?? MODELS_DIR;
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

try {
  if (args.includes('--sync')) {
    console.log(`  ✓ models registered: ${(await syncModels(dir)).join(', ')}`);
  } else if (args.includes('--remove')) {
    const names = await removeModel(flag('remove'), dir);
    console.log(`  ✓ removed "${flag('remove')}" — models registered: ${names.join(', ')}`);
  } else {
    const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
    if (!file) {
      throw new ModelImportError('Usage: npm run import-model -- path/to/model.glb --name logo [--label "Logo"] [--note Blender]');
    }
    const path = resolve(file);
    const result = await importModel({
      bytes: await readFile(path),
      baseDir: dirname(path),
      sourceName: basename(path),
      name: flag('name') ?? slugify(basename(path)),
      label: flag('label'),
      note: flag('note') ?? 'Blender',
      dir,
    });
    console.log(`  ✓ ${result.name}.js — ${result.vertices} vertices, ${result.triangles} triangles, ${result.kB} kB`);
    for (const warning of result.warnings) console.warn(`  ! ${warning}`);
    console.log(`\n  Done. Look for the "${result.label}" chip in the editor (npm run dev).\n`);
  }
} catch (error) {
  if (!(error instanceof ModelImportError)) throw error;
  console.error(`\n  ✗ ${error.message}\n`);
  process.exit(1);
}

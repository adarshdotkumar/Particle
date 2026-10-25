import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/* Builds the editor into ONE html file that runs from file:// with no server
 * and no network. This is how a designer gets the tool: download, double-click.
 *
 * The original demo had this property deliberately (REBUILD.md:94) — it inlined
 * three.js so the file worked straight off disk. Extracting a proper package
 * lost it; this build restores it as an artifact rather than as the source.
 *
 * `root` is src/editor so the emitted file lands at dist-editor/index.html
 * instead of dist-editor/src/editor/index.html; scripts/rename-editor.mjs then
 * gives it a name a designer will recognise in their Downloads folder. */
export default defineConfig({
  root: 'src/editor',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../../dist-editor',
    emptyOutDir: true,
    // Everything inline: no separate js, css or asset requests.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    target: 'es2020',
    // No rollupOptions.input: it would resolve against the CWD rather than
    // `root`. With root set, vite already uses <root>/index.html.
  },
});

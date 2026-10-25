import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Three builds from one source, selected by BUILD_TARGET:
 *
 *   (default)   dist/particle-field.js
 *               ESM, `three` externalized as a peer dependency. For anyone with
 *               a bundler. Shipping a second copy of three to a React app is
 *               the real performance disaster, so this build exists to stop it.
 *
 *   standalone  dist/particle-field.min.js
 *               IIFE, three bundled, auto-mounts [data-particle-field]. One
 *               script tag, no import map, no chance of clashing with whatever
 *               three the host page already has. This is what the copy-paste
 *               snippet loads, and what jsDelivr serves.
 *
 *   react       dist/particle-field-react.js
 *               ESM, `react` and `three` both external. Built rather than
 *               shipped as .jsx because consumers' bundlers do not compile JSX
 *               inside node_modules.
 */
const target = process.env.BUILD_TARGET ?? 'esm';

const TARGETS = {
  esm: {
    entry: 'src/index.js',
    fileName: 'particle-field.js',
    formats: ['es'],
    external: ['three'],
    minify: false,
  },
  standalone: {
    entry: 'src/standalone.js',
    fileName: 'particle-field.min.js',
    formats: ['iife'],
    external: [],
    minify: 'esbuild',
  },
  react: {
    entry: 'src/react.jsx',
    fileName: 'particle-field-react.js',
    formats: ['es'],
    external: ['react', 'react-dom', 'react/jsx-runtime', 'three'],
    minify: false,
  },
};

const config = TARGETS[target];
if (!config) throw new Error(`Unknown BUILD_TARGET: ${target}`);

export default defineConfig({
  // Needed only for the react target; harmless for the others.
  plugins: target === 'react' ? [react()] : [],
  build: {
    emptyOutDir: false,
    lib: {
      entry: config.entry,
      name: 'ParticleField',
      formats: config.formats,
      fileName: () => config.fileName,
    },
    // A listed package is external along with its subpaths, so the glTF
    // loader (three/examples/jsm/...) comes from the consumer's own three too.
    rollupOptions: {
      external: (id) => config.external.some((pkg) => id === pkg || id.startsWith(`${pkg}/`)),
    },
    minify: config.minify,
    target: 'es2020',
  },
});

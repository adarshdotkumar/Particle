import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ModelImportError, importModel, removeModel } from './scripts/lib/model-import.mjs';

/* Dev server only. The package root is the server root, so the editor and the
 * e2e fixtures can import /src/index.js directly and get `three` resolved out
 * of node_modules with no import map.
 *
 * There is deliberately no `build` block here: the two artifacts have their own
 * configs (vite.lib.config.js, vite.editor.config.js), and a half-configured
 * one would send a bare `vite build` looking for an index.html at the package
 * root that does not exist.
 *
 * Port 5199 is pinned — playwright.config.js and the e2e fixtures rely on it. */
export default defineConfig({
  root: '.',
  // react(): only so the React binding and its e2e fixture can be exercised in
  // dev. React is a devDependency and an optional peer — it is not in any build.
  server: { port: 5199, open: '/src/editor/index.html' },
  // There is no index.html at the package root, so a bare http://localhost:5199/
  // is a blank 404. Send it to the editor instead of nothing.
  plugins: [react(), {
    name: 'root-to-editor',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/') { res.writeHead(302, { Location: '/src/editor/index.html' }); return res.end(); }
        next();
      });
    },
  }, saveShapes()],
});

/* The editor's "Save as shape" button. Running locally, an uploaded .glb can
 * be written into the code as a built-in shape — the same thing
 * `npm run import-model` does — so it gets a permanent chip, ships in your
 * builds, and works in every embed made from them.
 *
 *   POST   /__particle-field/models?name=logo&label=Logo&source=logo.glb  (body: the file)
 *   DELETE /__particle-field/models/logo
 *
 * Dev server only: there is no server behind the single-file editor, so the
 * button is hidden there. Requests must carry the X-Particle-Field header —
 * a custom header no other website can send cross-origin without a CORS
 * preflight this server never approves, so a page you happen to visit can't
 * write into your repo. */
function saveShapes() {
  const PREFIX = '/__particle-field/models';
  const MAX_BYTES = 50 * 1024 * 1024;

  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) reject(new ModelImportError('That file is over 50 MB — decimate it in Blender first.'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  return {
    name: 'particle-field-save-shapes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(PREFIX, async (req, res) => {
        if (req.headers['x-particle-field'] !== '1') return send(res, 403, { error: 'Forbidden' });
        try {
          const url = new URL(req.url, 'http://localhost');
          if (req.method === 'POST' && url.pathname === '/') {
            const result = await importModel({
              bytes: await readBody(req),
              sourceName: url.searchParams.get('source') ?? 'upload.glb',
              name: url.searchParams.get('name') ?? '',
              label: url.searchParams.get('label') ?? '',
            });
            return send(res, 200, result);
          }
          if (req.method === 'DELETE') {
            await removeModel(decodeURIComponent(url.pathname.slice(1)));
            return send(res, 200, { ok: true });
          }
          return send(res, 405, { error: 'Method not allowed' });
        } catch (error) {
          if (error instanceof ModelImportError) return send(res, 400, { error: error.message });
          server.config.logger.error(String(error?.stack ?? error));
          return send(res, 500, { error: "Couldn't save that shape — see the terminal running npm run dev." });
        }
      });
    },
  };
}

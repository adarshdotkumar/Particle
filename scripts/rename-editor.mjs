import { rename, readFile, stat } from 'node:fs/promises';

/* Gives the built editor a name a designer can recognise in their Downloads
 * folder, and fails the build if anything still loads from the network.
 *
 * That second job is the important one. A stray <script src> or <link href>
 * would break the whole premise — the file has to work offline, off a USB
 * stick, on a plane. Catching it here means the file:// promise cannot
 * silently regress into "works on my machine, where the dev server is up". */

const from = new URL('../dist-editor/index.html', import.meta.url);
const to = new URL('../dist-editor/particle-field-editor.html', import.meta.url);

const html = await readFile(from, 'utf8');

/* Scan the MARKUP only. The inlined three.js contains template literals like
   `<script src="${c}">` in its own source, which would otherwise trip this
   check. Emptying script/style bodies while keeping their opening tags means a
   real external reference is still caught. */
const markup = html
  .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2')
  .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, '$1$2');

// Anything with src= or href= that is not a data: URL is a network request.
const external = [
  ...markup.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)=["'](?!data:|#)([^"']+)["']/gi),
].map((m) => m[1]);

if (external.length) {
  throw new Error(
    `Editor is not self-contained. Still references:\n  ${external.join('\n  ')}\n` +
    'Every asset must be inlined for the file:// path to work.'
  );
}

await rename(from, to);

const { size } = await stat(to);
console.log(
  `dist-editor/particle-field-editor.html  ${(size / 1024).toFixed(0)} kB  (self-contained)`
);

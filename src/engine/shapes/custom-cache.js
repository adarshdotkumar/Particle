/* A tiny in-memory cache from a model's URL (blob: from a local upload, or
 * http(s): from a hosted file) to its already-extracted, already-normalized
 * mesh arrays. model-loader.js (three.js-dependent) populates this after
 * loading a file; custom.js (three.js-free) reads from it synchronously, the
 * the same way the built-in models in models/ are read. */

export const customModelCache = new Map();

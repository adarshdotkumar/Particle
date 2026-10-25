# AGENTS.md

Instructions for an AI agent (Claude Code or similar) helping someone use this
repo. There are two distinct jobs — don't conflate them.

## Job 1 — run it locally so they can tune the effect

```bash
npm install
npm run dev
```

This opens the **editor** (`src/editor/`) — sliders, shape/preset chips, a text
input, live WebGL preview. It is not a website or a demo; it's the authoring
tool. The person's job here is to drag sliders until it looks right. Yours is
just getting `npm run dev` running — if it fails, it's almost always Node
version or a stale `node_modules` (`rm -rf node_modules && npm install`).

## Job 2 — take what they tuned and add it to their actual project

The editor's "Embed" panel has a Copy button that exports the tuned config as
one of three ready-made snippets (`src/snippet.js` generates all three; the
editor's export panel just exposes them). **Don't hand-write an integration —
one of these three already exists and is correct.** Pick based on the target
project:

| Target project has... | Use this flavor | What it looks like |
| --- | --- | --- |
| No bundler (plain HTML/CSS/JS site) | `script` (the default/primary Copy button) | `<div data-particle-field='{...}'>` + `<script src="...particle-field.min.js" defer>` |
| A bundler, plain JS (Vite/webpack/etc.) | `esm` (under "For developers") | `import { ParticleField } from '@adarshdotkumar/particle-field'` |
| React | `react` (under "For developers") | `import { ParticleField } from '@adarshdotkumar/particle-field/react'` |

If the person just pastes a block into chat without saying which flavor, infer
it from the block's own shape (a `<div data-particle-field>` is `script`; an
`import` statement tells you which of the other two) — don't ask them to
re-export in a different flavor unless the shape genuinely doesn't match
their project.

### Known current gap — check before assuming a snippet will load

`src/cdn.js` points at `adarshdotkumar/Particle` and the npm name is
`@adarshdotkumar/particle-field`. Neither resolves until it actually ships:

- `script` flavor's `<script src="https://cdn.jsdelivr.net/gh/...">` only
  resolves once that repo is public and a matching git tag has been pushed
  (triggers `.github/workflows/release.yml`).
- `esm`/`react` flavors' `import ... from '@adarshdotkumar/particle-field'` only resolves after
  `npm publish`. Never "fix" it to the bare name `particle-field` — that is an
  unrelated package on npm.
- A `'custom'` shape loads its `.glb` from `shapeModelUrl` at runtime — the
  file must be hosted somewhere the page can fetch (same origin, or CORS).
  To make a Blender model a permanent built-in instead, use the editor's
  **Save as shape** button under `npm run dev`, or
  `npm run import-model -- file.glb --name <name>`, then rebuild. Built-in
  imports only exist in builds made from this copy of the repo. Don't
  hand-write a loader.

If you hit either broken path, don't silently "fix" it by guessing a URL —
tell the person, and offer the fallback: run `npm run build:lib` in this repo,
then reference the resulting `dist/particle-field.js` (or `.min.js`) via a
relative path in their project instead of the package name / CDN URL.

## Gotchas when placing any of these snippets

- The container **needs a height** (`style="height:600px"`, `aspect-ratio`,
  etc.) — the single most common "nothing renders" cause. The canvas is
  absolutely positioned inside it.
- It touches `document` in its constructor — **client-side only**. In
  Next.js/Astro/any SSR framework, mount it in `useEffect`/`onMount`/
  `client:load`, never at module scope or during SSR.
- In React, mount once and push updates separately — rebuilding the
  `ParticleField` instance on every config change rebuilds the whole particle
  simulation. The packaged `@adarshdotkumar/particle-field/react` component already handles
  this; a hand-rolled `useEffect([config])` does not.
- Needs WebGL2 + `EXT_color_buffer_float`. On unsupported hardware it should
  degrade via `onUnsupported`, not throw.
- Full config schema (every key, default, and the preset library) lives in
  `src/config.js` — read that before inventing a config key that doesn't
  exist.

## Where to go deeper

- `docs/EMBEDDING.md` — full framework recipes (Vue, Svelte, background vs.
  container mode, CSP notes, a troubleshooting table).
- `docs/DESIGNERS.md` — the non-technical path (double-click the standalone
  editor, no npm at all).
- `docs/PROVENANCE.md` — why the code is organized the way it is, if you need
  to trace a piece of logic back to its origin.

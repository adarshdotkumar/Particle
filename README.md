# particle-field

`@adarshdotkumar/particle-field` · [MIT](LICENSE)

GPU particle effects you design in a browser and drop into a website.

Positions live in a float texture on the GPU — one pixel per particle — and a
shader moves all of them at once. 65,000 particles at 60fps is unremarkable;
262,000 is a stress test, not a limit.

Built on [three.js](https://threejs.org). Inspired by
[designup.io](https://designup.io)'s opening animation — see
[reference/rebuild.md](reference/rebuild.md) for how the technique works.

---

## No code? Start here

1. Download **`particle-field-editor.html`** from the
   [latest release](../../releases/latest).
2. Double-click it. It opens in your browser and runs — no installing, and it
   works offline.
3. Make an effect, then press **Copy code**.
4. Paste that block into your page, or send it to whoever built your site.

Full walkthrough: **[docs/DESIGNERS.md](docs/DESIGNERS.md)**.

---

## For developers

### HTML — one script tag

No build step, no import map, no npm. `three` is bundled in, and jsDelivr
serves it straight off this repo.

```html
<div style="height:600px"
     data-particle-field='{"shapeMode":"text","shapeText":"HELLO","colA":"#9d8cff","colB":"#4be3ff"}'></div>
<script src="https://cdn.jsdelivr.net/gh/adarshdotkumar/Particle@v0.1.0/dist/particle-field.min.js" defer></script>
```

Every element with a `data-particle-field` attribute gets its own effect,
configured by the JSON inside it. That's the whole integration.

The tag is pinned deliberately rather than floating on `@latest`: a snippet
pasted into a live site shouldn't change appearance because a new version
shipped.

### ESM

```bash
npm install @adarshdotkumar/particle-field three
```

Or install straight from the repo with
`npm install github:adarshdotkumar/Particle three`, or vendor
`dist/particle-field.js`.

```js
import { ParticleField } from '@adarshdotkumar/particle-field';

const field = new ParticleField({
  container: '#hero',
  config: { shapeMode: 'text', shapeText: 'HELLO', spring: 4.5 },
});

// later
field.destroy();
```

`three` is a peer dependency here, so you ship one copy of it, not two.

### React

```jsx
import { ParticleField } from '@adarshdotkumar/particle-field/react';

export function Hero() {
  return (
    <ParticleField
      style={{ height: 600 }}
      config={{ shapeMode: 'x', depth: 0.55, dotStyle: 'solid' }}
    >
      <h1 style={{ position: 'relative', zIndex: 1 }}>Your headline</h1>
    </ParticleField>
  );
}
```

`react` is an optional peer dependency, so nobody else pays for it. The
component handles the two things that are easy to get wrong by hand and fail
silently:

- **Teardown on unmount.** Browsers allow roughly 8–16 live WebGL contexts per
  page, so a component without cleanup exhausts them after a few route changes
  and every later effect quietly refuses to render. Verified over 20
  mount/unmount cycles under `StrictMode` — which double-invokes effects, so
  that is ~40 contexts created and released.
- **Cheap config updates.** Passing `config` into the mount effect's dependency
  array would rebuild 65,000 particles on every colour tweak. Changes go in as
  uniform updates; only a `count` change rebuilds. You can pass a fresh object
  literal every render.

There is also a `useParticleField(config, options)` hook if you want the
instance:

```jsx
const { ref, field, supported } = useParticleField({ spring: 4.5 });
return <div ref={ref} style={{ height: 600 }} />;
```

**Next.js and other SSR frameworks:** the engine touches `document` on
construction, so it must run client-side only. Add `'use client'`, or import it
with `dynamic(..., { ssr: false })`. The pure modules — `normalizeConfig`,
`encodeConfig`, `generateSnippet` — are safe to import anywhere.

---

## The editor

Two ways to run it. The single file is what designers get; the dev server is
what you use while changing it.

```bash
npm install
npm run dev            # http://localhost:5199/src/editor/index.html

npm run build:editor   # dist-editor/particle-field-editor.html — one file, offline
```

Tune 18 sliders, 7 presets, 5 shapes and 2 dot styles, then copy the embed
snippet. Your work autosaves, the URL is a share link (when served over http),
and **Save as .json** gives you a file you can commit to your own repo.

### Shapes from Blender

Clone the repo, run it, and any model you make in Blender becomes a shape.

**Export from Blender:** **File → Export → glTF 2.0**, format **glTF Binary
(.glb)**, with **Compression off**. Materials and textures don't matter —
only the geometry becomes dots.

**Try it:** click **Upload a shape (.glb)** in the editor. The dots re-form
on your model straight away, and every slider works on it.

**Keep it:** with the editor running from `npm run dev`, click **Save as
shape** and give it a name. The model is written into the code at
`src/engine/shapes/models/<name>.js` and gets its own chip next to Sphere,
Cube and X — permanently, in the editor, in `shapeMode`, and in every build
you make (`npm run build:all`). **Remove shape** takes it out again. The same
thing from a terminal:

```bash
npm run import-model -- path/to/logo.glb --name logo --label "Logo"
npm run import-model -- --remove logo
```

A saved shape is baked into the engine as plain numbers, so it needs nothing
to fetch — but it is only in **your** builds. An embed snippet that loads the
public CDN build won't have it: host your own `dist/particle-field.min.js`,
or point `REPO` in `src/cdn.js` at your public fork.

**Or load it at runtime:** put the `.glb` on your own site and use
`shapeMode: 'custom'` with `shapeModelUrl` set to its address. The engine
fetches it and the dots fly onto it once it arrives. This works with any
build, including the public CDN one. If the file is on a different domain
from the page, that server must allow cross-origin requests (CORS).

Keep it light — every triangle ships inside the embed. A few thousand is
plenty for dots; Blender's **Decimate** modifier gets you there.

---

## Options

`new ParticleField(options)`

| Option | Default | What it does |
| --- | --- | --- |
| `container` | *required* | Element or CSS selector. Needs an explicit height. |
| `config` | `{}` | Partial config; anything unset falls back to its default. |
| `mode` | `'container'` | `'container'` sizes to the element. `'background'` fixes a fullscreen canvas to the viewport. |
| `progress` | `'auto'` | `'scroll'`, `'fixed'`, or a number 0–1. `'auto'` means scroll-driven in background mode, fully formed in container mode. |
| `pointer` | `true` | Track the cursor and push particles away from it. |
| `autoPause` | `true` | Stop rendering when scrolled offscreen or the tab is hidden. |
| `respectReducedMotion` | `true` | Under `prefers-reduced-motion`, render one settled static frame and stop. |
| `dpr` | `2` | Device-pixel-ratio cap. |
| `mobileCount` | `128` | Particle-count ceiling under 768px wide. |
| `onUnsupported` | `null` | Called with `{ reason }` if WebGL or float textures are missing. Nothing throws. |

## Methods

| Method | What it does |
| --- | --- |
| `set(partial)` | Merge config in. Picks the cheapest path: uniforms are free, a shape change re-seeds, a count change rebuilds. |
| `getConfig()` | The current full config. |
| `setProgress(n)` | 1 = formed shape, 0 = scattered dust. Switches off scroll driving. |
| `getProgress()` | Current value. |
| `setProgressMode(m)` | `'scroll'` or `'fixed'`. |
| `play()` / `pause()` | Manual control of the render loop. |
| `resize()` | Re-read the container size. Usually automatic via `ResizeObserver`. |
| `getStats()` | `{ fps, count }`. |
| `destroy()` | Total teardown. Idempotent. |

| Property | |
| --- | --- |
| `supported` | `false` if the GPU can't run it. |
| `isRunning` | Whether the loop is scheduled. |
| `element` | The canvas. |

Also exported: `mount(root)`, `DEFAULTS`, `PRESETS`, `SLIDERS`, `RANGES`,
`normalizeConfig`, `diffConfig`, `encodeConfig`, `decodeConfig`,
`generateSnippet`.

---

## Config reference

Every key is optional. Unset keys use the default — never a value left over
from a previous config.

### Wind — the invisible force pushing particles around

| Key | Range | Default | |
| --- | --- | --- | --- |
| `flowStrength` | 0–3 | `0.55` | How hard the wind pushes. Smoke ←→ shimmer. |
| `flowFrequency` | 0.05–4 | `0.90` | Wind scale. Big lazy swirls ←→ fine crackle. |
| `flowDrift` | 0–1 | `0.20` | How fast the wind pattern itself morphs. |
| `flowInfluence` | 0–1 | `0.70` | What fraction of particles react to it at all. |

### Stream — particles that break free

| Key | Range | Default | |
| --- | --- | --- | --- |
| `reach` | 0.05–3 | `1.50` | Hard cap on how far a particle may stray from home. |
| `escape` | 0–0.6 | `0.12` | Fraction let off the leash to stream away. |
| `streamSpeed` | 0–4 | `1.10` | How hard the wind shoves them once loose. |

### Hold

| Key | Range | Default | |
| --- | --- | --- | --- |
| `spring` | 0.02–12 | `3.20` | Elastic pull home. Loose cloud ←→ crisp shape. |

### Cursor

| Key | Range | Default | |
| --- | --- | --- | --- |
| `mouseStrength` | 0–5 | `1.40` | How hard the cursor shoves particles. |
| `mouseRadius` | 0.1–3 | `0.90` | Size of the bubble around the cursor. |

### Dots

| Key | Range | Default | |
| --- | --- | --- | --- |
| `lifeSpeed` | 0.05–2 | `0.55` | How quickly dots recycle. High = twinklier. |
| `size` | 0.004–0.12 | `0.022` | Dot size. Keep small — overlaps blow out. |
| `glow` | 0–1.5 | `0.68` | Brightness. Additive, so overlaps stack. |
| `depthFade` | 0–1 | `0.85` | Dims the far side so a ball looks round, not flat. |
| `dotStyle` | `'glow'` \| `'solid'` | `'glow'` | Soft additive dots, or hard flat ones. |
| `colA` | hex | `'#9d8cff'` | Colour of young dots. |
| `colB` | hex | `'#4be3ff'` | Colour of old dots. |

### 3D

| Key | Range | Default | |
| --- | --- | --- | --- |
| `depth` | 0–0.8 | `0.18` | Thickness. 0 = paper-flat, no shards. |
| `lightAngle` | 0–360 | `135` | Where the light comes from, in degrees. |
| `shadow` | 0–1 | `0.75` | How dark unlit faces go. |

### Shape and scale

| Key | Values | Default | |
| --- | --- | --- | --- |
| `shapeMode` | `'sphere'` \| `'cube'` \| `'x'` \| `'text'` \| `'custom'`, plus any model you've imported from Blender | `'sphere'` | What the particles form. `'x'` is the built-in 3D X. `'custom'` is an uploaded model — see the note below. |
| `shapeText` | string, ≤24 chars | `'HELLO'` | Used when `shapeMode` is `'text'`. |
| `shapeModelUrl` | string | `''` | Used when `shapeMode` is `'custom'`. |
| `origins` | array of `'top'`, `'bottom'`, `'left'`, `'right'`, `'center'`, `'edges'` | `[]` | Restrict the wind to part of the shape. Empty = everywhere. |
| `count` | 64 \| 128 \| 256 \| 512 | `256` | Texture resolution. Particles = count². 256 → 65,536. |

Values outside a range are clamped, unknown keys are dropped, and bad values
fall back to the default — so a hand-edited or tampered config can't break
anything.

A `'custom'` shape shows the sphere until its model has loaded, and stays a
sphere (with a console warning) if `shapeModelUrl` can't be fetched or read.
See [Shapes from Blender](#shapes-from-blender).

---

## Browser support

Needs **WebGL2** and **`EXT_color_buffer_float`** — the particle positions live
in a float texture. That covers every current desktop and mobile browser.

Where it's missing, nothing throws: `supported` is `false`, `onUnsupported` is
called, no canvas is added, and the auto-mount path sets
`data-particle-field-unsupported="<reason>"` on the element so you can style a
fallback.

## Performance

- Pauses itself when scrolled out of view (`IntersectionObserver`) and when the
  tab is hidden.
- Renders one settled static frame under `prefers-reduced-motion`.
- Caps device pixel ratio at 2 and particle count at 128² on small screens.
- Each field is its own WebGL context, and browsers allow roughly 8–16 per
  page. A handful of fields is fine; forty is not.

## Bundle size

| Build | Raw | Gzipped |
| --- | --- | --- |
| `dist/particle-field.min.js` (three bundled) | 507 kB | **133 kB** |
| `dist/particle-field.js` (three external) | 69 kB | **22 kB** |
| `dist-editor/particle-field-editor.html` (whole tool, one file) | 524 kB | **142 kB** |

`dist/` is committed on purpose — jsDelivr serves the embed off the repo tree at
each tag, so the built engine has to be in the repo. See
[docs/RELEASING.md](docs/RELEASING.md).

## Scripts

```bash
npm run dev           # vite dev server on :5199
npm run build:lib     # both library builds into dist/
npm run build:editor  # single-file editor into dist-editor/
npm run build:all     # both of the above
npm run import-model  # bake a Blender .glb into a built-in shape (--remove <name> to undo)
npm test              # unit tests (vitest, pure Node)
npm run test:e2e      # browser tests (playwright, real WebGL + file://)
npm run test:all      # both
```

## Docs

| | |
| --- | --- |
| [docs/DESIGNERS.md](docs/DESIGNERS.md) | The no-terminal walkthrough. Start here if you don't code. |
| [docs/EMBEDDING.md](docs/EMBEDDING.md) | Host-site integration, framework recipes, troubleshooting. |
| [docs/RELEASING.md](docs/RELEASING.md) | How tagging works, and what breaks live sites. |
| [docs/PROVENANCE.md](docs/PROVENANCE.md) | Where each part of the original single-file demo ended up. |

# Provenance

This package was extracted from a single 1,900-line HTML file. The original is
kept outside this repo now; `reference/particle-effect.html` is a frozen copy
of it kept inside the package. **Do not edit `reference/particle-effect.html`.**

The copy exists so parity is checkable from inside the package:
`tests/shaders.test.js` diffs every extracted shader against the template
literal in that file, byte for byte. If someone tweaks a shader, that test fails
loudly instead of the effect quietly looking different.

## Where each section went

The original was organised as ten numbered sections. This is where each landed.

| Original | Lines | Now lives in |
| --- | --- | --- |
| — styles | 8–248 | `src/editor/panel.css` (verbatim), overrides in `src/editor/editor.css` |
| — markup | 261–316 | `src/editor/index.html` |
| §1 tunable values | 340–361 | `src/config.js` → `DEFAULTS` |
| §1 `LOOK_DEFAULTS` merge rule | 363–372 | `src/config.js` → `normalizeConfig` (now unit-tested) |
| §1 `SLIDERS` table | 377–401 | `src/config.js` → `SLIDERS` (verbatim) |
| §1 `PRESETS` | 404–467 | `src/config.js` → `PRESETS` (verbatim) |
| §1 shape constants | 469–497 | `src/engine/shapes/*.js` |
| §2 renderer + hardware check | 504–524 | `src/engine/context.js` |
| §3 noise GLSL | 536–598 | `src/engine/shaders/noise.js` (verbatim) |
| §4 simulation shader | 608–779 | `src/engine/shaders/sim.frag.js` (verbatim) |
| §5 drawing shaders | 788–879 | `src/engine/shaders/points.{vert,frag}.js` (verbatim) |
| §6 sim scene / quad | 889–895 | `src/engine/simulation.js` (now per-instance) |
| §6 float target + data texture | 899–916 | `src/engine/simulation.js` |
| §6 sphere seeding | 924–954 | `src/engine/shapes/sphere.js` |
| §6 text seeding | 956–1090 | `src/engine/shapes/text.js` |
| §6 X mesh data + area CDF | 1092–1200 | replaced by an original X built in code: `src/engine/shapes/models/x.js` |
| §6 model seeding | 1202–1246 | generalised into `src/engine/shapes/mesh-sample.js` |
| §6 `writeBase` + bounds | 1248–1273 | `src/engine/shapes/index.js` |
| §6 `build` / `dispose` | 1276–1441 | `src/engine/simulation.js` → `createSimulation` |
| §7 cursor tracking | 1444–1466 | `src/engine/particle-field.js` (canvas-relative now) |
| §8 scroll drives assemble | 1469–1492 | `src/engine/particle-field.js` → `_readScrollProgress` |
| §9 the panel | 1495–1792 | `src/editor/panel.js` |
| §9 sphere look + shape chips | 1657–1746 | `src/editor/panel.js` |
| §10 frame loop | 1799–1888 | `src/engine/particle-field.js` → `_tick`, `src/engine/simulation.js` → `step`/`applyConfig` |

New, with no counterpart in the original: `src/codec.js` (share links),
`src/snippet.js` (embed export), `src/editor/storage.js` (autosave and files),
`src/editor/export-panel.js`, `src/standalone.js`, and everything under `tests/`.

## Deliberate changes

Shaders and seeder maths moved verbatim. Everything else that changed, changed
for a stated reason:

1. **`progress` is not a config key.** It was in `params` but excluded from
   `LOOK_DEFAULTS` by destructuring, because it belongs to playback rather than
   to a saved look. Now the engine owns it outright, so it never travels in a
   share link or an embed snippet.

2. **Seeders take `depth` as an argument** instead of reading a module-global
   `params`. Required to make them testable and reusable.

3. **`writeBase` returns bounds** as plain arrays instead of mutating a shared
   `THREE.Vector3`. Keeps `src/engine/shapes/` free of a three import, so it
   runs in Node.

4. **`simScene` / `simCamera` / `simQuad` are per-instance.** As module
   singletons, two fields on one page would fight over `simQuad.material`
   mid-frame.

5. **Unsupported hardware reports instead of throwing.** The original called
   `throw new Error('EXT_color_buffer_float unavailable')` at line 519. On
   someone else's site that takes down the host page's JavaScript.

6. **Sizing, pointer and scroll are element-scoped**, not `window`-scoped. The
   original read `innerWidth`/`innerHeight` directly and measured
   `document.body.scrollHeight`.

7. **`destroy()` is complete.** The original `dispose()` freed GPU resources but
   left the `requestAnimationFrame` loop running, the three window listeners
   attached, and the renderer undisposed.

8. **The canvas is transparent** (`alpha: true`, zero-alpha clear) so it can
   layer over host content. The original's was opaque.

Added behaviour with no original equivalent: auto-pause via
`IntersectionObserver` and `visibilitychange`, a settled static frame under
`prefers-reduced-motion`, and a mobile particle-count clamp.

# Embedding on a website

Practical notes for putting a field on a page you didn't write.

## The container needs a height

The canvas is absolutely positioned inside your element, so the element must
have its own height. This is the single most common reason nothing appears:

```html
<!-- nothing renders: the div is 0px tall -->
<div data-particle-field='{}'></div>

<!-- works -->
<div style="height:600px" data-particle-field='{}'></div>
```

Any height source is fine — `height`, `aspect-ratio`, a grid row, `min-height`
plus content. If the element measures zero the field waits and re-checks on the
next `ResizeObserver` callback, so a container that starts collapsed and later
opens will start rendering by itself.

## Layering content over the effect

The canvas is transparent and has `pointer-events: none`, so page content sits
on top and stays clickable. Give the content a stacking context:

```html
<div class="hero" data-particle-field='{"shapeMode":"text","shapeText":"HELLO"}'>
  <div class="hero-inner">
    <h1>Your headline</h1>
    <a href="/signup">Still clickable</a>
  </div>
</div>

<style>
  .hero { position: relative; height: 70vh; }
  .hero-inner { position: relative; z-index: 1; }
</style>
```

The field sets `position: relative` on your container itself if the page hasn't
already chosen a position — it won't override one you set.

## Container mode vs background mode

**Container** (default) scopes everything to the element: it sizes to that box,
tracks the cursor relative to that box, and pauses when the box scrolls out of
view. Use this for heroes, section headers, cards — anything in the flow.

**Background** fixes a fullscreen canvas to the viewport at `z-index: 0` and
follows window scroll. Use it for a whole-page backdrop. Your content needs
`position: relative; z-index: 1`.

```html
<div data-particle-field='{"mode":"background","progress":"scroll"}'></div>
```

Only run one background field per page — they'd stack on top of each other.

## Scroll-driven assembly

`"progress": "scroll"` makes the shape assemble and disassemble as the element
moves through the viewport: dust at the edges of the screen, fully formed in the
middle. In background mode it maps to the whole page instead, formed at the top
and dispersing as you scroll down.

Or drive it yourself:

```js
field.setProgress(0.5);  // half-assembled
```

## Multiple fields

Each field is a separate WebGL context, and browsers cap live contexts at
roughly 8–16 per page. Two or three fields is fine. If you need more, either
reuse one field and move it, or accept that the browser will start discarding
the oldest contexts.

`destroy()` releases the context properly (it calls `forceContextLoss()`), so
mounting and unmounting repeatedly — the React case — does not accumulate them.
There's a test for exactly this: 24 mount/destroy cycles, no leak.

## Framework recipes

### React

Use the packaged component — it already handles teardown and cheap updates:

```jsx
import { ParticleField } from '@adarshdotkumar/particle-field/react';

<ParticleField style={{ height: 600 }} config={{ shapeMode: 'text', shapeText: 'HELLO' }} />
```

If you wire it by hand instead, these are the two traps:

```jsx
// ✗ rebuilds 65,000 particles on every colour tweak
useEffect(() => {
  const field = new ParticleField({ container: ref.current, config });
  return () => field.destroy();
}, [config]);

// ✓ mount once, then push updates separately
useEffect(() => {
  fieldRef.current = new ParticleField({ container: ref.current, config });
  return () => fieldRef.current.destroy();   // omitting this leaks a GL context
}, []);
useEffect(() => { fieldRef.current?.set(config); }, [config]);
```

`StrictMode` in development mounts, unmounts and remounts effects deliberately,
which turns a missing `destroy()` from a slow leak into an immediate one — so
if it works under `StrictMode`, it works.

### Vue

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ParticleField } from '@adarshdotkumar/particle-field';

const el = ref(null);
let field;
onMounted(() => { field = new ParticleField({ container: el.value, config: {} }); });
onUnmounted(() => field?.destroy());
</script>

<template><div ref="el" style="height:600px" /></template>
```

### Svelte

```svelte
<script>
  import { onMount } from 'svelte';
  import { ParticleField } from '@adarshdotkumar/particle-field';

  let el;
  onMount(() => {
    const field = new ParticleField({ container: el, config: {} });
    return () => field.destroy();
  });
</script>

<div bind:this={el} style="height:600px"></div>
```

### Astro / Next / any SSR framework

The engine touches `document` in its constructor, so it must run on the client
only. In Astro use `client:load`; in Next use `useEffect` (as above) or a
`dynamic(..., { ssr: false })` import. The pure modules — `normalizeConfig`,
`encodeConfig`, `generateSnippet` — are safe to import anywhere.

## Content Security Policy

The library doesn't use `eval`, inline scripts, or `blob:` workers, so a strict
`script-src 'self'` policy is fine once the file itself is allowed. If you load
from a CDN, add that origin to `script-src`. The `data-particle-field` attribute
is parsed with `JSON.parse`, not evaluated.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Nothing renders, no errors | Container has zero height. |
| `supported === false` | No WebGL2 or no `EXT_color_buffer_float`. Check `onUnsupported`'s reason. |
| Effect is static | `prefers-reduced-motion` is on, or the field is paused offscreen. |
| Cursor push feels offset | You're resizing the canvas yourself. Let the field own it. |
| Two copies of three.js in the bundle | You're using the standalone build in a bundler. Import `particle-field` (ESM) instead. |
| Dots blow out to white blobs | `size` too large with `dotStyle: 'glow'` — additive blending saturates. Lower `size` or switch to `'solid'`. |
| Shape looks flat | `depthFade` at 0, or `depth` at 0 for text and uploaded shapes. |
| `'custom'` shape stays a sphere | `shapeModelUrl` can't be fetched (wrong path, or another domain without CORS), or the `.glb` was exported with compression on. The console says which. |
| An imported shape shows a sphere | The snippet loads the public CDN build, which only has the shapes that ship with it. Host your own build. |
| Nothing on an old iPad | Float textures are missing; ship a poster image via `onUnsupported`. |

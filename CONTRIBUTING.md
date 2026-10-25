# Contributing a new built-in shape

**Is it a model you made in Blender?** Don't write code — upload it in the
editor under `npm run dev` and click **Save as shape**, or run
`npm run import-model -- your.glb --name yourshape --label "Your shape"`.
Either bakes the mesh into `src/engine/shapes/models/`, registers it as a
shape mode and adds its editor chip. See the README's *Shapes from Blender* section. The
rest of this page is for shapes generated from code, like the sphere or cube.

A shape is a small module in `src/engine/shapes/` that fills in every
particle's "home" position and surface normal. Four already exist:
`sphere.js`, `cube.js`, `text.js`, and `custom.js` (an arbitrary uploaded
model), plus the built-in models in `models/` — read whichever is closest to
what you're adding before you start.

## The interface

```js
function seedFromYourShape(data, normals, count, /* ...whatever params you need */) {
  // data:    Float32Array(count * 4) — [x, y, z, w] per particle. w is
  //          "outline-ness" (0 = flat face, 1 = edge), used for shading.
  // normals: Float32Array(count * 3) — [nx, ny, nz] per particle, unit length.
  // count:   how many particles to fill.
  // Return true if you filled everything; return false if this shape
  // couldn't be produced (see text.js's empty-string case) — writeBase()
  // in shapes/index.js falls back to the sphere when you return false.
}
```

If your shape is backed by real mesh geometry (triangles), don't write your
own sampling loop — call `sampleMesh` from `mesh-sample.js`, the same
function the built-in models and `custom.js` use. You only need to supply
`{ position, normal, index, areaCdf, meshDepth }`; `computeAreaCdf` and
`normalizeMeshArrays` in that same file build the last two for you from raw
position/index arrays.

## Registering it

1. Add your file to `src/engine/shapes/`.
2. Add its mode string to `SHAPE_MODES` in `src/config.js`.
3. Add a branch for it in `writeBase()` in `src/engine/shapes/index.js`.
4. Add a chip for it to `SHAPE_CHIPS` in `src/editor/panel.js`, so it's
   selectable in the editor.
5. Write a unit test in `tests/shapes.test.js` (or a new file, if your shape
   has enough surface area to warrant one — see `tests/mesh-sample.test.js`
   for the pattern) — no GPU or DOM required, since everything in
   `shapes/` is plain array math.

This is a different path from uploading a `.glb` at runtime (see
`docs/DESIGNERS.md`) — that's for *using* a shape without touching code; this
is for *contributing* a new one back to the tool itself.

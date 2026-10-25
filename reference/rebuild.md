# How to rebuild this

*Notes to future me. If the demo file is lost, this is enough to build it again.*

---

## The one idea

Don't keep particles in a JavaScript array. Keep their positions **in a floating-point texture** — one pixel per particle, RGB = XYZ, alpha = lifetime.

Each frame:

1. Run a fragment shader over that whole texture → every particle moves at once
2. Draw one point per pixel, each looking up its own position

That's the whole technique. Everything else is decoration.

You can't read and write the same texture, so keep **two** and alternate — write B while reading A, then swap. Two sheets of tracing paper.

---

## Minimum viable version

```
three.js (r170 is what I used)
one 128×128 float render target ×2   → 16,384 particles
one fullscreen quad + OrthographicCamera   → runs the sim
one THREE.Points + BufferGeometry          → draws the result
```

Three textures, all RES × RES:

| Texture | Contents | Changes? |
|---|---|---|
| `base` | home position per particle (+ spare channel) | only on shape change |
| `scatter` | a random cloud position per particle | never |
| `particles` | live state, ping-ponged | every frame |

Geometry attributes on the Points: `position` (dummy, three needs it for the count), `aParticlesUv` (which pixel am I), `aSizeJitter`, `aNormal` (only if you want lighting).

Set `frustumCulled = false` — positions live on the GPU and three can't see them.

---

## The four forces

Sum these per particle, per frame, in the sim shader:

```glsl
// 1. wind — 3 noise samples give a 3D direction; time in the sample coord
//    makes the field itself drift
pos += normalize(flow) * gust * uFlowStrength * dt;

// 2. cursor — inverse distance, smoothstep falloff, capped
pos += awayDir * min(1.0/dist, 40.0) * falloff * uMouseStrength * dt;

// 3. elastic — THE important one
pos += (home - pos) * uSpring * dt;

// 4. age — respawn at home when life >= 1
life += dt * uLifeSpeed;
```

**Sample the gust noise at the particle's HOME position, not its live one.** That makes gusting stable per particle — the same grains keep streaming instead of the pattern crawling over the cloud.

### Why each one matters

- **Wind alone** → smoke that blows away and never comes back
- **Elastic alone** → a static, dead shape
- **Wind + elastic** → a shape that breathes. This is the effect.
- **No lifetime** → the shape slowly erodes as particles wander off
- **Lifetime** → holds forever while individual dots recycle invisibly

Scroll/assemble = blend the home position between `scatter` and `base`, and **tighten the spring as it forms**. The stiffening is what makes it read as condensing rather than sliding.

---

## Gotchas that cost me time

**It blows out to a white blob.** Additive blending plus overdraw. Overdraw scales with the *square* of dot radius, so **reduce dot size before glow**. Count is rarely the culprit.

**A ball of dots looks like a flat disc.** Additive lets the back shine through the front. Dim by camera distance explicitly.

**Particles won't leave the screen no matter how hard you push.** They're dying before they get there. It's a **lifespan** problem, not a speed one. Slow the ageing of anything you want to travel far.

**Hard-edged dots + additive = instant saturation.** Use a wide `smoothstep` falloff, then square it for a tight core with a soft halo.

**Any per-particle state switch needs easing.** A binary "this one is free now" flag makes particles snap across the screen. Use a `smoothstep` band. You see individual particles, so discontinuities that would hide in aggregate become visible defects.

**A bare distance clamp makes a visible shell.** Particles pile up on an invisible sphere. Ramp an inward pull *before* the limit, then clamp as a backstop.

**Requires `EXT_color_buffer_float`.** Check it and show a message; otherwise you get a black screen on unsupported hardware.

**`file://` blocks fetching assets.** If you want a genuinely portable single file, inline them. Import maps accept `data:` URLs, which lets you inline three.js itself without touching the `import` statement.

---

## Getting a shape in

**Sphere** — Fibonacci spiral (avoids pole clumping). Normal = direction from centre.

**Text** — draw to an offscreen 2D canvas, read pixels, keep the lit ones, sample randomly. Draw it BIG (400px+) if you want fine outline work; the finest stroke you can express is one canvas pixel.

**A 3D model** — `MeshSurfaceSampler` from three's addons, weighted by triangle area so large faces get proportionally more points. If you're hand-rolling: build a running total of triangle areas, binary-search a random number into it, then pick a random barycentric point.

### The distance-field trick

Flood-fill inwards from a glyph's outline (multi-source BFS) to get "how deep inside am I" per pixel. Store it in the **spare 4th channel** of the base texture.

One precomputation, two features: emit swirls from the edges, *and* draw the letters hollow. Costs nothing per frame.

**Channels are real estate.** Position takes RGB, so alpha carries lifetime. The home texture's alpha carries edge-proximity. Budget them deliberately.

**Need per-particle randomness?** Hash the UV instead of storing it — `hash12(uv)` gives a stable value every frame with no extra texture.

---

## Making it look 3D

Extrude the shape and light it. Front faces point at the viewer, side walls point outward, so they catch different amounts of light — *that* is what reads as shard edges.

- Give each particle a surface normal, run one diffuse `dot(normal, lightDir)`
- **Don't bevel.** Flat facets meeting at hard angles are the whole look
- An extrusion of about **0.2 of the letter's width** is a good starting ratio
- Normalize the light vector in JS, not per-vertex

**Caveat I got wrong:** viewed perfectly head-on, an extruded shape shows *no* outward-facing side walls — they're all turned away. If you see them anyway, you're drawing hidden geometry (points don't occlude or cull). To do it honestly, turn the shape a few degrees **and** cull back-facing particles. Either alone won't work.

---

## Numbers worth remembering

| Thing | Value |
|---|---|
| Realistic desktop budget | 80,000 particles |
| Mobile budget | 10,000, MSAA off, half-res buffers |
| Dot size that doesn't blow out | ~0.02 (of my scale) |
| Extrusion / width ratio | 0.193 |
| Lifetime for a stable shape | ~2.5s (`lifeSpeed` 0.4) |
| Lifetime for particles that exit frame | 7× longer |

---

## Software lesson, not a graphics one

If you build presets, **merge them over a defaults baseline**. Applying only the keys a preset names makes results order-dependent — preset B after preset A quietly inherits A's leftovers.

I patched this twice (once per symptom) before fixing the mechanism. Two symptom fixes in the same area is the signal to go up a level.

---

## If starting fresh

Use `GPUComputationRenderer` from `three/addons/misc/` — it handles the ping-pong. I hand-rolled it (~40 lines) only to keep the mechanism visible for teaching.

Order of work that went well:

1. Ping-pong buffers + white dots on a sphere → prove the plumbing
2. Add wind, then elastic → find the balance, this is the whole effect
3. Lifetime + fade in/out
4. Cursor
5. Shapes (text, model)
6. Lighting/extrusion last — it's polish, not foundation

Don't tune anything before step 2 works. The wind/elastic balance determines everything downstream.

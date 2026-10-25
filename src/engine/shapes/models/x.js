/* The built-in X — a bold letter X, extruded into a solid slab and built
 * here from plain maths, so it ships with no model file and no loader.
 *
 * The outline is twelve points traced clockwise (viewed from the front):
 * two diagonal strokes crossing in a small diamond. Front and back faces are
 * that outline, filled; the sides are one flat quad per outline edge, with
 * their own vertices so each side keeps a hard, flat normal — that is what
 * gives the extrusion its lit and shadowed faces under the Light angle and
 * Shadow sliders.
 *
 * Same output as a model imported from Blender (see scripts/import-model.mjs):
 * { position, normal, index, meshDepth }, 1.0 wide and centred. */

export const meta = { label: 'X', note: '3D' };

const W = 0.5;    // half-width — the whole letter is 1.0 wide
const H = 0.42;   // half-height — a little shorter than wide, like the letter
const A = 0.24;   // width of each stroke where it meets the top and bottom
const C = 0.14;   // height of the diamond where the strokes cross
const Z = 0.1;    // half-depth of the raw slab; the Thickness slider rescales it

// Pick the diamond's side point so the outer edge of each stroke runs exactly
// parallel to its inner edge — an even stroke, not a wedge.
const B = W - (H * A) / (H - C);

const OUTLINE = [
  [-W,      H], [-W + A,  H], [0,  C],
  [ W - A,  H], [ W,      H], [B,  0],
  [ W,     -H], [ W - A, -H], [0, -C],
  [-W + A, -H], [-W,     -H], [-B, 0],
];

// The filled outline, as convex pieces: four arms and the central diamond.
const FACE_TRIANGLES = [
  [0, 1, 2], [0, 2, 11],    // top-left arm
  [3, 4, 5], [3, 5, 2],     // top-right arm
  [6, 7, 8], [6, 8, 5],     // bottom-right arm
  [9, 10, 11], [9, 11, 8],  // bottom-left arm
  [2, 5, 8], [2, 8, 11],    // diamond
];

function build() {
  const position = [];
  const normal = [];
  const index = [];

  const vertex = (x, y, z, nx, ny, nz) => {
    position.push(x, y, z);
    normal.push(nx, ny, nz);
    return position.length / 3 - 1;
  };

  // Front and back faces.
  for (const [z, nz] of [[Z, 1], [-Z, -1]]) {
    const base = position.length / 3;
    for (const [x, y] of OUTLINE) vertex(x, y, z, 0, 0, nz);
    for (const [a, b, c] of FACE_TRIANGLES) index.push(base + a, base + b, base + c);
  }

  // Sides. The outline runs clockwise, so (-dy, dx) points outward.
  for (let i = 0; i < OUTLINE.length; i++) {
    const [x0, y0] = OUTLINE[i];
    const [x1, y1] = OUTLINE[(i + 1) % OUTLINE.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const a = vertex(x0, y0,  Z, nx, ny, 0);
    const b = vertex(x1, y1,  Z, nx, ny, 0);
    const c = vertex(x1, y1, -Z, nx, ny, 0);
    const d = vertex(x0, y0, -Z, nx, ny, 0);
    index.push(a, b, c, a, c, d);
  }

  return { position, normal, index, meshDepth: (2 * Z) / (2 * W) };
}

export default build();

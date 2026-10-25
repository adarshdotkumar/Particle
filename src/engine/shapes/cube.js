/* Cube seeding — pure math, no mesh, same pattern as sphere.js: analytic
   sampling, zero dependencies, unit-testable in plain Node. */
const CUBE_HALF = 1.25; // matches SPHERE_RADIUS, so switching shapes doesn't
                         // change the effect's apparent size

// [normal axis index, sign] per face, two faces per axis.
const FACES = [
  [0,  1], [0, -1], // +x, -x
  [1,  1], [1, -1], // +y, -y
  [2,  1], [2, -1], // +z, -z
];

export function seedFromCube(data, normals, count) {
  const pos = [0, 0, 0];

  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;

    const [axis, sign] = FACES[i % FACES.length];
    const other1 = (axis + 1) % 3;
    const other2 = (axis + 2) % 3;

    const u = Math.random() * 2 - 1;
    const v = Math.random() * 2 - 1;

    pos[axis]   = sign * CUBE_HALF;
    pos[other1] = u * CUBE_HALF;
    pos[other2] = v * CUBE_HALF;

    data[i4 + 0] = pos[0];
    data[i4 + 1] = pos[1];
    data[i4 + 2] = pos[2];
    // 4th slot = "how close to the shape's outline am I?" (1 = on it), same
    // convention as sphere.js. A cube's outline is its face edges, so this is
    // how close (u, v) is to the edge of its face.
    data[i4 + 3] = Math.max(Math.abs(u), Math.abs(v));

    // A cube face's normal is just its fixed axis direction.
    normals[i3 + 0] = 0;
    normals[i3 + 1] = 0;
    normals[i3 + 2] = 0;
    normals[i3 + axis] = sign;
  }
}

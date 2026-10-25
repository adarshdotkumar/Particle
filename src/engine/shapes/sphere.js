/* Sphere seeding — body VERBATIM from reference/particle-effect.html:924-954. */
const SPHERE_RADIUS = 1.25;

export function seedFromSphere(data, normals, count) {
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const i4     = i * 4;
    const i3     = i * 3;
    const y      = 1 - (i / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta  = golden * i;

    const nx = Math.cos(theta) * radius;
    const ny = y;
    const nz = Math.sin(theta) * radius;

    data[i4 + 0] = nx * SPHERE_RADIUS;
    data[i4 + 1] = ny * SPHERE_RADIUS;
    data[i4 + 2] = nz * SPHERE_RADIUS;

    // 4th slot = "how close to the shape's outline am I?" (1 = on it).
    // A sphere has no outline in the flat sense, so we use its silhouette:
    // the ring where the surface turns away from the camera, i.e. z near 0.
    data[i4 + 3] = 1 - Math.abs(nz);

    // A sphere's surface normal is just the direction out from its middle.
    normals[i3 + 0] = nx;
    normals[i3 + 1] = ny;
    normals[i3 + 2] = nz;
  }
}

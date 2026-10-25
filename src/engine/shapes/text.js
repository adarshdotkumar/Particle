/* Text seeding — body VERBATIM from reference/particle-effect.html:956-1090,
   with two documented changes: `depth` is a parameter rather than a read of the
   module-global `params`, and the canvas use is guarded for Node. */
const TEXT_WIDTH   = 2.85; // letters scaled to this many units wide
const STROKE_SHARE = 0.25; // share of the dust that goes to the outline
const OUTLINE_PX   = 0.5;  // how thick that hairline is, in canvas pixels

export function seedFromText(data, normals, count, text, depth) {
  const clean = (text || '').trim();
  if (!clean) return false;
  // Guarded so this module can be imported in Node (tests, SSR): no canvas
  // means no text shape, and the caller falls back to the sphere.
  if (typeof document === 'undefined') return false;

  // Drawn big on purpose: the stroke can never be finer than one pixel of this
  // canvas, so a higher resolution buys a thinner hairline.
  const FONT_PX = 400;
  const PAD     = 52;
  const font    = `bold ${FONT_PX}px ui-sans-serif, -apple-system, "Helvetica Neue", Arial, sans-serif`;

  // Measure first so the canvas is exactly as wide as the word needs.
  const measure = document.createElement('canvas').getContext('2d');
  measure.font  = font;
  const width  = Math.ceil(measure.measureText(clean).width) + PAD * 2;
  const height = Math.ceil(FONT_PX * 1.4) + PAD * 2;

  const canvas  = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.font         = font;
  ctx.fillStyle    = '#fff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(clean, width / 2, height / 2);

  // Collect the lit pixels. Checking the red channel is enough — we drew grey-free.
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const isLit  = new Uint8Array(width * height);
  const lit    = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (pixels[index * 4] > 130) { isLit[index] = 1; lit.push(x, y); }
    }
  }
  if (lit.length === 0) return false;

  /* --- How far inside the letter is each pixel? ------------------------------
     Needed for the 'edges' swirl origin. We flood-fill inwards from the
     outline: every lit pixel touching an unlit one is distance 0, its lit
     neighbours are 1, and so on. One pass over the canvas, done once per shape
     change — so it costs nothing per frame.
     -------------------------------------------------------------------------- */
  const EDGE_PX = 16;   // how deep the "near the edge" band reaches, in pixels
  const dist  = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!isLit[index]) continue;
      const openLeft  = x === 0          || !isLit[index - 1];
      const openRight = x === width - 1  || !isLit[index + 1];
      const openUp    = y === 0          || !isLit[index - width];
      const openDown  = y === height - 1 || !isLit[index + width];
      if (openLeft || openRight || openUp || openDown) {
        dist[index] = 0;
        queue[tail++] = index;
      }
    }
  }

  while (head < tail) {
    const index = queue[head++];
    const next  = dist[index] + 1;
    const x     = index % width;
    const y     = (index - x) / width;

    if (x > 0)          { const j = index - 1;     if (isLit[j] && dist[j] < 0) { dist[j] = next; queue[tail++] = j; } }
    if (x < width - 1)  { const j = index + 1;     if (isLit[j] && dist[j] < 0) { dist[j] = next; queue[tail++] = j; } }
    if (y > 0)          { const j = index - width; if (isLit[j] && dist[j] < 0) { dist[j] = next; queue[tail++] = j; } }
    if (y < height - 1) { const j = index + width; if (isLit[j] && dist[j] < 0) { dist[j] = next; queue[tail++] = j; } }
  }

  /* The edge pixels, pulled out separately. The distance field above already
     knows how deep inside the stroke each pixel sits, so this is just a
     filter — cheap enough to always build. */
  const edgeOnly = [];
  for (let i = 0; i < lit.length; i += 2) {
    const inset = dist[lit[i + 1] * width + lit[i]];
    if (inset >= 0 && inset <= OUTLINE_PX) edgeOnly.push(lit[i], lit[i + 1]);
  }

  // Hair-thin text can end up with no separate edge, so it just comes out solid.
  const hasEdge   = edgeOnly.length > 0;
  const litCount  = lit.length / 2;
  const edgeCount = edgeOnly.length / 2;
  const scale     = TEXT_WIDTH / width;    // world units per canvas pixel
  const halfDepth = depth * 0.5;

  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;

    // Most of the dust fills the letter; a slice of it goes to the outline,
    // which reads as a bright hairline because it packs into a thin band.
    const onEdge = hasEdge && Math.random() < STROKE_SHARE;

    const pool  = onEdge ? edgeOnly : lit;
    const p     = (Math.random() * (onEdge ? edgeCount : litCount)) | 0;
    const ix    = pool[p * 2 + 0];
    const iy    = pool[p * 2 + 1];

    // Jitter inside the chosen pixel, or you can see the pixel grid.
    const px = ix + Math.random();
    const py = iy + Math.random();

    data[i4 + 0] = (px - width / 2) * scale;
    data[i4 + 1] = -(py - height / 2) * scale;
    // Scatter freely through the thickness, so the word reads as a soft cloud
    // of dust rather than two flat sheets. Thickness still sets how deep it is.
    data[i4 + 2] = (Math.random() * 2 - 1) * halfDepth;

    // 4th slot = outline proximity. 1 right on the edge, fading to 0 deep
    // inside the stroke.
    const inset = dist[iy * width + ix];
    data[i4 + 3] = 1 - Math.min(1, (inset < 0 ? EDGE_PX : inset) / EDGE_PX);

    // All the dust faces you, so the light hits every grain the same way and
    // the word stays evenly lit with no bright or shadowed sides.
    normals[i3 + 0] = 0;
    normals[i3 + 1] = 0;
    normals[i3 + 2] = 1;
  }
  return true;
}

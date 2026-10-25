var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsx } from "react/jsx-runtime";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Vector3, Matrix4, Matrix3, Quaternion } from "three";
const MODEL_SHAPES = [
  { mode: "x", label: "X", note: "3D" }
];
const SLIDERS = [
  ["flowStrength", 0, 3, 0.01, "Wind strength", "Smoke ← → shimmer", "Wind"],
  ["flowFrequency", 0.05, 4, 0.01, "Wind scale", "Big swirls ← → fine detail", "Wind"],
  ["flowDrift", 0, 1, 0.01, "Wind drift", "How fast the pattern morphs", "Wind"],
  ["flowInfluence", 0, 1, 0.01, "Wind influence", "Few particles react ← → all of them", "Wind"],
  ["reach", 0.05, 3, 0.01, "Swirl reach", "Hugs the shape ← → long streamers", "Stream"],
  ["escape", 0, 0.6, 5e-3, "Wind escape", "How much peels off into the stream", "Stream"],
  ["streamSpeed", 0, 4, 0.01, "Stream speed", "How far it carries them off-screen", "Stream"],
  ["spring", 0.02, 12, 0.02, "Elastic", "Loose cloud ← → crisp sphere", "Hold"],
  ["progress", 0, 1, 1e-3, "Assemble", "1 = formed, 0 = dust", "Hold"],
  ["mouseStrength", 0, 5, 0.01, "Cursor push", "", "Cursor"],
  ["mouseRadius", 0.1, 3, 0.01, "Cursor radius", "", "Cursor"],
  ["lifeSpeed", 0.05, 2, 0.01, "Recycle speed", "How fast dots fade + respawn", "Dots"],
  ["size", 4e-3, 0.12, 1e-3, "Dot size", "Small stays crisp; big blooms", "Dots"],
  ["glow", 0, 1.5, 0.01, "Glow", "", "Dots"],
  ["depthFade", 0, 1, 0.01, "Depth shading", "Flat disc ← → round ball", "Dots"],
  ["depth", 0, 0.8, 5e-3, "Thickness", "Paper-flat ← → chunky 3D", "3D"],
  ["lightAngle", 0, 360, 1, "Light angle", "Which way the light comes from", "3D"],
  ["shadow", 0, 1, 0.01, "Shadow depth", "Flat lit ← → deep shadows", "3D"]
];
const ORIGIN_KEYS = ["top", "bottom", "left", "right", "center", "edges"];
const DOT_STYLES = ["glow", "solid"];
const SHAPE_MODES = ["sphere", "cube", ...MODEL_SHAPES.map((m) => m.mode), "text", "custom"];
const LEGACY_SHAPE_MODES = { model: "x" };
const COUNTS = [64, 128, 256, 512];
const MAX_TEXT = 24;
const RANGES = Object.freeze(Object.fromEntries(
  SLIDERS.map(([key, min, max, step]) => [key, Object.freeze({ min, max, step })])
));
const NUMERIC_DEFAULTS = {
  flowStrength: 0.55,
  // how hard the invisible wind pushes
  flowFrequency: 0.9,
  // wind scale: low = big lazy swirls, high = fine crackle
  flowDrift: 0.2,
  // how fast the wind pattern itself morphs over time
  flowInfluence: 0.7,
  // what fraction of particles react to the wind at all
  reach: 1.5,
  // hard cap on how far a particle may stray from home
  escape: 0.12,
  // fraction let off the leash to stream away as wind
  streamSpeed: 1.1,
  // how hard the wind shoves them once they're loose
  spring: 3.2,
  // elastic pull home. high = crisp shape, low = loose cloud
  mouseStrength: 1.4,
  // how hard your cursor shoves particles
  mouseRadius: 0.9,
  // size of the invisible bubble around your cursor
  lifeSpeed: 0.55,
  // how quickly dots recycle. high = twinklier
  size: 0.022,
  // dot size. keep small — overlapping dots blow out
  glow: 0.68,
  // brightness. additive, so overlaps stack up
  depthFade: 0.85,
  // dims the far side so the ball looks round, not flat
  depth: 0.18,
  // how thick the letter is. 0 = paper-flat, no shards
  lightAngle: 135,
  // where the light comes from, in degrees
  shadow: 0.75
  // how dark unlit faces go. 0 = no shading at all
};
const NUMERIC_KEYS = Object.keys(NUMERIC_DEFAULTS);
const DEFAULTS = Object.freeze({
  ...NUMERIC_DEFAULTS,
  colA: "#9d8cff",
  colB: "#4be3ff",
  dotStyle: "glow",
  origins: Object.freeze([]),
  shapeMode: "sphere",
  shapeText: "HELLO",
  shapeModelUrl: "",
  count: 256
});
const HEX = /^#[0-9a-f]{6}$/i;
function num(value, fallback, range) {
  const n = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return range ? Math.min(range.max, Math.max(range.min, n)) : n;
}
function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
function normalizeConfig(partial) {
  const input = partial && typeof partial === "object" && !Array.isArray(partial) ? partial : {};
  const out = {};
  for (const key of NUMERIC_KEYS) {
    out[key] = num(input[key], DEFAULTS[key], RANGES[key]);
  }
  out.colA = HEX.test(input.colA) ? input.colA.toLowerCase() : DEFAULTS.colA;
  out.colB = HEX.test(input.colB) ? input.colB.toLowerCase() : DEFAULTS.colB;
  out.dotStyle = oneOf(input.dotStyle, DOT_STYLES, DEFAULTS.dotStyle);
  out.shapeMode = oneOf(LEGACY_SHAPE_MODES[input.shapeMode] ?? input.shapeMode, SHAPE_MODES, DEFAULTS.shapeMode);
  out.origins = Array.isArray(input.origins) ? [...new Set(input.origins)].filter((k) => ORIGIN_KEYS.includes(k)) : [];
  out.shapeText = typeof input.shapeText === "string" ? input.shapeText.trim().slice(0, MAX_TEXT) : DEFAULTS.shapeText;
  out.shapeModelUrl = typeof input.shapeModelUrl === "string" ? input.shapeModelUrl.trim().slice(0, 2e3) : DEFAULTS.shapeModelUrl;
  const wanted = num(input.count, DEFAULTS.count);
  out.count = COUNTS.reduce(
    (best, c) => Math.abs(c - wanted) < Math.abs(best - wanted) ? c : best,
    COUNTS[0]
  );
  return out;
}
function createContext({ canvas, dpr = 2, alpha = true }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha });
  } catch {
    return { renderer: null, supported: false, reason: "no-webgl" };
  }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, dpr));
  renderer.setClearColor(0, alpha ? 0 : 1);
  const gl = renderer.getContext();
  if (!gl.getExtension("EXT_color_buffer_float")) {
    renderer.dispose();
    return { renderer: null, supported: false, reason: "no-float-textures" };
  }
  return { renderer, supported: true, reason: null };
}
const SPHERE_RADIUS = 1.25;
function seedFromSphere(data, normals, count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;
    const y = 1 - i / Math.max(1, count - 1) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const nx = Math.cos(theta) * radius;
    const ny = y;
    const nz = Math.sin(theta) * radius;
    data[i4 + 0] = nx * SPHERE_RADIUS;
    data[i4 + 1] = ny * SPHERE_RADIUS;
    data[i4 + 2] = nz * SPHERE_RADIUS;
    data[i4 + 3] = 1 - Math.abs(nz);
    normals[i3 + 0] = nx;
    normals[i3 + 1] = ny;
    normals[i3 + 2] = nz;
  }
}
const CUBE_HALF = 1.25;
const FACES = [
  [0, 1],
  [0, -1],
  // +x, -x
  [1, 1],
  [1, -1],
  // +y, -y
  [2, 1],
  [2, -1]
  // +z, -z
];
function seedFromCube(data, normals, count) {
  const pos = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;
    const [axis, sign] = FACES[i % FACES.length];
    const other1 = (axis + 1) % 3;
    const other2 = (axis + 2) % 3;
    const u = Math.random() * 2 - 1;
    const v = Math.random() * 2 - 1;
    pos[axis] = sign * CUBE_HALF;
    pos[other1] = u * CUBE_HALF;
    pos[other2] = v * CUBE_HALF;
    data[i4 + 0] = pos[0];
    data[i4 + 1] = pos[1];
    data[i4 + 2] = pos[2];
    data[i4 + 3] = Math.max(Math.abs(u), Math.abs(v));
    normals[i3 + 0] = 0;
    normals[i3 + 1] = 0;
    normals[i3 + 2] = 0;
    normals[i3 + axis] = sign;
  }
}
const TEXT_WIDTH$1 = 2.85;
const STROKE_SHARE = 0.25;
const OUTLINE_PX = 0.5;
function seedFromText(data, normals, count, text, depth) {
  const clean = (text || "").trim();
  if (!clean) return false;
  if (typeof document === "undefined") return false;
  const FONT_PX = 400;
  const PAD = 52;
  const font = `bold ${FONT_PX}px ui-sans-serif, -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = font;
  const width = Math.ceil(measure.measureText(clean).width) + PAD * 2;
  const height = Math.ceil(FONT_PX * 1.4) + PAD * 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(clean, width / 2, height / 2);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const isLit = new Uint8Array(width * height);
  const lit = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (pixels[index * 4] > 130) {
        isLit[index] = 1;
        lit.push(x, y);
      }
    }
  }
  if (lit.length === 0) return false;
  const EDGE_PX = 16;
  const dist = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!isLit[index]) continue;
      const openLeft = x === 0 || !isLit[index - 1];
      const openRight = x === width - 1 || !isLit[index + 1];
      const openUp = y === 0 || !isLit[index - width];
      const openDown = y === height - 1 || !isLit[index + width];
      if (openLeft || openRight || openUp || openDown) {
        dist[index] = 0;
        queue[tail++] = index;
      }
    }
  }
  while (head < tail) {
    const index = queue[head++];
    const next = dist[index] + 1;
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) {
      const j = index - 1;
      if (isLit[j] && dist[j] < 0) {
        dist[j] = next;
        queue[tail++] = j;
      }
    }
    if (x < width - 1) {
      const j = index + 1;
      if (isLit[j] && dist[j] < 0) {
        dist[j] = next;
        queue[tail++] = j;
      }
    }
    if (y > 0) {
      const j = index - width;
      if (isLit[j] && dist[j] < 0) {
        dist[j] = next;
        queue[tail++] = j;
      }
    }
    if (y < height - 1) {
      const j = index + width;
      if (isLit[j] && dist[j] < 0) {
        dist[j] = next;
        queue[tail++] = j;
      }
    }
  }
  const edgeOnly = [];
  for (let i = 0; i < lit.length; i += 2) {
    const inset = dist[lit[i + 1] * width + lit[i]];
    if (inset >= 0 && inset <= OUTLINE_PX) edgeOnly.push(lit[i], lit[i + 1]);
  }
  const hasEdge = edgeOnly.length > 0;
  const litCount = lit.length / 2;
  const edgeCount = edgeOnly.length / 2;
  const scale = TEXT_WIDTH$1 / width;
  const halfDepth = depth * 0.5;
  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;
    const onEdge = hasEdge && Math.random() < STROKE_SHARE;
    const pool = onEdge ? edgeOnly : lit;
    const p = Math.random() * (onEdge ? edgeCount : litCount) | 0;
    const ix = pool[p * 2 + 0];
    const iy = pool[p * 2 + 1];
    const px = ix + Math.random();
    const py = iy + Math.random();
    data[i4 + 0] = (px - width / 2) * scale;
    data[i4 + 1] = -(py - height / 2) * scale;
    data[i4 + 2] = (Math.random() * 2 - 1) * halfDepth;
    const inset = dist[iy * width + ix];
    data[i4 + 3] = 1 - Math.min(1, (inset < 0 ? EDGE_PX : inset) / EDGE_PX);
    normals[i3 + 0] = 0;
    normals[i3 + 1] = 0;
    normals[i3 + 2] = 1;
  }
  return true;
}
const customModelCache = /* @__PURE__ */ new Map();
const TEXT_WIDTH = 2.85;
function computeAreaCdf(position, index) {
  const triCount = index.length / 3;
  const cdf = new Float32Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    const a = index[t * 3 + 0] * 3;
    const b = index[t * 3 + 1] * 3;
    const c = index[t * 3 + 2] * 3;
    const abx = position[b] - position[a];
    const aby = position[b + 1] - position[a + 1];
    const abz = position[b + 2] - position[a + 2];
    const acx = position[c] - position[a];
    const acy = position[c + 1] - position[a + 1];
    const acz = position[c + 2] - position[a + 2];
    total += 0.5 * Math.hypot(
      aby * acz - abz * acy,
      abz * acx - abx * acz,
      abx * acy - aby * acx
    );
    cdf[t] = total;
  }
  for (let t = 0; t < triCount; t++) cdf[t] = total > 0 ? cdf[t] / total : (t + 1) / triCount;
  return cdf;
}
function normalizeMeshArrays(position, index) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const width = Math.max(maxX - minX, 1e-4);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const out = new Float32Array(position.length);
  for (let i = 0; i < position.length; i += 3) {
    out[i] = (position[i] - centerX) / width;
    out[i + 1] = (position[i + 1] - centerY) / width;
    out[i + 2] = (position[i + 2] - centerZ) / width;
  }
  return { position: out, meshDepth: Math.max((maxZ - minZ) / width, 1e-4) };
}
function sampleMesh(data, normals, count, mesh, depth) {
  const { position, normal, index, areaCdf, meshDepth } = mesh;
  const fit = TEXT_WIDTH;
  const zScale = depth / meshDepth;
  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;
    const r = Math.random();
    let lo = 0, hi = areaCdf.length - 1;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (areaCdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const a = index[lo * 3 + 0] * 3;
    const b = index[lo * 3 + 1] * 3;
    const c = index[lo * 3 + 2] * 3;
    let u = Math.random(), v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    data[i4 + 0] = (position[a] * w + position[b] * u + position[c] * v) * fit;
    data[i4 + 1] = (position[a + 1] * w + position[b + 1] * u + position[c + 1] * v) * fit;
    data[i4 + 2] = (position[a + 2] * w + position[b + 2] * u + position[c + 2] * v) * zScale;
    const nx = normal[a] * w + normal[b] * u + normal[c] * v;
    const ny = normal[a + 1] * w + normal[b + 1] * u + normal[c + 1] * v;
    const nz = normal[a + 2] * w + normal[b + 2] * u + normal[c + 2] * v;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[i3 + 0] = nx / len;
    normals[i3 + 1] = ny / len;
    normals[i3 + 2] = nz / len;
    data[i4 + 3] = 1 - Math.abs(nz / len);
  }
  return true;
}
function seedFromCustom(data, normals, count, url, depth) {
  const mesh = customModelCache.get(url);
  if (!mesh) return false;
  return sampleMesh(data, normals, count, mesh, depth);
}
const W = 0.5;
const H = 0.42;
const A = 0.24;
const C = 0.14;
const Z = 0.1;
const B = W - H * A / (H - C);
const OUTLINE = [
  [-W, H],
  [-W + A, H],
  [0, C],
  [W - A, H],
  [W, H],
  [B, 0],
  [W, -H],
  [W - A, -H],
  [0, -C],
  [-W + A, -H],
  [-W, -H],
  [-B, 0]
];
const FACE_TRIANGLES = [
  [0, 1, 2],
  [0, 2, 11],
  // top-left arm
  [3, 4, 5],
  [3, 5, 2],
  // top-right arm
  [6, 7, 8],
  [6, 8, 5],
  // bottom-right arm
  [9, 10, 11],
  [9, 11, 8],
  // bottom-left arm
  [2, 5, 8],
  [2, 8, 11]
  // diamond
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
  for (const [z, nz] of [[Z, 1], [-Z, -1]]) {
    const base = position.length / 3;
    for (const [x, y] of OUTLINE) vertex(x, y, z, 0, 0, nz);
    for (const [a, b, c] of FACE_TRIANGLES) index.push(base + a, base + b, base + c);
  }
  for (let i = 0; i < OUTLINE.length; i++) {
    const [x0, y0] = OUTLINE[i];
    const [x1, y1] = OUTLINE[(i + 1) % OUTLINE.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const a = vertex(x0, y0, Z, nx, ny, 0);
    const b = vertex(x1, y1, Z, nx, ny, 0);
    const c = vertex(x1, y1, -Z, nx, ny, 0);
    const d = vertex(x0, y0, -Z, nx, ny, 0);
    index.push(a, b, c, a, c, d);
  }
  return { position, normal, index, meshDepth: 2 * Z / (2 * W) };
}
const model_x = build();
const withCdf = (mesh) => ({ ...mesh, areaCdf: computeAreaCdf(mesh.position, mesh.index) });
const MODELS = {
  "x": withCdf(model_x)
};
function writeBase({ data, normals, count, config }) {
  let done = false;
  const model = MODELS[config.shapeMode];
  if (model) {
    done = sampleMesh(data, normals, count, model, config.depth);
  }
  if (!done && config.shapeMode === "custom") {
    done = seedFromCustom(data, normals, count, config.shapeModelUrl, config.depth);
  }
  if (!done && config.shapeMode === "text") {
    done = seedFromText(data, normals, count, config.shapeText, config.depth);
  }
  if (!done && config.shapeMode === "cube") {
    seedFromCube(data, normals, count);
    done = true;
  }
  if (!done) seedFromSphere(data, normals, count);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    for (let a = 0; a < 3; a++) {
      const v = data[i4 + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return {
    min,
    // Never zero: a flat shape would divide by zero in the origin masks.
    size: [
      Math.max(max[0] - min[0], 1e-4),
      Math.max(max[1] - min[1], 1e-4),
      Math.max(max[2] - min[2], 1e-4)
    ]
  };
}
const NOISE_GLSL = (
  /* glsl */
  `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
             i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
             i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`
);
const SIM_FRAGMENT = (
  /* glsl */
  `
uniform sampler2D uParticles;   // where every particle was LAST frame
uniform sampler2D uBase;        // each particle's home spot on the sphere
uniform sampler2D uScatter;     // each particle's home spot in the loose cloud

uniform float uSimResolution;
uniform float uTime;
uniform float uDeltaTime;

uniform float uFlowStrength;
uniform float uFlowFrequency;
uniform float uFlowDrift;
uniform float uFlowInfluence;
uniform float uReach;
uniform float uEscape;       // what share is off the leash at any moment
uniform float uStreamSpeed;  // extra shove along the wind once they're loose

// Swirl origins. Each is 0 or 1. uOriginAny is 0 when none are picked, which
// means "blow everywhere" — the unbiased default.
uniform float uOriginTop;
uniform float uOriginBottom;
uniform float uOriginLeft;
uniform float uOriginRight;
uniform float uOriginCenter;
uniform float uOriginEdges;
uniform float uOriginAny;
uniform vec3  uBoundsMin;
uniform vec3  uBoundsSize;
uniform float uSpring;
uniform float uLifeSpeed;
uniform float uProgress;

uniform vec3  uMouseWorldPos;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform float uMouseActive;

${NOISE_GLSL}

// A stable per-particle random number, so the same particle always gets the
// same value every frame without us having to store it anywhere.
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSimResolution;

  vec4 particle = texture2D(uParticles, uv);  // .xyz = position, .a = life
  vec4 base     = texture2D(uBase,    uv);    // .xyz = home spot, .a = edge-ness
  vec3 scatter  = texture2D(uScatter, uv).xyz;

  // WHERE IS "HOME"? Scroll blends between the loose cloud and the sphere.
  vec3 homePos = mix(scatter, base.xyz, uProgress);

  // Lifetime runs 0 -> 1, then the particle silently teleports home and
  // starts again. Keeps the shape from eroding as dots wander off.
  if (particle.a >= 1.0) {
    particle.xyz = homePos;
    particle.a   = fract(particle.a);
    gl_FragColor = particle;
    return;
  }

  // ── FORCE 1: the invisible wind ────────────────────────────────────────
  // Sampled three times at different offsets to get a 3D direction.
  float t = uTime * uFlowDrift;
  vec3 flow = vec3(
    snoise(particle.xyz * uFlowFrequency + vec3( 0.0,  0.0, t)),
    snoise(particle.xyz * uFlowFrequency + vec3(31.4,  0.0, t)),
    snoise(particle.xyz * uFlowFrequency + vec3( 0.0, 71.7, t))
  );
  float flowLen = length(flow);
  vec3  flowDir = flowLen > 1e-5 ? flow / flowLen : vec3(0.0);

  // Not every particle reacts equally — this makes some stream and some sit,
  // which is what stops the motion looking uniform. "Influence" sets how many
  // of them join in. (0.5 = about half react, 1.0 = everything reacts — a
  // common flow-field formulation.)
  float threshold = (uFlowInfluence - 0.5) * -2.0;
  float gust = smoothstep(threshold, 1.0, snoise(base.xyz * 1.7 + vec3(0.0, 0.0, t)));

  // ── WHERE THE SWIRLS START ──────────────────────────────────────────────
  // Judged on the particle's HOME position, not where it currently is — so a
  // particle picked up at the top keeps streaming even once it has blown far
  // away. Judging live position instead would make swirls die the moment they
  // left the zone.
  // Nothing picked = blow on everything, and skip the masks entirely. Every
  // particle takes the same branch, so this costs nothing and saves six
  // smoothsteps per particle whenever no origin is selected (the default).
  if (uOriginAny > 0.5) {
    vec3 unit = (base.xyz - uBoundsMin) / uBoundsSize;   // 0..1 inside the shape

    float zone = 0.0;
    zone = max(zone, uOriginTop    * smoothstep(0.55, 1.0, unit.y));
    zone = max(zone, uOriginBottom * smoothstep(0.55, 1.0, 1.0 - unit.y));
    zone = max(zone, uOriginRight  * smoothstep(0.55, 1.0, unit.x));
    zone = max(zone, uOriginLeft   * smoothstep(0.55, 1.0, 1.0 - unit.x));
    zone = max(zone, uOriginCenter * (1.0 - smoothstep(0.0, 0.45, length(unit.xy - 0.5))));
    zone = max(zone, uOriginEdges  * smoothstep(0.25, 0.9, base.a));

    gust *= zone;
  }

  particle.xyz += flowDir * gust * uFlowStrength * uDeltaTime;

  // ── OFF THE LEASH: a trickle of particles turn into wind ────────────────
  // Each particle has its own fixed random number. Adding a slow creep of time
  // to it makes that number cycle, so a particle spends part of its time in
  // the stream and the rest anchored — and WHICH particles are streaming keeps
  // changing, so the shape never develops permanent holes.
  // The transition is smoothed rather than a hard switch: a particle rejoining
  // the shape eases back instead of snapping home from halfway across screen.
  float phase = fract(hash12(uv) + uTime * 0.03);
  float wind  = 1.0 - smoothstep(uEscape - 0.06, uEscape, phase);

  // No set direction — they just get shoved harder along the wind that is
  // already blowing, and keep going until they leave the picture.
  particle.xyz += flowDir * uStreamSpeed * wind * uDeltaTime;

  // ── FORCE 2: your cursor shoves them away ──────────────────────────────
  // Skipped outright when the pointer has left the window or on touch devices.
  if (uMouseActive > 0.5) {
    vec3  awayRaw = particle.xyz - uMouseWorldPos;
    float dist    = length(awayRaw);
    float falloff = 1.0 - smoothstep(0.0, uMouseRadius, dist);
    vec3  awayDir = dist > 1e-5 ? awayRaw / dist : vec3(0.0, 1.0, 0.0);
    float push    = min(1.0 / max(dist, 0.001), 40.0) * falloff * uMouseStrength;

    particle.xyz += awayDir * push * uDeltaTime;
  }

  // ── FORCE 3: elastic pull back home ────────────────────────────────────
  // THE important one. Without it the wind just blows everything away and
  // you get formless smoke. Note the elastic TIGHTENS as you scroll in, so
  // the shape firms up as it assembles rather than just sliding together.
  // Particles in the stream aren't pulled home — that's what lets them get far.
  float springNow = mix(uSpring * 0.12, uSpring, uProgress) * (1.0 - wind);
  particle.xyz += (homePos - particle.xyz) * springNow * uDeltaTime;

  // ── SWIRL REACH: a leash on how far a particle may stray ───────────────
  // The ramp is the important half. A bare clamp makes particles stack up on
  // an invisible shell, which reads as a bug; easing them in before the limit
  // keeps the edge soft. The clamp then guarantees nothing ever exceeds it.
  // The leash is lifted for anything in the stream, or it could never leave.
  float reachNow = mix(uReach, 1000.0, wind);

  vec3  fromHome = particle.xyz - homePos;
  float strayed  = length(fromHome);

  if (strayed > 1e-5) {
    vec3  strayDir = fromHome / strayed;
    float squeeze  = smoothstep(reachNow * 0.6, reachNow, strayed);
    particle.xyz  -= strayDir * squeeze * strayed * 4.0 * uDeltaTime;

    // That nudge was straight along strayDir, so the new distance follows
    // without measuring it again. Then hard-clamp as a backstop.
    strayed *= 1.0 - squeeze * 4.0 * uDeltaTime;
    if (strayed > reachNow) particle.xyz = homePos + strayDir * reachNow;
  }

  // ── FORCE 4: age it ────────────────────────────────────────────────────
  // Streaming particles age far more slowly. At normal speed they'd respawn
  // long before reaching the edge of the picture; this buys them the time to
  // travel right out of frame before they fade and return home.
  particle.a += uDeltaTime * uLifeSpeed * mix(1.0, 0.15, wind);

  gl_FragColor = particle;
}
`
);
const POINTS_VERTEX = (
  /* glsl */
  `
uniform sampler2D uParticlesTexture;
uniform vec2  uViewResolution;
uniform float uSize;
uniform vec3  uLightDir;   // which way the light travels from
uniform float uShadow;     // how dark an unlit face goes

attribute vec2  aParticlesUv;   // which pixel of the image is "me"
attribute float aSizeJitter;    // so dots aren't all identical
attribute vec3  aNormal;        // which way my bit of surface faces

varying float vLife;
varying float vDepth;   // how far this dot is from the camera
varying float vShade;   // how lit I am, 0 = in shadow, 1 = full light
varying float vFade;    // lifetime fade, worked out once and shared below

void main() {
  vec4 particle = texture2D(uParticlesTexture, aParticlesUv);
  vLife = particle.a;

  vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
  vec4 viewPosition  = viewMatrix * modelPosition;
  gl_Position        = projectionMatrix * viewPosition;

  vDepth = -viewPosition.z;

  // LIGHTING. Classic diffuse: a surface facing the light is bright, one
  // turned away is dark. The letter's front faces point at you while its side
  // walls point outwards, so they catch completely different amounts of light
  // — and THAT is what reads as shard edges and 3D shadow.
  // No model rotation here, so the normal is already in world space.
  // uLightDir arrives already unit-length from JS.
  float lambert = max(dot(normalize(aNormal), uLightDir), 0.0);
  vShade = mix(1.0 - uShadow, 1.0, lambert);

  // Fade in while young, out while dying — no popping. Worked out once here
  // and handed to the fragment shader, so size and opacity can never drift
  // apart the way two separate copies of this would.
  float sizeIn  = smoothstep(0.0, 0.12, particle.a);
  float sizeOut = 1.0 - smoothstep(0.65, 1.0, particle.a);
  vFade = min(sizeIn, sizeOut);

  // Dots further from camera get smaller, like real perspective.
  gl_PointSize  = vFade * aSizeJitter * uSize * uViewResolution.y;
  gl_PointSize *= 1.0 / max(vDepth, 0.001);
  gl_PointSize  = clamp(gl_PointSize, 0.0, 64.0);
}
`
);
const POINTS_FRAGMENT = (
  /* glsl */
  `
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uGlow;
uniform float uDepthFade;   // 0 = flat, 1 = far dots dimmed a lot
uniform float uSolid;       // 0 = soft glowing dots, 1 = hard-edged flat dots

varying float vLife;
varying float vDepth;
varying float vShade;
varying float vFade;

void main() {
  float d = length(gl_PointCoord - 0.5);

  // SOFT (glow): wide falloff. Deliberate — hard-edged dots plus additive
  // blending saturate to a white blob the moment they overlap.
  float soft = 1.0 - smoothstep(0.0, 0.5, d);
  soft *= soft;   // squared = a tighter core with a soft halo

  // HARD (solid): a flat disc, cut off cleanly. Paired with normal blending
  // instead of additive, so the dots stay flat and opaque.
  float hard = d > 0.5 ? 0.0 : 1.0;

  float alpha = mix(soft, hard, uSolid);
  if (alpha <= 0.001) discard;

  // Young dots are colour A, old dots colour B.
  vec3 color = mix(uColorA, uColorB, smoothstep(0.0, 1.0, vLife));

  // DEPTH CUE. Without this, a ball of dots reads as a flat disc, because
  // additive blending lets the back of the sphere shine straight through the
  // front. Dimming the far side is what makes it look round.
  // Range covers the camera-to-shape distance set up in JS (camera z 4.6,
  // shape radius ~1.25, so dots land roughly 3.35 to 5.85 away).
  float far = smoothstep(3.3, 6.0, vDepth);
  float depthDim = mix(1.0, mix(1.0, 0.18, uDepthFade), far);

  gl_FragColor = vec4(color * uGlow * vShade, alpha * vFade * depthDim);

  #include <colorspace_fragment>
}
`
);
const QUAD_VERTEX = "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }";
function makeFloatTarget(res) {
  return new THREE.WebGLRenderTarget(res, res, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false
  });
}
function makeDataTexture(data, res) {
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
const SCATTER_RADIUS = 3.6;
function createSimulation({ renderer, config }) {
  const res = config.count;
  const count = res * res;
  const simScene = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const simQuad = new THREE.Mesh(quadGeometry);
  simScene.add(simQuad);
  const baseData = new Float32Array(count * 4);
  const scatterData = new Float32Array(count * 4);
  const initData = new Float32Array(count * 4);
  const normalData = new Float32Array(count * 3);
  let bounds = writeBase({ data: baseData, normals: normalData, count, config });
  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const r = SCATTER_RADIUS * Math.cbrt(Math.random());
    const sy = Math.random() * 2 - 1;
    const sr = Math.sqrt(Math.max(0, 1 - sy * sy));
    const st = Math.random() * Math.PI * 2;
    scatterData[i4 + 0] = Math.cos(st) * sr * r;
    scatterData[i4 + 1] = sy * r * 0.7;
    scatterData[i4 + 2] = Math.sin(st) * sr * r;
    scatterData[i4 + 3] = 1;
    initData[i4 + 0] = scatterData[i4 + 0];
    initData[i4 + 1] = scatterData[i4 + 1];
    initData[i4 + 2] = scatterData[i4 + 2];
    initData[i4 + 3] = Math.random();
  }
  const baseTexture = makeDataTexture(baseData, res);
  const scatterTexture = makeDataTexture(scatterData, res);
  const initTexture = makeDataTexture(initData, res);
  const targets = [makeFloatTarget(res), makeFloatTarget(res)];
  const simMaterial = new THREE.ShaderMaterial({
    fragmentShader: SIM_FRAGMENT,
    vertexShader: QUAD_VERTEX,
    uniforms: {
      uParticles: { value: null },
      uBase: { value: baseTexture },
      uScatter: { value: scatterTexture },
      uSimResolution: { value: res },
      uTime: { value: 0 },
      uDeltaTime: { value: 0 },
      uFlowStrength: { value: config.flowStrength },
      uFlowFrequency: { value: config.flowFrequency },
      uFlowDrift: { value: config.flowDrift },
      uFlowInfluence: { value: config.flowInfluence },
      uReach: { value: config.reach },
      uEscape: { value: config.escape },
      uStreamSpeed: { value: config.streamSpeed },
      uOriginTop: { value: 0 },
      uOriginBottom: { value: 0 },
      uOriginLeft: { value: 0 },
      uOriginRight: { value: 0 },
      uOriginCenter: { value: 0 },
      uOriginEdges: { value: 0 },
      uOriginAny: { value: 0 },
      uBoundsMin: { value: new THREE.Vector3() },
      uBoundsSize: { value: new THREE.Vector3(1, 1, 1) },
      uSpring: { value: config.spring },
      uLifeSpeed: { value: config.lifeSpeed },
      uProgress: { value: 1 },
      uMouseWorldPos: { value: new THREE.Vector3(999, 999, 999) },
      uMouseStrength: { value: config.mouseStrength },
      uMouseRadius: { value: config.mouseRadius },
      uMouseActive: { value: 0 }
    }
  });
  const copyMaterial = new THREE.ShaderMaterial({
    fragmentShader: `
      uniform sampler2D uSource;
      uniform float uRes;
      void main() { gl_FragColor = texture2D(uSource, gl_FragCoord.xy / uRes); }
    `,
    vertexShader: QUAD_VERTEX,
    uniforms: { uSource: { value: initTexture }, uRes: { value: res } }
  });
  simQuad.material = copyMaterial;
  for (const target of targets) {
    renderer.setRenderTarget(target);
    renderer.render(simScene, simCamera);
  }
  renderer.setRenderTarget(null);
  copyMaterial.dispose();
  initTexture.dispose();
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const sizeJitter = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    uvs[i * 2 + 0] = (i % res + 0.5) / res;
    uvs[i * 2 + 1] = (Math.floor(i / res) + 0.5) / res;
    sizeJitter[i] = 0.4 + Math.random() * 1.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aParticlesUv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aSizeJitter", new THREE.BufferAttribute(sizeJitter, 1));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(normalData, 3));
  const solid = config.dotStyle === "solid";
  const pointsMaterial = new THREE.ShaderMaterial({
    vertexShader: POINTS_VERTEX,
    fragmentShader: POINTS_FRAGMENT,
    uniforms: {
      uParticlesTexture: { value: targets[0].texture },
      // Set by the engine's resize handler — the simulation must never read
      // innerWidth, or it could not be scoped to a container.
      uViewResolution: { value: new THREE.Vector2(1, 1) },
      uSize: { value: config.size },
      uGlow: { value: config.glow },
      uDepthFade: { value: config.depthFade },
      uSolid: { value: solid ? 1 : 0 },
      uLightDir: { value: new THREE.Vector3(0, 0, 1) },
      uShadow: { value: config.shadow },
      uColorA: { value: new THREE.Color(config.colA) },
      uColorB: { value: new THREE.Color(config.colB) }
    },
    // Additive: overlapping dots ADD their brightness, so dense areas bloom.
    // Solid style uses normal blending instead, so dots stay flat and opaque.
    // No depth writing either way, or dots would hide each other.
    transparent: true,
    blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const points = new THREE.Points(geometry, pointsMaterial);
  points.frustumCulled = false;
  const su = simMaterial.uniforms;
  const pu = pointsMaterial.uniforms;
  let front = 0;
  let lastDotStyle = config.dotStyle;
  const lightDir = new THREE.Vector3();
  const pushBounds = () => {
    su.uBoundsMin.value.set(bounds.min[0], bounds.min[1], bounds.min[2]);
    su.uBoundsSize.value.set(bounds.size[0], bounds.size[1], bounds.size[2]);
  };
  pushBounds();
  return {
    res,
    count,
    points,
    /** Bounding box of the current shape, in world units. */
    get bounds() {
      return bounds;
    },
    get front() {
      return front;
    },
    /** Pushes the whole config into uniforms. Called every frame — it is only
     *  a few dozen assignments, and it means "set a slider" needs no
     *  bookkeeping anywhere else. Mirrors the original's tick(). */
    applyConfig(config2) {
      su.uFlowStrength.value = config2.flowStrength;
      su.uFlowFrequency.value = config2.flowFrequency;
      su.uFlowDrift.value = config2.flowDrift;
      su.uFlowInfluence.value = config2.flowInfluence;
      su.uReach.value = config2.reach;
      su.uEscape.value = config2.escape;
      su.uStreamSpeed.value = config2.streamSpeed;
      su.uSpring.value = config2.spring;
      su.uLifeSpeed.value = config2.lifeSpeed;
      su.uMouseStrength.value = config2.mouseStrength;
      su.uMouseRadius.value = config2.mouseRadius;
      const origins = config2.origins;
      su.uOriginTop.value = origins.includes("top") ? 1 : 0;
      su.uOriginBottom.value = origins.includes("bottom") ? 1 : 0;
      su.uOriginLeft.value = origins.includes("left") ? 1 : 0;
      su.uOriginRight.value = origins.includes("right") ? 1 : 0;
      su.uOriginCenter.value = origins.includes("center") ? 1 : 0;
      su.uOriginEdges.value = origins.includes("edges") ? 1 : 0;
      su.uOriginAny.value = origins.length > 0 ? 1 : 0;
      pu.uSize.value = config2.size;
      pu.uGlow.value = config2.glow;
      pu.uDepthFade.value = config2.depthFade;
      pu.uShadow.value = config2.shadow;
      pu.uColorA.value.set(config2.colA);
      pu.uColorB.value.set(config2.colB);
      const lightRad = config2.lightAngle * Math.PI / 180;
      lightDir.set(Math.cos(lightRad) * 0.85, Math.sin(lightRad) * 0.85, 0.5).normalize();
      pu.uLightDir.value.copy(lightDir);
      if (config2.dotStyle !== lastDotStyle) {
        const isSolid = config2.dotStyle === "solid";
        pu.uSolid.value = isSolid ? 1 : 0;
        pointsMaterial.blending = isSolid ? THREE.NormalBlending : THREE.AdditiveBlending;
        pointsMaterial.needsUpdate = true;
        lastDotStyle = config2.dotStyle;
      }
    },
    /** One frame: read the front buffer, write the back one, swap, then point
     *  the dots at what we just wrote. */
    step(renderer2, delta, time, live) {
      su.uTime.value = time;
      su.uDeltaTime.value = delta;
      su.uProgress.value = live.progress;
      su.uMouseActive.value = live.mouseActive;
      su.uMouseWorldPos.value.copy(live.mouse);
      const back = 1 - front;
      su.uParticles.value = targets[front].texture;
      simQuad.material = simMaterial;
      renderer2.setRenderTarget(targets[back]);
      renderer2.render(simScene, simCamera);
      renderer2.setRenderTarget(null);
      front = back;
      pu.uParticlesTexture.value = targets[front].texture;
    },
    /** The cheap shape morph: rewrite the "home spots" image and let the
     *  elastic that is already running pull the particles to the new shape.
     *  No rebuild, no restart — they FLY there. */
    reseed(config2) {
      bounds = writeBase({ data: baseData, normals: normalData, count, config: config2 });
      baseTexture.needsUpdate = true;
      geometry.getAttribute("aNormal").needsUpdate = true;
      pushBounds();
    },
    /** Canvas size in device pixels — drives point scaling. */
    setViewSize(width, height) {
      pu.uViewResolution.value.set(width, height);
    },
    dispose() {
      geometry.dispose();
      quadGeometry.dispose();
      pointsMaterial.dispose();
      simMaterial.dispose();
      targets.forEach((t) => t.dispose());
      baseTexture.dispose();
      scatterTexture.dispose();
      simScene.remove(simQuad);
    }
  };
}
class GltfError extends Error {
}
const fail = (message) => {
  throw new GltfError(message);
};
const GLB_MAGIC = 1179937895;
const CHUNK_JSON = 1313821514;
const CHUNK_BIN = 5130562;
const view = (bytes) => bytes instanceof ArrayBuffer ? new DataView(bytes) : new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
function decodeDataUri(uri) {
  const binary = atob(uri.slice(uri.indexOf(",") + 1));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function readFile(bytes, loadBuffer) {
  const data = view(bytes);
  if (data.byteLength >= 12 && data.getUint32(0, true) === GLB_MAGIC) {
    let json2 = null;
    let bin = null;
    let offset = 12;
    while (offset + 8 <= data.byteLength) {
      const length = data.getUint32(offset, true);
      const type = data.getUint32(offset + 4, true);
      const chunk = new Uint8Array(data.buffer, data.byteOffset + offset + 8, length);
      if (type === CHUNK_JSON) json2 = JSON.parse(new TextDecoder().decode(chunk));
      if (type === CHUNK_BIN) bin = chunk;
      offset += 8 + length;
    }
    if (!json2) fail("That .glb has no JSON chunk — is it a valid glTF binary?");
    return { json: json2, buffers: [bin] };
  }
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));
  } catch {
    fail("That isn't a glTF file. Export from Blender as glTF Binary (.glb).");
  }
  const buffers = await Promise.all((json.buffers ?? []).map(async ({ uri }) => {
    if (uri?.startsWith("data:")) return decodeDataUri(uri);
    if (!loadBuffer) fail("This .gltf keeps its data in a separate file. Export as glTF Binary (.glb) instead.");
    const loaded = await loadBuffer(uri);
    return loaded instanceof ArrayBuffer ? new Uint8Array(loaded) : loaded;
  }));
  return { json, buffers };
}
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const READERS = {
  5120: ["getInt8", 1, 127],
  5121: ["getUint8", 1, 255],
  5122: ["getInt16", 2, 32767],
  5123: ["getUint16", 2, 65535],
  5125: ["getUint32", 4, 0],
  5126: ["getFloat32", 4, 0]
};
function readAccessor({ json, buffers }, index) {
  const accessor = json.accessors[index];
  if (accessor.sparse) fail("Sparse accessors are not supported. Re-export without them.");
  const bufferView = json.bufferViews[accessor.bufferView];
  const data = view(buffers[bufferView.buffer]);
  const [getter, size, max] = READERS[accessor.componentType];
  const components = COMPONENTS[accessor.type];
  const stride = bufferView.byteStride || size * components;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out = new Array(accessor.count * components);
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < components; c++) {
      let value = data[getter](start + i * stride + c * size, true);
      if (accessor.normalized && max) value = Math.max(value / max, -1);
      out[i * components + c] = value;
    }
  }
  return out;
}
function localMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(
    new Vector3(...node.translation ?? [0, 0, 0]),
    new Quaternion(...node.rotation ?? [0, 0, 0, 1]),
    new Vector3(...node.scale ?? [1, 1, 1])
  );
}
function faceNormals(pos, idx) {
  const out = new Array(pos.length).fill(0);
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromArray(pos, idx[t] * 3);
    b.fromArray(pos, idx[t + 1] * 3);
    c.fromArray(pos, idx[t + 2] * 3);
    const face = b.clone().sub(a).cross(c.clone().sub(a));
    for (const i of [idx[t], idx[t + 1], idx[t + 2]]) {
      out[i * 3] += face.x;
      out[i * 3 + 1] += face.y;
      out[i * 3 + 2] += face.z;
    }
  }
  return out;
}
async function parseGltf(bytes, loadBuffer) {
  const gltf = await readFile(bytes, loadBuffer);
  const { json } = gltf;
  const compressed = (json.extensionsUsed ?? []).filter((e) => /draco|meshopt/i.test(e));
  if (compressed.length) {
    fail(`This file is compressed (${compressed.join(", ")}). In Blender's glTF export, turn Compression off and export again.`);
  }
  const position = [];
  const normal = [];
  const index = [];
  let skipped = 0;
  const v = new Vector3();
  const n = new Vector3();
  const visit = (nodeIndex, parent) => {
    const node = json.nodes[nodeIndex];
    const world = parent.clone().multiply(localMatrix(node));
    if (node.mesh !== void 0) {
      const normalMatrix = new Matrix3().getNormalMatrix(world);
      for (const primitive of json.meshes[node.mesh].primitives) {
        if ((primitive.mode ?? 4) !== 4 || primitive.attributes.POSITION === void 0) {
          skipped++;
          continue;
        }
        const pos = readAccessor(gltf, primitive.attributes.POSITION);
        const idx = primitive.indices !== void 0 ? readAccessor(gltf, primitive.indices) : Array.from({ length: pos.length / 3 }, (_, i) => i);
        const nor = primitive.attributes.NORMAL !== void 0 ? readAccessor(gltf, primitive.attributes.NORMAL) : faceNormals(pos, idx);
        const base = position.length / 3;
        for (let i = 0; i < pos.length / 3; i++) {
          v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(world);
          position.push(v.x, v.y, v.z);
          n.set(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]).applyMatrix3(normalMatrix).normalize();
          normal.push(n.x, n.y, n.z);
        }
        for (const i of idx) index.push(base + i);
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  const roots = scene ? scene.nodes : (json.nodes ?? []).map((_, i) => i);
  for (const root of roots) visit(root, new Matrix4());
  if (index.length === 0) fail("No triangle geometry found in that file.");
  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint32Array(index),
    skipped
  };
}
const pending = /* @__PURE__ */ new Map();
const fetchBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.arrayBuffer();
};
function loadCustomModel(url) {
  if (customModelCache.has(url)) return Promise.resolve();
  if (pending.has(url)) return pending.get(url);
  const load = (async () => {
    const bytes = await fetchBytes(url);
    const merged = await parseGltf(bytes, (uri) => fetchBytes(new URL(uri, new URL(url, location.href)).href));
    const { position, meshDepth } = normalizeMeshArrays(merged.position, merged.index);
    const areaCdf = computeAreaCdf(position, merged.index);
    customModelCache.set(url, {
      position,
      normal: merged.normal,
      index: merged.index,
      areaCdf,
      meshDepth
    });
  })().finally(() => pending.delete(url));
  pending.set(url, load);
  return load;
}
const MOBILE_QUERY = "(max-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SETTLE_STEPS = 140;
const SETTLE_DELTA = 1 / 60;
const matches = (query) => typeof matchMedia === "function" ? matchMedia(query).matches : false;
let ParticleField$1 = class ParticleField {
  constructor(options = {}) {
    __publicField(this, "_tick", () => {
      if (this.destroyed || !this.isRunning) return;
      const delta = Math.min(this._clock.getDelta(), 1 / 30);
      const time = this._clock.getElapsedTime();
      this._mouseSmooth.lerp(this._mouseTarget, 0.18);
      this._sim.applyConfig(this._config);
      this._sim.step(this._renderer, delta, time, this._live());
      this._renderer.render(this._scene, this._camera);
      this._fpsAccum += delta;
      this._fpsFrames++;
      if (this._fpsAccum >= 0.5) {
        this._fps = this._fpsFrames / this._fpsAccum;
        this._fpsAccum = 0;
        this._fpsFrames = 0;
      }
      this._raf = requestAnimationFrame(this._tick);
    });
    const {
      container,
      config = {},
      mode = "container",
      progress = "auto",
      pointer = true,
      autoPause = true,
      respectReducedMotion = true,
      dpr = 2,
      mobileCount = 128,
      onUnsupported = null
    } = options;
    const host = typeof container === "string" ? document.querySelector(container) : container;
    if (!host) throw new Error("ParticleField: container not found");
    this.container = host;
    this.mode = mode === "background" ? "background" : "container";
    this.pointerEnabled = pointer;
    this.autoPause = autoPause;
    this.supported = false;
    this.isRunning = false;
    this.destroyed = false;
    this._config = normalizeConfig(config);
    this._clampCountForDevice(mobileCount);
    this._progressMode = progress === "auto" ? this.mode === "background" ? "scroll" : "fixed" : typeof progress === "number" ? "fixed" : progress;
    this._progress = typeof progress === "number" ? clamp01(progress) : 1;
    this._reducedMotion = respectReducedMotion && matches(REDUCED_MOTION_QUERY);
    this._canvas = document.createElement("canvas");
    this._styleCanvas();
    this.container.appendChild(this._canvas);
    this.element = this._canvas;
    const { renderer, supported, reason } = createContext({ canvas: this._canvas, dpr });
    if (!supported) {
      this.unsupportedReason = reason;
      this._canvas.remove();
      this._canvas = null;
      this.element = null;
      if (typeof onUnsupported === "function") onUnsupported({ reason });
      return;
    }
    this.supported = true;
    this._renderer = renderer;
    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this._camera.position.set(0, 0, 4.6);
    this._clock = new THREE.Clock();
    this._raf = 0;
    this._fps = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._raycaster = new THREE.Raycaster();
    this._pointerNdc = new THREE.Vector2(0, 0);
    this._mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this._mouseTarget = new THREE.Vector3(999, 999, 999);
    this._mouseSmooth = new THREE.Vector3(999, 999, 999);
    this._mouseActive = 0;
    this._sim = createSimulation({ renderer, config: this._config });
    this._scene.add(this._sim.points);
    this._sim.applyConfig(this._config);
    this._ensureCustomModel();
    this._bindListeners();
    this.resize();
    if (this._reducedMotion) {
      this._renderStaticFrame();
    } else {
      this._clock.getDelta();
      this._visible = true;
      this.play();
    }
  }
  /* ── public API ──────────────────────────────────────────────────────── */
  /** Merge a partial config in and take the cheapest path to apply it. */
  set(partial = {}) {
    if (!this.supported || this.destroyed) return this;
    const next = normalizeConfig({ ...this._config, ...partial });
    if (next.count !== this._config.count) {
      this._config = next;
      this._rebuild();
      return this;
    }
    const reseed = next.shapeMode !== this._config.shapeMode || next.shapeText !== this._config.shapeText || next.shapeModelUrl !== this._config.shapeModelUrl || next.depth !== this._config.depth;
    this._config = next;
    if (reseed) {
      this._sim.reseed(next);
      this._ensureCustomModel();
    }
    this._sim.applyConfig(next);
    if (!this.isRunning) this._renderOnce();
    return this;
  }
  getConfig() {
    return { ...this._config };
  }
  /** 1 = formed shape, 0 = scattered dust. Switches off scroll driving. */
  setProgress(value) {
    this._progressMode = "fixed";
    this._progress = clamp01(value);
    if (!this.isRunning) this._renderOnce();
    return this;
  }
  getProgress() {
    return this._progress;
  }
  /** 'scroll' | 'fixed' — what drives progress. */
  setProgressMode(mode) {
    this._progressMode = mode === "scroll" ? "scroll" : "fixed";
    return this;
  }
  getStats() {
    return { fps: Math.round(this._fps), count: this._sim ? this._sim.count : 0 };
  }
  play() {
    if (!this.supported || this.destroyed || this.isRunning) return this;
    if (this.autoPause && this._visible === false) return this;
    if (typeof document !== "undefined" && document.hidden) return this;
    this.isRunning = true;
    this._clock.getDelta();
    this._raf = requestAnimationFrame(this._tick);
    return this;
  }
  pause() {
    this.isRunning = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    return this;
  }
  /** Re-read the container's size. Called by the ResizeObserver; safe to call
   *  by hand if you resize the container in a way the observer misses. */
  resize() {
    if (!this.supported || this.destroyed) return this;
    const { width, height } = this._measure();
    if (width < 1 || height < 1) return this;
    this._renderer.setSize(width, height, false);
    this._canvas.style.width = `${width}px`;
    this._canvas.style.height = `${height}px`;
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    const ratio = this._renderer.getPixelRatio();
    this._sim.setViewSize(width * ratio, height * ratio);
    if (!this.isRunning) this._renderOnce();
    return this;
  }
  /** Total teardown. Idempotent. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pause();
    this._unbindListeners();
    if (this._sim) {
      this._scene.remove(this._sim.points);
      this._sim.dispose();
      this._sim = null;
    }
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer.forceContextLoss();
      this._renderer = null;
    }
    if (this._canvas) {
      this._canvas.remove();
      this._canvas = null;
    }
    this._scene = null;
    this._camera = null;
    this.element = null;
  }
  /* ── internals ───────────────────────────────────────────────────────── */
  _clampCountForDevice(mobileCount) {
    if (matches(MOBILE_QUERY) && this._config.count > mobileCount) {
      this._config = normalizeConfig({ ...this._config, count: mobileCount });
    }
  }
  _styleCanvas() {
    const s = this._canvas.style;
    s.display = "block";
    if (this.mode === "background") {
      s.position = "fixed";
      s.inset = "0";
      s.width = "100%";
      s.height = "100%";
      s.pointerEvents = "none";
      s.zIndex = s.zIndex || "0";
    } else {
      s.position = "absolute";
      s.inset = "0";
      s.width = "100%";
      s.height = "100%";
      s.pointerEvents = "none";
      const position = getComputedStyle(this.container).position;
      if (position === "static") this.container.style.position = "relative";
    }
  }
  _measure() {
    if (this.mode === "background") {
      return { width: innerWidth, height: innerHeight };
    }
    return {
      width: Math.round(this.container.clientWidth),
      height: Math.round(this.container.clientHeight)
    };
  }
  _bindListeners() {
    this._onPointerMove = (event) => {
      const rect = this._canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      this._pointerNdc.x = (event.clientX - rect.left) / rect.width * 2 - 1;
      this._pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointerNdc, this._camera);
      this._raycaster.ray.intersectPlane(this._mousePlane, this._mouseTarget);
      this._mouseActive = 1;
    };
    this._onPointerLeave = () => {
      this._mouseActive = 0;
    };
    this._onVisibility = () => {
      if (document.hidden) this.pause();
      else this.play();
    };
    this._pointerHost = this.mode === "background" ? window : this.container;
    if (this.pointerEnabled) {
      this._pointerHost.addEventListener("pointermove", this._onPointerMove, { passive: true });
      this._pointerHost.addEventListener("pointerleave", this._onPointerLeave);
    }
    document.addEventListener("visibilitychange", this._onVisibility);
    if (this.mode === "background") {
      this._onWindowResize = () => this.resize();
      window.addEventListener("resize", this._onWindowResize);
    } else if (typeof ResizeObserver === "function") {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this.container);
    } else {
      this._onWindowResize = () => this.resize();
      window.addEventListener("resize", this._onWindowResize);
    }
    if (this.autoPause && typeof IntersectionObserver === "function") {
      this._visible = void 0;
      this._intersectionObserver = new IntersectionObserver((entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        this._visible = visible;
        if (this._reducedMotion) return;
        if (visible) this.play();
        else this.pause();
      }, { rootMargin: "10%" });
      this._intersectionObserver.observe(this.container);
    }
  }
  _unbindListeners() {
    if (this.pointerEnabled && this._pointerHost) {
      this._pointerHost.removeEventListener("pointermove", this._onPointerMove);
      this._pointerHost.removeEventListener("pointerleave", this._onPointerLeave);
    }
    document.removeEventListener("visibilitychange", this._onVisibility);
    if (this._onWindowResize) window.removeEventListener("resize", this._onWindowResize);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._intersectionObserver) this._intersectionObserver.disconnect();
    this._resizeObserver = null;
    this._intersectionObserver = null;
    this._pointerHost = null;
  }
  /** A 'custom' shape names a model by URL. Until it has loaded, writeBase
   *  shows the sphere; once it arrives, re-seed so the particles fly onto
   *  it. A URL that fails to load just leaves the sphere, with a warning. */
  _ensureCustomModel() {
    const { shapeMode, shapeModelUrl: url } = this._config;
    if (shapeMode !== "custom" || !url || customModelCache.has(url)) return;
    loadCustomModel(url).then(() => {
      const still = !this.destroyed && this._config.shapeMode === "custom" && this._config.shapeModelUrl === url;
      if (!still) return;
      this._sim.reseed(this._config);
      if (this._reducedMotion) this._renderStaticFrame();
      else if (!this.isRunning) this._renderOnce();
    }, (error) => {
      console.warn(`[particle-field] couldn't load the model at ${url} — showing a sphere instead.`, error);
    });
  }
  _rebuild() {
    this._scene.remove(this._sim.points);
    this._sim.dispose();
    this._sim = createSimulation({ renderer: this._renderer, config: this._config });
    this._scene.add(this._sim.points);
    this._sim.applyConfig(this._config);
    this._ensureCustomModel();
    this.resize();
    if (this._reducedMotion) this._renderStaticFrame();
  }
  /** REVERSED on purpose, as in the original: the shape is whole at the start
   *  and comes apart as you scroll. So progress runs 1 -> 0.
   *
   *  Background mode measures the whole page. Container mode measures the
   *  element's own travel through the viewport, so a hero halfway down someone
   *  else's page assembles as it arrives instead of being governed by where
   *  the page as a whole happens to be scrolled. */
  _readScrollProgress() {
    if (this.mode === "background") {
      const max = document.documentElement.scrollHeight - innerHeight;
      const scrolled = max > 0 ? clamp01(scrollY / max) : 0;
      return 1 - scrolled;
    }
    const rect = this.container.getBoundingClientRect();
    const travel = innerHeight + rect.height;
    if (travel <= 0) return 1;
    const passed = clamp01((innerHeight - rect.top) / travel);
    return 1 - Math.abs(passed * 2 - 1);
  }
  _live() {
    if (this._progressMode === "scroll") this._progress = this._readScrollProgress();
    return {
      progress: this._progress,
      mouse: this._mouseSmooth,
      mouseActive: this._mouseActive
    };
  }
  /** Draw the current state without advancing the simulation. */
  _renderOnce() {
    if (!this.supported || this.destroyed) return;
    this._sim.applyConfig(this._config);
    this._live();
    this._renderer.render(this._scene, this._camera);
  }
  /** Reduced motion: settle the shape with fixed steps, draw it once, and
   *  never schedule a frame. The user still sees the design, just still. */
  _renderStaticFrame() {
    const live = this._live();
    live.mouseActive = 0;
    this._sim.applyConfig(this._config);
    for (let i = 0; i < SETTLE_STEPS; i++) {
      this._sim.step(this._renderer, SETTLE_DELTA, i * SETTLE_DELTA, live);
    }
    this._renderer.render(this._scene, this._camera);
  }
};
function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
function useParticleField(config = {}, options = {}) {
  const ref = useRef(null);
  const fieldRef = useRef(null);
  const [supported, setSupported] = useState(true);
  const {
    mode = "container",
    progress = "auto",
    pointer = true,
    autoPause = true,
    respectReducedMotion = true,
    dpr = 2,
    mobileCount = 128,
    onUnsupported
  } = options;
  useEffect(() => {
    if (!ref.current) return void 0;
    const field = new ParticleField$1({
      container: ref.current,
      config,
      mode,
      progress,
      pointer,
      autoPause,
      respectReducedMotion,
      dpr,
      mobileCount,
      onUnsupported: (info) => {
        setSupported(false);
        onUnsupported?.(info);
      }
    });
    fieldRef.current = field;
    return () => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [mode, progress, pointer, autoPause, respectReducedMotion, dpr, mobileCount]);
  useEffect(() => {
    fieldRef.current?.set(config);
  }, [serialise(config)]);
  return { ref, field: fieldRef.current, supported };
}
function ParticleField2({
  config = {},
  mode,
  progress,
  pointer,
  autoPause,
  respectReducedMotion,
  dpr,
  mobileCount,
  onUnsupported,
  style,
  children,
  ...rest
}) {
  const { ref } = useParticleField(config, {
    mode,
    progress,
    pointer,
    autoPause,
    respectReducedMotion,
    dpr,
    mobileCount,
    onUnsupported
  });
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      style: { position: "relative", width: "100%", height: "100%", ...style },
      ...rest,
      children
    }
  );
}
function serialise(config) {
  return JSON.stringify(config, Object.keys(config ?? {}).sort());
}
export {
  ParticleField2 as ParticleField,
  ParticleField2 as default,
  useParticleField
};

import * as THREE from 'three';
import { writeBase } from './shapes/index.js';
import SIM_FRAGMENT from './shaders/sim.frag.js';
import POINTS_VERTEX from './shaders/points.vert.js';
import POINTS_FRAGMENT from './shaders/points.frag.js';
import QUAD_VERTEX from './shaders/quad.vert.js';

/* The GPGPU simulation — adapted from reference/particle-effect.html:889-1441.
 *
 * THE BIG IDEA (from the original, and still true):
 * We never keep a JavaScript list of particles. We keep a small IMAGE where
 * each pixel is one particle: red = X, green = Y, blue = Z, alpha = how far
 * through its life it is. Every frame a shader runs over that whole image at
 * once, moving every particle simultaneously. Then we draw one dot per pixel,
 * each reading its own position back out of the image.
 *
 * The structural change from the original: simScene / simCamera / simQuad were
 * module-level singletons. Two effects on one page would fight over
 * simQuad.material mid-frame, so each simulation now owns its own quad.
 */

function makeFloatTarget(res) {
  return new THREE.WebGLRenderTarget(res, res, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

function makeDataTexture(data, res) {
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const SCATTER_RADIUS = 3.60; // how wide the scattered cloud spreads

/** Builds everything that depends on the particle count. The caller adds
 *  `sim.points` to its own scene. */
export function createSimulation({ renderer, config }) {
  const res = config.count;
  const count = res * res;

  /* --- A tiny offscreen setup whose only job is to run a shader over an
         image. Per-instance, unlike the original's module singletons. ------- */
  const simScene = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const simQuad = new THREE.Mesh(quadGeometry);
  simScene.add(simQuad);

  /* --- Seed the two "home" images ------------------------------------- */
  const baseData    = new Float32Array(count * 4);
  const scatterData = new Float32Array(count * 4);
  const initData    = new Float32Array(count * 4);
  const normalData  = new Float32Array(count * 3);   // which way each bit of
                                                     // surface faces, for lighting

  let bounds = writeBase({ data: baseData, normals: normalData, count, config });

  for (let i = 0; i < count; i++) {
    const i4 = i * 4;

    // scatter: a loose ball of random positions, denser in the middle
    const r  = SCATTER_RADIUS * Math.cbrt(Math.random());
    const sy = Math.random() * 2 - 1;
    const sr = Math.sqrt(Math.max(0, 1 - sy * sy));
    const st = Math.random() * Math.PI * 2;

    scatterData[i4 + 0] = Math.cos(st) * sr * r;
    scatterData[i4 + 1] = sy * r * 0.7;
    scatterData[i4 + 2] = Math.sin(st) * sr * r;
    scatterData[i4 + 3] = 1;

    // Starting state: sitting at the scattered spot, with lives staggered
    // randomly so they don't all blink at the same moment.
    initData[i4 + 0] = scatterData[i4 + 0];
    initData[i4 + 1] = scatterData[i4 + 1];
    initData[i4 + 2] = scatterData[i4 + 2];
    initData[i4 + 3] = Math.random();
  }

  const baseTexture    = makeDataTexture(baseData, res);
  const scatterTexture = makeDataTexture(scatterData, res);
  const initTexture    = makeDataTexture(initData, res);

  /* --- The two ping-pong buffers -------------------------------------- */
  // You cannot read and write the same image at once, so we keep two and
  // alternate: read A, write B, swap. Like two sheets of tracing paper.
  const targets = [makeFloatTarget(res), makeFloatTarget(res)];

  const simMaterial = new THREE.ShaderMaterial({
    fragmentShader: SIM_FRAGMENT,
    vertexShader: QUAD_VERTEX,
    uniforms: {
      uParticles:     { value: null },
      uBase:          { value: baseTexture },
      uScatter:       { value: scatterTexture },
      uSimResolution: { value: res },
      uTime:          { value: 0 },
      uDeltaTime:     { value: 0 },
      uFlowStrength:  { value: config.flowStrength },
      uFlowFrequency: { value: config.flowFrequency },
      uFlowDrift:     { value: config.flowDrift },
      uFlowInfluence: { value: config.flowInfluence },
      uReach:         { value: config.reach },
      uEscape:        { value: config.escape },
      uStreamSpeed:   { value: config.streamSpeed },
      uOriginTop:     { value: 0 },
      uOriginBottom:  { value: 0 },
      uOriginLeft:    { value: 0 },
      uOriginRight:   { value: 0 },
      uOriginCenter:  { value: 0 },
      uOriginEdges:   { value: 0 },
      uOriginAny:     { value: 0 },
      uBoundsMin:     { value: new THREE.Vector3() },
      uBoundsSize:    { value: new THREE.Vector3(1, 1, 1) },
      uSpring:        { value: config.spring },
      uLifeSpeed:     { value: config.lifeSpeed },
      uProgress:      { value: 1 },
      uMouseWorldPos: { value: new THREE.Vector3(999, 999, 999) },
      uMouseStrength: { value: config.mouseStrength },
      uMouseRadius:   { value: config.mouseRadius },
      uMouseActive:   { value: 0 },
    },
  });

  // Copy the starting state into BOTH buffers so frame one has valid data.
  const copyMaterial = new THREE.ShaderMaterial({
    fragmentShader: `
      uniform sampler2D uSource;
      uniform float uRes;
      void main() { gl_FragColor = texture2D(uSource, gl_FragCoord.xy / uRes); }
    `,
    vertexShader: QUAD_VERTEX,
    uniforms: { uSource: { value: initTexture }, uRes: { value: res } },
  });

  simQuad.material = copyMaterial;
  for (const target of targets) {
    renderer.setRenderTarget(target);
    renderer.render(simScene, simCamera);
  }
  renderer.setRenderTarget(null);
  copyMaterial.dispose();
  initTexture.dispose();   // its whole job was that one copy

  /* --- The dots we actually draw --------------------------------------- */
  const positions   = new Float32Array(count * 3); // unused, but three wants it
  const uvs         = new Float32Array(count * 2);
  const sizeJitter  = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    uvs[i * 2 + 0] = ((i % res) + 0.5) / res;
    uvs[i * 2 + 1] = (Math.floor(i / res) + 0.5) / res;
    sizeJitter[i]  = 0.4 + Math.random() * 1.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',     new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aSizeJitter',  new THREE.BufferAttribute(sizeJitter, 1));
  geometry.setAttribute('aNormal',      new THREE.BufferAttribute(normalData, 3));

  const solid = config.dotStyle === 'solid';

  const pointsMaterial = new THREE.ShaderMaterial({
    vertexShader: POINTS_VERTEX,
    fragmentShader: POINTS_FRAGMENT,
    uniforms: {
      uParticlesTexture: { value: targets[0].texture },
      // Set by the engine's resize handler — the simulation must never read
      // innerWidth, or it could not be scoped to a container.
      uViewResolution: { value: new THREE.Vector2(1, 1) },
      uSize:      { value: config.size },
      uGlow:      { value: config.glow },
      uDepthFade: { value: config.depthFade },
      uSolid:     { value: solid ? 1 : 0 },
      uLightDir:  { value: new THREE.Vector3(0, 0, 1) },
      uShadow:    { value: config.shadow },
      uColorA:    { value: new THREE.Color(config.colA) },
      uColorB:    { value: new THREE.Color(config.colB) },
    },
    // Additive: overlapping dots ADD their brightness, so dense areas bloom.
    // Solid style uses normal blending instead, so dots stay flat and opaque.
    // No depth writing either way, or dots would hide each other.
    transparent: true,
    blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const points = new THREE.Points(geometry, pointsMaterial);
  points.frustumCulled = false; // positions live on the GPU; three can't see them

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
    get bounds() { return bounds; },
    get front() { return front; },

    /** Pushes the whole config into uniforms. Called every frame — it is only
     *  a few dozen assignments, and it means "set a slider" needs no
     *  bookkeeping anywhere else. Mirrors the original's tick(). */
    applyConfig(config) {
      su.uFlowStrength.value  = config.flowStrength;
      su.uFlowFrequency.value = config.flowFrequency;
      su.uFlowDrift.value     = config.flowDrift;
      su.uFlowInfluence.value = config.flowInfluence;
      su.uReach.value         = config.reach;
      su.uEscape.value        = config.escape;
      su.uStreamSpeed.value   = config.streamSpeed;
      su.uSpring.value        = config.spring;
      su.uLifeSpeed.value     = config.lifeSpeed;
      su.uMouseStrength.value = config.mouseStrength;
      su.uMouseRadius.value   = config.mouseRadius;

      const origins = config.origins;
      su.uOriginTop.value    = origins.includes('top')    ? 1 : 0;
      su.uOriginBottom.value = origins.includes('bottom') ? 1 : 0;
      su.uOriginLeft.value   = origins.includes('left')   ? 1 : 0;
      su.uOriginRight.value  = origins.includes('right')  ? 1 : 0;
      su.uOriginCenter.value = origins.includes('center') ? 1 : 0;
      su.uOriginEdges.value  = origins.includes('edges')  ? 1 : 0;
      su.uOriginAny.value    = origins.length > 0 ? 1 : 0;

      pu.uSize.value      = config.size;
      pu.uGlow.value      = config.glow;
      pu.uDepthFade.value = config.depthFade;
      pu.uShadow.value    = config.shadow;
      pu.uColorA.value.set(config.colA);
      pu.uColorB.value.set(config.colB);

      // Light direction from the angle. The fixed z tilt keeps some light on
      // the front faces, so turning the angle moves the highlight around the
      // letter's edges rather than plunging the whole face into darkness.
      const lightRad = config.lightAngle * Math.PI / 180;
      lightDir.set(Math.cos(lightRad) * 0.85, Math.sin(lightRad) * 0.85, 0.5).normalize();
      pu.uLightDir.value.copy(lightDir);

      // Blending is a material flag, not a uniform, so only touch it on an
      // actual change — needsUpdate forces a shader recompile.
      if (config.dotStyle !== lastDotStyle) {
        const isSolid = config.dotStyle === 'solid';
        pu.uSolid.value = isSolid ? 1 : 0;
        pointsMaterial.blending = isSolid ? THREE.NormalBlending : THREE.AdditiveBlending;
        pointsMaterial.needsUpdate = true;
        lastDotStyle = config.dotStyle;
      }
    },

    /** One frame: read the front buffer, write the back one, swap, then point
     *  the dots at what we just wrote. */
    step(renderer, delta, time, live) {
      su.uTime.value      = time;
      su.uDeltaTime.value = delta;
      su.uProgress.value  = live.progress;
      su.uMouseActive.value = live.mouseActive;
      su.uMouseWorldPos.value.copy(live.mouse);

      const back = 1 - front;
      su.uParticles.value = targets[front].texture;
      simQuad.material    = simMaterial;

      renderer.setRenderTarget(targets[back]);
      renderer.render(simScene, simCamera);
      renderer.setRenderTarget(null);

      front = back; // swap
      pu.uParticlesTexture.value = targets[front].texture;
    },

    /** The cheap shape morph: rewrite the "home spots" image and let the
     *  elastic that is already running pull the particles to the new shape.
     *  No rebuild, no restart — they FLY there. */
    reseed(config) {
      bounds = writeBase({ data: baseData, normals: normalData, count, config });
      baseTexture.needsUpdate = true;
      geometry.getAttribute('aNormal').needsUpdate = true;
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
    },
  };
}

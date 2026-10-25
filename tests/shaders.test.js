/* Guards the one thing no visual test can catch: a shader drifting away from
 * the original. Each extracted module must still equal the exact text inside
 * the corresponding template literal in reference/particle-effect.html.
 *
 * If this fails after a deliberate shader change, update the reference bounds
 * here on purpose — do not delete the test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import NOISE from '../src/engine/shaders/noise.js';
import SIM from '../src/engine/shaders/sim.frag.js';
import POINTS_VERT from '../src/engine/shaders/points.vert.js';
import POINTS_FRAG from '../src/engine/shaders/points.frag.js';
import QUAD_VERT from '../src/engine/shaders/quad.vert.js';

const REFERENCE = readFileSync(
  fileURLToPath(new URL('../reference/particle-effect.html', import.meta.url)),
  'utf8'
).split('\n');

/** The text between the backticks of a template literal spanning these lines,
 *  1-indexed and inclusive of the declaration/closing lines. */
const literal = (declLine, closeLine) =>
  '\n' + REFERENCE.slice(declLine, closeLine - 1).join('\n') + '\n';

describe('extracted shaders are verbatim', () => {
  it('noise matches reference lines 536-598', () => {
    expect(NOISE).toBe(literal(536, 598));
  });

  it('points vertex matches reference lines 788-835', () => {
    expect(POINTS_VERT).toBe(literal(788, 835));
  });

  it('points fragment matches reference lines 837-879', () => {
    expect(POINTS_FRAG).toBe(literal(837, 879));
  });

  it('quad vertex matches reference line 895', () => {
    expect(QUAD_VERT).toBe('void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }');
  });

  it('sim fragment matches reference lines 608-779 with noise interpolated', () => {
    // The reference interpolates ${NOISE_GLSL} at line 645; reproduce that by
    // substituting the noise source into the raw reference text.
    const raw = literal(608, 779).replace('${NOISE_GLSL}', NOISE);
    expect(SIM).toBe(raw);
  });
});

describe('shader sanity', () => {
  it('every shader declares a main()', () => {
    for (const src of [SIM, POINTS_VERT, POINTS_FRAG, QUAD_VERT]) {
      expect(src).toContain('void main()');
    }
  });

  it('the sim shader declares every uniform the engine will set', () => {
    const required = [
      'uParticles', 'uBase', 'uScatter', 'uSimResolution', 'uTime', 'uDeltaTime',
      'uFlowStrength', 'uFlowFrequency', 'uFlowDrift', 'uFlowInfluence',
      'uReach', 'uEscape', 'uStreamSpeed',
      'uOriginTop', 'uOriginBottom', 'uOriginLeft', 'uOriginRight',
      'uOriginCenter', 'uOriginEdges', 'uOriginAny',
      'uBoundsMin', 'uBoundsSize', 'uSpring', 'uLifeSpeed', 'uProgress',
      'uMouseWorldPos', 'uMouseStrength', 'uMouseRadius', 'uMouseActive',
    ];
    for (const name of required) {
      expect(SIM, name).toMatch(new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`));
    }
  });

  it('the points shaders declare every uniform the engine will set', () => {
    const vert = ['uParticlesTexture', 'uViewResolution', 'uSize', 'uLightDir', 'uShadow'];
    const frag = ['uColorA', 'uColorB', 'uGlow', 'uDepthFade', 'uSolid'];
    for (const name of vert) {
      expect(POINTS_VERT, name).toMatch(new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`));
    }
    for (const name of frag) {
      expect(POINTS_FRAG, name).toMatch(new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`));
    }
  });

  it('noise is included exactly once in the sim shader', () => {
    expect(SIM.split('float snoise(vec3 v)')).toHaveLength(2);
  });
});

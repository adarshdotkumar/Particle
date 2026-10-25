/* Points fragment shader — extracted VERBATIM from reference/particle-effect.html:837-879
   Do not edit by hand: a one-character change here is a silent visual
   regression with no test that can catch it. */
export default /* glsl */`
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
`;

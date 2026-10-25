/* Points vertex shader — extracted VERBATIM from reference/particle-effect.html:788-835
   Do not edit by hand: a one-character change here is a silent visual
   regression with no test that can catch it. */
export default /* glsl */`
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
`;

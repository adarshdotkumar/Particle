/* Pass-through vertex shader for full-image passes — extracted VERBATIM from reference/particle-effect.html:895
   Do not edit by hand: a one-character change here is a silent visual
   regression with no test that can catch it. */
export default 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }';

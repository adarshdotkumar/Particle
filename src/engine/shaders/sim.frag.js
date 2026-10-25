/* The simulation shader — the whole effect lives here — extracted VERBATIM from reference/particle-effect.html:608-779
   Do not edit by hand: a one-character change here is a silent visual
   regression with no test that can catch it. */
import NOISE_GLSL from './noise.js';

export default /* glsl */`
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
`;

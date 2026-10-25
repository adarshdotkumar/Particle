import { useEffect, useRef, useState } from 'react';
import { ParticleField as Engine } from './engine/particle-field.js';

/* React binding for the engine. Plain React — no @react-three/fiber.
 *
 * Why this exists rather than a copy-paste snippet: React makes two mistakes
 * very easy here, and both are invisible until production.
 *
 *   1. Putting `config` in the mount effect's dependency array. Every colour
 *      tweak would tear down the WebGL context and rebuild 65,000 particles.
 *      Two effects: one to mount, one to push config updates.
 *
 *   2. Forgetting cleanup. Browsers allow ~8-16 live WebGL contexts per page,
 *      so a component that mounts and unmounts across a few route changes
 *      exhausts them and every later effect silently fails to render.
 *      StrictMode in development mounts, unmounts and remounts on purpose,
 *      which turns this from "rare" into "immediate".
 */

/** Imperative handle for people who want one; the component below is enough
 *  for most cases.
 *
 *  @returns {{ ref, field: Engine|null, supported: boolean }}
 */
export function useParticleField(config = {}, options = {}) {
  const ref = useRef(null);
  const fieldRef = useRef(null);
  const [supported, setSupported] = useState(true);

  const {
    mode = 'container',
    progress = 'auto',
    pointer = true,
    autoPause = true,
    respectReducedMotion = true,
    dpr = 2,
    mobileCount = 128,
    onUnsupported,
  } = options;

  // Mount once. Deliberately NOT dependent on `config` — see note 1 above.
  useEffect(() => {
    if (!ref.current) return undefined;

    const field = new Engine({
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
      },
    });
    fieldRef.current = field;

    return () => {
      field.destroy();
      fieldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, progress, pointer, autoPause, respectReducedMotion, dpr, mobileCount]);

  // Config changes flow through as uniform updates. The engine picks the
  // cheapest path itself: uniforms are free, a shape change re-seeds, and only
  // a particle-count change rebuilds.
  useEffect(() => {
    fieldRef.current?.set(config);
  }, [serialise(config)]);

  return { ref, field: fieldRef.current, supported };
}

/** Drop-in component. Give it a height, or it will measure zero and show
 *  nothing — the canvas fills its container. */
export function ParticleField({
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
    mode, progress, pointer, autoPause, respectReducedMotion, dpr, mobileCount, onUnsupported,
  });

  return (
    <div
      ref={ref}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* A config is a flat object of primitives plus one string array, so this is a
   stable key for it. Cheaper than a deep-equality hook, and it means callers
   can pass a fresh inline object every render without triggering work. */
function serialise(config) {
  return JSON.stringify(config, Object.keys(config ?? {}).sort());
}

export default ParticleField;

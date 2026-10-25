/* Type definitions for @adarshdotkumar/particle-field/react.
 * Hand-written to mirror src/react.jsx — keep the two in step. */
import type { CSSProperties, HTMLAttributes, ReactNode, RefObject } from 'react';
import type { ParticleConfig, ParticleField as Engine, ParticleFieldOptions } from './index';

export type ParticleFieldHookOptions = Omit<ParticleFieldOptions, 'container' | 'config'>;

export function useParticleField(
  config?: Partial<ParticleConfig>,
  options?: ParticleFieldHookOptions,
): {
  ref: RefObject<HTMLDivElement | null>;
  field: Engine | null;
  supported: boolean;
};

export interface ParticleFieldProps
  extends ParticleFieldHookOptions,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'style'> {
  config?: Partial<ParticleConfig>;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ParticleField(props: ParticleFieldProps): ReactNode;
export default ParticleField;

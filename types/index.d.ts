/* Type definitions for @adarshdotkumar/particle-field.
 * Hand-written to mirror src/index.js — keep the two in step. */

/** Built-in shapes, plus any model imported from Blender (its --name). */
export type ShapeMode = 'sphere' | 'cube' | 'x' | 'text' | 'custom' | (string & {});
export type DotStyle = 'glow' | 'solid';
export type Origin = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'edges';
export type Count = 64 | 128 | 256 | 512;

/** A full config. Every key has a default, so the engine always accepts a
 *  Partial<ParticleConfig>; out-of-range values are clamped and unknown keys
 *  are dropped. */
export interface ParticleConfig {
  flowStrength: number;
  flowFrequency: number;
  flowDrift: number;
  flowInfluence: number;
  reach: number;
  escape: number;
  streamSpeed: number;
  spring: number;
  mouseStrength: number;
  mouseRadius: number;
  lifeSpeed: number;
  size: number;
  glow: number;
  depthFade: number;
  depth: number;
  lightAngle: number;
  shadow: number;
  /** Hex colour, `#rrggbb`. */
  colA: string;
  /** Hex colour, `#rrggbb`. */
  colB: string;
  dotStyle: DotStyle;
  origins: Origin[];
  shapeMode: ShapeMode;
  /** Up to 24 characters. */
  shapeText: string;
  shapeModelUrl: string;
  count: Count;
}

export type ProgressMode = 'scroll' | 'fixed';

export interface ParticleFieldOptions {
  /** Element or CSS selector. Needs an explicit height. */
  container: Element | string;
  config?: Partial<ParticleConfig>;
  mode?: 'container' | 'background';
  progress?: 'auto' | ProgressMode | number;
  pointer?: boolean;
  autoPause?: boolean;
  respectReducedMotion?: boolean;
  dpr?: number;
  mobileCount?: number;
  onUnsupported?: ((info: { reason: string }) => void) | null;
}

export class ParticleField {
  constructor(options: ParticleFieldOptions);

  /** `false` if the GPU can't run it. */
  readonly supported: boolean;
  readonly isRunning: boolean;
  readonly destroyed: boolean;
  /** The canvas, or `null` when unsupported or destroyed. */
  readonly element: HTMLCanvasElement | null;
  readonly unsupportedReason?: string;

  set(partial?: Partial<ParticleConfig>): this;
  getConfig(): ParticleConfig;
  setProgress(value: number): this;
  getProgress(): number;
  setProgressMode(mode: ProgressMode): this;
  getStats(): { fps: number; count: number };
  play(): this;
  pause(): this;
  resize(): this;
  destroy(): void;
}

/** Start one field per `[data-particle-field]` element under `root`. */
export function mount(root?: ParentNode): ParticleField[];

/** [key, min, max, step, label, hint, bucket] */
export type SliderSpec = [string, number, number, number, string, string, string];

export const DEFAULTS: Readonly<ParticleConfig>;
export const PRESETS: Record<string, Partial<ParticleConfig>>;
export const SLIDERS: SliderSpec[];
export const RANGES: Readonly<Record<string, Readonly<{ min: number; max: number; step: number }>>>;
export const ORIGIN_KEYS: Origin[];
export const DOT_STYLES: DotStyle[];
export const SHAPE_MODES: ShapeMode[];
export const COUNTS: Count[];
export const CONFIG_KEYS: (keyof ParticleConfig)[];
export const CONTENT_KEYS: (keyof ParticleConfig)[];

export function normalizeConfig(partial?: unknown): ParticleConfig;
export function diffConfig(config: Partial<ParticleConfig>): Partial<ParticleConfig>;
export function applyLook(current: Partial<ParticleConfig>, look: Partial<ParticleConfig>): ParticleConfig;

export function encodeConfig(config: Partial<ParticleConfig>): string;
export function decodeConfig(token: string): ParticleConfig | null;

export interface SnippetOptions {
  flavor?: 'script' | 'esm' | 'react';
  mode?: 'container' | 'background';
  height?: number;
  cdn?: string;
  version?: string;
}
export function generateSnippet(config: Partial<ParticleConfig>, options?: SnippetOptions): string;

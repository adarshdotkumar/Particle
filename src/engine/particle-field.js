import * as THREE from 'three';
import { normalizeConfig } from '../config.js';
import { createContext } from './context.js';
import { createSimulation } from './simulation.js';
import { loadCustomModel } from './model-loader.js';
import { customModelCache } from './shapes/custom-cache.js';

/* ParticleField — one self-contained effect, scoped to one element.
 *
 * This is the layer the original demo never had. The demo assumed it owned the
 * browser: it read innerWidth directly, bound listeners to window, drove
 * progress off document.body.scrollHeight, and kept everything in module
 * scope. That is fine for a demo and unusable on someone else's site.
 *
 * Everything here exists to make an embed safe:
 *   - sizes to its container via ResizeObserver, never to the viewport
 *   - pointer maths from getBoundingClientRect, so the cursor force is not
 *     offset when the effect is not fullscreen
 *   - pauses when scrolled offscreen or when the tab is hidden
 *   - honours prefers-reduced-motion with a settled static frame
 *   - destroy() is total and idempotent, so React can unmount it
 */

const MOBILE_QUERY = '(max-width: 768px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// How many fixed steps to settle the shape before the single static frame
// rendered for reduced-motion users.
const SETTLE_STEPS = 140;
const SETTLE_DELTA = 1 / 60;

const matches = (query) =>
  typeof matchMedia === 'function' ? matchMedia(query).matches : false;

export class ParticleField {
  constructor(options = {}) {
    const {
      container,
      config = {},
      mode = 'container',
      progress = 'auto',
      pointer = true,
      autoPause = true,
      respectReducedMotion = true,
      dpr = 2,
      mobileCount = 128,
      onUnsupported = null,
    } = options;

    const host = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    if (!host) throw new Error('ParticleField: container not found');

    this.container = host;
    this.mode = mode === 'background' ? 'background' : 'container';
    this.pointerEnabled = pointer;
    this.autoPause = autoPause;
    this.supported = false;
    this.isRunning = false;
    this.destroyed = false;

    this._config = normalizeConfig(config);
    this._clampCountForDevice(mobileCount);

    // 'auto' means: a background wants scroll to drive it (that is the demo's
    // signature move), a container just sits there formed.
    this._progressMode = progress === 'auto'
      ? (this.mode === 'background' ? 'scroll' : 'fixed')
      : (typeof progress === 'number' ? 'fixed' : progress);
    this._progress = typeof progress === 'number' ? clamp01(progress) : 1;

    this._reducedMotion = respectReducedMotion && matches(REDUCED_MOTION_QUERY);

    this._canvas = document.createElement('canvas');
    this._styleCanvas();
    this.container.appendChild(this._canvas);
    this.element = this._canvas;

    const { renderer, supported, reason } = createContext({ canvas: this._canvas, dpr });
    if (!supported) {
      this.unsupportedReason = reason;
      this._canvas.remove();
      this._canvas = null;
      this.element = null;
      if (typeof onUnsupported === 'function') onUnsupported({ reason });
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

    // Cursor as a point in 3D space: fire a ray from the camera through the
    // cursor and see where it crosses the middle of the scene.
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
      // Skip the very first delta: constructing the sim can take tens of ms,
      // and feeding that in as a frame time would jolt every particle.
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

    // Count is baked into the texture size, so it needs a full rebuild.
    if (next.count !== this._config.count) {
      this._config = next;
      this._rebuild();
      return this;
    }

    // Shape changes only rewrite the "home spots" image — particles fly there.
    const reseed = next.shapeMode !== this._config.shapeMode
      || next.shapeText !== this._config.shapeText
      || next.shapeModelUrl !== this._config.shapeModelUrl
      || next.depth !== this._config.depth;

    this._config = next;
    if (reseed) {
      this._sim.reseed(next);
      this._ensureCustomModel();
    }
    this._sim.applyConfig(next);

    // A paused-but-visible field (reduced motion, or an explicit pause) still
    // needs to show the change.
    if (!this.isRunning) this._renderOnce();
    return this;
  }

  getConfig() {
    return { ...this._config };
  }

  /** 1 = formed shape, 0 = scattered dust. Switches off scroll driving. */
  setProgress(value) {
    this._progressMode = 'fixed';
    this._progress = clamp01(value);
    if (!this.isRunning) this._renderOnce();
    return this;
  }

  getProgress() {
    return this._progress;
  }

  /** 'scroll' | 'fixed' — what drives progress. */
  setProgressMode(mode) {
    this._progressMode = mode === 'scroll' ? 'scroll' : 'fixed';
    return this;
  }

  getStats() {
    return { fps: Math.round(this._fps), count: this._sim ? this._sim.count : 0 };
  }

  play() {
    if (!this.supported || this.destroyed || this.isRunning) return this;
    // Do not run while parked offscreen or on a hidden tab.
    if (this.autoPause && this._visible === false) return this;
    if (typeof document !== 'undefined' && document.hidden) return this;

    this.isRunning = true;
    this._clock.getDelta(); // drop the time spent paused
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
    // A display:none or not-yet-laid-out parent measures zero. Resizing to
    // zero throws away the drawing buffer, so skip and wait for the next
    // observer callback.
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
      // Without this the context lingers and the browser's ~8-16 context
      // ceiling is hit after a handful of mount/unmount cycles.
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
    s.display = 'block';
    if (this.mode === 'background') {
      s.position = 'fixed';
      s.inset = '0';
      s.width = '100%';
      s.height = '100%';
      s.pointerEvents = 'none';
      s.zIndex = s.zIndex || '0';
    } else {
      s.position = 'absolute';
      s.inset = '0';
      s.width = '100%';
      s.height = '100%';
      s.pointerEvents = 'none';
      // The canvas is absolutely positioned, so the container must establish a
      // containing block. Only fill it in if the page has not chosen one.
      const position = getComputedStyle(this.container).position;
      if (position === 'static') this.container.style.position = 'relative';
    }
  }

  _measure() {
    if (this.mode === 'background') {
      return { width: innerWidth, height: innerHeight };
    }
    return {
      width: Math.round(this.container.clientWidth),
      height: Math.round(this.container.clientHeight),
    };
  }

  _bindListeners() {
    this._onPointerMove = (event) => {
      const rect = this._canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      // From the canvas rect, not innerWidth — otherwise the cursor force is
      // offset on any page where the effect is not fullscreen.
      this._pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointerNdc, this._camera);
      this._raycaster.ray.intersectPlane(this._mousePlane, this._mouseTarget);
      this._mouseActive = 1;
    };
    this._onPointerLeave = () => { this._mouseActive = 0; };

    this._onVisibility = () => {
      if (document.hidden) this.pause();
      else this.play();
    };

    // The canvas has pointer-events:none so it never eats the host page's
    // clicks; listen on the container instead. In background mode the canvas
    // is fixed to the viewport, so window is the right scope.
    this._pointerHost = this.mode === 'background' ? window : this.container;

    if (this.pointerEnabled) {
      this._pointerHost.addEventListener('pointermove', this._onPointerMove, { passive: true });
      this._pointerHost.addEventListener('pointerleave', this._onPointerLeave);
    }
    document.addEventListener('visibilitychange', this._onVisibility);

    if (this.mode === 'background') {
      // Fullscreen: the viewport is the size, so window resize is the signal.
      this._onWindowResize = () => this.resize();
      window.addEventListener('resize', this._onWindowResize);
    } else if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this.container);
    } else {
      this._onWindowResize = () => this.resize();
      window.addEventListener('resize', this._onWindowResize);
    }

    // Pause while parked offscreen. The single biggest reason an embed is safe
    // to ship: an offscreen hero must not burn someone's GPU.
    if (this.autoPause && typeof IntersectionObserver === 'function') {
      this._visible = undefined;
      this._intersectionObserver = new IntersectionObserver((entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        this._visible = visible;
        if (this._reducedMotion) return;
        if (visible) this.play();
        else this.pause();
      }, { rootMargin: '10%' });
      this._intersectionObserver.observe(this.container);
    }
  }

  _unbindListeners() {
    if (this.pointerEnabled && this._pointerHost) {
      this._pointerHost.removeEventListener('pointermove', this._onPointerMove);
      this._pointerHost.removeEventListener('pointerleave', this._onPointerLeave);
    }
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (this._onWindowResize) window.removeEventListener('resize', this._onWindowResize);
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
    if (shapeMode !== 'custom' || !url || customModelCache.has(url)) return;

    loadCustomModel(url).then(() => {
      const still = !this.destroyed
        && this._config.shapeMode === 'custom'
        && this._config.shapeModelUrl === url;
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
    if (this.mode === 'background') {
      const max = document.documentElement.scrollHeight - innerHeight;
      const scrolled = max > 0 ? clamp01(scrollY / max) : 0;
      return 1 - scrolled;
    }

    const rect = this.container.getBoundingClientRect();
    const travel = innerHeight + rect.height;
    if (travel <= 0) return 1;
    // 0 when the element's top is at the bottom of the viewport, 1 when its
    // bottom has passed the top.
    const passed = clamp01((innerHeight - rect.top) / travel);
    return 1 - Math.abs(passed * 2 - 1); // formed in the middle of the screen
  }

  _live() {
    if (this._progressMode === 'scroll') this._progress = this._readScrollProgress();
    return {
      progress: this._progress,
      mouse: this._mouseSmooth,
      mouseActive: this._mouseActive,
    };
  }

  _tick = () => {
    if (this.destroyed || !this.isRunning) return;

    // Clamped so that tabbing away and back doesn't fling particles to infinity.
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
  };

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
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Scan for [data-particle-field] elements and start one field per element.
 *  This is what the standalone build calls, and what makes the paste-in
 *  snippet a single script tag with no JS to write. */
export function mount(root = document) {
  const hosts = root.querySelectorAll('[data-particle-field]');
  return [...hosts].map((el) => {
    let raw = {};
    try {
      raw = JSON.parse(el.getAttribute('data-particle-field') || '{}') || {};
    } catch {
      console.warn('[particle-field] ignoring malformed data-particle-field JSON', el);
    }
    const { mode, progress, ...config } = raw;
    return new ParticleField({
      container: el,
      config,
      mode,
      progress: progress === undefined ? 'auto' : progress,
      onUnsupported: ({ reason }) => {
        el.setAttribute('data-particle-field-unsupported', reason);
      },
    });
  });
}

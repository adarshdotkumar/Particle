import {
  SLIDERS, PRESETS, ORIGIN_KEYS, RANGES, normalizeConfig,
} from '../config.js';
import { MODEL_SHAPES } from '../engine/shapes/models/catalog.js';

/* The control panel — ported from reference/particle-effect.html:1495-1792.
 *
 * The inversion that matters: every handler used to mutate module-global state
 * and poke uniforms directly. Now each one calls onChange(partialConfig) and
 * knows nothing about the engine. setConfig() drives the controls the other
 * way, replacing the original applyLook() — except the reset-to-defaults rule
 * it enforced now lives in normalizeConfig, where it is unit-tested.
 */

/* Ready-made shapes as chips. Text is not a chip — it has its own
   always-visible input further down; typing into it is what selects it (see
   the shapeText listener below). The bracketed part is a quieter aside — it
   says where that shape comes from, not what it is called.
   Shape is structure only — a chip only ever switches shapeMode. The look
   (wind, spring, colour, glow...) is entirely the preset's job, and stays
   exactly as it was: pick X, then Smoke, then Sphere, and Smoke's look
   follows you onto the sphere. Built-in models (the X, and anything imported
   from Blender with scripts/import-model.mjs) get a chip each, automatically. */
const SHAPE_CHIPS = [
  ['sphere', 'Sphere', '', 'ready'],
  ['cube',   'Cube',   '', 'ready'],
  ...MODEL_SHAPES.map(({ mode, label, note }) => [mode, label, note, 'ready']),
];

const ORIGIN_LABELS = {
  top: 'Top', bottom: 'Bottom', left: 'Left',
  right: 'Right', center: 'Center', edges: 'Edges',
};

/** Builds the panel and returns handles to drive it.
 *  @param onChange     called with a PARTIAL config whenever a control moves
 *  @param onProgress   called with 0..1 when the Assemble slider moves
 *  @param onFullLook   called with a whole look when a preset is clicked —
 *                      this resets unmentioned keys. Shape chips never call
 *                      it: shape is structure, presets own the look.
 */
export function createPanel({ config, onChange, onProgress, onFullLook }) {
  const $ = (id) => document.getElementById(id);

  const els = {
    sliders: $('sliders'),
    presets: $('presets'),
    presetStatus: $('presetStatus'),
    presetStatusName: document.querySelector('#presetStatus .name'),
    revertBtn: $('revertBtn'),
    origins: $('origins'),
    originNote: $('originNote'),
    shapes: $('shapes'),
    shapeText: $('shapeText'),
    dotStyle: $('dotStyle'),
    colA: $('colA'),
    colB: $('colB'),
    count: $('count'),
    fps: $('fps'),
  };

  const sliderEls = {};
  let current = { ...config };
  let depthTimer = null;

  /* ── sliders ─────────────────────────────────────────────────────────── */
  // Each bucket is a collapsible <details> instead of a flat heading, so 18
  // sliders don't read as one continuous wall. SLIDERS is already in bucket
  // order, so this still needs no sorting or nesting — just a new <details>
  // whenever the bucket changes, and rows go into that one instead of
  // straight into #sliders.
  let lastBucket = null;
  let bucketBody = els.sliders;
  for (const [key, min, max, step, label, hintText, bucket] of SLIDERS) {
    if (bucket !== lastBucket) {
      const details = document.createElement('details');
      details.className = 'bucket';
      if (lastBucket === null) details.open = true; // first bucket starts open
      const summary = document.createElement('summary');
      summary.textContent = bucket;
      details.appendChild(summary);
      els.sliders.appendChild(details);
      bucketBody = details;
      lastBucket = bucket;
    }

    const initial = key === 'progress' ? 1 : current[key];

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="top"><span class="name">${label}</span><span class="val"></span></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${initial}" />
      ${hintText ? `<div class="hint">${hintText}</div>` : ''}
    `;
    const input = row.querySelector('input');
    const readout = row.querySelector('.val');

    input.addEventListener('input', () => {
      const value = parseFloat(input.value);
      setReadout(key, value);

      // Assemble is playback state, not part of the saved look — the engine
      // owns it, so it does not go through onChange.
      if (key === 'progress') {
        onProgress(value);
        return;
      }

      current[key] = value;
      // Thickness moves particles onto or off the side walls, so it triggers a
      // re-seed. Debounced, or dragging would re-seed on every pixel of travel
      // (reference/particle-effect.html:1711-1719 did the same).
      if (key === 'depth') {
        clearTimeout(depthTimer);
        depthTimer = setTimeout(() => onChange({ depth: value }), 60);
      } else {
        onChange({ [key]: value });
      }
      clearActivePreset();
      markEdited();
    });

    sliderEls[key] = { input, readout };
    bucketBody.appendChild(row);
  }

  function setReadout(key, value) {
    const el = sliderEls[key];
    if (!el) return;
    const isAngle = key === 'lightAngle';
    const decimals = key === 'size' ? 3 : isAngle ? 0 : 2;
    el.readout.textContent = value.toFixed(decimals) + (isAngle ? '°' : '');
  }

  function setSlider(key, value) {
    const el = sliderEls[key];
    if (!el) return;
    el.input.value = value;
    setReadout(key, value);
  }

  /* ── presets ─────────────────────────────────────────────────────────── */
  for (const name of Object.keys(PRESETS)) {
    const button = document.createElement('button');
    button.textContent = name;
    button.dataset.preset = name;
    button.addEventListener('click', () => {
      onFullLook(PRESETS[name]);
      markPresetActive(name);
      markLookApplied(name, PRESETS[name]);
    });
    els.presets.appendChild(button);
  }

  function clearActivePreset() {
    els.presets.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
  }

  function markPresetActive(name) {
    clearActivePreset();
    const button = els.presets.querySelector(`[data-preset="${name}"]`);
    if (button) button.classList.add('active');
  }

  /* ── revert to preset ──────────────────────────────────────────────────
     A preset always lands in the exact same place — clicking it again is
     already a perfect "revert". The only missing piece is remembering which
     one you started from once you've touched something else, since
     clearActivePreset() wipes the highlight on the very next edit. This just
     remembers it and offers a button that re-triggers the same onFullLook
     call a second click would. Shape chips never touch this — shape is
     structure, not look, so switching shape can't put you "off" a preset. */
  let lastLook = null;
  let lastLookName = null;
  let lookEdited = false;

  function markLookApplied(name, look) {
    lastLook = look;
    lastLookName = name;
    lookEdited = false;
    updatePresetStatus();
  }

  function markEdited() {
    if (lastLookName && !lookEdited) {
      lookEdited = true;
      updatePresetStatus();
    }
  }

  function updatePresetStatus() {
    if (!lastLookName) {
      els.presetStatus.hidden = true;
      return;
    }
    els.presetStatus.hidden = false;
    els.presetStatusName.textContent = lastLookName;
    els.revertBtn.hidden = !lookEdited;
  }

  /** Whichever preset's look is currently considered "applied" — set by
   *  clicking a preset button (or setInitialPreset), cleared by any
   *  whole-config load. Reset uses this to know what look to fall back to;
   *  read it before calling apply()/setConfig(), which clears it. */
  function getActiveLook() {
    return { name: lastLookName, look: lastLook };
  }

  els.revertBtn.addEventListener('click', () => {
    // Capture before onFullLook, which triggers setConfig() synchronously —
    // that clears these same variables, so reading them afterward would see
    // them already wiped.
    const name = lastLookName;
    const look = lastLook;
    onFullLook(look);
    markPresetActive(name);
    markLookApplied(name, look);
  });

  /* ── swirl origins ───────────────────────────────────────────────────── */
  for (const key of ORIGIN_KEYS) {
    const button = document.createElement('button');
    button.textContent = ORIGIN_LABELS[key];
    button.dataset.origin = key;
    button.addEventListener('click', () => {
      const origins = current.origins.includes(key)
        ? current.origins.filter((k) => k !== key)
        : [...current.origins, key];
      current.origins = origins;
      syncOrigins(origins);
      onChange({ origins });
      clearActivePreset();
      markEdited();
    });
    els.origins.appendChild(button);
  }

  function syncOrigins(origins) {
    els.origins.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', origins.includes(b.dataset.origin));
    });
    els.originNote.textContent = origins.length === 0
      ? 'Everywhere — nothing selected'
      : origins.map((k) => ORIGIN_LABELS[k]).join(' + ');
  }

  /* ── shape chips ─────────────────────────────────────────────────────── */
  let lastShapeGroup = null;
  for (const [mode, label, note, group] of SHAPE_CHIPS) {
    // A hairline between the ready-made shapes and the one you type.
    if (lastShapeGroup !== null && group !== lastShapeGroup) {
      const divider = document.createElement('div');
      divider.className = 'divider';
      els.shapes.appendChild(divider);
    }
    lastShapeGroup = group;

    const button = document.createElement('button');
    // Built from nodes, not innerHTML: imported model labels come from
    // whoever ran the import script, so they are text, never markup.
    button.textContent = label;
    if (note) {
      const aside = document.createElement('span');
      aside.className = 'note';
      aside.textContent = ` [${note}]`;
      button.append(aside);
    }
    button.dataset.shape = mode;
    // Shape only — the current look (and its preset highlight) is untouched.
    button.addEventListener('click', () => {
      current.shapeMode = mode;
      syncShapeMode(mode);
      onChange({ shapeMode: mode });
    });
    els.shapes.appendChild(button);
  }

  /** Adds (or relabels) the chip for an uploaded custom shape. Only appears
   *  once a model has actually been loaded — there is no "Custom" chip up
   *  front, since there's nothing to select until something is uploaded. */
  function setCustomChip(label) {
    let button = els.shapes.querySelector('[data-shape="custom"]');
    if (!button) {
      button = document.createElement('button');
      button.dataset.shape = 'custom';
      button.addEventListener('click', () => {
        current.shapeMode = 'custom';
        syncShapeMode('custom');
        onChange({ shapeMode: 'custom' });
      });
      els.shapes.appendChild(button);
    }
    button.textContent = label;
  }

  // One place that knows which chip is lit. The text input is always visible
  // now (it is its own section, not a chip), so this no longer toggles it.
  function syncShapeMode(mode) {
    els.shapes.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.shape === mode);
    });
  }

  // Debounced so it re-forms once you pause, not on every keystroke. Typing
  // here is what selects the Text shape — there is no separate chip for it —
  // so every keystroke also switches shapeMode, same as clicking a chip does.
  let textTimer = null;
  els.shapeText.addEventListener('input', () => {
    const shapeText = els.shapeText.value;
    current.shapeText = shapeText;
    current.shapeMode = 'text';
    syncShapeMode('text');
    clearTimeout(textTimer);
    // Shape only, same as a chip click — the current look and its preset
    // highlight are untouched.
    textTimer = setTimeout(() => onChange({ shapeText, shapeMode: 'text' }), 120);
  });

  /* ── dot style, colours, count ───────────────────────────────────────── */
  els.dotStyle.addEventListener('change', () => {
    current.dotStyle = els.dotStyle.value;
    onChange({ dotStyle: els.dotStyle.value });
    clearActivePreset();
    markEdited();
  });

  const onColour = () => {
    current.colA = els.colA.value;
    current.colB = els.colB.value;
    onChange({ colA: els.colA.value, colB: els.colB.value });
    clearActivePreset();
    markEdited();
  };
  els.colA.addEventListener('input', onColour);
  els.colB.addEventListener('input', onColour);

  els.count.addEventListener('change', () => {
    const count = parseInt(els.count.value, 10);
    current.count = count;
    onChange({ count });
    clearActivePreset();
    markEdited();
  });

  /** Drive every control from a config object. Called for a whole-config
   *  load (shared link, .json file, reset) — none of those name a specific
   *  preset, so there is nothing to revert to until a preset is clicked
   *  again. onFullLook's own setConfig call (inside apply(), before the
   *  click handler's markLookApplied runs) gets overwritten a moment later
   *  by that same handler, which is the correct outcome either way. */
  function setConfig(config) {
    current = normalizeConfig(config);

    for (const [key] of SLIDERS) {
      if (key === 'progress') continue;
      setSlider(key, current[key]);
    }

    els.colA.value = current.colA;
    els.colB.value = current.colB;
    els.dotStyle.value = current.dotStyle;
    els.count.value = String(current.count);
    els.shapeText.value = current.shapeText;

    syncOrigins(current.origins);
    syncShapeMode(current.shapeMode);

    lastLook = null;
    lastLookName = null;
    lookEdited = false;
    updatePresetStatus();
  }

  setConfig(config);
  setReadout('progress', 1);

  return {
    setConfig,
    setCustomChip,
    setProgress(value) { setSlider('progress', value); },
    setFps(text) { els.fps.textContent = text; },
    clearActivePreset,
    getActiveLook,
    markPreset: markPresetActive,
    /** Same highlight + revert wiring a click on that preset button would
     *  give you — for the config you booted with, which was never clicked. */
    setInitialPreset(name) {
      markPresetActive(name);
      markLookApplied(name, PRESETS[name]);
    },
    /** Ranges are needed by the export panel's height field validation. */
    ranges: RANGES,
  };
}

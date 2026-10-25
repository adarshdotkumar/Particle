import { ParticleField } from '../index.js';
import { normalizeConfig, applyLook } from '../config.js';
import { MODEL_SHAPES } from '../engine/shapes/models/catalog.js';
import { decodeConfig } from '../codec.js';
import { loadCustomModel } from '../engine/model-loader.js';
import { createPanel } from './panel.js';
import { createExportPanel } from './export-panel.js';
import {
  loadInitialConfig, shareUrl, syncHash,
  downloadConfig, readConfigFile, canShareLinks,
  loadPanelState, savePanelState,
  setPendingShape, clearPendingShape,
} from './storage.js';

/* The editor is now just another consumer of the engine. It holds a config
 * object, renders controls from the SLIDERS table, and calls field.set() —
 * it never touches a uniform. That inversion is the whole refactor. */

/* ── toast ────────────────────────────────────────────────────────────────
   Declared first because startup calls it: `let` bindings are in a temporal
   dead zone until evaluated, so a toast() from the boot path would throw if
   this lived at the bottom of the file. */
let toastTimer = null;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

const { config: initial, source, presetName, message: bootMessage } = loadInitialConfig();
let config = initial;

const field = new ParticleField({
  container: '#stage',
  // 'container': #stage now sits in a grid column between two collapsible
  // side panels, not the full viewport — 'background' mode ignores its
  // container's box entirely and always fills the screen, which would make
  // the canvas run under the side panels and never notice one collapsing.
  mode: 'container',
  progress: 1,              // the Assemble slider drives this, not scroll
  config,
  autoPause: false,         // the canvas IS the subject here
  respectReducedMotion: false,
  onUnsupported: ({ reason }) => {
    document.getElementById('unsupported').classList.add('show');
    document.querySelector('.shell').style.display = 'none';
    document.getElementById('hint').style.display = 'none';
    console.warn('[particle-field] unsupported:', reason);
  },
});

// Exposed for the console and for the e2e tests — the editor's own state is
// otherwise entirely module-scoped.
window.__field = field;

const panel = createPanel({
  config,
  onChange(partial) {
    config = normalizeConfig({ ...config, ...partial });
    field.set(partial);
    persist();
  },
  onProgress(value) {
    field.setProgress(value);
  },
  // A preset replaces the whole LOOK — unmentioned look keys reset to their
  // defaults rather than lingering from the previous selection. Shape and
  // text always survive, even if the preset names one of its own (see
  // applyLook's SHAPE_KEYS) — clicking Shards must not switch you onto
  // its X. Count is content too, but survives only if the preset
  // doesn't name it, same as before.
  onFullLook(look) {
    apply(applyLook(config, look));
  },
});

// Whatever we booted into — the default or a shared link — show it as an
// applied preset whenever its look still matches one byte for byte, same
// as if you'd just clicked it.
if (presetName) panel.setInitialPreset(presetName);

// Shapes imported from Blender, as opposed to the X that ships built in.
const IMPORTED = new Map(MODEL_SHAPES.filter((m) => m.mode !== 'x').map((m) => [m.mode, m.label]));

const exportPanel = createExportPanel({
  getConfig: () => config,
  onCopy: toast,
  importedShapes: IMPORTED,
});

function apply(next) {
  config = next;
  panel.setConfig(config);
  field.set(config);
  persist();
}

function persist() {
  syncHash(config);
  exportPanel.refresh();
  syncShapeButtons();
}

/* Pasting a share link while already in the editor is a same-document
   navigation — the page does not reload, so without this the URL would change
   and nothing would happen. Also covers the back button.
   syncHash uses replaceState, which does not fire this, so there is no loop. */
window.addEventListener('hashchange', () => {
  const incoming = decodeConfig(location.hash.replace(/^#/, ''));
  if (incoming) {
    apply(incoming);
    panel.clearActivePreset();
    toast('Opened a shared effect');
  }
});

/* ── save & share buttons ─────────────────────────────────────────────── */

const shareBtn = document.getElementById('shareBtn');

if (canShareLinks()) {
  shareBtn.addEventListener('click', async () => {
    const url = shareUrl(config);
    try {
      await navigator.clipboard.writeText(url);
      toast('Share link copied');
    } catch {
      toast('Copy it from the address bar');
    }
  });
} else {
  // Opened as a downloaded file: a link would point at this machine's disk.
  // Download .json takes the slot as the portable way to keep an effect.
  shareBtn.hidden = true;
  document.getElementById('downloadBtn').textContent = 'Save as .json';
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  downloadConfig(config);
  toast('Downloaded particle-effect.json');
});

document.getElementById('uploadInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    apply(await readConfigFile(file));
    toast(`Loaded ${file.name}`);
  } catch {
    toast("That file isn't valid JSON");
  }
  event.target.value = ''; // so re-picking the same file fires again
});

// The file behind the current custom shape, kept so "Save as shape" can send
// it to the dev server.
let uploadedFile = null;

document.getElementById('modelUploadInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    await loadCustomModel(url);
    uploadedFile = file;
    panel.setCustomChip(file.name);
    apply({ ...config, shapeMode: 'custom', shapeModelUrl: url });
    toast(`Loaded ${file.name}`);
  } catch {
    toast("Couldn't load that model — showing a sphere instead");
  }
  event.target.value = '';
});

/* ── save an upload as a built-in shape (npm run dev only) ─────────────────
   import.meta.env.DEV is true under the dev server and compiled to false in
   the single-file editor, which has no server to write files with. */
const canSaveShapes = import.meta.env.DEV;
const saveShapeBtn = document.getElementById('saveShapeBtn');
const removeShapeBtn = document.getElementById('removeShapeBtn');

function syncShapeButtons() {
  saveShapeBtn.hidden = !(canSaveShapes && uploadedFile && config.shapeMode === 'custom');
  removeShapeBtn.hidden = !(canSaveShapes && IMPORTED.has(config.shapeMode));
}

async function shapeRequest(method, path, body) {
  const response = await fetch(`/__particle-field/models${path}`, {
    method,
    body,
    headers: { 'X-Particle-Field': '1' },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The dev server refused that.');
  return result;
}

const slugify = (text) => text.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '');

saveShapeBtn.addEventListener('click', async () => {
  const suggested = uploadedFile.name.replace(/\.[^.]+$/, '');
  const label = prompt('Name this shape. It gets its own button, in the editor and in your builds.', suggested)?.trim();
  if (!label) return;
  const name = slugify(label);
  if (IMPORTED.has(name) && !confirm(`You already have a shape called "${IMPORTED.get(name)}". Replace it?`)) return;

  // The page reloads once the shape list changes; come back on the new shape.
  setPendingShape({ ...config, shapeMode: name, shapeModelUrl: '' }, `Saved "${label}" as a shape`);
  saveShapeBtn.disabled = true;
  try {
    const params = new URLSearchParams({ name, label, source: uploadedFile.name });
    const result = await shapeRequest('POST', `?${params}`, uploadedFile);
    if (result.warnings?.length) alert(result.warnings.join('\n\n'));
    location.reload();
  } catch (error) {
    clearPendingShape();
    saveShapeBtn.disabled = false;
    toast(error.message);
  }
});

removeShapeBtn.addEventListener('click', async () => {
  const name = config.shapeMode;
  const label = IMPORTED.get(name);
  if (!confirm(`Remove "${label}"? This deletes its file from src/engine/shapes/models/.`)) return;
  setPendingShape({ ...config, shapeMode: 'x' }, `Removed "${label}"`);
  try {
    await shapeRequest('DELETE', `/${encodeURIComponent(name)}`);
    location.reload();
  } catch (error) {
    clearPendingShape();
    toast(error.message);
  }
});

syncShapeButtons();

document.getElementById('resetBtn').addEventListener('click', () => {
  // Read the currently-tracked preset before apply()/setConfig() clears it
  // (same ordering the revert button already relies on above). applyLook
  // carries the current shape over unconditionally, so no shape has to be
  // preserved by hand here; normalizeConfig({}) has no "current" to carry
  // anything over from, so the no-preset-tracked branch still does it itself.
  const { shapeMode, shapeText, shapeModelUrl } = config;
  const { name, look } = panel.getActiveLook();
  const next = look
    ? applyLook(config, look)
    : { ...normalizeConfig({}), shapeMode, shapeText, shapeModelUrl };
  apply(next);
  if (name) panel.setInitialPreset(name);
  else panel.clearActivePreset();
  toast(name ? `Reset to ${name}` : 'Reset to defaults');
});

/* ── side panel collapse ──────────────────────────────────────────────── */

const shell = document.querySelector('.shell');
const panelState = loadPanelState();
if (panelState.left) shell.classList.add('collapse-left');
if (panelState.right) shell.classList.add('collapse-right');

document.getElementById('toggleLeft').addEventListener('click', () => {
  shell.classList.toggle('collapse-left');
  savePanelState({
    left: shell.classList.contains('collapse-left'),
    right: shell.classList.contains('collapse-right'),
  });
});
document.getElementById('toggleRight').addEventListener('click', () => {
  shell.classList.toggle('collapse-right');
  savePanelState({
    left: shell.classList.contains('collapse-left'),
    right: shell.classList.contains('collapse-right'),
  });
});

/* ── fps readout ──────────────────────────────────────────────────────── */

if (field.supported) {
  setInterval(() => {
    const { fps, count } = field.getStats();
    panel.setFps(`${fps} fps · ${count.toLocaleString()} particles`);
  }, 500);

  // Fade the hint once the user has actually touched something.
  const hint = document.getElementById('hint');
  const dismiss = () => { hint.style.opacity = '0'; };
  shell.addEventListener('pointerdown', dismiss, { once: true });

  if (source === 'link') toast('Opened a shared effect');
  if (bootMessage) toast(bootMessage);
}

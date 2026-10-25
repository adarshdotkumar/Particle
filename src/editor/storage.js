import { normalizeConfig, diffConfig, matchingPreset, PRESETS } from '../config.js';
import { encodeConfig, decodeConfig } from '../codec.js';

/* Persistence: share links and .json preset files.
 *
 * Two separate needs:
 *   - #hash     so you can send someone your exact effect with no backend
 *   - .json     so you can commit an effect to your own repo
 */

/** A real shared link (a fresh navigation with a #hash) wins; a plain
 *  browser refresh always goes back to the Shards default (the 3D X).
 *
 *  Those two cases look identical by URL alone — every edit keeps the
 *  address bar's hash in sync (see syncHash below), so hitting refresh
 *  normally re-reads the exact hash you left on. performance's navigation
 *  timing entry is what tells them apart: type 'reload' is only a genuine
 *  F5/refresh, never a link someone opened or a script-driven page.goto().
 *
 *  presetName is derived with matchingPreset() rather than remembered,
 *  because a shared link carries no memory of which preset produced it —
 *  if its look is still byte-identical to a known one, the editor shows
 *  that preset as applied instead of nothing. */
export function loadInitialConfig() {
  const pending = consumePendingShape();
  if (pending) return { ...pending, presetName: matchingPreset(pending.config) };

  const isRefresh = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  if (!isRefresh) {
    const hash = location.hash.replace(/^#/, '');
    const fromUrl = hash && decodeConfig(hash);
    if (fromUrl) return { config: fromUrl, source: 'link', presetName: matchingPreset(fromUrl) };
  }

  const config = normalizeConfig(PRESETS.Shards);
  return { config, source: 'preset', presetName: matchingPreset(config) };
}

/* Saving or removing a shape rewrites the shape list in the code, and the dev
   server reloads the page to pick it up. A reload normally resets to the
   default (see loadInitialConfig), so the editor parks the config it wants
   to come back to here first, along with a message to show. */
const PENDING_KEY = 'particle-field:pending-shape';

export function setPendingShape(config, message) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ config, message })); } catch { /* best effort */ }
}

export function clearPendingShape() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* best effort */ }
}

function consumePendingShape() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    const { config, message } = JSON.parse(raw);
    return { config: normalizeConfig(config), source: 'saved-shape', message };
  } catch {
    return null;
  }
}

/** Whether a share link can mean anything here.
 *
 *  On file:// there is nothing shareable to point at. Chrome reports
 *  location.origin as "file://" and pathname as a path on this machine's disk,
 *  so the link comes out as
 *  `file:///Users/someone/Downloads/particle-field-editor.html#...` — valid
 *  only for the person who already has the file. The single-file editor is the
 *  main way designers get this tool, so callers hide the button rather than
 *  hand out a URL that cannot work for anyone else. Save as .json is the
 *  portable path instead. */
export const canShareLinks = () => location.protocol !== 'file:';

export function shareUrl(config) {
  return `${location.origin}${location.pathname}#${encodeConfig(config)}`;
}

/** Reflect the current config in the address bar without adding history
 *  entries — dragging a slider must not fill up the back button. */
export function syncHash(config) {
  history.replaceState(null, '', `#${encodeConfig(config)}`);
}

export function downloadConfig(config, filename = 'particle-effect.json') {
  const json = JSON.stringify(diffConfig(config), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/** Reads an uploaded preset file. Throws on unparseable JSON so the caller can
 *  tell the user; a valid-JSON-but-nonsense file is silently normalized. */
export async function readConfigFile(file) {
  return normalizeConfig(JSON.parse(await file.text()));
}

const PANEL_KEY = 'particle-field:panels';

/** Which side panels were left collapsed, so a returning visit doesn't
 *  re-expand a layout choice the user already made. */
export function loadPanelState() {
  try { return JSON.parse(localStorage.getItem(PANEL_KEY)) || {}; } catch { return {}; }
}

export function savePanelState(state) {
  try { localStorage.setItem(PANEL_KEY, JSON.stringify(state)); } catch { /* see loadInitialConfig */ }
}

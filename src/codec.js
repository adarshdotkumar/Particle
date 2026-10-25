/* codec.js — config <-> URL-safe token, for share links.
 *
 * Encodes only the DIFF against the defaults. A typical tuned look changes
 * 6-15 keys, so the JSON is 100-250 bytes and the token lands around 140-340
 * characters — short enough for a URL fragment with no compression library,
 * which keeps this module dependency-free.
 */
import { normalizeConfig, diffConfig } from './config.js';

// btoa/atob are byte-oriented, so unicode has to go through UTF-8 first.
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Config -> compact URL-safe token. */
export function encodeConfig(config) {
  const json = JSON.stringify(diffConfig(config));
  return toB64(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token -> full config, or null if the token is unusable.
 *  Always re-normalizes: a URL is untrusted input. */
export function decodeConfig(token) {
  if (typeof token !== 'string' || token.length === 0) return null;
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const parsed = JSON.parse(fromB64(b64));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return normalizeConfig(parsed);
  } catch {
    return null;
  }
}

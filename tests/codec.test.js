import { describe, it, expect } from 'vitest';
import { encodeConfig, decodeConfig } from '../src/codec.js';
import { DEFAULTS, PRESETS, RANGES, normalizeConfig } from '../src/config.js';

describe('codec', () => {
  it('round-trips every preset', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const config = normalizeConfig(preset);
      expect(decodeConfig(encodeConfig(config)), name).toEqual(config);
    }
  });

  it('produces a URL-safe string with no padding', () => {
    const s = encodeConfig(normalizeConfig(PRESETS.Shards));
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('stays short enough for a URL fragment', () => {
    const s = encodeConfig(normalizeConfig(PRESETS.Shards));
    expect(s.length).toBeLessThan(600);
  });

  it('encodes the defaults to an empty payload and back', () => {
    expect(decodeConfig(encodeConfig(DEFAULTS))).toEqual(normalizeConfig({}));
  });

  it('returns null for junk rather than throwing', () => {
    for (const junk of ['', '!!!!', null, undefined, 42, {}]) {
      expect(() => decodeConfig(junk)).not.toThrow();
    }
    expect(decodeConfig('!!!!')).toBeNull();
    expect(decodeConfig('')).toBeNull();
    expect(decodeConfig(null)).toBeNull();
  });

  it('returns null when the payload is not a config object', () => {
    expect(decodeConfig(encodeJson('[1,2,3]'))).toBeNull();
    expect(decodeConfig(encodeJson('"hello"'))).toBeNull();
    expect(decodeConfig(encodeJson('null'))).toBeNull();
  });

  it('normalizes a tampered payload instead of trusting it', () => {
    const evil = encodeConfig({ ...DEFAULTS, spring: 99999 });
    expect(decodeConfig(evil).spring).toBe(RANGES.spring.max);
  });

  it('survives unicode in shapeText', () => {
    const c = normalizeConfig({ shapeText: 'héllo→✦' });
    expect(decodeConfig(encodeConfig(c)).shapeText).toBe('héllo→✦');
  });
});

/* Helper: base64url-encode a raw JSON string, bypassing encodeConfig so we can
   craft payloads it would never produce. */
function encodeJson(json) {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

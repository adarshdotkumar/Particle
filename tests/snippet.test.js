import { describe, it, expect } from 'vitest';
import { generateSnippet } from '../src/snippet.js';
import { normalizeConfig, PRESETS, DEFAULTS } from '../src/config.js';
import { REPO, TAG, PACKAGE } from '../src/cdn.js';

// shapeText is deliberately NOT 'HELLO' — that is the default, so diffConfig
// would (correctly) omit it and there would be nothing to assert on.
const config = normalizeConfig({ ...PRESETS.Smoke, shapeMode: 'text', shapeText: 'WAVE' });

const attrPayload = (out) => JSON.parse(out.match(/data-particle-field='([\s\S]*?)'>/)[1]);

describe('generateSnippet', () => {
  it('emits a single script tag and a container for the script flavor', () => {
    const out = generateSnippet(config, { flavor: 'script' });
    expect(out).toContain('<div');
    expect(out.match(/<script/g)).toHaveLength(1);
    expect(out).toContain('particle-field.min.js');
  });

  it('embeds only the non-default keys', () => {
    const payload = attrPayload(generateSnippet(config, { flavor: 'script' }));
    expect(payload.spring).toBe(0.65);
    expect(payload).not.toHaveProperty('mouseRadius'); // Smoke does not change it
  });

  it('emits valid JSON for the config payload', () => {
    expect(attrPayload(generateSnippet(config, { flavor: 'script' })).shapeText).toBe('WAVE');
  });

  it('omits a key whose value happens to equal the default', () => {
    const c = normalizeConfig({ shapeMode: 'text', shapeText: 'HELLO' });
    const payload = attrPayload(generateSnippet(c, { flavor: 'script' }));
    expect(payload.shapeMode).toBe('text');
    expect(payload).not.toHaveProperty('shapeText'); // 'HELLO' is the default
  });

  it('never emits a bare single quote inside the attribute payload', () => {
    const tricky = normalizeConfig({ shapeText: "it's" });
    const out = generateSnippet(tricky, { flavor: 'script' });
    const raw = out.match(/data-particle-field='([\s\S]*?)'>/)[1];
    expect(raw).not.toContain("'");
    expect(JSON.parse(raw).shapeText).toBe("it's");
  });

  it('escapes a closing script tag so the snippet cannot break out', () => {
    const nasty = normalizeConfig({ shapeText: '</script>' });
    const out = generateSnippet(nasty, { flavor: 'script' });
    expect(out.match(/<\/script>/g)).toHaveLength(1); // only the real one
  });

  it('uses an import from particle-field for the esm flavor', () => {
    const out = generateSnippet(config, { flavor: 'esm' });
    expect(out).toContain(`from '${PACKAGE}'`);
    expect(out).toContain('new ParticleField(');
  });

  /* The react flavor uses the packaged component rather than a hand-rolled
     useEffect: teardown on unmount and cheap config updates are both easy to
     get wrong by hand, and both fail silently. */
  it('uses the packaged component for the react flavor', () => {
    const out = generateSnippet(config, { flavor: 'react' });
    expect(out).toContain(`from '${PACKAGE}/react'`);
    expect(out).toContain('<ParticleField');
    expect(out).toContain('config={');
    // No manual lifecycle for the user to forget.
    expect(out).not.toContain('useEffect');
    expect(out).not.toContain('.destroy()');
  });

  it('passes mode and height through to the react component', () => {
    const out = generateSnippet(config, { flavor: 'react', mode: 'background', height: 900 });
    expect(out).toContain('mode="background"');
    expect(out).toContain('height: 900');
  });

  it('honours mode and height', () => {
    const bg = generateSnippet(config, { flavor: 'script', mode: 'background' });
    expect(attrPayload(bg).mode).toBe('background');
    expect(generateSnippet(config, { flavor: 'script', height: 800 })).toContain('800px');
    expect(attrPayload(generateSnippet(config, { flavor: 'script' }))).not.toHaveProperty('mode');
  });

  it('emits an empty payload when the config is all defaults', () => {
    const out = generateSnippet(normalizeConfig(DEFAULTS), { flavor: 'script' });
    expect(out).toContain('data-particle-field');
    expect(attrPayload(out)).toEqual({});
  });

  it('defaults to the script flavor', () => {
    expect(generateSnippet(config)).toContain('<script');
  });

  it('throws on an unknown flavor rather than emitting broken code', () => {
    expect(() => generateSnippet(config, { flavor: 'jquery' })).toThrow(/flavor/i);
  });
});

describe('the embed URL', () => {
  it("points at jsDelivr's GitHub CDN, not npm", () => {
    const out = generateSnippet(config, { flavor: 'script' });
    expect(out).toContain('https://cdn.jsdelivr.net/gh/');
    expect(out).not.toContain('cdn.jsdelivr.net/npm/');
  });

  /* Pinned, not floating. A snippet already pasted on someone's live site must
     not change appearance because we shipped a release. */
  it('pins an exact tag rather than a floating latest', () => {
    const out = generateSnippet(config, { flavor: 'script' });
    expect(out).toContain(`@${TAG}/dist/particle-field.min.js`);
    expect(out).not.toContain('@latest');
  });

  it('embeds the configured repo', () => {
    expect(generateSnippet(config, { flavor: 'script' })).toContain(REPO);
  });

  it('still honours an explicit cdn override', () => {
    const out = generateSnippet(config, {
      flavor: 'script', cdn: 'https://example.test/pf', version: 'v9',
    });
    expect(out).toContain('https://example.test/pf@v9/dist/particle-field.min.js');
  });

  it('exposes a tag that looks like a version', () => {
    expect(TAG).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('exposes a repo in owner/name form', () => {
    expect(REPO).toMatch(/^[^/\s]+\/[^/\s]+$/);
  });
});

describe('generateSnippet: custom shape URLs', () => {
  it('passes through an already-hosted http(s) shapeModelUrl untouched', () => {
    const out = generateSnippet({
      shapeMode: 'custom',
      shapeModelUrl: 'https://example.com/assets/my-model.glb',
    });
    expect(out).toContain('https://example.com/assets/my-model.glb');
  });

  it('replaces a local blob: shapeModelUrl with a placeholder', () => {
    const out = generateSnippet({
      shapeMode: 'custom',
      shapeModelUrl: 'blob:http://localhost:5199/abcd-1234',
    });
    expect(out).not.toContain('blob:');
    expect(out).toContain('REPLACE_WITH_YOUR_HOSTED_MODEL_URL.glb');
  });
});

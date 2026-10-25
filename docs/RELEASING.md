# Releasing

Every embed snippet anyone has ever pasted points at a specific tag on this
repo. That makes releasing slightly unusual, and it makes one mistake
expensive: **a tag whose `dist/` is missing or stale silently breaks live
websites that were working.** Read this before tagging.

## How the delivery actually works

jsDelivr serves files straight off a **public** GitHub repo's tree:

```
https://cdn.jsdelivr.net/gh/<owner>/<repo>@<tag>/dist/particle-field.min.js
```

Three consequences:

1. **It reads the repo tree, not Release assets.** `dist/particle-field.min.js`
   must be committed and present at the tag. This is why `dist/` is not in
   `.gitignore`.
2. **The repo must be public.** A private repo returns 404 from jsDelivr, no
   matter how the URL is formed.
3. **Tagged URLs are cached permanently.** jsDelivr treats
   `@v1.2.3` as immutable. Moving or force-pushing a tag will not reliably
   update what visitors receive, and you may end up with different users served
   different bytes from the same URL. **Never move a tag. Cut a new one.**

## First release, one time only

1. The **public** GitHub repo is `adarshdotkumar/Particle`. If you
   pick a different name, change `REPO` in [`src/cdn.js`](../src/cdn.js) and
   the URLs in `package.json` to match.
2. Push `main`, then follow the steps below.
3. Publish to npm once: `npm login`, then `npm publish` (the scoped name is
   public via `publishConfig`).

## Every release

```bash
# 1. Bump the pinned tag so emitted snippets point at what you're about to ship
#    src/cdn.js  →  export const TAG = 'v0.2.0';

# 2. Build both artifacts and commit dist/
npm run build:all
git add src/cdn.js dist
git commit -m "release: v0.2.0"

# 3. Tag and push
git tag v0.2.0
git push origin main --follow-tags
```

Pushing the tag triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml),
which rebuilds, verifies, and attaches `particle-field-editor.html` to a GitHub
Release so designers have a one-click download.

The workflow **fails the job if `TAG` in `src/cdn.js` does not match the pushed
git tag.** That mismatch is the silent-breakage case above, so CI catches it
rather than a person noticing weeks later.

## Verify before you tell anyone

jsDelivr needs a minute or two to pick up a new tag.

```bash
curl -I "https://cdn.jsdelivr.net/gh/<owner>/particle-field@v0.2.0/dist/particle-field.min.js"
```

Expect `HTTP/2 200`. A `404` means one of: the repo is private, `dist/` was not
committed at that tag, or the tag has not reached GitHub yet.

Then the real check — paste an unmodified snippet from the editor into a scratch
HTML file, with no local `dist/` anywhere near it, and confirm the effect
renders.

## What breaks what

| Change | Effect on already-pasted snippets |
| --- | --- |
| New tag, `dist/` committed | None. They keep using their old tag, unchanged. |
| Renaming or moving `dist/particle-field.min.js` | Every snippet at every past tag breaks. Don't. |
| Making the repo private | Every snippet everywhere breaks immediately. |
| Deleting an old tag | Every snippet pinned to it breaks. |
| Changing a config key name | Snippets carrying that key silently fall back to the default, because `normalizeConfig` drops unknown keys. Treat config keys as permanent API. |

Config keys are the part most easily broken by accident. They're validated in
[`src/config.js`](../src/config.js) and there's a test asserting unknown keys are
dropped — which is the right behaviour for tampered input, and exactly what
makes a rename fail quietly instead of loudly.

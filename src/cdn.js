/* Where the pasted embed snippet loads the engine from.
 *
 * jsDelivr serves any PUBLIC GitHub repo straight off the repo tree — no npm
 * publish, no hosting account, no bill, globally cached. Note "repo tree", NOT
 * Release assets: dist/particle-field.min.js has to be committed at the tag for
 * this URL to resolve. That is why dist/ is not gitignored. See
 * docs/RELEASING.md.
 *
 * The repo must be PUBLIC for this URL to resolve.
 */
export const REPO = 'adarshdotkumar/Particle';

/* The npm name the ESM and React snippets import from. Scoped because the
 * bare name `particle-field` belongs to an unrelated package on npm — an
 * unscoped import would install a stranger's library. */
export const PACKAGE = '@adarshdotkumar/particle-field';

/* Pinned deliberately, not @latest. Someone pastes a snippet into their live
 * site and never touches it again; a floating version would let our next
 * release silently change how their page looks. Bump this on every tagged
 * release — .github/workflows/release.yml fails the build if it disagrees with
 * the pushed tag. */
export const TAG = 'v0.1.0';

export const CDN_BASE = `https://cdn.jsdelivr.net/gh/${REPO}`;

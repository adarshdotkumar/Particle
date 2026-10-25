import { generateSnippet } from '../snippet.js';

/* The export panel: press one button, paste the result into your website.
 * This is the whole point of the tool — everything else is upstream of it.
 *
 * Written for someone who does not code. So: one primary button that always
 * copies the plain-HTML block, an instruction in words rather than a label, and
 * the ESM/React variants folded away under "For developers" where they cannot
 * confuse anyone who does not need them.
 */

const DEV_FLAVORS = [
  ['esm', 'JavaScript'],
  ['react', 'React'],
];

export function createExportPanel({ getConfig, onCopy, importedShapes = new Map() }) {
  const $ = (id) => document.getElementById(id);

  const details = $('embed');
  const devDetails = $('embedDev');
  const flavorHost = $('embedFlavors');
  const codeEl = $('embedCode');
  const devCodeEl = $('embedDevCode');
  const modeEl = $('embedMode');
  const heightEl = $('embedHeight');
  const copyBtn = $('copyCodeBtn');
  const copyDevBtn = $('copyDevBtn');
  const shapeNote = $('embedShapeNote');

  let devFlavor = 'esm';

  for (const [key, label] of DEV_FLAVORS) {
    const button = document.createElement('button');
    button.textContent = label;
    button.dataset.flavor = key;
    button.addEventListener('click', () => {
      devFlavor = key;
      syncFlavors();
      refresh();
    });
    flavorHost.appendChild(button);
  }

  function syncFlavors() {
    flavorHost.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.flavor === devFlavor);
    });
  }

  function options(flavor) {
    const height = Number(heightEl.value);
    return {
      flavor,
      mode: modeEl.value,
      height: Number.isFinite(height) && height > 0 ? Math.round(height) : 600,
    };
  }

  /* The primary button always emits the plain-HTML block, whatever the
     developer section happens to be showing. A big button that copies
     something other than what it says would be a trap. */
  const htmlSnippet = () => generateSnippet(getConfig(), options('script'));
  const devSnippet = () => generateSnippet(getConfig(), options(devFlavor));

  /* Two shapes need one more step before a pasted snippet shows them. Said
     here, next to the code, because that is where someone will be looking. */
  function syncShapeNote() {
    const { shapeMode } = getConfig();
    shapeNote.hidden = true;
    shapeNote.replaceChildren();
    const say = (...parts) => {
      for (const part of parts) {
        shapeNote.append(Array.isArray(part)
          ? Object.assign(document.createElement('code'), { textContent: part[0] })
          : part);
      }
      shapeNote.hidden = false;
    };
    if (shapeMode === 'custom') {
      say('Upload your .glb to your own site, then replace ',
        ['REPLACE_WITH_YOUR_HOSTED_MODEL_URL.glb'], ' with its address. The effect loads it from there.');
    } else if (importedShapes.has(shapeMode)) {
      say(`"${importedShapes.get(shapeMode)}" lives in your copy of this repo, so the public build doesn't have it. Run `,
        ['npm run build:lib'], ' and host ', ['dist/particle-field.min.js'],
        ' yourself, or point ', ['REPO'], ' in ', ['src/cdn.js'], ' at your own public fork.');
    }
  }

  function refresh() {
    if (!details.open) return; // no point regenerating a panel nobody can see
    syncShapeNote();
    codeEl.textContent = htmlSnippet();
    if (devDetails.open) devCodeEl.textContent = devSnippet();
  }

  /** Copy, with a fallback that selects the text so a dead button is never the
   *  outcome. navigator.clipboard needs a secure context; file:// does qualify
   *  in current Chrome and Firefox, but that is policy rather than guarantee. */
  async function copy(text, button, fallbackEl) {
    try {
      await navigator.clipboard.writeText(text);
      onCopy?.('Copied — paste it into your page');
    } catch {
      selectAll(fallbackEl);
      onCopy?.('Press ⌘C / Ctrl+C to copy');
    }
    const original = button.textContent;
    button.textContent = 'Copied ✓';
    button.classList.add('ok');
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove('ok');
    }, 1600);
  }

  modeEl.addEventListener('change', () => {
    // Height is meaningless for a fullscreen background.
    heightEl.disabled = modeEl.value === 'background';
    refresh();
  });
  heightEl.addEventListener('input', refresh);
  details.addEventListener('toggle', refresh);
  devDetails.addEventListener('toggle', refresh);

  copyBtn.addEventListener('click', () => copy(htmlSnippet(), copyBtn, codeEl));
  copyDevBtn.addEventListener('click', () => copy(devSnippet(), copyDevBtn, devCodeEl));

  syncFlavors();
  heightEl.disabled = modeEl.value === 'background';
  refresh();

  return { refresh };
}

function selectAll(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

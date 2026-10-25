# Make a particle effect for your website

No installing, no code, no terminal. Four steps.

---

## 1. Download the editor

Go to the **[Releases page](../../releases/latest)** and download
**`particle-field-editor.html`**.

It's one file, about half a megabyte. It goes to your Downloads folder like
anything else.

## 2. Double-click it

It opens in your browser and starts running. That's the whole install.

It works with your wifi off — everything it needs is inside the file. Nothing is
uploaded anywhere, and nothing you make leaves your computer unless you choose to
share it.

> **Nothing appears?** Your graphics card may be too old — the effect needs a
> feature called float textures. The editor will tell you if that's the case.
> Try a different browser or a newer machine.

## 3. Make something you like

- **Presets** — the fastest start. Click through Smoke, Shimmer, Crisp, Chaos,
  Nebula, Rain and Shards to see the range, then adjust from whichever is
  closest.
- **Shape** — a sphere, a cube, the 3D **X**, or **Text**, where you type your own
  word. Your word survives clicking through presets, so you can type it once and
  keep browsing looks.
- **Sliders** — grouped by what you're trying to change (Wind, Stream, Hold,
  Cursor, Dots, 3D). Each has a plain-English hint underneath. Nothing you do
  can break it; **Reset** returns everything to the start.
- **Colour** — two swatches. Dots start at the first colour and age into the
  second.
- **Particle count** — more is denser and heavier. 65,536 is a good default.
  Drop it if your fan spins up.

Move your cursor over the effect: particles get pushed away from it. That
happens on your live site too.

### Upload your own shape

Not stuck with a sphere, a cube, the X, or typed text — click **Upload a
shape (.glb)** in the Save & share area and pick a file exported from
Blender (or anything else that exports glTF). The particles re-form on its
surface immediately, and every slider tunes it exactly like any other shape.

If the file doesn't load — the wrong format, or nothing usable inside it —
the editor falls back to a plain sphere and tells you so. Nothing breaks.

In Blender, export with **File → Export → glTF 2.0**, choose **glTF Binary
(.glb)**, and leave **Compression** off.

If someone runs the tool for you from its code (`npm run dev`), there is also
a **Save as shape** button: it keeps your model as a shape of its own, with
its own button, for good.

### Keeping your work

The editor remembers what you were doing and restores it next time you open it.

To keep an effect properly — or to move it to another computer — press
**Save as .json**. That downloads a small text file. **Load .json** brings it
back later. Do this for anything you care about; browser memory can be cleared
by accident.

## 4. Put it on your website

Open **Put this on your website**, at the bottom of the panel.

- **Placement** — *In a container* puts the effect inside a box on your page,
  the usual choice for a hero or a section header. *Fullscreen background* pins
  it behind your whole page.
- **Height** — how tall the box is, in pixels. 600 is a reasonable hero.

Press **Copy code**. You now have one block of HTML on your clipboard that looks
roughly like this:

```html
<div style="height:600px"
     data-particle-field='{"shapeMode":"text","shapeText":"HELLO"}'></div>
<script src="https://cdn.jsdelivr.net/gh/adarshdotkumar/Particle@v0.1.0/dist/particle-field.min.js" defer></script>
```

Paste it into your page where you want the effect to appear.

**If your shape is an uploaded model**, the copied code will contain
`REPLACE_WITH_YOUR_HOSTED_MODEL_URL.glb` instead of a real link — the editor
can't know where you'll put your `.glb` file. Upload that file to your own
site (next to your images, or wherever your host puts files) and swap the
placeholder for its real address, the same way you'd point at any image.

**If you're not sure where that is, send the block to whoever built your site**
and say: *"Please paste this into the page where I've marked it."* That's all
they need — it's ordinary HTML with no setup, no build step and no account.

### What they should know

Two things worth passing along:

1. **The box needs a height.** The effect fills its container, so a container
   with no height shows nothing. The pasted code sets one; if they move it into
   their own layout, the height has to come from somewhere.
2. **Content can sit on top of it.** The effect is transparent and ignores
   mouse clicks, so headlines and buttons layered over it keep working. They'll
   want `position: relative` and a `z-index` on that content —
   [EMBEDDING.md](EMBEDDING.md) has the details.

## Things worth knowing

- **It pauses itself.** When the effect scrolls out of view, or the visitor
  switches tabs, it stops drawing. It won't drain a laptop battery sitting
  off-screen.
- **It respects reduced motion.** Visitors who've asked their system to reduce
  motion see the shape formed and still, rather than moving. You don't have to
  do anything.
- **It's lighter on phones.** Particle count drops automatically on small
  screens.
- **Old devices degrade quietly.** Where the effect can't run, it's skipped and
  the rest of the page is unaffected — no error, no blank box.
- **Changing your effect later** means opening the editor again, making the
  change, and re-copying the block. The pasted code carries your settings inside
  it, so there's nothing to log into.

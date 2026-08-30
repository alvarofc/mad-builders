# brand asset generators

One-off Node scripts that produced the committed brand assets under `public/`.
Run them from the repo root (`node scripts/brand/<script>.mjs`). Most read only
committed files; the two exceptions are noted below.

- **make-mad-mark.mjs**: builds the `mad` mark (cream/green logo SVG+PNG and the
  square sticker) by lifting the already-outlined glyphs from
  `public/logo/mad-builders-cream.svg`. Standalone.
- **bake-logo-dim-colours.mjs**: replaces translucent dimming in the full
  wordmarks and `m.` marks with solid colours, then rebuilds their PNGs. Run it
  if those SVGs are replaced or re-exported.
- **rebuild-sticker-pack.mjs**: rebuilds `sticker-sheet.png`, `README.txt` and
  the download zip from the sticker PNG previews. Standalone.
- **make-stickers-print.mjs**: one-shot that rewrote the three original sticker
  SVGs to be print/die-cut ready (explicit mm sizes, 3mm bleed, a vector
  `CutContour` in 100% magenta). Already applied, so rerunning it on the
  transformed files won't re-match; kept for reference only.
- **make-sticker-proof.mjs**: builds `sticker-proof-a4.pdf`, an actual-size A4
  proof, via headless Chrome. Resolves Chrome from `CHROME_PATH` or common
  install locations.
- **make-banner.mjs**: builds `public/banners/x-header.png` (the X / LinkedIn
  header) from the homepage hero photos in `src/assets/events`. Needs the
  Bricolage Grotesque fonts available to fontconfig:
  `FONTCONFIG_FILE=<conf pointing at the Bricolage ttfs> node scripts/brand/make-banner.mjs`

Colours: green `#1a342b`, cream `#f6f5f0`. The solid dimmed tones used in the
exported logos are `#7d8b84` on cream and `#a2aca5` on green.

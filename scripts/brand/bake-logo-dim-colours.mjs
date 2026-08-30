// The dimmed part of the transparent wordmarks used to rely on fill-opacity.
// That looked right on the prescribed solid background, but let photos and
// other artwork show through the glyphs. Bake the same visible tones into
// opaque fills, then rebuild the matching PNGs from the vector originals.
//
// Antialiasing remains in the edge pixels. Only the glyph interiors become
// fully opaque; the canvas stays transparent.
import fs from 'node:fs';
import sharp from 'sharp';

const variants = [
  {
    svg: 'public/logo/mad-builders-green.svg',
    png: 'public/logo/mad-builders-green.png',
    width: 1600,
    translucent: 'fill="#1a342b" fill-opacity="0.55"',
    baked: 'fill="#7d8b84"',
  },
  {
    svg: 'public/logo/mad-builders-cream.svg',
    png: 'public/logo/mad-builders-cream.png',
    width: 1600,
    translucent: 'fill="#f6f5f0" fill-opacity="0.62"',
    baked: 'fill="#a2aca5"',
  },
  {
    svg: 'public/logo/mad-builders-m-green.svg',
    png: 'public/logo/mad-builders-m-green.png',
    width: 428,
    translucent: 'fill="#1a342b" fill-opacity="0.55"',
    baked: 'fill="#7d8b84"',
  },
  {
    svg: 'public/logo/mad-builders-m-cream.svg',
    png: 'public/logo/mad-builders-m-cream.png',
    width: 428,
    translucent: 'fill="#f6f5f0" fill-opacity="0.62"',
    baked: 'fill="#a2aca5"',
  },
];

for (const variant of variants) {
  let svg = fs.readFileSync(variant.svg, 'utf8');

  if (svg.includes(variant.translucent)) {
    svg = svg.replace(variant.translucent, variant.baked);
    fs.writeFileSync(variant.svg, svg);
  } else if (!svg.includes(variant.baked)) {
    throw new Error(`${variant.svg}: expected dimmed fill not found`);
  }

  await sharp(Buffer.from(svg))
    .resize({ width: variant.width })
    .png()
    .toFile(`${variant.png}.tmp`);
  fs.renameSync(`${variant.png}.tmp`, variant.png);
}

console.log('Baked dim logo colours and rebuilt 4 PNGs.');

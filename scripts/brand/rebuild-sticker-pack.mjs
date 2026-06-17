// Rebuild the sticker sheet preview (now 4 designs), the print-notes README,
// and the download zip. Uses the existing clean PNG previews.
import fs from 'node:fs';
import sharp from 'sharp';
import { execSync } from 'node:child_process';

const DIR = 'public/stickers/';

// --- sheet preview: wordmark on top, m. / mad. / qr in a row below ---
const W = 900, H = 560;
const wordmark = await sharp(DIR + 'sticker-wordmark.png').resize({ width: 760 }).toBuffer();
const sq = 200;
const row = await Promise.all(
  ['sticker-m.png', 'sticker-mad.png', 'sticker-qr.png'].map((f) =>
    sharp(DIR + f).resize(sq, sq).toBuffer()
  )
);
const startX = Math.round((W - (3 * sq + 2 * 40)) / 2);
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: wordmark, left: Math.round((W - 760) / 2), top: 48 },
    { input: row[0], left: startX, top: 300 },
    { input: row[1], left: startX + sq + 40, top: 300 },
    { input: row[2], left: startX + 2 * (sq + 40), top: 300 },
  ])
  .png()
  .toFile(DIR + 'sticker-sheet.png');
console.log('rebuilt sticker-sheet.png');

// --- README (4 designs) ---
const readme = `mad.builders stickers: print notes

Each design ships as vector SVG (for die-cutting) plus a PNG preview.

Die-cut:
- The magenta line (id "CutContour") is the cut path. It's a vector outline,
  cut along it. Do not print the magenta.
- Every shape has rounded corners.
- Files include 3mm bleed (white extends past the cut line).

Finished (trim) sizes:
    m.            50 x 50 mm
    mad.          50 x 50 mm
    qr            50 x 50 mm
    mad.builders  153 x 45 mm

Smallest dimension is 45mm, above a 40mm cutter minimum.

Colours: green #1a342b, cream #f6f5f0.

sticker-proof-a4.pdf: print this on A4 at 100% (no "fit to page") to see every
sticker at actual size. There's a 100mm line on it; measure it to confirm the
scale before trusting the proof.
`;
fs.writeFileSync(DIR + 'README.txt', readme);

// --- zip: all SVGs + PNG previews + README ---
execSync(
  `cd ${DIR} && rm -f mad-builders-stickers.zip && zip -q mad-builders-stickers.zip `
  + `sticker-m.svg sticker-m.png sticker-mad.svg sticker-mad.png `
  + `sticker-wordmark.svg sticker-wordmark.png sticker-qr.svg sticker-qr.png `
  + `sticker-proof-a4.pdf README.txt`,
  { stdio: 'inherit' }
);
console.log('rebuilt zip');

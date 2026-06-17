// Build the "mad." mark (middle tier between the full wordmark and the m.)
// by reusing the already-outlined glyphs from the full wordmark SVG:
//   path 1 = "mad" letters, first subpath of path 2 = the "." dot.
// Outputs flat cream/green logo SVGs+PNGs and a square die-cut sticker.
import fs from 'node:fs';
import sharp from 'sharp';

const cream = fs.readFileSync('public/logo/mad-builders-cream.svg', 'utf8');
const ds = [...cream.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
const madD = ds[0];                                   // m + a + d (no dot)

// vertical metrics match the full wordmark; width runs to the d's right edge
const VB = { x: 7.5, y: -71.1, w: 190.9, h: 72.4 };

const flat = (mad) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="${VB.w}" height="${VB.h}" role="img" aria-label="mad">
  <path d="${madD}" fill="${mad}"/>
</svg>`;

const creamSvg = flat('#f6f5f0');
const greenSvg = flat('#1a342b');
fs.writeFileSync('public/logo/mad-builders-mad-cream.svg', creamSvg);
fs.writeFileSync('public/logo/mad-builders-mad-green.svg', greenSvg);
await sharp(Buffer.from(creamSvg)).resize({ width: 700 }).png().toFile('public/logo/mad-builders-mad-cream.png');
await sharp(Buffer.from(greenSvg)).resize({ width: 700 }).png().toFile('public/logo/mad-builders-mad-green.png');

// --- square die-cut sticker (50x50mm, 3mm bleed, magenta cut contour) ---
const W = 220, H = 220, RX = 52, uPerMm = W / 50, B = 3 * uPerMm;
const SCALE = 0.84;
// "mad" bbox: x 7.5..198.4 (cx 102.95). Centre on the x-height body (cy -26.05,
// same as the m. sticker) so the tall d-ascender doesn't push the word low.
const glyph = `<g transform="translate(110 110) scale(${SCALE}) translate(-102.95 26.05)">
    <path d="${madD}" fill="#f6f5f0"/>
  </g>`;

const stickerPrint = `<svg xmlns="http://www.w3.org/2000/svg" width="56.00mm" height="56.00mm" viewBox="${-B} ${-B} ${W + 2 * B} ${H + 2 * B}">
  <!-- 3mm bleed: white extends past the cut -->
  <rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${H + 2 * B}" rx="${RX + B}" fill="#ffffff"/>
  <rect width="${W}" height="${H}" rx="${RX}" fill="#ffffff"/>
  <rect x="16" y="16" width="188" height="188" rx="40" fill="#1a342b"/>
  ${glyph}
  <!-- die-cut line: vector 'CutContour' in 100% magenta. cut along this; do not print it. -->
  <rect id="CutContour" x="0" y="0" width="${W}" height="${H}" rx="${RX}" fill="none" stroke="#EC008C" stroke-width="${(0.25 * uPerMm).toFixed(2)}"/>
</svg>`;
fs.writeFileSync('public/stickers/sticker-mad.svg', stickerPrint);

// clean preview (no bleed, no cut line)
const stickerClean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" rx="${RX}" fill="#ffffff"/>
  <rect x="16" y="16" width="188" height="188" rx="40" fill="#1a342b"/>
  ${glyph}
</svg>`;
await sharp(Buffer.from(stickerClean)).resize(600).png().toFile('public/stickers/sticker-mad.png');

// preview composites for review
await sharp(Buffer.from(creamSvg)).resize({ width: 700 }).flatten({ background: '#1a342b' }).png().toFile('.ogtmp/view-mad-cream.png');
await sharp(Buffer.from(greenSvg)).resize({ width: 700 }).flatten({ background: '#f6f5f0' }).png().toFile('.ogtmp/view-mad-green.png');
console.log('wrote mad. logos + sticker');

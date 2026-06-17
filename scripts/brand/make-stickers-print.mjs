// Make the sticker SVGs print/die-cut ready, in place:
//  - explicit physical size in mm (>= the printer's 4cm cutter minimum)
//  - 3mm bleed (white background extended past the cut)
//  - a vector cut contour: rounded outline as a 100% magenta 'CutContour' path
// PNG previews are left untouched (they stay clean, no cut line).
// Then rebuild the download zip with a print-notes README.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const DIR = 'public/stickers/';
const BLEED_MM = 3;
const CUT = '#EC008C'; // 100% magenta, die-cut spot convention

// target finished (trim) height in mm per sticker; width derives from the art
const files = {
  'sticker-m.svg': { trimH: 50 },
  'sticker-qr.svg': { trimH: 50 },
  'sticker-wordmark.svg': { trimH: 45 },
};

const sizes = {};
for (const [name, c] of Object.entries(files)) {
  const p = DIR + name;
  let s = fs.readFileSync(p, 'utf8');

  const vb = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const W = parseFloat(vb[1]), H = parseFloat(vb[2]);
  const RX = parseFloat(s.match(/<rect[^>]*rx="([\d.]+)"[^>]*fill="#ffffff"/)[1]);

  const uPerMm = H / c.trimH;          // viewBox units per mm
  const trimW = W / uPerMm;
  const B = BLEED_MM * uPerMm;         // bleed in units
  const rootW = (trimW + 2 * BLEED_MM).toFixed(2);
  const rootH = (c.trimH + 2 * BLEED_MM).toFixed(2);
  const sw = (0.25 * uPerMm).toFixed(2);

  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${rootW}mm" height="${rootH}mm" `
    + `viewBox="${(-B).toFixed(2)} ${(-B).toFixed(2)} ${(W + 2 * B).toFixed(2)} ${(H + 2 * B).toFixed(2)}">`;
  const bleed = `\n  <!-- ${BLEED_MM}mm bleed: white extends past the cut -->\n`
    + `  <rect x="${(-B).toFixed(2)}" y="${(-B).toFixed(2)}" width="${(W + 2 * B).toFixed(2)}" height="${(H + 2 * B).toFixed(2)}" rx="${(RX + B).toFixed(2)}" fill="#ffffff"/>`;
  const cut = `\n  <!-- die-cut line: vector 'CutContour' in 100% magenta. cut along this; do not print it. -->\n`
    + `  <rect id="CutContour" x="0" y="0" width="${W}" height="${H}" rx="${RX}" fill="none" stroke="${CUT}" stroke-width="${sw}"/>\n`;

  s = s.replace(/<svg[^>]*>/, '');     // drop old root tag
  s = open + bleed + s;
  s = s.replace('</svg>', cut + '</svg>');
  fs.writeFileSync(p, s);

  sizes[name] = { trimW: Math.round(trimW), trimH: c.trimH };
  console.log(`${name}: trim ${Math.round(trimW)}x${c.trimH}mm, artboard ${rootW}x${rootH}mm (incl. ${BLEED_MM}mm bleed)`);
}

const readme = `mad.builders stickers: print notes

Each design ships as vector SVG (for die-cutting) plus a PNG preview.

Die-cut:
- The magenta line (id "CutContour") is the cut path. It's a vector outline,
  cut along it. Do not print the magenta.
- Every shape has rounded corners.
- Files include ${BLEED_MM}mm bleed (white extends past the cut line).

Finished (trim) sizes:
    m.            ${sizes['sticker-m.svg'].trimW} x ${sizes['sticker-m.svg'].trimH} mm
    qr            ${sizes['sticker-qr.svg'].trimW} x ${sizes['sticker-qr.svg'].trimH} mm
    mad.builders  ${sizes['sticker-wordmark.svg'].trimW} x ${sizes['sticker-wordmark.svg'].trimH} mm

Smallest dimension is ${Math.min(...Object.values(sizes).flatMap(s => [s.trimW, s.trimH]))}mm, above a 40mm cutter minimum.

Colours: green #1a342b, cream #f6f5f0.
`;
fs.writeFileSync(DIR + 'README.txt', readme);

// rebuild the zip: SVGs + PNG previews + README
execSync(
  `cd ${DIR} && rm -f mad-builders-stickers.zip && zip -q mad-builders-stickers.zip `
  + `sticker-m.svg sticker-m.png sticker-wordmark.svg sticker-wordmark.png sticker-qr.svg sticker-qr.png README.txt`,
  { stdio: 'inherit' }
);
console.log('rebuilt mad-builders-stickers.zip');

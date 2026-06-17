// Make the three original sticker SVGs print/die-cut ready, in place:
//  - explicit physical size in mm (>= the printer's 4cm cutter minimum)
//  - 3mm bleed (white background extended past the cut)
//  - a vector cut contour: rounded outline as a 100% magenta 'CutContour' path
// PNG previews are left untouched (they stay clean, no cut line).
//
// Idempotent: SVGs that already carry a CutContour are skipped, so reruns are
// safe. The 'mad' sticker is produced already print-ready by make-mad-mark.mjs.
// After running this, run rebuild-sticker-pack.mjs to refresh the sheet,
// README.txt and the download zip — that script is the one that knows all four
// designs.
import fs from 'node:fs';

const DIR = 'public/stickers/';
const BLEED_MM = 3;
const CUT = '#EC008C'; // 100% magenta, die-cut spot convention

// target finished (trim) height in mm per sticker; width derives from the art
const files = {
  'sticker-m.svg': { trimH: 50 },
  'sticker-qr.svg': { trimH: 50 },
  'sticker-wordmark.svg': { trimH: 45 },
};

for (const [name, c] of Object.entries(files)) {
  const p = DIR + name;
  let s = fs.readFileSync(p, 'utf8');

  if (s.includes('id="CutContour"')) {
    console.log(`${name}: already print-ready, skipping`);
    continue;
  }

  const vb = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const rxm = s.match(/<rect[^>]*rx="([\d.]+)"[^>]*fill="#ffffff"/);
  if (!vb || !rxm) throw new Error(`${name}: unexpected SVG format (expected clean viewBox="0 0 ..." + white rect)`);
  const W = parseFloat(vb[1]), H = parseFloat(vb[2]);
  const RX = parseFloat(rxm[1]);

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

  console.log(`${name}: trim ${Math.round(trimW)}x${c.trimH}mm, artboard ${rootW}x${rootH}mm (incl. ${BLEED_MM}mm bleed)`);
}

console.log('done. run rebuild-sticker-pack.mjs to refresh the sheet, README and zip.');

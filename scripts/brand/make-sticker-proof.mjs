// Build an A4 print-at-home proof of the stickers at ACTUAL size, as a PDF,
// via headless Chrome. Includes a 100mm calibration line to verify 100% scale.
// Output: public/stickers/sticker-proof-a4.pdf
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DIR = 'public/stickers/';
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(DIR + f).toString('base64');
const [wordmark, m, mad, qr] = ['sticker-wordmark.png', 'sticker-m.png', 'sticker-mad.png', 'sticker-qr.png'].map(b64);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact;
         font-family: Arial, Helvetica, sans-serif; color: #1a342b; }
  .page { width: 210mm; height: 297mm; padding: 16mm 14mm; }
  h1 { font-size: 19pt; margin: 0 0 2mm; letter-spacing: -0.4pt; }
  .sub { font-size: 9pt; color: #5a6b63; margin: 0 0 11mm; line-height: 1.5; }
  .grp { margin-bottom: 12mm; }
  .grp-h { font-size: 7.5pt; letter-spacing: 1.6pt; text-transform: uppercase; color: #9aa79f; margin: 0 0 4mm; }
  .stk { display: inline-block; vertical-align: top; text-align: center; margin-right: 9mm; }
  .frame { border: 0.3mm solid #c2cbc5; display: inline-block; line-height: 0; }
  .frame img { display: block; }
  .cap { font-size: 8pt; color: #5a6b63; margin-top: 2.5mm; }
  .cal { margin-top: 6mm; }
  .bar { height: 4mm; width: 100mm; border: 0.4mm solid #1a342b; border-top: 0;
         border-bottom: 0; position: relative; }
  .bar::after { content: ''; position: absolute; left: 0; right: 0; top: 50%;
                border-top: 0.4mm solid #1a342b; }
  .cal .cap { margin-top: 2.5mm; }
</style></head><body><div class="page">
  <h1>mad.builders sticker proof</h1>
  <p class="sub">actual size, for review. print at <b>100%</b>. turn off "fit to page" / "scale to fit".<br>
     check the 100&nbsp;mm line at the bottom with a ruler to confirm the scale.</p>

  <div class="grp">
    <p class="grp-h">wordmark</p>
    <div class="stk"><div class="frame" style="border-radius:22.5mm"><img src="${wordmark}" style="width:153mm;height:45mm"></div><div class="cap">mad.builders &middot; 153 &times; 45 mm</div></div>
  </div>

  <div class="grp">
    <p class="grp-h">marks &amp; qr</p>
    <div class="stk"><div class="frame" style="border-radius:11.8mm"><img src="${m}" style="width:50mm;height:50mm"></div><div class="cap">m. &middot; 50 &times; 50 mm</div></div>
    <div class="stk"><div class="frame" style="border-radius:11.8mm"><img src="${mad}" style="width:50mm;height:50mm"></div><div class="cap">mad &middot; 50 &times; 50 mm</div></div>
    <div class="stk"><div class="frame" style="border-radius:4.85mm"><img src="${qr}" style="width:50mm;height:50mm"></div><div class="cap">qr &middot; 50 &times; 50 mm</div></div>
  </div>

  <div class="cal">
    <p class="grp-h">scale check</p>
    <div class="bar"></div>
    <div class="cap">100 mm reference. measure this line; if it isn't 100&nbsp;mm, the print was scaled</div>
  </div>
</div></body></html>`;

fs.mkdirSync('.ogtmp', { recursive: true });
fs.writeFileSync('.ogtmp/sticker-proof.html', html);
const abs = path.resolve('.ogtmp/sticker-proof.html');
const out = path.resolve(DIR + 'sticker-proof-a4.pdf');

// resolve a Chrome/Chromium binary: CHROME_PATH wins, else common locations
const chrome = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Chrome/Chromium not found. Set CHROME_PATH to the binary.');

execSync(`"${chrome}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${out}" "file://${abs}"`, { stdio: 'inherit' });
console.log('wrote', out);

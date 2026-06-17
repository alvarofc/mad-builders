// Social header generator (1500x500): a playful scatter of tilted "pinned"
// hero photos filling the right side, plus the mad.builders wordmark on the
// left. Uses the same hand-picked hero shots as the homepage. Run from repo
// root with FONTCONFIG_FILE=<conf for the Bricolage fonts> so they're found.
// Outputs public/banners/x-header.png.
//
// 1500x500 is X's exact header size; it's reused for LinkedIn too, which crops
// it a bit (the wordmark is centred vertically so it survives the crop). That
// reuse is an intentional product decision, not an oversight.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const W = 1500, H = 500;
const GREEN_DEEP = '#142a22';
const CREAM = '#f6f5f0';
const P = 'src/assets/events/';

mkdirSync('public/banners', { recursive: true });

// Crop a source photo to the target box, panning the visible window with
// focusX/focusY (0 = left/top, 0.5 = centre, 1 = right/bottom). Lets us choose
// which part of a wide shot to show without changing the tile's place or size.
async function tile(path, w, h, focusX = 0.5, focusY = 0.5) {
  const oriented = await sharp(path).rotate().toBuffer(); // normalise EXIF
  const m = await sharp(oriented).metadata();
  const targetAR = w / h, srcAR = m.width / m.height;
  let cropW, cropH, left, top;
  if (srcAR > targetAR) {
    cropH = m.height; cropW = Math.round(m.height * targetAR);
    left = Math.round((m.width - cropW) * focusX); top = 0;
  } else {
    cropW = m.width; cropH = Math.round(m.width / targetAR);
    left = 0; top = Math.round((m.height - cropH) * focusY);
  }
  const buf = await sharp(oriented)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(w, h).jpeg({ quality: 88 }).toBuffer();
  return buf.toString('base64');
}

// Two interlocking rows of portrait "polaroids" covering the right ~55% of the
// canvas, bleeding off the top, bottom and right edges. Same hero shots as the
// homepage; order avoids putting two photos from the same event side by side.
const PW = 210, PH = 268, B = 11; // photo size + cream border
// [file, x, y, angle, focusX]
const cards = [
  // top row (bleeds off the top)
  ['causa-prima/5.jpeg',   800, -52, -5, 0.85], // pan right to favour the other speaker
  ['metabase/2.jpeg',      970, -34,  4],
  ['adeyemi/2.jpeg',       1140, -50, -3], // golden-hour rooftop, warm accent
  ['revenuecat/2.jpeg',    1310, -38,  5],
  ['ship-10x/1.jpeg',      1480, -48, -4],
  // bottom row (staggered; bleeds off the bottom)
  ['adeyemi/1.jpeg',       754, 208,  4],
  ['openclaw/13.jpeg',     924, 224, -4],
  ['techieclub/17.jpeg',   1094, 206,  3],
  ['zero-to-agent/14.jpeg',1264, 222, -5],
  ['adeyemi/4.jpeg',       1434, 208,  4],
];

const layers = [];
for (const [file, x, y, angle, focusX] of cards) {
  const b64 = await tile(P + file, PW, PH, focusX);
  const cx = x + PW / 2, cy = y + PH / 2;
  layers.push(
    `<g transform="rotate(${angle} ${cx} ${cy})">
       <rect x="${x - B}" y="${y - B}" width="${PW + 2 * B}" height="${PH + 2 * B}" rx="4" fill="${CREAM}"/>
       <image x="${x}" y="${y}" width="${PW}" height="${PH}" href="data:image/jpeg;base64,${b64}"/>
     </g>`
  );
}

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lfade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="${GREEN_DEEP}" stop-opacity="1"/>
      <stop offset="30%" stop-color="${GREEN_DEEP}" stop-opacity="1"/>
      <stop offset="44%" stop-color="${GREEN_DEEP}" stop-opacity="0"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.28"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="${GREEN_DEEP}"/>
  <g filter="url(#sh)">
    ${layers.join('\n    ')}
  </g>
  <rect width="${W}" height="${H}" fill="url(#lfade)"/>

  <text x="84" y="248" font-family="Bricolage Grotesque" font-weight="600"
        font-size="96" letter-spacing="-2.5" fill="${CREAM}">mad<tspan fill-opacity="0.8">.builders</tspan></text>
  <text x="88" y="296" font-family="IBM Plex Mono, Menlo, monospace" font-weight="500"
        font-size="22" letter-spacing="6" fill="${CREAM}" opacity="0.9">THE BUILDERS' HOUSE IN MADRID</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/banners/x-header.png');
console.log('Wrote public/banners/x-header.png');

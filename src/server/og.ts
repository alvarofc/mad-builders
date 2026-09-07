import sharp from 'sharp';
import { resolve } from 'node:path';
import globalCss from '../styles/global.css?raw';

// SVG text uses Fontconfig, not the web fonts loaded by the page.
process.env.FONTCONFIG_FILE = resolve('src/server/fonts/fonts.conf');

const token = (name: string) => {
  const match = globalCss.match(new RegExp(`--${name}:\\s*([^;]+)`));
  if (!match) throw new Error(`Missing brand token: ${name}`);
  return match[1].trim();
};

const escapeXml = (value: string) =>
  value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return entities[character];
  });

const textSize = (value: string, base: number, threshold: number) =>
  Math.max(Math.round(base * 0.62), base - Math.max(0, value.length - threshold) * 1.5);

// ponytail: four lines fit the social card; the linked page keeps the full update.
export const summaryLines = (value: string) => {
  const characters = Array.from(value.trim().replace(/\s+/g, ' '));
  const lines: string[] = [];
  while (characters.length && lines.length < 4) {
    let end = Math.min(42, characters.length);
    if (characters.length > end) {
      const space = characters.slice(0, end + 1).lastIndexOf(' ');
      if (space > 0) end = space;
    }
    lines.push(characters.splice(0, end).join('').trim());
    while (characters[0] === ' ') characters.shift();
  }
  if (characters.length) lines[3] = Array.from(lines[3]).slice(0, 41).join('').trimEnd() + '…';
  return lines;
};

async function renderCard(svg: string, projectUrl?: string | null) {
  const card = sharp(Buffer.from(svg));
  if (projectUrl) {
    try {
      // Fetch only from the same favicon service used by ProjectMark, never the project server.
      const hostname = new URL(projectUrl).hostname;
      const response = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) throw new Error('Logo unavailable');
      const logo = await sharp(Buffer.from(await response.arrayBuffer()), { limitInputPixels: 1024 * 1024 })
        .resize(64, 64, { fit: 'contain', background: token('cream') }).flatten({ background: token('cream') }).png().toBuffer();
      card.composite([{ input: logo, left: 1056, top: 432 }]);
    } catch {
      // Keep the initials already drawn on the card if the logo cannot be loaded.
    }
  }
  return card.png().toBuffer();
}

const projectMark = (name: string) => {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] ?? '').join('').toUpperCase();
  return `<rect x="1048" y="424" width="80" height="80" rx="12" fill="${token('cream')}" />
    <text x="1088" y="475" text-anchor="middle" fill="${token('green')}" font-family="Archivo, sans-serif" font-size="28" font-weight="600">${escapeXml(initials)}</text>`;
};

export async function renderProfileOg(builder: {
  displayName: string;
  projectName: string;
  handle: string;
  projectUrl?: string | null;
  bio?: string | null;
}) {
  const green = token('green');
  const cream = token('cream');
  const dim = token('logo-dim-on-green');
  const name = escapeXml(builder.displayName.slice(0, 36));
  const handle = escapeXml(builder.handle);
  const description = summaryLines(builder.bio ?? '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="${green}" />
      <path d="M72 80H1128M72 516H1128" stroke="${cream}" stroke-opacity="0.14" />
      <text x="72" y="136" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="19" letter-spacing="3">PROOF OF WORK / @${handle}</text>
      <text x="72" y="220" fill="${cream}" font-family="Archivo, sans-serif" font-size="${textSize(builder.projectName.slice(0, 36), 76, 22)}" font-weight="600" letter-spacing="-3">${escapeXml(builder.projectName.slice(0, 36))}</text>
      ${description.map((line, index) => `<text x="72" y="${280 + index * 40}" fill="${cream}" font-family="Archivo, sans-serif" font-size="32">${escapeXml(line)}</text>`).join('')}
      <text x="72" y="488" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="16" letter-spacing="2">BUILT BY ${name}</text>
      ${projectMark(builder.projectName)}
      <text x="72" y="574" fill="${cream}" font-family="Bricolage Grotesque, Archivo, sans-serif" font-size="27" font-weight="500">mad<tspan fill="${dim}" font-weight="400">.builders</tspan></text>
    </svg>`;
  return renderCard(svg, builder.projectUrl);
}

export async function renderResultOg(published: {
  displayName: string;
  handle: string;
  status: string;
  summary: string;
  weekStartDate: string;
  projectName: string;
  proofStatus: string;
  streak: number;
  rank?: number | null;
  projectUrlAtPublish?: string | null;
  projectSentence?: string;
}) {
  const green = token('green');
  const cream = token('cream');
  const dim = token('logo-dim-on-green');
  const name = escapeXml(published.displayName.slice(0, 48));
  const description = summaryLines(published.projectSentence ?? '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="${green}" />
      <path d="M72 80H1128M72 516H1128" stroke="${cream}" stroke-opacity="0.14" />
      <text x="72" y="136" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="19" letter-spacing="3">WEEKLY UPDATE / ${published.weekStartDate}${published.rank ? ` / #${published.rank}` : ''}</text>
      <text x="72" y="220" fill="${cream}" font-family="Archivo, sans-serif" font-size="${textSize(published.projectName.slice(0, 36), 76, 22)}" font-weight="600" letter-spacing="-3">${escapeXml(published.projectName.slice(0, 36))}</text>
      ${description.map((line, index) => `<text x="72" y="${280 + index * 40}" fill="${cream}" font-family="Archivo, sans-serif" font-size="32">${escapeXml(line)}</text>`).join('')}
      <text x="72" y="488" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="16" letter-spacing="2">BUILT BY ${name}</text>

      <text x="1128" y="574" text-anchor="end" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="18">${published.streak} WEEK STREAK</text>
      ${projectMark(published.projectName)}
      <text x="72" y="574" fill="${cream}" font-family="Bricolage Grotesque, Archivo, sans-serif" font-size="27" font-weight="500">mad<tspan fill="${dim}" font-weight="400">.builders</tspan></text>
    </svg>`;
  return renderCard(svg, published.projectUrlAtPublish);
}

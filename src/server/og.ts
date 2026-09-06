import sharp from 'sharp';
import globalCss from '../styles/global.css?raw';

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

const twoLines = (value: string) => {
  const clipped = value.trim().slice(0, 74);
  if (clipped.length <= 38) return [clipped, ''];
  const split = Math.max(clipped.lastIndexOf(' ', 38), 24);
  return [clipped.slice(0, split), clipped.slice(split).trim()];
};

export async function renderProfileOg(builder: {
  displayName: string;
  projectName: string;
  handle: string;
}) {
  const green = token('green');
  const cream = token('cream');
  const dim = token('logo-dim-on-green');
  const name = escapeXml(builder.displayName.slice(0, 36));
  const project = escapeXml(builder.projectName.slice(0, 72));
  const handle = escapeXml(builder.handle);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="${green}" />
      <path d="M72 80H1128M72 516H1128" stroke="${cream}" stroke-opacity="0.14" />
      <path d="M876 0V630" stroke="${cream}" stroke-opacity="0.14" />
      <text x="72" y="136" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="19" letter-spacing="3">PROOF OF WORK / @${handle}</text>
      <text x="72" y="282" fill="${cream}" font-family="Archivo, sans-serif" font-size="${textSize(builder.projectName.slice(0, 36), 76, 22)}" font-weight="600" letter-spacing="-3">${escapeXml(builder.projectName.slice(0, 36))}</text>
      <text x="72" y="406" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="18" letter-spacing="2">BUILT BY</text>
      <text x="72" y="456" fill="${cream}" font-family="Archivo, sans-serif" font-size="34" font-weight="500">${name}</text>
      <text x="72" y="574" fill="${cream}" font-family="Bricolage Grotesque, Archivo, sans-serif" font-size="27" font-weight="500">mad<tspan fill="${dim}" font-weight="400">.builders</tspan></text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
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
}) {
  const green = token('green');
  const cream = token('cream');
  const dim = token('logo-dim-on-green');
  const name = escapeXml(published.displayName.slice(0, 48));
  const [summaryFirst, summarySecond] = twoLines(published.summary);
  const handle = escapeXml(published.handle);
  const project = escapeXml(published.projectName.slice(0, 48));
  const proof = published.proofStatus === 'github_account_matched'
    ? 'GITHUB ACCOUNT MATCHED'
    : published.proofStatus === 'proof_linked'
      ? 'PROOF LINKED'
      : 'SELF-REPORTED';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="${green}" />
      <path d="M72 80H1128M72 516H1128" stroke="${cream}" stroke-opacity="0.14" />
      <path d="M876 0V630" stroke="${cream}" stroke-opacity="0.14" />
      <text x="72" y="136" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="19" letter-spacing="3">WEEK OF ${published.weekStartDate}${published.rank ? ` / #${published.rank}` : ''}</text>
      <text x="72" y="260" fill="${cream}" font-family="Archivo, sans-serif" font-size="50" font-weight="600" letter-spacing="-2">${escapeXml(summaryFirst)}</text>
      <text x="72" y="322" fill="${cream}" font-family="Archivo, sans-serif" font-size="50" font-weight="600" letter-spacing="-2">${escapeXml(summarySecond)}</text>
      <text x="72" y="430" fill="${cream}" font-family="Archivo, sans-serif" font-size="30" font-weight="500">${project}</text>
      <text x="72" y="468" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="16" letter-spacing="2">BUILT BY ${name}</text>
      <text x="72" y="504" fill="${dim}" font-family="IBM Plex Mono, monospace" font-size="14" letter-spacing="2">${proof} / ${published.streak} WEEK STREAK</text>
      <text x="72" y="574" fill="${cream}" font-family="Bricolage Grotesque, Archivo, sans-serif" font-size="27" font-weight="500">mad<tspan fill="${dim}" font-weight="400">.builders</tspan></text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

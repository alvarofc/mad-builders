import fs from 'fs/promises';

async function update() {
  let content = await fs.readFile('src/pages/index.astro', 'utf8');

  // Update fonts
  content = content.replace(
    /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Geist[^"]+" rel="stylesheet" \/>/,
    '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@500;600&display=swap" rel="stylesheet" />'
  );

  // Update logo font variable
  content = content.replace(
    /--font-logo: 'Geist Mono', monospace;/,
    "--font-logo: 'Bricolage Grotesque', sans-serif;"
  );

  // Update .nav-logo styling
  content = content.replace(
    /\.nav-logo \{[\s\S]*?\}/,
    `.nav-logo {
    font-family: var(--font-logo);
    font-weight: 700;
    font-size: 1.4rem;
    color: var(--color-text);
    text-decoration: none;
    letter-spacing: -0.04em;
    line-height: 0.9;
    font-variant: small-caps;
    text-transform: lowercase;
  }`
  );

  // Update .footer-logo styling
  content = content.replace(
    /\.footer-logo \{[\s\S]*?\}/,
    `.footer-logo {
    font-family: var(--font-logo);
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--color-text);
    letter-spacing: -0.04em;
    line-height: 0.9;
    font-variant: small-caps;
    text-transform: lowercase;
  }`
  );

  // Also apply it to the hero-headline to give it that brutalist solofounders feel (optional, but they asked for logo. Let's stick to logo first, but maybe see if solofounders style applies anywhere else. They explicitly said "mad logo")

  await fs.writeFile('src/pages/index.astro', content);
  console.log('Bricolage Grotesque applied.');
}

update().catch(console.error);

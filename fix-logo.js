import fs from 'fs/promises';

async function update() {
  let content = await fs.readFile('src/pages/index.astro', 'utf8');

  // Let's make sure the logo text in HTML is lowercase so font-variant: small-caps can work on it
  content = content.replace(
    /<a href="\/" class="nav-logo">MAD<span class="nav-logo-accent">BUILDERS<\/span><\/a>/g,
    '<a href="/" class="nav-logo">mad<span class="nav-logo-accent">builders</span></a>'
  );

  content = content.replace(
    /<span class="footer-logo">MAD<span class="nav-logo-accent">BUILDERS<\/span><\/span>/g,
    '<span class="footer-logo">mad<span class="nav-logo-accent">builders</span></span>'
  );

  // In the CSS
  content = content.replace(
    /\.nav-logo \{[\s\S]*?\}/,
    `.nav-logo {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-weight: 800;
    font-size: 1.6rem;
    color: var(--color-text);
    text-decoration: none;
    letter-spacing: -0.06em;
    line-height: 0.85;
    font-variant: small-caps;
  }`
  );

  content = content.replace(
    /\.footer-logo \{[\s\S]*?\}/,
    `.footer-logo {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-weight: 800;
    font-size: 1.4rem;
    color: var(--color-text);
    letter-spacing: -0.06em;
    line-height: 0.85;
    font-variant: small-caps;
  }`
  );

  await fs.writeFile('src/pages/index.astro', content);
  console.log('Fixed CSS and HTML for small caps.');
}

update().catch(console.error);

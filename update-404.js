import fs from 'fs/promises';

async function update() {
  let content = await fs.readFile('src/pages/404.astro', 'utf8');

  content = content.replace(
    /<Fragment slot="head">[\s\S]*?<\/Fragment>/,
    `<Fragment slot="head">
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
		<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@500;600&display=swap" rel="stylesheet" />
	</Fragment>`
  );

  content = content.replace(
    /<style>[\s\S]*?<\/style>/,
    `<style>
	.error-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: #FFFFFF;
		font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
	}

	.error-content {
		text-align: center;
		max-width: 480px;
	}

	.error-code {
		font-family: 'Geist Mono', monospace;
		font-size: clamp(6rem, 15vw, 12rem);
		font-weight: 500;
		color: #EAEAEA;
		line-height: 1;
		display: block;
		margin-bottom: 1rem;
		letter-spacing: -0.05em;
	}

	.error-headline {
		font-family: 'Geist', -apple-system, sans-serif;
		font-size: 1.75rem;
		font-weight: 500;
		color: #0A0A0A;
		margin: 0 0 1rem;
		letter-spacing: -0.02em;
	}

	.error-text {
		color: #555555;
		font-size: 1rem;
		line-height: 1.6;
		margin: 0 0 2rem;
	}

	.error-link {
		display: inline-block;
		font-family: 'Geist', sans-serif;
		font-size: 0.9rem;
		font-weight: 500;
		color: #FFFFFF;
		background: #0A0A0A;
		text-decoration: none;
		padding: 0.75rem 2rem;
		border-radius: 99px;
		transition: background 0.2s ease, transform 0.2s ease;
	}

	.error-link:hover {
		background: #333333;
		transform: translateY(-2px);
	}
</style>`
  );

  await fs.writeFile('src/pages/404.astro', content);
  console.log('404 updated successfully.');
}

update().catch(console.error);

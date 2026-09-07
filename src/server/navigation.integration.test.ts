import { expect, it } from 'vitest';

it.skipIf(!process.env.NAVIGATION_TEST_URL)('shows local demo projects and voting through the normal navbar URLs', async () => {
  for (const [path, content] of [['/leaderboard', 'Miga'], ['/vote', 'Choose A']]) {
    const response = await fetch(new URL(path, process.env.NAVIGATION_TEST_URL), { signal: AbortSignal.timeout(5000) });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Local demo');
    expect(html).toContain(content);
  }
  const build = await fetch(new URL('/build', process.env.NAVIGATION_TEST_URL));
  expect(build.status).toBe(200);
  const html = await build.text();
  expect(html).toContain('id="this-week"');
  expect(html).not.toContain('id="leaderboard-title"');
  expect(html).not.toContain('Local demo');
}, 20000);

it.skipIf(!process.env.NAVIGATION_TEST_URL)('loads app pages under concurrent navigation without blocking the connection', async () => {
  for (let round = 0; round < 3; round++) {
    await Promise.all(['/build?demo=0', '/leaderboard?demo=0', '/vote?demo=0', '/builders'].map(async (path) => {
      const response = await fetch(new URL(path, process.env.NAVIGATION_TEST_URL), {
        signal: AbortSignal.timeout(5000),
      });
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toContain('</html>');
    }));
  }
}, 20000);

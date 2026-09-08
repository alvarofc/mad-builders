import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { safeReturnPath } from './return-path';

const loginPage = readFileSync(new URL('../pages/login.astro', import.meta.url), 'utf8');

it.each(['/build', '/vote', '/build?ref=ana', '/build#this-week', '/builders/ana/weeks/2026-08-31'])(
  'keeps the same-origin destination %s',
  (path) => expect(safeReturnPath(path)).toBe(path),
);

it.each([
  null,
  undefined,
  '',
  'https://evil.test',
  '//evil.test',
  '/\\evil.test',
  '\\/evil.test',
  'build',
  'javascript:alert(1)',
  '/build\nSet-Cookie: a=b',
  '/build /vote',
])('falls back to /build for %j', (value) => expect(safeReturnPath(value)).toBe('/build'));

it('sends the login page through the same guard for its redirect and its GitHub callback', () => {
  expect(loginPage).toContain("const next = safeReturnPath(Astro.url.searchParams.get('next'));");
  expect(loginPage).toContain('if (Astro.locals.user) return Astro.redirect(next);');
  expect(loginPage).toContain('data-github-sign-in data-callback={next}');
});

it('offers a way out instead of a dead button when GitHub credentials are missing', () => {
  const [configured, unavailable] = loginPage.split('{authConfigured ? (')[1].split('</ProductLayout>')[0].split(') : (');
  expect(configured).toContain('data-github-sign-in');
  expect(unavailable).not.toContain('data-github-sign-in');
  expect(unavailable).toContain('href="/leaderboard"');
});

it('keeps the login page off the CDN so the signed-in redirect is never cached', () => {
  expect(loginPage).toContain('export const prerender = false;');
  expect(loginPage).toContain("Astro.response.headers.set('Cache-Control', 'no-store');");
  expect(loginPage).toContain('title="Log in - mad.builders"');
});

it('points every signed-out prompt at /login with a destination the guard accepts', () => {
  const links = ['../layouts/Layout.astro', '../layouts/ProductLayout.astro', '../pages/vote.astro', '../components/LeaderboardPanel.astro']
    .flatMap((file) => [...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/["'{](\/login[^"'\s}]*)/g)]
      .map((match) => match[1]));
  expect(links).toEqual(expect.arrayContaining(['/login', '/login?next=/vote']));
  for (const link of links) {
    const next = new URL(link, 'https://www.mad.builders').searchParams.get('next');
    if (next) expect(safeReturnPath(next)).toBe(next);
  }
});

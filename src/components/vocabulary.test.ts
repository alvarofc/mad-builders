import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// One weekly loop, one word per step. The brand guide bans "jargon when a plain
// word works", and the loop used to be described in a different dialect on every
// page: seven words for a peer vote, four for the goal, seven for the update.
// Settled on vote / goal / update / project.
const surfaces = [
  '../pages/build.astro',
  '../pages/vote.astro',
  '../pages/leaderboard.astro',
  '../pages/login.astro',
  '../pages/settings.astro',
  '../pages/builders/index.astro',
  '../pages/builders/[handle].astro',
  '../pages/builders/[handle]/weeks/[week].astro',
  './LeaderboardPanel.astro',
  '../server/email-templates.ts',
].map((file) => {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  // identifiers (DB tables, props, imports) live in the .astro frontmatter and
  // keep the schema's nouns; only the markup below it is user-facing copy.
  // email-templates.ts is all copy, so it is checked whole.
  return [file, file.endsWith('.astro') ? source.replace(/^---[\s\S]*?^---/m, '') : source] as const;
});

it.each(['comparison', 'startup', 'weekly ledger', 'build log'])(
  'retires "%s" from user-facing copy',
  (word) => {
    for (const [file, markup] of surfaces) expect(markup.toLowerCase(), file).not.toContain(word);
  },
);

it('uses one label per destination', () => {
  const all = surfaces.map(([, markup]) => markup).join('\n');
  for (const stale of ['meet the builders', 'discover projects', 'see all builders']) {
    expect(all).not.toContain(stale);
  }
  expect(all).toContain('meet the projects');
});

it('keeps every page pointing at the next step of the loop', () => {
  const byFile = Object.fromEntries(surfaces);
  // publishing redirects to the weekly update page, which must lead onward
  expect(byFile['../pages/builders/[handle]/weeks/[week].astro']).toContain('href="/leaderboard"');
  // the owner's own project page used to offer only /settings
  expect(byFile['../pages/builders/[handle].astro']).toContain('href="/build#this-week"');
  // the ineligible voter used to get no action at all
  expect(byFile['../pages/vote.astro']).toContain('href="/leaderboard">see the board');
  // the project list promised ranks but never linked to them
  expect(byFile['../pages/builders/index.astro']).toContain('href="/leaderboard"');
});

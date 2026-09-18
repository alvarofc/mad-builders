import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const panel = readFileSync(new URL('./LeaderboardPanel.astro', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/leaderboard.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/product.css', import.meta.url), 'utf8');
const banner = panel.split('{!hasProject && (')[1].split('</aside>')[0];

it('shows the join banner only to builders who have no project yet', () => {
  expect(panel).toContain('hasProject = false');
  expect(page).toContain('hasProject={Boolean(currentProfile)}');
  // Everything else on the panel stays visible either way: the board is public.
  expect(banner).toContain('class="leaderboard-join"');
  expect(banner).not.toContain('leaderboard-list');
});

it('sends signed-out visitors to /login and signed-in builders straight to /build', () => {
  expect(banner).toContain("href={signedIn ? '/build' : '/login'}");
  expect(banner).toContain('add your project');
});

it('keeps the rank explainer but moves it below the board', () => {
  expect(panel.indexOf('class="leaderboard-about"')).toBeGreaterThan(panel.indexOf('class="leaderboard-list"'));
  expect(panel).toContain('how the rank works');
  expect(panel).toContain('Eight votes unlock a rank.');
});

it.each([
  'leaderboard-join',
  'leaderboard-about',
  'leaderboard-live',
  'leaderboard-jump',
  'leaderboard-you',
  'login-shell',
  'login-steps',
  'login-step-list',
])('styles .%s so the new markup does not ship unstyled', (name) => expect(css).toContain(`.${name} {`));

it('surfaces the running week, which the board itself never shows', () => {
  // getLatestLeaderboard always prefers the latest *closed* week, so without this
  // a builder mid-voting-window only ever sees last week marked final.
  expect(page).toContain('getLiveWeek');
  expect(page).toContain('live={live}');
  const todo = panel.split('const todo =')[1].split('---')[0];
  expect(todo).toContain("href: '/vote'");
  expect(todo).toContain("href: '/build#this-week'");
  // only a builder who published can review, so signed-in alone must not offer it
  expect(todo).toContain('live.published');
  expect(todo).not.toContain('signedIn');
});

it('keeps the board itself near the top', () => {
  // the running-week prompt only renders when this viewer can act on it, so it
  // never stacks with the join banner, and no explainer sits above the ranks.
  const head = panel.split('<header class="leaderboard-head">')[1].split('leaderboard-columns')[0];
  expect(head).not.toContain('weekly peer rank');
  expect(head).not.toContain('leaderboard-key');
  expect(panel).toContain('{todo && (');
  // the score is defined in the column header rather than in a line of its own
  expect(panel).toContain('<span>peer win rate</span>');
  expect(panel).not.toContain('class="leaderboard-columns mono" aria-hidden');
});

it('shows the project description and links it to the project profile', () => {
  const description = panel.split('class="leaderboard-update"')[1].split('</a>')[0];
  expect(panel).toContain('<span>description</span>');
  expect(description).toContain('<span>{entry.projectSentence}</span>');
  expect(description).toContain('`/builders/${entry.handle}`');
  expect(description).not.toContain('entry.summary');
  expect(description).not.toContain('/weeks/');
});

it('keeps the project description visible on the mobile board', () => {
  const mobile = css.split('@media (max-width: 720px)')[1];
  expect(mobile).not.toMatch(/\.leaderboard-update\s*\{[^}]*display:\s*none/);
  expect(mobile).toContain('.leaderboard-update {');
});

it('gives every empty board a way out', () => {
  // these fire when a builder has already done the work, so none may be a dead end
  const blocks = panel.split('class="leaderboard-empty').length - 1;
  expect(blocks).toBeGreaterThan(0);
  expect(panel.split('leaderboard-empty-action').length - 1).toBe(blocks);
  expect(panel).not.toContain('Use Previous to return');
});

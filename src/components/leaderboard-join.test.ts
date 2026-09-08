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

it.each(['leaderboard-join', 'leaderboard-about', 'login-shell', 'login-steps', 'login-step-list'])(
  'styles .%s so the new markup does not ship unstyled',
  (name) => expect(css).toContain(`.${name} {`),
);

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isCalendarDate } from '../server/weeks';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const panel = read('./LeaderboardPanel.astro');
const frontmatter = panel.split('---')[1];
const ranking = read('../server/ranking.ts');
const home = read('../pages/index.astro');
const layout = read('../layouts/Layout.astro');
const brand = read('../pages/brand.astro');
const globalCss = read('../styles/global.css');
const productCss = read('../styles/product.css');
const weekPage = read('../pages/builders/[handle]/weeks/[week].astro');
const profilePage = read('../pages/builders/[handle].astro');

// run one `const name = ...;` statement from the real source against a fake scope,
// so the rules are checked as behaviour rather than as spelling. parameter type
// annotations are the only TypeScript these statements use, so strip those.
function evaluate<T>(code: string, name: string, scope: Record<string, unknown>): T {
  const source = code.split(`const ${name} = `)[1].split(/;\n/)[0].replace(/\((\w+): \w+\)/g, '($1)');
  return new Function(...Object.keys(scope), `return (${source});`)(...Object.values(scope)) as T;
}
const fromPanel = <T>(name: string, scope: Record<string, unknown>) => evaluate<T>(frontmatter, name, scope);

it('labels a week by its calendar day, adding the year only for other years', () => {
  const board = { now: new Date('2026-09-24T12:00:00Z') };
  const weekLabel = fromPanel<(date: string) => string>('weekLabel', { board });
  // ICU spells September "Sep" or "Sept" depending on the Node build
  expect(weekLabel('2026-09-21')).toMatch(/^21 Sept?$/);
  // formatted in UTC, so a Monday never slips back to Sunday in western time zones
  expect(weekLabel('2026-01-05')).toBe('5 Jan');
  expect(weekLabel('2025-12-29')).toBe('29 Dec 2025');
});

it('marks only ranks that more than one project holds as tied', () => {
  const ranksOf = (ranks: number[]) => {
    const board = { entries: ranks.map((rank) => ({ rank })) };
    const all = fromPanel<number[]>('ranks', { board });
    return [...fromPanel<Set<number>>('sharedRanks', { ranks: all })].sort();
  };
  expect(ranksOf([1, 2, 3])).toEqual([]);
  expect(ranksOf([1, 1, 3, 4, 4, 4])).toEqual([1, 4]);
  expect(fromPanel<number[]>('ranks', { board: null })).toEqual([]);
});

it('pages between final weeks and offers the latest board only from an archived week', () => {
  const nav = panel.split('class="leaderboard-weeks')[1].split('</nav>')[0];
  expect(panel).toContain('{board && (board.previousWeek || board.nextWeek || board.archived) && (');
  expect(nav).toContain('href={boardUrl(board.previousWeek)} rel="prev"');
  expect(nav).toContain('href={boardUrl(board.nextWeek)} rel="next"');
  expect(nav).toContain(': board.archived && <a href={boardUrl()}>latest week →</a>');
  // week links keep other params (demo=0 locally) but always open on page 1
  const boardUrl = frontmatter.split('const boardUrl')[1].split('\n};')[0];
  expect(boardUrl).toContain('url.search = Astro.url.search;');
  expect(boardUrl).toContain("url.searchParams.delete('page');");
  expect(boardUrl).toContain("if (date) url.searchParams.set('week', date);");
  expect(boardUrl).toContain("else url.searchParams.delete('week');");
  // the next link sits on the right even when there is no previous link
  expect(productCss).toMatch(/\.leaderboard-weeks a:not\(\[rel='prev'\]\)\s*\{[^}]*margin-left:\s*auto/);
});

it('keeps "back to the first page" on the archived week being browsed', () => {
  expect(frontmatter).toContain('const boardHref = boardUrl(board?.archived ? board.week.weekStartDate : undefined);');
  expect(panel).toContain('<a class="work-button" href={boardHref}>back to the first page</a>');
});

it('describes the week in plain words and dates early results', () => {
  const status = frontmatter.split('const status')[1].split('// week_start_date')[0];
  const labels = [...status.matchAll(/label: '([^']+)'/g)].map(([, label]) => label);
  expect(new Set(labels)).toEqual(new Set(['not scheduled yet', 'early results', 'updates only', 'final', 'opens soon', 'shipping now', 'voting open']));
  for (const retired of ['provisional', 'unranked', 'not scheduled']) expect(labels).not.toContain(retired);
  expect(status).toContain("detail: `final ${madridDate(board.week.votingClosesAt)}`");
  expect(panel).toContain('{status.detail && <span>{status.detail}</span>}');
});

it('shows ties in the record only when there were any', () => {
  const score = panel.split('class="leaderboard-score"')[1].split('</li>')[0];
  expect(score).toContain('{entry.ties > 0 && ` · ${entry.ties} tied`}');
  // the record line is dropped on mobile, but the rate and vote count stay
  const mobile = productCss.split('@media (max-width: 720px)').slice(1).join('');
  expect(mobile).toMatch(/\.leaderboard-record\s*\{[^}]*display:\s*none/);
});

it('leads a small running week with how many projects shipped', () => {
  expect(ranking).toContain('hasRanks: false, publishedCount: candidates.length }');
  const live = panel.split(') : liveUnranked ? (')[1].split(') : board.week.rankingStatus')[0];
  expect(live).toContain("'publishedCount' in board && board.publishedCount > 0");
  // counts on-time updates only, and the header already names the week
  expect(live).toContain("board.publishedCount === 1 ? 'project' : 'projects'} shipped on time.");
  // no count, or a count of zero, still reads as an outcome rather than a shortfall
  expect(live).toContain("'Shipped, not ranked.'");
  expect(live).not.toContain('Not enough');
});

it('accepts only real calendar dates for ?week=, so a bad link falls back instead of erroring', () => {
  expect(isCalendarDate('2026-09-21')).toBe(true);
  expect(isCalendarDate('2024-02-29')).toBe(true);
  // postgres refuses these as dates, which would turn a typo into a 500
  for (const bad of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '0000-01-03', '2026-9-21', '2026-09-21T00:00:00Z', "2026-09-21' or 1=1", '', null]) {
    expect(isCalendarDate(bad), String(bad)).toBe(false);
  }
  // the leaderboard guards ?week= with the same check the build and update pages use
  expect(ranking).toContain('isCalendarDate(requestedWeek)');
});

it('only serves closed, final weeks from ?week=', () => {
  expect(ranking).toContain("const publicFinalWeek = (now: Date) => and(lte(week.votingClosesAt, now), eq(week.rankingStatus, 'final'));");
  const lookup = ranking.split('const [requested] =')[1].split("if (archivedWeek?.rankingStatus === 'final')")[0];
  expect(lookup).toContain('and(eq(week.weekStartDate, requestedWeek), lte(week.votingClosesAt, now))');
  // a closed week is finalized on demand, so history never depends on unrelated traffic
  expect(lookup).toContain('requested && !requested.finalizedAt ? await ensureWeekFinalized(requested.id) : requested');
  // an earlier week skips the live provisional board entirely
  const archived = ranking.split("if (archivedWeek?.rankingStatus === 'final')")[1].split('const provisional =')[0];
  expect(archived).toContain('votingAvailable: false, votingComplete: false');
  expect(archived).not.toContain('getProvisionalLeaderboard');
  const adjacent = ranking.split('async function adjacentRankedWeeks')[1].split('\n}\n')[0];
  expect(adjacent.match(/publicFinalWeek\(now\)/g)).toHaveLength(2);
});

it('redirects a ?week= it cannot show, so the URL always names the week on screen', () => {
  const page = read('../pages/leaderboard.astro');
  expect(page).toContain("if (Astro.url.searchParams.has('week') && !board?.archived) {");
  expect(page).toContain("latest.searchParams.delete('week');");
  expect(page).toContain('Astro.redirect(`${latest.pathname}${latest.search}`, 302)');
});

it('keeps an earlier week free of running-week prompts and dead ends', () => {
  // "your turn" and "recently published" describe the running week, not the one on screen
  expect(frontmatter).toContain('const todo = board?.archived ? null :');
  expect(frontmatter).toMatch(/const recent = [^\n]*!board\?\.archived/);
  // an old week whose ranked projects were all taken down must not ask people to vote on it
  expect(panel).toContain("board.archived ? 'No public results for this week.'");
  expect(panel).toContain('<a class="work-button" href={boardUrl()}>latest week</a>');
});

it('keeps the /brand cream inks in sync with the real tokens', () => {
  const root = globalCss.split(':root {')[1].split('}')[0];
  const token = (name: string) => root.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].replace(/\s+/g, '');
  const swatches = [...brand.split('const creamInks = [')[1].split('];')[0].matchAll(/name: '([^']+)', hex: '([^']+)'/g)];
  expect(swatches.map(([, name]) => name)).toEqual(['--green', '--green-dim', '--green-faint', '--green-line']);
  for (const [, name, hex] of swatches) expect(hex, name).toBe(token(name));
});

it('introduces the weekly leaderboard on the homepage and names it consistently', () => {
  const weekly = home.split('<section class="weekly" id="weekly"')[1].split('</section>')[0];
  expect(home).toContain('<a href="#weekly">weekly</a>');
  expect(weekly).toContain('Proof of work, weekly');
  expect(weekly).toContain('href="/leaderboard">see the leaderboard →</a>');
  expect(weekly.match(/<li>/g)).toHaveLength(3);
  expect(layout).toContain('<a href="/leaderboard" class="cta">leaderboard →</a>');
  expect(layout).not.toContain('rankings');
});

it('links a ranked update to the leaderboard for its own week', () => {
  expect(weekPage).toContain('href={`/leaderboard?week=${published.weekStartDate}`}>ranked #{published.rank}</a>');
  expect(profilePage).toContain('<strong class="result-rank">#{published.rank}</strong>');
  expect(productCss).toContain('.result-rank {');
});

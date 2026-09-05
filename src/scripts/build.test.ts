import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

// Execute the page's real submit handler without adding a browser dependency.
const page = readFileSync(new URL('../pages/build.astro', import.meta.url), 'utf8');
const script = stripTypeScriptTypes(page.split('<script>')[1].split('</script>')[0]
  .replace(/^\s*import .*;$/gm, ''));

it('provides an independent next-goal form after publication, gated by its own deadline', () => {
  const published = page.split('buildState?.currentResult && !editing ? (')[1].split(') : buildState?.currentCommitment')[0];
  expect(published).toContain('buildState.canSetNextPromise && buildState.nextWeek && (');
  const editor = published.split('data-next-commitment-editor>')[1].split('</details>')[0];
  expect(editor).toContain('action="/api/commitment" data-api-form');
  expect(editor).toContain('name="weekId" value={buildState.nextWeek.id}');
  expect(editor).toContain('name="promise"');
  expect(editor).not.toContain('/api/result/publish');
});

it('keeps small product text above 4.5:1 contrast on cream', () => {
  const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');
  const token = (name: string): string => {
    const value = css.match(new RegExp(`--${name}:\\s*([^;]+);`))![1];
    return value.startsWith('var(') ? token(value.slice(6, -1)) : value;
  };
  const background = token('cream').slice(1).match(/../g)!.map((part) => parseInt(part, 16));
  const [r, g, b, alpha] = token('green-faint').match(/[\d.]+/g)!.map(Number);
  const foreground = [r, g, b].map((value, i) => value * alpha + background[i] * (1 - alpha));
  const luminance = (color: number[]) => color.map((value) => value / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  expect((luminance(background) + 0.05) / (luminance(foreground) + 0.05)).toBeGreaterThanOrEqual(4.5);
});

it('lets builders retry sign-in after returned HTTP errors or network failures', async () => {
  for (const failure of ['returned', 'thrown', 'none']) {
    let click!: () => Promise<void>;
    const button = { disabled: false, dataset: {}, addEventListener: (_: string, listener: typeof click) => { click = listener; } };
    const status = { textContent: '' };
    runInNewContext(script, {
      document: { querySelector: (selector: string) => selector === '[data-github-sign-in]' ? button : status, querySelectorAll: () => [] },
      createAuthClient: () => ({ signIn: { social: async () => {
        if (failure === 'thrown') throw new Error('offline');
        return { error: failure === 'returned' ? { status: 429 } : null };
      } } }),
    });
    await click();
    expect(button.disabled).toBe(failure === 'none');
    expect(status.textContent).toBe(failure === 'none' ? 'Opening GitHub...' : 'GitHub sign-in failed. Try again.');
  }
});

it('hides only the update being edited from recently published', async () => {
  const panel = readFileSync(new URL('../components/LeaderboardPanel.astro', import.meta.url), 'utf8');
  const setup = stripTypeScriptTypes(panel.split('---')[1].replace(/^\s*import .*;$/gm, ''));
  for (const [excludeResultId, expected] of [[undefined, [1, 2]], [1, [2]]] as const) {
    const recent = await runInNewContext(`(async () => { ${setup}; return recent; })()`, {
      Astro: { props: { board: null, excludeResultId } },
      listRecentUpdates: async () => [{ id: 1 }, { id: 2 }],
    });
    expect(Array.from(recent, (entry: { id: number }) => entry.id)).toEqual(expected);
  }
});

it.each([
  ['https://mad.builders/builders/ana/weeks/2026-08-31', false],
  ['https://mad.builders/settings', false],
  ['https://mad.builders/build', true],
  ['https://mad.builders/build/?ref=ana', true],
])('handles publication redirect %s without losing an expired-session draft', async (url, expired) => {
  const listeners: Record<string, Function> = {};
  const message = { textContent: '' };
  const button = { disabled: false };
  const form = {
    dataset: { draftKey: 'weekly:ana:1' }, action: '/api/result/publish',
    querySelectorAll: () => [],
    querySelector: (selector: string) => selector.startsWith('button') ? button : message,
    addEventListener: (name: string, callback: Function) => { listeners[name] = callback; },
  };
  const removeItem = vi.fn();
  const assign = vi.fn();
  runInNewContext(script, {
    document: { querySelector: () => null, querySelectorAll: () => [form] },
    localStorage: { getItem: () => '{}', removeItem },
    window: { location: { origin: 'https://mad.builders', assign } },
    fetch: async () => ({ ok: true, url }),
    FormData: class {}, URL, track: vi.fn(),
  });
  await listeners.submit({ preventDefault() {} });
  expect(button.disabled).toBe(false);
  if (expired) {
    expect(message.textContent).toContain('session expired');
    expect(removeItem).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  } else {
    expect(removeItem).toHaveBeenCalledWith('weekly:ana:1');
    expect(assign).toHaveBeenCalledWith(url);
  }
});

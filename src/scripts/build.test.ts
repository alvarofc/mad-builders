import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

// Execute the page's real submit handler without adding a browser dependency.
const page = readFileSync(new URL('../pages/build.astro', import.meta.url), 'utf8');
const submitScript = stripTypeScriptTypes(readFileSync(new URL('./submit-api-form.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export async function', 'async function'));
const signInScript = stripTypeScriptTypes(readFileSync(new URL('./github-sign-in.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export function', 'function'));
const script = submitScript + '\n' + signInScript + '\n' + stripTypeScriptTypes(page.split('<script>')[1].split('</script>')[0]
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

it.each([
  ['https://mad.builders/builders/ana/weeks/2026-08-31', false],
  ['https://mad.builders/settings', false],
  ['https://mad.builders/build', true],
  ['https://mad.builders/build/?ref=ana', true],
])('handles publication redirect %s without losing an expired-session draft', async (url, expired) => {
  const message = { textContent: '' };
  const button = { disabled: false };
  const form = {
    action: '/api/result/publish',
    querySelector: (selector: string) => selector.startsWith('button') ? button : message,
  };
  const removeItem = vi.fn();
  const assign = vi.fn();
  await runInNewContext(submitScript + '\nsubmitApiForm(form, \'weekly:ana:1\')', {
    form, localStorage: { removeItem }, window: { location: { origin: 'https://mad.builders', assign } },
    fetch: async () => ({ ok: true, url }), FormData: class {}, URL, track: vi.fn(),
  });
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

it.each(['http', 'network'])('preserves the draft and allows retry after a %s publication failure', async (failure) => {
  const message = { textContent: '' };
  const button = { disabled: false };
  const form = {
    action: '/api/result/publish',
    querySelector: (selector: string) => selector.startsWith('button') ? button : message,
  };
  const removeItem = vi.fn();
  const assign = vi.fn();
  await runInNewContext(submitScript + '\nsubmitApiForm(form, "weekly:ana:1")', {
    form, localStorage: { removeItem }, window: { location: { origin: 'https://mad.builders', assign } },
    fetch: async () => {
      if (failure === 'network') throw new Error('offline');
      return { ok: false, text: async () => 'Voting has opened.' };
    },
    FormData: class {}, URL, track: vi.fn(),
  });
  expect(button.disabled).toBe(false);
  expect(message.textContent).toBe(failure === 'network' ? 'Could not save. Try again.' : 'Voting has opened.');
  expect(removeItem).not.toHaveBeenCalled();
  expect(assign).not.toHaveBeenCalled();
});

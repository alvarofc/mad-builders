import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

// The shared handler behind the GitHub button on /login and step 01 of /build.
const script = `${stripTypeScriptTypes(readFileSync(new URL('./github-sign-in.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export function', 'function'))}\nattachGithubSignIn()`;

const attach = (button: unknown, status: unknown, social: unknown) => runInNewContext(script, {
  document: { querySelector: (selector: string) => (selector === '[data-github-sign-in]' ? button : status) },
  createAuthClient: () => ({ signIn: { social } }),
});

it('leaves pages without a GitHub button alone', () => {
  expect(() => attach(null, null, async () => ({ error: null }))).not.toThrow();
});

it('re-enables the button after a failure even when the page has no status line', async () => {
  let click!: () => Promise<void>;
  const button = { disabled: false, dataset: {}, addEventListener: (_: string, listener: typeof click) => { click = listener; } };
  attach(button, null, async () => { throw new Error('offline'); });
  await expect(click()).resolves.toBeUndefined();
  expect(button.disabled).toBe(false);
});

it.each([
  [{ callback: '/vote' }, '/vote'],
  [{ callback: '/build?invite=abc' }, '/build?invite=abc'],
  [{}, '/build'],
])('carries the destination %j on the button through to GitHub', async (dataset, callbackURL) => {
  let click!: () => Promise<void>;
  const social = vi.fn(async () => ({ error: null }));
  const button = { disabled: false, dataset, addEventListener: (_: string, listener: typeof click) => { click = listener; } };
  const status = { textContent: '' };
  attach(button, status, social);
  await click();
  expect(social).toHaveBeenCalledWith({ provider: 'github', callbackURL });
  expect(button.disabled).toBe(true);
  expect(status.textContent).toBe('Opening GitHub...');
});

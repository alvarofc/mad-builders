// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import SocialAccounts from './SocialAccounts';

it('detects accounts, prevents duplicate overwrites and submits removals with both scopes', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
  vi.stubGlobal('fetch', fetch);
  const click = async (label: string) => {
    const button = [...container.querySelectorAll('button')].find(el => el.getAttribute('aria-label') === label || el.textContent === label)!;
    expect(button).toBeTruthy(); await act(async () => button.click());
  };
  const type = async (value: string) => {
    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(<SocialAccounts projectId="p1" personal={{}} company={{github:'https://github.com/project'}} available={{linkedin:false,x:true}} saved={false} />));
    await click('+ Add account to your accounts');
    expect(container.querySelector('input[type="text"]')?.getAttribute('placeholder')).toBe('Paste your profile URL');
    for (const [url, platform] of [['linkedin.com/in/builder', 'linkedin'], ['github.com/builder', 'github'], ['instagram.com/builder', 'instagram'], ['example.com', 'website'], ['twitter.com/Builder', 'x']]) {
      await type(url);
      expect(container.querySelector('.social-url-logo svg')?.getAttribute('data-social-logo')).toBe(platform);
    }
    await type('');
    expect(container.querySelector('.social-url-logo')).toBeNull();
    await type('twitter.com/Builder'); await click('Add account');
    expect(container.querySelector('.social-account [data-social-logo="x"]')).not.toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].body.get('personal.x')).toBe('https://x.com/builder');
    expect(fetch.mock.calls[0][1].body.has('company.github')).toBe(false);
    expect(container.textContent).toContain('All changes saved.');
    expect(container.textContent).not.toContain('Save social links');
    expect(new FormData(container.querySelector('form')!).get('personal.x')).toBe('https://x.com/builder');
    await click('+ Add account to your accounts');
    await type('x.com/another'); await click('Add account');
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('already listed');
    await click('Cancel');
    fetch.mockResolvedValueOnce({ ok: false, text: async () => 'Try again in a minute.' });
    await click('Remove personal X');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Try again in a minute.');
    await click('Retry save');
    expect(fetch.mock.calls.at(-1)![1].body.get('personal.x')).toBe('');
    expect(container.textContent).toContain('All changes saved.');
    const data = new FormData(container.querySelector('form')!);
    expect(data.get('personal.x')).toBe('');
    expect(data.get('company.github')).toBe('https://github.com/project');
    expect(data.get('projectId')).toBe('p1');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});

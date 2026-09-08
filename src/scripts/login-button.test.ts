import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const layout = readFileSync(new URL('../layouts/Layout.astro', import.meta.url), 'utf8');
const script = layout.split('<script is:inline>')[1].split('</script>')[0];

it('hides login for a session, restores it after logout and keeps it available on failure', async () => {
  for (const result of [{ user: { id: 'builder' } }, null, 'http-error', 'offline']) {
    expect(layout).toContain('class="login-button" hidden');
    expect(layout).toContain('<noscript><a href="/login" class="login-button">log in</a></noscript>');
    const button = { hidden: true };
    const fetch = vi.fn(async () => {
      if (result === 'offline') throw new Error('Offline');
      return { ok: result !== 'http-error', json: async () => result };
    });
    let pageshow!: (event: { persisted: boolean }) => void;
    runInNewContext(script, {
      document: { querySelector: () => button },
      window: { addEventListener: (_: string, handler: typeof pageshow) => { pageshow = handler; } },
      fetch,
    });
    expect(button.hidden).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.hidden).toBe(typeof result === 'object' && result !== null);
    button.hidden = true;
    pageshow({ persisted: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.hidden).toBe(typeof result === 'object' && result !== null);
    fetch.mockResolvedValue({ ok: true, json: async () => null });
    pageshow({ persisted: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.hidden).toBe(false);
  }
});

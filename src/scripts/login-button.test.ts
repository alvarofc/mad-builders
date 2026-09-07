import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const layout = readFileSync(new URL('../layouts/Layout.astro', import.meta.url), 'utf8');
const script = stripTypeScriptTypes(layout.split('<script>')[1].split('</script>')[0]);

it('hides login for a session, restores it after logout and keeps it available on failure', async () => {
  for (const result of [{ user: { id: 'builder' } }, null, 'http-error', 'offline']) {
    const button = { hidden: false, style: { visibility: '' } };
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
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.hidden).toBe(typeof result === 'object' && result !== null);
    expect(button.style.visibility).toBe('');
    fetch.mockResolvedValue({ ok: true, json: async () => null });
    pageshow({ persisted: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.hidden).toBe(false);
  }
});

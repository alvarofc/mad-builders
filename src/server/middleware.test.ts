import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const source = stripTypeScriptTypes(readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export const', 'const').replaceAll('import.meta.env.DEV', 'false'));

it('loads the same session for app routes with or without trailing slashes', async () => {
  for (const path of ['/build', '/vote', '/leaderboard', '/settings', '/api/review', '/api/commitment']) {
    for (const suffix of ['', '/']) {
      const session = { user: { id: 'builder' }, session: { id: 'session' } };
      const getSession = vi.fn().mockResolvedValue(session);
      const handler = runInNewContext(`${source}; onRequest`, {
        defineMiddleware: (callback: unknown) => callback,
        authConfigured: true, databaseConfigured: false, auth: { api: { getSession } },
      });
      const context = { url: new URL(`https://www.mad.builders${path}${suffix}`), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
      const next = vi.fn().mockResolvedValue('rendered');
      expect(await handler(context, next)).toBe('rendered');
      expect(context.locals).toEqual(session);
      expect(getSession).toHaveBeenCalledOnce();
    }
  }
});

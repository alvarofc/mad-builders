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
      const getSession = vi.fn().mockResolvedValue({ response: session, headers: new Headers() });
      const handler = runInNewContext(`${source}; onRequest`, {
        defineMiddleware: (callback: unknown) => callback,
        authConfigured: true, databaseConfigured: false, auth: { api: { getSession } },
      });
      const context = { url: new URL(`https://www.mad.builders${path}${suffix}`), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
      const response = new Response('rendered');
      const next = vi.fn().mockResolvedValue(response);
      expect(await handler(context, next)).toBe(response);
      expect(context.locals).toEqual(session);
      expect(getSession).toHaveBeenCalledOnce();
    }
  }
});

it('forwards renewal and deletion cookies without losing page or redirect responses', async () => {
  for (const session of [{ user: { id: 'builder' }, session: { id: 'session' } }, null]) {
    for (const redirect of [false, true]) {
      const cookies = session
        ? ['session=renewed; Path=/; HttpOnly; Secure; SameSite=Lax', 'cache=renewed; Path=/; HttpOnly']
        : ['session=; Path=/; Max-Age=0; HttpOnly'];
      const headers = new Headers();
      for (const cookie of cookies) headers.append('set-cookie', cookie);
      const getSession = vi.fn().mockResolvedValue({ response: session, headers });
      const handler = runInNewContext(`${source}; onRequest`, {
        defineMiddleware: (callback: unknown) => callback,
        authConfigured: true, databaseConfigured: false, auth: { api: { getSession } }, Response,
      });
      const context = { url: new URL('https://www.mad.builders/build'), request: new Request('https://www.mad.builders/build'), locals: { user: null, session: null } };
      const downstream = redirect ? Response.redirect('https://www.mad.builders/settings', 303)
        : new Response('rendered', { headers: { 'set-cookie': 'existing=keep; Path=/', 'cache-control': 'no-store' } });
      const response = await handler(context, async () => downstream);
      expect(getSession).toHaveBeenCalledWith({ headers: context.request.headers, returnHeaders: true });
      expect(context.locals).toEqual(session ?? { user: null, session: null });
      expect(response.status).toBe(redirect ? 303 : 200);
      expect(response.headers.getSetCookie()).toEqual(redirect ? cookies : ['existing=keep; Path=/', ...cookies]);
      if (redirect) expect(response.headers.get('location')).toBe('https://www.mad.builders/settings');
      else {
        expect(await response.text()).toBe('rendered');
        expect(response.headers.get('cache-control')).toBe('no-store');
      }
    }
  }
});

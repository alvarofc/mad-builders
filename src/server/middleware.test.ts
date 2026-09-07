import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { requestTiming } from './timing';

const source = stripTypeScriptTypes(readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export const', 'const').replaceAll('import.meta.env.DEV', 'false')
  .replace("import('./server/auth')", 'Promise.resolve({ auth: globalThis.auth, authConfigured: globalThis.authConfigured })')
  .replace("import('./server/db')", 'Promise.resolve({ databaseConfigured: globalThis.databaseConfigured })')
  .replace("import('./server/weeks')", 'Promise.resolve({ ensureWeeklySchedule: globalThis.ensureWeeklySchedule })'));

it('keeps concurrent request timings separate and marks subsequent requests warm', async () => {
  const handler = runInNewContext(`${source}; onRequest`, {
    defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
    authConfigured: false, databaseConfigured: true, ensureWeeklySchedule: async () => {},
  });
  const responses = await Promise.all(['projects', 'leaderboard'].map(async (name) => {
    const context = { url: new URL('https://mad.builders/builders'), locals: {} as App.Locals };
    return handler(context, () => context.locals.timing.measure(name, async () => new Response(name)));
  }));
  const first = responses[0].headers.get('server-timing');
  const second = responses[1].headers.get('server-timing');
  expect(first).toContain('dependency_load;dur=');
  expect(second).toContain('dependency_load;dur=');
  expect(first).toContain('schedule;dur=');
  expect(first).toContain('projects;dur=');
  expect(first).not.toContain('leaderboard;dur=');
  expect(first).toContain('instance;desc="first-request"');
  expect(second).toContain('leaderboard;dur=');
  expect(second).not.toContain('projects;dur=');
  expect(second).toContain('instance;desc="warm"');
});

it('loads the same session for app routes with or without trailing slashes', async () => {
  for (const path of ['/build', '/vote', '/leaderboard', '/settings', '/api/review', '/api/commitment']) {
    for (const suffix of ['', '/']) {
      const session = { user: { id: 'builder' }, session: { id: 'session' } };
      const getSession = vi.fn().mockResolvedValue({ response: session, headers: new Headers() });
      const handler = runInNewContext(`${source}; onRequest`, {
        defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
        authConfigured: true, databaseConfigured: false, auth: { api: { getSession } },
      });
      const context = { url: new URL(`https://www.mad.builders${path}${suffix}`), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
      const response = new Response('rendered');
      const next = vi.fn().mockResolvedValue(response);
      const rendered = await handler(context, next);
      expect(await rendered.text()).toBe('rendered');
      expect(rendered.headers.get('server-timing')).toMatch(/session;dur=[\d.]+, page_ready;dur=[\d.]+, server_ready;dur=[\d.]+, instance;desc="first-request"/);
      expect(context.locals).toMatchObject(session);
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
        defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
        authConfigured: true, databaseConfigured: false, auth: { api: { getSession } },
      });
      const context = { url: new URL('https://www.mad.builders/build'), request: new Request('https://www.mad.builders/build'), locals: { user: null, session: null } };
      const downstream = redirect ? Response.redirect('https://www.mad.builders/settings', 303)
        : new Response('rendered', { headers: { 'set-cookie': 'existing=keep; Path=/', 'cache-control': 'no-store' } });
      const response = await handler(context, async () => downstream);
      expect(getSession).toHaveBeenCalledWith({ headers: context.request.headers, returnHeaders: true });
      expect(context.locals).toMatchObject(session ?? { user: null, session: null });
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

import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { requestTiming } from './timing';

const compile = (dev: 'true' | 'false') => stripTypeScriptTypes(readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export const', 'const').replaceAll('import.meta.env.DEV', dev)
  .replaceAll("import('./server/auth')", 'Promise.resolve({ auth: globalThis.auth, authConfigured: globalThis.authConfigured })')
  .replaceAll("import('./server/db')", 'Promise.resolve({ databaseConfigured: globalThis.databaseConfigured })')
  .replaceAll("import('./server/weeks')", 'Promise.resolve({ ensureWeeklySchedule: globalThis.ensureWeeklySchedule })'));

const source = compile('false');
const devSource = compile('true');

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

it.each([
  ['a signed-in builder', { user: { id: 'builder' }, session: { id: 'session' } }],
  ['a signed-out visitor', null],
])('reads the session for dev demo pages so %s renders the right prompts', async (_label, session) => {
  for (const path of ['/leaderboard', '/vote']) {
    const getSession = vi.fn().mockResolvedValue(session);
    const handler = runInNewContext(`${devSource}; onRequest`, {
      defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
      authConfigured: true, databaseConfigured: false, auth: { api: { getSession } },
    });
    const context = { url: new URL(`https://www.mad.builders${path}`), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
    const response = await handler(context, async () => new Response('demo'));
    expect(await response.text()).toBe('demo');
    expect(getSession).toHaveBeenCalledOnce();
    expect(context.locals).toMatchObject({ user: session?.user ?? null, session: session?.session ?? null });
  }
});

it('still serves dev demo pages when auth cannot load, and skips the session on ?demo=0', async () => {
  const failing = vi.fn().mockRejectedValue(new Error('no database'));
  const offline = runInNewContext(`${devSource}; onRequest`, {
    defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
    authConfigured: true, databaseConfigured: false, auth: { api: { getSession: failing } },
  });
  const demoContext = { url: new URL('https://www.mad.builders/leaderboard'), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
  expect(await (await offline(demoContext, async () => new Response('demo'))).text()).toBe('demo');
  expect(demoContext.locals).toMatchObject({ user: null, session: null });

  // ?demo=0 asks for real data, so it must fall through to the full session path.
  const getSession = vi.fn().mockResolvedValue({ response: { user: { id: 'builder' }, session: { id: 'session' } }, headers: new Headers() });
  const real = runInNewContext(`${devSource}; onRequest`, {
    defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
    authConfigured: true, databaseConfigured: false, auth: { api: { getSession } },
  });
  const realContext = { url: new URL('https://www.mad.builders/leaderboard?demo=0'), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
  await real(realContext, async () => new Response('real'));
  expect(getSession).toHaveBeenCalledWith({ headers: realContext.request.headers, returnHeaders: true });
  expect(realContext.locals).toMatchObject({ user: { id: 'builder' } });
});

it('skips the demo session read entirely when auth has no credentials', async () => {
  const getSession = vi.fn();
  const handler = runInNewContext(`${devSource}; onRequest`, {
    defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
    authConfigured: false, databaseConfigured: false, auth: { api: { getSession } },
  });
  const context = { url: new URL('https://www.mad.builders/leaderboard'), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
  expect(await (await handler(context, async () => new Response('demo'))).text()).toBe('demo');
  expect(getSession).not.toHaveBeenCalled();
  expect(context.locals).toMatchObject({ user: null, session: null });
});

it('loads the session for /login so a signed-in builder is redirected instead of asked to sign in again', async () => {
  const user = { id: 'builder' };
  const getSession = vi.fn().mockResolvedValue({ response: { user, session: { id: 'session' } }, headers: new Headers() });
  const handler = runInNewContext(`${source}; onRequest`, {
    defineMiddleware: (callback: unknown) => callback, requestTiming, Headers, Response,
    authConfigured: true, databaseConfigured: false, auth: { api: { getSession } },
  });
  for (const path of ['/login', '/login/', '/login?next=%2Fvote']) {
    const context = { url: new URL(`https://www.mad.builders${path}`), request: new Request('https://www.mad.builders'), locals: { user: null, session: null } };
    const response = await handler(context, async () => new Response(null, { status: 302, headers: { location: '/vote' } }));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/vote');
    expect(context.locals).toMatchObject({ user });
  }
  expect(getSession).toHaveBeenCalledTimes(3);
});

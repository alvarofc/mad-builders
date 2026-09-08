import { requestTiming } from './server/timing';
import { defineMiddleware } from 'astro:middleware';

let firstRequest = true;

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;
  const timing = context.locals.timing = requestTiming();

  const path = context.url.pathname.replace(/\/+$/, '') || '/';
  // The dev demo pages render fixtures without a database, but still read the
  // session when one is available. Without this a signed-in builder looks like
  // a stranger locally, so signed-out prompts show up for people who are in.
  if (import.meta.env.DEV && context.url.searchParams.get('demo') !== '0' && ['/vote', '/leaderboard'].includes(path)) {
    try {
      const { auth, authConfigured } = await import('./server/auth');
      if (authConfigured) {
        const session = await auth.api.getSession({ headers: context.request.headers });
        context.locals.user = session?.user ?? null;
        context.locals.session = session?.session ?? null;
      }
    } catch {
      // No credentials or no database in this checkout. Browse signed out.
    }
    return next();
  }
  const needsSession =
    path === '/build' ||
    path === '/login' ||
    path === '/vote' ||
    path === '/leaderboard' ||
    path === '/settings' ||
    path.startsWith('/builders') ||
    path.startsWith('/api/profile') ||
    path === '/api/moderation' ||
    path === '/api/commitment' ||
    path === '/api/project' ||
    path.startsWith('/api/result/') ||
    path === '/api/review';

  if (!needsSession) return next();
  const first = firstRequest;
  firstRequest = false;
  let headers = new Headers();
  const response = await timing.measure('server_ready', async () => {
    const [{ auth, authConfigured }, { databaseConfigured }, { ensureWeeklySchedule }] =
      await timing.measure('dependency_load', () => Promise.all([
        import('./server/auth'), import('./server/db'), import('./server/weeks'),
      ]));
    if (databaseConfigured) await timing.measure('schedule', ensureWeeklySchedule);
    if (authConfigured) {
      const { response: session, headers: sessionHeaders } = await timing.measure('session', () => auth.api.getSession({
        headers: context.request.headers,
        returnHeaders: true,
      }));
      headers = sessionHeaders;
      context.locals.user = session?.user ?? null;
      context.locals.session = session?.session ?? null;
    }

    return timing.measure('page_ready', next);
  });
  const cookies = headers.getSetCookie();
  // Redirect responses can have immutable headers; preserve their status and body.
  const refreshed = new Response(response.body, response);
  for (const cookie of cookies) refreshed.headers.append('set-cookie', cookie);
  refreshed.headers.append('Server-Timing', `${timing.header()}, instance;desc="${first ? 'first-request' : 'warm'}"`);
  return refreshed;
});

import { defineMiddleware } from 'astro:middleware';
import { auth, authConfigured } from './server/auth';
import { databaseConfigured } from './server/db';
import { ensureWeeklySchedule } from './server/weeks';

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  const path = context.url.pathname.replace(/\/+$/, '') || '/';
  if (import.meta.env.DEV && context.url.searchParams.get('demo') !== '0' && ['/vote', '/leaderboard'].includes(path)) return next();
  const needsSession =
    path === '/build' ||
    path === '/vote' ||
    path === '/leaderboard' ||
    path === '/settings' ||
    path.startsWith('/builders') ||
    path.startsWith('/api/profile') ||
    path === '/api/moderation' ||
    path === '/api/commitment' ||
    path.startsWith('/api/result/') ||
    path === '/api/review';

  if (!needsSession) return next();
  if (databaseConfigured) await ensureWeeklySchedule();
  if (!authConfigured) return next();

  const { response: session, headers } = await auth.api.getSession({
    headers: context.request.headers,
    returnHeaders: true,
  });
  context.locals.user = session?.user ?? null;
  context.locals.session = session?.session ?? null;

  const response = await next();
  const cookies = headers.getSetCookie();
  if (!cookies.length) return response;
  // Redirect responses can have immutable headers; preserve their status and body.
  const refreshed = new Response(response.body, response);
  for (const cookie of cookies) refreshed.headers.append('set-cookie', cookie);
  return refreshed;
});

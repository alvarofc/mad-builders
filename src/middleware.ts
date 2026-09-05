import { defineMiddleware } from 'astro:middleware';
import { auth, authConfigured } from './server/auth';
import { databaseConfigured } from './server/db';
import { ensureWeeklySchedule } from './server/weeks';

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  const path = context.url.pathname;
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

  const session = await auth.api.getSession({ headers: context.request.headers });
  context.locals.user = session?.user ?? null;
  context.locals.session = session?.session ?? null;

  return next();
});

import { expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('astro:middleware', () => ({ defineMiddleware: (handler: unknown) => handler }));
vi.mock('./server/auth', () => ({ authConfigured: true, auth: { api: { getSession } } }));
vi.mock('./server/db', () => ({ databaseConfigured: false }));
vi.mock('./server/weeks', () => ({ ensureWeeklySchedule: vi.fn() }));
import { onRequest } from './middleware';

it('loads the authenticated session for project writes, including trailing slashes', async () => {
  const user = { id: 'owner' };
  getSession.mockResolvedValue({ response: { user, session: { id: 'session' } }, headers: new Headers() });
  for (const path of ['/api/project', '/api/project/']) {
    const request = new Request(`http://localhost${path}`, { method: 'POST' });
    const context = { url: new URL(request.url), request, locals: {} };
    const next = vi.fn(async () => {
      expect(context.locals).toMatchObject({ user });
      return new Response(null, { status: 303 });
    });
    expect((await onRequest(context as Parameters<typeof onRequest>[0], next)).status).toBe(303);
    expect(next).toHaveBeenCalledOnce();
  }
});

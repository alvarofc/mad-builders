import { expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { sendEmailOnce } from './email';
vi.mock('./email', () => ({ sendEmailOnce: vi.fn(async () => true) }));
vi.mock('./email-recipients', () => ({ getReminderRecipients: vi.fn(async () => []) }));
vi.mock('./weeks', () => ({ ensureWeeklySchedule: vi.fn(), getDatabaseNow: vi.fn(async () => new Date('2090-01-03T00:00:00Z')) }));

it.skipIf(!process.env.DATABASE_TEST_URL)('selects welcome mail only after activation and excludes sent, locked, expired and unsubscribed users', async () => {
  const databaseUrl = new URL(process.env.DATABASE_TEST_URL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) || databaseUrl.pathname !== '/mad_builders_test') throw new Error('Local test database required');
  vi.stubEnv('DATABASE_URL', process.env.DATABASE_TEST_URL!);
  vi.stubEnv('RESEND_API_KEY', 'test-only');
  vi.stubEnv('CRON_SECRET', 'test-cron');
  vi.stubEnv('EMAIL_AUTOMATION_START_AT', '2090-01-01T00:00:00Z');
  const { db } = await import('./db');
  const { GET } = await import('../pages/api/email/cron');
  const rollback = new Error('rollback');
  try {
    await db.transaction(async (tx) => {
      const execute = vi.spyOn(db, 'execute').mockImplementation(tx.execute.bind(tx));
      try {
        const ids: Record<string, string> = {};
        for (const state of ['eligible', 'before', 'sent', 'locked', 'expired', 'unsubscribed']) {
          const id = ids[state] = crypto.randomUUID();
          await tx.execute(sql`insert into app_private."user" (id,name,email,created_at,email_unsubscribed_at)
            values (${id}, 'Cron test', ${`${id}@example.invalid`}, ${state === 'before' ? '2089-12-31T00:00:00Z' : '2090-01-01T00:00:00Z'}::timestamptz, ${state === 'unsubscribed' ? new Date().toISOString() : null})`);
          if (['sent', 'locked', 'expired'].includes(state)) {
            await tx.execute(sql`insert into app_private.email_delivery (key,user_id,payload,sent_at,locked_until,created_at)
              values (${`welcome:${id}`},${id},'{}',${state === 'sent' ? new Date().toISOString() : null},
                ${state === 'locked' ? new Date(Date.now() + 120000).toISOString() : null},
                ${new Date(Date.now() - (state === 'expired' ? 24 * 3600000 : 0)).toISOString()})`);
          }
        }
        const response = await GET({ request: new Request('https://www.mad.builders/api/email/cron', { headers: { authorization: 'Bearer test-cron' } }) } as Parameters<typeof GET>[0]);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ sent: 1, failed: 0 });
        expect(sendEmailOnce).toHaveBeenCalledExactlyOnceWith('welcome', { userId: ids.eligible });
        throw rollback;
      } finally { execute.mockRestore(); }
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { vi.unstubAllEnvs(); }
}, 30000);

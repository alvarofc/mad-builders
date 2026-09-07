import { expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { getReminderRecipients } from './email-recipients';
vi.mock('./email-recipients', () => ({ getReminderRecipients: vi.fn() }));

vi.mock('../styles/global.css?raw', async () => {
  const { readFileSync } = await import('node:fs');
  return { default: readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8') };
});

it.skipIf(!process.env.DATABASE_TEST_URL)('deduplicates delivery, preserves retry payloads, and honors unsubscribe and retry expiry', async () => {
  const url = new URL(process.env.DATABASE_TEST_URL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/mad_builders_test') {
    throw new Error('Email tests require a loopback mad_builders_test database');
  }
  vi.stubEnv('DATABASE_URL', process.env.DATABASE_TEST_URL!);
  vi.stubEnv('RESEND_API_KEY', 'test-only');
  const { db } = await import('./db');
  const { sendEmailOnce } = await import('./email');
  const { GET, POST } = await import('../pages/api/email/unsubscribe');
  const rollback = new Error('rollback');
  try {
    await db.transaction(async (tx) => {
      const execute = vi.spyOn(db, 'execute').mockImplementation(tx.execute.bind(tx));
      const fetch = vi.fn().mockImplementation(async () => Response.json({ id: 'test-email' }));
      vi.stubGlobal('fetch', fetch);
      try {
        const id = crypto.randomUUID();
        const [user] = await tx.execute<{token:string}>(sql`insert into app_private."user" (id, name, email) values (${id}, 'Email test', ${`${id}@example.invalid`}) returning email_unsubscribe_token as token`);
        const recipient = { userId: id, weekId: 999, needsResult: true, needsPromise: true };
        vi.mocked(getReminderRecipients).mockResolvedValue([recipient]);
        const results = await Promise.all([sendEmailOnce('welcome', { userId: id }), sendEmailOnce('welcome', { userId: id })]);
        expect(results.sort()).toEqual([false, true]);
        expect(fetch).toHaveBeenCalledTimes(1);
        fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
        await expect(sendEmailOnce('checkin', recipient)).rejects.toThrow('503');
        const firstBody = fetch.mock.calls[1][1].body;
        const [failed] = await tx.execute(sql`select sent_at from app_private.email_delivery where key = ${`checkin:${id}:999`}`);
        expect(failed.sent_at).toBeNull();
        await tx.execute(sql`update app_private.email_delivery set locked_until = now() - interval '1 minute' where key = ${`checkin:${id}:999`}`);
        vi.mocked(getReminderRecipients).mockResolvedValue([{ ...recipient, needsPromise: false }]);
        expect(await sendEmailOnce('checkin', recipient)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(2);
        vi.mocked(getReminderRecipients).mockResolvedValue([recipient]);
        expect(await sendEmailOnce('checkin', recipient)).toBe(true);
        expect(fetch.mock.calls[2][1].body).toBe(firstBody);
        expect(fetch.mock.calls[2][1].headers['Idempotency-Key']).toBe(`checkin:${id}:999`);
        await tx.execute(sql`update app_private.email_delivery set sent_at = null, locked_until = null, created_at = now() - interval '23 hours' where key = ${`checkin:${id}:999`}`);
        expect(await sendEmailOnce('checkin', recipient)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(3);
        vi.mocked(getReminderRecipients).mockResolvedValue([]);
        expect(await sendEmailOnce('voting', recipient)).toBe(false);
        vi.mocked(getReminderRecipients).mockResolvedValue([{ ...recipient, weekId: 998 }]);
        expect(await sendEmailOnce('voting', recipient)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(3);
        vi.mocked(getReminderRecipients).mockResolvedValue([recipient]);
        const votingKey = `voting:${id}:999`;
        fetch.mockRejectedValueOnce(new DOMException('Provider timeout', 'TimeoutError'));
        await expect(sendEmailOnce('voting', recipient)).rejects.toThrow('Provider timeout');
        const retryBody = fetch.mock.calls[3][1].body;
        const unlock = () => tx.execute(sql`update app_private.email_delivery set locked_until = null where key = ${votingKey}`);
        await unlock();
        fetch.mockImplementationOnce(async () => Response.json({}));
        await expect(sendEmailOnce('voting', recipient)).rejects.toThrow('no email ID');
        await unlock();
        // Fail only the final persistence step, after the provider accepted the message.
        let calls = 0;
        execute.mockImplementation((query) => {
          calls++;
          if (calls === 5) return Promise.reject(new Error('Database update failed')) as never;
          return tx.execute(query);
        });
        await expect(sendEmailOnce('voting', recipient)).rejects.toThrow('Database update failed');
        execute.mockImplementation(tx.execute.bind(tx));
        const [ambiguous] = await tx.execute(sql`select sent_at from app_private.email_delivery where key = ${votingKey}`);
        expect(ambiguous.sent_at).toBeNull();
        await unlock();
        expect(await sendEmailOnce('voting', recipient)).toBe(true);
        for (const [, request] of fetch.mock.calls.slice(3)) {
          expect(request.body).toBe(retryBody);
          expect(request.headers['Idempotency-Key']).toBe(votingKey);
        }
        const sentCount = fetch.mock.calls.length;
        const url = new URL(`https://www.mad.builders/api/email/unsubscribe?token=${user.token}`);
        const context = (method: string) => ({ url, request: new Request(url, { method }) }) as Parameters<typeof GET>[0];
        expect((await GET(context('GET'))).status).toBe(200);
        const [before] = await tx.execute(sql`select email_unsubscribed_at from app_private."user" where id = ${id}`);
        expect(before.email_unsubscribed_at).toBeNull();
        expect((await POST(context('POST'))).status).toBe(200);
        expect(await sendEmailOnce('voting', recipient)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(sentCount);
        url.searchParams.set('token', crypto.randomUUID());
        expect((await POST(context('POST'))).status).toBe(404);
        url.searchParams.set('token', 'bad-token');
        expect((await GET(context('GET'))).status).toBe(400);
        throw rollback;
      } finally { execute.mockRestore(); }
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
}, 30000);

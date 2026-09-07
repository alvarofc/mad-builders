import { afterEach, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ db: { execute: vi.fn() } }));
vi.mock('./email', () => ({ sendEmailOnce: vi.fn() }));
vi.mock('./email-recipients', () => ({ getReminderRecipients: vi.fn() }));
vi.mock('./weeks', () => ({ ensureWeeklySchedule: vi.fn(), getDatabaseNow: vi.fn() }));
import { GET } from '../pages/api/email/cron';
import { db } from './db';
import { ensureWeeklySchedule } from './weeks';

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('rejects missing or wrong cron credentials before touching the database', async () => {
  vi.stubEnv('CRON_SECRET', 'private-cron');
  for (const auth of ['', 'Bearer wrong', 'Bearer private-crom']) {
    const response = await GET({ request: new Request('https://www.mad.builders/api/email/cron', { headers: { authorization: auth } }) } as Parameters<typeof GET>[0]);
    expect(response.status).toBe(401);
  }
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET({ request: new Request('https://www.mad.builders/api/email/cron', { headers: { authorization: 'Bearer ' } }) } as Parameters<typeof GET>[0])).status).toBe(401);
  expect(db.execute).not.toHaveBeenCalled();
  expect(ensureWeeklySchedule).not.toHaveBeenCalled();
});

it('requires a provider key and explicit automation start date', async () => {
  vi.stubEnv('CRON_SECRET', 'private-cron');
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_AUTOMATION_START_AT', 'not-a-date');
  const context = { request: new Request('https://www.mad.builders/api/email/cron', { headers: { authorization: 'Bearer private-cron' } }) } as Parameters<typeof GET>[0];
  expect((await GET(context)).status).toBe(503);
  vi.stubEnv('EMAIL_AUTOMATION_START_AT', '2026-01-01T00:00:00Z');
  vi.stubEnv('RESEND_API_KEY', '');
  expect((await GET(context)).status).toBe(503);
  expect(ensureWeeklySchedule).not.toHaveBeenCalled();
});

it('waits for activation, then sends every email kind and reports failures without aborting', async () => {
  const { getDatabaseNow } = await import('./weeks');
  const { getReminderRecipients } = await import('./email-recipients');
  const { sendEmailOnce } = await import('./email');
  vi.stubEnv('CRON_SECRET', 'private-cron');
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_AUTOMATION_START_AT', '2026-09-01T00:00:00Z');
  vi.mocked(getDatabaseNow).mockResolvedValue(new Date('2026-08-31T23:59:00Z'));
  const context = { request: new Request('https://www.mad.builders/api/email/cron', { headers: { authorization: 'Bearer private-cron' } }) } as Parameters<typeof GET>[0];
  expect(await (await GET(context)).json()).toEqual({ sent: 0 });
  expect(db.execute).not.toHaveBeenCalled();
  expect(getReminderRecipients).not.toHaveBeenCalled();
  expect(sendEmailOnce).not.toHaveBeenCalled();

  vi.mocked(getDatabaseNow).mockResolvedValue(new Date('2026-09-07T12:00:00Z'));
  vi.mocked(db.execute).mockResolvedValue([{ userId: 'new-builder' }] as never);
  const checkin = { userId: 'needs-update', weekId: 1, needsResult: true, needsPromise: false };
  const voting = { userId: 'needs-vote', weekId: 1 };
  vi.mocked(getReminderRecipients).mockImplementation(async (kind) => kind === 'checkin' ? [checkin] : [voting]);
  vi.mocked(sendEmailOnce).mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('Resend unavailable')).mockResolvedValueOnce(true);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers();
  try {
    const pending = GET(context);
    await vi.runAllTimersAsync();
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ sent: 2, failed: 1 });
    expect(vi.mocked(sendEmailOnce).mock.calls).toEqual([
      ['checkin', checkin], ['voting', voting], ['welcome', { userId: 'new-builder' }],
    ]);
    expect(error).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); error.mockRestore(); }
});

it('returns 200 on successful sends and stops before starting another send after 40 seconds', async () => {
  const { getDatabaseNow } = await import('./weeks');
  const { getReminderRecipients } = await import('./email-recipients');
  const { sendEmailOnce } = await import('./email');
  vi.stubEnv('CRON_SECRET', 'private-cron');
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_AUTOMATION_START_AT', '2026-09-01T00:00:00Z');
  vi.mocked(getDatabaseNow).mockResolvedValue(new Date('2026-09-07T12:00:00Z'));
  vi.mocked(db.execute).mockResolvedValue([{ userId: 'first' }, { userId: 'second' }] as never);
  vi.mocked(getReminderRecipients).mockResolvedValue([]);
  vi.useFakeTimers();
  vi.mocked(sendEmailOnce).mockImplementation(async () => { vi.setSystemTime(Date.now() + 40_001); return true; });
  try {
    const pending = GET({ request: new Request('https://www.mad.builders/api/email/cron', { headers: { authorization: 'Bearer private-cron' } }) } as Parameters<typeof GET>[0]);
    await vi.runAllTimersAsync();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 1, failed: 0 });
    expect(sendEmailOnce).toHaveBeenCalledExactlyOnceWith('welcome', { userId: 'first' });
  } finally { vi.useRealTimers(); }
});

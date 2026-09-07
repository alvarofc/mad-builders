import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../../../server/db';
import { sendEmailOnce } from '../../../server/email';
import { getReminderRecipients } from '../../../server/email-recipients';
import { ensureWeeklySchedule, getDatabaseNow } from '../../../server/weeks';

export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const start = new Date(import.meta.env.EMAIL_AUTOMATION_START_AT ?? '');
  if (!import.meta.env.RESEND_API_KEY || !Number.isFinite(start.getTime())) {
    return new Response('Email automation is not configured', { status: 503 });
  }
  const started = Date.now();
  await ensureWeeklySchedule();
  const now = await getDatabaseNow();
  if (now < start) return Response.json({ sent: 0 });
  const welcome = await db.execute<{ userId: string }>(sql`
    select u.id as "userId" from app_private."user" u
    where u.email_unsubscribed_at is null and u.created_at >= ${start.toISOString()}::timestamptz
      and not exists (select 1 from app_private.email_delivery d
        where d.key = 'welcome:' || u.id and (d.sent_at is not null
          or d.locked_until > now() or d.created_at <= now() - interval '23 hours'))
    order by u.created_at limit 100
  `);
  const jobs = [
    ...(await getReminderRecipients('checkin', now)).map((recipient) => ({ kind: 'checkin' as const, recipient })),
    ...(await getReminderRecipients('voting', now)).map((recipient) => ({ kind: 'voting' as const, recipient })),
    ...welcome.map((recipient) => ({ kind: 'welcome' as const, recipient })),
  ];
  let sent = 0;
  let failed = 0;
  for (const { kind, recipient } of jobs) {
    if (Date.now() - started > 40_000) break;
    try { if (await sendEmailOnce(kind, recipient)) sent++; }
    catch (error) { failed++; console.error('Email send failed', kind, error instanceof Error ? error.message : 'Unknown error'); }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return Response.json({ sent, failed }, { status: failed ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
};

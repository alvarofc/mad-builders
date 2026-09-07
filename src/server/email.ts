import { sql } from 'drizzle-orm';
import { db } from './db';
import { SITE } from '../config/seo';
import { renderEmail, type EmailKind } from './email-templates';
import { getReminderRecipients } from './email-recipients';
import { getDatabaseNow } from './weeks';

export async function sendEmailOnce(kind: EmailKind, recipient: {
  userId: string; weekId?: number; needsResult?: boolean; needsPromise?: boolean;
}) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is missing');
  if (kind !== 'welcome') {
    const [fresh] = await getReminderRecipients(kind, await getDatabaseNow(), recipient.userId);
    if (!fresh || fresh.weekId !== recipient.weekId) return false;
    recipient = fresh;
  }
  const key = `${kind}:${recipient.userId}${recipient.weekId === undefined ? '' : `:${recipient.weekId}`}`;
  const [user] = await db.execute<{ email: string; token: string }>(sql`
    select email, email_unsubscribe_token as token from app_private."user"
    where id = ${recipient.userId} and email_unsubscribed_at is null
  `);
  if (!user) return false;
  const unsubscribeUrl = `${SITE}/api/email/unsubscribe?token=${user.token}`;
  const payload = JSON.stringify({
    from: 'mad.builders <hello@email.mad.builders>', to: [user.email],
    ...renderEmail(kind, { ...recipient, unsubscribeUrl }),
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  });
  // Persist the exact request so retries keep Resend's idempotency body unchanged.
  await db.execute(sql`
    insert into app_private.email_delivery (key, user_id, payload)
    values (${key}, ${recipient.userId}, ${payload}) on conflict (key) do nothing
  `);
  const [claimed] = await db.execute<{ payload: string }>(sql`
    update app_private.email_delivery set locked_until = now() + interval '2 minutes'
    where key = ${key} and sent_at is null
      and payload = ${payload}
      and (locked_until is null or locked_until < now())
      and created_at > now() - interval '23 hours'
      and exists (select 1 from app_private."user" where id = ${recipient.userId} and email_unsubscribed_at is null)
    returning payload
  `);
  if (!claimed) return false;
  // ponytail: stop ambiguous retries before Resend's 24-hour dedupe expires;
  // reconcile old unsent rows against provider logs before manually retrying.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: claimed.payload,
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  const sent = await response.json();
  if (typeof sent.id !== 'string' || !sent.id) throw new Error('Resend returned no email ID');
  await db.execute(sql`
    update app_private.email_delivery set sent_at = now(), provider_id = ${sent.id}, locked_until = null
    where key = ${key}
  `);
  return true;
}

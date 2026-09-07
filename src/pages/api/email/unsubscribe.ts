import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { db } from '../../../server/db';

export const prerender = false;
const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };

const handle: APIRoute = async ({ request, url }) => {
  const token = url.searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new Response('Invalid unsubscribe link', { status: 400 });
  }
  const [user] = await db.execute<{ id: string }>(sql`
    select id from app_private."user" where email_unsubscribe_token = ${token}::uuid
  `);
  if (!user) return new Response('Invalid unsubscribe link', { status: 404 });
  if (request.method === 'POST') {
    await db.execute(sql`update app_private."user" set email_unsubscribed_at = now() where id = ${user.id}`);
    return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Unsubscribed - mad.builders</title><h1>You’re unsubscribed.</h1><p>We won’t send you more welcome or weekly reminder emails.</p><a href="/build">Back to your week</a></html>', { headers });
  }
  // Email link scanners may follow GET links. Only an explicit POST opts out.
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Unsubscribe - mad.builders</title><h1>Stop emails from mad.builders?</h1><p>Your account and weekly updates will stay as they are.</p><form method="post"><button type="submit">Unsubscribe</button></form></html>', { headers });
};
export const GET = handle;
export const POST = handle;

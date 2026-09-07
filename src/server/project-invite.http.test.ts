import { createHmac, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { expect, it } from 'vitest';

const origin = process.env.INVITE_HTTP_TEST_ORIGIN;
const databaseUrl = process.env.INVITE_HTTP_TEST_DATABASE_URL;
const secret = process.env.INVITE_HTTP_TEST_SECRET;

it.skipIf(!origin || !databaseUrl || !secret)('creates and accepts an invite through authenticated HTTP middleware', async () => {
  const target = new URL(databaseUrl!);
  if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/mad_builders_privacy_test' || new URL(origin!).hostname !== 'localhost') {
    throw new Error('HTTP invitation tests require the local privacy test database and server');
  }
  const db = postgres(databaseUrl!, { max: 1 });
  const owner = `http-owner-${randomUUID()}`;
  const teammate = `http-team-${randomUUID()}`;
  const projectId = `http-project-${randomUUID()}`;
  const handle = `http-${randomUUID().slice(0, 8)}`;
  const cookies = new Map<string, string>();
  try {
    for (const id of [owner, teammate]) {
      const token = randomUUID();
      await db`insert into app_private."user" (id, name, email) values (${id}, ${id}, ${`${id}@example.invalid`})`;
      await db`insert into app_private.session (id, token, user_id, expires_at) values (${randomUUID()}, ${token}, ${id}, now() + interval '1 day')`;
      const signature = createHmac('sha256', secret!).update(token).digest('base64');
      cookies.set(id, `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`);
    }
    await db`insert into app_private.project (id, handle, project_name) values (${projectId}, ${handle}, 'HTTP invitation project')`;
    await db`insert into app_private.project_owner (project_id, user_id, active) values (${projectId}, ${owner}, true)`;
    const post = (id: string, data: Record<string, string>) => fetch(`${origin}/api/project`, {
      method: 'POST', redirect: 'manual', headers: { origin: origin!, cookie: cookies.get(id)! }, body: new URLSearchParams(data),
    });
    const created = await post(owner, { action: 'invite', projectId });
    expect(created.status).toBe(303);
    expect(created.headers.get('location')).toBe('/settings#team');
    const [invite] = await db`select token from app_private.project_invite where project_id = ${projectId}`;
    expect(invite?.token).toMatch(/^[a-f0-9]{64}$/);
    const landing = await fetch(`${origin}/build?invite=${invite.token}`, { headers: { cookie: cookies.get(teammate)! } });
    expect(landing.status).toBe(200);
    expect(landing.headers.get('referrer-policy')).toBe('no-referrer');
    const html = await landing.text();
    expect(html).toContain('accept invitation');
    expect(html).not.toContain('<vercel-analytics');
    const accepted = await post(teammate, { action: 'accept-invite', token: invite.token });
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get('location')).toBe('/build');
    const owners = await db`select user_id, active from app_private.project_owner where project_id = ${projectId}`;
    expect(owners).toEqual(expect.arrayContaining([{ user_id: owner, active: true }, { user_id: teammate, active: true }]));
    expect((await post(teammate, { action: 'accept-invite', token: invite.token })).status).toBe(409);
  } finally {
    await db`delete from app_private.project where id = ${projectId}`;
    await db`delete from app_private."user" where id in (${owner}, ${teammate})`;
    await db.end();
  }
}, 30000);

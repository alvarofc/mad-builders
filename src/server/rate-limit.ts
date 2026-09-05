import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from './db';

async function consume(key: string, max: number) {
  const id = createHash('sha256').update(key).digest('hex');
  const rows = await db.execute<{ count: number }>(sql`
    insert into app_private.rate_limit (id, key, count, last_request)
    values (${randomUUID()}, ${`write:${id}`}, 1, floor(extract(epoch from now()) * 1000))
    on conflict (key) do update set
      count = case
        when app_private.rate_limit.last_request < floor(extract(epoch from now()) * 1000) - 60000 then 1
        else app_private.rate_limit.count + 1
      end,
      last_request = case
        when app_private.rate_limit.last_request < floor(extract(epoch from now()) * 1000) - 60000
          then floor(extract(epoch from now()) * 1000)
        else app_private.rate_limit.last_request
      end
    returning count
  `);
  return (rows[0]?.count ?? max + 1) <= max;
}

export async function allowWrite(request: Request, userId: string, action: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip');
  if (!(await consume(`${action}:user:${userId}`, 30))) return false;
  return ip ? consume(`${action}:ip:${ip}`, 120) : true;
}

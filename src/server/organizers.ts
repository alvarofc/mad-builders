import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { account } from './schema';

export async function isOrganizer(userId: string) {
  const allowed = new Set(
    (import.meta.env.ORGANIZER_GITHUB_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
  if (!allowed.size) return false;

  const [github] = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
    .limit(1);
  return Boolean(github && allowed.has(github.accountId));
}

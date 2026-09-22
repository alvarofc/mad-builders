import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { socialCache } from './schema';

export async function cachedSocialRequest<T>(kind: string, input: unknown, run: () => Promise<T>, now = new Date()): Promise<T> {
  const day = now.toISOString().slice(0, 10);
  const key = createHash('sha256').update(JSON.stringify([kind, day, input])).digest('hex');
  // Commit the claim BEFORE the paid call. Crashes and failures consume today's attempt too.
  const claimed = await db.insert(socialCache).values({ key, day, status: 'pending' }).onConflictDoNothing().returning({ key: socialCache.key });
  if (!claimed.length) {
    const [cached] = await db.select().from(socialCache).where(eq(socialCache.key, key));
    if (cached?.status === 'ready') return cached.payload as T;
    throw new Error('Social check already attempted today or still running.');
  }
  try {
    const payload = await run();
    await db.update(socialCache).set({ status: 'ready', payload }).where(eq(socialCache.key, key));
    return payload;
  } catch (error) {
    await db.update(socialCache).set({ status: 'failed' }).where(eq(socialCache.key, key));
    throw error;
  }
}

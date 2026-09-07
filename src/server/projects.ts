import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, databaseConfigured } from './db';
import { project, projectJoinRequest, projectInvite, projectOwner, user, week, comparison } from './schema';

export async function listOwnedProjects(userId: string) {
  if (!databaseConfigured) return [];
  return db.select({ id: project.id, handle: project.handle, name: project.projectName, active: projectOwner.active })
    .from(projectOwner).innerJoin(project, eq(projectOwner.projectId, project.id))
    .where(eq(projectOwner.userId, userId)).orderBy(project.projectName);
}

export async function getProjectTeam(projectId: string) {
  const owners = await db.select({ id: user.id, name: user.name }).from(projectOwner)
    .innerJoin(user, eq(projectOwner.userId, user.id)).where(eq(projectOwner.projectId, projectId));
  const requests = await db.select({ id: user.id, name: user.name, email: user.email }).from(projectJoinRequest)
    .innerJoin(user, eq(projectJoinRequest.userId, user.id)).where(eq(projectJoinRequest.projectId, projectId));
  const invites = await db.select().from(projectInvite).where(and(
    eq(projectInvite.projectId, projectId), sql`${projectInvite.expiresAt} > now()`,
  ));
  return { owners, requests, invites };
}

export async function requestProjectAccess(userId: string, handle: string) {
  const [target] = await db.select({ id: project.id }).from(project).where(and(
    eq(project.handle, handle), eq(project.isPublic, true),
    sql`${project.hiddenAt} is null`, sql`${project.withdrawnAt} is null`,
  )).limit(1);
  if (!target) return false;
  await db.insert(projectJoinRequest).values({ projectId: target.id, userId }).onConflictDoNothing();
  return true;
}

export async function switchProject(userId: string, projectId: string) {
  return db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
    const [owned] = await tx.select().from(projectOwner)
      .where(and(eq(projectOwner.userId, userId), eq(projectOwner.projectId, projectId))).limit(1);
    if (!owned) return false;
    await tx.update(projectOwner).set({ active: false }).where(eq(projectOwner.userId, userId));
    await tx.update(projectOwner).set({ active: true })
      .where(and(eq(projectOwner.userId, userId), eq(projectOwner.projectId, projectId)));
    return true;
  });
}

export async function decideProjectAccess(ownerId: string, projectId: string, applicantId: string, approve: boolean) {
  return db.transaction(async (tx) => {
    // Same week-first order as voting. Membership changes must invalidate self-reviews.
    const openWeeks = await tx.select({ id: week.id }).from(week)
      .where(sql`${week.finalizedAt} is null`).orderBy(week.id).for('update');
    await tx.select({ id: user.id }).from(user).where(eq(user.id, applicantId)).for('update');
    const [owner] = await tx.select().from(projectOwner)
      .where(and(eq(projectOwner.projectId, projectId), eq(projectOwner.userId, ownerId))).limit(1);
    if (!owner) return false;
    const [request] = await tx.delete(projectJoinRequest).where(and(
      eq(projectJoinRequest.projectId, projectId), eq(projectJoinRequest.userId, applicantId),
    )).returning();
    if (!request) return false;
    if (approve) {
      await addProjectOwner(tx, projectId, applicantId, openWeeks);
    }
    return true;
  });
}

// Both accepted invitations and approved requests use the same membership and voting rules.
async function addProjectOwner(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string,
  applicantId: string,
  openWeeks: Array<{ id: number }>,
) {
  const [active] = await tx.select().from(projectOwner)
    .where(and(eq(projectOwner.userId, applicantId), eq(projectOwner.active, true))).limit(1);
  await tx.insert(projectOwner).values({ projectId, userId: applicantId, active: !active }).onConflictDoNothing();
  // Projects sharing an owner cannot judge each other, including earlier votes this week.
  for (const openWeek of openWeeks) {
    await tx.update(comparison).set({ invalidatedAt: sql`now()`, invalidationReason: 'shared_owner' }).where(and(
      eq(comparison.weekId, openWeek.id), sql`${comparison.invalidatedAt} is null`,
      sql`exists (select 1 from app_private.project_owner voter_owner
        join app_private.project_owner candidate_owner on candidate_owner.user_id = voter_owner.user_id
        join app_private.result r on r.project_id = candidate_owner.project_id
        where voter_owner.project_id = ${comparison.voterProjectId}
        and r.id in (${comparison.candidateLowId}, ${comparison.candidateHighId}))`,
    ));
  }
}

export async function createProjectInvite(ownerId: string, projectId: string) {
  const [owner] = await db.select().from(projectOwner).where(and(
    eq(projectOwner.projectId, projectId), eq(projectOwner.userId, ownerId),
  )).limit(1);
  if (!owner) return false;
  await db.insert(projectInvite).values({
    token: randomBytes(32).toString('hex'), projectId,
    expiresAt: sql`now() + interval '7 days'`,
  });
  return true;
}

export async function getProjectInvite(token: string) {
  if (!databaseConfigured || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [invite] = await db.select({ name: project.projectName }).from(projectInvite)
    .innerJoin(project, eq(projectInvite.projectId, project.id))
    .where(and(eq(projectInvite.token, token), sql`${projectInvite.expiresAt} > now()`)).limit(1);
  return invite ?? null;
}

export async function revokeProjectInvite(ownerId: string, projectId: string, token: string) {
  const [owner] = await db.select().from(projectOwner).where(and(
    eq(projectOwner.projectId, projectId), eq(projectOwner.userId, ownerId),
  )).limit(1);
  if (!owner) return false;
  await db.delete(projectInvite).where(and(eq(projectInvite.projectId, projectId), eq(projectInvite.token, token)));
  return true;
}

export async function acceptProjectInvite(userId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return db.transaction(async (tx) => {
    const openWeeks = await tx.select({ id: week.id }).from(week)
      .where(sql`${week.finalizedAt} is null`).orderBy(week.id).for('update');
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
    const [invite] = await tx.delete(projectInvite).where(and(
      eq(projectInvite.token, token), sql`${projectInvite.expiresAt} > clock_timestamp()`,
    )).returning();
    if (!invite) return false;
    await addProjectOwner(tx, invite.projectId, userId, openWeeks);
    await tx.delete(projectJoinRequest).where(and(eq(projectJoinRequest.projectId, invite.projectId), eq(projectJoinRequest.userId, userId)));
    await tx.update(projectOwner).set({ active: false }).where(eq(projectOwner.userId, userId));
    await tx.update(projectOwner).set({ active: true }).where(and(eq(projectOwner.userId, userId), eq(projectOwner.projectId, invite.projectId)));
    return true;
  });
}

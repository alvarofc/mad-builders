import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { allowWrite, submitReview, getProfileByUserId, getPublicResult, createProfile, publishResult, checkProof } = vi.hoisted(() => ({
  allowWrite: vi.fn(), submitReview: vi.fn(), getProfileByUserId: vi.fn(), getPublicResult: vi.fn(), createProfile: vi.fn(), publishResult: vi.fn(), checkProof: vi.fn(),
}));
vi.mock('../server/rate-limit', () => ({ allowWrite }));
vi.mock('../server/ranking', () => ({ submitReview }));
vi.mock('../server/profiles', () => ({ getProfileByUserId, getPublicResult, createProfile, getPublicProfileByHandle: vi.fn(), updateProfile: vi.fn(), normalizeHandle: (value: string) => value.trim().toLowerCase(), validHandle: () => true, normalizeUrl: (value: string) => value || null }));
vi.mock('../server/results', () => ({ publishResult, checkProof, validProjectStage: (value: string) => value === 'building' }));
import { POST as review } from '../pages/api/review';
import { POST as publish } from '../pages/api/result/publish';
import { POST as profile } from '../pages/api/profile';

const origin = 'https://www.mad.builders';
const validUpdate = { projectId: 'startup', weekId: '1', status: 'submitted', summary: 'Shipped a demo', projectStage: 'building' };
function context(data: Record<string, string>, user: { id: string } | null = { id: 'builder' }, requestOrigin = origin) {
  return {
    request: new Request(`${origin}/api/test`, { method: 'POST', headers: { origin: requestOrigin }, body: new URLSearchParams(data) }),
    url: new URL(`${origin}/api/test`), locals: { user },
    redirect: (path: string, status: number) => new Response(null, { status, headers: { location: path } }),
  } as Parameters<typeof review>[0];
}
beforeEach(() => {
  vi.resetAllMocks();
  allowWrite.mockResolvedValue(true);
  submitReview.mockResolvedValue(true);
  getProfileByUserId.mockResolvedValue({ id: 'startup', handle: 'ana', bio: 'Tools for builders' });
  getPublicResult.mockResolvedValue({ id: 1 });
  checkProof.mockResolvedValue({ url: null, status: 'self_reported', checkedAt: null });
  publishResult.mockResolvedValue({ weekStartDate: '2026-08-31' });
});
afterEach(() => vi.restoreAllMocks());

it('redirects unauthenticated writes without calling a service', async () => {
  for (const route of [review, publish]) {
    const response = await route(context({}, null));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/build');
  }
  expect(allowWrite).not.toHaveBeenCalled();
  expect(submitReview).not.toHaveBeenCalled();
  expect(publishResult).not.toHaveBeenCalled();
});

it('rejects cross-origin writes before consuming rate limits', async () => {
  for (const route of [review, publish]) expect((await route(context({}, { id: 'builder' }, 'https://evil.test'))).status).toBe(403);
  expect(allowWrite).not.toHaveBeenCalled();
});

it('stops rate-limited writes before touching publication or voting', async () => {
  allowWrite.mockResolvedValue(false);
  for (const route of [review, publish]) expect((await route(context({}))).status).toBe(429);
  expect(getProfileByUserId).not.toHaveBeenCalled();
  expect(submitReview).not.toHaveBeenCalled();
});

it('rejects malformed vote IDs and choices before saving', async () => {
  for (const data of [{ assignmentId: '0', selected: 'first' }, { assignmentId: '1.5', selected: 'first' }, { assignmentId: '1', selected: 'invalid' }]) {
    expect((await review(context(data))).status).toBe(400);
  }
  expect(submitReview).not.toHaveBeenCalled();
});

it('saves only the authenticated voter and redirects to the next pair', async () => {
  const response = await review(context({ assignmentId: '12', selected: 'tie', userId: 'another-user' }));
  expect(submitReview).toHaveBeenCalledWith('builder', 12, 'tie');
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/vote?demo=0');
  const retried = await review(context({ assignmentId: '12', selected: 'tie' }));
  expect(retried.headers.get('location')).toBe(response.headers.get('location'));
});

it('returns an actionable conflict when the pair is no longer open', async () => {
  submitReview.mockResolvedValue(false);
  const response = await review(context({ assignmentId: '1', selected: 'first' }));
  expect(response.status).toBe(409);
  expect(await response.text()).toContain('Refresh');
});

it('does not expose database errors in responses or logs', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  submitReview.mockRejectedValue(new Error('sensitive database details'));
  publishResult.mockRejectedValue(new Error('sensitive database details'));
  for (const response of [await review(context({ assignmentId: '1', selected: 'first' })), await publish(context(validUpdate))]) {
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toContain('try again');
    expect(text).not.toContain('sensitive');
  }
  expect(logged.mock.calls).toEqual([
    ['Could not save vote'],
    ['Could not publish weekly update'],
  ]);
});

it('prefills omitted project description from the saved profile and uses the session owner', async () => {
  const response = await publish(context({ ...validUpdate, userId: 'another-user' }));
  expect(publishResult).toHaveBeenCalledWith(expect.objectContaining({ userId: 'builder', projectSentence: 'Tools for builders', weekId: 1, commitmentId: null }));
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/builders/ana/weeks/2026-08-31');
});

it('rejects invalid update fields without publishing', async () => {
  for (const invalid of [{ weekId: '' }, { status: 'unknown' }, { summary: 'a' }, { feedbackRequest: 'a'.repeat(501) }, { projectSentence: '' }, { projectStage: 'invalid' }]) {
    expect((await publish(context({ ...validUpdate, ...invalid }))).status).toBe(400);
  }
  expect(publishResult).not.toHaveBeenCalled();
});

it('sends a saved nonpublic update to owner settings without changing visibility', async () => {
  getPublicResult.mockResolvedValue(null);
  const response = await publish(context(validUpdate));
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/settings');
  expect(getPublicResult).toHaveBeenCalledWith('ana', '2026-08-31');
  expect(publishResult).toHaveBeenCalledOnce();
  expect(publishResult.mock.calls[0][0]).not.toHaveProperty('withdrawnAt');
  expect(publishResult.mock.calls[0][0]).not.toHaveProperty('hiddenAt');
});

it('returns a handle conflict for direct and Drizzle-wrapped unique violations', async () => {
  getProfileByUserId.mockResolvedValue(null);
  const duplicate = Object.assign(new Error('duplicate'), { code: '23505' });
  for (const error of [duplicate, new Error('query failed', { cause: duplicate })]) {
    createProfile.mockRejectedValueOnce(error);
    const response = await profile(context({ handle: 'ana', displayName: 'Ana', projectName: 'Tools', bio: 'Tools for builders' }));
    expect(response.status).toBe(409);
    expect(await response.text()).toBe('That handle is already taken.');
  }
});

it('maps known publication failures to recoverable responses', async () => {
  for (const [code, status] of [['voting_required', 409], ['update_locked', 409], ['status_required', 400], ['next_commitment_required', 400], ['week_not_started', 409], ['commitment_not_found', 404]] as const) {
    publishResult.mockRejectedValueOnce(new Error(code));
    const response = await publish(context(validUpdate));
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain(code);
  }
});


it('rejects a stale publication form after switching projects', async () => {
  const response = await publish(context({ ...validUpdate, projectId: 'previous-project' }));
  expect(response.status).toBe(409);
  expect(publishResult).not.toHaveBeenCalled();
});

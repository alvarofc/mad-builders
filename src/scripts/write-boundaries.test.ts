import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { allowWrite, submitReview, getProfileByUserId, publishResult, checkProof } = vi.hoisted(() => ({
  allowWrite: vi.fn(), submitReview: vi.fn(), getProfileByUserId: vi.fn(), publishResult: vi.fn(), checkProof: vi.fn(),
}));
vi.mock('../server/rate-limit', () => ({ allowWrite }));
vi.mock('../server/ranking', () => ({ submitReview }));
vi.mock('../server/profiles', () => ({ getProfileByUserId, normalizeUrl: (value: string) => value || null }));
vi.mock('../server/results', () => ({ publishResult, checkProof, validProjectStage: (value: string) => value === 'building' }));
import { POST as review } from '../pages/api/review';
import { POST as publish } from '../pages/api/result/publish';

const origin = 'https://www.mad.builders';
const validUpdate = { weekId: '1', status: 'submitted', summary: 'Shipped a demo', projectStage: 'building' };
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
  getProfileByUserId.mockResolvedValue({ handle: 'ana', bio: 'Tools for builders' });
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
  expect(response.headers.get('location')).toBe('/vote');
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

it('maps known publication failures to recoverable responses', async () => {
  for (const [code, status] of [['update_locked', 409], ['status_required', 400], ['next_commitment_required', 400], ['week_not_started', 409], ['commitment_not_found', 404]] as const) {
    publishResult.mockRejectedValueOnce(new Error(code));
    const response = await publish(context(validUpdate));
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain(code);
  }
});

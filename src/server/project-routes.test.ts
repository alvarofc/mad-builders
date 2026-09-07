import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./profiles', () => ({ getProfileByUserId: vi.fn(), normalizeHandle: vi.fn(), validHandle: vi.fn() }));
vi.mock('./projects', () => ({
  acceptProjectInvite: vi.fn(), createProjectInvite: vi.fn(), revokeProjectInvite: vi.fn(),
  decideProjectAccess: vi.fn(), requestProjectAccess: vi.fn(), switchProject: vi.fn(),
}));
vi.mock('./rate-limit', () => ({ allowWrite: vi.fn() }));
import { POST } from '../pages/api/project';
import { getProfileByUserId } from './profiles';
import { acceptProjectInvite, createProjectInvite, revokeProjectInvite } from './projects';
import { allowWrite } from './rate-limit';

const token = 'a'.repeat(64);
const origin = 'https://www.mad.builders';
function post(data: Record<string, string>, userId: string | null = 'owner', requestOrigin = origin) {
  const url = new URL('/api/project', origin);
  return POST({
    url,
    request: new Request(url, { method: 'POST', headers: { origin: requestOrigin }, body: new URLSearchParams(data) }),
    locals: { user: userId ? { id: userId } : null },
    redirect: (location: string, status: number) => new Response(null, { status, headers: { location } }),
  } as Parameters<typeof POST>[0]);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(allowWrite).mockResolvedValue(true);
  vi.mocked(getProfileByUserId).mockResolvedValue({ id: 'active-project' } as never);
});

it('preserves valid invites through sign-in without consuming them', async () => {
  for (const [data, location] of [
    [{ action: 'accept-invite', token }, `/build?invite=${token}`],
    [{ action: 'accept-invite', token: '//evil.invalid' }, '/build'],
    [{ action: 'invite', token }, '/build'],
  ] as const) {
    const response = await post(data, null);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(location);
  }
  expect(acceptProjectInvite).not.toHaveBeenCalled();
  expect(createProjectInvite).not.toHaveBeenCalled();
  expect(allowWrite).not.toHaveBeenCalled();
});

it('rejects cross-origin and rate-limited requests before invite mutations', async () => {
  expect((await post({ action: 'accept-invite', token }, 'owner', 'https://evil.invalid')).status).toBe(403);
  expect(allowWrite).not.toHaveBeenCalled();
  vi.mocked(allowWrite).mockResolvedValue(false);
  expect((await post({ action: 'accept-invite', token })).status).toBe(429);
  expect(acceptProjectInvite).not.toHaveBeenCalled();
  expect(getProfileByUserId).not.toHaveBeenCalled();
});

it('creates and revokes invites only for the authenticated active project owner', async () => {
  for (const action of ['invite', 'revoke-invite']) {
    const mutation = action === 'invite' ? createProjectInvite : revokeProjectInvite;
    vi.mocked(getProfileByUserId).mockResolvedValue(null);
    expect((await post({ action, projectId: 'active-project', token })).status).toBe(404);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 'active-project' } as never);
    expect((await post({ action, projectId: 'other-project', token })).status).toBe(404);
    expect(mutation).not.toHaveBeenCalled();
    vi.mocked(mutation).mockResolvedValue(false as never);
    expect((await post({ action, projectId: 'active-project', token })).status).toBe(404);
    vi.mocked(mutation).mockResolvedValue(true as never);
    const response = await post({ action, projectId: 'active-project', token });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/settings#team');
    expect(mutation).toHaveBeenLastCalledWith(...(action === 'invite' ? ['owner', 'active-project'] : ['owner', 'active-project', token]));
  }
});

it('accepts an invite as the authenticated user and reports expired or used tokens', async () => {
  vi.mocked(acceptProjectInvite).mockResolvedValue(false);
  expect((await post({ action: 'accept-invite', token }, 'teammate')).status).toBe(409);
  vi.mocked(acceptProjectInvite).mockResolvedValue(true);
  const response = await post({ action: 'accept-invite', token, userId: 'spoofed-owner' }, 'teammate');
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/build');
  expect(acceptProjectInvite).toHaveBeenLastCalledWith('teammate', token);
});

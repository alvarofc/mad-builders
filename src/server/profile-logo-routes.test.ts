import { beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('./profiles', () => ({
  createProfile: vi.fn(), updateProfile: vi.fn(), getProfileByUserId: vi.fn(),
  getPublicProfileByHandle: vi.fn(), normalizeHandle: (value: string) => value.toLowerCase(),
  normalizeUrl: (value: string) => value || null, validHandle: () => true,
}));
vi.mock('./rate-limit', () => ({ allowWrite: vi.fn() }));
import { POST } from '../pages/api/profile';
import { createProfile, updateProfile, getProfileByUserId } from './profiles';
import { allowWrite } from './rate-limit';

const origin = 'https://www.mad.builders';
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ projectId: 'project', handle: 'ana', displayName: 'Ana', projectName: 'Example', bio: 'Shipping tools', projectUrl: 'https://example.com' })) data.set(key, value);
  return data;
}
function post(body: BodyInit, options: { user?: string | null; headers?: Record<string, string> } = {}) {
  const url = new URL('/api/profile', origin);
  return POST({
    url, request: new Request(url, { method: 'POST', body, headers: { origin, ...options.headers } }),
    locals: { user: options.user === null ? null : { id: options.user ?? 'owner' } },
    redirect: (location: string, status: number) => new Response(null, { status, headers: { location } }),
  } as Parameters<typeof POST>[0]);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(allowWrite).mockResolvedValue(true);
  vi.mocked(getProfileByUserId).mockResolvedValue({ id: 'project', handle: 'ana' } as never);
  vi.mocked(updateProfile).mockResolvedValue({ id: 'project' } as never);
});

it('preserves existing logos on normal multipart saves and clears them on favicon reset', async () => {
  const data = form();
  for (const reset of [false, true]) {
    if (reset) data.set('resetLogo', '1');
    const response = await post(data);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/settings');
    expect(updateProfile).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: 'project', userId: 'owner', logo: reset ? null : undefined }));
  }
});

it('passes processed multipart uploads to both creation and editing', async () => {
  const bytes = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#ff0000' } }).png().toBuffer();
  for (const creating of [false, true]) {
    if (creating) vi.mocked(getProfileByUserId).mockResolvedValue(null);
    const data = form();
    data.set('logo', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'logo.png');
    data.set('userId', 'spoofed');
    const response = await post(data);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(creating ? '/build' : '/settings');
    const input = vi.mocked(creating ? createProfile : updateProfile).mock.calls.at(-1)![0];
    expect(input.userId).toBe('owner');
    expect(await sharp(Buffer.from(input.logo!.split(',')[1], 'base64')).metadata()).toMatchObject({ format: 'webp', width: 128, height: 64 });
  }
});

it('rejects invalid uploads with a recoverable message before persisting profile changes', async () => {
  const data = form();
  data.set('logo', new Blob(['not an image'], { type: 'image/png' }), 'bad.png');
  const response = await post(data);
  expect(response.status).toBe(400);
  expect(await response.text()).toContain('Could not read that image');
  expect(updateProfile).not.toHaveBeenCalled();
  expect(createProfile).not.toHaveBeenCalled();
});

it('blocks unauthenticated, cross-origin and rate-limited uploads before loading a profile', async () => {
  expect((await post(form(), { user: null })).headers.get('location')).toBe('/build');
  expect((await post(form(), { headers: { origin: 'https://evil.invalid' } })).status).toBe(403);
  expect(allowWrite).not.toHaveBeenCalled();
  vi.mocked(allowWrite).mockResolvedValue(false);
  expect((await post(form())).status).toBe(429);
  expect(getProfileByUserId).not.toHaveBeenCalled();
  expect(updateProfile).not.toHaveBeenCalled();
});

it('rejects stale project forms and projects switched during a save', async () => {
  const data = form();
  data.set('projectId', 'old-project');
  expect((await post(data)).status).toBe(409);
  expect(updateProfile).not.toHaveBeenCalled();
  vi.mocked(updateProfile).mockResolvedValue(null);
  const response = await post(form());
  expect(response.status).toBe(409);
  expect(await response.text()).toContain('Reload before saving');
});

it('rejects oversized and malformed request bodies without persisting', async () => {
  expect((await post(form(), { headers: { 'content-length': String(3 * 1024 * 1024 + 1) } })).status).toBe(413);
  const response = await post('broken multipart', { headers: { 'content-type': 'multipart/form-data; boundary=missing' } });
  expect(response.status).toBe(400);
  expect(await response.text()).toContain('Could not read the form');
  expect(updateProfile).not.toHaveBeenCalled();
  expect(createProfile).not.toHaveBeenCalled();
});

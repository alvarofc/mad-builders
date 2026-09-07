import type { APIRoute } from 'astro';
import {
  createProfile,
  getProfileByUserId,
  getPublicProfileByHandle,
  normalizeHandle,
  normalizeUrl,
  updateProfile,
  validHandle,
} from '../../server/profiles';
import { allowWrite } from '../../server/rate-limit';

export const prerender = false;

const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

const fail = (message: string, status = 400) =>
  new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  if (!locals.user) return redirect('/build', 303);
  if (request.headers.get('origin') !== url.origin) return fail('This request could not be verified.', 403);
  if (!(await allowWrite(request, locals.user.id, 'profile'))) return fail('Too many attempts. Try again in a minute.', 429);
  const existing = await getProfileByUserId(locals.user.id);

  const data = await request.formData();
  if (existing && data.get('projectId') !== existing.id) return fail('Your active project changed. Reload before saving.', 409);
  const handle = existing?.handle ?? normalizeHandle(field(data, 'handle'));
  const displayName = field(data, 'displayName');
  const location = field(data, 'location');
  const projectName = field(data, 'projectName');
  const bio = field(data, 'bio');

  if (!existing && !validHandle(handle)) {
    return fail('Use 3 to 30 lowercase letters, numbers, or hyphens for your handle.');
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return fail('Your name must be between 2 and 80 characters.');
  }
  if (location.length > 80) return fail('Keep your location under 80 characters.');
  if (projectName.length < 2 || projectName.length > 100) {
    return fail('Your project name must be between 2 and 100 characters.');
  }
  if (bio.length < 5 || bio.length > 280) {
    return fail('Describe what you are building in one sentence under 280 characters.');
  }

  let projectUrl: string | null;
  try {
    projectUrl = normalizeUrl(field(data, 'projectUrl'));
  } catch {
    return fail('Enter a full project URL starting with https://.');
  }

  if (existing) {
    const updated = await updateProfile({
      projectId: existing.id,
      userId: locals.user.id,
      displayName,
      location,
      projectName,
      projectUrl,
      bio,
    });
    if (!updated) return fail('Your active project changed. Reload before saving.', 409);
    return redirect('/settings', 303);
  }

  const referrer = await getPublicProfileByHandle(normalizeHandle(field(data, 'ref')));
  const referredByUserId = referrer?.referrerUserId === locals.user.id ? null : (referrer?.referrerUserId ?? null);

  try {
    await createProfile({
      userId: locals.user.id,
      handle,
      displayName,
      location,
      projectName,
      projectUrl,
      bio,
      referredByUserId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'project_already_exists') return redirect('/build', 303);
    const cause = error instanceof Error && error.cause ? error.cause : error;
    if (typeof cause === 'object' && cause && 'code' in cause && cause.code === '23505') {
      return fail('That handle is already taken.', 409);
    }
    throw error;
  }

  return redirect('/build', 303);
};

import type { APIRoute } from 'astro';
import { getProfileByUserId, normalizeHandle, validHandle } from '../../server/profiles';
import { acceptProjectInvite, createProjectInvite, revokeProjectInvite, decideProjectAccess, requestProjectAccess, switchProject } from '../../server/projects';
import { allowWrite } from '../../server/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  if (!locals.user) {
    const data = await request.formData();
    const token = String(data.get('token') ?? '');
    return redirect(data.get('action') === 'accept-invite' && /^[a-f0-9]{64}$/.test(token) ? `/build?invite=${token}` : '/build', 303);
  }
  if (request.headers.get('origin') !== url.origin) return new Response('This request could not be verified.', { status: 403 });
  if (!(await allowWrite(request, locals.user.id, 'project'))) return new Response('Too many attempts. Try again in a minute.', { status: 429 });
  const data = await request.formData();
  const action = String(data.get('action') ?? '');
  if (action === 'accept-invite') {
    if (!(await acceptProjectInvite(locals.user.id, String(data.get('token') ?? '')))) {
      return new Response('This invite has expired, been revoked, or already been used. Ask the owner for a new link.', { status: 409 });
    }
    return redirect('/build', 303);
  }
  if (action === 'invite' || action === 'revoke-invite') {
    const current = await getProfileByUserId(locals.user.id);
    if (!current || data.get('projectId') !== current.id) return new Response('Project not found. Reload settings.', { status: 404 });
    const saved = action === 'invite'
      ? await createProjectInvite(locals.user.id, current.id)
      : await revokeProjectInvite(locals.user.id, current.id, String(data.get('token') ?? ''));
    if (!saved) return new Response('Project not found.', { status: 404 });
    return redirect('/settings#team', 303);
  }
  if (action === 'request') {
    const handle = normalizeHandle(String(data.get('handle') ?? ''));
    if (!validHandle(handle) || !(await requestProjectAccess(locals.user.id, handle))) {
      return new Response('That public project does not exist.', { status: 404 });
    }
    return redirect('/build?requested=1#join-project', 303);
  }
  if (action === 'switch') {
    if (!(await switchProject(locals.user.id, String(data.get('projectId') ?? '')))) return new Response('Project not found.', { status: 404 });
    return redirect('/build', 303);
  }
  if (action !== 'approve' && action !== 'decline') return new Response('Unknown action.', { status: 400 });
  const current = await getProfileByUserId(locals.user.id);
  if (!current || data.get('projectId') !== current.id || !(await decideProjectAccess(locals.user.id, current.id, String(data.get('userId') ?? ''), action === 'approve'))) {
    return new Response('Request not found.', { status: 404 });
  }
  return redirect('/settings', 303);
};

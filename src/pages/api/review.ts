import type { APIRoute } from 'astro';
import { submitReview } from '../../server/ranking';
import { allowWrite } from '../../server/rate-limit';

export const prerender = false;

const fail = (message: string, status = 400) =>
  new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  if (!locals.user) return redirect('/build', 303);
  if (request.headers.get('origin') !== url.origin) return fail('This request could not be verified.', 403);
  if (!(await allowWrite(request, locals.user.id, 'review'))) return fail('Too many attempts. Try again in a minute.', 429);

  const data = await request.formData();
  const assignmentId = Number(data.get('assignmentId'));
  const selected = String(data.get('selected') ?? '');
  if (!Number.isSafeInteger(assignmentId) || assignmentId < 1) return fail('That pair does not exist.');
  if (!['first', 'second', 'tie', 'pass'].includes(selected)) return fail('Choose a result or pass.');

  try {
    const saved = await submitReview(locals.user.id, assignmentId, selected);
    if (!saved) return fail('That pair is no longer open. Refresh to see the current voting state.', 409);
    return redirect('/vote', 303);
  } catch {
    console.error('Could not save vote');
    return fail('Could not save this choice. Please try again.', 500);
  }
};

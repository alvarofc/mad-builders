import type { APIRoute } from 'astro';
import { getProfileByUserId, getPublicResult, normalizeUrl } from '../../../server/profiles';
import { checkProof, publishResult, validProjectStage } from '../../../server/results';
import { allowWrite } from '../../../server/rate-limit';

export const prerender = false;

const fail = (message: string, status = 400) =>
  new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  if (!locals.user) return redirect('/build', 303);
  if (request.headers.get('origin') !== url.origin) return fail('This request could not be verified.', 403);
  if (!(await allowWrite(request, locals.user.id, 'result'))) return fail('Too many attempts. Try again in a minute.', 429);
  const builder = await getProfileByUserId(locals.user.id);
  if (!builder) return redirect('/build', 303);

  const data = await request.formData();
  if (data.get('projectId') !== builder.id) return new Response('Your active project changed. Reload before saving.', { status: 409 });
  const parsedCommitmentId = Number(data.get('commitmentId'));
  const parsedWeekId = Number(data.get('weekId'));
  const commitmentId = Number.isSafeInteger(parsedCommitmentId) && parsedCommitmentId > 0 ? parsedCommitmentId : null;
  const weekId = Number.isSafeInteger(parsedWeekId) && parsedWeekId > 0 ? parsedWeekId : null;
  const status = String(data.get('status') ?? '');
  // Multipart forms encode textarea line breaks as CRLF; browsers count them as LF.
  const summary = String(data.get('summary') ?? '').replace(/\r\n?/g, '\n').trim();
  const feedbackRequest = String(data.get('feedbackRequest') ?? '').replace(/\r\n?/g, '\n').trim();
  const proofUrl = String(data.get('proofUrl') ?? '').trim();
  const nextPromise = String(data.get('nextPromise') ?? '').replace(/\r\n?/g, '\n').trim();
  const projectSentence = String(data.get('projectSentence') ?? builder.bio).replace(/\r\n?/g, '\n').trim();
  const projectStage = String(data.get('projectStage') ?? '');

  if (!commitmentId && !weekId) return fail('That commitment does not exist.');
  if (status !== 'complete' && status !== 'partial' && status !== 'missed' && status !== 'submitted') {
    return fail('Choose complete, partial, or missed.');
  }
  if (summary.length < 5 || summary.length > 1000) {
    return fail('Keep the result between 5 and 1,000 characters.');
  }
  if (projectSentence.length < 5 || projectSentence.length > 280) {
    return fail('Describe what you are building in one sentence under 280 characters.');
  }
  if (feedbackRequest.length > 500) return fail('Keep the feedback request under 500 characters.');
  if (!validProjectStage(projectStage)) return fail('Choose the current stage of your project.');

  let projectUrl;
  try {
    projectUrl = normalizeUrl(String(data.get('projectUrl') ?? ''));
  } catch {
    return fail('Enter a full project URL starting with https://.');
  }

  let proof;
  try {
    proof = await checkProof(proofUrl, locals.user.id, request.headers);
  } catch {
    return fail('Enter a full proof URL starting with https://.');
  }

  try {
    const published = await publishResult({
      userId: locals.user.id,
      projectId: builder.id,
      commitmentId,
      weekId,
      status,
      summary,
      feedbackRequest,
      nextPromise,
      projectSentence,
      projectUrl,
      projectStage,
      proof,
    });
    const visible = await getPublicResult(builder.handle, published.weekStartDate);
    return redirect(visible ? `/builders/${builder.handle}/weeks/${published.weekStartDate}` : '/settings', 303);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'voting_required') return fail('Finish last week’s voting at /vote?demo=0 before publishing this update. Your draft is still saved.', 409);
    if (code === 'project_changed') return fail('Your active project changed. Reload before saving.', 409);
    if (code === 'update_locked') return fail('Voting has opened. This update is now locked.', 409);
    if (code === 'status_required') return fail('Choose how much of your plan you completed.');
    if (code === 'next_commitment_required') return fail('Write next week\'s commitment before publishing.');
    if (code === 'week_not_started') return fail('This week has not started yet.', 409);
    if (code === 'commitment_not_found') return fail('That commitment does not exist.', 404);
    console.error('Could not publish weekly update');
    return fail('Could not save your update. Your draft is still here; please try again.', 500);
  }
};

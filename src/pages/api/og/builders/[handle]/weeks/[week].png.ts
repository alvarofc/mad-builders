import type { APIRoute } from 'astro';
import { renderResultOg } from '../../../../../../server/og';
import { getPublicBuilderActivity, getPublicResult } from '../../../../../../server/profiles';

export const prerender = false;

const fallback = (request: Request) =>
  new Response(null, {
    status: 302,
    headers: { location: new URL('/og.png', request.url).toString(), 'cache-control': 'no-store' },
  });

export const GET: APIRoute = async ({ params, request }) => {
  const published = await getPublicResult(params.handle ?? '', params.week ?? '');
  if (!published) return fallback(request);

  try {
    const activity = await getPublicBuilderActivity(published.userId);
    const image = await renderResultOg({ ...published, streak: activity.streak });
    return new Response(new Uint8Array(image), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return fallback(request);
  }
};

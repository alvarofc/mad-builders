import type { APIRoute } from 'astro';
import { renderProfileOg } from '../../../../server/og';
import { getPublicProfileByHandle } from '../../../../server/profiles';

export const prerender = false;

const fallback = (request: Request) =>
  new Response(null, {
    status: 302,
    headers: { location: new URL('/og.png', request.url).toString(), 'cache-control': 'no-store' },
  });

export const GET: APIRoute = async ({ params, request }) => {
  const builder = await getPublicProfileByHandle(params.handle ?? '');
  if (!builder) return fallback(request);

  try {
    const image = await renderProfileOg(builder);

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

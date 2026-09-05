import type { APIRoute } from 'astro';
import { auth, authConfigured } from '../../../server/auth';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => {
  if (!authConfigured) {
    return new Response('Authentication is not configured.', { status: 503 });
  }

  return auth.handler(request);
};

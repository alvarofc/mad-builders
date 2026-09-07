import type { IncomingMessage } from 'node:http';
import { NodeApp } from 'astro/app/node';
import { expect, it } from 'vitest';
import config from '../../astro.config.mjs';

it('preserves production origins behind Vercel without trusting foreign hosts', () => {
  expect(config.security?.checkOrigin).not.toBe(false);
  for (const hostname of ['www.mad.builders', 'mad.builders', 'evil.test']) {
    for (const forwarded of [false, true]) {
      const request = NodeApp.createRequest({
        method: 'POST',
        url: '/api/profile',
        socket: {},
        headers: {
          host: forwarded ? 'localhost' : hostname,
          'x-forwarded-proto': 'https',
          ...(forwarded ? { 'x-forwarded-host': hostname } : {}),
          origin: `https://${hostname}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
      } as IncomingMessage, { skipBody: true, allowedDomains: config.security?.allowedDomains });

      expect(new URL(request.url).origin === request.headers.get('origin')).toBe(hostname !== 'evil.test');
    }
  }
});

it('keeps form origins while withholding invite paths from referrers', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const page of ['build', 'settings']) {
    const source = await readFile(new URL(`../pages/${page}.astro`, import.meta.url), 'utf8');
    expect(source).toContain("headers.set('Referrer-Policy', 'strict-origin')");
    expect(source).not.toContain("headers.set('Referrer-Policy', 'no-referrer')");
  }
});

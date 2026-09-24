import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import config from '../../astro.config.mjs';
import { site } from '../data/site';
import { absoluteUrl, SITE } from './seo';

// Production serves the apex and redirects www to it. Canonicals, the sitemap and
// robots.txt must all name that same host, or crawlers see canonicals that redirect.
it('points every crawler-facing URL at the apex host', () => {
  expect(SITE).toBe('https://mad.builders');
  expect(config.site).toBe(SITE);
  expect(site.domain).toBe(SITE);
  expect(absoluteUrl('/madrid/')).toBe('https://mad.builders/madrid/');

  const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
  expect(robots).toContain(`Host: ${SITE}`);
});

// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.mad.builders',
  security: {
    // Astro must preserve the public host when Vercel forwards a request.
    allowedDomains: [
      { hostname: 'www.mad.builders', protocol: 'https' },
      { hostname: 'mad.builders', protocol: 'https' },
    ],
  },
  adapter: vercel(),
  integrations: [sitemap(), react()]
});

// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync } from 'node:fs';

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
  adapter: vercel({
    includeFiles: readdirSync(new URL('./src/server/fonts/', import.meta.url))
      .map((file) => `src/server/fonts/${file}`),
  }),
  integrations: [sitemap(), react()]
});

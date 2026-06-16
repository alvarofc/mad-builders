# mad builders — website

**The builders' house in Madrid** — where builders, founders and VCs meet, around AI,
hardware & robotics, healthtech, and digital assets. Born from the people behind
[Startup Embassy](https://www.startupembassy.com/). The WhatsApp community is the front door.

Static site for [mad.builders](https://mad.builders), built with [Astro](https://astro.build).

```bash
pnpm install    # once
pnpm dev        # local dev at localhost:4321
pnpm build      # static output in dist/
pnpm preview    # test the production build locally
```

Deploy anywhere that serves static files (Vercel, Netlify, Cloudflare Pages) — point it at this
repo, build command `astro build`, output `dist/`.

## Updating content

Everything editable lives in `src/data/`:

| File | What it controls |
| --- | --- |
| `site.ts` | WhatsApp link, Luma calendar, social links, focus areas. **Empty links are hidden automatically** — fill them in as you get them. |
| `events.ts` | Event list + co-host names. |
| `people.ts` | Current residents. |
| `projects.ts` | Highlighted resident projects. |
| `friends.ts` | Sister communities. |
| `madrid.ts` | Madrid stats, local communities, and the map pins (`spots`). |

### Adding a new event

1. Create `src/assets/events/<slug>/` with a `cover.jpeg` and photos named `1.jpeg`, `2.jpeg`, …
2. Add an entry to `src/data/events.ts` with the same `slug`.

That's it — the home grid and the `/events/<slug>` gallery page are generated from those two
things.

### Adding a resident

1. Drop the profile card at `src/assets/profiles/<slug>.png`.
2. Add the person to `src/data/people.ts`.

## Structure

- `src/pages/index.astro` — home (hero, events, residents, projects, friends, madrid teaser)
- `src/pages/madrid.astro` — builder's guide to Madrid (stats, communities, calendar, Leaflet map)
- `src/pages/events/[slug].astro` — photo gallery per event, with lightbox
- `src/layouts/Layout.astro` — shared nav/footer + SEO (`src/components/SEO.astro`, `src/config/seo.ts`)
- `src/assets/` — source images used by the site (processed at build time)

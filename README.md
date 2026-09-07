# mad builders website

**The builders' house in Madrid**, where builders, founders and VCs meet around AI,
hardware & robotics, healthtech, and digital assets. Born from the people behind
[Startup Embassy](https://www.startupembassy.com/). The WhatsApp community is the front door.

Astro site for [mad.builders](https://mad.builders). Marketing pages stay static. The proof-of-work pages run on Vercel and store data in Supabase Postgres.

```bash
pnpm install    # once
pnpm dev        # local dev at localhost:4321
pnpm build      # production build
pnpm preview    # test the production build locally
```

Deploy this repository to Vercel with the build command `astro build`.

## Proof of work setup

1. Copy `.env.example` to `.env` and fill in the two Supabase connection strings.
2. Create a GitHub OAuth app. Its local callback is `http://localhost:4321/api/auth/callback/github` and its production callback is `https://www.mad.builders/api/auth/callback/github`.
3. Generate a random `BETTER_AUTH_SECRET` with at least 32 characters.
4. Add comma-separated numeric GitHub account IDs to `ORGANIZER_GITHUB_IDS` and set `ABUSE_REPORT_EMAIL`.
5. Run `pnpm db:migrate` with the migration connection string.
6. Weekly schedules are created automatically when the app receives a request. Submission closes Sunday at 18:00 Madrid time; voting runs until Monday at 18:00. The next building week starts Monday at 00:00 while voting finishes.

Weekly updates keep the Pioneer questions. Known project details are prefilled. Drafts are saved locally in the browser, scoped to the builder and week, and cleared after publication. Updates can be edited until voting opens; the previous goal stays locked. First updates have no completion grade because there is no earlier goal. Next week's goals remain editable until Monday at 00:00, including after publishing the current update. Catch-up links on `/build` let builders finish earlier updates after rollover; late updates do not enter ranking or extend streaks.

Each vote is saved independently. Builders can pause after five comparisons and resume later; ten unlock the provisional leaderboard. Shares and referrals do not affect rank.

The project directory and leaderboard show up to 50 projects per page. Previous and Next links use `?page=2` and preserve other query parameters. Rankings keep their overall position across pages; the leaderboard on `/build` shows the first page and links to `/leaderboard` for more.

Apply `drizzle/0005_company_scale_indexes.sql` through `pnpm db:migrate` for directory and ranking lookup indexes. After a large import, run `ANALYZE` on the affected tables so Postgres plans queries using current row counts. Stale statistics caused very slow leaderboard reads in the local 5,000-project smoke test; this is import maintenance, not work for each page request.

Pagination bounds rendered rows and full project details, but provisional rankings still recalculate scores from the week's candidates and votes on each request. Voting still uses a shared week lock. Load-test those paths before increasing concurrent voting traffic; the local final-leaderboard smoke test does not establish their capacity.

Run `pnpm test` for unit checks. The optional `src/server/results.integration.test.ts` runs when `DATABASE_TEST_URL` is set. It exercises publication, editing, and voting against PostgreSQL inside a transaction that always rolls back its test records. It needs an active submission week.

Use Supabase's session pooler (port 5432) for local `DATABASE_URL` and its direct or session connection for `DATABASE_MIGRATION_URL`. Concurrent page requests can hang with Postgres.js over the transaction pooler (port 6543); verify that connection separately before using it in production. Keep `app_private` out of the Data API's exposed schemas.

With the dev server running, `NAVIGATION_TEST_URL=http://localhost:4321 pnpm exec vitest run src/server/navigation.integration.test.ts` checks concurrent app-page requests.

Local `/build`, `/leaderboard`, and `/vote` show demo rankings or comparisons by default. Use `?demo=0` for real data. The weekly update form on `/build` always saves real data.

### Release checks

The concurrency and public-visibility suites need disposable local databases. They reject remote hosts and unexpected database names. Do not point them at Supabase or a database with real users.

```bash
docker run --detach --rm --name mad-builders-release-tests --publish 127.0.0.1:55439:5432 --env POSTGRES_PASSWORD=test-only --env POSTGRES_DB=mad_builders_test postgres:18-alpine
# Once Postgres is ready:
docker exec mad-builders-release-tests psql -U postgres -d mad_builders_test -c 'CREATE ROLE anon; CREATE ROLE authenticated;'
docker exec mad-builders-release-tests createdb -U postgres mad_builders_privacy_test
DATABASE_MIGRATION_URL=postgres://postgres:test-only@127.0.0.1:55439/mad_builders_test pnpm db:migrate
DATABASE_MIGRATION_URL=postgres://postgres:test-only@127.0.0.1:55439/mad_builders_privacy_test pnpm db:migrate
DATABASE_CONCURRENCY_TEST_URL=postgres://postgres:test-only@127.0.0.1:55439/mad_builders_test pnpm exec vitest run src/server/concurrency.integration.test.ts
```

Run a separate Astro process for the HTTP checks. Empty OAuth credentials keep it signed out and prevent it from using the credentials in `.env`:

```bash
DATABASE_URL=postgres://postgres:test-only@127.0.0.1:55439/mad_builders_privacy_test BETTER_AUTH_SECRET= GITHUB_CLIENT_ID= GITHUB_CLIENT_SECRET= pnpm dev --port 4322
```

In another terminal:

```bash
PUBLIC_VISIBILITY_TEST_URL=http://localhost:4322 DATABASE_VISIBILITY_TEST_URL=postgres://postgres:test-only@127.0.0.1:55439/mad_builders_privacy_test pnpm exec vitest run src/server/visibility.integration.test.ts
```

Stop that Astro process when finished, then run `docker stop mad-builders-release-tests` to remove the disposable databases. The concurrency suite tests simultaneous database writes; the HTTP suite checks public pages, metadata, and PNG share images before and after hiding or withdrawing content.

Organizer moderation uses `POST /api/moderation` with form fields. Send `kind=profile`, a builder `handle`, `action=hide|restore`, and a `reason`; for one result also send `kind=result` and its `week`. To invalidate an abusive account's unfinished-week votes, send `kind=voter&action=invalidate` with its handle and the reason. There is intentionally no moderation dashboard in the pilot.

## Updating content

Marketing content lives in `src/data/`; builder profiles and weekly updates live in the database:

| File | What it controls |
| --- | --- |
| `site.ts` | WhatsApp link, Luma calendar, social links, focus areas. Empty links stay hidden until you fill them in. |
| `events.ts` | Event list + co-host names. |
| `people.ts` | Current residents. |
| `projects.ts` | Highlighted resident projects. |
| `friends.ts` | Sister communities. |
| `madrid.ts` | Madrid stats, local communities, and the map pins (`spots`). |
| `builders-demo.ts` | Local demo projects, rankings, and voting comparisons. |

### Adding a new event

1. Create `src/assets/events/<slug>/` with a `cover.jpeg` and photos named `1.jpeg`, `2.jpeg`, …
2. Add an entry to `src/data/events.ts` with the same `slug`.

That's it. The home grid and the `/events/<slug>` gallery page are generated from those two
things.

### Adding a resident

1. Drop the profile card at `src/assets/profiles/<slug>.png`.
2. Add the person to `src/data/people.ts`.

## Structure

- `src/pages/index.astro`: home (hero, events, residents, projects, friends, madrid teaser)
- `src/pages/madrid.astro`: builder's guide to Madrid (stats, communities, calendar, Leaflet map)
- `src/pages/events/[slug].astro`: photo gallery per event, with lightbox
- `src/pages/build.astro`: sign-in, profile setup, weekly updates, catch-up, and next-week goals
- `src/pages/builders/`: public builder directory, profiles, and weekly result pages
- `src/pages/vote.astro` and `src/pages/leaderboard.astro`: peer comparisons and weekly rankings
- `src/pages/settings.astro`: profile editing and visibility controls
- `src/pages/api/`: authenticated writes, GitHub auth, moderation, and generated social images
- `src/server/`: Better Auth, Drizzle, and private database queries
- `src/layouts/ProductLayout.astro`: shared app navigation
- `src/layouts/Layout.astro`: shared nav/footer and SEO (`src/components/SEO.astro`, `src/config/seo.ts`)
- `src/assets/`: source images used by the site, processed at build time
- [AGENTS.md](AGENTS.md): contributor and agent conventions; [CLAUDE.md](CLAUDE.md) points to the same guide
- [.impeccable.md](.impeccable.md): product design context
- [CHANGELOG.md](CHANGELOG.md): release history

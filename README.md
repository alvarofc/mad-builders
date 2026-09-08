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

Deploy this repository to Vercel with the build command `astro build`. `vercel.json` places server functions in Paris (`cdg1`), near the configured database.

## Proof of work setup

1. Copy `.env.example` to `.env` and fill in the two Supabase connection strings.
2. Create a GitHub OAuth app. Its local callback is `http://localhost:4321/api/auth/callback/github` and its production callback is `https://www.mad.builders/api/auth/callback/github`.
3. Generate a random `BETTER_AUTH_SECRET` with at least 32 characters.
4. Add comma-separated numeric GitHub account IDs to `ORGANIZER_GITHUB_IDS` and set `ABUSE_REPORT_EMAIL`.
5. Run `pnpm db:migrate` with the migration connection string.
6. Weekly schedules are created automatically when the app receives a request. Submission closes Sunday at 18:00 Madrid time; voting runs until Monday at 18:00. The next building week starts Monday at 00:00 while voting finishes.

Startups own their public page, commitments, weekly updates, streak, and ranking. Accounts are co-owners. Owners invite teammates from `/settings` by creating a single-use link that expires after seven days. They share the link directly; no email is sent automatically. The teammate signs in with GitHub and accepts to join and open the shared project. Owners can revoke unused invites. People can also request access by project handle on `/build`; an owner approves it in `/settings`. Every co-owner can edit the project and its update, manage visibility, and approve teammates. Accounts with multiple projects can switch the active project on either page.

Migration `0007_shared_projects` converts existing profiles into projects and adds their original users as owners, preserving handles and history. Apply it with the app stopped before serving the new code. Existing duplicate projects are kept separate; joining one does not merge or delete the other. Saved updates are shared; unpublished browser drafts are local, and simultaneous edits use the last successful save.

Weekly updates keep the Pioneer questions and show them one at a time with shadcn's Questionnaire. Known project details are prefilled. Drafts are saved locally in the browser, scoped to the project and week, and cleared after publication. Updates can be edited until voting opens; the previous goal stays locked. First updates have no completion grade because there is no earlier goal. Next week's goals remain editable until Monday at 00:00, including after publishing the current update. Catch-up links on `/build` let builders finish earlier updates after rollover; late updates do not enter ranking or extend streaks.

Each vote is saved independently. Co-owners share ten comparisons per startup; ten unlock the provisional leaderboard. Projects sharing an owner cannot review each other, and accepting a teammate invalidates those comparisons in unfinished weeks. While last week's voting remains open, eligible builders must finish their comparisons before publishing the next weekly update. Publishing is available once voting closes or no pairs remain; builders who are not eligible to vote are exempt. Shares and referrals do not affect rank.

The project directory and leaderboard show up to 50 projects per page. Previous and Next links use `?page=2` and preserve other query parameters. Rankings keep their overall position across pages. `/build` focuses on your weekly check-in; rankings live on `/leaderboard`.

Apply `drizzle/0005_company_scale_indexes.sql` through `pnpm db:migrate` for directory and ranking lookup indexes. After a large import, run `ANALYZE` on the affected tables so Postgres plans queries using current row counts. Stale statistics caused very slow leaderboard reads in the local 5,000-project smoke test; this is import maintenance, not work for each page request.

Pagination bounds rendered rows and full project details, but provisional rankings still recalculate scores from the week's candidates and votes on each request. Voting still uses a shared week lock. Load-test those paths before increasing concurrent voting traffic; the local final-leaderboard smoke test does not establish their capacity.

Run `pnpm test` for unit checks. The optional `src/server/results.integration.test.ts` runs when `DATABASE_TEST_URL` is set. It exercises publication, editing, and voting against PostgreSQL inside a transaction that always rolls back its test records. It needs an active submission week.

Use Supabase's session pooler (port 5432) for local `DATABASE_URL` and its direct or session connection for `DATABASE_MIGRATION_URL`. Concurrent page requests can hang with Postgres.js over the transaction pooler (port 6543); verify that connection separately before using it in production. Keep `app_private` out of the Data API's exposed schemas.

With the dev server running, `NAVIGATION_TEST_URL=http://localhost:4321 pnpm exec vitest run src/server/navigation.integration.test.ts` checks concurrent app-page requests.

To investigate slow app navigation, inspect the document response's `Server-Timing` header in browser DevTools. It reports durations in milliseconds for `dependency_load`, `schedule`, `session`, and page data loaders such as `profile`, `build_state`, `review`, and `leaderboard`. Operations that do not run have no entry. `instance` marks the first instrumented request in that process as `first-request`, then `warm`.

`dependency_load` measures the middleware's dynamic imports; it excludes modules already imported by the route and Vercel runtime startup. Database connection setup is included in the first database operation. `page_ready` ends when the page response is available; `server_ready` also includes the middleware work. Both exclude any remaining streamed response body, and their nested durations should not be added together. The header contains fixed operation names, durations, and the instance marker, with no query text, credentials, or user values.

Local `/leaderboard` and `/vote` show demo rankings or comparisons by default. Use `?demo=0` for real data. `/build` always uses real data.

### Email setup

Welcome and weekly reminders use Resend with the approved cream-and-green templates. The sender is `mad.builders <hello@email.mad.builders>`.

1. Verify `email.mad.builders` in Resend and set `RESEND_API_KEY` in Vercel’s production environment.
2. Set a random `CRON_SECRET` (at least 32 characters) in Vercel production. Store the same value in Supabase Vault under the name `mad_builders_cron_secret`.
3. Set `EMAIL_AUTOMATION_START_AT` to the activation timestamp, such as `2026-09-08T00:00:00Z`. Welcome emails only go to accounts created on or after this timestamp. Leave it empty to keep automatic sending disabled.
4. Apply migration `0006_nice_vertigo.sql` before deploying. It adds email preferences, unsubscribe tokens, and delivery records. Keep credentials in local `.env` files or Vercel, never Git.

After migration and deployment, enable Supabase Cron (`pg_cron`) and `pg_net` in the Supabase dashboard, then run [`scripts/schedule-emails.sql`](scripts/schedule-emails.sql) in its SQL editor. The named job calls the production `/api/email/cron` endpoint hourly at minute 17, using the Vault secret as its bearer token. Re-running the script updates the same job. A missing or short Vault secret sends no HTTP request. No Vercel cron or GitHub Actions scheduler is needed.

Monitor both `cron.job_run_details` and `net._http_response`: the cron job queues an asynchronous HTTP request, so a successful cron run does not mean the endpoint succeeded. Check HTTP status and response counts in `net._http_response` promptly; pg_net responses expire by default. To stop the scheduler, run `select cron.unschedule('mad-builders-email-reminders');`. Never point it at a preview deployment using the production database. See [Supabase’s scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions) for the Cron, pg_net, and Vault pattern.

Welcome emails arrive on the next hourly run. Sunday check-ins run between 14:00 and 18:00 Madrid for active builders with this week’s commitment or result, and ask only for missing results or next-week goals. Monday voting reminders use the same window and require an on-time result, enough eligible candidates, unfinished votes, and an available comparison. Stored week deadlines handle summer and winter time.

Every email includes a plain-text version and unsubscribe link. Opening the link shows a confirmation; submitting it stops welcome and reminder emails. Inbox one-click unsubscribe uses the same POST endpoint. Link scanners cannot unsubscribe someone with a GET request.

Delivery records prevent repeated sends. An atomic two-minute lease handles overlapping cron calls; retries use the saved request body and Resend idempotency key. Retries stop after 23 hours, before Resend’s 24-hour protection expires. Changed reminder content is not retried, so completing an action does not trigger an outdated reminder. Unsent rows older than 23 hours need inspection against Resend logs before any manual retry.

The job selects up to 100 recipients per email kind and stops starting sends after 40 seconds. It spaces requests by 600 ms and retries eligible unsent recipients on the next run. This is sized for the current community; increase scheduling frequency or move delivery to a queue before a large import. Monitor non-200 cron responses and unsent delivery records.

To run email database checks against the disposable database described below:

```bash
DATABASE_EMAIL_TEST_URL=postgres://postgres:test-only@127.0.0.1:55439/mad_builders_test pnpm exec vitest run src/server/email-recipients.test.ts
DATABASE_TEST_URL=postgres://postgres:test-only@127.0.0.1:55439/mad_builders_test pnpm exec vitest run src/server/email.integration.test.ts
```

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

Organizer moderation uses `POST /api/moderation` with form fields. Send `kind=profile`, a project `handle`, `action=hide|restore`, and a `reason`; for one result also send `kind=result` and its `week`. To invalidate a project's unfinished-week votes, send `kind=voter&action=invalidate` with its handle and the reason. There is intentionally no moderation dashboard in the pilot.

## Updating content

Marketing content lives in `src/data/`; projects, ownership, and weekly updates live in the database:

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
- `src/pages/login.astro`: GitHub sign-in and account creation
- `src/pages/build.astro`: sign-in, profile setup, weekly updates, catch-up, and next-week goals
- `src/components/WeeklyUpdateForm.tsx`: React island using shadcn's Questionnaire for weekly updates
- `src/pages/builders/`: public builder directory, profiles, and weekly result pages
- `src/pages/vote.astro` and `src/pages/leaderboard.astro`: peer comparisons and weekly rankings
- `src/pages/settings.astro`: project editing, co-owner approvals, project switching, and visibility controls
- `src/pages/api/`: authenticated writes, GitHub auth, moderation, and generated social images
- `src/server/`: Better Auth, Drizzle, and private database queries
- `src/layouts/ProductLayout.astro`: shared app navigation
- `src/layouts/Layout.astro`: shared nav/footer and SEO (`src/components/SEO.astro`, `src/config/seo.ts`)
- `src/assets/`: source images used by the site, processed at build time
- [AGENTS.md](AGENTS.md): contributor and agent conventions; [CLAUDE.md](CLAUDE.md) points to the same guide
- [.impeccable.md](.impeccable.md): product design context
- [CHANGELOG.md](CHANGELOG.md): release history

# mad builders website

**The builders' house in Madrid**, where builders, founders and VCs meet around AI,
hardware & robotics, healthtech, and digital assets. Born from the people behind
[Startup Embassy](https://www.startupembassy.com/). The WhatsApp community is the front door.

Astro site for [mad.builders](https://mad.builders). Marketing pages stay static. The proof-of-work pages run on Vercel and store data in Supabase Postgres.

Use Node.js 24 locally and on Vercel, as declared in `package.json`. Mastra requires Node.js 22.13 or newer.

```bash
pnpm install    # once
pnpm dev        # local dev at localhost:4321
pnpm build      # production build
pnpm preview    # test the production build locally
```

Deploy this repository to Vercel with the build command `astro build`. `vercel.json` places server functions in Paris (`cdg1`), near the configured database.

## Proof of work setup

1. Copy `.env.example` to `.env` and fill in the two Supabase connection strings.
2. Create a GitHub OAuth app. Its local callback is `http://localhost:4321/api/auth/callback/github` and its production callback is `https://mad.builders/api/auth/callback/github`. Leave `BETTER_AUTH_URL` unset in production or set it to `https://mad.builders`, since it overrides that host.
3. Generate a random `BETTER_AUTH_SECRET` with at least 32 characters.
4. Add comma-separated numeric GitHub account IDs to `ORGANIZER_GITHUB_IDS` and set `ABUSE_REPORT_EMAIL`.
5. Run `pnpm db:migrate` with the migration connection string.
6. Weekly schedules are created automatically when the app receives a request. Submission closes at the end of Monday (Tuesday at 00:00 Madrid time); voting runs until the end of Sunday (Monday at 00:00). The next building week still starts Monday at 00:00. On Monday, `/build` defaults to the week being finished.

Startups own their public page, commitments, weekly updates, streak, and ranking. Accounts are co-owners. Owners invite teammates from `/settings` by creating a single-use link that expires after seven days. They share the link directly; no email is sent automatically. The teammate signs in with GitHub and accepts to join and open the shared project. Owners can revoke unused invites. People can also request access by project handle on `/build`; an owner approves it in `/settings`. Every co-owner can edit the project and its update, manage visibility, and approve teammates. Accounts with multiple projects can switch the active project on either page.

Migration `0007_shared_projects` converts existing profiles into projects and adds their original users as owners, preserving handles and history. Apply it with the app stopped before serving the new code. Existing duplicate projects are kept separate; joining one does not merge or delete the other. Saved updates are shared; unpublished browser drafts are local, and simultaneous edits use the last successful save.

Projects use their website favicon by default. Owners can upload a PNG, JPEG or WebP up to 2 MB and 16 megapixels during project setup on `/build` or in `/settings`. Settings also lets them replace the logo or switch back to the favicon. Uploaded logos appear on public project pages, in the directory and leaderboard, and in social previews. The server stores a WebP thumbnail up to 128×128 pixels in Postgres.

Apply `drizzle/0009_project_logo.sql` through `pnpm db:migrate` before deploying the logo upload feature. It adds the nullable project logo column; existing projects keep using their favicons.

Weekly updates keep the Pioneer questions and show them one at a time with shadcn's Questionnaire. Known project details are prefilled. Drafts are saved locally in the browser, scoped to the project and week, and cleared after publication. Updates can be edited until voting opens; the previous goal stays locked. First updates have no completion grade because there is no earlier goal. Next week's goals remain editable until Monday at 00:00, including after publishing the current update. The 12 most recent catch-up links on `/build` let builders finish earlier updates after rollover, even without a saved goal; updates published after the submission deadline do not enter ranking or extend streaks. Apply `drizzle/0010_monday_update_deadline.sql` through `pnpm db:migrate` to extend eligible pending weeks whose new Monday deadline has not passed. Apply `drizzle/0011_sunday_voting_deadline.sql` through the same command to keep voting open through Sunday for eligible pending weeks. The migrations preserve longer voting extensions and correct updates published within the extended submission window to on time. `0012_repair_extended_results.sql` catches publications that committed while the deadline extension waited for a week lock.

Projects can vote after publishing an update for the voting week, including late updates. Hidden or withdrawn updates do not qualify. Only on-time updates can receive votes and enter the ranking. Each vote is saved independently. Co-owners share one set of comparisons per startup, with each result appearing at most once, including results they chose or skipped. The number of pairs scales with the available updates, with no ten-pair limit. If a startup has an odd number of eligible updates to review, one sits out; that leftover rotates across voters so each update gets equal exposure when everyone finishes and projects have no shared owners. Projects sharing an owner cannot review each other, and accepting a teammate invalidates those comparisons in unfinished weeks.

Finishing all available pairs unlocks the provisional leaderboard once it has qualifying ranks. Until then, the leaderboard keeps showing the most recent ranked closed week, including when newer weeks close without ranks. Builders who finished their comparisons are not prompted to vote again while viewing those earlier results. While last week's voting remains open, eligible builders must finish their comparisons before publishing the next weekly update. Publishing is available once voting closes or no pairs remain; builders who are not eligible to vote are exempt. Ranking needs at least six eligible updates. Each result needs `min(8, 2 × floor((eligible updates - 1) / 2))` decisions to rank; skips do not count as decisions. Shares and referrals do not affect rank.

The project directory and leaderboard show up to 50 projects per page. Previous and Next links use `?page=2` and preserve other query parameters. Rankings keep their overall position across pages. `/build` focuses on your weekly check-in; rankings live on `/leaderboard`.

`/leaderboard?week=YYYY-MM-DD` shows an earlier week by its Monday start date. Only weeks whose voting has closed with final ranks are served, and each one links to the previous and next ranked week. An unknown, malformed, still-running or unranked week redirects to the latest leaderboard. A ranked weekly update page links to the leaderboard for its own week.

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

Welcome emails arrive on the next hourly run. Weekly reminders run in the four hours before the stored submission or voting deadline, normally Monday or Sunday from 20:00 to midnight Madrid. Check-ins go to active builders with this week’s commitment or result; their subjects and body ask only for missing results or next-week goals that are still editable. Voting reminders require a published result for the voting week, including late results, enough eligible candidates, unfinished votes, and an available comparison. They explain how reviews help updates qualify for ranking and that teammates share votes. Submission and voting deadline copy uses the stored date and time in Madrid, including extensions and summer or winter time.

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

### Weekly check-in chat

Social checks use `app_private.social_cache` (migration `0015`) to claim paid work before calling a provider. A normalized account shares one provider attempt per UTC day across users, projects, and server instances. Partial results, failures, and interrupted attempts are not automatically retried after the daily attempt finishes; previous snapshots remain available. Within an attempt, X reads are serialized in each server worker and a rate-limited read retries once after a bounded wait. Separate workers can still compete for the provider limit. Concurrent callers may see an unavailable message while the first check finishes. There is no paid fallback when cache storage fails.

Social relevance reviews and social draft suggestions are cached for the day by their project/user context, evidence, draft, and model. Changed inputs can trigger a new AI call; ordinary chat messages are not cached. Raw provider data is shared internally, while user/project snapshot history and AI results remain scoped to their respective context.

The update's **Refresh social activity** button allows one additional provider attempt per normalized account per UTC day, shared across users. Repeated manual refreshes reuse that attempt, including its failure state. Automatic checks retain their separate daily limit; a failed manual refresh keeps any existing snapshot available.

Settings groups Profile, Social links, Team, Updates, and Danger zone into tabs. Project visibility controls live in Danger zone. Builders add personal and company social links in `/settings#socials` by pasting a profile URL; the platform logo appears automatically, and additions, edits, and removals save automatically. Personal links belong to the signed-in account; co-owners share company links. Both appear on the public project page. Apply migrations `0013_social_links`, `0014_social_snapshots`, and `0015_social_cache` with `pnpm db:migrate` before deploying.

Opening an update checks saved LinkedIn and X accounts automatically when their provider keys are configured. Set `HARVESTAPI_KEY` for LinkedIn and `TWITTERAPI_IO_KEY` for X in the deployment environment and redeploy. The adapters use [HarvestAPI profile/company posts and profiles](https://docs.harvestapi.io/) and [TwitterAPI.io last tweets](https://docs.twitterapi.io/api-reference/endpoint/get_user_last_tweets) plus [user info](https://docs.twitterapi.io/api-reference/endpoint/get_user_by_username). GitHub, Instagram and website URLs remain profile links. The check also needs the Cerebras configuration below.

Each account fetch reads one recent page of authored posts, including X replies, and the current profile's follower count. Reposts and mismatched authors are excluded. The server stores private daily snapshots of post excerpts, engagement counts, account identity and follower counts. Successful snapshots are reused that UTC day, and each browser automatically reviews them once per day per project/week/account selection. “Check social activity” reuses the daily data and cached AI results when inputs match. Failed provider attempts stay cached until the next UTC day; the separate refresh button uses the additional daily attempt described above. There is no background polling. Removing a link stops future checks for it; existing snapshots remain private.

The server filters posts to the selected week in Madrid. Measurements through the selected update's submission deadline are eligible, so a normal Monday check-in can include Monday counts with their actual date. Older catch-up drafts never use today's metrics as historical measurements. Follower differences require two known counts for the same provider account ID, at least 20 hours apart; the baseline is the first eligible observation that week or the most recent check-in in the preceding 14 days. The exact observation dates travel with the difference. A first reading or missing count never implies growth. Changes below 100 followers also need at least 10 followers and 5% of the baseline to qualify for review; losses use the same thresholds.

An engagement comparison needs five distinct older original posts in the preceding 30 days with known likes, comments and shares. A candidate needs at least 50 interactions and three times that sample's median. Counts are cumulative when observed, not new interactions during the week. Small samples, older posts with more time to accumulate interactions, and one-page coverage limit this comparison; it is not a claim of virality. Busy accounts and old catch-up weeks may be incomplete.

A Mastra social relevance reviewer selects only evidence clearly related to the active project and useful beyond the current draft and four previous updates. It rejects unrelated popular posts, vague promotion, uncertain attribution and duplicate achievements. The weekly coach then drafts from the selected evidence, with original links, dated metrics and relevance reasons available for review. Neither agent has publishing tools. Counts never establish sales, customer quality or causation. Uncertain relevance or a failed review leaves the draft untouched. Run the synthetic model checks with `RUN_SOCIAL_RELEVANCE_EVAL=1 pnpm exec vitest run src/server/social-review.live.test.ts`; these send test examples to Cerebras, not real social accounts.

Relevant findings appear as suggested additions, including when the draft is empty. Existing notes, published updates being edited, and edits made while the check runs are preserved; the builder chooses whether to append the suggestion. Completion status, next goals and feedback requests stay unchanged. Imports are limited to two per user per minute. Partial provider failures leave manual writing available. Astro's Vercel adapter allows 120 seconds for the bounded retrieval, relevance review and coach calls.

Set `CEREBRAS_API_KEY` in local `.env` to enable the conversational weekly check-in. `CEREBRAS_MODEL` defaults to `qwen-3.8-27b`. In Vercel, add the key and `CEREBRAS_MODEL=qwen-3.8-27b` to Production and Preview before building. The app reads them through `import.meta.env`, so deploy again after changing either value. Without a key, the questionnaire remains available.

The production coach runs inside Astro's `/api/result/chat` route on Vercel and calls Cerebras. Keep the existing `astro build` command. It uses the existing Supabase database for project context and needs no separate Mastra server. `pnpm mastra:dev` and `.context/mastra-studio.db` are only for local Studio work.

The Mastra project coach receives the active project's description and stage, the selected week's goal, up to four earlier updates and their outcomes, the existing next-week goal, the current draft and conversation. It offers opinions, practical project help and next steps suited to business, learning or hobby projects. Ordinary messages can use saved social observations without fetching accounts again. Context is loaded on the server for the authenticated active project. It has no tools or publishing capability.

A new conversation opens with a short welcome based on a relevant detail from the draft, dated history or available social evidence. The welcome leaves all draft fields unchanged. Identical in-flight welcome requests share one model call within a server worker; completed and failed calls are removed so a new conversation or retry can generate again. Under **Social context**, a dot and text label show whether the last check succeeded, was incomplete, is running, has not run or has no connected accounts. This reports the check result, not continuous provider health.

The coach uses Mastra’s built-in `ModerationProcessor` with an `off_topic` category and Qwen. The guardrail runs in both the chat API and Studio. Project opinions, strategy, technical help, sample code, outreach and context questions are allowed alongside updates and goals. Advice and examples stay in the conversation. Suggested changes show the current and proposed text for each field, with Apply to draft and Dismiss controls. Drafts change only when the builder accepts a suggestion; unaccepted suggestions survive a browser reload. Wholly unrelated requests and requests to reveal secrets or override instructions get a redirect with no draft changes; mixed requests can receive help with their project-related part. If the check fails, the API returns a recoverable error. `errorStrategy: 'strict'` blocks requests if moderation is unavailable. This adds one model call per message; model-based topic checks reduce misuse but cannot guarantee rejection of every prompt injection. Run the synthetic scope examples with `RUN_COACH_SCOPE_EVAL=1 pnpm exec vitest run src/server/weekly-coach.live.test.ts`.

Chat and draft are saved in this browser. The conversation is sent to Cerebras when the builder sends a message, the welcome is generated or the automatic social check drafts a suggestion; it is not persisted by Mastra. Each conversation allows 20 exchanges, with a fresh conversation retaining the draft. Requests are limited to ten per user per minute. The review form uses the existing publish endpoint, validation, voting rules and deadlines. Only the builder selects completion status and publishes.

Run `pnpm mastra:dev` and open `http://127.0.0.1:4111` to test the “Project coach” and “Weekly social relevance reviewer” in Studio. Studio chats are a prompt playground; the app supplies the project context via `/api/result/chat`. The Editor, Evaluate, Review and Agent traces tabs are enabled. Prompt versions, experiments, reviews and traces from Studio runs persist locally in `.context/mastra-studio.db`. Editor changes apply to Studio runs; the app continues to use the prompt defined in code.

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

- `src/pages/index.astro`: home (hero, the deal with the weekly leaderboard explainer, events, residents, projects, friends, madrid teaser)
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

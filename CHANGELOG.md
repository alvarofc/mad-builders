# Changelog

Changes to mad.builders.

## [0.10.0.0] - 2026-09-24

### Added

- Browse earlier weeks on the leaderboard, with links to the previous and next ranked week. A ranked weekly update now links to the leaderboard for its own week.
- Read how the weekly leaderboard works from the homepage, and open it from there. Anyone can join, from anywhere.
- See tied projects marked as tied, and each project's wins, ties and vote count next to its win rate.

### Changed

- Read the week's status in plain words ("early results", "final", "updates only", "shipping now"), with the week's date and when early results become final.
- Small weeks now lead with what shipped instead of what was missing.
- The leaderboard column header stays in view while you scroll, and the top three ranks and your own row stand out more.
- Use one link per leaderboard row, so keyboard users get a single tab stop and the whole row stays tappable.
- Call the leaderboard "leaderboard" everywhere, use lowercase for vote buttons, and match page title sizes and spacing across app pages.
- See your rank at a glance in your project's update history.
- The brand page now lists the green-on-cream colours the app uses.

### Fixed

- A malformed or unknown week in a leaderboard link now redirects to the latest leaderboard instead of erroring or showing another week under the wrong address.
- Earlier weeks no longer show this week's voting prompt or recent updates, and a week whose ranked projects were all taken down no longer asks you to vote on it.
- The explanation for a week that ended unranked no longer claims it had too few projects when it had too few votes.
- Load the leaderboard with fewer database round trips, and skip the live early-results calculation when viewing an earlier week.

## [0.9.1.0] - 2026-09-22

### Changed

- Review and accept each suggested chat edit before it changes your draft. Social additions also wait for your approval, even when the draft is empty.
- Ask the project coach for candid opinions, technical help, business advice or a small next step. Coaching uses known context and fits both business and hobby projects.
- Start a check-in with a short welcome based on your draft, previous updates or relevant social activity, while keeping your notes intact.
- See whether your last social check succeeded, was incomplete or has not run yet, with a status dot and label.

### Fixed

- Let ordinary chat replies use saved social context without fetching accounts again.
- Retry rate-limited TwitterAPI.io reads and coordinate personal and company account reads within each server worker.

## [0.9.0.0] - 2026-09-22

### Added

- Add personal and project social accounts by pasting a profile URL, with automatic platform logos and saving.
- Find relevant LinkedIn and X posts, engagement, and measured follower changes when writing a weekly update. Review suggested additions and source links before publishing.
- Reuse daily social checks across accounts and co-owners, with one extra manual refresh per account per day. Reuse AI reviews and suggestions when the inputs match.

### Changed

- Organize settings into Profile, Social links, Team, Updates, and Danger zone tabs. Keep unsaved inputs when switching tabs.
- Move project visibility controls into Danger zone.

## [0.8.4.0] - 2026-09-22

### Fixed

- Keep the last ranked leaderboard visible until the next week has qualifying ranks, without asking builders who finished voting to vote again.

## [0.8.3.0] - 2026-09-22

### Fixed

- Vote after publishing a late weekly update, receive voting reminders, and see the early leaderboard after finishing your votes.

## [0.8.2.1] - 2026-09-21

### Fixed

- Open this week’s update while signed in without a server error.

## [0.8.2.0] - 2026-09-21

### Changed

- Write weekly updates in a focused chat, then review and edit the draft before publishing.
- Keep the message box visible while longer conversations scroll on mobile and desktop.
- Open product and account links from a hamburger menu on mobile.
- Use clearer button layouts, larger tap targets, and better text wrapping on small screens.

## [0.8.1.0] - 2026-09-21

### Fixed

- Publish updates for previous weeks even without a saved goal. Late updates stay out of voting and streaks.
- Finish weekly updates through Monday night, Madrid time, with voting through Sunday night.
- Open the week being finished by default on Monday, and stop reminders from asking for goals that have already locked.

## [0.8.0.3] - 2026-09-18

### Fixed

- See project descriptions on the leaderboard, with links to each project profile.

## [0.8.0.2] - 2026-09-18

### Fixed

- See update and sharing controls only on your own project page.

## [0.8.0.1] - 2026-09-18

### Fixed

- See the actual Madrid deadline in weekly update and voting reminders, including extended deadlines.

### Changed

- Understand why weekly votes matter for ranking and how teammates share them.
- Get check-in email subjects that match the update or goal you still need to post.

## [0.8.0.0] - 2026-09-16

### Changed

- Keep the leaderboard focused on the current weekly loop, with clearer scores, project updates, mobile rows, empty states, and a marker for your own project.
- Use vote, goal, update, and project consistently across the weekly build flow, pages, emails, and publishing errors.
- Keep the next action visible after publishing, including voting from the weekly result page and recovery links from empty states.
- Hide project-joining prompts from builders who already belong to a project unless they explicitly open the join flow.
- Make weekly update chat and questionnaire actions easier to scan, with the primary next step separated from back and skip actions.

### Added

- Show the running week's publish or voting task on the leaderboard when the signed-in builder can act.
- Keep weekly update summaries available on mobile and add keyboard skip navigation and accessible leaderboard labels.

## [0.7.0.0] - 2026-09-15

### Added

- Write weekly updates through a conversation that uses your project details, goals and previous updates.
- Get help explaining your project, reflecting on blockers and choosing a realistic goal for next week.
- Review and edit the draft before publishing, with conversation and unsent messages saved in your browser.
- Test and refine the coach in local Mastra Studio, with prompt versions, evaluations and agent traces.

### Changed

- Keep the coach focused on project check-ins and short pitches, with a redirect for unrelated requests.
- Continue using the questionnaire when AI is unavailable.

## [0.6.0.1] - 2026-09-14

### Fixed

- See the scheduled voting opening and closing times, including extended voting windows.

## [0.6.0.0] - 2026-09-14

### Added

- Upload a project logo during setup or in Settings, replace it later, or switch back to the website favicon.
- Show your chosen logo on project pages, in the directory and leaderboard, and in social previews.

## [0.5.2.0] - 2026-09-14

### Fixed

- Review each weekly result at most once, including results you chose or skipped.
- Complete all available pairs instead of a fixed ten. Odd leftovers rotate across voters so each update gets equal exposure when everyone finishes and projects have no shared owners.
- Open the early leaderboard when your available comparisons are finished, and let smaller weeks qualify for rankings with the reviews available to them.
- Receive voting reminders only while comparisons remain, with no fixed ten-vote requirement.

## [0.5.1.1] - 2026-09-14

### Changed

- Share the update for the week of 7 September until midnight on 14 September, Madrid time. Voting closes Friday, 18 September at 18:00.
- Keep unfinished updates accessible while an earlier week’s deadline is extended, and count updates submitted within the extension as on time.

## [0.5.1.0] - 2026-09-09

### Changed

- Reuse unchanged calendar thumbnails across builds when the build cache is restored.

## [0.5.0.0] - 2026-09-08

### Added

- Sign in or create an account from a dedicated login page before adding a project.

### Changed

- Show a clear add-project button on the leaderboard for builders without a project.
- Hide the button for builders who already have a project and move the ranking explanation below the board.

## [0.4.2.0] - 2026-09-07

### Fixed

- Hide the login button on the homepage and other marketing pages when you are already signed in.

## [0.4.1.3] - 2026-09-07

### Fixed

- Open the join-request form from settings and keep its confirmation visible after submission.

## [0.4.1.2] - 2026-09-07

### Fixed

- Create and accept teammate invitations without the browser’s form submissions being rejected as cross-site requests.
- Keep invite tokens out of referrer headers while preserving the origin needed to verify forms.

## [0.4.1.1] - 2026-09-07

### Fixed

- Show only a project’s own teammates on its public page and in the project directory.

## [0.4.1.0] - 2026-09-07

### Fixed

- Publish weekly updates in Firefox without losing text answers or seeing a misleading character-limit error.
- Keep text answers in browser drafts when filling out weekly updates in Firefox.

## [0.4.0.0] - 2026-09-07

### Added

- Invite teammates to co-own a startup using single-use links that expire after seven days.
- Request access to an existing startup, approve teammates, and switch between shared projects.

### Changed

- Share one startup profile, weekly update, voting quota, and ranking across all owners.
- Keep existing project handles and history, record who edits updates, and base reminders on shared project activity.
- Prevent teammates from reviewing projects with overlapping owners and protect writes when switching projects.

## [0.3.3.0] - 2026-09-07

### Changed

- Run app pages in Paris, near the configured database, to reduce network delays.
- Inspect navigation delays by initialization, session lookup, schedule refresh, and page data loading in browser response timings.

## [0.3.2.1] - 2026-09-07

### Fixed

- Share weekly updates and builder profiles with readable text in their preview images.

## [0.3.2.0] - 2026-09-07

### Fixed

- Publish multiline weekly answers within the character limit without line breaks inflating the count.
- See specific errors beside invalid weekly answers and correct them before moving to the next question.

## [0.3.1.2] - 2026-09-07

### Fixed

- Publish projects and submit forms without valid requests being rejected as cross-site submissions on the production domains.

## [0.3.1.1] - 2026-09-07

### Changed

- Explain how weekly peer review and competition help builders push their progress further.
- Clarify leaderboard scoring and carry the same message into social link previews.

## [0.3.1.0] - 2026-09-07

### Changed

- Finish last week’s voting before publishing the next weekly update while voting remains open.
- Continue publishing when voting closes, no comparisons remain, or you are not eligible to vote.

## [0.3.0.0] - 2026-09-07

### Added

- Welcome emails and weekly check-in and voting reminders, with the mad.builders design and footer.
- Reminders that ask only for unfinished actions, with unsubscribe links and protection against duplicate sends.

### Changed

- Keep weekly updates on `/build` and rankings on `/leaderboard`.

## [0.2.0.0] - 2026-09-07

### Changed

- Write weekly updates one question at a time, with progress, previous and next controls, and optional skips.
- Keep the same questions, prefilled details, and browser drafts in the new form.

## [0.1.4.0] - 2026-09-07

### Changed

- Preview weekly share cards, edit captions, and choose X, LinkedIn, WhatsApp, or copy options from a compact popover.
- Download share images with the company description and logo, with initials when the logo is unavailable.
- Share the latest weekly update from a project profile, including the week and full progress in the caption.
- Find project links, feedback requests, and an invitation to publish your own update near the top of public results.

## [0.1.3.0] - 2026-09-07

### Changed

- Browse projects and weekly rankings 50 at a time, with previous and next pages.
- Load less project data when browsing rankings or reviewing pairs.

### Fixed

- Keep voting from building millions of possible pairs in large weeks.
- Finalize large weekly rankings in batches without exceeding database limits.
- Give four-digit ranks enough room on desktop and mobile.

## [0.1.2.1] - 2026-09-07

### Changed

- Replace the 404 page's siesta and tapas jokes with a clear page-not-found message.
- Ground the brand voice in entrepreneurs working to build businesses in Madrid.

## [0.1.1.0] - 2026-09-07

### Fixed

- Spread weekly voting more evenly across eligible participants.

## [0.1.0.1] - 2026-09-06

### Fixed

- Opening the leaderboard or weekly build page no longer locks the database week when its rankings are already finalized.

## [0.1.0.0] - 2026-09-05

### Added

- Create a public project profile, sign in with GitHub, and share your project or weekly progress.
- Publish weekly updates using the Pioneer questions, carry a goal into the next week, and keep unfinished drafts in your browser.
- Compare updates in pairs, pause and resume voting, and see provisional and final weekly rankings.
- Link supporting proof, including GitHub commits matched to your account.
- Hide or withdraw profiles and updates, with public pages and share images respecting visibility.
- Weekly schedules follow Madrid time automatically, including daylight-saving changes.

### Changed

- App pages lead with the leaderboard and use compact navigation, project favicons, and smaller headings.
- Weekly updates remain editable until voting opens. First updates do not ask builders to grade a goal they never set.

### Fixed

- Preserve drafts after an expired session and clear them after a successful publication.
- Keep saved votes consistent across retries and avoid reassigning invalidated pairs.
- Prevent late updates from creating goals for weeks already underway.
- Keep unpublished update text out of error logs and handle simultaneous rate-limit requests safely.
- Keep sessions on trailing-slash URLs, allow retries after GitHub sign-in errors, and return not-found pages for invalid week dates.
- Reject pending votes when the builder's update is no longer eligible.
- Show a useful message for taken handles and treat saves of hidden updates as successful.
- Keep local real-data voting separate from the demo through voting and leaderboard links.
- Enforce deadlines even when a save waits for the database, and prevent voting and moderation from blocking each other through conflicting locks.
- Show every public project in the directory, including projects beyond the first 48.
- Finish an unpublished earlier update after Monday rollover without changing the new week's goal.
- Only show provisional ranks when at least six projects are eligible.
- Open or submit voting while publishing without conflicting database locks.
- Keep active builders signed in by forwarding renewed session cookies to their browser.
- Show this week's goal on profiles during Monday voting, and label finalized results without a rank as unranked.
- Edit next week's goals until that week starts, even after the weekly update locks for voting.
- Make small labels, handles, dates, and scores easier to read with darker text.

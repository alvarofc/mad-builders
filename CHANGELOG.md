# Changelog

Changes to mad.builders.

## [0.4.0.0] - 2026-09-07

### Added

- Invite teammates to co-own a startup using single-use links that expire after seven days.
- Request access to an existing startup, approve teammates, and switch between shared projects.

### Changed

- Share one startup profile, weekly update, voting quota, and ranking across all owners.
- Keep existing project handles and history, record who edits updates, and base reminders on shared project activity.
- Prevent teammates from reviewing projects with overlapping owners and protect writes when switching projects.

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

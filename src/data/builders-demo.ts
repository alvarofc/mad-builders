import type { getLatestLeaderboard, getReviewState } from '../server/ranking';

// Fictional content for the development-only ?demo=1 preview. Never written to Postgres.
export const demoProjects = [
  { name: 'Taller', founder: 'Lucía', stage: 'private_testing', sentence: 'We help small workshops quote repairs from a photo.', goal: 'Get three workshops to send a real quote through the app.', summary: 'Four workshops sent 23 quotes. Two used it again without us asking. We cut quote creation from 12 minutes to 3, but photos of engine damage still need a phone call.', feedback: 'How would you price something a workshop uses a few times a day?' },
  { name: 'Miga', founder: 'Diego', stage: 'launched', sentence: 'A daily production planner for independent bakeries.', goal: 'Run a full week in two bakeries and measure food waste.', summary: 'Finished our first seven-day trial. One bakery cut unsold bread from 18% to 11%; the other saw no change. We added manual overrides after a rainy Tuesday broke our forecast.', feedback: 'Looking for a bakery willing to try this outside Madrid.' },
  { name: 'Cauce', founder: 'Sara', stage: 'building', sentence: 'Low-cost sensors that tell farmers when their soil needs water.', goal: 'Keep three sensors reporting outdoors for 72 hours.', summary: 'All three sensors survived the field test. Battery life is roughly nine days, short of our two-week target. Found the power leak in the radio and ordered parts for the next revision.', feedback: 'Has anyone weatherproofed a small enclosure without custom tooling?' },
  { name: 'Relevo', founder: 'Marcos', stage: 'launched', sentence: 'Shift handovers for care teams, with fewer messages getting lost.', goal: 'Launch voice notes and onboard a second care home.', summary: 'Voice notes are live. Eight carers used them across 34 handovers. The second care home postponed onboarding, so we spent Friday fixing the three issues the first team reported.', feedback: 'Does this need a separate manager view, or would a daily digest work?' },
  { name: 'Linde', founder: 'Nora', stage: 'private_testing', sentence: 'We help researchers find the source behind a claim.', goal: 'Test citation checking with five researchers.', summary: 'Ran five sessions. Three researchers caught a citation error they had missed. Two could not upload their PDFs. Fixed the upload limit, and learned that showing the exact source paragraph matters more than a confidence score.', feedback: 'Which research field spends the most time checking citations?' },
  { name: 'Brisa', founder: 'Pablo', stage: 'idea', sentence: 'A quieter way for remote teams to plan time together.', goal: 'Interview ten team leads before writing any more code.', summary: 'Spoke with seven team leads. Only two wanted another scheduling tool. Five kept bringing up the cost of finding a venue. We stopped building the calendar and are testing a venue shortlist by email.', feedback: 'Would you pay for the shortlist, or only after booking a space?' },
].map((project, index) => ({
  id: index + 1, userId: `demo-${index + 1}`, handle: `demo-${project.name.toLowerCase()}`,
  projectName: project.name, displayName: project.founder, projectUrl: null,
  projectSentence: project.sentence, projectStage: project.stage,
  promise: project.goal, summary: project.summary, feedbackRequest: project.feedback,
  status: index === 3 || index === 5 ? 'partial' : 'complete',
  proofUrl: null, proofStatus: 'self_reported',
}));

const now = new Date();
const demoWeek = {
  id: 0, weekStartDate: '2026-08-31', startsAt: new Date(now.getTime() - 7 * 86400000),
  submissionClosesAt: new Date(now.getTime() - 3600000), votingClosesAt: new Date(now.getTime() + 86400000),
  rankingStatus: 'final', finalizedAt: now, createdAt: now,
};
export const demoLeaderboard: NonNullable<Awaited<ReturnType<typeof getLatestLeaderboard>>> = {
  week: demoWeek, now, provisional: false,
  entries: demoProjects.map((project, index) => ({
    ...project, weekStartDate: demoWeek.weekStartDate, rank: index + 1,
    wins: 10 - index, ties: 0, decisions: 12, scoreNumerator: (10 - index) * 2, scoreDenominator: 24,
  })),
};

export function demoReview(rawRound: string | null): Awaited<ReturnType<typeof getReviewState>> {
  const parsed = Number(rawRound);
  const reviewed = Number.isInteger(parsed) ? Math.max(0, Math.min(10, parsed)) : 0;
  if (reviewed === 10) return { state: 'complete', week: demoWeek, reviewed };
  const pairs = demoProjects.flatMap((first, index) =>
    demoProjects.slice(index + 1).map((second) => ({ first, second })));
  return { state: 'pair', week: demoWeek, reviewed, assignmentId: reviewed + 1, ...pairs[reviewed] };
}

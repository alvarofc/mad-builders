// A few highlighted resident projects — keep this short on purpose.
// `logo` matches a file in src/assets/logos/projects/ (falls back to the name).
export interface Project {
  name: string;
  logo?: string;
  url: string;
  tagline: string;
}

export const projects: Project[] = [
  {
    name: 'María — hermet.ai',
    logo: 'hermet.svg',
    url: 'https://hermet.ai/',
    tagline:
      'An AI companion that calls elderly people every day for conversation and cognitive stimulation, alerting caregivers when something changes.',
  },
  {
    name: 'Dreamshot',
    logo: 'dreamshot.svg',
    url: 'https://www.dreamshot.io/',
    tagline:
      'An AI creative studio that generates, scores and publishes product imagery for brands. Hundreds of on-brand shots, no photoshoot.',
  },
  {
    name: 'Hawkings',
    logo: 'hawkings.avif',
    url: 'https://hawkings.education/',
    tagline:
      'An AI layer for learning platforms that handles automated grading with teacher oversight, personalized study spaces, and curriculum design at scale.',
  },
];

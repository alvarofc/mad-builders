// One entry per event. To add a new event: drop a folder of photos in
// src/assets/events/<slug>/ (with a cover.jpeg) and add an entry here.
export interface CommunityEvent {
  slug: string;
  title: string;
  date: string; // ISO
  luma: string;
  blurb?: string;
}

export const events: CommunityEvent[] = [
  {
    slug: 'company-brain',
    title: 'Building an AI Company Brain',
    date: '2026-06-11',
    luma: 'https://luma.com/kkp98uir',
    blurb: 'Hands-on session on wiring company knowledge into agents.',
  },
  {
    slug: 'techieclub',
    title: 'mad builders × techieclub café',
    date: '2026-05-16',
    luma: 'https://luma.com/s6q7bzcv',
    blurb: 'Coffee, demos and a packed house with techieclub.',
  },
  {
    slug: 'metabase',
    title: 'Sameer Al-Sakran (Metabase)',
    date: '2026-05-13',
    luma: 'https://luma.com/17g246ut',
    blurb: 'Fireside with the Metabase CEO on open source and data.',
  },
  {
    slug: 'causa-prima',
    title: 'Maex & Philip (Causa Prima)',
    date: '2026-05-12',
    luma: 'https://luma.com/ujkd7upq',
    blurb: 'A conversation with the Causa Prima founders.',
  },
  {
    slug: 'zero-to-agent',
    title: 'Zero to Agent',
    date: '2026-04-25',
    luma: 'https://luma.com/lxh33wab',
    blurb: 'Build an AI agent from scratch in one afternoon.',
  },
  {
    slug: 'ship-10x',
    title: 'Ship 10x: The AI-Native Dev Stack',
    date: '2026-04-22',
    luma: 'https://luma.com/48a8uek4',
    blurb: 'The tooling that lets small teams ship like big ones.',
  },
  {
    slug: 'gtm-hackathon',
    title: 'GTM Hackathon',
    date: '2026-04-15',
    luma: 'https://luma.com/9ulrsqir',
    blurb: 'One day to build your go-to-market machine.',
  },
  {
    slug: 'openclaw',
    title: 'OpenClaw: Beyond the Hype',
    date: '2026-04-08',
    luma: 'https://luma.com/0hfofmox',
    blurb: 'What personal AI agents are actually good for, live.',
  },
  {
    slug: 'adeyemi',
    title: 'Adeyemi Ajao (Base10, Tuenti)',
    date: '2026-02-26',
    luma: 'https://luma.com/1622yu92',
    blurb: 'Fireside with the Base10 co-founder and Tuenti alum.',
  },
  {
    slug: 'revenuecat',
    title: 'Miguel Carranza (RevenueCat)',
    date: '2025-12-18',
    luma: 'https://luma.com/gem6u4es',
    blurb: 'Scaling engineering at RevenueCat, from Madrid.',
  },
];

// Companies we have co-hosted events with.
export const cohosts = ['lovable', 'cursor', 'vercel', 'metabase', 'revenuecat', 'clawcon'];

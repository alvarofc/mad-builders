// One entry per event. To add a new event: drop a folder of photos in
// src/assets/events/<slug>/ (with a cover.jpeg) and add an entry here.
//
// This is the SINGLE source of truth for mad.builders' own events. It powers
// the home-page past-events grid AND the /madrid calendar widget — `madrid.astro`
// reads this list, tags each entry `madbuilders: true`, and merges it with the
// external (other communities') events in `calendar.ts`. So you only edit one
// place: add the event here and it shows up in both.
//
// The cover for the calendar is resolved automatically from
// src/assets/events/<slug>/cover.jpeg, so no separate image path is needed.
//
// Adding an event from a link: see the "Adding an event from just a link"
// workflow in `calendar.ts`. Same inference applies here — read the event page,
// write `blurb` as a 1–2 sentence summary in the event's own language (it
// doubles as the calendar description), backfill `time`/`endTime`/`location`,
// and set `private: true` for invite-only / approval-required events.
export interface CommunityEvent {
  slug: string;
  title: string;
  date: string; // ISO 'YYYY-MM-DD' (local Madrid date)
  luma: string;
  blurb?: string; // doubles as the calendar event's description
  // The fields below feed the /madrid calendar widget (all optional).
  time?: string; // 'HH:MM' 24h, Madrid local — start
  endTime?: string; // 'HH:MM' 24h, Madrid local
  location?: string; // venue / area
  private?: boolean; // invite-only event — flagged in the calendar
}

export const events: CommunityEvent[] = [
  {
    slug: 'company-brain',
    title: 'Building an AI Company Brain',
    date: '2026-06-11',
    time: '15:00',
    endTime: '16:30',
    location: 'Plaza del Callao, Centro',
    luma: 'https://luma.com/kkp98uir',
    blurb: 'Hands-on session on wiring company knowledge into agents.',
  },
  {
    slug: 'techieclub',
    title: 'mad builders × techieclub café',
    date: '2026-05-16',
    time: '09:00',
    endTime: '18:00',
    luma: 'https://luma.com/s6q7bzcv',
    blurb: 'Coffee, demos and a packed house with techieclub.',
  },
  {
    slug: 'metabase',
    title: 'Sameer Al-Sakran (Metabase)',
    date: '2026-05-13',
    time: '18:00',
    endTime: '20:00',
    luma: 'https://luma.com/17g246ut',
    blurb: 'Fireside with the Metabase CEO on open source and data.',
  },
  {
    slug: 'causa-prima',
    title: 'Maex & Philip (Causa Prima)',
    date: '2026-05-12',
    time: '19:30',
    endTime: '22:30',
    luma: 'https://luma.com/ujkd7upq',
    blurb: 'A conversation with the Causa Prima founders.',
  },
  {
    slug: 'zero-to-agent',
    title: 'Vercel: Zero to Agent',
    date: '2026-04-25',
    time: '18:00',
    endTime: '21:00',
    location: 'Plaza del Callao, Centro',
    luma: 'https://luma.com/lxh33wab',
    blurb: 'Build an AI agent from scratch in one afternoon.',
  },
  {
    slug: 'ship-10x',
    title: 'Ship 10x: The AI-Native Dev Stack',
    date: '2026-04-22',
    time: '18:00',
    endTime: '20:30',
    luma: 'https://luma.com/48a8uek4',
    blurb: 'The tooling that lets small teams ship like big ones.',
  },
  {
    slug: 'gtm-hackathon',
    title: 'Lovable: GTM Hackathon',
    date: '2026-04-15',
    time: '18:00',
    endTime: '21:00',
    location: 'Plaza del Callao, Centro',
    luma: 'https://luma.com/9ulrsqir',
    blurb: 'One day to build your go-to-market machine.',
  },
  {
    slug: 'openclaw',
    title: 'OpenClaw: Beyond the Hype',
    date: '2026-04-08',
    time: '19:00',
    endTime: '21:30',
    location: 'Plaza del Callao, Centro',
    luma: 'https://luma.com/0hfofmox',
    blurb: 'What personal AI agents are actually good for, live.',
  },
  {
    slug: 'adeyemi',
    title: 'Adeyemi Ajao (Base10, Tuenti)',
    date: '2026-02-26',
    time: '18:30',
    endTime: '20:30',
    luma: 'https://luma.com/1622yu92',
    blurb: 'Fireside with the Base10 co-founder and Tuenti alum.',
  },
  {
    slug: 'revenuecat',
    title: 'Miguel Carranza (RevenueCat)',
    date: '2025-12-18',
    time: '19:00',
    endTime: '22:30',
    luma: 'https://luma.com/gem6u4es',
    blurb: 'Scaling engineering at RevenueCat, from Madrid.',
  },
];

// Companies we have co-hosted events with. `name` matches the logo file in
// src/assets/logos/friends/<name>.svg
export interface Cohost {
  name: string;
  url: string;
}

export const cohosts: Cohost[] = [
  { name: 'lovable', url: 'https://lovable.dev/' },
  { name: 'cursor', url: 'https://cursor.com/' },
  { name: 'vercel', url: 'https://vercel.com/' },
  { name: 'metabase', url: 'https://www.metabase.com/' },
  { name: 'revenuecat', url: 'https://www.revenuecat.com/' },
  { name: 'clawcon', url: 'https://www.claw-con.com/' },
];

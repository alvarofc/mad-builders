// Madrid ecosystem data for the /madrid page. All of this is a starter set —
// edit freely. Map coordinates are approximate (neighborhood-level); verify
// before relying on them.

// The Communities section is a list of featured "spotlight" lines: hubs and
// communities worth highlighting. `kind` drives the accent colour. Each row
// shows a small thumbnail: a banner cover from public/communities/, or a logo
// from public/map/ rendered on a tinted panel when `logo: true`. (One-off events
// live in the calendar, see calendar.ts.)
export interface Spotlight {
  name: string;
  kind: 'hub' | 'community';
  what: string;
  image: string;
  logo?: boolean; // true → centre the image on a tinted panel (for logos, not banners)
  url: string;
}

export const spotlights: Spotlight[] = [
  {
    name: 'Mad Tech Campus',
    kind: 'hub',
    what: '20+ startups, Tetuan Valley and SeedRocket sharing one roof in Matadero.',
    image: '/map/madtechcampus.png',
    logo: true,
    url: 'https://www.madtechcampus.com/',
  },
  {
    name: 'Pitchless',
    kind: 'community',
    what: 'A 1,000+ strong founder community for people who value shipping over titles. Buildathons, GTM sprints and roundtable dinners, no pitch decks required.',
    image: '/communities/pitchless.jpg',
    url: 'https://luma.com/pitchless.community',
  },
];

// Map categories: 'company' | 'vc' | 'hub' (Companies / VCs / Hubs & Coworking).
// Each category has a colour in global.css (--map-company / --map-vc / --map-hub)
// used for the legend swatch and the marker. A spot can carry a `logo` (path in
// /public): when present the marker becomes that logo in a circle, ringed in the
// category colour. Without a logo it falls back to a plain coloured dot.
export type SpotKind = 'company' | 'vc' | 'hub';

export interface Spot {
  name: string;
  kind: SpotKind;
  note: string;
  // Omit lat/lng when a spot has no fixed address. Those are auto-arranged in a
  // fan around the map centre at render time so they don't stack on each other.
  lat?: number;
  lng?: number;
  logo?: string; // optional logo (e.g. '/map/maisa.png') — renders inside the marker
  url?: string; // optional website — shown as a globe icon in the popup
  twitter?: string; // optional X/Twitter URL — shown as an X icon in the popup
}

export const spots: Spot[] = [
  // companies
  {
    name: 'Maisa AI',
    kind: 'company',
    note: 'Maisa is how enterprises automate their most critical processes with hallucination-resistant Digital Workers',
    lat: 40.4471,
    lng: -3.6919,
    logo: '/map/maisa.png',
    url: 'https://maisa.ai/',
    twitter: 'https://twitter.com/maisaAI_',
  },
  {
    name: 'HappyRobot',
    kind: 'company',
    note: 'AI voice agents that automate calls and operations for logistics and freight',
    lat: 40.4307,
    lng: -3.6972,
    logo: '/map/happyrobot.svg',
    url: 'https://www.happyrobot.ai/',
    twitter: 'https://x.com/happyrobot',
  },
  {
    name: 'Sierra AI',
    kind: 'company',
    note: 'Conversational AI agents for customer experience',
    lat: 40.4536,
    lng: -3.6927,
    logo: '/map/sierra.svg',
    url: 'https://sierra.ai/',
    twitter: 'https://x.com/sierraplatform',
  },
  {
    name: 'Celonis',
    kind: 'company',
    note: 'Process mining and process intelligence for enterprises',
    lat: 40.4485,
    lng: -3.694,
    logo: '/map/celonis.png',
    url: 'https://www.celonis.com/',
    twitter: 'https://twitter.com/Celonis',
  },
  {
    name: 'Tinybird',
    kind: 'company',
    note: 'Real-time data platform for building analytics APIs at scale',
    lat: 40.4306,
    lng: -3.691,
    logo: '/map/tinybird.png',
    url: 'https://www.tinybird.co/',
    twitter: 'https://x.com/tinybird',
  },
  {
    name: 'Manfred',
    kind: 'company',
    note: 'Developer-first tech recruitment, no spam',
    lat: 40.4895,
    lng: -3.6876,
    logo: '/map/manfred.png',
    url: 'https://www.getmanfred.com/',
    twitter: 'https://x.com/getmanfred',
  },
  {
    name: 'Causa Prima',
    kind: 'company',
    note: 'An agent-to-agent network for finance teams: invoicing, disputes and discounts',
    logo: '/map/causa-prima.svg',
    url: 'https://causaprima.ai/',
    twitter: 'https://x.com/causaprimaai',
  },
  {
    name: 'Legora',
    kind: 'company',
    note: 'Collaborative AI for lawyers: review documents, run research and draft faster',
    logo: '/map/legora.png',
    url: 'https://legora.com/',
    twitter: 'https://x.com/WeAreLegora',
  },
  {
    name: 'Carto',
    kind: 'company',
    note: 'Location intelligence platform for spatial analysis and maps',
    lat: 40.4491,
    lng: -3.6966,
    logo: '/map/carto.png',
    url: 'https://carto.com/',
    twitter: 'https://twitter.com/CARTO',
  },
  {
    name: 'Capchase',
    kind: 'company',
    note: 'AI-powered financing so software vendors get paid upfront while buyers pay over time',
    lat: 40.466,
    lng: -3.6793,
    logo: '/map/capchase.png',
    url: 'https://www.capchase.com/',
    twitter: 'https://x.com/Capchase',
  },
  {
    name: 'OpenAI',
    kind: 'company',
    note: 'Frontier AI research and the company behind ChatGPT and the API',
    logo: '/map/openai.png',
    url: 'https://openai.com/',
    twitter: 'https://x.com/OpenAI',
  },
  // hubs & coworking
  {
    name: 'mad.builders',
    kind: 'hub',
    note: "The builders' house, where builders, founders and VCs meet in the heart of Madrid, hosted by Samplia",
    lat: 40.42,
    lng: -3.7058,
    logo: '/logo/mad-builders-icon.svg',
    url: 'https://mad.builders',
  },
  {
    name: 'Mad Tech Campus',
    kind: 'hub',
    note: 'New hub gathering 20+ startups, Tetuan Valley and SeedRocket under one roof',
    lat: 40.392187,
    lng: -3.699063,
    logo: '/map/madtechcampus.png',
    url: 'https://www.madtechcampus.com/',
  },
  {
    name: 'Osom House',
    kind: 'hub',
    note: 'Specialty espresso bar in Chamberí, laptop-friendly on weekends',
    lat: 40.4342142,
    lng: -3.6992444,
    logo: '/map/osom.png',
    url: 'https://somososom.com/es/',
  },
  // VCs with Madrid offices
  {
    name: 'Tetuan Valley',
    kind: 'vc',
    note: 'The OG pre-accelerator of the Madrid startup scene, based at Mad Tech Campus',
    // Same building as Mad Tech Campus; offset east so the two markers don't overlap.
    lat: 40.392187,
    lng: -3.6925,
    logo: '/map/tetuan-valley.png',
    url: 'https://tetuanvalley.com/',
    twitter: 'https://x.com/tetuanvalley',
  },
  {
    name: 'Samaipata',
    kind: 'vc',
    note: 'Seed VC backing digital platform and marketplace founders across Europe',
    lat: 40.4207,
    lng: -3.6905,
    logo: '/map/samaipata.png',
    url: 'https://www.samaipata.vc/',
    twitter: 'https://x.com/samaipatavc',
  },
  {
    name: 'Kfund',
    kind: 'vc',
    note: 'Early stage VC backing technology founders from Southern Europe to the world',
    lat: 40.4328,
    lng: -3.685,
    logo: '/map/kfund.png',
    url: 'https://www.kfund.vc/',
    twitter: 'https://x.com/Kfundvc',
  },
  {
    name: 'JME Ventures',
    kind: 'vc',
    note: 'Seed Stage VC for companies building next world-class solutions. Investing from €100k to €3m in Spain\'s next success stories.',
    lat: 40.4178,
    lng: -3.6924,
    logo: '/map/jme.png',
    url: 'https://www.jme.vc/',
    twitter: 'https://x.com/JME_Ventures',
  },
  {
    name: 'Acurio Ventures',
    kind: 'vc',
    note: 'Early stage European deep tech VC, based in Bilbao with a Madrid office',
    lat: 40.4506,
    lng: -3.6918,
    logo: '/map/acurio.png',
    url: 'https://www.acurio.vc/',
    twitter: 'https://x.com/AcurioVentures',
  },
  {
    name: 'Kibo Ventures',
    kind: 'vc',
    note: 'Early stage tech VC, one of Spain\'s most active funds',
    lat: 40.4412,
    lng: -3.6925,
    logo: '/map/kibo.png',
    url: 'https://www.kiboventures.com/',
    twitter: 'https://x.com/KiboVentures',
  },
  {
    name: 'Backfund',
    kind: 'vc',
    note: 'Seed stage deep tech VC backed by a network of operators',
    lat: 40.4205,
    lng: -3.696,
    logo: '/map/backfund.png',
    url: 'https://www.backfund.vc/',
    twitter: 'https://x.com/BackFund',
  },
];

export interface Stat {
  value: string;
  label: string;
  detail: string;
}

// Figures verified against Startup Radar madri+d reports produced with
// Dealroom.co. Update the citations if you swap any number.
export const stats = [
  {
    value: '€1.2B',
    label: 'Invested in 2025',
    detail: 'Madrid led Spain on total funding volume in 2025.',
  },
  {
    value: '+97%',
    label: 'funding growth',
    detail: 'Startups nearly doubled their funding over the previous year, across 120 announced transactions.',
  },
  {
    value: '#4',
    label: 'European hub for deeptech startups',
    detail: 'Behind London, Paris and Berlin.',
  },
] satisfies Stat[];

export const statsSources = [
  {
    label: 'Startup Radar madri+d Report 2026',
    url: 'https://www.madrimasd.org/sites/default/files/Startup_Radar_madri%2Bd.pdf',
  },
  {
    label: 'Madrid Region Venture Capital and Investments in 2025',
    url: 'https://www.madrimasd.org/sites/default/files/startup_radar_inversion_cm.pdf',
  },
];

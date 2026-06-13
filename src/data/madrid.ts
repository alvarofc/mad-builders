// Madrid ecosystem data for the /madrid page. All of this is a starter set —
// edit freely. Map coordinates are approximate (neighborhood-level); verify
// before relying on them.

export interface MadridCommunity {
  name: string;
  what: string;
  url?: string;
}

export const madridCommunities: MadridCommunity[] = [
  {
    name: 'techieclub',
    what: 'Casual builder cafés and meetups. We co-hosted one — it was packed.',
  },
  {
    name: 'OpenClaw Madrid',
    what: 'The local community around personal AI agents.',
    url: 'https://luma.com/calendar/cal-K0Vtx5HOYvR4xHB',
  },
  {
    name: 'Mad Tech Campus',
    what: 'New hub with 20+ startups, Tetuan Valley and SeedRocket under one roof.',
  },
  {
    name: 'Tetuan Valley',
    what: 'The OG pre-accelerator of the Madrid ecosystem.',
    url: 'https://tetuanvalley.com/',
  },
];

export type SpotKind = 'cafe' | 'vc' | 'hub';

export interface Spot {
  name: string;
  kind: SpotKind;
  note: string;
  lat: number;
  lng: number;
}

export const spots: Spot[] = [
  // cafés & coworks people actually work from
  { name: 'La Bicicleta Café', kind: 'cafe', note: 'Malasaña laptop classic', lat: 40.4255, lng: -3.7037 },
  { name: 'HanSo Café', kind: 'cafe', note: 'Specialty coffee, Malasaña', lat: 40.4243, lng: -3.7045 },
  { name: 'Federal Café', kind: 'cafe', note: 'Brunch + laptops, Conde Duque', lat: 40.4271, lng: -3.7102 },
  // hubs & spaces
  { name: 'Impact Hub Madrid', kind: 'hub', note: 'Coworking network, several locations', lat: 40.4092, lng: -3.6934 },
  { name: 'Wayra Madrid', kind: 'hub', note: "Telefónica's open innovation hub, Gran Vía", lat: 40.4203, lng: -3.7058 },
  // VCs with Madrid offices
  { name: 'Kfund', kind: 'vc', note: 'Early-stage VC', lat: 40.4262, lng: -3.6889 },
  { name: 'Samaipata', kind: 'vc', note: 'Pan-European seed VC', lat: 40.4283, lng: -3.684 },
  { name: 'Seaya Ventures', kind: 'vc', note: 'Growth VC (Cabify, Glovo, Wallbox)', lat: 40.4286, lng: -3.6877 },
  { name: 'JME Ventures', kind: 'vc', note: 'Seed VC (Flywire, Jobandtalent)', lat: 40.4339, lng: -3.6863 },
];

// Figures verified against the Startup Radar madri+d Investment Report 2026
// (January 2026), produced by Fundación para el Conocimiento madri+d with
// Dealroom.co. Update the citation if you swap any number.
export const stats = [
  { value: '€1.2B', label: 'venture capital into Madrid startups in 2025 — more than Barcelona' },
  { value: '+97%', label: 'vs 2024 — the strongest funding year in years' },
  { value: '#7', label: 'in Europe by number of VC-backed companies (all-time)' },
];

export const statsSource = {
  label: 'Startup Radar madri+d Investment Report 2026 (madri+d × Dealroom)',
  url: 'https://www.madrimasd.org/en/emprendedores/startup-radar-madrid',
};

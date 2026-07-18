// Sister communities and hubs around the world.
// `logo` matches a file in src/assets/logos/sisters/ (omit it to show the name
// as text). `url` makes the tile clickable. `flag` matches a local SVG in
// public/flags/ and appears in the tile's top-right corner.
export interface Sister {
  name: string;
  logo?: string;
  url?: string;
  flag?: string; // ISO 3166-1 alpha-2 code, e.g. 'es'
  // `ink: true` forces the logo to a flat dark silhouette — use it only for
  // white/very-light logos that would vanish on the white tile. Logos with
  // their own color or knockout detail (e.g. Frontier Tower) should stay
  // natural, otherwise the detail gets flattened away.
  ink?: boolean;
}

export const sisters: Sister[] = [
  { name: 'Startup Embassy', logo: 'startup_embassy.png', url: 'https://www.startupembassy.com/', flag: 'us', ink: true },
  { name: 'Frontier Tower', logo: 'frontier_tower.svg', url: 'https://frontiertower.io/', flag: 'us' },
  { name: 'The Mu', logo: 'the-mu.svg', url: 'https://mushanghai.xyz/', flag: 'cn', ink: true },
  { name: 'Crecimiento', logo: 'crecimiento.svg', url: 'https://www.crecimiento.build/', flag: 'ar' },
  { name: 'Andén', logo: 'anden.svg', url: 'https://www.anden.tech/', flag: 'ar' },
  { name: 'Exponential', logo: 'exponential.svg', url: 'https://www.goexponential.org/', flag: 'es', ink: true },
  { name: '706 Youth Space', logo: '706_youth_space.jpg', url: 'https://x.com/Labs706', flag: 'cn' },
  { name: 'Nonce', logo: 'nonce.png', url: 'https://nonce.community/', flag: 'kr', ink: true },
  { name: 'Xiji Incubator', logo: 'xiji_incubator.jpg', url: 'https://www.xijiincubator.com/', flag: 'cn' },
  { name: 'Urbe', logo: 'urbe.svg', url: 'https://urbe.build/', flag: 'it' },
];

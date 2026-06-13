// Sister communities and hubs around the world.
// `logo` matches a file in src/assets/logos/sisters/ (omit it to show the name
// as text). `url` makes the tile clickable. `flag` is an emoji shown in the
// tile's top-right corner.
export interface Sister {
  name: string;
  logo?: string;
  url?: string;
  flag?: string; // emoji flag, e.g. '🇪🇸'
  // `ink: true` forces the logo to a flat dark silhouette — use it only for
  // white/very-light logos that would vanish on the white tile. Logos with
  // their own color or knockout detail (e.g. Frontier Tower) should stay
  // natural, otherwise the detail gets flattened away.
  ink?: boolean;
}

export const sisters: Sister[] = [
  { name: 'Startup Embassy', logo: 'startup_embassy.png', flag: '🇺🇸', ink: true },
  { name: 'Frontier Tower', logo: 'frontier_tower.svg', flag: '🇺🇸' },
  { name: 'The Mu', logo: 'the-mu.svg', flag: '🇨🇳', ink: true },
  { name: 'Crecimiento', logo: 'crecimiento.svg', flag: '🇦🇷' },
  { name: 'Andén', logo: 'anden.svg', flag: '🇦🇷' },
  { name: 'Exponential', logo: 'exponential.svg', flag: '🇪🇸', ink: true },
  { name: '706 Youth Space', logo: '706_youth_space.jpg', flag: '🇨🇳' },
  { name: 'Nonce', logo: 'nonce.png', flag: '🇰🇷', ink: true },
  { name: 'Xiji Incubator', logo: 'xiji_incubator.jpg', flag: '🇨🇳' },
  { name: 'Urbe', logo: 'urbe.svg', url: 'https://urbe.build/', flag: '🇮🇹' },
];

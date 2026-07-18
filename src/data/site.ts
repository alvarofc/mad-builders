export const externalLinks = {
  whatsapp: 'https://chat.whatsapp.com/HvbO3AbATu53tUvHF53q84',
  x: 'https://x.com/madbuilders_',
  linkedin: 'https://www.linkedin.com/company/madbuilders',
  luma: 'https://luma.com/madbuilders',
} as const;

// Central config for links. `icon` matches a file in src/assets/logos/socials/.
export const site = {
  name: 'mad.builders',
  domain: 'https://mad.builders',
  description:
    'The builders\' house, where builders, founders and VCs meet in the heart of Madrid. AI, hardware & robotics, healthtech, digital assets.',

  whatsapp: externalLinks.whatsapp,
  lumaCalendar: externalLinks.luma,

  // Footer links.
  socials: [
    { label: 'whatsapp', icon: 'whatsapp', url: externalLinks.whatsapp },
    { label: 'x', icon: 'x', url: externalLinks.x },
    { label: 'linkedin', icon: 'linkedin', url: externalLinks.linkedin },
    { label: 'luma', icon: 'luma', url: externalLinks.luma },
  ],

  focus: ['ai', 'hardware & robotics', 'healthtech', 'digital assets'],
};

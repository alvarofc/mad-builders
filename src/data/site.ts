// Central config for links. `icon` matches a file in src/assets/logos/socials/.
export const site = {
  name: 'mad builders',
  domain: 'https://mad.builders',
  description:
    'The builders\' house — where builders, founders and VCs meet in the heart of Madrid. AI, hardware & robotics, biotech & longevity, digital assets.',

  whatsapp: 'https://chat.whatsapp.com/HvbO3AbATu53tUvHF53q84',
  lumaCalendar: 'https://luma.com/madbuilders',
  lumaEmbed: '', // e.g. https://lu.ma/embed/calendar/cal-XXXX/events — shows an embedded calendar on /madrid when set

  // Until we have our own profiles, these point at the platforms themselves.
  socials: [
    { label: 'whatsapp', icon: 'whatsapp', url: 'https://chat.whatsapp.com/HvbO3AbATu53tUvHF53q84' },
    { label: 'x', icon: 'x', url: 'https://x.com' },
    { label: 'instagram', icon: 'instagram', url: 'https://www.instagram.com' },
    { label: 'youtube', icon: 'youtube', url: 'https://www.youtube.com' },
    { label: 'linkedin', icon: 'linkedin', url: 'https://www.linkedin.com' },
    { label: 'rednote', icon: 'rednote', url: 'https://www.xiaohongshu.com' },
    { label: 'wechat', icon: 'wechat', url: 'https://www.wechat.com' },
  ],

  focus: ['ai', 'hardware & robotics', 'biotech & longevity', 'digital assets'],
};

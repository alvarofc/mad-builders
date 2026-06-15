// Central config for links. `icon` matches a file in src/assets/logos/socials/.
export const site = {
  name: 'mad builders',
  domain: 'https://mad.builders',
  description:
    'The builders\' house, where builders, founders and VCs meet in the heart of Madrid. AI, hardware & robotics, healthtech, digital assets.',

  whatsapp: 'https://chat.whatsapp.com/HvbO3AbATu53tUvHF53q84',
  lumaCalendar: 'https://luma.com/madbuilders',
  lumaEmbed: '', // e.g. https://lu.ma/embed/calendar/cal-XXXX/events — shows an embedded calendar on /madrid when set

  // Footer brand icons. Shown but NOT linked for now (no real profile URLs
  // yet). Add a `url` to one and it becomes a link again — see Layout.astro.
  socials: [
    { label: 'whatsapp', icon: 'whatsapp', url: 'https://chat.whatsapp.com/HvbO3AbATu53tUvHF53q84' },
    { label: 'x', icon: 'x' },
    { label: 'instagram', icon: 'instagram' },
    { label: 'youtube', icon: 'youtube' },
    { label: 'linkedin', icon: 'linkedin' },
    { label: 'rednote', icon: 'rednote' },
    { label: 'wechat', icon: 'wechat' },
  ],

  focus: ['ai', 'hardware & robotics', 'healthtech', 'digital assets'],
};

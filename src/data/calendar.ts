// External and calendar-only events shown in the /madrid calendar. Our own
// events normally come from `events.ts`, the single source of truth for entries
// that should appear both here and on the home page. `madrid.astro` merges both
// lists and resolves the covers for entries from `events.ts`. So:
//
//   • mad.builders event for home + calendar: edit `events.ts` only.
//   • External or calendar-only event: add a block below.
//   • Calendar-only mad.builders event: set `madbuilders: true` below.
//
// The week view always starts on Monday of the current week (computed in the
// browser), so you never need to move the window forward; you only add or remove
// events. The merge + sort happens in `madrid.astro`.
//
// ── Adding an event from just a link (Luma / Meetup / Culpass / …) ────────────
// Read the event page and fill the entry by inference. Don't ask for each field.
//   1. Add mad.builders events to `events.ts` unless they must stay off the home
//      page. Calendar-only events go below, with `madbuilders: true` when ours.
//   2. Pull date, start/end time (convert to Madrid local), and location.
//   3. Save the cover image to public/events/<slug>.jpg and reference it as
//      '/events/<slug>.jpg'. For Luma, use the original cover asset under
//      `/uploads/`, never the generated `/event-social/` Open Graph image.
//      Inspect the saved image before continuing. Strip personal invite tokens
//      from `url` (e.g. Luma's '?tk=...').
//   4. `description`: write a 1–2 sentence summary of the event in its OWN
//      language (es/en) — don't paste the full blurb. No em-dashes (house style).
//   5. `private: true` only if the event is explicitly private, invite-only or
//      restricted to a closed group. Approval, a waitlist or a full event do
//      not make it private. When genuinely unsure, leave it off.
// The same inference applies to our events in `events.ts` (summary + private).
//
// Field notes:
//   • `date`        local Madrid date, 'YYYY-MM-DD'.
//   • `time`/`endTime`  24h 'HH:MM', Madrid local. Omit `time` for an all-day entry.
//   • `url`         makes the entry clickable (opens the detail modal → "View event").
//   • `image`       cover shown in the modal + week card. For external events use a
//                   path under /public (e.g. '/events/foo.jpg') or an absolute URL.
//   • `description` short summary shown in the modal.
//   • `madbuilders` filled green treatment. Set it here only for calendar-only
//                   mad.builders events. Events from `events.ts` get it automatically.
//   • `private`     private or invite-only event, shown with a "private" marker.
export interface CalendarEvent {
  title: string;
  date: string; // 'YYYY-MM-DD' (local Madrid date)
  time?: string; // 'HH:MM' 24h, optional
  endTime?: string; // 'HH:MM' 24h, optional
  location?: string;
  url?: string; // luma or other link; makes the entry clickable
  image?: string; // optional cover image (path in /public or absolute URL)
  description?: string; // short summary shown in the event modal
  madbuilders?: boolean; // one of our events — gets the filled green treatment
  private?: boolean; // invite-only event — shown with a "private" marker
}

export const calendarEvents: CalendarEvent[] = [
  {
    title: 'AI Monkeys Sessions #1',
    date: '2026-06-17',
    time: '18:00',
    endTime: '20:30',
    location: 'eito, Chamberí',
    url: 'https://luma.com/oznc3upm',
    image: '/events/ai-monkeys-sessions-1.jpg',
    description:
      'Melina y Deyan, del equipo de Engineering de The Agile Monkeys (AI studio y partner de Anthropic), cuentan lo que aprendieron al certificarse en la Claude Certified Architect Foundations: buenas prácticas para construir aplicaciones con agentes, Claude Code y MCPs, prompt engineering y gestión de contexto.',
  },
  {
    title: 'The PM to Founder Journey',
    date: '2026-06-17',
    time: '19:00',
    endTime: '21:00',
    location: 'Celonis Office, Tetuán',
    url: 'https://www.meetup.com/producttank-madrid/events/315027257/',
    image: '/events/pm-to-founder-journey.jpg',
    description:
      'A ProductTank Madrid session on the real move from product manager to founder. Patrick and Ernesto share why they left, which product skills carried over and which did not, and the trade-offs and lessons they hit along the way.',
  },
  {
    title: 'AI-in-the-Middle MLOps',
    date: '2026-06-18',
    time: '18:30',
    endTime: '20:00',
    location: 'International Lab, Bailén',
    url: 'https://www.meetup.com/ml-with-flow/events/314557094/',
    image: '/events/ai-in-the-middle-mlops.jpg',
    description:
      'An ML with Flow meetup on building reliable ML and GenAI systems. Carlos Rosado (dLocal) walks through their MLOps architecture, using an AI assistant to move models from SageMaker to Databricks, and embedding intelligence across the model lifecycle, from experimentation to monitoring and governance.',
  },
  {
    title: 'Construyendo sin filtros #14',
    date: '2026-06-24',
    time: '18:30',
    endTime: '21:00',
    location: 'Aticco Castellana, Chamartín',
    url: 'https://app.culpass.com/es/event/construyendo-sin-filtros-14-las-verdades-incomodas-de-emprender_24-06-2026',
    image: '/events/construyendo-sin-filtros-14.jpg',
    description:
      'Charla de Startup Grind Madrid sobre las verdades incómodas de emprender. Javier Jiménez Rueda (Dreamshot) y Cristina e Inés Queipo de Llano (THE Q CLUB) hablan sin filtros de decisiones difíciles, sacrificios, gestión de la presión y lo que cambiarían si empezaran hoy.',
  },
  {
    title: '#Codemeet Madrid: Agentic Thinking for Humans',
    date: '2026-06-25',
    time: '18:30',
    endTime: '21:30',
    location: 'Celonis Office, Tetuán',
    url: 'https://www.meetup.com/codemotion-espana/events/315115918',
    image: '/events/codemeet-agentic-thinking.webp',
    description:
      'A Codemotion meetup with Ángel Mora (Data & AI Architect) on the human skills that stay valuable in an agentic world: systems thinking, adaptability, critical analysis, communication and continuous learning. The question is no longer how to build better agents, but how to stay essential alongside them.',
  },
  {
    title: 'El Latido de tu Startup — book launch',
    date: '2026-06-25',
    time: '19:00',
    endTime: '21:00',
    location: 'Pérez-Llorca, Castellana',
    url: 'https://luma.com/gfm4t9mq',
    image: '/events/el-latido-de-tu-startup.jpg',
    private: true,
    description:
      'Presentación del libro con Miguel Arias y Javier de la Torre, moderada por Sofía Benjumea: lecciones reales de construir y escalar startups, más allá de los casos teóricos. Evento solo por invitación, seguido de un vino español.',
  },
  {
    title: 'REFUGIO Madrid 2026',
    date: '2026-06-27',
    location: 'Mad Tech Campus, Matadero',
    url: 'https://refugiomadrid.com/',
    image: '/events/refugio.jpg',
    description:
      'Encuentro de un día en Mad Tech Campus para juntar al talento técnico de España: charlas de investigadores y devs por la mañana, un hackathon de cinco horas con herramientas de IA y, por la tarde, conversación con founders e inversores. Sin sponsors pasivos.',
  },
  {
    title: 'OpenAI Ads Tech Breakfast',
    date: '2026-07-01',
    time: '09:30',
    endTime: '11:30',
    location: 'Adsmurai, Chamberí',
    url: 'https://luma.com/m8rsb1ow',
    image: '/events/openai-ads-tech-breakfast.jpg',
    description:
      'Desayuno ejecutivo de Adsmurai sobre cómo preparar tu marca para la publicidad conversacional: las nuevas capacidades de OpenAI Ads dentro de ChatGPT, aprendizajes de campañas reales y una estrategia de activación, medición y visibilidad en IA generativa, con un ingeniero senior de OpenAI.',
  },
  {
    title: 'Club Tech × Finanzas para founders: automatiza tus finanzas con Claude',
    date: '2026-07-02',
    time: '12:30',
    endTime: '13:30',
    location: 'Mad Tech Campus, Matadero',
    url: 'https://luma.com/hy850f1f',
    image: '/events/club-tech-finanzas-founders.jpg',
    description:
      'Taller de Tetuan Valley y Mad Tech Campus sobre cómo automatizar las finanzas de tu startup sin vivir en hojas de cálculo. Iñigo enseña en directo cómo Mad Tech lo hace con Claude, de los tickets al reporting, y APTKI resuelve las dudas financieras de los asistentes.',
  },
  {
    title: 'Madrid Fintech Community | August Meetup',
    date: '2026-08-27',
    time: '18:30',
    endTime: '22:00',
    location: 'Hotel Urban, Centro',
    url: 'https://luma.com/o08wbp3i',
    image: '/events/madrid-fintech-community-august-meetup.jpg',
    description:
      'An informal rooftop meetup for fintech founders, banking leaders, operators, investors and ecosystem builders from across Spain and Europe. No panels or pitches, just drinks and conversation at Hotel Urban.',
  },
  {
    title: 'Out in Tech after work',
    date: '2026-08-27',
    time: '20:00',
    endTime: '22:00',
    location: 'Doce Botellas, Chueca',
    url: 'https://www.meetup.com/es-es/out-in-tech-madrid/events/311781958/',
    image: '/events/out-in-tech-monthly-mixer.jpg',
    description:
      'Copas de final de mes para que la comunidad LGBTQ+ de tecnología en Madrid se conozca y conecte. El encuentro es en Doce Botellas, en Chueca.',
  },
  {
    title:
      'Beyond The Prompt | Maex Arment (Causa Prima) & Carlos Riquelme (Microsoft AI) & Alejandro Vidal (Mindmakers)',
    date: '2026-09-01',
    time: '18:30',
    endTime: '21:30',
    location: 'Mad Tech Campus, Matadero',
    url: 'https://luma.com/e1vxqvq8',
    image: '/events/beyond-the-prompt.png',
    description:
      "Kfund's Beyond the Prompt returns with Maex Arment (Causa Prima), Carlos Riquelme (Microsoft AI) and Alejandro Vidal (Mindmakers). Three technical talks on agent networks for finance, modern AI and the work around the prompt, followed by pizza and drinks.",
  },
  {
    title: 'Vibe Coding & Friends',
    date: '2026-09-02',
    time: '19:00',
    endTime: '21:30',
    location: 'Hotel ICON Wipton, Salamanca',
    url: 'https://www.meetup.com/es-es/the-vcc/events/pdggztyjcmbdb/',
    image: '/events/vibe-coding-friends.jpg',
    description:
      'A casual meetup for founders and builders working with AI. Bring a project or idea to share, get feedback and meet other people building in Madrid.',
  },
  {
    title: 'Madrid AI Builders: Friday Networking',
    date: '2026-09-04',
    time: '17:00',
    endTime: '19:00',
    location: 'Generator Madrid, Centro',
    url: 'https://luma.com/dw1br936',
    image: '/events/madrid-ai-builders.jpg',
    description:
      'A Friday meetup for people building with AI in Madrid. Founders, developers and creators can swap ideas and talk about projects, agents, automation and new tools.',
  },
  {
    title: 'Ahead x Magnific',
    date: '2026-09-09',
    time: '18:30',
    endTime: '21:30',
    location: 'Central de Diseño, Matadero',
    url: 'https://luma.com/qkelc5sg',
    image: '/events/ahead-magnific.png',
    description:
      'Melissa Diago, Antonio Lasaga y Alejandro Gómez cuentan cómo Magnific integra la IA en el trabajo creativo, ejecutó su cambio de marca y está cambiando la forma de trabajar de la empresa. Después habrá cóctel y networking en la Central de Diseño.',
  },
  {
    title: 'Port of Call: Madrid Shipaton - High Score Night',
    date: '2026-09-10',
    time: '19:00',
    endTime: '22:00',
    location: 'Rockade Malasaña, Centro',
    url: 'https://luma.com/h4c3y7ed',
    image: '/events/port-of-call-madrid-shipaton.png',
    description:
      'An evening with creabuilders and RevenueCat for people building apps during Shipaton. Bring your work in progress for demos and an open mic, with arcade games, drinks and RevenueCat co-founder Miguel Carranza.',
  },
  {
    title: 'Port of Call: Madrid Shipaton - Engine Room',
    date: '2026-09-11',
    time: '17:00',
    endTime: '20:00',
    location: 'Pacífico, Madrid',
    url: 'https://luma.com/h4c3y7ed',
    image: '/events/port-of-call-madrid-shipaton.png',
    description:
      'The second Shipaton session starts with a guided visit to the engines that once powered the Madrid metro. Afterwards, the group moves to a nearby workspace to build together; bring a charged laptop.',
  },
  {
    title: 'FinTech Madrid - The New EU Crypto Rulebook',
    date: '2026-09-11',
    time: '18:30',
    endTime: '21:30',
    location: 'Casa Luna, Malasaña',
    url: 'https://luma.com/tkuta85q',
    image: '/events/fintech-madrid-eu-crypto-rulebook.png',
    description:
      'Ilona Limonta-Volkova and Miguel Sánchez Monjo discuss what MiCA means in practice for crypto companies in Europe, from authorisation to enforcement and investment. The conversation is in English, with audience questions, wine and cheese, and drinks afterwards.',
  },
  {
    title: 'Activos digitales 2026: innovación virtual, impacto real',
    date: '2026-09-15',
    time: '09:00',
    endTime: '14:15',
    location: 'Espacio KOI, Juan Hurtado de Mendoza 4 / online',
    url: 'https://activosdigitales2026.tufabricadeventos.com/',
    image: '/events/activos-digitales-2026.jpg',
    description:
      'Novena edición del encuentro de El Confidencial sobre activos digitales, con sesiones sobre el euro digital, tokenización y el papel de la IA en las finanzas. La recepción empieza a las 08:45; el aforo presencial está completo, pero la inscripción online sigue abierta.',
  },
  {
    title: 'Astra Commons: Madrid',
    date: '2026-09-16',
    time: '18:00',
    endTime: '21:00',
    location: 'Madrid',
    url: 'https://luma.com/to9pt7z7',
    image: '/events/astra-commons-madrid.png',
    description:
      'Encuentro informal para tomar un café con la comunidad de builders y conversar sobre el lanzamiento de GPT-6 Astra. Los asistentes registrados recibirán 100 dólares en créditos de Codex y 50 dólares en créditos de API; la dirección se comparte tras el registro.',
  },
  {
    title: 'Claude Community Madrid Launch Meetup',
    date: '2026-09-16',
    time: '18:30',
    endTime: '22:00',
    location: 'ISDI, Viriato 20, Chamberí',
    url: 'https://luma.com/claudemadrid-sept16',
    image: '/events/claude-community-madrid-launch.png',
    description:
      'Primer encuentro oficial de Claude Community Madrid para conocer a sus embajadores, las áreas en las que trabajan y los próximos eventos de la comunidad. Tras la presentación habrá preguntas y tiempo para conversar con los asistentes y los organizadores.',
  },
  {
    title: '#CodeMeet: ¿Quién controla a los agentes?',
    date: '2026-09-17',
    time: '18:30',
    endTime: '21:30',
    location: 'Celonis Office, Tetuán',
    url: 'https://www.meetup.com/es-es/codemotion-espana/events/316210308/',
    image: '/events/codemeet-control-agents.jpg',
    description:
      'Tres charlas técnicas sobre sistemas agénticos: ahorro de tokens, construcción de MCPs y seguridad. La sesión termina con preguntas y cervezas en la oficina de Celonis.',
  },
  {
    title: "How to stop your AI agent from amplifying your team's tech debt",
    date: '2026-09-17',
    time: '19:00',
    endTime: '20:30',
    location: 'Puerta Innovación, Toledo 110, La Latina',
    url: 'https://luma.com/mq1ffwe1',
    image: '/events/ai-agent-tech-debt.jpg',
    description:
      'Kevin Martínez comparte el flujo de trabajo que aplica en proyectos frontend para integrar agentes de IA sin acumular deuda técnica, con pruebas en el navegador y reglas para controlar al agente. La charla será en español, o en inglés si algún asistente lo necesita, con recepción a las 18:50 y networking al terminar.',
  },
  {
    title: 'HackSpain 2026',
    date: '2026-09-18',
    location: 'UPM ETSIT, Madrid',
    url: 'https://hackspain.com/',
    image: '/events/hackspain.png',
    description:
      'Hackathon de 36 horas (18 a 20 de septiembre) para unir a los mejores builders jóvenes de España: 250 participantes menores de 30, retos de startups líderes, compute gratis y un gran premio. En la ETSIT de la UPM.',
  },
  {
    title: '3 founders, 3 problemas - No Lazy People Madrid',
    date: '2026-09-18',
    time: '19:00',
    endTime: '22:00',
    location: 'Madrid, ubicación por confirmar',
    url: 'https://luma.com/f8fdiy9t',
    image: '/events/3-founders-3-problemas.png',
    description:
      'Tomás Stambulsky, Luis Rodrigo Orellana y Jesús Alberto comparten qué están construyendo, los errores que han cometido y un problema real que estén resolviendo ahora. Después, la conversación se abre a las 20 personas de la sala y termina con algo de beber, sin networking forzado.',
  },
  {
    title: 'Café Helmcode Madrid',
    date: '2026-09-22',
    time: '17:00',
    endTime: '21:00',
    location: 'Mad Tech Campus, Matadero',
    url: 'https://luma.com/gh5vx0wk',
    image: '/events/cafe-helmcode-madrid.png',
    description:
      'Afterwork de Helmcode para gente que construye con modelos abiertos, con tres charlas cortas sobre diseño de fármacos, monitorización de bloqueos del fútbol y datos para fine-tuning. Después habrá tiempo para compartir proyectos y dudas sobre IA, con café, refrescos y picoteo.',
  },
  {
    title: 'Liderazgo, equipos y desarrollo con IA',
    date: '2026-09-22',
    time: '18:45',
    endTime: '21:00',
    location: 'The Bridge, Plaza Pablo Ruiz Picasso 1',
    url: 'https://gdg.community.dev/events/details/google-gdg-madrid-presents-liderazgo-equipos-y-desarrollo-con-ia/',
    image: '/events/gdg-liderazgo-equipos-ia.png',
    description:
      'Rubén Aguilera presenta L.U.C.I.A., una metodología para integrar la IA en el desarrollo de producto, con una demo en directo. Ana Gil Amor y Elena Guidi hablan de cómo coordinar múltiples equipos y cuidar las relaciones profesionales, con networking al terminar.',
  },
  {
    title: 'Beers & Reliability',
    date: '2026-09-23',
    time: '18:30',
    endTime: '21:00',
    location: 'Hispanoamérica, venue shared with guests',
    url: 'https://luma.com/zb95bhdg',
    image: '/events/beers-reliability.png',
    description:
      'Daniel Afonso from PagerDuty gives a practical talk on chaos engineering: breaking systems on purpose to make them more reliable. Food, drinks and an open bar follow the session.',
  },
  {
    title: "FredCon'26 by Google Cloud",
    date: '2026-09-24',
    time: '09:30',
    endTime: '19:00',
    location: 'Espacio Rastro Madrid, Centro',
    url: 'https://luma.com/4vot95mb',
    image: '/events/fredcon-26.png',
    description:
      'La conferencia de Manfred sobre liderazgo técnico y gestión de equipos reúne a responsables técnicos y equipos de recursos humanos. Habrá sesiones sobre equilibrio salarial, gestión de personas y cómo hacer que ambos lados trabajen mejor juntos.',
  },
  {
    title: 'AI Socratic Madrid - September',
    date: '2026-09-24',
    time: '17:30',
    endTime: '20:00',
    location: 'Experience Design Lab, Distrito Telefónica',
    url: 'https://luma.com/42vour7p',
    image: '/events/ai-socratic-madrid-september.png',
    description:
      'A monthly discussion for people working seriously with AI in Madrid. Jorge Ordovás and Alfonso de la Rocha moderate a conversation based on the latest AI Socratic post, followed by demos and short presentations.',
  },
  {
    title: 'Startup Oasis Innovation Café',
    date: '2026-09-25',
    time: '09:00',
    endTime: '11:00',
    location: 'VEIA Café & Clubhouse, Retiro',
    url: 'https://www.meetup.com/es-es/startup-oasis/events/qsqqxtyjcmbhc/',
    image: '/events/startup-oasis-innovation-cafe.jpg',
    description:
      'Morning coffee for founders, developers, designers and product people. There is no agenda, just breakfast and conversations in English and Spanish.',
  },
  {
    title: 'PostgreSQL partitioning and immutable releases',
    date: '2026-09-28',
    time: '18:50',
    endTime: '20:50',
    location: 'Celonis Office, Tetuán',
    url: 'https://www.meetup.com/es-es/madrid-devops/events/316152297/',
    image: '/events/madrid-devops-postgresql.jpg',
    description:
      'Jorge Argente Ferrero comparte el post-mortem de un incidente en Clarity AI y el rediseño que siguió. La charla cubre particionado declarativo de PostgreSQL, cargas atómicas y releases inmutables.',
  },
  {
    title: 'Construyendo sin filtros #15: Nadie construye solo',
    date: '2026-09-29',
    time: '18:30',
    endTime: '21:00',
    location: 'Aticco Castellana, Chamartín',
    url: 'https://luma.com/bztpl6hb',
    image: '/events/construyendo-sin-filtros-15.png',
    description:
      'Pilar González, de NutriSync Collective, y Carlos de la Lama, de Startup Embassy, hablan sobre encontrar cofounders y el papel de la comunidad en los primeros pasos de una startup. La sesión de Startup Grind Madrid termina con cervezas y conversación entre los asistentes.',
  },
  {
    title: 'Madrid | 48-hour Claude Code Hackathon',
    date: '2026-10-02',
    time: '18:00',
    location: 'Nova Talent office, Tetuán',
    url: 'https://luma.com/claude-dyek',
    image: '/events/claude-code-hackathon-madrid.png',
    description:
      "A 48-hour Claude Code hackathon on agent-to-agent infrastructure, run with Nova Talent and Causa Prima. Around 50 participants will build in teams from Friday evening to Sunday, with three short talks during the weekend.",
  },
];

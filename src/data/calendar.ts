// EXTERNAL events shown in the /madrid calendar (the week / month widget) — i.e.
// other communities' meetups, not ours. Our own mad.builders events are NOT
// listed here: they come from `events.ts` (the single source of truth) and are
// merged in by `madrid.astro`, which tags them `madbuilders: true` and resolves
// their cover from src/assets/events/<slug>/cover.jpeg. So:
//
//   • Adding a mad.builders event → edit `events.ts` only.
//   • Adding someone else's event → add a block below.
//
// The week view always starts on Monday of the current week (computed in the
// browser), so you never need to move the window forward; you only add or remove
// events. The merge + sort happens in `madrid.astro`.
//
// ── Adding an event from just a link (Luma / Meetup / Culpass / …) ────────────
// Read the event page and fill the entry by inference — don't ask for each field:
//   1. Ours or external? If mad.builders is the host, add it to `events.ts`
//      instead (it flows into this calendar automatically). Only OTHER people's
//      events go in the list below.
//   2. Pull date, start/end time (convert to Madrid local), and location.
//   3. Save the cover image to public/events/<slug>.jpg and reference it as
//      '/events/<slug>.jpg'. Strip personal invite tokens from `url`
//      (e.g. Luma's '?tk=...').
//   4. `description`: write a 1–2 sentence summary of the event in its OWN
//      language (es/en) — don't paste the full blurb. No em-dashes (house style).
//   5. `private: true` if the page is invite-only / approval-required (signals:
//      "solo por invitación", "approval required", "request to join", RSVPs
//      closed/full). When genuinely unsure, leave it off.
// The same inference applies to our events in `events.ts` (summary + private).
//
// Field notes:
//   • `date`        local Madrid date, 'YYYY-MM-DD'.
//   • `time`/`endTime`  24h 'HH:MM', Madrid local. Omit `time` for an all-day entry.
//   • `url`         makes the entry clickable (opens the detail modal → "View event").
//   • `image`       cover shown in the modal + week card. For external events use a
//                   path under /public (e.g. '/events/foo.jpg') or an absolute URL.
//   • `description` short summary shown in the modal.
//   • `madbuilders` filled green treatment. Leave unset/false for external events;
//                   it's set automatically for events sourced from `events.ts`.
//   • `private`     invite-only event — shown with a "private" marker.
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
    private: true,
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
    private: true,
    description:
      'Taller de Tetuan Valley y Mad Tech Campus sobre cómo automatizar las finanzas de tu startup sin vivir en hojas de cálculo. Iñigo enseña en directo cómo Mad Tech lo hace con Claude, de los tickets al reporting, y APTKI resuelve las dudas financieras de los asistentes.',
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
];

// Content for the muShenzhen popup city landing page (/sz).
// This page keeps its own self-contained design, separate from the main site.

import type { ImageMetadata } from 'astro';
import weekAi from '../assets/shenzhen/week-ai.jpeg';
import weekBiotech from '../assets/shenzhen/week-biotech.jpeg';
import weekRobotics from '../assets/shenzhen/week-robotics.jpeg';
import weekCulture from '../assets/shenzhen/week-culture-fans.jpeg';
import hero from '../assets/shenzhen/hero.jpeg';
import hackathon from '../assets/shenzhen/hackathon-prize.jpeg';
import chinaPanel from '../assets/shenzhen/china-panel.jpeg';
// card shows the tighter crop; the lightbox opens the full photo
import chinaRobot from '../assets/shenzhen/china-robot-crowd-crop2.jpeg';
import chinaRobotFull from '../assets/shenzhen/china-robot-crowd.jpeg';
import themuBanners from '../assets/shenzhen/themu-banners.jpeg';
import themuStage from '../assets/shenzhen/themu-stage.jpeg';
import themuStageDay from '../assets/shenzhen/themu-stage-day.jpeg';
import themuTownhall from '../assets/shenzhen/themu-townhall.jpeg';
import galleryGlove from '../assets/shenzhen/gallery-glove.jpeg';
import galleryKeynote from '../assets/shenzhen/gallery-keynote.jpeg';
import galleryNight from '../assets/shenzhen/gallery-night.jpeg';

// Extra event photos that only appear in the marquee strip (and its lightbox).
const marqueeGlob = import.meta.glob<{ default: ImageMetadata }>('../assets/shenzhen/marquee/*.jpeg', {
  eager: true,
});
export const marqueePhotos = Object.entries(marqueeGlob)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, m]) => m.default);

export const EVENT = {
  dateShort: 'Noviembre 2026',
};

export const APPLY_URL = '#aplicaciones'; // TODO: enlace al formulario de aplicación

export const images = {
  hero,
  hackathon,
  chinaPanel,
  chinaRobot,
  chinaRobotFull,
  themuBanners,
  themuStage,
  themuStageDay,
  themuTownhall,
  galleryGlove,
  galleryKeynote,
  galleryNight,
};

export const weeks: { n: string; name: string; color: string; img: ImageMetadata; alt: string; zoom?: number }[] = [
  { n: '01', name: 'AI', color: '#e0492e', img: weekAi, alt: 'Foto de grupo de la comunidad en muShanghai' },
  { n: '02', name: 'Biotech & Longevity', color: '#8fa11d', img: weekBiotech, alt: 'Charla sobre biología cuantitativa' },
  { n: '03', name: 'Robotics & Hardware', color: '#5b4bc4', img: weekRobotics, alt: 'Un robot cuadrúpedo repartiendo refrescos en muShanghai' },
  // zoom: optional scale applied to the card photo (crops in via the 4:3 frame)
  { n: '04', name: 'Culture', color: '#e0669d', img: weekCulture, alt: 'Grupo posando con abanicos rojos en el escenario de muShanghai', zoom: 1.25 },
];

export const companies = ['z.ai', 'Alibaba', 'Kimi', 'NIO', 'Unitree', 'BYD', 'Xiaomi'];

export const faqs = [
  {
    q: '¿Para quién es?',
    a: 'Para cualquiera con ganas de construir y compartir. Creemos que un grupo diverso hace la experiencia más rica, así que seleccionaremos los candidatos buscando variedad de edades, backgrounds y disciplinas.',
  },
  {
    q: '¿Cuál es el coste?',
    a: 'Los vuelos están alrededor de los 800 € y la estancia del mes completo, entre los 1.000 € y los 2.000 € según el tipo de alojamiento. Estamos en conversaciones con sponsors para cubrir parte de los gastos del grupo.',
  },
  {
    q: '¿Tengo que asistir el mes entero?',
    a: 'No es obligatorio: tendremos en cuenta aplicaciones de builders que solo puedan asistir durante parte del mes.',
  },
  {
    q: '¿Cómo es el día a día?',
    a: 'Principalmente compartiremos espacio, pero el formato es libre: cada uno decide su agenda, asistiendo a los eventos que le interesen de los que haya programados cada día.',
  },
  {
    q: '¿Se puede trabajar desde allí?',
    a: 'Sí. the-mu ha conseguido que este sea uno de los primeros eventos en China con acceso a internet abierto. Así que desde el venue tendrás acceso a todas las redes y servicios de forma abierta y sin necesidad de vpn.',
  },
];

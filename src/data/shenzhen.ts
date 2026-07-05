// Content for the muShenzhen popup city landing page (/shenzhen).
// This page keeps its own self-contained design, separate from the main site.

import weekAi from '../assets/shenzhen/week-ai.jpeg';
import weekBiotech from '../assets/shenzhen/week-biotech.jpeg';
import weekRobotics from '../assets/shenzhen/week-robotics.jpeg';
import weekCulture from '../assets/shenzhen/week-culture.jpeg';
import hero from '../assets/shenzhen/hero.jpeg';
import hackathon from '../assets/shenzhen/hackathon-prize.jpeg';
import chinaPanel from '../assets/shenzhen/china-panel.jpeg';
import chinaRobot from '../assets/shenzhen/china-robot.jpeg';
import themuBanners from '../assets/shenzhen/themu-banners.jpeg';
import themuStage from '../assets/shenzhen/themu-stage.jpeg';
import themuStageDay from '../assets/shenzhen/themu-stage-day.jpeg';
import themuTownhall from '../assets/shenzhen/themu-townhall.jpeg';
import galleryGlove from '../assets/shenzhen/gallery-glove.jpeg';
import galleryKeynote from '../assets/shenzhen/gallery-keynote.jpeg';
import galleryNight from '../assets/shenzhen/gallery-night.jpeg';

export const EVENT = {
  dateShort: 'Noviembre 2026',
};

export const APPLY_URL = '#aplicaciones'; // TODO: enlace al formulario de aplicación
export const SPONSOR_URL = 'mailto:hola@mad.builders'; // TODO: contacto real para sponsors

export const images = {
  hero,
  hackathon,
  chinaPanel,
  chinaRobot,
  themuBanners,
  themuStage,
  themuStageDay,
  themuTownhall,
  galleryGlove,
  galleryKeynote,
  galleryNight,
};

export const weeks = [
  { n: '01', name: 'AI', color: '#e0492e', img: weekAi, alt: 'Foto de grupo de la comunidad en muShanghai' },
  { n: '02', name: 'Biotech & Longevity', color: '#8fa11d', img: weekBiotech, alt: 'Charla sobre biología cuantitativa' },
  { n: '03', name: 'Robotics & Hardware', color: '#5b4bc4', img: weekRobotics, alt: 'Un robot cuadrúpedo repartiendo refrescos en muShanghai' },
  { n: '04', name: 'Culture', color: '#e0669d', img: weekCulture, alt: 'Grupo practicando una coreografía de movimiento con abanicos en muShanghai' },
];

export const companies = ['z.ai', 'Alibaba', 'Kimi', 'NIO', 'Unitree', 'BYD', 'Xiaomi'];

export const faqs = [
  {
    q: '¿Para quién es?',
    a: 'Para cualquiera con ganas de aprender y construir. Creemos que un grupo diverso hace la experiencia más rica, así que seleccionaremos los candidatos buscando variedad de edades, backgrounds y disciplinas.',
  },
  {
    q: '¿Qué se espera de mí?',
    a: 'Que vengas a aprender y construir, y que compartas los aprendizajes con el resto de la comunidad.',
  },
  {
    q: '¿Qué está cubierto?',
    a: 'Cubrimos vuelos y alojamiento de los builders seleccionados durante todo el mes.',
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
    a: 'Sí. the-mu ha conseguido que este sea uno de los primeros eventos en China con acceso a internet abierto. Así que desde el venue tendrás acceso a todas las redes sin necesidad de vpn.',
  },
];

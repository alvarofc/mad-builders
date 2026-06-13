// Current residents. Photo lives at src/assets/profiles/<slug>.png
export interface Person {
  slug: string;
  name: string;
  linkedin?: string;
  x?: string;
}

export const people: Person[] = [
  { slug: 'alvaro', name: 'Álvaro Fragoso', linkedin: 'https://www.linkedin.com/in/alvaro-fragoso/', x: 'https://x.com/metasurfero' },
  { slug: 'juan-mugica', name: 'Juan Mugica', linkedin: 'https://www.linkedin.com/in/juan-mugica-gonzalez/', x: 'https://x.com/loonstep' },
  { slug: 'juan-gomez', name: 'Juan Gómez', linkedin: 'https://www.linkedin.com/in/juangomeztrapero/', x: 'https://x.com/gomjota' },
  { slug: 'nicolas', name: 'Nicolas Gonzalez', linkedin: 'https://www.linkedin.com/in/nlgonzalez/', x: 'https://x.com/_nlgonzalez' },
  { slug: 'maria', name: 'María Sebares', linkedin: 'https://www.linkedin.com/in/maria-sebares9/', x: 'https://x.com/MariaSebar84584' },
  { slug: 'txema', name: 'Txema Puch', linkedin: 'https://www.linkedin.com/in/txema-puch/', x: 'https://x.com/txemapuch' },
  { slug: 'tomas', name: 'Tomás Stambulsky', linkedin: 'https://www.linkedin.com/in/tomasstambulsky/', x: 'https://x.com/TomasStambulsky' },
  { slug: 'bartek', name: 'Bartek Baran', linkedin: 'https://www.linkedin.com/in/bartek-baran/' },
  { slug: 'barto', name: 'Barto Molina', linkedin: 'https://www.linkedin.com/in/bartomolina/', x: 'https://x.com/bartomolina' },
  { slug: 'rohit', name: 'Rohit Gupta', linkedin: 'https://www.linkedin.com/in/rohit7gupta/', x: 'https://x.com/rohit7gupta' },
  { slug: 'diego', name: 'Diego Mazo', linkedin: 'https://www.linkedin.com/in/diego-mazo/', x: 'https://x.com/diegomazoro' },
  { slug: 'javi', name: 'Javier Jiménez', linkedin: 'https://www.linkedin.com/in/javierjrueda/', x: 'https://x.com/javierjrueda' },
];

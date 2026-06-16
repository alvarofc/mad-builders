// Scroll-spy for the sticky section subnav (.subnav). Highlights the link for
// the section currently in view. Shared by the home and madrid pages.
const subLinks = [...document.querySelectorAll<HTMLAnchorElement>('.subnav a')];

if (subLinks.length) {
  const subLinkFor = new Map(subLinks.map((a) => [a.getAttribute('href')!.slice(1), a]));
  const lastLink = subLinks[subLinks.length - 1] ?? null;

  const setActive = (link: HTMLAnchorElement | null) => {
    subLinks.forEach((a) => a.classList.remove('active'));
    link?.classList.add('active');
  };
  // The last section is short and sits against the footer, so it never reaches
  // the activation band before the page runs out of scroll — pin it at the bottom.
  const atBottom = () =>
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

  // Clicking a link scrolls to a fixed spot — for the last sections that spot is
  // the page bottom, which the spy reads the same as "scrolled to the bottom". So
  // honour the click: pin it and pause the spy until the user actually scrolls.
  let locked = false;
  let lockTimer = 0;
  subLinks.forEach((a) =>
    a.addEventListener('click', () => {
      setActive(a);
      locked = true;
      clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => (locked = false), 900);
    })
  );
  (['wheel', 'touchstart', 'keydown'] as const).forEach((ev) =>
    window.addEventListener(ev, () => (locked = false), { passive: true })
  );

  const spy = new IntersectionObserver(
    (entries) => {
      if (locked) return;
      if (atBottom()) return setActive(lastLink);
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        // Top hero/intro in view = nothing active
        const id = (e.target as HTMLElement).id;
        setActive(id === 'hero' ? null : subLinkFor.get(id) ?? null);
      }
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  document.querySelectorAll<HTMLElement>('section[id]').forEach((s) => spy.observe(s));
  window.addEventListener('scroll', () => !locked && atBottom() && setActive(lastLink), { passive: true });
}

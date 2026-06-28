// Scroll-spy for the sticky section subnav (.subnav). Highlights the link for
// the section currently in view. Shared by the home and madrid pages.
//
// Deterministic by design: instead of reacting to IntersectionObserver callbacks
// (whose firing order relative to layout/paint is unreliable and was leaving the
// first link stuck "active" at the top of the page), we read scroll position and
// section geometry directly and recompute on every relevant event. Same answer
// every time, no timing races.
const subLinks = [...document.querySelectorAll<HTMLAnchorElement>('.subnav a')];

if (subLinks.length) {
  const subLinkFor = new Map(subLinks.map((a) => [a.getAttribute('href')!.slice(1), a]));
  const lastLink = subLinks[subLinks.length - 1] ?? null;
  const sections = [...document.querySelectorAll<HTMLElement>('section[id]')];

  const setActive = (link: HTMLAnchorElement | null) => {
    subLinks.forEach((a) => a.classList.remove('active'));
    link?.classList.add('active');
  };

  // The last section is short and sits against the footer, so it never reaches
  // the activation line before the page runs out of scroll — pin it at the bottom.
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

  // The active section is the last one whose top has scrolled above the activation
  // line. That line sits just below the sticky header (nav + subnav) — anchored to
  // the top of the viewport, NOT its middle: a short hero on a wide screen is
  // shorter than mid-viewport, which would otherwise mark the first section active
  // at the very top of the page. The hero (and anything before the first linked
  // section) maps to "nothing active"; the last section is pinned once the page
  // bottoms out. offsetTop/offsetHeight are document-relative and layout-stable,
  // and we skip hidden sections (e.g. the home page's hidden residents block).
  const line = 140;
  const resolve = () => {
    if (locked) return;
    if (atBottom()) return setActive(lastLink);
    const mark = window.scrollY + line;
    let current: HTMLElement | null = null;
    for (const s of sections) {
      if (s.offsetHeight <= 0) continue;
      if (s.offsetTop <= mark) current = s;
      else break;
    }
    setActive(current && current.id !== 'hero' ? subLinkFor.get(current.id) ?? null : null);
  };

  // resolve() reads layout (scrollHeight/offsetTop/offsetHeight), so coalesce
  // high-frequency events into one computation per animation frame to avoid
  // forcing a reflow on every scroll tick.
  let ticking = false;
  const onEvent = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      resolve();
    });
  };
  (['scroll', 'resize', 'load', 'pageshow'] as const).forEach((ev) =>
    window.addEventListener(ev, onEvent, { passive: true })
  );
  requestAnimationFrame(resolve);
  resolve();
}

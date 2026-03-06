import fs from 'fs/promises';

async function update() {
  let content = await fs.readFile('src/pages/index.astro', 'utf8');

  const newStyle = `
<style>
  /* ============================================
     DESIGN SYSTEM - MINIMALIST LIGHT
     ============================================ */
  :root {
    /* Colors — clean, minimalist monochrome */
    --color-bg: #FFFFFF;
    --color-bg-alt: #FAFAFA;
    --color-bg-card: #FFFFFF;
    --color-surface: #F5F5F5;
    --color-text: #0A0A0A;
    --color-text-dim: #555555;
    --color-text-muted: #888888;
    --color-accent: #0A0A0A;
    --color-accent-hover: #333333;
    --color-border: #EAEAEA;
    --color-border-light: #F5F5F5;

    /* Typography */
    --font-display: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-body: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-logo: 'Geist Mono', monospace;

    /* Spacing */
    --space-xs: 0.5rem;
    --space-sm: 1rem;
    --space-md: 2.5rem;
    --space-lg: 5rem;
    --space-xl: 8rem;
    --space-2xl: 12rem;

    /* Layout */
    --max-width: 1200px;
    --max-width-narrow: 800px;
  }

  /* ============================================
     BASE
     ============================================ */
  .page {
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
    letter-spacing: -0.01em;
  }

  /* Refined light grain */
  .page::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 128px 128px;
    mix-blend-mode: multiply;
  }

  /* ============================================
     CONTAINERS
     ============================================ */
  .container {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 var(--space-md);
  }

  .container-narrow {
    max-width: var(--max-width-narrow);
    margin: 0 auto;
    padding: 0 var(--space-md);
  }

  /* ============================================
     REVEAL ANIMATION
     ============================================ */
  .reveal {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.8s cubic-bezier(0.2, 1, 0.3, 1),
                transform 0.8s cubic-bezier(0.2, 1, 0.3, 1);
  }

  .reveal.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Stagger children */
  .reveal:nth-child(2) { transition-delay: 0.05s; }
  .reveal:nth-child(3) { transition-delay: 0.10s; }
  .reveal:nth-child(4) { transition-delay: 0.15s; }
  .reveal:nth-child(5) { transition-delay: 0.20s; }
  .reveal:nth-child(6) { transition-delay: 0.25s; }

  /* ============================================
     NAVIGATION
     ============================================ */
  .nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: var(--space-sm) var(--space-md);
    transition: background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease;
    border-bottom: 1px solid transparent;
  }

  .nav.scrolled {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--color-border);
  }

  .nav-inner {
    max-width: var(--max-width);
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .nav-logo {
    font-family: var(--font-logo);
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--color-text);
    text-decoration: none;
    letter-spacing: -0.02em;
    text-transform: uppercase;
  }

  .nav-logo-accent {
    opacity: 0.5;
    margin-left: 0.15em;
  }

  .nav-cta {
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-bg);
    background: var(--color-accent);
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 99px;
    transition: all 0.2s ease;
    letter-spacing: 0.01em;
  }

  .nav-cta:hover {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
  }

  /* ============================================
     BUTTONS
     ============================================ */
  .btn {
    display: inline-block;
    text-decoration: none;
    font-family: var(--font-body);
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 1, 0.3, 1);
    letter-spacing: 0.01em;
  }

  .btn-primary {
    background: var(--color-text);
    color: var(--color-bg);
    padding: 1rem 2.5rem;
    font-size: 1rem;
    border-radius: 99px;
  }

  .btn-primary:hover {
    background: var(--color-text-dim);
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
  }

  .btn-large {
    padding: 1.25rem 3.5rem;
    font-size: 1.1rem;
  }

  /* ============================================
     HERO
     ============================================ */
  .hero {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: var(--space-2xl) var(--space-md) var(--space-xl);
    position: relative;
    background: radial-gradient(circle at 50% 0%, var(--color-bg-alt) 0%, var(--color-bg) 70%);
  }

  .hero-content {
    max-width: var(--max-width);
    margin: 0 auto;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .hero-label {
    font-family: var(--font-logo);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-dim);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: var(--space-md);
    padding: 0.4rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 99px;
    background: var(--color-bg);
  }

  .hero-headline {
    font-family: var(--font-display);
    font-size: clamp(3rem, 9vw, 7.5rem);
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: var(--color-text);
    margin: 0 0 var(--space-md);
    max-width: 1000px;
  }

  .hero-sub {
    font-size: 1.25rem;
    color: var(--color-text-dim);
    max-width: 600px;
    margin: 0 0 var(--space-lg);
    line-height: 1.6;
    font-weight: 300;
  }

  .hero-cta {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
    justify-content: center;
  }

  .hero-meta {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    font-family: var(--font-logo);
  }

  .hero-scroll-hint {
    position: absolute;
    bottom: var(--space-lg);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    opacity: 0.4;
    transition: opacity 0.3s ease;
  }

  .hero-scroll-hint span {
    font-family: var(--font-logo);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-dim);
  }

  .scroll-line {
    width: 1px;
    height: 40px;
    background: var(--color-text-muted);
    animation: scroll-pulse 2s ease-in-out infinite;
  }

  @keyframes scroll-pulse {
    0%, 100% { opacity: 0.2; transform: scaleY(0.4); transform-origin: top; }
    50% { opacity: 1; transform: scaleY(1); }
  }

  /* ============================================
     SECTIONS (SHARED)
     ============================================ */
  .section {
    padding: var(--space-2xl) 0;
    position: relative;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 400;
    line-height: 1.05;
    letter-spacing: -0.03em;
    margin: 0 0 var(--space-lg);
    color: var(--color-text);
  }

  .section-title-large {
    font-size: clamp(4rem, 10vw, 8rem);
    letter-spacing: -0.05em;
  }

  .title-dim {
    color: var(--color-text-muted);
  }

  /* ============================================
     PROBLEM SECTION
     ============================================ */
  .section-problem {
    background: var(--color-bg-alt);
    border-top: 1px solid var(--color-border);
  }

  .problem-hook {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw, 3rem);
    color: var(--color-text);
    margin: 0 0 var(--space-lg);
    font-weight: 300;
    letter-spacing: -0.02em;
  }

  .problem-body {
    max-width: 720px;
    margin-bottom: var(--space-lg);
  }

  .problem-body p {
    color: var(--color-text-dim);
    margin: 0 0 1.5rem;
    font-size: 1.25rem;
    line-height: 1.7;
    font-weight: 300;
  }

  .problem-bridge {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2.5rem);
    color: var(--color-text);
    margin: 0;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  /* ============================================
     WHO SECTION
     ============================================ */
  .section-who {
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
  }

  .who-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    margin-bottom: var(--space-lg);
    background: var(--color-border);
    border: 1px solid var(--color-border);
  }

  .who-item {
    display: flex;
    gap: var(--space-sm);
    align-items: flex-start;
    padding: var(--space-lg);
    background: var(--color-bg);
    transition: background 0.3s ease;
  }

  .who-item:hover {
    background: var(--color-bg-alt);
  }

  .who-marker {
    font-family: var(--font-logo);
    font-size: 1rem;
    color: var(--color-text-muted);
    line-height: 1.5;
    flex-shrink: 0;
  }

  .who-item p {
    margin: 0;
    color: var(--color-text);
    font-size: 1.15rem;
    line-height: 1.5;
    font-weight: 400;
    letter-spacing: -0.01em;
  }

  .who-challenge {
    font-family: var(--font-body);
    font-size: 1.1rem;
    color: var(--color-text-dim);
    margin: 0;
    max-width: 600px;
  }

  /* ============================================
     COMMUNITY SECTION
     ============================================ */
  .section-community {
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-alt);
  }

  .builders-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    margin-bottom: var(--space-lg);
    background: var(--color-border);
    border: 1px solid var(--color-border);
  }

  .builder-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-md);
    background: var(--color-bg);
    text-decoration: none;
    transition: all 0.3s ease;
  }

  .builder-card:hover {
    background: var(--color-text);
  }

  .builder-card:hover .builder-name,
  .builder-card:hover .builder-role,
  .builder-card:hover .builder-building {
    color: var(--color-bg);
  }
  
  .builder-card:hover .builder-initial {
    background: var(--color-bg);
    color: var(--color-text);
    border-color: var(--color-bg);
  }

  .builder-initial {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-logo);
    font-size: 1rem;
    color: var(--color-text);
    margin-bottom: var(--space-md);
    transition: all 0.3s ease;
  }

  .builder-info {
    min-width: 0;
  }

  .builder-name {
    font-family: var(--font-body);
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.01em;
    transition: color 0.3s ease;
  }

  .builder-role {
    font-size: 0.8rem;
    color: var(--color-text-dim);
    font-family: var(--font-logo);
    text-transform: uppercase;
    transition: color 0.3s ease;
  }

  .builder-building {
    font-size: 0.95rem;
    color: var(--color-text-dim);
    margin: 1rem 0 0;
    line-height: 1.6;
    font-weight: 300;
    transition: color 0.3s ease;
  }

  .community-closing {
    font-size: 1.1rem;
    color: var(--color-text-dim);
    max-width: 640px;
    margin: 0;
  }

  /* ============================================
     BENEFITS SECTION
     ============================================ */
  .section-benefits {
    border-bottom: 1px solid var(--color-border);
  }

  .benefits-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    margin-bottom: var(--space-lg);
    background: var(--color-border);
    border: 1px solid var(--color-border);
  }

  .benefit-item {
    padding: var(--space-lg) var(--space-md);
    background: var(--color-bg);
    transition: background 0.3s ease;
  }

  .benefit-item:hover {
    background: var(--color-bg-alt);
  }

  .benefit-number {
    font-family: var(--font-logo);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted);
    display: block;
    margin-bottom: var(--space-sm);
  }

  .benefit-item h3 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--color-text);
    margin: 0 0 0.75rem;
    letter-spacing: -0.02em;
  }

  .benefit-item p {
    color: var(--color-text-dim);
    font-size: 1rem;
    margin: 0;
    line-height: 1.6;
    font-weight: 300;
  }

  .benefits-punchline {
    text-align: center;
    padding: var(--space-md);
    border: 1px solid var(--color-text);
    background: var(--color-bg);
  }

  .benefits-punchline p {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--color-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  /* ============================================
     STEPS SECTION
     ============================================ */
  .section-steps {
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-alt);
  }

  .steps-grid {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin-bottom: var(--space-lg);
  }

  .step-item {
    flex: 1;
    padding: 0 var(--space-sm);
    position: relative;
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-text);
    border-radius: 50%;
    font-family: var(--font-logo);
    font-size: 0.85rem;
    color: var(--color-bg);
    margin-bottom: var(--space-md);
  }

  .step-item h3 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--color-text);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .step-item p {
    color: var(--color-text-dim);
    font-size: 1rem;
    margin: 0;
    line-height: 1.6;
    font-weight: 300;
  }

  .step-connector {
    width: 80px;
    height: 1px;
    background: var(--color-border);
    margin-top: 16px;
    flex-shrink: 0;
  }

  .steps-meta {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    font-family: var(--font-logo);
    margin: 0;
    padding-left: var(--space-sm);
  }

  /* ============================================
     ORIGIN SECTION
     ============================================ */
  .section-origin {
    border-bottom: 1px solid var(--color-border);
  }

  .origin-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xl);
    margin-bottom: var(--space-lg);
  }

  .origin-text p {
    color: var(--color-text-dim);
    margin: 0 0 var(--space-sm);
    font-size: 1.15rem;
    line-height: 1.7;
    font-weight: 300;
  }

  .origin-text a {
    color: var(--color-text);
    text-decoration: underline;
    text-underline-offset: 4px;
    text-decoration-thickness: 1px;
    transition: color 0.2s ease;
    font-weight: 400;
  }

  .origin-text a:hover {
    color: var(--color-text-muted);
  }

  .origin-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--color-border);
    border: 1px solid var(--color-border);
    align-content: start;
  }

  .stat {
    padding: var(--space-md);
    background: var(--color-bg);
  }

  .stat-number {
    display: block;
    font-family: var(--font-display);
    font-size: 2.5rem;
    color: var(--color-text);
    margin-bottom: 0.25rem;
    letter-spacing: -0.04em;
  }

  .stat-label {
    font-family: var(--font-logo);
    font-size: 0.75rem;
    color: var(--color-text-dim);
    text-transform: uppercase;
  }

  .origin-press {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-border);
    flex-wrap: wrap;
  }

  .press-label {
    font-family: var(--font-logo);
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .press-logos {
    display: flex;
    gap: var(--space-lg);
    flex-wrap: wrap;
    align-items: center;
  }

  .press-logo {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-text-muted);
    letter-spacing: -0.02em;
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }

  .press-logo:hover {
    opacity: 1;
    color: var(--color-text);
  }

  /* ============================================
     MADRID SECTION
     ============================================ */
  .section-madrid {
    text-align: center;
    padding: var(--space-2xl) 0;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-alt);
  }

  .madrid-text {
    font-size: 1.35rem;
    color: var(--color-text-dim);
    margin: 0 0 var(--space-sm);
    line-height: 1.6;
    font-weight: 300;
  }

  .madrid-invite {
    font-family: var(--font-body);
    font-size: 1.15rem;
    color: var(--color-text);
    margin: 0;
    font-weight: 500;
  }

  /* ============================================
     FAQ SECTION
     ============================================ */
  .section-faq {
    border-bottom: 1px solid var(--color-border);
  }

  .faq-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-lg);
  }

  .faq-item {
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--color-border);
  }

  .faq-question {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--color-text);
    margin: 0 0 0.75rem;
    letter-spacing: -0.01em;
  }

  .faq-answer {
    color: var(--color-text-dim);
    font-size: 1rem;
    margin: 0;
    line-height: 1.6;
    font-weight: 300;
  }

  /* ============================================
     CTA SECTION
     ============================================ */
  .section-cta {
    text-align: center;
    padding: var(--space-2xl) 0;
    background: radial-gradient(circle at 50% 100%, var(--color-bg-alt) 0%, var(--color-bg) 70%);
  }

  .cta-headline {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 5rem);
    font-weight: 400;
    color: var(--color-text);
    margin: 0 0 var(--space-lg);
    letter-spacing: -0.04em;
  }

  .cta-action {
    margin-bottom: var(--space-md);
  }

  .cta-meta {
    font-family: var(--font-logo);
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  /* ============================================
     FOOTER
     ============================================ */
  .footer {
    border-top: 1px solid var(--color-border);
    padding: var(--space-lg) var(--space-md);
    background: var(--color-bg);
  }

  .footer-inner {
    max-width: var(--max-width);
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .footer-brand {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .footer-logo {
    font-family: var(--font-logo);
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-text);
    text-transform: uppercase;
  }

  .footer-tagline {
    font-size: 0.85rem;
    color: var(--color-text-dim);
  }

  .footer-links {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .footer-label {
    font-family: var(--font-logo);
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  .footer-companies {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .footer-companies a {
    font-size: 0.9rem;
    color: var(--color-text-dim);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .footer-companies a:hover {
    color: var(--color-text);
  }

  /* ============================================
     RESPONSIVE — TABLET
     ============================================ */
  @media (max-width: 1024px) {
    .builders-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .origin-body {
      grid-template-columns: 1fr;
      gap: var(--space-lg);
    }

    .origin-stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* ============================================
     RESPONSIVE — MOBILE
     ============================================ */
  @media (max-width: 768px) {
    .page {
      font-size: 15px;
    }

    .section {
      padding: var(--space-xl) 0;
    }

    .hero {
      padding: var(--space-xl) var(--space-sm) var(--space-lg);
      text-align: left;
    }

    .hero-content {
      align-items: flex-start;
      text-align: left;
    }

    .container,
    .container-narrow {
      padding: 0 var(--space-sm);
    }

    .who-grid {
      grid-template-columns: 1fr;
    }

    .builders-grid {
      grid-template-columns: 1fr;
    }

    .benefits-grid {
      grid-template-columns: 1fr;
    }

    .steps-grid {
      flex-direction: column;
      gap: var(--space-lg);
    }

    .step-item {
      padding: 0;
    }

    .step-connector {
      width: 1px;
      height: 40px;
      margin: 0 0 0 16px;
    }

    .faq-grid {
      grid-template-columns: 1fr;
    }

    .footer-inner {
      flex-direction: column;
      gap: var(--space-lg);
    }

    .footer-links {
      align-items: flex-start;
    }

    .footer-companies {
      justify-content: flex-start;
    }

    .hero-scroll-hint {
      display: none;
    }

    .hero-cta {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-sm);
      justify-content: flex-start;
    }

    .press-logos {
      gap: var(--space-md);
    }

    .origin-press {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-sm);
    }
  }

  /* ============================================
     RESPONSIVE — SMALL MOBILE
     ============================================ */
  @media (max-width: 480px) {
    .hero-headline {
      font-size: 3rem;
    }

    .section-title {
      font-size: 2rem;
    }

    .origin-stats {
      grid-template-columns: 1fr;
    }

    .benefits-punchline p {
      font-size: 1.15rem;
    }
    
    .cta-headline {
      font-size: 2.5rem;
    }
  }
</style>
`;

  const startIndex = content.indexOf('<style>');
  const endIndex = content.lastIndexOf('</style>') + 8;

  if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + newStyle + content.substring(endIndex);
    await fs.writeFile('src/pages/index.astro', content);
    console.log('Style updated successfully.');
  } else {
    console.log('Style tags not found.');
  }
}

update().catch(console.error);

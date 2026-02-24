// ═══════════════════════════════════════════════════════════════
//  IOTA — Landing Page JavaScript
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // ── Nav scroll effect ────────────────────────────────────────
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  // ── Hamburger / mobile menu ──────────────────────────────────
  const hamburger  = document.getElementById('hamburger');
  const navLinks   = document.getElementById('nav-links');

  hamburger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('mobile-open');
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open);
  });

  // Close when clicking a link
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('mobile-open');
      hamburger.classList.remove('open');
    });
  });

  // Close when clicking outside
  document.addEventListener('click', e => {
    if (!nav.contains(e.target)) {
      navLinks.classList.remove('mobile-open');
      hamburger.classList.remove('open');
    }
  });

  // ── Smooth scroll ────────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 72;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ── Scroll reveal ────────────────────────────────────────────
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger children
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => observer.observe(el));

  // ── Use case tab interaction ─────────────────────────────────
  const useCaseItems = document.querySelectorAll('.use-case-item');
  useCaseItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      useCaseItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // ── Typewriter for hero ──────────────────────────────────────
  const typeEl = document.getElementById('hero-typewriter');
  if (typeEl) {
    const words = ['wireframe', 'prototype', 'design', 'iterate', 'ship'];
    let wi = 0, ci = 0, deleting = false;

    function typeLoop() {
      const word = words[wi];
      if (!deleting) {
        typeEl.textContent = word.slice(0, ++ci);
        if (ci === word.length) {
          setTimeout(() => { deleting = true; typeLoop(); }, 1800);
          return;
        }
      } else {
        typeEl.textContent = word.slice(0, --ci);
        if (ci === 0) {
          deleting = false;
          wi = (wi + 1) % words.length;
          setTimeout(typeLoop, 300);
          return;
        }
      }
      setTimeout(typeLoop, deleting ? 50 : 90 + Math.random() * 60);
    }

    typeLoop();
  }

  // ── Bento card hover depth effect ───────────────────────────
  document.querySelectorAll('.bento-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect  = card.getBoundingClientRect();
      const x     = (e.clientX - rect.left) / rect.width  - 0.5;
      const y     = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = `translateY(-2px) rotateX(${-y * 3}deg) rotateY(${x * 3}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // ── Demo shapes animation ────────────────────────────────────
  const demoShapes = document.querySelectorAll('.demo-shape');
  let shapeIndex = 0;
  setInterval(() => {
    demoShapes.forEach(s => s.style.transform = '');
    if (demoShapes[shapeIndex]) {
      demoShapes[shapeIndex].style.transform = 'scale(1.08) translateY(-4px)';
    }
    shapeIndex = (shapeIndex + 1) % demoShapes.length;
  }, 1200);

  // ── Counter animation for stats ──────────────────────────────
  function animateCounter(el, target, suffix = '') {
    let current = 0;
    const step  = target / 40;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.round(current) + suffix;
      if (current >= target) clearInterval(timer);
    }, 30);
  }

  const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const val = el.dataset.count;
        if (val) animateCounter(el, parseFloat(val), el.dataset.suffix || '');
        statsObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => statsObserver.observe(el));

  // ── Add reveal classes to all major sections ─────────────────
  const revealTargets = [
    '.hero-badge',
    '.hero-h1',
    '.hero-sub',
    '.hero-actions',
    '.hero-social-proof',
    '.trust-bar',
    '.bento-card',
    '.use-case-item',
    '.process-step',
    '.stat-item',
    '.pricing-card',
    '.final-cta-text',
  ];

  revealTargets.forEach((selector, si) => {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.classList.add('reveal');
      el.dataset.delay = (i * 80).toString();
    });
  });

  // Re-observe after adding classes
  document.querySelectorAll('.reveal').forEach(el => {
    if (!el.classList.contains('visible')) {
      observer.observe(el);
    }
  });

});

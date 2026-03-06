/**
 * landing.js – SPiST Library Landing Page
 * Handles: navbar scroll, mobile toggle, scroll reveal, active nav tracking
 */

(function () {
  'use strict';

  const nav = document.getElementById('landingNav');
  const navToggle = document.getElementById('navToggle');
  const allNavLinks = document.querySelectorAll('.nav-links .nav-link');
  const sections = document.querySelectorAll('section[id]');

  // ---- Navbar: add scrolled class on scroll ----
  function handleNavScroll() {
    if (!nav) return;
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  // ---- Mobile nav toggle (sidebar open/close) ----
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
    });

    // Close sidebar on link click (mobile)
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
      });
    });
  }

  // ---- Active nav link tracking via IntersectionObserver ----
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        allNavLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(section => navObserver.observe(section));

  // ---- Scroll Reveal via IntersectionObserver ----
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target); // animate once
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ---- Attach scroll listener ----
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll(); // run on page load

})();

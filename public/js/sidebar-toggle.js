/**
 * sidebar-toggle.js — Mobile sidebar hamburger + overlay logic
 * Include on every dashboard page (defer).
 *
 * Expects the following elements to be injected by this script:
 *   <button class="sidebar-toggle">  — hamburger button
 *   <div class="sidebar-overlay">    — dark backdrop
 *
 * Works with:
 *   aside.sidebar          (admin / super-admin pages)
 *   aside.sidebar-container (student pages)
 */
(function () {
  'use strict';

  /* ── 1. Detect which sidebar element exists ───────────────────── */
  var sidebar =
    document.querySelector('aside.sa-sidebar') ||
    document.querySelector('.u-sidebar') ||
    document.querySelector('aside.sidebar-container') ||
    document.querySelector('aside.sidebar');

  if (!sidebar) return;                // no sidebar on this page

  /* ── 2. Create hamburger button ───────────────────────────────── */
  var btn = document.createElement('button');
  btn.className = 'sidebar-toggle';
  btn.setAttribute('aria-label', 'Toggle sidebar');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
  document.body.appendChild(btn);

  /* ── 3. Create overlay backdrop ───────────────────────────────── */
  var overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  /* ── 4. Toggle helpers ────────────────────────────────────────── */
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.classList.add('sidebar-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
  }

  function toggleSidebar() {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  /* ── 5. Event listeners ───────────────────────────────────────── */
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  // Close sidebar when a nav link is clicked (mobile UX)
  sidebar.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      // Small delay so the navigation starts before closing animation
      setTimeout(closeSidebar, 150);
    });
  });

  // Close sidebar on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // Auto-close if window resizes above the breakpoint
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });
})();

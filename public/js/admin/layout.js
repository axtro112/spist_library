/*
FILE: layout.js

PURPOSE
Shared super admin layout bootstrapper.

CONNECTED TO
views/partials/super-admin-layout.ejs

HANDLES
session hydration
notification bell panel toggle
page bootstrap by active page
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Admin = w.App.Admin || {};

  function hydrateSessionFromDataset() {
    var body = document.body;
    if (!body) return;
    var adminId = body.getAttribute('data-admin-id') || '';
    var adminRole = body.getAttribute('data-admin-role') || '';
    if (!adminId || !adminRole) return;

    if (sessionStorage.getItem('isLoggedIn') !== 'true') sessionStorage.setItem('isLoggedIn', 'true');
    if (!sessionStorage.getItem('adminId')) sessionStorage.setItem('adminId', adminId);
    if (!sessionStorage.getItem('adminRole')) sessionStorage.setItem('adminRole', adminRole);
    if (!sessionStorage.getItem('userRole')) sessionStorage.setItem('userRole', 'admin');
  }

  function initNotificationBell() {
    var bell = document.getElementById('superAdminNotifBell');
    var panel = document.getElementById('superAdminNotifPanel');
    var badge = document.getElementById('superAdminNotifBadge');
    if (!bell || !panel || !badge) return;

    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.style.display === 'block';
      panel.style.display = open ? 'none' : 'block';
      bell.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', function (e) {
      if (!bell.contains(e.target) && !panel.contains(e.target)) panel.style.display = 'none';
    });

    async function loadBadge() {
      var doFetch = typeof w.fetchWithCsrf === 'function' ? w.fetchWithCsrf : fetch;
      try {
        var r = await doFetch('/api/notifications/unread-count', { credentials: 'include' });
        if (!r.ok) return;
        var d = await r.json();
        var c = d.count || 0;
        badge.textContent = c;
        badge.style.display = c > 0 ? 'flex' : 'none';
      } catch (e) {
        // Non-fatal.
      }
    }

    loadBadge();
    setInterval(loadBadge, 30000);
  }

  function bootstrapPage() {
    var page = (document.body && document.body.getAttribute('data-active-page')) || '';
    if (page === 'dashboard' && w.SuperAdmin && w.SuperAdmin.Dashboard) return w.SuperAdmin.Dashboard.init();
    if (page === 'books' && w.SuperAdmin && w.SuperAdmin.BooksPage) return w.SuperAdmin.BooksPage.init();
    if (page === 'users' && w.SuperAdmin && w.SuperAdmin.UsersPage) return w.SuperAdmin.UsersPage.init();
    if ((page === 'borrowed-books' || page === 'borrowed') && w.SuperAdmin && w.SuperAdmin.BorrowedPage) return w.SuperAdmin.BorrowedPage.init();
    if (page === 'admins' && w.SuperAdmin && w.SuperAdmin.AdminsPage) return w.SuperAdmin.AdminsPage.init();
    if (page === 'admins-trash' && w.SuperAdmin && w.SuperAdmin.AdminsTrashPage) return w.SuperAdmin.AdminsTrashPage.init();
    if (page === 'books-trash' && w.SuperAdmin && w.SuperAdmin.BooksTrashPage) return w.SuperAdmin.BooksTrashPage.init();
    if (page === 'users-trash' && w.SuperAdmin && w.SuperAdmin.UsersTrashPage) return w.SuperAdmin.UsersTrashPage.init();
    if (page === 'trash' && w.AdminTrash && typeof w.AdminTrash.init === 'function') return w.AdminTrash.init();
  }

  function init() {
    hydrateSessionFromDataset();
    initNotificationBell();
    bootstrapPage();
  }

  document.addEventListener('DOMContentLoaded', init);

  w.App.Admin.Layout = { init: init };
})(window);

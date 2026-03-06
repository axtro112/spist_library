/* ═══════════════════════════════════════════════
   Super Admin — Books Page init
   Handles auth guard + header. All book CRUD logic
   is in the existing /js/books.js, /js/book-profile-modal.js, etc.
   window.SuperAdmin.BooksPage.init()
   ═══════════════════════════════════════════════ */
(function (SA) {
  'use strict';

  function init() {
    const s = SA.utils.getSession();
    if (!s || s.adminRole !== 'super_admin') {
      alert('Access denied. Super Admin privileges required.');
      window.location.href = '/login';
      return;
    }
    SA.utils.loadAdminHeader(s.adminId);
  }

  SA.BooksPage = { init };

})(window.SuperAdmin = window.SuperAdmin || {});

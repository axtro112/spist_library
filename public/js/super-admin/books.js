/* ═══════════════════════════════════════════════
   Super Admin — Books Page init
   Handles auth guard + header. All book CRUD logic
   is in the existing /js/books.js, /js/book-profile-modal.js, etc.
   window.SuperAdmin.BooksPage.init()
   ═══════════════════════════════════════════════ */
(function (SA) {
  'use strict';

  async function recoverSessionIfNeeded() {
    if (sessionStorage.getItem('isLoggedIn') === 'true' && sessionStorage.getItem('adminRole')) {
      return;
    }

    if (window.AuthHelper && typeof window.AuthHelper.ensureAdminSessionFromServer === 'function') {
      await window.AuthHelper.ensureAdminSessionFromServer();
      return;
    }

    try {
      var response = await fetch('/api/debug/session', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        keepalive: true
      });
      if (!response.ok) return;

      var payload = await response.json().catch(function () { return null; });
      var user = payload && payload.sessionData && payload.sessionData.user;
      if (user && user.userRole === 'admin' && user.id) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('adminId', String(user.id));
        if (user.role) sessionStorage.setItem('adminRole', user.role);
      }
    } catch (_) {
      // Ignore; normal guard logic will handle unauthorized users.
    }
  }

  async function init() {
    await recoverSessionIfNeeded();
    const s = SA.utils.getSession();
    if (!s || s.adminRole !== 'super_admin') {
      alert('Access denied. Super Admin privileges required.');
      window.location.href = '/login';
      return;
    }
    
    // Extended delay to ensure backend session is fully loaded from store
    // on hard refresh (100ms gives enough time for MySQL session store)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    SA.utils.loadAdminHeader(s.adminId);
  }

  SA.BooksPage = { init };

})(window.SuperAdmin = window.SuperAdmin || {});

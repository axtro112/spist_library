/**
 * SuperAdmin.AdminsPage
 * Init module for the Admin Management page.
 * Actual CRUD logic lives in admin-management.js (window.adminManager).
 * Depends on: super-admin/utils.js, admin-management.js
 */
(function (SA) {
  'use strict';

  async function init() {
    if (!SA.utils.guardSuperAdmin()) return;

    // Extended delay to ensure backend session is fully loaded from store
    // on hard refresh (100ms gives enough time for MySQL session store)
    await new Promise(resolve => setTimeout(resolve, 100));

    var session = SA.utils.getSession();

    // Expose these for the current-user check used in admin-management.js
    window.currentAdminRole = session.adminRole;
    window.currentAdminId   = session.adminId;

    await SA.utils.loadAdminHeader(session.adminId);

    if (window.adminManager) {
      window.adminManager.currentAdminRole = session.adminRole;
      window.adminManager.currentAdminId = session.adminId;
      var addBtn = document.getElementById('addAdminBtn');
      if (addBtn && session.adminRole === 'super_admin') addBtn.style.display = 'flex';
      await window.adminManager.loadAdmins();
    }
  }

  SA.AdminsPage = { init: init };

}(window.SuperAdmin = window.SuperAdmin || {}));

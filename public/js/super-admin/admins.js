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

    var session = SA.utils.getSession();

    // Expose these for the current-user check used in admin-management.js
    window.currentAdminRole = session.adminRole;
    window.currentAdminId   = session.adminId;

    await SA.utils.loadAdminHeader(session.adminId);

    if (window.adminManager) {
      await window.adminManager.loadAdmins();
    }
  }

  SA.AdminsPage = { init: init };

}(window.SuperAdmin = window.SuperAdmin || {}));

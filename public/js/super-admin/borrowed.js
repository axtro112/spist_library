/**
 * SuperAdmin.BorrowedPage
 * Init module for the Borrowed Books Management page.
 * Actual table/filter logic lives in borrowed-books.js.
 * Depends on: super-admin/utils.js, borrowed-books.js
 */
(function (SA) {
  'use strict';

  async function init() {
    if (!SA.utils.guardSuperAdmin()) return;

    // Extended delay to ensure backend session is fully loaded from store
    // on hard refresh (100ms gives enough time for MySQL session store)
    await new Promise(resolve => setTimeout(resolve, 100));

    var session = SA.utils.getSession();
    await SA.utils.loadAdminHeader(session.adminId);

    // borrowed-books.js auto-initialises via its own DOMContentLoaded listener;
    // nothing extra is required here.
  }

  SA.BorrowedPage = { init: init };

}(window.SuperAdmin = window.SuperAdmin || {}));

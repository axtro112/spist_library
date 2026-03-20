/*
FILE: dashboard.js

PURPOSE
Admin dashboard page bootstrap entry.

CONNECTED TO
views/super-admin/dashboard.ejs

HANDLES
safe initialization of dashboard module
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Admin = w.App.Admin || {};

  function init() {
    if (w.SuperAdmin && w.SuperAdmin.Dashboard && typeof w.SuperAdmin.Dashboard.init === 'function') {
      return w.SuperAdmin.Dashboard.init();
    }

      if (w.SystemAdmin && w.SystemAdmin.Dashboard && typeof w.SystemAdmin.Dashboard.init === 'function') {
        return w.SystemAdmin.Dashboard.init();
      }
  }

  w.App.Admin.DashboardPage = { init: init };

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    w.App.Admin.DashboardPage.init();
  });
})(window);

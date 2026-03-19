/*
FILE: audit.js

PURPOSE
Bootstrap helper for audit logs page.

CONNECTED TO
views/super-admin/audit-logs.ejs

HANDLES
admin header hydration
*/
(function (w) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (w.SuperAdmin && w.SuperAdmin.utils && typeof w.SuperAdmin.utils.getSession === 'function') {
      var s = w.SuperAdmin.utils.getSession();
      if (w.SuperAdmin.utils.loadAdminHeader) w.SuperAdmin.utils.loadAdminHeader(s.adminId);
    }
  });
})(window);

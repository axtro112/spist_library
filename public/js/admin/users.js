/*
FILE: users.js

PURPOSE
Admin users/admins page bootstrap entry.

CONNECTED TO
views/super-admin/users.ejs
views/super-admin/admins.ejs

HANDLES
safe initialization of users/admins modules
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Admin = w.App.Admin || {};

  function initUsers() {
    if (w.SuperAdmin && w.SuperAdmin.UsersPage && typeof w.SuperAdmin.UsersPage.init === 'function') {
      return w.SuperAdmin.UsersPage.init();
    }
  }

  function initAdmins() {
    if (w.SuperAdmin && w.SuperAdmin.AdminsPage && typeof w.SuperAdmin.AdminsPage.init === 'function') {
      return w.SuperAdmin.AdminsPage.init();
    }
  }

  w.App.Admin.UsersPage = {
    initUsers: initUsers,
    initAdmins: initAdmins
  };
})(window);

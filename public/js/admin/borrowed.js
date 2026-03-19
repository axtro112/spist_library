/*
FILE: borrowed.js

PURPOSE
Admin borrowed books page bootstrap entry.

CONNECTED TO
views/super-admin/borrowed-books.ejs

HANDLES
safe initialization of borrowed module
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Admin = w.App.Admin || {};

  function init() {
    if (w.SuperAdmin && w.SuperAdmin.BorrowedPage && typeof w.SuperAdmin.BorrowedPage.init === 'function') {
      return w.SuperAdmin.BorrowedPage.init();
    }
  }

  w.App.Admin.BorrowedPage = { init: init };
})(window);

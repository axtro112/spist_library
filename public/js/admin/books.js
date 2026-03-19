/*
FILE: books.js

PURPOSE
Admin books page bootstrap entry.

CONNECTED TO
views/super-admin/books.ejs

HANDLES
safe initialization of books module
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Admin = w.App.Admin || {};

  function init() {
    if (w.SuperAdmin && w.SuperAdmin.BooksPage && typeof w.SuperAdmin.BooksPage.init === 'function') {
      return w.SuperAdmin.BooksPage.init();
    }
  }

  w.App.Admin.BooksPage = { init: init };
})(window);

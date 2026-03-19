/*
FILE: trash-bootstrap.js

PURPOSE
Bootstrap helper for unified trash page.

CONNECTED TO
views/super-admin/trash.ejs

HANDLES
Trash.init startup with current admin role
*/
(function (w) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var serverRole = (document.body && document.body.getAttribute('data-admin-role')) || '';
    var clientRole = sessionStorage.getItem('adminRole') || '';
    if (w.Trash && typeof w.Trash.init === 'function') {
      w.Trash.init({ adminRole: serverRole || clientRole });
    }
  });
})(window);

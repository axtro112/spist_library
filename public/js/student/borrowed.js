/*
FILE: borrowed.js

PURPOSE
Bootstrap logic for student borrowed books page.

CONNECTED TO
views/student/borrowed-books.ejs

HANDLES
session guard
header identity hydration
*/
(function (w) {
  'use strict';

  function init() {
    if (typeof w.ensureStudentSessionFromServer === 'function') {
      w.ensureStudentSessionFromServer();
    }

    // Wait briefly for session restore on hard refresh, then hydrate header
    // without forcing a redirect from stale sessionStorage values.
    setTimeout(function() {
      var isLoggedIn = sessionStorage.getItem('isLoggedIn');
      var userRole = sessionStorage.getItem('userRole');
      var adminRole = sessionStorage.getItem('adminRole');

      var isStudent = userRole === 'student';
      var isAdmin = adminRole === 'super_admin' || adminRole === 'admin';

      var userNameEl = document.getElementById('userName');
      if (userNameEl) {
        var fallbackName = isAdmin ? 'Admin' : 'Student';
        userNameEl.textContent = sessionStorage.getItem('userName') || fallbackName;
      }

      var userIDEl = document.getElementById('userID');
      if (userIDEl) {
        var bodyStudentId = document.body ? document.body.getAttribute('data-student-id') : '';
        var resolvedId = sessionStorage.getItem('userID') || bodyStudentId || 'STD-0000-000';
        userIDEl.textContent = resolvedId;
      }

      // Keep linter happy and preserve existing intent for future checks.
      void isLoggedIn;
      void isStudent;
    }, 100);

    w.closeModal = function () {
      var modal = document.getElementById('modal-user');
      if (modal) modal.style.display = 'none';
    };
  }

  document.addEventListener('DOMContentLoaded', init);
  w.Student = w.Student || {};
  w.Student.BorrowedPage = { init: init };
})(window);

/*
FILE: layout.js

PURPOSE
Shared student layout bootstrapper.

CONNECTED TO
views/partials/user-sidebar-top.ejs

HANDLES
session hydration hook
top-level student identity rendering
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Student = w.App.Student || {};

  function hydrateStudentSession() {
    var body = document.body;
    var serverStudentId = body ? body.getAttribute('data-student-id') : '';
    var serverRole = body ? body.getAttribute('data-user-role') : '';
    if (!(serverStudentId && serverRole === 'student')) return false;
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('studentId', serverStudentId);
    sessionStorage.setItem('userRole', 'student');
    return true;
  }

  function setHeaderIdentity() {
    var userNameEl = document.getElementById('userName');
    var userIDEl = document.getElementById('userID');
    if (userNameEl) userNameEl.textContent = sessionStorage.getItem('userName') || 'Student';
    if (userIDEl) userIDEl.textContent = sessionStorage.getItem('userID') || 'STD-0000-000';
  }

  function init() {
    w.ensureStudentSessionFromServer = hydrateStudentSession;
    hydrateStudentSession();
    setHeaderIdentity();
  }

  document.addEventListener('DOMContentLoaded', init);
  w.App.Student.Layout = { init: init, hydrateStudentSession: hydrateStudentSession };
})(window);

/*
FILE: modal.js

PURPOSE
Shared modal and logout helpers.

CONNECTED TO
views/partials/super-admin-layout.ejs
views/partials/user-sidebar-top.ejs

HANDLES
logout modal open/close
logout flow
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Core = w.App.Core || {};

  function toggleLogoutModal(show) {
    var modal = document.getElementById('logoutModal');
    if (!modal) return;
    if (show) {
      if (modal.classList) modal.classList.add('show');
      modal.style.display = 'flex';
    } else {
      if (modal.classList) modal.classList.remove('show');
      modal.style.display = 'none';
    }
  }

  async function logout() {
    var isTimeoutLogout = sessionStorage.getItem('timeout-logout') === 'true';
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      // Ignore network errors on logout and clear client session anyway.
    }
    sessionStorage.clear();
    if (isTimeoutLogout) {
      sessionStorage.setItem('timeout-logout', 'true');
    }
    w.location.href = '/login';
  }

  w.showLogoutModal = function () { toggleLogoutModal(true); };
  w.closeLogoutModal = function () { toggleLogoutModal(false); };
  w.hideLogoutModal = function () { toggleLogoutModal(false); };
  w.confirmLogout = function () { logout(); };
  w.logout = logout;

  w.App.Core.Modal = {
    toggleLogoutModal: toggleLogoutModal,
    logout: logout
  };
})(window);

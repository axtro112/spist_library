/**
 * system-admin/users-utils-adapter.js
 * Compatibility layer so shared users page logic can run on System Admin pages.
 */
(function (SA) {
  'use strict';

  var utils = {};
  var _intervals = [];

  utils.safeFetch = async function (url, options) {
    options = Object.assign({ credentials: 'include' }, options || {});
    try {
      var doFetch = typeof window.fetchWithCsrf === 'function' ? window.fetchWithCsrf : fetch;
      var response = await doFetch(url, options);
      if (!response.ok) {
        var isAdminApi = typeof url === 'string' && url.indexOf('/api/admin/') === 0;
        if (isAdminApi && response.status === 401 && !window.__adminAuthRedirecting) {
          window.__adminAuthRedirecting = true;
          sessionStorage.clear();
          setTimeout(function () { window.location.href = '/login'; }, 600);
        }
        throw new Error('HTTP ' + response.status + ' ' + response.statusText + ' - ' + url);
      }
      return await response.json();
    } catch (err) {
      console.error('[SystemAdmin.Users] Fetch error:', err.message);
      return null;
    }
  };

  utils.getSession = function () {
    var body = document.body;
    if (body) {
      var datasetAdminId = body.getAttribute('data-admin-id') || '';
      var datasetAdminRole = body.getAttribute('data-admin-role') || '';
      if (datasetAdminId) sessionStorage.setItem('adminId', datasetAdminId);
      if (datasetAdminRole) sessionStorage.setItem('adminRole', datasetAdminRole);
      if (datasetAdminId || datasetAdminRole) {
        if (sessionStorage.getItem('isLoggedIn') !== 'true') sessionStorage.setItem('isLoggedIn', 'true');
        if (!sessionStorage.getItem('userRole')) sessionStorage.setItem('userRole', 'admin');
      }
    }

    return {
      isLoggedIn: sessionStorage.getItem('isLoggedIn'),
      userRole: sessionStorage.getItem('userRole'),
      adminRole: sessionStorage.getItem('adminRole'),
      adminId: sessionStorage.getItem('adminId')
    };
  };

  // Keep original method name expected by shared users module.
  utils.guardSuperAdmin = function () {
    var s = utils.getSession();
    if (s.isLoggedIn !== 'true' || s.userRole !== 'admin') {
      window.location.href = '/login';
      return false;
    }

    // System Admin users page must remain restricted to system admins.
    if (s.adminRole !== 'system_admin') {
      window.location.href = '/login';
      return false;
    }

    return true;
  };

  utils.setText = function (id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text !== undefined && text !== null ? text : '';
  };

  utils.loadAdminHeader = async function (adminId) {
    var result = await utils.safeFetch('/api/admin/' + adminId);
    if (!result) return null;
    var admin = result.data || result;
    utils.setText('adminName', admin.fullname || 'Admin');
    utils.setText('adminEmail', admin.email || '');
    utils.setText('adminRole', 'System Admin');
    utils.setText('adminInitial', (admin.fullname || 'A').charAt(0).toUpperCase());
    return admin;
  };

  utils.addInterval = function (fn, ms) {
    var id = setInterval(fn, ms);
    _intervals.push(id);
    return id;
  };

  utils.clearAllIntervals = function () {
    _intervals.forEach(clearInterval);
    _intervals.length = 0;
  };

  SA.utils = SA.utils || utils;
}(window.SuperAdmin = window.SuperAdmin || {}));

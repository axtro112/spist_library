/**
 * SuperAdmin.utils
 * Shared utilities for all Super Admin pages.
 * Loaded by super-admin-layout.ejs before any page-specific module.
 */
(function (SA) {
  'use strict';

  const utils = {};

  // ── safeFetch ─────────────────────────────────────────────────────────────
  // Wraps fetch() with JSON parsing, HTTP error detection, and error logging.
  // Returns parsed data on success, null on failure — never throws.
  utils.safeFetch = async function (url, options) {
    options = Object.assign({ credentials: 'include' }, options || {});
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' ' + response.statusText + ' — ' + url);
      }
      return await response.json();
    } catch (err) {
      console.error('[SuperAdmin] Fetch error:', err.message);
      return null;
    }
  };

  // ── getSession ────────────────────────────────────────────────────────────
  // Returns the four session values stored by the auth flow.
  utils.getSession = function () {
    return {
      isLoggedIn: sessionStorage.getItem('isLoggedIn'),
      userRole:   sessionStorage.getItem('userRole'),
      adminRole:  sessionStorage.getItem('adminRole'),
      adminId:    sessionStorage.getItem('adminId'),
    };
  };

  // ── guardSuperAdmin ───────────────────────────────────────────────────────
  // Returns true when the session is valid. Redirects + returns false otherwise.
  utils.guardSuperAdmin = function () {
    const s = utils.getSession();
    if (
      s.isLoggedIn !== 'true' ||
      s.userRole   !== 'admin' ||
      s.adminRole  !== 'super_admin'
    ) {
      alert('Access denied. Super Admin privileges required.');
      window.location.href = '/login';
      return false;
    }
    return true;
  };

  // ── setText ───────────────────────────────────────────────────────────────
  // Sets element text content safely — no-op when element is absent.
  utils.setText = function (id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text !== undefined && text !== null ? text : '';
  };

  // ── loadAdminHeader ───────────────────────────────────────────────────────
  // Fills the layout header (adminName / adminEmail / adminRole / adminInitial).
  // Returns the resolved admin object, or null on error.
  utils.loadAdminHeader = async function (adminId) {
    var result = await utils.safeFetch('/api/admin/' + adminId);
    if (!result) return null;
    var admin = result.data || result;
    utils.setText('adminName',    admin.fullname || 'Admin');
    utils.setText('adminEmail',   admin.email    || '');
    utils.setText('adminRole',    'Super Admin');
    utils.setText('adminInitial', (admin.fullname || 'A').charAt(0).toUpperCase());
    return admin;
  };

  // ── Interval registry ────────────────────────────────────────────────────
  // Keeps track of setInterval handles so the page can clean them up cleanly.
  var _intervals = [];

  utils.addInterval = function (fn, ms) {
    var id = setInterval(fn, ms);
    _intervals.push(id);
    return id;
  };

  utils.clearAllIntervals = function () {
    _intervals.forEach(clearInterval);
    _intervals.length = 0;
  };

  SA.utils = utils;

}(window.SuperAdmin = window.SuperAdmin || {}));

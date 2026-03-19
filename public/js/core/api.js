/*
FILE: api.js

PURPOSE
Core API helper namespace and shared request wrappers.

CONNECTED TO
views/partials/super-admin-layout.ejs
views/partials/user-sidebar-top.ejs

HANDLES
safe request helper
JSON parsing helper
*/
(function (w) {
  'use strict';

  w.App = w.App || {};
  w.App.Core = w.App.Core || {};

  async function requestJson(url, options) {
    var doFetch = typeof w.fetchWithCsrf === 'function' ? w.fetchWithCsrf : fetch;
    var res = await doFetch(url, options || {});
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: res.ok, status: res.status, data: data, response: res };
  }

  w.App.Core.requestJson = requestJson;
})(window);

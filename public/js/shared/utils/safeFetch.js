/* ═══════════════════════════════════════════════
   SafeFetch — lightweight fetch wrapper
   Handles credentials, JSON body, 401 redirect.
   Used by all admin trash modules.
   ═══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  async function doRequest(method, url, body) {
    const isGet = method === 'GET';
    const options = { method, credentials: 'include', headers: {} };
    if (!isGet && body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      // Use fetchWithCsrf for state-changing requests when available
      const execFetch = (!isGet && typeof fetchWithCsrf === 'function') ? fetchWithCsrf : fetch;
      res = await execFetch(url, options);
    } catch (networkErr) {
      console.error('[SafeFetch] Network error:', networkErr.message);
      return { ok: false, status: 0, data: null };
    }

    if (res.status === 401) {
      sessionStorage.clear();
      window.location.href = '/login';
      return { ok: false, status: 401, data: null };
    }

    let data = null;
    try { data = await res.json(); } catch (_) { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, data };
  }

  global.SafeFetch = {
    get:    (url)       => doRequest('GET',    url),
    post:   (url, body) => doRequest('POST',   url, body),
    delete: (url, body) => doRequest('DELETE', url, body),
  };

})(window);

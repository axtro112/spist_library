/* =============================================================
   Super / System Admin — Overview Panel Module
   window.SuperAdmin.Overview = { init, open, close }
   window.SystemAdmin.Overview = same instance (alias)

   Safe delegated row click — does NOT break existing handlers.
   Only rows with data-overview-type + data-overview-id trigger it.
   API calls use ONLY existing endpoints (no new backend routes).
   ============================================================= */
(function () {
  'use strict';

  window.SuperAdmin  = window.SuperAdmin  || {};
  window.SystemAdmin = window.SystemAdmin || {};

  var Overview = (function () {
    var _bound = false;

    // ── DOM helpers ───────────────────────────────────────────
    function _el(id) { return document.getElementById(id); }

    function _nodes() {
      return {
        overlay  : _el('saOverviewOverlay'),
        panel    : _el('saOverviewPanel'),
        title    : _el('saOverviewTitle'),
        body     : _el('saOverviewBody'),
        closeBtn : _el('saOverviewCloseBtn'),
      };
    }

    function _isReady() {
      var n = _nodes();
      return !!(n.overlay && n.panel && n.title && n.body);
    }

    function _isOpen() {
      var o = _el('saOverviewOverlay');
      return !!(o && o.classList.contains('is-open'));
    }

    // ── Open / close ──────────────────────────────────────────
    function _openShell(titleText) {
      var n = _nodes();
      if (!_isReady()) return;

      n.title.textContent = titleText || 'Overview';
      n.body.innerHTML =
        '<div class="sa-overview-loading">' +
          '<div class="spinner-border text-success" role="status" aria-label="Loading"></div>' +
          '<div>Loading details...</div>' +
        '</div>';

      n.overlay.classList.add('is-open');
      n.panel.classList.add('is-open');
      n.overlay.setAttribute('aria-hidden', 'false');
      n.panel.setAttribute('aria-hidden', 'false');
    }

    function close() {
      var n = _nodes();
      if (!n.overlay || !n.panel) return;
      n.overlay.classList.remove('is-open');
      n.panel.classList.remove('is-open');
      n.panel.classList.remove('sa-overview-mode-user');
      n.overlay.setAttribute('aria-hidden', 'true');
      n.panel.setAttribute('aria-hidden', 'true');
    }

    // ── Click guard ───────────────────────────────────────────
    // Return true when the click should NOT open the overview.
    function _ignore(target) {
      if (!target) return true;
      // Explicit opt-out attribute
      if (target.closest('[data-no-overview]')) return true;
      // Any interactive element or common button classes
      if (target.closest('button, a, input, label, select, textarea')) return true;
      if (target.closest('.action-btn, .btn, .sa-btn, .dropdown-item')) return true;
      return false;
    }

    // ── Fetch helper ──────────────────────────────────────────
    async function _fetch(url) {
      try {
        var doFetch = (typeof fetchWithCsrf === 'function') ? fetchWithCsrf : fetch;
        var res = await doFetch(url, { credentials: 'same-origin' });
        var ct  = res.headers.get('content-type') || '';
        var payload = ct.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) {
          var isAdminApi = typeof url === 'string' && url.indexOf('/api/admin/') === 0;
          if (isAdminApi && res.status === 401 && !window.__adminAuthRedirecting) {
            window.__adminAuthRedirecting = true;
            sessionStorage.removeItem('adminId');
            sessionStorage.removeItem('adminRole');
            sessionStorage.removeItem('userRole');
            sessionStorage.removeItem('isLoggedIn');
            setTimeout(function () { window.location.href = '/login'; }, 600);
          }
          var msg = (payload && payload.message) ||
                    (typeof payload === 'string' ? payload : '') ||
                    ('HTTP ' + res.status);
          throw new Error(msg);
        }
        return { ok: true, data: payload };
      } catch (err) {
        console.error('[Overview] fetch', url, err);
        return { ok: false, error: err };
      }
    }

    // Unwrap {data: ...} or direct object
    function _pick(payload) {
      if (payload == null) return null;
      return (payload.data != null) ? payload.data : payload;
    }

    // ── HTML helpers ──────────────────────────────────────────
    function _esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function _card(headText, iconClass, inner) {
      var icon = iconClass ? '<i class="' + iconClass + '"></i> ' : '';
      return '<div class="sa-overview-card">' +
               '<div class="sa-overview-card-title">' + icon + _esc(headText) + '</div>' +
               inner +
             '</div>';
    }

    function _kv(label, value) {
      var safeVal = (value == null || value === '') ? '—' : String(value);
      return '<div class="sa-overview-k">' + _esc(label) + '</div>' +
             '<div class="sa-overview-v" title="' + _esc(safeVal) + '">' + _esc(safeVal) + '</div>';
    }

    // Like _kv but renders value as raw HTML (for badges)
    function _kvRaw(label, rawHtml) {
      return '<div class="sa-overview-k">' + _esc(label) + '</div>' +
             '<div class="sa-overview-v">' + (rawHtml || '—') + '</div>';
    }

    function _kvGrid(pairs) {
      var html = '<div class="sa-overview-kv">';
      for (var i = 0; i < pairs.length; i++) {
        // If the third element is true, treat value as raw HTML
        if (pairs[i][2] === 'raw') {
          html += _kvRaw(pairs[i][0], pairs[i][1]);
        } else {
          html += _kv(pairs[i][0], pairs[i][1]);
        }
      }
      html += '</div>';
      return html;
    }

    function _badge(text, color) {
      // color: 'green' | 'red' | 'amber' | 'gray'
      var cls = 'sa-overview-badge sa-overview-badge-' + (color || 'gray');
      return '<span class="' + cls + '">' + _esc(text) + '</span>';
    }

    function _empty(msg) {
      return '<div class="sa-overview-empty">' + _esc(msg || 'No data available.') + '</div>';
    }

    // ── Render helpers ────────────────────────────────────────
    function _setBody(html) {
      var b = _el('saOverviewBody');
      if (b) b.innerHTML = html || '';
    }

    function _setTitle(text) {
      var t = _el('saOverviewTitle');
      if (t) t.textContent = text || 'Overview';
    }

    function _setMode(type) {
      var n = _nodes();
      if (!n.panel) return;
      n.panel.classList.remove('sa-overview-mode-user');
      if (String(type || '').toLowerCase() === 'user') {
        n.panel.classList.add('sa-overview-mode-user');
      }
    }

    function _renderError(msg) {
      _setBody(_empty(msg || 'Failed to load data.'));
    }

    // ── User overview ─────────────────────────────────────────
    // Endpoints:
    //   GET /api/students/:studentId
    //   GET /api/book-borrowings/:studentId
    async function _loadUser(studentId) {
      var userRes = await _fetch('/api/students/' + encodeURIComponent(studentId));
      if (!userRes.ok) return _renderError('Failed to load user details.');

      var u   = _pick(userRes.data) || {};
      var name    = u.fullname   || u.name         || '—';
      var email   = u.email      || '—';
      var dept    = u.department || u.course        || '—';
      var year    = u.year_level || u.yearLevel     || '—';
      var contact = u.contact_number || u.contactNumber || '—';
      var sid     = u.student_id || studentId;
      var status  = u.status     || '—';

      _setTitle(name);

      // Borrowings
      var borRes = await _fetch('/api/book-borrowings/' + encodeURIComponent(studentId));
      var borrowCount = 0;
      var nextDue     = 'No active rentals';
      var bookItems   = '';

      if (borRes.ok) {
        var bd = _pick(borRes.data) || {};
        borrowCount = bd.total_borrowed || 0;

        if (Array.isArray(bd.books) && bd.books.length > 0) {
          // Earliest due date
          var dueDates = bd.books
            .map(function (b) { return b.due_date ? new Date(b.due_date) : null; })
            .filter(function (d) { return d && !isNaN(d.getTime()); });
          if (dueDates.length) {
            var minDate = new Date(Math.min.apply(null, dueDates));
            nextDue = minDate.toLocaleDateString();
          }

          bookItems = '<ul class="sa-overview-list">' +
            bd.books.map(function (b) {
              var statusBadge = '';
              var st = (b.status || '').toLowerCase();
              if (st === 'overdue')   statusBadge = _badge('Overdue', 'red');
              else if (st === 'borrowed') statusBadge = _badge('Borrowed', 'amber');
              else                    statusBadge = _badge(b.status || 'Active', 'green');

              var due = b.due_date ? ' · Due ' + new Date(b.due_date).toLocaleDateString() : '';
              return '<li>' +
                       '<span style="font-weight:600">' + _esc(b.title || '—') + '</span>' + due +
                       ' ' + statusBadge +
                     '</li>';
            }).join('') +
          '</ul>';
        }
      }

      if (!bookItems) bookItems = _empty('No active borrowed books.');

      var statusBadge = '';
      var st = (status || '').toLowerCase();
      if (st === 'active')    statusBadge = _badge('Active',    'green');
      else if (st === 'inactive') statusBadge = _badge('Inactive', 'red');
      else if (status !== '—')    statusBadge = _badge(status,     'gray');

      var detailsHTML =
        '<div class="sa-user-modal-sections">' +
          '<section class="sa-user-modal-section">' +
            '<h4>Student Information</h4>' +
            '<div class="sa-user-modal-kv">' +
              _kv('Name', name) +
              _kv('ID', String(sid)) +
              _kv('Email', email) +
              _kv('Course', dept) +
              _kv('Year Level', String(year)) +
              _kv('Contact', contact) +
              _kvRaw('Status', statusBadge || _esc(status)) +
              _kv('Rented', String(borrowCount) + ' book' + (borrowCount !== 1 ? 's' : '')) +
              _kv('Next Due', nextDue) +
            '</div>' +
          '</section>' +
          '<section class="sa-user-modal-section">' +
            '<h4>Borrowed Books</h4>' +
            (bookItems || _empty('No active borrowed books.')) +
          '</section>' +
        '</div>';

      _setBody(detailsHTML);
    }

    // ── Book overview ─────────────────────────────────────────
    // Endpoints:
    //   GET /api/admin/books/:bookId/profile
    //   GET /api/admin/books/:bookId/copies   (accession numbers)
    //   GET /api/admin/books/:bookId/borrowings (borrow history)
    async function _loadBook(bookId) {
      var bookRes = await _fetch('/api/admin/books/' + encodeURIComponent(bookId) + '/profile');
      if (!bookRes.ok) return _renderError('Failed to load book details.');

      var b = _pick(bookRes.data) || {};
      if (!b || (!b.title && !b.id)) return _renderError('Book not found.');

      var title   = b.title            || '—';
      var author  = b.author           || '—';
      var cat     = b.category         || '—';
      var isbn    = b.isbn             || '—';
      var total   = b.total_quantity   != null ? b.total_quantity   : (b.quantity   != null ? b.quantity   : '—');
      var avail   = b.available_quantity != null ? b.available_quantity : '—';
      var status  = b.status           || '—';
      var added   = b.added_date       ? new Date(b.added_date).toLocaleDateString() : '—';

      _setTitle(title);

      // Determine availability badge
      var availBadge = '';
      if (avail === 0 || avail === '0') availBadge = _badge('All Borrowed', 'red');
      else if (avail !== '—' && Number(avail) > 0) availBadge = _badge('Available: ' + avail, 'green');

      var statusBadge = '';
      var st = (status || '').toLowerCase();
      if (st === 'available') statusBadge = _badge('Available', 'green');
      else if (st.includes('borrow')) statusBadge = _badge('Borrowed', 'amber');
      else if (status !== '—') statusBadge = _badge(status, 'gray');

      var detailsHTML = _kvGrid([
        ['Title',     title],
        ['Author',    author],
        ['Category',  cat],
        ['ISBN',      isbn],
        ['Total Qty', String(total)],
        ['Available', availBadge || String(avail), availBadge ? 'raw' : ''],
        ['Status',    statusBadge || status,        statusBadge ? 'raw' : ''],
        ['Added',     added],
      ]);

      // Copies
      var copiesRes = await _fetch('/api/admin/books/' + encodeURIComponent(bookId) + '/copies');
      var copiesHTML = _empty('No copy records found.');

      var copies = [];
      if (copiesRes.ok) {
        copies = _pick(copiesRes.data) || [];
        if (!Array.isArray(copies)) copies = [];
      }

      // If no copy records exist, synthesise rows from quantity / available_quantity
      if (copies.length === 0 && Number(total) > 0) {
        var numTotal = Number(total);
        var numAvail = Number(avail) || 0;
        for (var ci = 1; ci <= numTotal; ci++) {
          copies.push({ accession_number: null, copy_number: ci, status: ci <= numAvail ? 'available' : 'borrowed' });
        }
      }

      if (copies.length > 0) {
        copiesHTML = '<ul class="sa-overview-list">' +
          copies.map(function (c) {
            var acc    = c.accession_number || c.accessionNumber || ('Copy #' + (c.copy_number || c.id));
            var cond   = c.condition_status || c.condition || '';
            var cstatus = c.status || '—';
            var badge  = '';
            var cs = cstatus.toLowerCase();
            if (cs === 'available') badge = _badge('Available', 'green');
            else if (cs.includes('borrow')) badge = _badge('Borrowed', 'amber');
            else badge = _badge(cstatus, 'gray');

            return '<li>' +
              '<span style="font-weight:600">' + _esc(acc) + '</span>' +
              (cond ? ' · ' + _esc(cond) : '') +
              ' ' + badge +
            '</li>';
          }).join('') +
        '</ul>';
      }

      // Borrow history (latest records with borrower names)
      var historyRes = await _fetch('/api/admin/books/' + encodeURIComponent(bookId) + '/borrowings?status=all');
      var historyHTML = _empty('No borrowing history found for this book.');
      var historyCount = 0;

      if (historyRes.ok) {
        var historyPayload = _pick(historyRes.data) || {};
        var borrowings = historyPayload.borrowings || [];
        var summary = historyPayload.summary || {};
        if (!Array.isArray(borrowings)) borrowings = [];

        historyCount = Number(summary.total || borrowings.length || 0);

        if (borrowings.length > 0) {
          var recent = borrowings.slice(0, 12);
          historyHTML =
            '<div class="sa-overview-kv" style="margin-bottom:10px;">' +
              _kv('Total', String(historyCount)) +
              _kv('Active', String(summary.active || 0)) +
              _kv('Overdue', String(summary.overdue || 0)) +
              _kv('Returned', String(summary.returned || 0)) +
            '</div>' +
            '<ul class="sa-overview-list">' +
            recent.map(function (r) {
              var student = r.student_name || r.student_id || 'Unknown borrower';
              var when = r.borrowed_on ? new Date(r.borrowed_on).toLocaleDateString() : 'Unknown date';
              var acc = r.accession_number ? ' · ' + _esc(r.accession_number) : '';
              var state = String(r.status || 'unknown').toLowerCase();
              var badge = _badge(r.status || 'unknown', 'gray');
              if (state === 'returned') badge = _badge('Returned', 'green');
              else if (state === 'overdue') badge = _badge('Overdue', 'red');
              else if (state === 'borrowed' || state === 'approved') badge = _badge('Borrowed', 'amber');

              return '<li>' +
                '<span style="font-weight:600">' + _esc(student) + '</span>' +
                ' · ' + _esc(when) + acc + ' ' + badge +
              '</li>';
            }).join('') +
            '</ul>';

          if (historyCount > recent.length) {
            historyHTML += '<div class="sa-overview-empty" style="margin-top:8px;">Showing latest ' + recent.length + ' of ' + historyCount + ' records.</div>';
          }
        }
      }

      _setBody(
        _card('Book Details', 'bi bi-book-fill', detailsHTML) +
        _card('Copies (' + copies.length + ')', 'bi bi-collection-fill', copiesHTML) +
        _card('Borrow History (' + historyCount + ')', 'bi bi-clock-history', historyHTML)
      );
    }

    // ── Admin overview ────────────────────────────────────────
    // Endpoint: GET /api/admin/:id  → {id, fullname, email, role}
    async function _loadAdmin(adminId) {
      var adminRes = await _fetch('/api/admin/' + encodeURIComponent(adminId));
      if (!adminRes.ok) return _renderError('Failed to load admin details.');

      var a = _pick(adminRes.data) || {};
      var name  = a.fullname || a.name || '—';
      var email = a.email    || '—';
      var role  = a.role     || '—';
      var created = a.created_at || a.createdAt || null;

      _setTitle(name);

      var roleLabel  = role === 'super_admin' ? 'Super Admin' : role === 'system_admin' ? 'System Admin' : role;
      var roleBadge  = role === 'super_admin'
        ? _badge('Super Admin', 'amber')
        : _badge('System Admin', 'green');

      var createdStr = created ? new Date(created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

      var detailsHTML = _kvGrid([
        ['Full Name',   name],
        ['Email',       email],
        ['Role',        roleLabel],
        ['Created',     createdStr],
      ]);

      // Patch role cell with badge
      detailsHTML = detailsHTML.replace(
        '<div class="sa-overview-v" title="' + _esc(roleLabel) + '">' + _esc(roleLabel) + '</div>',
        '<div class="sa-overview-v">' + roleBadge + '</div>'
      );

      _setBody(_card('Admin Details', 'bi bi-shield-lock-fill', detailsHTML));
    }

    // ── Public open ───────────────────────────────────────────
    async function open(type, id) {
      if (!type || !id) return;
      if (!_isReady()) {
        console.error('[Overview] Panel DOM not found. Is overview-panel.ejs included?');
        return;
      }

      _openShell('Loading…');

      var t = String(type).toLowerCase();
      _setMode(t);
      try {
        if (t === 'user')  return await _loadUser(id);
        if (t === 'book')  return await _loadBook(id);
        if (t === 'admin') return await _loadAdmin(id);
        _renderError('Unknown overview type: ' + t);
      } catch (err) {
        console.error('[Overview] Render error:', err);
        _renderError('Something went wrong loading the overview.');
      }
    }

    // ── Event wiring ──────────────────────────────────────────
    function _bindGlobal() {
      if (_bound) return;
      _bound = true;

      // Close on overlay click
      var overlay = _el('saOverviewOverlay');
      if (overlay) overlay.addEventListener('click', close);

      // Close button
      var closeBtn = _el('saOverviewCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', close);

      // Escape key
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && _isOpen()) close();
      });

      // Delegated row click — fires AFTER any direct row listeners
      document.addEventListener('click', function (e) {
        if (_ignore(e.target)) return;

        var row = e.target.closest('tr[data-overview-type][data-overview-id]');
        if (!row) return;
        if (!row.closest('table')) return; // must be inside a proper table

        var type = row.getAttribute('data-overview-type');
        var id   = row.getAttribute('data-overview-id');
        if (type && id) open(type, id);
      }, false);
    }

    // ── init ─────────────────────────────────────────────────
    function init() {
      _bindGlobal();
    }

    return { init: init, open: open, close: close };

  })(); // end Overview IIFE

  // Expose on both namespaces
  window.SuperAdmin.Overview  = Overview;
  window.SystemAdmin.Overview = Overview;

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Overview.init(); });
  } else {
    Overview.init();
  }

})();

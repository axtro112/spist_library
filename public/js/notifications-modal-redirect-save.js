/**
 * notifications-modal-redirect-save.js
 *
 * USER-SIDE ONLY — Shows a borrowing-details modal when a student clicks a
 * DUE_SOON or OVERDUE notification.
 *
 * Strategy (non-destructive — does not prevent any existing redirect):
 *   1. Delegated listener on #studentNotifPanel captures borrowing data and
 *      writes a short-lived payload to sessionStorage BEFORE navigation fires.
 *   2. If the page navigates (existing redirect to /student-borrowed), the
 *      destination page reads sessionStorage on DOMContentLoaded and shows
 *      the modal with full details fetched from the API.
 *   3. If no navigation happens within 150 ms, the modal is shown immediately
 *      without waiting for a page load.
 *
 * Admin pages: completely unaffected — role guard exits early.
 */
(function () {
  'use strict';

  var STORAGE_KEY  = 'spist_last_borrowing_detail_v1';
  var TTL_MS       = 30000; // 30 seconds

  /* ──────────────────────────────────────────────────────────────────
   * Helpers
   * ────────────────────────────────────────────────────────────────── */

  function getRole() {
    try {
      var b = document.body && document.body.dataset && document.body.dataset.role;
      if (b) return b.toLowerCase();
      if (window.__USER_ROLE__) return String(window.__USER_ROLE__).toLowerCase();
      var s = sessionStorage.getItem('userRole');
      if (s) return s.toLowerCase();
      var p = window.location.pathname;
      if (/^\/user\/|^\/student/.test(p)) return 'student';
      if (/^\/admin/.test(p)) return 'admin';
    } catch (_) { /* ignore */ }
    return '';
  }

  /* Parse full notification object from data-notif-data attribute */
  function parseNotifItem(item) {
    try {
      var raw = item.dataset.notifData || item.getAttribute('data-notif-data');
      if (!raw) return null;
      return JSON.parse(raw.replace(/&quot;/g, '"'));
    } catch (_) { return null; }
  }

  /* Write a short-lived payload to sessionStorage before navigation */
  function writeStore(notif) {
    // Priority for borrowing ID:
    //   1. notif.borrowing_id (explicit field set for some notifications)
    //   2. notif.link_id / notif.related_id when link_type === 'borrowing'
    //      (scheduler stores related_id here via createNotification auto-mapping)
    //   3. notif.deep_link_id when deep_link_type === 'borrowing'
    var borrowingId = notif.borrowing_id ||
      (notif.link_type === 'borrowing'
        ? (notif.link_id || notif.related_id || null)
        : null) ||
      (notif.deep_link_type === 'borrowing'
        ? (notif.deep_link_id || null)
        : null) ||
      null;

    // notif.book_title may be null (scheduler doesn't store it).
    // Parse from the notification title string as last resort.
    var bookTitle = notif.book_title || null;
    if (!bookTitle && notif.title) {
      // titles look like "Book Due Soon: Advanced Java Programming"
      var colonIdx = notif.title.indexOf(': ');
      if (colonIdx !== -1) bookTitle = notif.title.slice(colonIdx + 2);
    }

    var store = {
      ts:          Date.now(),
      borrowingId: borrowingId,
      inline: {
        title:       bookTitle,
        author:      notif.book_author || null,
        isbn:        notif.isbn        || null,
        borrow_date: notif.borrow_date || null,
        due_date:    notif.due_date    || null,
        status:      (notif.type || '').toUpperCase() === 'OVERDUE' ? 'overdue' : 'borrowed'
      }
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (_) { /* ignore */ }
    return store;
  }

  /* ──────────────────────────────────────────────────────────────────
   * 1. Delegated listener on the student notification panel
   *    (#studentNotifPanel is always in the layout DOM)
   * ────────────────────────────────────────────────────────────────── */

  function attachPanelListener() {
    var panel = document.getElementById('studentNotifPanel');
    if (!panel) return; // not a student page

    panel.addEventListener('click', function (e) {
      // Find the closest notification item
      var item = e.target && e.target.closest && e.target.closest('.notif-item');
      if (!item) return;

      // Student / user pages only
      var role = getRole();
      if (role !== 'student' && role !== 'user') return;

      var notif = parseNotifItem(item);
      if (!notif) return;

      var type = (notif.type || '').toUpperCase();
      if (type !== 'DUE_SOON' && type !== 'OVERDUE') return;

      // Write payload now — before any navigation starts
      var store = writeStore(notif);

      // If navigation does NOT happen within 150 ms, show the modal in-page
      var navigated   = false;
      var unloadGuard = function () { navigated = true; };
      window.addEventListener('beforeunload', unloadGuard);

      setTimeout(function () {
        window.removeEventListener('beforeunload', unloadGuard);
        if (navigated) return; // navigated away — destination page will show modal
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
        showDetailModal(store);
      }, 150);

      // DO NOT call preventDefault() or stopPropagation() — let other handlers run
    }, false);
  }

  /* ──────────────────────────────────────────────────────────────────
   * 2. Destination-page loader
   *    Reads sessionStorage on DOMContentLoaded and shows the modal
   * ────────────────────────────────────────────────────────────────── */

  function destPageCheck() {
    var role = getRole();
    if (role !== 'student' && role !== 'user') return; // admin pages: skip

    var raw;
    try { raw = sessionStorage.getItem(STORAGE_KEY); } catch (_) { return; }
    if (!raw) return;

    var store;
    try {
      store = JSON.parse(raw);
    } catch (_) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (__) { /* ignore */ }
      return;
    }

    if (!store || !store.ts || (Date.now() - store.ts) > TTL_MS) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
      return;
    }

    // Consume the key before showing
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    showDetailModal(store);
  }

  /* ──────────────────────────────────────────────────────────────────
   * 3. Modal lifecycle
   * ────────────────────────────────────────────────────────────────── */

  function showDetailModal(store) {
    ensureModal();
    setLoading(true);
    setContent(false);
    setError(false);
    openModal();

    if (store.borrowingId) {
      // Fetch full detail from the existing /api/book-borrowings/detail/:id endpoint
      fetch('/api/book-borrowings/detail/' + encodeURIComponent(store.borrowingId), {
        credentials: 'same-origin'
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (json) {
          // API wraps data in { success, data: {...} } or returns the object directly
          var payload = (json && json.data) ? json.data : json;
          populateModal(payload);
        })
        .catch(function () {
          // Fall back to whatever inline fields were captured from the notification
          if (store.inline && store.inline.title) {
            populateModal(store.inline);
          } else {
            setLoading(false);
            setError(true);
          }
        });
    } else if (store.inline && store.inline.title) {
      // No borrowingId at all — show what we have from the notification itself
      populateModal(store.inline);
    } else {
      setLoading(false);
      setError(true);
    }
  }

  /* ──────────────────────────────────────────────────────────────────
   * 4. Modal DOM (created once, lazily appended to <body>)
   * ────────────────────────────────────────────────────────────────── */

  var _modal = null;

  function ensureModal() {
    if (_modal && document.body.contains(_modal)) return;

    var existing = document.getElementById('userBorrowDetailModal');
    if (existing) { _modal = existing; bindClose(); return; }

    var wrap = document.createElement('div');
    wrap.innerHTML = [
      '<div id="userBorrowDetailModal" class="modal" role="dialog" aria-modal="true"',
      '     aria-hidden="true" style="display:none;z-index:9999;">',
      '  <div class="modal-content"',
      '       style="max-width:520px;width:92%;padding:0;border-radius:10px;',
      '              overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.25);">',
      /* ── header ── */
      '    <div style="background:#4caf50;color:#fff;padding:14px 20px;',
      '                display:flex;align-items:center;justify-content:space-between;">',
      '      <h3 id="userBorrowDetailModalTitle"',
      '          style="margin:0;font-size:17px;font-weight:600;">',
      '        <span class="material-symbols-outlined"',
      '              style="vertical-align:middle;font-size:20px;margin-right:6px;">schedule</span>',
      '        Borrowing Details',
      '      </h3>',
      '      <button class="modal-close" aria-label="Close"',
      '              style="background:none;border:none;color:#fff;font-size:24px;',
      '                     line-height:1;cursor:pointer;padding:0 4px;">&times;</button>',
      '    </div>',
      /* ── body ── */
      '    <div id="userBorrowDetailModalBody" style="padding:20px;background:#fff;">',
      '      <div id="userBorrowDetailLoading"',
      '           style="text-align:center;padding:28px 0;color:#666;font-size:14px;">',
      '        <span class="material-symbols-outlined"',
      '              style="font-size:36px;display:block;margin-bottom:8px;color:#aaa;">hourglass_top</span>',
      '        Loading details&hellip;',
      '      </div>',
      '      <div id="userBorrowDetailContent" style="display:none;">',
      '        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">',
      '          <tbody>',
      '            <tr><td style="padding:7px 0;color:#888;width:38%;vertical-align:top;">Book</td>',
      '                <td id="udm_book_title" style="padding:7px 0;font-weight:600;"></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">Author</td>',
      '                <td id="udm_book_author" style="padding:7px 0;"></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">ISBN</td>',
      '                <td id="udm_book_isbn" style="padding:7px 0;"></td></tr>',
      '            <tr><td colspan="2"><hr style="margin:8px 0;border:none;border-top:1px solid #eee;"/></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">Accession&nbsp;/&nbsp;Copy</td>',
      '                <td id="udm_accession" style="padding:7px 0;"></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">Student ID</td>',
      '                <td id="udm_student_id" style="padding:7px 0;"></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">Borrowed</td>',
      '                <td id="udm_borrow_date" style="padding:7px 0;"></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">Due Date</td>',
      '                <td id="udm_due_date"',
      '                    style="padding:7px 0;font-weight:600;color:#e53935;"></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">Status</td>',
      '                <td id="udm_status" style="padding:7px 0;"></td></tr>',
      '            <tr><td style="padding:7px 0;color:#888;">Contact</td>',
      '                <td id="udm_contact" style="padding:7px 0;"></td></tr>',
      '          </tbody>',
      '        </table>',
      '      </div>',
      '      <div id="userBorrowDetailError"',
      '           style="display:none;color:#c00;text-align:center;padding:24px 0;font-size:14px;">',
      '        Unable to load borrowing details.',
      '      </div>',
      '    </div>',
      /* ── footer ── */
      '    <div style="padding:12px 20px;background:#f9f9f9;border-top:1px solid #eee;',
      '                display:flex;justify-content:flex-end;gap:8px;">',
      '      <a id="udm_go_borrowed" href="/student-borrowed"',
      '         style="padding:8px 16px;background:#4caf50;color:#fff;border-radius:5px;',
      '                text-decoration:none;font-size:13px;font-weight:500;line-height:1.4;">',
      '        View My Borrowed Books',
      '      </a>',
      '      <button id="udm_close_btn" class="modal-close"',
      '              style="padding:8px 16px;background:#efefef;border:1px solid #ddd;',
      '                     border-radius:5px;cursor:pointer;font-size:13px;">Close</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(wrap);
    _modal = document.getElementById('userBorrowDetailModal');
    bindClose();
  }

  function bindClose() {
    if (!_modal) return;
    _modal.querySelectorAll('.modal-close').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); closeModal(); });
    });
    _modal.addEventListener('click', function (e) {
      if (e.target === _modal) closeModal();
    });
  }

  function openModal() {
    if (!_modal) return;
    _modal.style.display = 'flex';
    _modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!_modal) return;
    _modal.style.display = 'none';
    _modal.setAttribute('aria-hidden', 'true');
    setLoading(false);
    setContent(false);
    setError(false);
  }

  function setLoading(v) {
    var el = document.getElementById('userBorrowDetailLoading');
    if (el) el.style.display = v ? '' : 'none';
  }
  function setContent(v) {
    var el = document.getElementById('userBorrowDetailContent');
    if (el) el.style.display = v ? '' : 'none';
  }
  function setError(v) {
    var el = document.getElementById('userBorrowDetailError');
    if (el) el.style.display = v ? '' : 'none';
  }

  function fmtDate(v) {
    if (!v) return '—';
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) { return String(v); }
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = (val !== null && val !== undefined && String(val).trim()) ? String(val) : '—';
    }
  }

  function populateModal(d) {
    setLoading(false);
    setError(false);
    setContent(true);
    // API response fields: title, author, isbn, student_id, borrow_date, due_date, status
    // Inline-fallback fields: title (book title stored in store.inline.title)
    setText('udm_book_title',  d.title        || d.book_title              || null);
    setText('udm_book_author', d.author       || d.book_author             || null);
    setText('udm_book_isbn',   d.isbn         || d.book_isbn               || null);
    setText('udm_accession',   d.accession_number || d.accession           || null);
    setText('udm_student_id',  d.student_id   || d.user_id                 || null);
    setText('udm_borrow_date', fmtDate(d.borrow_date || d.borrowDate       || null));
    setText('udm_due_date',    fmtDate(d.due_date    || d.dueDate          || null));
    setText('udm_status',      d.status       || d.borrowing_status        || null);
    setText('udm_contact',     d.contact      || d.student_contact         || null);
  }

  /* ──────────────────────────────────────────────────────────────────
   * Boot
   * ────────────────────────────────────────────────────────────────── */

  function init() {
    attachPanelListener();
    destPageCheck();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());

/*
FILE: dashboard.js

PURPOSE
Handles the Student Dashboard interface.

CONNECTED TO
views/student/dashboard.ejs

HANDLES
dashboard stats
borrowed books table
popular books table
calendar due-date markers
logout modal actions
*/
(function (Student) {
  "use strict";

  /* ------------------------------------------------------------------
   * Calendar state
   * ------------------------------------------------------------------ */
  var _calYear  = new Date().getFullYear();
  var _calMonth = new Date().getMonth(); // 0-indexed
  var _dueDates = new Set(); // Set of "YYYY-MM-DD" strings

  function renderCalendar() {
    var container = document.getElementById("calendarPlaceholder");
    if (!container) return;

    var today    = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    var monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
    var dayNames   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

    var year       = _calYear;
    var month      = _calMonth;
    var firstDay   = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var dayHeaders = dayNames.map(function (d) {
      return '<div class="u-cal-dname">' + d + '<\/div>';
    }).join('');

    var cells = '';
    for (var i = 0; i < firstDay; i++) {
      cells += '<div class="u-cal-day u-cal-empty">&nbsp;<\/div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var ds = year + '-' +
        String(month + 1).padStart(2, '0') + '-' +
        String(d).padStart(2, '0');
      var cls = 'u-cal-day';
      if (ds === todayStr)       cls += ' u-cal-today';
      if (_dueDates.has(ds))     cls += ' u-cal-due';
      cells += '<div class="' + cls + '" title="' + (_dueDates.has(ds) ? 'Book due' : '') + '">' + d + '<\/div>';
    }

    var legend = '<div class="u-cal-legend">' +
      '<span class="u-cal-dot u-cal-dot-today"><\/span> Today' +
      (_dueDates.size > 0 ? '&ensp;<span class="u-cal-dot u-cal-dot-due"><\/span> Due date' : '') +
      '<\/div>';

    container.innerHTML =
      '<div class="u-cal">' +
        '<div class="u-cal-nav">' +
          '<button class="u-cal-btn" onclick="Student.Dashboard.calPrev()">&lsaquo;<\/button>' +
          '<span class="u-cal-title">' + monthNames[month] + ' ' + year + '<\/span>' +
          '<button class="u-cal-btn" onclick="Student.Dashboard.calNext()">&rsaquo;<\/button>' +
        '<\/div>' +
        '<div class="u-cal-grid">' + dayHeaders + cells + '<\/div>' +
        legend +
      '<\/div>';
  }

  function calPrev() {
    _calMonth--;
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    renderCalendar();
  }

  function calNext() {
    _calMonth++;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    renderCalendar();
  }

  /* ------------------------------------------------------------------
   * Auth guard
   * ------------------------------------------------------------------ */
  function _guard() {
    if (typeof window.ensureStudentSessionFromServer === "function") {
      window.ensureStudentSessionFromServer();
    }

    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const userRole   = sessionStorage.getItem("userRole");
    const studentId  = sessionStorage.getItem("studentId");

    if (!isLoggedIn || !userRole || userRole !== "student" || !studentId) {
      window.location.href = "/login";
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------
   * Profile
   * ------------------------------------------------------------------ */
  async function _loadProfile() {
    const studentId = sessionStorage.getItem("studentId");
    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const res = await doFetch("/api/students/" + studentId);
      if (!res.ok) throw new Error("Failed to fetch student data: " + res.status);

      const studentData = await res.json();

      sessionStorage.setItem("userName",  studentData.fullname);
      sessionStorage.setItem("userID",    studentData.student_id);

      Core.utils.setText("userName",        studentData.fullname   || "Student");
      Core.utils.setText("userNameHeading", studentData.fullname   || "Student");
      Core.utils.setText("userID",          studentData.student_id || "c22-0000-000");
    } catch (err) {
      console.error("[Student.Dashboard] loadProfile:", err);
      Core.utils.setText("userName",        "Student");
      Core.utils.setText("userNameHeading", "Student");
      Core.utils.setText("userID",          "c22-0000-000");
    }
  }

  /* ------------------------------------------------------------------
   * Stats
   * ------------------------------------------------------------------ */
  async function updateDashboardStats() {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) return;

    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const res = await doFetch("/api/students/" + studentId + "/dashboard-stats");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats: " + res.status);

      const result = await res.json();
      const stats  = result.data || result;
      Core.utils.setText("availableBooksCount", stats.availableBooks);
      Core.utils.setText("borrowedBooksCount",  stats.borrowedBooks);
      Core.utils.setText("dueSoonCount",         stats.dueSoon);
      Core.utils.setText("pendingBooksCount",    stats.pendingBooks ?? 0);
    } catch (err) {
      console.error("[Student.Dashboard] updateDashboardStats:", err);
      Core.utils.setText("availableBooksCount", "Error");
      Core.utils.setText("borrowedBooksCount",  "Error");
      Core.utils.setText("dueSoonCount",         "Error");
      Core.utils.setText("pendingBooksCount",    "Error");
    }
  }

  /* ------------------------------------------------------------------
   * Borrowed books
   * ------------------------------------------------------------------ */
  async function updateBorrowedBooks() {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) return;

    const tableBody = document.getElementById("borrowedBooksTableBody");
    if (!tableBody) return;

    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const res = await doFetch("/api/book-borrowings/" + studentId);
      if (!res.ok) throw new Error("Failed to fetch borrowed books: " + res.status);

      const result = await res.json();
      const data   = result.data || result;
      const activeBooks = (data.books || []).filter(function (book) {
        var status = String(book.status || '').toLowerCase();
        return (book.is_active === true || book.is_active === 1) &&
          (
            status === 'pending_pickup' ||
            status === 'claim_expired' ||
            status === 'borrowed' ||
            status === 'overdue'
          );
      });

      if (!activeBooks.length) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center">No active or pending borrowings</td></tr>';
        _dueDates = new Set();
        renderCalendar();
        return;
      }

      tableBody.innerHTML = activeBooks.map(function (book) {
        var rawStatus = String(book.status || '').toLowerCase();
        var statusClass = rawStatus === 'pending_pickup' ? 'borrowed' : rawStatus;
        var statusLabel = 'Borrowed';

        if (rawStatus === 'pending_pickup') statusLabel = 'Pending Pickup';
        else if (rawStatus === 'overdue') statusLabel = 'Overdue';
        else if (rawStatus === 'cancelled') statusLabel = 'Cancelled';
        else if (rawStatus === 'returned') statusLabel = 'Returned';

        return (
          "<tr>" +
            "<td>" + book.title + "</td>" +
            "<td>" + book.author + "</td>" +
            "<td>" + Core.utils.formatDate(book.borrow_date) + "</td>" +
            "<td>" + Core.utils.formatDate(book.due_date) + "</td>" +
            "<td>" +
              '<span class="status-pill ' + statusClass + '">' +
                statusLabel +
              "</span>" +
            "</td>" +
          "</tr>"
        );
      }).join("");

      // Update calendar due-date markers
      _dueDates = new Set();
      activeBooks.forEach(function (book) {
        if (book.due_date) {
          var raw = book.due_date.toString();
          var ds  = raw.length >= 10 ? raw.slice(0, 10) : '';
          if (ds) _dueDates.add(ds);
        }
      });
      renderCalendar();
    } catch (err) {
      console.error("[Student.Dashboard] updateBorrowedBooks:", err);
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Error loading borrowed books</td></tr>';
    }
  }

  /* ------------------------------------------------------------------
   * Frequently borrowed books
   * ------------------------------------------------------------------ */
  async function updateFrequentlyBorrowedBooks() {
    const tableBody = document.getElementById("frequentlyBorrowedTableBody");
    if (!tableBody) return;

    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const res = await doFetch("/api/books/popular?limit=10&ts=" + Date.now());
      if (!res.ok) throw new Error("Failed to fetch popular books: " + res.status);

      const result = await res.json();
      const books  = result.data || [];

      if (!books.length) {
        tableBody.innerHTML =
          '<tr><td colspan="7" class="text-center" style="padding:20px;color:#888;">No borrowing data yet.</td></tr>';
        return;
      }

      tableBody.innerHTML = books.map(function (book) {
        var avail = parseInt(book.available_quantity) || 0;
        var total = parseInt(book.quantity) || avail;
        var badgeClass = avail > 0 ? 'u-badge u-badge-available' : 'u-badge u-badge-borrowed';
        var copiesLabel = avail + ' / ' + total;
        var actionCell = avail > 0
          ? '<button class="u-btn u-btn-primary" style="font-size:12px;padding:5px 12px;" onclick="showBorrowModal(\'' + book.id + '\')" data-book-id="' + book.id + '"><i class="bi bi-book"></i> Borrow</button>'
          : '<button class="u-btn" style="font-size:12px;padding:5px 12px;background:#ccc;color:#666;cursor:not-allowed;" disabled>Not Available</button>';

        return (
          '<tr>' +
            '<td style="color:#555;font-size:13px;">' + book.id + '</td>' +
            '<td style="font-weight:500;">' + book.title + '</td>' +
            '<td style="color:#555;">' + book.author + '</td>' +
            '<td style="color:#1565c0;">' + (book.category || '—') + '</td>' +
            '<td style="color:#555;font-size:13px;">' + (book.isbn || '—') + '</td>' +
            '<td style="text-align:center;"><span class="' + badgeClass + '">' + copiesLabel + '</span></td>' +
            '<td>' + actionCell + '</td>' +
          '</tr>'
        );
      }).join("");
    } catch (err) {
      console.error("[Student.Dashboard] updateFrequentlyBorrowedBooks:", err);
      tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center" style="padding:20px;color:#c00;">Error loading books.</td></tr>';
    }
  }

  /* ------------------------------------------------------------------
   * Recommended books (kept for backward compat, not displayed on dashboard)
   * ------------------------------------------------------------------ */
  async function updateRecommendedBooks() {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) return;

    const tableBody = document.getElementById("recommendedBooksTableBody");
    if (!tableBody) return;

    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const res = await doFetch("/api/students/books/recommended/" + studentId);
      if (!res.ok) throw new Error("Failed to fetch recommended books: " + res.status);

      const result = await res.json();
      const books  = result.data || [];

      if (!books || books.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center">No book recommendations available yet. Try borrowing some books first!</td></tr>';
        return;
      }

      tableBody.innerHTML = books.map(function (book) {
        const statusLower = book.current_status.toLowerCase();
        const statusLabel = book.current_status.charAt(0).toUpperCase() + book.current_status.slice(1);
        const actionCell  = statusLower === "available"
          ? '<button class="book-borrow-btn" onclick="showBorrowModal(\'' + book.id + '\')" data-book-id="' + book.id + '">Borrow</button>'
          : '<button class="book-borrow-btn" disabled>Not Available</button>';

        return (
          "<tr>" +
            "<td>" + book.title + "</td>" +
            "<td>" + book.author + "</td>" +
            "<td>" + book.category + "</td>" +
            "<td>" +
              '<span class="status-pill ' + statusLower + '">' + statusLabel + "</span>" +
            "</td>" +
            "<td>" + actionCell + "</td>" +
          "</tr>"
        );
      }).join("");
    } catch (err) {
      console.error("[Student.Dashboard] updateRecommendedBooks:", err);
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Error loading recommended books</td></tr>';
    }
  }

  /* ------------------------------------------------------------------
   * Borrow modal — handled by /js/student/quick-borrow-modal.js
   * showBorrowModal(bookId), closeModal(), handleBorrow() are global
   * functions defined in quick-borrow-modal.js which is loaded before
   * this script in dashboard.ejs.
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------
   * Logout modal
   * ------------------------------------------------------------------ */
  function showLogoutModal() {
    const modal = document.getElementById("logoutModal");
    if (modal) modal.style.display = "flex";
  }

  function closeLogoutModal() {
    const modal = document.getElementById("logoutModal");
    if (modal) modal.style.display = "none";
  }

  function logout() {
    closeLogoutModal();
    fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' }
    }).catch(function () {
      // Ignore network errors; client-side logout still proceeds.
    }).finally(function () {
      sessionStorage.clear();
      window.location.href = "/login";
    });
  }

  /* ------------------------------------------------------------------
   * Expose globals needed by inline HTML onclick attributes
   * ------------------------------------------------------------------ */
  function _bindGlobals() {
    // showBorrowModal, handleBorrow, closeModal are already global
    // (defined in quick-borrow-modal.js loaded before this script).
    window.showLogoutModal  = showLogoutModal;
    window.closeLogoutModal = closeLogoutModal;
    window.logout           = logout;
  }

  /* ------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------ */
  async function init() {
    _bindGlobals();

    if (!_guard()) return;

    await _loadProfile();
    await updateDashboardStats();
    await updateFrequentlyBorrowedBooks();
    renderCalendar(); // show calendar immediately, due dates populated after
    await updateBorrowedBooks();

    // After Quick Borrow modal succeeds, refresh dashboard data
    window.onQuickBorrowSuccess = function () {
      updateDashboardStats();
      updateFrequentlyBorrowedBooks();
      updateBorrowedBooks();
    };

    Core.utils.addInterval(async function () {
      await updateDashboardStats();
      await updateBorrowedBooks();
    }, 60000);

    Core.utils.addInterval(updateFrequentlyBorrowedBooks, 300000);
  }

  /* ------------------------------------------------------------------
   * Export
   * ------------------------------------------------------------------ */
  Student.Dashboard = {
    init:                   init,
    showBorrowModal:        function (bookId) { showBorrowModal(bookId); },
    showLogoutModal:        showLogoutModal,
    closeLogoutModal:       closeLogoutModal,
    logout:                 logout,
    updateDashboardStats:   updateDashboardStats,
    updateBorrowedBooks:    updateBorrowedBooks,
    updateRecommendedBooks: updateRecommendedBooks,
    calPrev:                calPrev,
    calNext:                calNext,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (window.Student && window.Student.Dashboard) {
        window.Student.Dashboard.init();
      }
    });
  } else if (window.Student && window.Student.Dashboard) {
    window.Student.Dashboard.init();
  }

}(window.Student = window.Student || {}));

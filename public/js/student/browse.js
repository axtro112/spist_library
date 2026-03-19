/*
FILE: browse.js

PURPOSE
Handles the student available books page.

CONNECTED TO
views/student/available-books.ejs

HANDLES
book table rendering
search and category filtering
quick borrow refresh hook
*/
(function (w) {
  'use strict';

  var availBooks = [];
  var availFiltered = [];

  function renderTable(books) {
    var tbody = document.getElementById('availBooksBody');
    if (!tbody) return;

    if (!books.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:32px;color:#666;">' +
        '<i class="bi bi-search" style="font-size:2.5rem;color:#ccc;display:block;margin-bottom:10px;"></i>' +
        'No available books found</td></tr>';
      return;
    }

    tbody.innerHTML = books.map(function (b) {
      return '<tr>' +
        '<td class="avail-check-cell"><input type="checkbox" class="form-check-input selectAvailBookRow avail-row-checkbox" value="' + (b.id || '') + '"></td>' +
        '<td class="avail-id-cell">' + (b.id || '—') + '</td>' +
        '<td><strong>' + (b.title || '—') + '</strong></td>' +
        '<td>' + (b.author || 'Unknown') + '</td>' +
        '<td>' + (b.category || 'Uncategorized') + '</td>' +
        '<td>' + (b.isbn || '—') + '</td>' +
        '<td class="avail-qty-cell"><span class="u-badge u-badge-available">' + (b.available_quantity || 0) + ' / ' + (b.quantity || '?') + '</span></td>' +
        '<td class="avail-action-cell"><button class="u-btn u-btn-primary u-btn-borrow" onclick="showBorrowModal(\'' + (b.id || '') + '\')"><i class="bi bi-book-fill"></i> Borrow</button></td>' +
        '</tr>';
    }).join('');
  }

  function populateCategoryFilter() {
    var sel = document.getElementById('availBooksCategoryFilter');
    if (!sel) return;
    var categories = Array.from(new Set(availBooks.map(function (b) { return b.category; }).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      sel.appendChild(o);
    });
  }

  function applyFilters() {
    var searchInput = document.getElementById('availBooksSearchInput');
    var categoryFilter = document.getElementById('availBooksCategoryFilter');
    var searchValue = (searchInput ? searchInput.value : '').toLowerCase().trim();
    var categoryValue = (categoryFilter ? categoryFilter.value : '').trim();

    availFiltered = availBooks.filter(function (b) {
      if (searchValue) {
        var q = searchValue;
        var ok = (b.title && b.title.toLowerCase().includes(q)) || (b.author && b.author.toLowerCase().includes(q)) || (b.isbn && String(b.isbn).toLowerCase().includes(q));
        if (!ok) return false;
      }
      if (categoryValue && b.category !== categoryValue) return false;
      return true;
    });

    renderTable(availFiltered);
    updateSelectAllCheckbox();
  }

  function updateSelectedCount(count) {
    var selectedLabel = document.getElementById('availSelectedCount');
    if (!selectedLabel) return;
    selectedLabel.textContent = 'Selected: ' + count;
    selectedLabel.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  function updateSelectAllCheckbox() {
    var selectAll = document.getElementById('selectAllAvailBooks');
    var rows = document.querySelectorAll('.selectAvailBookRow');
    if (!selectAll) return;

    var checkedCount = Array.from(rows).filter(function (cb) { return cb.checked; }).length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < rows.length;
    selectAll.checked = checkedCount === rows.length && rows.length > 0;
    updateSelectedCount(checkedCount);
  }

  function setupFilters() {
    populateCategoryFilter();
    var searchInput = document.getElementById('availBooksSearchInput');
    var categoryFilter = document.getElementById('availBooksCategoryFilter');
    var clearBtn = document.getElementById('availClearFiltersBtn');
    var selectAll = document.getElementById('selectAllAvailBooks');
    var tbody = document.getElementById('availBooksBody');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = '';
        applyFilters();
      });
    }
    if (selectAll) {
      selectAll.addEventListener('change', function (e) {
        document.querySelectorAll('.selectAvailBookRow').forEach(function (cb) { cb.checked = e.target.checked; });
        updateSelectAllCheckbox();
      });
    }
    if (tbody) {
      tbody.addEventListener('change', function (e) {
        if (e.target.classList.contains('selectAvailBookRow')) updateSelectAllCheckbox();
      });
    }

    updateSelectedCount(0);
  }

  async function loadAvailableBooks() {
    try {
      var doFetch = typeof w.fetchWithCsrf === 'function' ? w.fetchWithCsrf : fetch;
      var resp = await doFetch('/api/books?ts=' + Date.now());
      if (!resp.ok) throw new Error('Failed to fetch books: ' + resp.status);
      var result = await resp.json();
      availBooks = (result.data || []).filter(function (b) { return (b.available_quantity || 0) > 0; });
      availFiltered = availBooks;
      renderTable(availBooks);
      setupFilters();
    } catch (err) {
      var tbody = document.querySelector('#availBooksBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="color:red;padding:20px;">Error loading books: ' + err.message + '</td></tr>';
      }
    }
  }

  function guard(callback) {
    if (typeof w.ensureStudentSessionFromServer === 'function') w.ensureStudentSessionFromServer();
    
    // Wait 100ms for session to restore from MySQL store on hard refresh
    setTimeout(function() {
      var isLoggedIn = sessionStorage.getItem('isLoggedIn');
      var userRole = sessionStorage.getItem('userRole');
      var studentId = sessionStorage.getItem('studentId');
      if (!isLoggedIn || userRole !== 'student' || !studentId) {
        var isTimeoutLogout = sessionStorage.getItem('timeout-logout') === 'true';
        sessionStorage.clear();
        if (isTimeoutLogout) {
          sessionStorage.setItem('timeout-logout', 'true');
        }
        w.location.href = '/login';
        return false;
      }
      if (callback) callback();
    }, 100);
  }

  async function init() {
    guard(async function() {
      await loadAvailableBooks();
      w.onQuickBorrowSuccess = async function () {
        await loadAvailableBooks();
      };
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  w.Student = w.Student || {};
  w.Student.BrowsePage = { init: init, loadAvailableBooks: loadAvailableBooks };
})(window);

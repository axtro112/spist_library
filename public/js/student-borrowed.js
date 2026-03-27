/*
FILE: student-borrowed.js

PURPOSE
Render student borrowed-books lifecycle tabs:
- Pending Pickup
- Active Borrowed
- History

CONNECTED TO
views/student/borrowed-books.ejs
*/
(function () {
  'use strict';

  var allRecords = [];
  var currentTab = 'active';
  var filters = {
    search: '',
    category: '',
    status: ''
  };
  var searchTimer = null;
  var isRefreshingCategories = false;
  var lastCategoryRefreshAt = 0;
  var CATEGORY_REFRESH_INTERVAL_MS = 15000;

  function formatDate(value) {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString();
  }

  function durationDays(start, end) {
    if (!start || !end) return 'N/A';
    const a = new Date(start);
    const b = new Date(end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 'N/A';
    const ms = Math.max(0, b.getTime() - a.getTime());
    return Math.ceil(ms / (1000 * 60 * 60 * 24)) + ' day(s)';
  }

  function setCount(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value || 0);
  }

  function setTabState(activeKey) {
    currentTab = activeKey;

    const pendingBtn = document.getElementById('pendingTabBtn');
    const activeBtn = document.getElementById('activeTabBtn');
    const historyBtn = document.getElementById('historyTabBtn');

    const pendingSection = document.getElementById('pendingSection');
    const activeSection = document.getElementById('activeSection');
    const historySection = document.getElementById('historySection');

    if (pendingBtn) {
      pendingBtn.classList.toggle('active', activeKey === 'pending');
      pendingBtn.setAttribute('aria-selected', activeKey === 'pending' ? 'true' : 'false');
    }
    if (activeBtn) {
      activeBtn.classList.toggle('active', activeKey === 'active');
      activeBtn.setAttribute('aria-selected', activeKey === 'active' ? 'true' : 'false');
    }
    if (historyBtn) {
      historyBtn.classList.toggle('active', activeKey === 'history');
      historyBtn.setAttribute('aria-selected', activeKey === 'history' ? 'true' : 'false');
    }

    if (pendingSection) pendingSection.style.display = activeKey === 'pending' ? '' : 'none';
    if (activeSection) activeSection.style.display = activeKey === 'active' ? '' : 'none';
    if (historySection) historySection.style.display = activeKey === 'history' ? '' : 'none';

    syncSelectAllState();
  }

  function getVisibleRowCheckboxes() {
    var selector = '.borrowed-row-checkbox[data-tab="' + currentTab + '"]';
    return Array.from(document.querySelectorAll(selector));
  }

  function syncSelectAllState() {
    var selectAll = document.getElementById('selectAllBooks');
    if (!selectAll) return;

    var rowCheckboxes = getVisibleRowCheckboxes();
    if (!rowCheckboxes.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }

    var checkedCount = rowCheckboxes.filter(function (checkbox) {
      return checkbox.checked;
    }).length;

    selectAll.checked = checkedCount > 0 && checkedCount === rowCheckboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
  }

  function normalizeCategory(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function formatStatusLabel(value) {
    const normalized = normalizeStatus(value);
    if (!normalized) return '';
    return normalized
      .split('_')
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }

  function getLifecycleStageFromStatus(value) {
    const status = normalizeStatus(value);

    if (status === 'pending_pickup' || status === 'claim_expired' || status === 'pending') {
      return 'pending';
    }

    if (
      status === 'borrowed' ||
      status === 'overdue' ||
      status === 'picked_up' ||
      status === 'pending_return' ||
      status === 'active'
    ) {
      return 'active';
    }

    if (status === 'returned' || status === 'completed' || status === 'history') {
      return 'history';
    }

    return '';
  }

  function populateCategoryFilter(records) {
    const select = document.getElementById('booksCategoryFilter');
    if (!select) return;

    const current = normalizeCategory(select.value);
    const map = new Map();

    (records || []).forEach(function (r) {
      const raw = String(r.category || '').trim().replace(/\s+/g, ' ');
      const normalized = normalizeCategory(raw);
      if (!normalized || map.has(normalized)) return;
      map.set(normalized, raw);
    });

    const sorted = Array.from(map.entries()).sort(function (a, b) {
      return a[1].localeCompare(b[1]);
    });

    select.innerHTML = '<option value="">All Categories</option>';
    sorted.forEach(function (entry) {
      const option = document.createElement('option');
      option.value = entry[1];
      option.textContent = entry[1];
      if (current && entry[0] === current) option.selected = true;
      select.appendChild(option);
    });

    const hasCurrent = sorted.some(function (entry) {
      return entry[0] === current;
    });

    if (current && !hasCurrent) {
      select.value = '';
      filters.category = '';
    }
  }

  async function loadCategoryOptions() {
    try {
      var doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      var resp = await doFetch('/api/books/categories?ts=' + Date.now());
      if (!resp.ok) throw new Error('Failed to fetch categories: ' + resp.status);

      var result = await resp.json();
      var categories = result.data || [];
      populateCategoryFilter(categories.map(function (item) {
        return { category: item.category };
      }));

      lastCategoryRefreshAt = Date.now();
    } catch (err) {
      console.error('[StudentBorrowed] loadCategoryOptions:', err);
    }
  }

  async function refreshCategoriesIfNeeded(force) {
    var isStale = (Date.now() - lastCategoryRefreshAt) > CATEGORY_REFRESH_INTERVAL_MS;
    if (!force && !isStale) return;
    if (isRefreshingCategories) return;

    isRefreshingCategories = true;
    try {
      await loadCategoryOptions();
    } finally {
      isRefreshingCategories = false;
    }
  }

  function populateStatusFilter(records) {
    const select = document.getElementById('booksStatusFilter');
    if (!select) return;

    const current = normalizeStatus(select.value);
    const map = new Map();

    (records || []).forEach(function (r) {
      const normalized = normalizeStatus(r.status);
      if (!normalized || map.has(normalized)) return;
      map.set(normalized, formatStatusLabel(normalized));
    });

    const sorted = Array.from(map.entries()).sort(function (a, b) {
      return a[1].localeCompare(b[1]);
    });

    select.innerHTML = '<option value="">All Status</option>';
    sorted.forEach(function (entry) {
      const option = document.createElement('option');
      option.value = entry[0];
      option.textContent = entry[1];
      if (current && entry[0] === current) option.selected = true;
      select.appendChild(option);
    });
  }

  function renderPending(rows) {
    const tbody = document.getElementById('pendingBorrowedTbody');
    const empty = document.getElementById('pendingBorrowedEmpty');
    if (!tbody || !empty) return;

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = rows.map(function (r) {
      var borrowingId = Number(r.borrow_id || r.id || 0);
      var status = normalizeStatus(r.status);
      var statusLabel = status === 'expired' ? 'Claim Expired' : (status === 'pending_pickup' ? 'Pending Pickup' : formatStatusLabel(status));
      var isExpired = status === 'expired';
      var actionButtons = isExpired
        ? '<span style="color:#999;font-size:12px;">Claim expired</span>'
        : '<button type="button" class="sa-action-btn" onclick="window.StudentBorrowed.showQRModal(' + borrowingId + ')"><i class="bi bi-qr-code"></i> View QR</button>' +
          '&nbsp;<button type="button" class="sa-action-btn cancel-style" onclick="window.StudentBorrowed.cancelBorrowRequest(' + borrowingId + ')"><i class="bi bi-x-circle"></i> Cancel</button>';
      return '<tr>' +
        '<td style="text-align:center;"><input type="checkbox" class="form-check-input borrowed-row-checkbox" data-tab="pending" data-borrow-id="' + borrowingId + '"></td>' +
        '<td>' + (r.title || 'N/A') + '</td>' +
        '<td>' + (r.author || 'N/A') + '</td>' +
        '<td>' + formatDate(r.borrow_date) + '</td>' +
        '<td>' + (r.claim_expires_at ? formatDate(r.claim_expires_at) : 'Pending') + '</td>' +
        '<td><span class="status-pill ' + (isExpired ? 'expired' : 'borrowed') + '">' + statusLabel + '</span></td>' +
        '<td style="white-space: nowrap;">' + actionButtons + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderActive(rows) {
    const tbody = document.getElementById('activeBorrowedTbody');
    const empty = document.getElementById('activeBorrowedEmpty');
    if (!tbody || !empty) return;

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = rows.map(function (r) {
      var borrowingId = Number(r.borrow_id || r.id || 0);
      var status = normalizeStatus(r.status);
      var statusLabel = status === 'overdue' ? 'Overdue' : (status === 'picked_up' ? 'Picked Up' : 'Borrowed');
      var statusClass = status === 'overdue' ? 'overdue' : 'borrowed';
      return '<tr>' +
        '<td style="text-align:center;"><input type="checkbox" class="form-check-input borrowed-row-checkbox" data-tab="active" data-borrow-id="' + borrowingId + '"></td>' +
        '<td>' + (r.author || 'N/A') + '</td>' +
        '<td>' + formatDate(r.borrow_date) + '</td>' +
        '<td>' + formatDate(r.due_date) + '</td>' +
        '<td><span class="status-pill ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td>' + durationDays(r.borrow_date, r.due_date) + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderHistory(rows) {
    const tbody = document.getElementById('borrowHistoryTbody');
    const empty = document.getElementById('borrowHistoryEmpty');
    if (!tbody || !empty) return;

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = rows.map(function (r) {
      var borrowingId = Number(r.borrow_id || r.id || 0);
      return '<tr>' +
        '<td style="text-align:center;"><input type="checkbox" class="form-check-input borrowed-row-checkbox" data-tab="history" data-borrow-id="' + borrowingId + '"></td>' +
        '<td>' + (r.title || 'N/A') + '</td>' +
        '<td>' + (r.author || 'N/A') + '</td>' +
        '<td>' + formatDate(r.borrow_date) + '</td>' +
        '<td>' + formatDate(r.due_date) + '</td>' +
        '<td>' + formatDate(r.return_date) + '</td>' +
        '<td>' + durationDays(r.borrow_date, r.return_date || r.due_date) + '</td>' +
      '</tr>';
    }).join('');
  }

  function splitBorrowings(records) {
    const pending = [];
    const active = [];
    const history = [];

    records.forEach(function (r) {
      const stage = getLifecycleStageFromStatus(r.status);
      if (stage === 'pending') {
        pending.push(r);
      } else if (stage === 'active') {
        active.push(r);
      } else if (stage === 'history') {
        history.push(r);
      }
    });

    return { pending, active, history };
  }

  function applyCombinedFilters() {
    const search = normalizeStatus(filters.search);
    const category = normalizeCategory(filters.category);
    const status = normalizeStatus(filters.status);

    const filtered = (allRecords || []).filter(function (r) {
      if (search) {
        const title = String(r.title || '').toLowerCase();
        const author = String(r.author || '').toLowerCase();
        const isbn = String(r.isbn || '').toLowerCase();
        const accession = String(r.accession_number || '').toLowerCase();

        if (
          !title.includes(search) &&
          !author.includes(search) &&
          !isbn.includes(search) &&
          !accession.includes(search)
        ) {
          return false;
        }
      }

      if (category && normalizeCategory(r.category) !== category) {
        return false;
      }

      if (status && normalizeStatus(r.status) !== status) {
        return false;
      }

      return true;
    });

    const grouped = splitBorrowings(filtered);
    setCount('count-pending', grouped.pending.length);
    setCount('count-active', grouped.active.length);
    setCount('count-history', grouped.history.length);

    renderPending(grouped.pending);
    renderActive(grouped.active);
    renderHistory(grouped.history);
    setTabState(currentTab);
    syncSelectAllState();
  }

  function setupFilters() {
    const searchInput = document.getElementById('booksSearchInput');
    const categoryFilter = document.getElementById('booksCategoryFilter');
    const statusFilter = document.getElementById('booksStatusFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const selectAllCheckbox = document.getElementById('selectAllBooks');

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          filters.search = String(searchInput.value || '').trim();
          applyCombinedFilters();
        }, 300);
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', function () {
        filters.category = categoryFilter.value || '';
        applyCombinedFilters();
      });

      categoryFilter.addEventListener('focus', function () {
        refreshCategoriesIfNeeded(true);
      });
      categoryFilter.addEventListener('mousedown', function () {
        refreshCategoriesIfNeeded(true);
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', function () {
        filters.status = statusFilter.value || '';
        applyCombinedFilters();
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', function () {
        filters.search = '';
        filters.category = '';
        filters.status = '';

        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = '';
        if (statusFilter) statusFilter.value = '';

        applyCombinedFilters();
      });
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function () {
        var rowCheckboxes = getVisibleRowCheckboxes();
        rowCheckboxes.forEach(function (checkbox) {
          checkbox.checked = selectAllCheckbox.checked;
        });
        syncSelectAllState();
      });
    }

    document.addEventListener('change', function (event) {
      if (!event.target || !event.target.classList || !event.target.classList.contains('borrowed-row-checkbox')) {
        return;
      }
      syncSelectAllState();
    });
  }

  async function loadBorrowedData() {
    const studentId = sessionStorage.getItem('studentId');
    if (!studentId) return;

    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const response = await doFetch('/api/book-borrowings/' + studentId);
      if (!response.ok) throw new Error('Failed to fetch borrowed books');

      const result = await response.json();
      allRecords = (result.data && result.data.books) ? result.data.books : [];

      await loadCategoryOptions();
      populateStatusFilter(allRecords);
      applyCombinedFilters();
    } catch (err) {
      console.error('[StudentBorrowed] loadBorrowedData:', err);
      allRecords = [];
      renderPending([]);
      renderActive([]);
      renderHistory([]);
      setCount('count-pending', 0);
      setCount('count-active', 0);
      setCount('count-history', 0);
    }
  }

  async function cancelBorrowRequest(borrowingId) {
    if (!borrowingId) return;
    var record = (allRecords || []).find(function (row) {
      return Number(row.borrow_id || row.id || 0) === Number(borrowingId);
    });
    var bookTitle = String((record && record.title) || 'this book').trim();

    if (!window.ui || typeof window.ui.showAppConfirm !== 'function') {
      console.error('[StudentBorrowed] showAppConfirm is unavailable');
      if (typeof window.showToast === 'function') {
        window.showToast('Unable to open confirmation dialog. Please refresh the page.', 'error');
      }
      return;
    }

    var confirmed = await window.ui.showAppConfirm(
      'Cancel your borrow request for "' + bookTitle + '"? The reserved copy will be returned to the available pool.',
      'Cancel Borrow Request',
      'Yes, Cancel',
      'Keep Request'
    );

    if (!confirmed) return;

    try {
      var doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      var response = await doFetch('/api/book-borrowings/' + encodeURIComponent(borrowingId) + '/cancel', {
        method: 'POST'
      });

      if (!response.ok) {
        var error = await response.json().catch(function () { return {}; });
        throw new Error(error.message || 'Failed to cancel borrow request');
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Borrow request cancelled successfully.', 'success');
      }

      await loadBorrowedData();
    } catch (err) {
      console.error('[StudentBorrowed] cancelBorrowRequest:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('Error: ' + err.message, 'error');
      }
    }
  }

  async function showQRModal(borrowingId) {
    if (!borrowingId) return;
    var record = (allRecords || []).find(function (row) {
      return Number(row.borrow_id || row.id || 0) === Number(borrowingId);
    });

    if (!record) {
      if (typeof window.showToast === 'function') {
        window.showToast('Book record not found', 'error');
      }
      return;
    }

    // Show loading state
    var modal = document.getElementById('qrCodeModal');
    if (!modal) {
      console.error('[StudentBorrowed] QR modal not found in DOM');
      if (typeof window.showToast === 'function') {
        window.showToast('Modal error. Please refresh the page.', 'error');
      }
      return;
    }

    var qrImage = document.getElementById('qrCodeImage');
    var bookTitle = document.getElementById('qrModalBookTitle');
    if (bookTitle) bookTitle.textContent = record.title || 'Book';
    if (qrImage) {
      qrImage.src = '';
      qrImage.style.fontSize = '14px';
      qrImage.style.textAlign = 'center';
      qrImage.textContent = 'Loading QR code...';
      qrImage.style.display = 'block';
      qrImage.style.minHeight = '200px';
    }

    modal.style.display = 'flex';

    try {
      var doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      var response = await doFetch('/api/borrowings/' + encodeURIComponent(borrowingId) + '/qr');
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR code: ' + response.status);
      }

      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      
      if (qrImage) {
        qrImage.src = url;
        qrImage.style.display = 'block';
        qrImage.textContent = '';
      }

      // Set download link
      var downloadBtn = document.getElementById('qrDownloadBtn');
      if (downloadBtn) {
        downloadBtn.onclick = function () {
          fetchWithCsrf('/api/borrowings/' + encodeURIComponent(borrowingId) + '/qr/download')
            .then(function (resp) {
              if (!resp.ok) throw new Error('Download failed');
              return resp.blob();
            })
            .then(function (blob) {
              var downloadUrl = URL.createObjectURL(blob);
              var link = document.createElement('a');
              link.href = downloadUrl;
              link.download = 'Pickup-QR-' + borrowingId + '.png';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(downloadUrl);
              if (typeof window.showToast === 'function') {
                window.showToast('QR code downloaded', 'success');
              }
            })
            .catch(function (err) {
              console.error('QR download error:', err);
              if (typeof window.showToast === 'function') {
                window.showToast('Download failed: ' + err.message, 'error');
              }
            });
        };
      }
    } catch (err) {
      console.error('[StudentBorrowed] showQRModal:', err);
      if (qrImage) {
        qrImage.textContent = 'Error loading QR code: ' + err.message;
        qrImage.style.color = '#d32f2f';
      }
      if (typeof window.showToast === 'function') {
        window.showToast('Error: ' + err.message, 'error');
      }
    }
  }

  function closeQRModal() {
    var modal = document.getElementById('qrCodeModal');
    if (modal) {
      modal.style.display = 'none';
      var qrImage = document.getElementById('qrCodeImage');
      if (qrImage && qrImage.src) {
        URL.revokeObjectURL(qrImage.src);
        qrImage.src = '';
      }
    }
  }

  async function init() {
    if (typeof window.ensureStudentSessionFromServer === 'function') {
      window.ensureStudentSessionFromServer();
    }

    setupFilters();
    initTabs();
    setTabState('active');
    await loadBorrowedData();

    var refreshHandle = setInterval(function () {
      refreshCategoriesIfNeeded(false);
    }, CATEGORY_REFRESH_INTERVAL_MS);

    window.addEventListener('beforeunload', function () {
      clearInterval(refreshHandle);
    }, { once: true });
  }

  window.StudentBorrowed = window.StudentBorrowed || {};
  window.StudentBorrowed.cancelBorrowRequest = cancelBorrowRequest;
  window.StudentBorrowed.showQRModal = showQRModal;
  window.StudentBorrowed.closeQRModal = closeQRModal;
  document.addEventListener('DOMContentLoaded', init);
})();

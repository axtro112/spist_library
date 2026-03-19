/*
FILE: available-books.js

PURPOSE
Student Available Books page logic:
- load latest books from API
- show available books table
- apply search/category/status filters
- keep category options aligned with latest admin-added categories
*/
(function () {
  'use strict';

  let availBooks = [];
  let availFiltered = [];
  let allBooksForFilters = [];
  let availSearchTimer = null;
  let availFilters = { search: '', category: '', status: '' };
  let isRefreshing = false;
  let lastRefreshAt = 0;
  const CATEGORY_REFRESH_INTERVAL_MS = 15000;

  function normalizeCategory(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function getBookAvailability(book) {
    const totalQty = book.quantity || 1;
    const availableQty = (book.available_quantity !== undefined && book.available_quantity !== null)
      ? book.available_quantity
      : totalQty;
    return { totalQty: totalQty, availableQty: availableQty };
  }

  function matchesStatusFilter(book, statusValue) {
    if (!statusValue) return true;

    const selected = String(statusValue).trim().toLowerCase();
    const currentStatus = String(book.status || '').trim().toLowerCase();
    const availability = getBookAvailability(book);
    const isAllBorrowed = availability.availableQty === 0;

    if (selected === 'available') {
      return currentStatus !== 'maintenance' && !isAllBorrowed;
    }

    if (selected === 'all borrowed' || selected === 'borrowed') {
      return isAllBorrowed;
    }

    if (selected === 'maintenance') {
      return currentStatus === 'maintenance';
    }

    return currentStatus === selected;
  }

  async function loadAvailableBooks() {
    try {
      const resp = await fetchWithCsrf('/api/books?ts=' + Date.now());
      if (!resp.ok) throw new Error('Failed to fetch books: ' + resp.status);

      const result = await resp.json();
      // Load ALL books from API - don't filter here
      allBooksForFilters = result.data || [];
      lastRefreshAt = Date.now();
      
      // DEBUG: Log what we received from the API
      console.log('[AvailBooks] API returned ' + allBooksForFilters.length + ' books');
      allBooksForFilters.forEach(function(book) {
        console.log('  Book ID ' + book.id + ': ' + book.title + ' | Status: ' + (book.status || 'available') + ' | Qty: ' + book.available_quantity);
      });
      
      // Render ALL books directly - no filtering at load time
      renderAllBooks(allBooksForFilters);
      
      await loadCategories();
    } catch (err) {
      console.error('[AvailBooks]', err);
      const tbody = document.querySelector('#availBooksBody');
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="8" class="text-center" style="color:red;padding:20px;">Error loading books: ' + err.message + '</td></tr>';
      }
    }
  }

  function renderAllBooks(books) {
    const tbody = document.getElementById('availBooksBody');
    const selectAllCheckbox = document.getElementById('selectAllBooks');
    
    console.log('[RenderAllBooks] Called with ' + (books ? books.length : 'null') + ' books');
    if (!tbody) {
      console.error('[RenderAllBooks] tbody not found!');
      return;
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }

    if (!books || books.length === 0) {
      console.log('[RenderAllBooks] No books to render');
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:32px;color:#666;">No books found</td></tr>';
      return;
    }

    const rows = books.map(function (book) {
      const isAvailable = (book.available_quantity || 0) > 0;
      const badgeClass = isAvailable ? 'u-badge u-badge-available' : 'u-badge u-badge-borrowed';
      const borrowBtn = isAvailable 
        ? '<button class="u-btn u-btn-primary" onclick="showBorrowModal(\'' + (book.id || '') + '\')" title="Borrow this book"><i class="bi bi-book-fill"></i> Borrow</button>'
        : '<button class="u-btn u-btn-primary" disabled style="opacity:0.5;cursor:not-allowed;" title="This book is not available"><i class="bi bi-book-fill"></i> Not Available</button>';
      
      return '<tr>' +
        '<td style="text-align:center;">' +
          '<input type="checkbox" class="form-check-input book-row-checkbox" data-book-id="' + (book.id || '') + '" title="Select this book" ' + (!isAvailable ? 'disabled' : '') + ' style="' + (!isAvailable ? 'cursor:not-allowed;opacity:0.5;' : 'cursor:pointer;') + '">' +
        '</td>' +
        '<td>' + (book.id || '—') + '</td>' +
        '<td><strong>' + (book.title || '—') + '</strong></td>' +
        '<td>' + (book.author || 'Unknown') + '</td>' +
        '<td>' + (book.category || 'Uncategorized') + '</td>' +
        '<td>' + (book.isbn || '—') + '</td>' +
        '<td style="text-align:center;"><span class="' + badgeClass + '">' + (book.available_quantity || 0) + ' / ' + (book.quantity || '?') + '</span></td>' +
        '<td>' + borrowBtn + '</td>' +
      '</tr>';
    }).join('');

    console.log('[RenderAllBooks] Generated ' + rows.split('<tr>').length + ' rows, setting innerHTML...');
    tbody.innerHTML = rows;
    console.log('[RenderAllBooks] Render complete. Table now has ' + tbody.querySelectorAll('tr').length + ' rows');

    syncSelectAllState();
  }

  async function loadCategories() {
    const select = document.getElementById('booksCategoryFilter');
    if (!select) return;

    try {
      const resp = await fetchWithCsrf('/api/books/categories?ts=' + Date.now());
      if (!resp.ok) throw new Error('Failed to fetch categories: ' + resp.status);

      const result = await resp.json();
      const categories = result.data || [];
      populateCategories(categories.map(function (item) {
        return { category: item.category };
      }));
    } catch (err) {
      console.error('[AvailBooks] loadCategories:', err);
      // Keep existing options if category fetch fails.
    }
  }

  async function refreshLatestBooksIfNeeded(force) {
    const isStale = (Date.now() - lastRefreshAt) > CATEGORY_REFRESH_INTERVAL_MS;
    if (!force && !isStale) return;
    if (isRefreshing) return;

    isRefreshing = true;
    try {
      await loadAvailableBooks();
    } finally {
      isRefreshing = false;
    }
  }

  function populateCategories(sourceBooks) {
    const select = document.getElementById('booksCategoryFilter');
    if (!select) return;

    const currentValue = select.value || '';
    const normalizedCurrent = normalizeCategory(currentValue);
    const categoryMap = new Map();

    (sourceBooks || []).forEach(function (book) {
      const raw = String(book.category || '').trim().replace(/\s+/g, ' ');
      const normalized = normalizeCategory(raw);
      if (!normalized || categoryMap.has(normalized)) return;
      categoryMap.set(normalized, raw);
    });

    const categories = Array.from(categoryMap.values()).sort(function (a, b) {
      return a.localeCompare(b);
    });

    select.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(function (category) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      if (normalizedCurrent && normalizeCategory(category) === normalizedCurrent) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    const hasCurrent = categories.some(function (category) {
      return normalizeCategory(category) === normalizedCurrent;
    });

    if (normalizedCurrent && !hasCurrent) {
      select.value = '';
      availFilters.category = '';
    }
  }

  function applyFilters() {
    let filtered = allBooksForFilters;
    
    console.log('[ApplyFilters] Starting with ' + allBooksForFilters.length + ' books');
    console.log('[ApplyFilters] Filters: search="' + availFilters.search + '" | category="' + availFilters.category + '" | status="' + availFilters.status + '"');
    
    // Apply search filter
    if (availFilters.search) {
      const query = availFilters.search.toLowerCase();
      filtered = filtered.filter(function (book) {
        return (book.title && book.title.toLowerCase().includes(query)) ||
               (book.author && book.author.toLowerCase().includes(query)) ||
               (book.isbn && book.isbn.toLowerCase().includes(query));
      });
      console.log('[ApplyFilters] After search filter: ' + filtered.length + ' books');
    }
    
    // Apply category filter
    if (availFilters.category) {
      filtered = filtered.filter(function (book) {
        return normalizeCategory(book.category) === normalizeCategory(availFilters.category);
      });
      console.log('[ApplyFilters] After category filter: ' + filtered.length + ' books');
    }
    
    // Apply status filter
    if (availFilters.status) {
      const statusLower = availFilters.status.toLowerCase();
      console.log('[ApplyFilters] Applying status filter: "' + statusLower + '"');
      filtered = filtered.filter(function (book) {
        const isAvailable = (book.available_quantity || 0) > 0;
        if (statusLower === 'available') {
          return isAvailable;
        } else if (statusLower === 'all borrowed' || statusLower === 'borrowed') {
          return !isAvailable;
        } else if (statusLower === 'maintenance') {
          return (book.status || '').toLowerCase() === 'maintenance';
        }
        return true;
      });
      console.log('[ApplyFilters] After status filter: ' + filtered.length + ' books');
    }
    
    console.log('[ApplyFilters] Final result: ' + filtered.length + ' books to render');
    availFiltered = filtered;
    renderAllBooks(filtered);
  }


  function syncSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAllBooks');
    if (!selectAllCheckbox) return;

    const rowCheckboxes = Array.from(document.querySelectorAll('.book-row-checkbox'));
    if (!rowCheckboxes.length) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }

    const checkedCount = rowCheckboxes.filter(function (checkbox) {
      return checkbox.checked;
    }).length;

    selectAllCheckbox.checked = checkedCount > 0 && checkedCount === rowCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
  }

  function setupListeners() {
    const searchInput = document.getElementById('booksSearchInput');
    const categoryFilter = document.getElementById('booksCategoryFilter');
    const statusFilter = document.getElementById('booksStatusFilter');
    const clearBtn = document.getElementById('clearFiltersBtn');
    const selectAllCheckbox = document.getElementById('selectAllBooks');

    if (searchInput) {
      searchInput.addEventListener('input', function (event) {
        clearTimeout(availSearchTimer);
        availSearchTimer = setTimeout(function () {
          availFilters.search = String(event.target.value || '').trim();
          applyFilters();
        }, 300);
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', function (event) {
        availFilters.category = event.target.value || '';
        applyFilters();
      });

      // Refresh categories when user opens/focuses dropdown so newly added genres appear quickly.
      categoryFilter.addEventListener('focus', function () {
        refreshLatestBooksIfNeeded(true);
      });
      categoryFilter.addEventListener('mousedown', function () {
        refreshLatestBooksIfNeeded(true);
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', function (event) {
        availFilters.status = event.target.value || '';
        applyFilters();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        availFilters = { search: '', category: '', status: '' };
        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        applyFilters();
      });
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function (event) {
        const rowCheckboxes = document.querySelectorAll('.book-row-checkbox');
        rowCheckboxes.forEach(function (checkbox) {
          checkbox.checked = event.target.checked;
        });
        syncSelectAllState();
      });
    }

    document.addEventListener('change', function (event) {
      if (!event.target || !event.target.classList || !event.target.classList.contains('book-row-checkbox')) {
        return;
      }
      syncSelectAllState();
    });

  }

  async function init() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const userRole = sessionStorage.getItem('userRole');
    const studentId = sessionStorage.getItem('studentId');

    if (!isLoggedIn || userRole !== 'student' || !studentId) {
      alert('Please log in with student credentials to access this page.');
      sessionStorage.clear();
      window.location.href = '/login';
      return;
    }

    const userNameEl = document.getElementById('userName');
    const userIDEl = document.getElementById('userID');
    if (userNameEl) userNameEl.textContent = sessionStorage.getItem('userName') || 'Student';
    if (userIDEl) userIDEl.textContent = sessionStorage.getItem('userID') || 'STD-0000-000';

    // Shared callback used by quick-borrow-modal.js after successful borrow.
    window.onQuickBorrowSuccess = async function () {
      await loadAvailableBooks();
    };

    setupListeners();
    await loadAvailableBooks();

    // Keep category list in sync with admin-side book/genre updates.
    const refreshHandle = setInterval(function () {
      refreshLatestBooksIfNeeded(false);
    }, CATEGORY_REFRESH_INTERVAL_MS);

    window.addEventListener('beforeunload', function () {
      clearInterval(refreshHandle);
    }, { once: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

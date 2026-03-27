let currentBookIdForDeletion = null;
let students = [];
let allBooks = [];

const filters = {
  search: "",
  category: "",
  status: "",
};
let booksCategoryLastRefreshAt = 0;
let booksCategoryRefreshing = false;
const BOOKS_CATEGORY_REFRESH_MS = 15000;

// ═══════════════════════════════════════════════════════════════════════════
// BOOK METADATA VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const bookMetaValidation = {
  validateTitle(title) {
    const trimmed = (title || "").trim();
    if (!trimmed) return { valid: false, error: "Title is required" };
    if (trimmed.length < 2) return { valid: false, error: "Title must be at least 2 characters" };
    if (trimmed.length > 255) return { valid: false, error: "Title must be less than 255 characters" };
    return { valid: true };
  },

  validateAuthor(author) {
    const trimmed = (author || "").trim();
    if (!trimmed) return { valid: false, error: "Author is required" };
    if (trimmed.length < 2) return { valid: false, error: "Author must be at least 2 characters" };
    if (trimmed.length > 255) return { valid: false, error: "Author must be less than 255 characters" };
    return { valid: true };
  },

  validateISBN(isbn) {
    const trimmed = (isbn || "").trim();
    if (!trimmed) return { valid: false, error: "ISBN is required" };
    // Allow ISBN-10 (10 digits/X), ISBN-13 (13 digits), or looser barcode format (5-20 chars)
    const isbnPattern = /^(?:\d{10}X?|\d{13}|[\d\-]{5,20})$/i;
    if (!isbnPattern.test(trimmed)) {
      return { valid: false, error: "ISBN must be 10–13 digits or valid barcode format" };
    }
    return { valid: true };
  },

  validateCategory(category) {
    const trimmed = (category || "").trim();
    if (!trimmed) return { valid: false, error: "Category is required" };
    if (trimmed.length > 100) return { valid: false, error: "Category must be less than 100 characters" };
    return { valid: true };
  },

  validateStatus(status) {
    const trimmed = (status || "").trim();
    const validStatuses = ["available", "active", "maintenance", "retired", "borrowed"];
    if (!trimmed) return { valid: false, error: "Status is required" };
    if (!validStatuses.includes(trimmed)) {
      return { valid: false, error: `Status must be one of: ${validStatuses.join(", ")}` };
    }
    return { valid: true };
  },

  validateBookForm(formData) {
    const errors = [];
    const titleVal = this.validateTitle(formData.title);
    if (!titleVal.valid) errors.push(titleVal.error);
    const authorVal = this.validateAuthor(formData.author);
    if (!authorVal.valid) errors.push(authorVal.error);
    const isbnVal = this.validateISBN(formData.isbn);
    if (!isbnVal.valid) errors.push(isbnVal.error);
    const categoryVal = this.validateCategory(formData.category);
    if (!categoryVal.valid) errors.push(categoryVal.error);
    const statusVal = this.validateStatus(formData.status);
    if (!statusVal.valid) errors.push(statusVal.error);
    return {
      valid: errors.length === 0,
      errors: errors,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UI SYNC HELPERS (after copy changes)
// ═══════════════════════════════════════════════════════════════════════════
const copySync = {
  async refreshTableRow(bookId) {
    console.log("[copySync] Refreshing table row for book:", bookId);
    // After copy changes, reload book list to show updated quantities
    await loadBooks();
    if (typeof buildCategoryOptions === 'function') {
      await loadCategories();
    }
  },

  async refreshAfterCopiesChange() {
    console.log("[copySync] Copies were modified, syncing UI...");
    await reloadBooksAndStats();
  },
};

function normalizeCategory(category) {
  return (category || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function formatCategoryLabel(category) {
  const trimmed = (category || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildCategoryOptions(books) {
  const categoryFilter = document.getElementById("categoryFilter");
  if (!categoryFilter) {
    console.error("[Books Filter] Category filter element not found!");
    return;
  }

  const currentValue = categoryFilter.value || "";
  const normalizedCurrent = normalizeCategory(currentValue);

  const categoryMap = new Map();
  (books || []).forEach((book) => {
    const raw = (book && book.category ? String(book.category) : "").trim().replace(/\s+/g, " ");
    const normalized = normalizeCategory(raw);
    if (!normalized) return;
    if (!categoryMap.has(normalized)) {
      categoryMap.set(normalized, {
        value: raw,
        label: formatCategoryLabel(raw)
      });
    }
  });

  const sorted = Array.from(categoryMap.entries())
    .map(([normalized, data]) => ({ normalized, ...data }))
    .sort((a, b) => a.label.localeCompare(b.label));

  categoryFilter.innerHTML = '<option value="">All Categories</option>';

  sorted.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    if (normalizedCurrent && normalizedCurrent === category.normalized) {
      option.selected = true;
    }
    categoryFilter.appendChild(option);
  });

  if (!sorted.some((category) => category.normalized === normalizedCurrent)) {
    categoryFilter.value = "";
  }
}

function closeModal() {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => (modal.style.display = "none"));
  document.body.classList.remove("modal-open");
  currentBookIdForDeletion = null;
}

function showModal(modalId) {
  document.getElementById(modalId).style.display = "flex";
  document.body.classList.add("modal-open");
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function hydrateSessionFromPageDataset() {
  const body = document.body;
  if (!body) return;

  const dataRole = body.getAttribute("data-role") || "";
  const dataAdminId = body.getAttribute("data-admin-id") || "";
  const dataAdminRole = body.getAttribute("data-admin-role") || "";

  if (dataRole === "admin" && dataAdminId) {
    sessionStorage.setItem("isLoggedIn", "true");
    sessionStorage.setItem("userRole", "admin");
    sessionStorage.setItem("adminId", dataAdminId);
    if (dataAdminRole) {
      sessionStorage.setItem("adminRole", dataAdminRole);
    }
  }
}

async function recoverAdminSessionFromServerIfNeeded() {
  if (sessionStorage.getItem("isLoggedIn") && sessionStorage.getItem("userRole")) {
    return;
  }

  if (window.AuthHelper && typeof window.AuthHelper.ensureAdminSessionFromServer === "function") {
    await window.AuthHelper.ensureAdminSessionFromServer();
    return;
  }

  try {
    const response = await fetch("/api/debug/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      keepalive: true,
    });

    if (!response.ok) return;
    const payload = await response.json().catch(() => null);
    const user = payload && payload.sessionData && payload.sessionData.user;

    if (user && user.userRole === "admin" && user.id) {
      sessionStorage.setItem("isLoggedIn", "true");
      sessionStorage.setItem("userRole", "admin");
      sessionStorage.setItem("adminId", String(user.id));
      if (user.role) sessionStorage.setItem("adminRole", user.role);
    }
  } catch (_) {
    // No-op: normal guard runs below if recovery fails.
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  hydrateSessionFromPageDataset();
  await recoverAdminSessionFromServerIfNeeded();

  const isLoggedIn = sessionStorage.getItem("isLoggedIn");
  const userRole = sessionStorage.getItem("userRole");

  if (!isLoggedIn || !userRole) {
    alert("Please log in to access this page.");
    window.location.href = "/login";
    return;
  }

  const addBookForm = document.getElementById("addBookForm");
  const editBookForm = document.getElementById("editBookForm");
  const deleteConfirmBtn = document.querySelector(".delete-confirm-btn");

  if (addBookForm) {
    addBookForm.addEventListener("submit", handleAddBook);
  }

  if (editBookForm) {
    editBookForm.addEventListener("submit", handleEditBook);
  }

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", handleDeleteBook);
  }

  const statusEdit = document.getElementById("statusEdit");
  if (statusEdit) {
    statusEdit.addEventListener("change", handleStatusChange);
  }

  await Promise.all([loadBooks(), loadStudents(), loadCategories()]);
  
  // Set up search and filter event listeners
  setupSearchAndFilters();

  const booksCategoryRefreshHandle = setInterval(() => {
    refreshCategoriesIfNeeded(false);
  }, BOOKS_CATEGORY_REFRESH_MS);

  window.addEventListener('beforeunload', () => {
    clearInterval(booksCategoryRefreshHandle);
  }, { once: true });
});

// Load unique categories from all books to populate the dropdown
async function loadCategories() {
  console.log('[Books Filter] Loading categories...');
  try {
    const response = await fetchWithCsrf('/api/admin/books?ts=' + Date.now());
    if (!response.ok) {
      console.error('[Books Filter] Failed to fetch books for categories');
      return;
    }
    
    const result = await response.json();
    const books = result.data || []; // Extract books from response wrapper
    console.log('[Books Filter] Total books loaded:', books.length);

    buildCategoryOptions(books);
    booksCategoryLastRefreshAt = Date.now();
    console.log('[Books Filter] Category dropdown populated from live data');
  } catch (error) {
    console.error('[Books Filter] Error loading categories:', error);
  }
}

async function refreshCategoriesIfNeeded(force) {
  const isStale = (Date.now() - booksCategoryLastRefreshAt) > BOOKS_CATEGORY_REFRESH_MS;
  if (!force && !isStale) return;
  if (booksCategoryRefreshing) return;

  booksCategoryRefreshing = true;
  try {
    await loadCategories();
  } finally {
    booksCategoryRefreshing = false;
  }
}

// Search and Filter functionality
function setupSearchAndFilters() {
  console.log('[Books Filter] Initializing filters...');
  
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const clearFiltersBtn = document.getElementById('clearFilters');
  
  console.log('[Books Filter] Elements found:', {
    searchInput: !!searchInput,
    categoryFilter: !!categoryFilter,
    statusFilter: !!statusFilter,
    clearFiltersBtn: !!clearFiltersBtn
  });
  
  // Check if all required elements exist
  if (!searchInput || !categoryFilter || !statusFilter || !clearFiltersBtn) {
    console.error('[Books Filter] Some filter elements not found! Cannot initialize filters.');
    return;
  }
  
  // Debounce search input to avoid too many requests
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.search = (searchInput.value || '').trim();
      applyCombinedFilters();
    }, 300); // Wait 300ms after user stops typing
  });
  
  // Apply filters immediately when changed
  categoryFilter.addEventListener('change', () => {
    console.log('[Books Filter] Category changed to:', categoryFilter.value);
    filters.category = categoryFilter.value || '';
    applyCombinedFilters();
  });

  categoryFilter.addEventListener('focus', () => {
    refreshCategoriesIfNeeded(true);
  });
  categoryFilter.addEventListener('mousedown', () => {
    refreshCategoriesIfNeeded(true);
  });
  
  statusFilter.addEventListener('change', () => {
    console.log('[Books Filter] Status changed to:', statusFilter.value);
    filters.status = statusFilter.value || '';
    applyCombinedFilters();
  });
  
  // Clear all filters button
  clearFiltersBtn.addEventListener('click', () => {
    console.log('[Books Filter] Clearing all filters');
    searchInput.value = '';
    categoryFilter.value = '';
    statusFilter.value = '';
    filters.search = '';
    filters.category = '';
    filters.status = '';
    applyCombinedFilters();
  });
  
  console.log('[Books Filter] All event listeners attached successfully');
}

function getBookAvailability(book) {
  const totalQty = book.quantity || 1;
  const availableQty = (book.available_quantity !== undefined && book.available_quantity !== null)
    ? book.available_quantity
    : totalQty;

  return { totalQty, availableQty };
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

function applyCombinedFilters() {
  const search = (filters.search || '').toLowerCase();
  const category = normalizeCategory(filters.category || '');
  const status = filters.status || '';

  const filteredBooks = (allBooks || []).filter((book) => {
    const title = String(book.title || '').toLowerCase();
    const author = String(book.author || '').toLowerCase();
    const isbn = String(book.isbn || '').toLowerCase();

    const searchMatch =
      !search ||
      title.includes(search) ||
      author.includes(search) ||
      isbn.includes(search);

    const categoryMatch =
      !category || normalizeCategory(book.category) === category;

    const statusMatch = matchesStatusFilter(book, status);

    return searchMatch && categoryMatch && statusMatch;
  });

  displayBooks(filteredBooks);
  updateResultCount(filteredBooks.length, (allBooks || []).length);
}

function updateResultCount(filteredCount, totalCount) {
  const resultCountEl = document.getElementById('resultCount');
  if (!resultCountEl) return;
  resultCountEl.textContent = `Showing ${filteredCount} of ${totalCount} books`;
}

async function loadBooks() {
  try {
    const url = '/api/admin/books';
    
    console.log("[FRONTEND] Fetching books from:", url);
    const response = await fetchWithCsrf(url);
    console.log("[FRONTEND] Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const data = await response.json();
      console.error("[FRONTEND] API error:", data);
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('adminId');
        sessionStorage.removeItem('adminRole');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = '/login';
        return;
      }
      throw new Error(data.message || "Failed to fetch books");
    }
    const result = await response.json();
    allBooks = result.data || []; // Extract books from response wrapper
    console.log("[FRONTEND] Books data received:", allBooks.length, "books");

    buildCategoryOptions(allBooks);
    applyCombinedFilters();
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to load books. Please try again later.");
  }
}

// Auto-reload function for refreshing books and statistics after CRUD operations
async function reloadBooksAndStats() {
  await loadBooks();
  // Also refresh dashboard stats if totalBooks element exists (dashboard page)
  const totalBooksElement = document.getElementById('totalBooks');
  if (totalBooksElement && typeof refreshDashboardStats === 'function') {
    await refreshDashboardStats();
  }
}

function displayBooks(books) {
  const tbody = document.querySelector(".user-table tbody");
  console.log("[FRONTEND] displayBooks called with", books.length, "books");
  console.log("[FRONTEND] Table tbody element found:", !!tbody);
  
  if (!tbody) {
    console.error("[FRONTEND] ERROR: Table tbody not found!");
    return;
  }
  
  tbody.innerHTML = "";

  if (books.length === 0) {
    const totalBooks = (allBooks || []).length;
    const hasActiveFilters = Boolean((filters.search || '').trim() || (filters.category || '').trim() || (filters.status || '').trim());

    if (totalBooks === 0) {
      console.info("[FRONTEND] Empty data set from API: no books available to render.");
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No books available</td></tr>';
    } else if (hasActiveFilters) {
      console.info("[FRONTEND] No books match current filters.", {
        search: filters.search,
        category: filters.category,
        status: filters.status,
        totalBooks: totalBooks
      });
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No books match current filters</td></tr>';
    } else {
      console.info("[FRONTEND] No books to display for current lifecycle/tab state.");
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No books found</td></tr>';
    }
    return;
  }

  books.forEach((book, index) => {
    console.log(`[FRONTEND] Processing book ${index + 1}/${books.length}:`, book.title);
    const row = createBookRow(book);
    tbody.appendChild(row);
  });
  
  console.log("[FRONTEND] Successfully rendered", books.length, "book rows");
  
  // Clear bulk selection when table is reloaded
  if (typeof clearSelection === 'function') {
    clearSelection();
  }
  // Re-apply row selectability after every render
  if (typeof applyRowSelectability === 'function') {
    applyRowSelectability();
  }
}

function createBookRow(book) {
  const row = document.createElement("tr");
  
  // Add data attributes for highlighting and availability tracking
  if (book.id) {
    row.setAttribute('data-book-id', book.id);
    row.dataset.overviewType = 'book';
    row.dataset.overviewId   = String(book.id);
  }
  
  // Make row clickable - cursor pointer
  row.style.cursor = 'pointer';
  
  // Determine availability status
  // Treat null available_quantity as all copies available (= total quantity)
  const totalQty = book.quantity || 1;
  const availableQty = (book.available_quantity !== undefined && book.available_quantity !== null)
    ? book.available_quantity
    : totalQty;
  row.dataset.available = String(availableQty);
  row.dataset.quantity  = String(totalQty);
  if (book.display_status) row.dataset.displayStatus = String(book.display_status).toLowerCase();
  if (book.borrow_status) row.dataset.borrowStatus = String(book.borrow_status).toLowerCase();
  if (book.current_status) row.dataset.currentStatus = String(book.current_status).toLowerCase();
  if (book.due_date) row.dataset.dueDate = String(book.due_date);
  let statusText = `Available (${availableQty}/${totalQty})`;
  let statusClass = "status-available";

  if (availableQty === 0) {
    statusText = "All Borrowed";
    statusClass = "status-borrowed";
  }

  const lifecycleStatus = String(book.display_status || book.borrow_status || '').toLowerCase();
  const isPendingPickupLifecycle = lifecycleStatus === 'pending_pickup' || lifecycleStatus === 'claim_expired';
  const borrowStatus = String(book.borrow_status || '').toLowerCase();
  const dueDateObj = book.due_date ? new Date(book.due_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isLifecycleOverdue = lifecycleStatus === 'overdue' || borrowStatus === 'overdue' ||
    (borrowStatus === 'borrowed' && dueDateObj && !Number.isNaN(dueDateObj.getTime()) && dueDateObj < today);
  const isLifecycleActive = ['picked_up', 'pending_return', 'borrowed', 'overdue', 'active'].includes(lifecycleStatus) ||
    (borrowStatus === 'borrowed' || borrowStatus === 'overdue');
  const isBorrowed = isLifecycleActive && !isPendingPickupLifecycle;

  let lifecycleChip = '';
  if (isLifecycleOverdue) {
    lifecycleChip = '<span class="books-lifecycle-chip overdue">Overdue</span>';
  } else if (isPendingPickupLifecycle) {
    lifecycleChip = '<span class="books-lifecycle-chip pending">Pending Pickup</span>';
  } else if (isLifecycleActive) {
    lifecycleChip = '<span class="books-lifecycle-chip active">Active</span>';
  }

  const statusHtml = `<span class="books-status-chip ${statusClass}">${statusText}</span>${lifecycleChip}`;

  // Gmail-style bulk operations: Add checkbox column
  row.innerHTML = `
    <td class="checkbox-col">
      <input 
        type="checkbox" 
        class="book-row-checkbox" 
        data-book-id="${book.id}"
        onchange="handleRowCheckboxChange(this)"
      />
    </td>
    <td>${book.id}</td>
    <td>${book.title}</td>
    <td>${book.author}</td>
    <td>${availableQty}/${totalQty}</td>
    <td>${book.category}</td>
    <td>${book.isbn}</td>
    <td>${formatDate(book.added_date)}</td>
    <td class="${statusClass}">${statusHtml}</td>
    <td class="borrowed-by ${isBorrowed ? "active" : ""}">${
    book.borrowed_by || "-"
  }</td>
    <td>
      <div class="actions-dropdown">
        <button class="btn btn-actions dropdown-toggle" type="button" aria-expanded="false" aria-haspopup="true" data-book-id="${book.id}" title="Actions">
          <span class="kebab-icon">&#8942;</span><span class="caret-icon">&#9662;</span>
        </button>
        <ul class="actions-menu" role="menu">
          <li role="none"><a href="#" class="dropdown-item action-manage-copies" role="menuitem" data-book-id="${book.id}"><span class="material-symbols-outlined">qr_code_2</span>Manage Copies</a></li>
          <li role="none"><a href="#" class="dropdown-item action-edit" role="menuitem" data-book-id="${book.id}"><span class="material-symbols-outlined">edit</span>Edit Metadata</a></li>
          <li role="none"><a href="#" class="dropdown-item action-delete ${isBorrowed ? 'action-delete-disabled' : ''}" role="menuitem" data-book-id="${book.id}" ${isBorrowed ? 'aria-disabled="true"' : ''}><span class="material-symbols-outlined">delete</span>Delete</a></li>
        </ul>
      </div>
    </td>
  `;

  attachRowEventListeners(row);

  return row;
}

function attachRowEventListeners(row) {
  // All actions handled by document-level event delegation
}

// ── Actions Dropdown: Event Delegation ──────────────────────────────────────

var activeActionsMenu = null;
var activeActionsToggle = null;
var activeActionsOrigin = null;

function positionActionMenu(menu, toggleBtn) {
  if (!menu || !toggleBtn) return;
  var rect = toggleBtn.getBoundingClientRect();
  var menuWidth = menu.offsetWidth || 170;
  var menuHeight = menu.offsetHeight || 170;
  var viewportPadding = 8;

  var left = rect.right - menuWidth;
  if (left < viewportPadding) left = viewportPadding;
  if (left + menuWidth > window.innerWidth - viewportPadding) {
    left = window.innerWidth - menuWidth - viewportPadding;
  }

  var top = rect.bottom + 6;
  if (top + menuHeight > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, rect.top - menuHeight - 6);
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function openActionDropdown(toggleBtn) {
  var dropdown = toggleBtn && toggleBtn.closest('.actions-dropdown');
  if (!dropdown) return;
  var menu = dropdown.querySelector('.actions-menu');
  if (!menu) return;

  // Toggle behavior for same button
  if (activeActionsMenu && activeActionsToggle === toggleBtn) {
    closeAllActionDropdowns();
    return;
  }

  closeAllActionDropdowns();

  activeActionsOrigin = {
    parent: menu.parentNode,
    nextSibling: menu.nextSibling
  };
  activeActionsMenu = menu;
  activeActionsToggle = toggleBtn;

  menu.classList.add('actions-menu-portal');
  menu.style.display = 'block';
  document.body.appendChild(menu);
  positionActionMenu(menu, toggleBtn);

  dropdown.classList.add('show');
  toggleBtn.setAttribute('aria-expanded', 'true');
}

/** Close every open Actions dropdown on the page */
function closeAllActionDropdowns() {
  if (activeActionsMenu) {
    activeActionsMenu.classList.remove('actions-menu-portal');
    activeActionsMenu.style.display = '';
    activeActionsMenu.style.left = '';
    activeActionsMenu.style.top = '';

    if (activeActionsOrigin && activeActionsOrigin.parent) {
      if (activeActionsOrigin.nextSibling && activeActionsOrigin.nextSibling.parentNode === activeActionsOrigin.parent) {
        activeActionsOrigin.parent.insertBefore(activeActionsMenu, activeActionsOrigin.nextSibling);
      } else {
        activeActionsOrigin.parent.appendChild(activeActionsMenu);
      }
    }
  }

  document.querySelectorAll('.actions-dropdown.show').forEach(function (dd) {
    dd.classList.remove('show');
    var toggle = dd.querySelector('.dropdown-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });

  activeActionsMenu = null;
  activeActionsToggle = null;
  activeActionsOrigin = null;
}

/**
 * Single document-level click listener that handles:
 *  1) Toggling the Actions dropdown open / closed
 *  2) "Scan QR" item  → bookCopyManager.showCopies() (copies/accession modal)
 *  3) "Edit" item     → openBookEditor({ bookId }) (edit metadata modal)
 *  4) "Delete" item   → opens #modalDelete
 *  5) Closing dropdowns when clicking anywhere else
 */
document.addEventListener('click', function (e) {

  /* ── 1. Toggle button ─────────────────────────────────────────────── */
  var toggleBtn = e.target.closest('.btn-actions.dropdown-toggle');
  if (toggleBtn) {
    e.preventDefault();
    e.stopPropagation();
    openActionDropdown(toggleBtn);
    return;
  }

  /* ── 2A. Manage Copies action ──────────────────────────────────────── */
  var manageCopiesItem = e.target.closest('.action-manage-copies');
  if (manageCopiesItem) {
    e.preventDefault();
    var bookId = manageCopiesItem.dataset.bookId;
    if (!bookId) { console.error('Actions dropdown: missing book ID for Manage Copies'); return; }
    closeAllActionDropdowns();
    if (typeof bookCopyManager !== 'undefined') {
      bookCopyManager.showCopies(bookId);
    } else {
      alert('Book copy manager not loaded. Please refresh the page.');
    }
    return;
  }

  /* ── 2B. Scan QR action (legacy, routes to Manage Copies) ──────────── */
  var scanQrItem = e.target.closest('.action-scan-qr');
  if (scanQrItem) {
    e.preventDefault();
    var bookId = scanQrItem.dataset.bookId;
    if (!bookId) { console.error('Actions dropdown: missing book ID for Scan QR'); return; }
    closeAllActionDropdowns();
    if (typeof bookCopyManager !== 'undefined') {
      bookCopyManager.showCopies(bookId);
    } else {
      alert('Book copy manager not loaded. Please refresh the page.');
    }
    return;
  }

  /* ── 3. Edit Metadata action ──────────────────────────────────────── */
  var editItem = e.target.closest('.action-edit');
  if (editItem) {
    e.preventDefault();
    var bookId = editItem.dataset.bookId;
    if (!bookId) { console.error('Actions dropdown: missing book ID for Edit'); return; }
    closeAllActionDropdowns();
    openBookEditor({ bookId });
    return;
  }

  /* ── 4. Delete action ─────────────────────────────────────────────── */
  var deleteItem = e.target.closest('.action-delete');
  if (deleteItem) {
    e.preventDefault();
    if (deleteItem.classList.contains('action-delete-disabled')) return;
    var bookId = deleteItem.dataset.bookId;
    if (!bookId) { console.error('Actions dropdown: missing book ID for Delete'); return; }
    closeAllActionDropdowns();
    var modalDelete = document.getElementById('modalDelete');
    if (modalDelete) {
      modalDelete.dataset.bookId = bookId;
      showModal('modalDelete');
    }
    return;
  }

  /* ── 5. Click outside → close all ─────────────────────────────────── */
  if (!e.target.closest('.actions-dropdown') && !e.target.closest('.actions-menu')) {
    closeAllActionDropdowns();
  }
});

window.addEventListener('resize', function () {
  if (activeActionsMenu && activeActionsToggle) {
    positionActionMenu(activeActionsMenu, activeActionsToggle);
  }
});

window.addEventListener('scroll', function () {
  if (activeActionsMenu && activeActionsToggle) {
    positionActionMenu(activeActionsMenu, activeActionsToggle);
  }
}, true);

// ──────────────────────────────────────────────────────────────────────────────
// BOOK EDITOR: Opens copiesModal (managed by book-copies.js)
// This is the unified entry point for:
// - Editing book metadata (title/author/category/isbn/status) → Edit Book tab
// - Managing copies & accessions → Copies tab
// - Both functions are handled within the copiesModal (book-copies.js)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Single entry point for opening the edit modal (copiesModal).
 * Works identically whether triggered by the Edit or Scan QR menu item.
 * The Edit Book tab handles metadata; Copies tab handles accessions.
 */
async function openBookEditor({ bookId }) {
  const book = await loadBookForEdit(bookId);
  if (!book) {
    alert('Book not found. Please refresh the page and try again.');
    return;
  }
  populateEditModal(book);
}

/** Fetches a single book's latest data from the API by ID. */
async function loadBookForEdit(bookId) {
  try {
    const response = await fetchWithCsrf('/api/admin/books');
    if (!response.ok) return null;
    const result = await response.json();
    const books = result.data || [];
    return books.find(b => String(b.id) === String(bookId)) || null;
  } catch (err) {
    console.error('loadBookForEdit error:', err);
    return null;
  }
}

/** Sends the PUT request to save book changes. Returns the fetch Response. */
function saveBookChanges(bookId, payload) {
  return fetchWithCsrf(`/api/admin/books/${bookId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function handleEditClick(book) {
  if (!book?.id) {
    console.error("Invalid book data:", book);
    alert("Error loading book data. Please try again.");
    return;
  }
  populateEditModal(book);
}

function populateEditModal(book) {
  // PRIMARY FLOW: Delegate to book-copies.js (copiesModal has Edit Book tab + Copies tab)
  if (typeof bookCopyManager !== 'undefined') {
    console.log('[populateEditModal] Delegating to bookCopyManager');
    bookCopyManager.openEditTab(book);
    return;
  }

  // FALLBACK: Manual population (in case bookCopyManager isn't loaded)
  console.warn('[populateEditModal] bookCopyManager not available, falling back');
  const formElements = {
    title: document.getElementById("titleEdit"),
    author: document.getElementById("authorEdit"),
    quantity: document.getElementById("No#BooksEdit"),
    category: document.getElementById("categoryEdit"),
    isbn: document.getElementById("isbnEdit"),
    status: document.getElementById("statusEdit"),
    student: document.getElementById("studentEdit"),
  };

  if (!Object.values(formElements).every((element) => element)) {
    console.error("Required form elements not found");
    alert("Error loading edit form. Please try again.");
    return;
  }

  formElements.title.value = book.title || "";
  formElements.author.value = book.author || "";
  formElements.quantity.value = book.quantity || "";
  formElements.category.value = book.category || "";
  formElements.isbn.value = book.isbn || "";

  const isBorrowed = book.current_status?.toLowerCase() === "borrowed";
  formElements.status.value = isBorrowed ? "borrowed" : "available";

  const studentSelectGroup = document.getElementById("studentSelectGroup");
  if (isBorrowed) {
    studentSelectGroup.style.display = "block";
    formElements.student.required = true;

    if (formElements.student.options.length <= 1) {
      students.forEach((student) => {
        const option = document.createElement("option");
        option.value = student.student_id;
        option.textContent = `${student.fullname} (${student.email})`;
        formElements.student.appendChild(option);
      });
    }

    if (book.borrowed_by) {
      const currentBorrower = students.find(
        (s) => s.fullname === book.borrowed_by
      );
      if (currentBorrower) {
        formElements.student.value = currentBorrower.student_id;
      }
    }
  } else {
    studentSelectGroup.style.display = "none";
    formElements.student.required = false;
  }

  const modal = document.getElementById("adminEdit");
  if (modal) {
    modal.dataset.bookId = book.id;
    modal.style.display = "flex";
    document.body.classList.add("modal-open");
  }
}

async function handleAddBook(e) {
  e.preventDefault();

  const formData = {
    title: document.getElementById("title").value.trim(),
    author: document.getElementById("author").value.trim(),
    category: document.getElementById("category").value.trim(),
    isbn: document.getElementById("isbn").value.trim(),
    quantity: parseInt(document.getElementById("No#Books").value || "1", 10),
    status: document.getElementById("status").value.trim(),
    adminId: parseInt(sessionStorage.getItem("adminId") || "0", 10),
  };

  // Validate metadata ONLY (metadata concern, not copy creation)
  const validation = bookMetaValidation.validateBookForm(formData);
  if (!validation.valid) {
    alert("Validation Failed:\n\n" + validation.errors.join("\n"));
    return;
  }

  // Quantity determines how many copies/accessions are auto-created.
  if (formData.quantity < 0 || formData.quantity > 999) {
    alert("Quantity must be between 0 and 999");
    return;
  }

  try {
    const response = await fetchWithCsrf("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to add book");

    const payload = data.data || {};
    const copiesCreated = payload.copies_created || 0;
    const firstCopy = Array.isArray(payload.copies) && payload.copies.length > 0
      ? payload.copies[0]
      : null;

    let successMessage = `Book added successfully!\n\nAuto-generated copies: ${copiesCreated}`;
    if (firstCopy && firstCopy.accession_number) {
      successMessage += `\nFirst accession: ${firstCopy.accession_number}`;
    }

    alert(successMessage);
    closeModal();
    await reloadBooksAndStats();
    document.getElementById("addBookForm").reset();
  } catch (error) {
    console.error("Error:", error);
    alert(error.message || "Failed to add book. Please try again.");
  }
}

async function handleEditBook(e) {
  e.preventDefault();

  const bookId = (typeof bookCopyManager !== 'undefined' && bookCopyManager.currentBookId)
    ? bookCopyManager.currentBookId
    : (document.getElementById('adminEdit') && document.getElementById('adminEdit').dataset.bookId);
  const quantityValue = document.getElementById("No#BooksEdit").value;
  
  const formData = {
    title: document.getElementById("titleEdit").value.trim(),
    author: document.getElementById("authorEdit").value.trim(),
    quantity: quantityValue ? parseInt(quantityValue, 10) : null,
    category: document.getElementById("categoryEdit").value.trim(),
    isbn: document.getElementById("isbnEdit").value.trim(),
    status: document.getElementById("statusEdit").value,
  };

  // Validate required fields
  if (!formData.title || !formData.author || formData.quantity === null || !formData.category || !formData.isbn) {
    alert("Please fill in all fields");
    return;
  }

  if (formData.status === "borrowed") {
    const studentId = document.getElementById("studentEdit").value;
    if (!studentId) {
      alert("Please select a student when status is borrowed");
      return;
    }
    formData.student_id = studentId;
  }

  if (!validateISBN(formData.isbn)) {
    alert("Please enter a valid ISBN/barcode");
    return;
  }

  try {
    console.log("Sending update request with data:", formData);
    console.log("Quantity being sent:", formData.quantity, "Type:", typeof formData.quantity);
    const response = await saveBookChanges(bookId, formData);

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to update book");

    alert("Book updated successfully!");
    closeModal();
    await reloadBooksAndStats();
  } catch (error) {
    console.error("Error:", error);
    alert(error.message || "Failed to update book. Please try again.");
  }
}

async function handleDeleteBook() {
  const modal = document.getElementById("modalDelete");
  const bookId = modal.dataset.bookId;

  if (!bookId) {
    console.error("No book ID found for deletion");
    alert("Error: Could not find book to delete");
    return;
  }

  try {
    const response = await fetchWithCsrf(`/api/admin/books/${bookId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to delete book");

    alert(data.message || "Book deleted successfully");
    closeModal();
    await reloadBooksAndStats();
  } catch (error) {
    console.error("Error deleting book:", error);
    alert(error.message || "Failed to delete book. Please try again.");
  }
}

function validateISBN(isbn) {
  // Accept any non-empty ISBN/barcode format
  return isbn && isbn.trim().length > 0;
}

document.addEventListener("DOMContentLoaded", function () {
  const deleteConfirmBtn = document.querySelector(".delete-confirm-btn");
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", handleDeleteBook);
  }

  const cancelButtons = document.querySelectorAll(".cancel-btn");
  cancelButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });
});

async function loadStudents() {
  try {
    const response = await fetchWithCsrf("/api/admin/students");
    if (!response.ok) {
      throw new Error("Failed to fetch students");
    }
    const result = await response.json();
    students = result.data || []; // Extract students from response wrapper
  } catch (error) {
    console.error("Error loading students:", error);
  }
}

function handleStatusChange(e) {
  const studentSelectGroup = document.getElementById("studentSelectGroup");
  const studentSelect = document.getElementById("studentEdit");

  if (e.target.value === "borrowed") {
    studentSelectGroup.style.display = "block";
    studentSelect.required = true;

    if (studentSelect.options.length <= 1) {
      students.forEach((student) => {
        const option = document.createElement("option");
        option.value = student.student_id;
        option.textContent = `${student.fullname} (${student.email})`;
        studentSelect.appendChild(option);
      });
    }
  } else {
    studentSelectGroup.style.display = "none";
    studentSelect.required = false;
    studentSelect.value = "";
  }
}
/**
 * Borrowed Books Management for Admins
 * Handles pickup confirmation and return confirmation
 */

// Global variables
let allBorrowings = [];
let filteredBorrowings = [];
let currentLifecycleFilter = 'pending_pickup';
let borrowedCategoryLastRefreshAt = 0;
let borrowedCategoryRefreshing = false;
const BORROWED_CATEGORY_REFRESH_MS = 15000;
const KANBAN_STAGE_IDS = {
  pending: 'kanban-pending',
  active: 'kanban-active',
  overdue: 'kanban-overdue',
  returned: 'kanban-returned',
  history: 'kanban-history'
};
const KANBAN_COUNT_IDS = {
  pending: 'count-pending',
  active: 'count-active',
  overdue: 'count-overdue',
  returned: 'count-returned-kanban',
  history: 'count-history'
};
let borrowScanner = null;
let borrowScannerMode = null;
let borrowScannerEngine = null;
let scannerInProgress = false;
let scannerCurrentBorrowingId = null;
let scannerLastCode = '';
let scannerCooldownActive = false;
let scannerTransitionActive = false;
let borrowScannerNativeStream = null;
let borrowScannerNativeVideo = null;
let borrowScannerNativeDetector = null;
let borrowScannerNativeAnimationId = null;
let borrowScannerAssistDetector = null;
let borrowScannerAssistAnimationId = null;
let borrowScannerJsQrAnimationId = null;
let borrowScannerJsQrCanvas = null;
let borrowScannerJsQrContext = null;

// ===========================
// INITIALIZATION
// ===========================

// Guard: Only run admin-side initialization
document.addEventListener("DOMContentLoaded", async function () {
  // Check if this is an admin page (super-admin/admin access) - if student page, do NOT run this
  const userRole = sessionStorage.getItem("userRole");
  const adminRole = sessionStorage.getItem("adminRole");
  
  // Only initialize on admin pages (skip if student)
  if (userRole === "student" || !adminRole) {
    console.log('[Borrowed Books Admin] Skipping - not an admin page');
    return;
  }
  
  console.log('[Borrowed Books] Initializing...');
  
  // Load data
  await Promise.all([loadBorrowings(), loadCategories()]);
  
  // Setup filters
  setupFilters();
  
  // Initialize lifecycle panel
  initBorrowLifecycle();

  // Initialize scanner-based confirmation modal
  initBorrowScannerModal();
  
  // Auto-refresh borrowed books every 20 seconds
  setInterval(async () => {
    try {
      await loadBorrowings();
      await refreshCategoriesIfNeeded(false);
      updateTabCounters();
      console.log('[Borrowed Books] Auto-refreshed at', new Date().toLocaleTimeString());
    } catch (err) {
      console.error('[Borrowed Books] Auto-refresh failed:', err);
    }
  }, 20000);
  
  console.log('[Borrowed Books] Initialization complete');
});

// ===========================
// DATA LOADING
// ===========================

function handleAdminAccessDenied(message) {
  console.warn('[Borrowed Books] Admin access denied:', message || 'No message');
  showToast(message || 'Session expired or insufficient privileges. Please log in as admin.', 'error');

  // Clear stale admin markers to avoid repeated forbidden fetches.
  sessionStorage.removeItem('adminId');
  sessionStorage.removeItem('adminRole');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('isLoggedIn');

  setTimeout(() => {
    window.location.href = '/login';
  }, 900);
}

async function loadBorrowings() {
  try {
    console.log('[Borrowed Books] Loading borrowings...');
    
    const filterParams = getFilterParams();
    const url = `/api/admin/borrowings${filterParams ? '?' + filterParams : ''}`;
    
    const response = await fetchWithCsrf(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        handleAdminAccessDenied(error.message || 'Access denied. Admin privileges required.');
        return;
      }
      throw new Error(error.message || 'Failed to fetch borrowings');
    }
    
    const result = await response.json();
    allBorrowings = result.data || [];
    filteredBorrowings = allBorrowings;
    
    console.log(`[Borrowed Books] Loaded ${allBorrowings.length} borrowings`);
    
    // Update lifecycle counters after loading
    updateTabCounters();
    
    // Apply lifecycle filter
    applyLifecycleFilter();
    
    displayBorrowings(filteredBorrowings);
    updateResultCount();
    
  } catch (error) {
    console.error('[Borrowed Books] Error loading borrowings:', error);
    showToast('Error loading borrowings: ' + error.message, 'error');
  }
}

async function loadCategories() {
  try {
    console.log('[Borrowed Books] Loading categories...');
    
    const response = await fetchWithCsrf('/api/admin/books?ts=' + Date.now());
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        handleAdminAccessDenied(error.message || 'Access denied. Admin privileges required.');
        return;
      }
      throw new Error(error.message || 'Failed to fetch categories');
    }
    
    const result = await response.json();
    const books = result.data || [];
    
    const categories = [...new Set(books.map(b => b.category).filter(c => c && c.trim()))];
    categories.sort();
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      const currentValue = categoryFilter.value || '';
      categoryFilter.innerHTML = '<option value="">All Categories</option>';
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        if (currentValue && currentValue === cat) option.selected = true;
        categoryFilter.appendChild(option);
      });

      if (currentValue && !categories.includes(currentValue)) {
        categoryFilter.value = '';
      }

      borrowedCategoryLastRefreshAt = Date.now();
      console.log(`[Borrowed Books] Loaded ${categories.length} categories`);
    }
    
  } catch (error) {
    console.error('[Borrowed Books] Error loading categories:', error);
  }
}

async function refreshCategoriesIfNeeded(force) {
  const isStale = (Date.now() - borrowedCategoryLastRefreshAt) > BORROWED_CATEGORY_REFRESH_MS;
  if (!force && !isStale) return;
  if (borrowedCategoryRefreshing) return;

  borrowedCategoryRefreshing = true;
  try {
    await loadCategories();
  } finally {
    borrowedCategoryRefreshing = false;
  }
}

// ===========================
// FILTERING
// ===========================

function setupFilters() {
  console.log('[Borrowed Books] Setting up filters...');
  
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const clearFiltersBtn = document.getElementById('clearFilters');
  
  if (!searchInput || !categoryFilter || !statusFilter || !clearFiltersBtn) {
    console.error('[Borrowed Books] Some filter elements not found!');
    return;
  }
  
  // Debounced search
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      console.log('[Borrowed Books] Search changed:', searchInput.value);
      applyLifecycleFilter();
      displayBorrowings(filteredBorrowings);
      updateResultCount();
    }, 300);
  });
  
  // Filter changes
  categoryFilter.addEventListener('change', () => {
    console.log('[Borrowed Books] Category filter changed:', categoryFilter.value);
    applyLifecycleFilter();
    displayBorrowings(filteredBorrowings);
    updateResultCount();
  });

  categoryFilter.addEventListener('focus', () => {
    refreshCategoriesIfNeeded(true);
  });
  categoryFilter.addEventListener('mousedown', () => {
    refreshCategoriesIfNeeded(true);
  });
  
  statusFilter.addEventListener('change', () => {
    console.log('[Borrowed Books] Status filter changed:', statusFilter.value);
    applyLifecycleFilter();
    displayBorrowings(filteredBorrowings);
    updateResultCount();
  });
  
  // Clear filters
  clearFiltersBtn.addEventListener('click', () => {
    console.log('[Borrowed Books] Clearing all filters');
    searchInput.value = '';
    categoryFilter.value = '';
    statusFilter.value = '';
    applyLifecycleFilter();
    displayBorrowings(filteredBorrowings);
    updateResultCount();
  });
  
  console.log('[Borrowed Books] Filters setup complete');
}

function getFilterParams() {
  const search = document.getElementById('searchInput')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';
  
  const params = new URLSearchParams();
  if (search.trim()) params.append('search', search.trim());
  if (category.trim()) params.append('category', category.trim());
  if (status.trim()) params.append('status', status.trim());
  
  return params.toString();
}

function updateResultCount() {
  const resultCount = document.getElementById('resultCount');
  if (resultCount) {
    const count = filteredBorrowings.length;
    resultCount.textContent = `${count} record${count !== 1 ? 's' : ''} found`;
  }
}

// ===========================
// LIFECYCLE TAB FILTERING
// ===========================

function initBorrowLifecycle() {
  console.log('[Borrowed Books] Initializing lifecycle tabs...');
  
  const tabs = document.querySelectorAll('.borrow-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const status = tab.dataset.status;
      console.log('[Borrowed Books] Tab clicked:', status);
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update filter and re-render
      currentLifecycleFilter = status;
      applyLifecycleFilter();
      displayBorrowings(filteredBorrowings);
      updateResultCount();
    });
  });
  
  // Initial counter setup
  updateTabCounters();
}

function normalizeBorrowStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function getLifecycleStageFromStatus(value) {
  const status = normalizeBorrowStatus(value);

  if (status === 'pending_pickup' || status === 'claim_expired' || status === 'pending') {
    return 'pending';
  }

  if (status === 'overdue') {
    return 'overdue';
  }

  if (
    status === 'borrowed' ||
    status === 'picked_up' ||
    status === 'pending_return' ||
    status === 'active'
  ) {
    return 'active';
  }

  if (status === 'returned') {
    return 'returned';
  }

  if (status === 'completed' || status === 'history') {
    return 'history';
  }

  return 'history';
}

function calculateTabCounters() {
  const counters = {
    pending_pickup: 0,
    pending_return: 0,
    returned: 0
  };
  
  allBorrowings.forEach(borrowing => {
    const stage = getLifecycleStageFromStatus(borrowing.display_status || borrowing.status);

    if (stage === 'pending') {
      counters.pending_pickup++;
    } else if (stage === 'active' || stage === 'overdue') {
      counters.pending_return++;
    } else if (stage === 'returned' || stage === 'history') {
      counters.returned++;
    }
  });
  
  return counters;
}

function updateTabCounters() {
  const counters = calculateTabCounters();
  
  const countPendingPickup = document.getElementById('count-pending-pickup');
  const countPendingReturn = document.getElementById('count-pending-return');
  const countReturned = document.getElementById('count-returned');
  
  if (countPendingPickup) countPendingPickup.textContent = counters.pending_pickup;
  if (countPendingReturn) countPendingReturn.textContent = counters.pending_return;
  if (countReturned) countReturned.textContent = counters.returned;
  
  console.log('[Borrowed Books] Tab counters updated:', counters);
}

function applyLifecycleFilter() {
  console.log('[Borrowed Books] Applying lifecycle filter:', currentLifecycleFilter);

  // Apply filters in required order: Search -> Category -> Status -> Lifecycle
  let tempBorrowings = allBorrowings.filter(matchesBaseFilters);

  // Lifecycle stage filter is applied last
  if (currentLifecycleFilter === 'pending_pickup') {
    tempBorrowings = tempBorrowings.filter(b => {
      const stage = getLifecycleStageFromStatus(b.display_status || b.status);
      return stage === 'pending';
    });
  } else if (currentLifecycleFilter === 'pending_return') {
    tempBorrowings = tempBorrowings.filter(b => {
      const stage = getLifecycleStageFromStatus(b.display_status || b.status);
      return stage === 'active' || stage === 'overdue';
    });
  } else if (currentLifecycleFilter === 'returned') {
    tempBorrowings = tempBorrowings.filter(b => {
      const stage = getLifecycleStageFromStatus(b.display_status || b.status);
      return stage === 'returned' || stage === 'history';
    });
  }

  filteredBorrowings = tempBorrowings;
  console.log(`[Borrowed Books] After lifecycle filter: ${filteredBorrowings.length} records`);
}

function matchesBaseFilters(b) {
  const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const statusFilter = document.getElementById('statusFilter')?.value || '';

  if (search) {
    const searchMatch = (
      (b.student_name && b.student_name.toLowerCase().includes(search)) ||
      (b.student_id && b.student_id.toLowerCase().includes(search)) ||
      (b.book_title && b.book_title.toLowerCase().includes(search)) ||
      (b.accession_number && b.accession_number.toLowerCase().includes(search))
    );
    if (!searchMatch) return false;
  }

  if (category && b.book_category !== category) return false;
  if (statusFilter && b.display_status !== statusFilter) return false;

  return true;
}

// ===========================
// DISPLAY
// ===========================

function displayBorrowings(borrowings) {
  const tbody = document.querySelector('.borrowings-table tbody');
  
  if (!tbody) {
    console.error('[Borrowed Books] Table tbody not found!');
    return;
  }

  renderKanbanBoard(borrowings);
  
  tbody.innerHTML = '';
  
  if (borrowings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 40px;">
          <span class="material-symbols-outlined" style="font-size: 48px; color: #9ca3af;">inbox</span>
          <p style="margin-top: 10px; color: #6b7280;">No borrowing records found</p>
        </td>
      </tr>
    `;
    return;
  }
  
  borrowings.forEach(record => {
    const row = createBorrowingRow(record);
    tbody.appendChild(row);
  });
}

function mapBorrowingToKanbanStage(record) {
  return getLifecycleStageFromStatus(record.display_status || record.status);
}

function buildKanbanGroups(records) {
  const grouped = {
    pending: [],
    active: [],
    overdue: [],
    returned: [],
    history: []
  };

  records.forEach(record => {
    const stage = mapBorrowingToKanbanStage(record);
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(record);
  });

  return grouped;
}

function renderKanbanBoard(records) {
  const board = document.getElementById('borrowKanbanBoard');
  if (!board) return;

  const groups = buildKanbanGroups(records);
  let visibleColumns = 0;

  Object.keys(KANBAN_STAGE_IDS).forEach(stage => {
    const listEl = document.getElementById(KANBAN_STAGE_IDS[stage]);
    if (!listEl) return;
    const colEl = listEl.closest('.kanban-column');

    const items = groups[stage] || [];
    if (!items.length) {
      listEl.innerHTML = '<div class="kanban-empty">No records</div>';
      if (colEl) colEl.classList.add('is-hidden');
      return;
    }

    visibleColumns++;
    if (colEl) colEl.classList.remove('is-hidden');
    listEl.innerHTML = items.map(renderKanbanCard).join('');
  });

  // If everything is empty, keep one column visible so the page doesn't look broken.
  if (visibleColumns === 0) {
    const pendingCol = document.querySelector('.kanban-column[data-stage="pending"]');
    if (pendingCol) pendingCol.classList.remove('is-hidden');
  }

  updateKanbanCounters(groups);
}

function renderKanbanCard(record) {
  const status = String(record.display_status || '').toLowerCase();
  const canApprove = status === 'pending';
  const canConfirmPickup = status === 'pending_pickup';
  const canConfirmReturn = status === 'picked_up' || status === 'overdue' || status === 'borrowed' || status === 'pending_return';

  const studentName = escapeHtml(record.student_name || 'Unknown student');
  const studentId = escapeHtml(record.student_id || 'N/A');
  const bookTitle = escapeHtml(record.book_title || 'Untitled');
  const dueDate = record.due_date ? formatDate(record.due_date) : 'N/A';
  const borrowId = Number(record.id);

  return `
    <div class="borrow-card" data-borrowing-id="${borrowId}" onclick="handleBorrowCardClick(event, ${borrowId})">
      <div class="card-title">${bookTitle}</div>
      <div class="card-meta">
        Student: ${studentName} (${studentId})<br>
        Due Date: ${dueDate}
      </div>
      <div class="card-actions">
        ${canApprove ? `<button type="button" class="sa-btn sa-btn-primary" onclick="approveBorrowing(${borrowId})">Approve</button>` : ''}
        ${canConfirmPickup ? `<button type="button" class="sa-btn sa-btn-success" onclick="showPickupModal(${borrowId})">Confirm Pickup</button>` : ''}
        ${canConfirmReturn ? `<button type="button" class="sa-btn sa-btn-primary" onclick="showReturnModal(${borrowId})">Confirm Return</button>` : ''}
      </div>
    </div>
  `;
}

function handleBorrowCardClick(event, borrowingId) {
  if (event && event.target && event.target.closest('button, a, input, select, textarea, label')) {
    return;
  }
  if (event) event.stopPropagation();
  showDetailsModal(Number(borrowingId));
}

function updateKanbanCounters(groups) {
  Object.keys(KANBAN_COUNT_IDS).forEach(stage => {
    const el = document.getElementById(KANBAN_COUNT_IDS[stage]);
    if (!el) return;
    el.textContent = (groups[stage] || []).length;
  });
}

function createBorrowingRow(record) {
  const tr = document.createElement('tr');
  tr.dataset.borrowingId = record.id;
  tr.setAttribute('data-no-overview', 'true');
  tr.removeAttribute('data-overview-type');
  tr.removeAttribute('data-overview-id');

  // [ORPHAN FIX] Treat MySQL tinyint(1) 1 or JS true both as missing
  const bookMissing = record.book_missing === 1 || record.book_missing === true;

  const statusBadge = getStatusBadge(record.display_status);
  const actionButtons = getActionButtons(record, bookMissing);

  // [ORPHAN FIX] Build book cell — show "Removed" badge when book is gone
  const bookCell = bookMissing
    ? `<div style="font-weight:500;color:#9ca3af;">${
        escapeHtml(record.book_title || '(Removed from system)')
      }</div>
       <span style="
         display:inline-block;padding:2px 8px;border-radius:8px;
         font-size:11px;font-weight:600;color:#b45309;background:#fef3c7;
         margin-top:2px;
       ">Removed</span>`
    : `<div style="font-weight:500;">${escapeHtml(record.book_title)}</div>
       <div style="font-size:12px;color:#6b7280;">${escapeHtml(record.book_author)}</div>`;

  tr.innerHTML = `
    <td>${record.id}</td>
    <td>
      <div style="font-weight: 500;">${escapeHtml(record.student_name)}</div>
      <div style="font-size: 12px; color: #6b7280;">${escapeHtml(record.student_id)}</div>
    </td>
    <td>${bookCell}</td>
    <td><code style="font-size: 12px;">${escapeHtml(record.accession_number || 'N/A')}</code></td>
    <td>${formatDate(record.borrow_date)}</td>
    <td>${formatDate(record.due_date)}</td>
    <td>${record.picked_up_at ? formatDate(record.picked_up_at) : '<span style="color: #9ca3af;">Pending</span>'}</td>
    <td>${record.return_date ? formatDate(record.return_date) : '<span style="color: #9ca3af;">Not returned</span>'}</td>
    <td>${statusBadge}</td>
    <td>${escapeHtml(record.book_category || 'N/A')}</td>
    <td>
      <div class="action-buttons">
        ${actionButtons}
      </div>
    </td>
  `;

  tr.addEventListener('click', (event) => {
    if (event.target && event.target.closest('button, input, a, select, textarea, label')) {
      return;
    }
    event.stopPropagation();
    showDetailsModal(Number(record.id));
  });

  return tr;
}

function getStatusBadge(status) {
  const statusMap = {
    'pending': { label: 'Pending Approval', color: '#7c3aed', bg: '#ede9fe' },
    'pending_pickup': { label: 'Pending Pickup', color: '#f59e0b', bg: '#fef3c7' },
    'claim_expired': { label: 'Claim Expired', color: '#b91c1c', bg: '#fee2e2' },
    'picked_up': { label: 'Picked Up', color: '#3b82f6', bg: '#dbeafe' },
    'returned': { label: 'Returned', color: '#10b981', bg: '#d1fae5' },
    'overdue': { label: 'Overdue', color: '#ef4444', bg: '#fee2e2' }
  };
  
  const config = statusMap[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  
  return `
    <span style="
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      color: ${config.color};
      background-color: ${config.bg};
    ">${config.label}</span>
  `;
}

function getActionButtons(record, bookMissing = false) {
  const buttons = [];

  // [ORPHAN FIX] Suppress book-dependent actions when the book no longer exists
  if (!bookMissing) {
    if (record.display_status === 'pending' || record.status === 'pending') {
      buttons.push(`
        <button 
          class="btn btn-sm btn-primary" 
          onclick="approveBorrowing(${record.id})"
          title="Approve Request"
        >
          <span class="material-symbols-outlined" style="font-size: 16px;">check</span>
          Approve
        </button>
      `);
    }

    // Confirm Pickup button
    if (record.display_status === 'pending_pickup') {
      buttons.push(`
        <button 
          class="btn btn-sm btn-success" 
          onclick="showPickupModal(${record.id})"
          title="Confirm Pickup"
        >
          <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span>
          Pickup
        </button>
      `);
      buttons.push(`
        <button 
          class="btn btn-sm btn-danger" 
          onclick="cancelBorrowing(${record.id})"
          title="Cancel Request"
        >
          <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span>
          Cancel
        </button>
      `);
    }

    // Mark Returned button
    if (['picked_up', 'overdue', 'pending_return'].includes(record.display_status)) {
      buttons.push(`
        <button 
          class="btn btn-sm btn-primary" 
          onclick="showReturnModal(${record.id})"
          title="Mark as Returned"
        >
          <span class="material-symbols-outlined" style="font-size: 16px;">assignment_return</span>
          Return
        </button>
      `);
    }
  }

  return buttons.join('');
}

// ===========================
// MODALS
// ===========================

function scannerEl(id) {
  return document.getElementById(id);
}

function initBorrowScannerModal() {
  const modal = scannerEl('borrowScannerModal');
  const startBtn = scannerEl('borrowScanStartBtn');
  const stopBtn = scannerEl('borrowScanStopBtn');
  const resetBtn = scannerEl('borrowScanResetBtn');

  if (!modal || !startBtn || !stopBtn || !resetBtn) return;

  startBtn.addEventListener('click', () => startBorrowScannerCamera());
  stopBtn.addEventListener('click', () => stopBorrowScannerCamera());
  resetBtn.addEventListener('click', () => resetBorrowScannerState(true));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeAllModals();
    }
  });

  const qrHost = scannerEl('borrowQrReader');
  if (qrHost && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => updateBorrowScannerPlaceholder());
    observer.observe(qrHost, { childList: true, subtree: true });
  }

  resetBorrowScannerState(false);
}

function setBorrowScannerStatus(message, type) {
  const status = scannerEl('borrowScannerStatusText');
  if (!status) return;
  status.textContent = message;
  status.className = 'scanner-status-text' + (type ? ` status-${type}` : '');
}

function setBorrowScannerMessage(message, type) {
  const msg = scannerEl('borrowScanMessage');
  if (!msg) return;
  if (!message) {
    msg.style.display = 'none';
    msg.textContent = '';
    msg.className = 'scanner-message';
    return;
  }
  msg.textContent = message;
  msg.style.display = 'block';
  msg.className = `scanner-message ${type || 'info'}`;
}

function updateBorrowScannerPlaceholder() {
  const host = scannerEl('borrowQrReader');
  const placeholder = scannerEl('borrowScanPlaceholder');
  if (!host || !placeholder) return;
  const hasPreview = !!host.querySelector('video, canvas');
  placeholder.classList.toggle('is-hidden', hasPreview);
}

function setBorrowScannerResultPanelVisible(isVisible) {
  const body = scannerEl('borrowScannerBody');
  const panel = scannerEl('borrowScanResultPanel');
  const footer = scannerEl('borrowScannerFooter');
  if (!body || !panel) return;

  body.classList.toggle('scanner-modal-body-collapsed', !isVisible);
  panel.classList.toggle('scanner-result-panel-collapsed', !isVisible);
  if (footer) {
    footer.classList.toggle('scanner-modal-footer-collapsed', !isVisible);
  }
}

function getDueStateText(dueDate, displayStatus) {
  if (normalizeBorrowStatus(displayStatus) === 'overdue') return 'Overdue';
  if (!dueDate) return 'N/A';
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return 'N/A';
  return Date.now() > due ? 'Overdue' : 'Due';
}

function setBorrowScannerResult(data) {
  const grid = scannerEl('borrowScanResultGrid');
  const empty = scannerEl('borrowScanEmpty');
  setBorrowScannerResultPanelVisible(true);
  if (grid) grid.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  scannerEl('borrowScanAccession').textContent = data.accession || '—';
  scannerEl('borrowScanBookTitle').textContent = data.bookTitle || '—';
  scannerEl('borrowScanBookAuthor').textContent = data.author || '—';
  scannerEl('borrowScanStudentName').textContent = data.studentName || '—';
  scannerEl('borrowScanBorrowStatus').textContent = data.statusLabel || '—';
  scannerEl('borrowScanPickupDate').textContent = data.pickupDate || '—';
  scannerEl('borrowScanDueDate').textContent = data.dueDate || '—';
  scannerEl('borrowScanDueState').textContent = data.dueState || '—';
}

function getBorrowScannerHistoryEntries(studentId, limit = 12) {
  if (!studentId) return [];

  const normalizedId = String(studentId).trim();
  if (!normalizedId) return [];

  const rows = allBorrowings.filter((row) => String(row.student_id || '').trim() === normalizedId);
  rows.sort((a, b) => {
    const aTime = new Date(a.borrow_date || 0).getTime();
    const bTime = new Date(b.borrow_date || 0).getTime();
    if (aTime === bTime) return Number(b.id || 0) - Number(a.id || 0);
    return bTime - aTime;
  });

  return rows.slice(0, limit);
}

function getBorrowScannerHistoryStatus(statusValue) {
  const status = normalizeBorrowStatus(statusValue);
  const map = {
    pending_pickup: 'pending pickup',
    claim_expired: 'claim expired',
    picked_up: 'picked up',
    pending_return: 'pending return',
    borrowed: 'borrowed',
    overdue: 'overdue',
    returned: 'returned',
  };
  return map[status] || (status || 'unknown');
}

function renderBorrowScannerHistory(record) {
  const wrapper = scannerEl('borrowScanHistory');
  const list = scannerEl('borrowScanHistoryList');
  const empty = scannerEl('borrowScanHistoryEmpty');

  if (!wrapper || !list || !empty) return;

  const entries = getBorrowScannerHistoryEntries(record && record.student_id);
  wrapper.style.display = 'block';

  if (!entries.length) {
    list.style.display = 'none';
    list.innerHTML = '';
    empty.style.display = 'block';
    empty.textContent = 'No borrowing history found for this student.';
    return;
  }

  list.innerHTML = entries.map((row) => {
    const isCurrent = record && Number(row.id) === Number(record.id);
    const title = escapeHtml(row.book_title || 'Untitled');
    const due = row.due_date ? formatDate(row.due_date) : 'N/A';
    const status = escapeHtml(getBorrowScannerHistoryStatus(row.display_status || row.status));

    return `
      <li class="scanner-history-item${isCurrent ? ' current' : ''}">
        <div class="scanner-history-title">${title}</div>
        <div class="scanner-history-meta">Due ${due} <span class="scanner-history-pill">${status}</span></div>
      </li>
    `;
  }).join('');

  list.style.display = 'flex';
  empty.style.display = 'none';
}

function prefillBorrowScannerWithRecord(record, mode) {
  if (!record) return;

  const normalizedStatus = normalizeBorrowStatus(record.display_status || record.status);
  const dueState = getDueStateText(record.due_date, normalizedStatus);

  setBorrowScannerResult({
    accession: record.accession_number || `Borrowing #${record.id}`,
    bookTitle: record.book_title || 'N/A',
    author: record.book_author || 'N/A',
    studentName: record.student_name || 'N/A',
    statusLabel: normalizedStatus || 'N/A',
    pickupDate: record.picked_up_at ? formatDate(record.picked_up_at) : 'Pending',
    dueDate: record.due_date ? formatDate(record.due_date) : 'N/A',
    dueState,
  });

  renderBorrowScannerHistory(record);

  if (mode === 'pickup') {
    setBorrowScannerMessage('Selected borrowing details loaded. Scan pickup QR to confirm this record.', 'info');
    setBorrowScannerStatus('Ready to scan pickup QR for selected record.', 'info');
    return;
  }

  setBorrowScannerMessage('Selected borrowing details loaded. Scan book QR/accession to confirm return.', 'info');
  setBorrowScannerStatus('Ready to scan return QR for selected record.', 'info');
}

function clearBorrowScannerResult() {
  const grid = scannerEl('borrowScanResultGrid');
  const empty = scannerEl('borrowScanEmpty');

  setBorrowScannerResultPanelVisible(false);

  if (grid) grid.style.display = 'none';
  if (empty) empty.style.display = 'block';

  scannerEl('borrowScanAccession').textContent = '—';
  scannerEl('borrowScanBookTitle').textContent = '—';
  scannerEl('borrowScanBookAuthor').textContent = '—';
  scannerEl('borrowScanStudentName').textContent = '—';
  scannerEl('borrowScanBorrowStatus').textContent = '—';
  scannerEl('borrowScanPickupDate').textContent = '—';
  scannerEl('borrowScanDueDate').textContent = '—';
  scannerEl('borrowScanDueState').textContent = '—';

  const historyWrapper = scannerEl('borrowScanHistory');
  const historyList = scannerEl('borrowScanHistoryList');
  const historyEmpty = scannerEl('borrowScanHistoryEmpty');
  if (historyWrapper) historyWrapper.style.display = 'none';
  if (historyList) {
    historyList.style.display = 'none';
    historyList.innerHTML = '';
  }
  if (historyEmpty) {
    historyEmpty.style.display = 'none';
    historyEmpty.textContent = '';
  }
}

function resetBorrowScannerState(clearResultOnly) {
  scannerLastCode = '';
  scannerCooldownActive = false;

  const actionBtn = scannerEl('borrowScanActionBtn');

  clearBorrowScannerResult();
  setBorrowScannerMessage('', 'info');

  if (actionBtn) {
    actionBtn.disabled = true;
    actionBtn.textContent = 'No Action';
    actionBtn.classList.remove('sa-btn-primary', 'sa-btn-success');
    actionBtn.classList.add('sa-btn-success');
    actionBtn.onclick = null;
  }

  if (!clearResultOnly) {
    setBorrowScannerStatus('Ready to scan. Click Start Camera to begin.', '');
  }

  updateBorrowScannerPlaceholder();
}

function scannerDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadBorrowScannerScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.Html5Qrcode) {
        resolve(true);
        return;
      }
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load script'));
    document.head.appendChild(script);
  });
}

async function ensureBorrowScannerLibrary() {
  if (window.Html5Qrcode) return true;

  const sources = [
    '/js/vendor/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/minified/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/html5-qrcode/minified/html5-qrcode.min.js'
  ];

  for (const src of sources) {
    try {
      await loadBorrowScannerScript(src);
      if (window.Html5Qrcode) return true;
    } catch (_) {
      // Continue trying fallback sources.
    }
  }

  return false;
}

async function ensureBorrowScannerJsQrLibrary() {
  if (typeof window !== 'undefined' && typeof window.jsQR === 'function') return true;

  const sources = [
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
  ];

  for (const src of sources) {
    try {
      await loadBorrowScannerScript(src);
      if (typeof window !== 'undefined' && typeof window.jsQR === 'function') return true;
    } catch (_) {
      // Continue trying fallback sources.
    }
  }

  return false;
}

function isRetryableBorrowScannerStartError(errorText) {
  const msg = String(errorText || '').toLowerCase();
  return msg.includes('aborterror')
    || msg.includes('timeout starting video source')
    || msg.includes('notreadableerror')
    || msg.includes('trackstarterror')
    || msg.includes('overconstrained')
    || msg.includes('facingmode')
    || msg.includes('constraint');
}

function getBorrowScannerConfig() {
  return {
    fps: 20,
    // Use most of the viewport for detection to improve recognition on dim/low-res feeds.
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.82);
      return { width: size, height: size };
    },
    aspectRatio: 1.0,
  };
}

async function getBorrowScannerCameraAttempts() {
  const attempts = [
    { label: 'rear camera (ideal)', cameraConfig: { facingMode: { ideal: 'environment' } } },
    { label: 'rear camera (exact)', cameraConfig: { facingMode: 'environment' } },
    { label: 'front camera', cameraConfig: { facingMode: 'user' } }
  ];

  if (window.Html5Qrcode && typeof window.Html5Qrcode.getCameras === 'function') {
    try {
      const cameras = await window.Html5Qrcode.getCameras();
      cameras.slice(0, 2).forEach((camera, idx) => {
        attempts.push({ label: `camera id ${idx + 1}`, cameraConfig: { deviceId: { exact: camera.id } } });
      });
    } catch (_) {
      // Ignore camera enumeration errors and continue with default attempts.
    }
  }

  return attempts;
}

async function cleanupBorrowScannerInstance() {
  if (!borrowScanner) return;

  try {
    if (borrowScanner.isScanning) {
      await borrowScanner.stop();
    }
  } catch (_) {
    // Ignore transition/stop errors during recovery.
  }

  try {
    borrowScanner.clear();
  } catch (_) {
    // Ignore clear errors during recovery.
  }

  borrowScanner = null;
  borrowScannerEngine = null;
}

function canUseBorrowScannerNativeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}

function cleanupBorrowScannerNativeMode() {
  if (borrowScannerNativeAnimationId) {
    cancelAnimationFrame(borrowScannerNativeAnimationId);
    borrowScannerNativeAnimationId = null;
  }

  if (borrowScannerNativeVideo) {
    try {
      borrowScannerNativeVideo.pause();
    } catch (_) {
      // Ignore pause errors during cleanup.
    }
    borrowScannerNativeVideo.srcObject = null;
    borrowScannerNativeVideo.remove();
    borrowScannerNativeVideo = null;
  }

  if (borrowScannerNativeStream) {
    borrowScannerNativeStream.getTracks().forEach((track) => track.stop());
    borrowScannerNativeStream = null;
  }

  borrowScannerNativeDetector = null;
  if (borrowScannerEngine === 'native') {
    borrowScannerEngine = null;
  }
}

function cleanupBorrowScannerAssistDetector() {
  if (borrowScannerAssistAnimationId) {
    cancelAnimationFrame(borrowScannerAssistAnimationId);
    borrowScannerAssistAnimationId = null;
  }
  borrowScannerAssistDetector = null;
}

function cleanupBorrowScannerJsQrDetector() {
  if (borrowScannerJsQrAnimationId) {
    cancelAnimationFrame(borrowScannerJsQrAnimationId);
    borrowScannerJsQrAnimationId = null;
  }
  borrowScannerJsQrContext = null;
  borrowScannerJsQrCanvas = null;
}

async function startBorrowScannerJsQrDetector() {
  const ready = await ensureBorrowScannerJsQrLibrary();
  if (!ready || typeof window.jsQR !== 'function') return;

  const host = scannerEl('borrowQrReader');
  if (!host) return;

  cleanupBorrowScannerJsQrDetector();
  borrowScannerJsQrCanvas = document.createElement('canvas');
  borrowScannerJsQrContext = borrowScannerJsQrCanvas.getContext('2d', { willReadFrequently: true });
  if (!borrowScannerJsQrContext) return;

  let frameCounter = 0;

  const detectLoop = () => {
    const video = host.querySelector('video');
    if (!video || video.readyState < 2 || !borrowScannerJsQrContext || !borrowScannerJsQrCanvas) {
      borrowScannerJsQrAnimationId = requestAnimationFrame(detectLoop);
      return;
    }

    frameCounter += 1;
    // Sample every other frame for performance.
    if (frameCounter % 2 === 0) {
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;
      if (vw > 0 && vh > 0) {
        borrowScannerJsQrCanvas.width = vw;
        borrowScannerJsQrCanvas.height = vh;
        borrowScannerJsQrContext.drawImage(video, 0, 0, vw, vh);

        try {
          const imageData = borrowScannerJsQrContext.getImageData(0, 0, vw, vh);
          const result = window.jsQR(imageData.data, vw, vh, { inversionAttempts: 'attemptBoth' });
          const rawValue = String(result && result.data ? result.data : '').trim();
          if (rawValue) {
            onBorrowScannerScan(rawValue);
          }
        } catch (_) {
          // Ignore per-frame parse failures.
        }
      }
    }

    borrowScannerJsQrAnimationId = requestAnimationFrame(detectLoop);
  };

  borrowScannerJsQrAnimationId = requestAnimationFrame(detectLoop);
}

function getBorrowScannerNativeCameraAttempts() {
  return [
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ];
}

function startBorrowScannerAssistDetector() {
  if (!canUseBorrowScannerNativeDetector()) return;

  const host = scannerEl('borrowQrReader');
  if (!host) return;

  cleanupBorrowScannerAssistDetector();
  borrowScannerAssistDetector = new BarcodeDetector({ formats: ['qr_code'] });

  const detectLoop = async () => {
    const video = host.querySelector('video');
    if (!video || video.readyState < 2 || !borrowScannerAssistDetector) {
      borrowScannerAssistAnimationId = requestAnimationFrame(detectLoop);
      return;
    }

    try {
      const codes = await borrowScannerAssistDetector.detect(video);
      if (codes && codes.length > 0) {
        const rawValue = String(codes[0].rawValue || '').trim();
        if (rawValue) {
          onBorrowScannerScan(rawValue);
        }
      }
    } catch (_) {
      // Ignore intermittent detector failures on frames.
    }

    borrowScannerAssistAnimationId = requestAnimationFrame(detectLoop);
  };

  borrowScannerAssistAnimationId = requestAnimationFrame(detectLoop);
}

async function startBorrowScannerNativeMode() {
  const host = scannerEl('borrowQrReader');
  if (!host) {
    throw new Error('Scanner container not found.');
  }

  cleanupBorrowScannerNativeMode();

  borrowScannerNativeDetector = new BarcodeDetector({ formats: ['qr_code'] });
  let nativeStartError = null;

  for (const constraints of getBorrowScannerNativeCameraAttempts()) {
    try {
      borrowScannerNativeStream = await navigator.mediaDevices.getUserMedia(constraints);
      nativeStartError = null;
      break;
    } catch (error) {
      nativeStartError = error;
      await scannerDelay(220);
    }
  }

  if (!borrowScannerNativeStream) {
    throw nativeStartError || new Error('Unable to access any camera source.');
  }

  borrowScannerNativeVideo = document.createElement('video');
  borrowScannerNativeVideo.setAttribute('playsinline', 'true');
  borrowScannerNativeVideo.muted = true;
  borrowScannerNativeVideo.autoplay = true;
  borrowScannerNativeVideo.style.width = '100%';
  borrowScannerNativeVideo.style.height = '100%';
  borrowScannerNativeVideo.style.objectFit = 'cover';

  host.innerHTML = '';
  host.appendChild(borrowScannerNativeVideo);
  borrowScannerNativeVideo.srcObject = borrowScannerNativeStream;
  await borrowScannerNativeVideo.play();

  const detectLoop = async () => {
    if (!borrowScannerNativeVideo || borrowScannerNativeVideo.readyState < 2 || !borrowScannerNativeDetector) {
      borrowScannerNativeAnimationId = requestAnimationFrame(detectLoop);
      return;
    }

    try {
      const codes = await borrowScannerNativeDetector.detect(borrowScannerNativeVideo);
      if (codes && codes.length > 0) {
        const rawValue = String(codes[0].rawValue || '').trim();
        if (rawValue) {
          onBorrowScannerScan(rawValue);
        }
      }
    } catch (_) {
      // Ignore intermittent detect-loop errors.
    }

    borrowScannerNativeAnimationId = requestAnimationFrame(detectLoop);
  };

  borrowScannerNativeAnimationId = requestAnimationFrame(detectLoop);
  borrowScannerEngine = 'native';
}

async function stopBorrowScannerCamera() {
  if (scannerTransitionActive) return;
  scannerTransitionActive = true;

  const startBtn = scannerEl('borrowScanStartBtn');
  const stopBtn = scannerEl('borrowScanStopBtn');

  try {
    await cleanupBorrowScannerInstance();
    cleanupBorrowScannerNativeMode();
    cleanupBorrowScannerAssistDetector();
    cleanupBorrowScannerJsQrDetector();
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    updateBorrowScannerPlaceholder();
  } finally {
    await scannerDelay(120);
    scannerTransitionActive = false;
  }
}

async function startBorrowScannerCamera() {
  if (scannerInProgress || scannerTransitionActive) return;
  scannerInProgress = true;
  scannerTransitionActive = true;

  const startBtn = scannerEl('borrowScanStartBtn');
  const stopBtn = scannerEl('borrowScanStopBtn');

  try {
    await cleanupBorrowScannerInstance();
    cleanupBorrowScannerNativeMode();
    cleanupBorrowScannerAssistDetector();
    cleanupBorrowScannerJsQrDetector();
    await scannerDelay(300);

    const libraryReady = await ensureBorrowScannerLibrary();
    const scanConfig = getBorrowScannerConfig();

    let started = false;
    let lastErr = null;

    if (libraryReady && window.Html5Qrcode) {
      const attempts = await getBorrowScannerCameraAttempts();

      for (const attempt of attempts) {
        await cleanupBorrowScannerInstance();
        borrowScanner = new Html5Qrcode('borrowQrReader');

        try {
          await borrowScanner.start(
            attempt.cameraConfig,
            scanConfig,
            onBorrowScannerScan,
            () => {}
          );
          borrowScannerEngine = 'html5';
          startBorrowScannerAssistDetector();
          await startBorrowScannerJsQrDetector();
          started = true;
          break;
        } catch (err) {
          lastErr = err;
          const errMsg = String(err);
          await cleanupBorrowScannerInstance();

          if (!isRetryableBorrowScannerStartError(errMsg)) {
            break;
          }

          await scannerDelay(320);
        }
      }
    }

    if (!started) {
      if (canUseBorrowScannerNativeDetector()) {
        try {
          await startBorrowScannerNativeMode();
          await startBorrowScannerJsQrDetector();
          started = true;
        } catch (nativeErr) {
          lastErr = nativeErr;
          cleanupBorrowScannerNativeMode();
        }
      }
    }

    if (!started) {
      throw lastErr || new Error('Unable to start camera source.');
    }

    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-flex';
    setBorrowScannerStatus(
      borrowScannerEngine === 'native'
        ? 'Scanner active. Point camera at QR code. Native mode is enabled.'
        : 'Scanner active. Point camera at QR code.',
      'info'
    );
    updateBorrowScannerPlaceholder();
  } catch (err) {
    setBorrowScannerStatus(`Camera error: ${err.message || err}`, 'error');
    await cleanupBorrowScannerInstance();
    cleanupBorrowScannerNativeMode();
    cleanupBorrowScannerAssistDetector();
    cleanupBorrowScannerJsQrDetector();
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    updateBorrowScannerPlaceholder();
  } finally {
    await scannerDelay(120);
    scannerTransitionActive = false;
    scannerInProgress = false;
  }
}

async function lookupBorrowingByAccession(accessionNumber) {
  const copyRes = await fetchWithCsrf(`/api/book-copies/accession/${encodeURIComponent(accessionNumber)}`);
  const copyPayload = await copyRes.json().catch(() => ({}));
  if (!copyRes.ok || !copyPayload.success || !copyPayload.data) {
    throw new Error(copyPayload.message || 'Copy not found');
  }

  const borrowingRes = await fetchWithCsrf(`/api/admin/borrowings?search=${encodeURIComponent(accessionNumber)}`);
  const borrowingPayload = await borrowingRes.json().catch(() => ({}));
  const borrowingList = Array.isArray(borrowingPayload.data) ? borrowingPayload.data : [];

  const borrowing = borrowingList.find((row) =>
    row.accession_number === accessionNumber &&
    row.status !== 'returned' &&
    row.status !== 'cancelled'
  ) || borrowingList[0] || null;

  return { copy: copyPayload.data, borrowing };
}

async function lookupBorrowingByIdFromApi(borrowingId) {
  const cachedBorrowing = getBorrowingRecordById(borrowingId);
  if (cachedBorrowing) {
    return cachedBorrowing;
  }

  const res = await fetchWithCsrf(`/api/admin/borrowings/${encodeURIComponent(borrowingId)}`);
  const payload = await res.json().catch(() => ({}));

  if (!res.ok || !payload.success || !payload.data) {
    throw new Error((payload && payload.message) ? payload.message : 'Borrowing record not found.');
  }

  return payload.data;
}

function parseBorrowingIdFromScan(scannedValue) {
  const normalized = String(scannedValue || '').trim();

  // Support QR payloads that contain pickup URLs with JWT tokens.
  // We only decode payload data client-side to identify the borrowing record;
  // the backend still performs full signature validation during confirmation.
  if (normalized.includes('token=')) {
    try {
      const url = new URL(normalized, window.location.origin);
      const token = url.searchParams.get('token');
      if (token) {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
          const decodedPayload = JSON.parse(atob(padded));
          const borrowingId = Number(
            decodedPayload?.borrowing_id || decodedPayload?.borrowingId || decodedPayload?.id
          );
          if (!Number.isNaN(borrowingId) && borrowingId > 0) {
            return borrowingId;
          }
        }
      }
    } catch (_) {
      // Fall through to legacy QR formats below.
    }
  }

  const prefixMatch = normalized.match(/^SPIST-BORROW:(\d+)$/i);
  if (prefixMatch) {
    return Number(prefixMatch[1]);
  }

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    try {
      const parsed = JSON.parse(normalized);
      const borrowingId = Number(parsed?.borrowingId || parsed?.borrowId || parsed?.id);
      if (!Number.isNaN(borrowingId) && borrowingId > 0) {
        return borrowingId;
      }
    } catch (_) {
      return null;
    }
  }

  return null;
}

function getBorrowingRecordById(borrowingId) {
  return allBorrowings.find((row) => Number(row.id) === Number(borrowingId)) || null;
}

function setScannerActionButton(label, styleClass, onClickHandler) {
  const actionBtn = scannerEl('borrowScanActionBtn');
  if (!actionBtn) return;
  actionBtn.disabled = false;
  actionBtn.textContent = label;
  actionBtn.classList.remove('sa-btn-primary', 'sa-btn-success');
  actionBtn.classList.add(styleClass);
  actionBtn.onclick = onClickHandler;
}

async function handleBorrowScannerLookup(accessionNumber) {
  const normalized = String(accessionNumber || '').trim();
  if (!normalized) return;

  setBorrowScannerStatus(`Looking up ${normalized}...`, 'info');

  try {
    const mode = borrowScannerMode;

    if (mode === 'pickup') {
      const scannedBorrowingId = parseBorrowingIdFromScan(normalized);
      let borrowing = null;

      if (scannedBorrowingId) {
        if (scannerCurrentBorrowingId && Number(scannedBorrowingId) !== Number(scannerCurrentBorrowingId)) {
          setBorrowScannerMessage('Scanned pickup QR does not match the selected request.', 'warning');
          setBorrowScannerStatus('Scan the matching pickup QR for this request.', 'error');
          return;
        }

        try {
          borrowing = await lookupBorrowingByIdFromApi(scannedBorrowingId);
        } catch (err) {
          setBorrowScannerMessage(`Error looking up borrowing: ${err.message}`, 'error');
          setBorrowScannerStatus('Failed to fetch borrowing record.', 'error');
          return;
        }
      } else {
        // Match standalone scanner behavior: allow accession QR for pickup lookup too.
        const pickupLookup = await lookupBorrowingByAccession(normalized);
        borrowing = pickupLookup.borrowing;

        if (!borrowing) {
          setBorrowScannerMessage('No active borrowing record found for this accession.', 'warning');
          setBorrowScannerStatus('No active borrowing.', 'error');
          return;
        }
      }

      if (scannerCurrentBorrowingId && Number(borrowing.id) !== Number(scannerCurrentBorrowingId)) {
        setBorrowScannerMessage('Scanned QR does not match the selected pickup record.', 'warning');
        setBorrowScannerStatus('Scan the matching pickup QR for this request.', 'error');
        return;
      }

      const displayStatus = normalizeBorrowStatus(borrowing.display_status || borrowing.status);
      const dueState = getDueStateText(borrowing.due_date, displayStatus);

      setBorrowScannerResult({
        accession: borrowing.accession_number || `Borrowing #${borrowing.id}`,
        bookTitle: borrowing.book_title || 'N/A',
        author: borrowing.book_author || 'N/A',
        studentName: borrowing.student_name || 'N/A',
        statusLabel: displayStatus || 'pending_pickup',
        pickupDate: borrowing.picked_up_at ? formatDate(borrowing.picked_up_at) : 'Pending',
        dueDate: borrowing.due_date ? formatDate(borrowing.due_date) : 'N/A',
        dueState,
      });

      renderBorrowScannerHistory(borrowing);

      if (displayStatus !== 'pending_pickup') {
        setBorrowScannerMessage('Scanned record is not in pending pickup status.', 'warning');
        setBorrowScannerStatus(`Status is ${displayStatus || 'unknown'}; cannot confirm pickup.`, 'error');
        return;
      }

      setBorrowScannerMessage('Pickup record verified. You can confirm pickup.', 'success');
      setBorrowScannerStatus('Ready to confirm pickup.', 'success');
      setScannerActionButton('Confirm Pickup', 'sa-btn-success', async () => {
        await confirmPickup(Number(borrowing.id));
        resetBorrowScannerState(false);
      });
      return;
    }

    const scannedBorrowingId = parseBorrowingIdFromScan(normalized);
    let copy = null;
    let borrowing = null;

    if (scannedBorrowingId) {
      if (scannerCurrentBorrowingId && Number(scannedBorrowingId) !== Number(scannerCurrentBorrowingId)) {
        setBorrowScannerMessage('Scanned QR does not match the selected return record.', 'warning');
        setBorrowScannerStatus('Scan the matching book copy QR or the matching borrowing QR for this return.', 'error');
        return;
      }

      borrowing = await lookupBorrowingByIdFromApi(scannedBorrowingId);
    } else {
      const lookup = await lookupBorrowingByAccession(normalized);
      copy = lookup.copy;
      borrowing = lookup.borrowing;
    }

    const displayStatus = normalizeBorrowStatus((borrowing && borrowing.display_status) || (copy && copy.status));
    const dueState = getDueStateText((borrowing && borrowing.due_date) || (copy && copy.due_date), displayStatus);
    const rowTitle = (borrowing && borrowing.book_title) || (copy && copy.title) || 'N/A';
    const rowAuthor = (borrowing && borrowing.book_author) || (copy && copy.author) || 'N/A';
    const rowStudent = (borrowing && borrowing.student_name) || (copy && copy.borrowed_by) || 'N/A';

    setBorrowScannerResult({
      accession: (borrowing && borrowing.accession_number) || normalized,
      bookTitle: rowTitle,
      author: rowAuthor,
      studentName: rowStudent,
      statusLabel: displayStatus || 'available',
      pickupDate: borrowing && borrowing.picked_up_at ? formatDate(borrowing.picked_up_at) : 'Pending',
      dueDate: (borrowing && borrowing.due_date) ? formatDate(borrowing.due_date) : 'N/A',
      dueState
    });

    if (!borrowing) {
      setBorrowScannerMessage('No active borrowing record found.', 'warning');
      setBorrowScannerStatus('No active borrowing.', 'error');
      return;
    }

    renderBorrowScannerHistory(borrowing);

    if (['borrowed', 'overdue', 'pending_return', 'picked_up'].includes(displayStatus)) {
      if (scannerCurrentBorrowingId && Number(borrowing.id) !== Number(scannerCurrentBorrowingId)) {
        setBorrowScannerMessage('Scanned QR does not match the selected return record.', 'warning');
        setBorrowScannerStatus('Scan the matching book copy QR for this return.', 'error');
        return;
      }

      setBorrowScannerMessage(
        dueState === 'Overdue'
          ? 'Book is overdue. Confirm return and process penalties if needed.'
          : 'Return record verified. You can confirm return.',
        dueState === 'Overdue' ? 'warning' : 'success'
      );
      setBorrowScannerStatus('Ready to confirm return.', 'success');
      setScannerActionButton('Confirm Return', 'sa-btn-primary', async () => {
        await confirmReturn(Number(borrowing.id));
        resetBorrowScannerState(false);
      });
      return;
    }

    setBorrowScannerMessage(`Status ${displayStatus || 'unknown'} is not valid for return confirmation.`, 'warning');
    setBorrowScannerStatus('No return action available for this status.', 'error');
  } catch (error) {
    setBorrowScannerStatus('Lookup failed. Please scan a valid QR label.', 'error');
    setBorrowScannerMessage(error.message || 'Unable to lookup scanned QR code.', 'error');
  }
}

function onBorrowScannerScan(decodedText) {
  const normalized = String(decodedText || '').trim();
  if (!normalized || scannerCooldownActive) return;
  if (normalized === scannerLastCode) return;

  scannerLastCode = normalized;
  scannerCooldownActive = true;

  setTimeout(() => {
    scannerCooldownActive = false;
  }, 4000);

  handleBorrowScannerLookup(normalized);
}

function openBorrowScannerModal(mode, borrowingId) {
  const modal = scannerEl('borrowScannerModal');
  const title = scannerEl('borrowScannerTitle');
  if (!modal) return;

  borrowScannerMode = mode;
  scannerCurrentBorrowingId = borrowingId || null;
  scannerLastCode = '';

  resetBorrowScannerState(false);
  if (title) {
    title.textContent = mode === 'pickup' ? 'Scan to Confirm Pickup' : 'Scan to Confirm Return';
  }

  if (scannerCurrentBorrowingId) {
    const selectedRecord = getBorrowingRecordById(scannerCurrentBorrowingId);
    prefillBorrowScannerWithRecord(selectedRecord, mode);
  }

  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function showPickupModal(borrowingId) {
  const record = allBorrowings.find(b => b.id === borrowingId);
  if (!record) {
    showToast('Borrowing record not found', 'error');
    return;
  }
  openBorrowScannerModal('pickup', borrowingId);
}

function showReturnModal(borrowingId) {
  const record = allBorrowings.find(b => b.id === borrowingId);
  if (!record) {
    showToast('Borrowing record not found', 'error');
    return;
  }
  openBorrowScannerModal('return', borrowingId);
}

function showDetailsModal(borrowingId) {
  const record = allBorrowings.find(b => b.id === borrowingId);
  
  if (!record) {
    showToast('Borrowing record not found', 'error');
    return;
  }
  
  const modal = document.getElementById('detailsModal');
  const modalBody = modal?.querySelector('.borrow-details-body') || modal?.querySelector('.sa-modal-body') || modal?.querySelector('.modal-body');

  if (!modal || !modalBody) {
    showToast('Details modal container not found', 'error');
    return;
  }

  const titleEl = modal.querySelector('.sa-modal-header h2') || modal.querySelector('.modal-header h2');
  if (titleEl) {
    titleEl.textContent = escapeHtml(record.student_name || 'Borrowing Details');
  }

  const studentHistory = getBorrowScannerHistoryEntries(record.student_id, 24);
  const statusLabelMap = {
    pending_pickup: 'Pending Pickup',
    claim_expired: 'Claim Expired',
    picked_up: 'Picked Up',
    pending_return: 'Pending Return',
    borrowed: 'Borrowed',
    overdue: 'Overdue',
    returned: 'Returned',
  };
  const getStatusClass = (status) => {
    const normalized = normalizeBorrowStatus(status);
    if (normalized === 'returned') return 'returned';
    if (normalized === 'picked_up' || normalized === 'borrowed' || normalized === 'pending_return') return 'active';
    if (normalized === 'pending_pickup') return 'pending';
    if (normalized === 'overdue' || normalized === 'claim_expired') return 'warning';
    return 'neutral';
  };

  const historyListHtml = studentHistory.length
    ? studentHistory.map((entry) => {
        const normalized = normalizeBorrowStatus(entry.display_status || entry.status);
        const statusLabel = statusLabelMap[normalized] || (normalized || 'Unknown');
        const dueLabel = entry.due_date ? formatDate(entry.due_date) : 'No due date';
        const currentClass = Number(entry.id) === Number(record.id) ? ' current' : '';
        return `
          <li class="borrow-overview-book-item${currentClass}">
            <div class="borrow-overview-book-line">
              <span class="borrow-overview-book-title">${escapeHtml(entry.book_title || 'Untitled')}</span>
              <span class="borrow-overview-book-due">Due ${dueLabel}</span>
            </div>
            <span class="borrow-overview-badge ${getStatusClass(normalized)}">${escapeHtml(statusLabel)}</span>
          </li>
        `;
      }).join('')
    : '<div class="borrow-overview-empty">No borrowing history available.</div>';
  
  modalBody.innerHTML = `
    <div class="borrow-overview-shell">
      <div class="borrow-overview-kicker">Overview</div>
      <div class="borrow-overview-title">${escapeHtml(record.student_name || 'Borrowing Details')}</div>

      <section class="borrow-overview-card">
        <h4 class="borrow-overview-card-title">User Details</h4>
        <div class="borrow-overview-kv">
          <div class="borrow-overview-k">Full Name</div><div class="borrow-overview-v">${escapeHtml(record.student_name || 'N/A')}</div>
          <div class="borrow-overview-k">Student ID</div><div class="borrow-overview-v">${escapeHtml(record.student_id || 'N/A')}</div>
          <div class="borrow-overview-k">Course/Dept</div><div class="borrow-overview-v">${escapeHtml(record.student_course || 'N/A')}</div>
          <div class="borrow-overview-k">Email</div><div class="borrow-overview-v">${escapeHtml(record.student_email || 'N/A')}</div>
          <div class="borrow-overview-k">Status</div><div class="borrow-overview-v">${getStatusBadge(record.display_status || record.status)}</div>
          <div class="borrow-overview-k">Accession</div><div class="borrow-overview-v"><code>${escapeHtml(record.accession_number || 'N/A')}</code></div>
          <div class="borrow-overview-k">Borrow Date</div><div class="borrow-overview-v">${formatDate(record.borrow_date)}</div>
          <div class="borrow-overview-k">Due Date</div><div class="borrow-overview-v">${formatDate(record.due_date)}</div>
        </div>
      </section>

      <section class="borrow-overview-card">
        <h4 class="borrow-overview-card-title">Borrowed Books</h4>
        <ul class="borrow-overview-book-list">
          ${historyListHtml}
        </ul>
      </section>
    </div>
  `;
  
  // Show modal
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

// ===========================
// ACTIONS
// ===========================

async function cancelBorrowing(borrowingId) {
  if (!confirm('Cancel this borrow request? The book will be returned to the available pool.')) return;
  try {
    const response = await fetchWithCsrf(`/api/admin/borrowings/${borrowingId}/cancel`, { method: 'POST' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        handleAdminAccessDenied(error.message || 'Access denied.');
        return;
      }
      throw new Error(error.message || 'Failed to cancel borrow request');
    }
    showToast('Borrow request cancelled successfully.', 'success');
    await loadBorrowings();
    updateTabCounters();
  } catch (error) {
    console.error('[Borrowed Books] Error cancelling borrowing:', error);
    showToast('Error: ' + error.message, 'error');
  }
}

function formatApprovalToastMessage(payload) {
  const data = payload && payload.data ? payload.data : {};
  const emailStatus = data.emailStatus || {};

  if (emailStatus.success) {
    return `Request approved. Pickup QR email sent${data.accessionNumber ? ` for copy ${data.accessionNumber}` : ''}.`;
  }

  if (emailStatus.error) {
    return `Request approved, but the pickup QR email failed to send: ${emailStatus.error}`;
  }

  return `Request approved${data.accessionNumber ? ` for copy ${data.accessionNumber}` : ''}.`;
}

async function approveBorrowing(borrowingId) {
  if (!confirm('Approve this borrow request and send the pickup QR email?')) return;

  try {
    const response = await fetchWithCsrf(`/api/admin/borrowings/${borrowingId}/approve`, {
      method: 'POST'
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        handleAdminAccessDenied(result.message || 'Access denied. Admin privileges required.');
        return;
      }
      throw new Error(result.message || 'Failed to approve borrow request');
    }

    showToast(formatApprovalToastMessage(result), result?.data?.emailStatus?.success === false ? 'warning' : 'success');
    await loadBorrowings();
    updateTabCounters();
  } catch (error) {
    console.error('[Borrowed Books] Error approving borrowing:', error);
    showToast('Error: ' + error.message, 'error');
  }
}

async function confirmPickup(borrowingId) {
  try {
    console.log('[Borrowed Books] Confirming pickup for:', borrowingId);
    
    const response = await fetchWithCsrf(`/api/admin/borrowings/${borrowingId}/confirm-pickup`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        handleAdminAccessDenied(error.message || 'Access denied. Admin privileges required.');
        return;
      }
      throw new Error(error.message || 'Failed to confirm pickup');
    }
    
    const result = await response.json();
    console.log('[Borrowed Books] Pickup confirmed:', result);
    
    showToast('Pickup confirmed successfully!', 'success');
    closeAllModals();
    
    // Reload borrowings
    await loadBorrowings();
    updateTabCounters();
    
  } catch (error) {
    console.error('[Borrowed Books] Error confirming pickup:', error);
    showToast('Error: ' + error.message, 'error');
  }
}

async function confirmReturn(borrowingId) {
  try {
    console.log('[Borrowed Books] Confirming return for:', borrowingId);
    
    const condition = document.getElementById('returnCondition')?.value || undefined;
    
    const response = await fetchWithCsrf(`/api/admin/borrowings/${borrowingId}/confirm-return`, {
      method: 'POST',
      body: JSON.stringify({ condition })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        handleAdminAccessDenied(error.message || 'Access denied. Admin privileges required.');
        return;
      }
      throw new Error(error.message || 'Failed to confirm return');
    }
    
    const result = await response.json();
    console.log('[Borrowed Books] Return confirmed:', result);
    
    showToast('Return confirmed successfully!', 'success');
    closeAllModals();
    
    // Reload borrowings
    await loadBorrowings();
    updateTabCounters();
    
  } catch (error) {
    console.error('[Borrowed Books] Error confirming return:', error);
    showToast('Error: ' + error.message, 'error');
  }
}

// ===========================
// UTILITIES
// ===========================

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
  stopBorrowScannerCamera();
  resetBorrowScannerState(false);
  borrowScannerMode = null;
  scannerCurrentBorrowingId = null;
  document.body.classList.remove('modal-open');
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function showToast(message, type = 'info') {
  // Use existing toast/alert system or create a simple one
  const alertClass = type === 'error' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info';
  
  const toast = document.createElement('div');
  toast.className = `alert ${alertClass} toast-notification`;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    min-width: 300px;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideInRight 0.3s ease-out;
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Global modal close function
window.closeModal = closeAllModals;

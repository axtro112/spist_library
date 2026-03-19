/**
 * Borrowed Books Management for Admins
 * Handles pickup confirmation and return confirmation
 */

// Global variables
let allBorrowings = [];
let filteredBorrowings = [];
let selectedBorrowingIds = new Set();
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
// BULK SELECTION
// ===========================

function initBulkSelection() {
  const selectAll = document.getElementById('selectAllBorrowings');
  const rowCheckboxes = document.querySelectorAll('.borrowing-row-cb');
  const bulkPickupBtn = document.getElementById('bulkConfirmPickupBtn');
  const bulkReturnBtn = document.getElementById('bulkConfirmReturnBtn');

  if (!selectAll) return;

  // Reset selectAll state
  selectAll.checked = false;
  selectAll.indeterminate = false;

  selectAll.onclick = () => {
    const checked = selectAll.checked;
    rowCheckboxes.forEach(cb => {
      cb.checked = checked;
      const id = Number(cb.dataset.borrowingId);
      if (checked) selectedBorrowingIds.add(id);
      else selectedBorrowingIds.delete(id);
    });
    updateBorrowingsBulkBar();
  };

  rowCheckboxes.forEach(cb => {
    cb.onclick = () => {
      const id = Number(cb.dataset.borrowingId);
      if (cb.checked) selectedBorrowingIds.add(id);
      else selectedBorrowingIds.delete(id);

      const total = rowCheckboxes.length;
      const checked = [...rowCheckboxes].filter(c => c.checked).length;
      selectAll.checked = checked === total;
      selectAll.indeterminate = checked > 0 && checked < total;

      updateBorrowingsBulkBar();
    };
  });

  if (bulkPickupBtn) bulkPickupBtn.onclick = handleBulkConfirmPickup;
  if (bulkReturnBtn) bulkReturnBtn.onclick = handleBulkConfirmReturn;

  updateBorrowingsBulkBar();
}

function updateBorrowingsBulkBar() {
  const count = selectedBorrowingIds.size;
  const countSpan = document.getElementById('borrowingsSelectedCount');
  const bulkPickupBtn = document.getElementById('bulkConfirmPickupBtn');
  const bulkReturnBtn = document.getElementById('bulkConfirmReturnBtn');

  if (countSpan) {
    countSpan.textContent = count > 0 ? `${count} selected` : '';
  }

  // Enable both buttons whenever any rows are selected (same as users page pattern)
  if (bulkPickupBtn) bulkPickupBtn.disabled = count === 0;
  if (bulkReturnBtn) bulkReturnBtn.disabled = count === 0;
}

async function handleBulkConfirmPickup() {
  const ids = allBorrowings
    .filter(b => selectedBorrowingIds.has(Number(b.id)) && b.display_status === 'pending_pickup')
    .map(b => b.id);

  if (ids.length === 0) {
    showToast('None of the selected records are pending pickup', 'warning');
    return;
  }

  if (!confirm(`Confirm pickup for ${ids.length} record(s)?`)) return;

  let success = 0, failed = 0;
  for (const id of ids) {
    try {
      const res = await fetchWithCsrf(`/api/admin/borrowings/${id}/confirm-pickup`, { method: 'POST' });
      if (res.ok) {
        success++;
      } else if (res.status === 401 || res.status === 403) {
        const err = await res.json().catch(() => ({}));
        handleAdminAccessDenied(err.message || 'Access denied. Admin privileges required.');
        return;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  showToast(`Pickup confirmed for ${success} record(s)${failed ? ` (${failed} failed)` : ''}.`, failed ? 'warning' : 'success');
  selectedBorrowingIds.clear();
  await loadBorrowings();
  updateTabCounters();
}

async function handleBulkConfirmReturn() {
  const ids = allBorrowings
    .filter(b => selectedBorrowingIds.has(Number(b.id)) && ['picked_up', 'overdue'].includes(b.display_status))
    .map(b => b.id);

  if (ids.length === 0) {
    showToast('None of the selected records are ready to return (must be Picked Up or Overdue)', 'warning');
    return;
  }

  if (!confirm(`Confirm return for ${ids.length} record(s)?`)) return;

  let success = 0, failed = 0;
  for (const id of ids) {
    try {
      const res = await fetchWithCsrf(`/api/admin/borrowings/${id}/confirm-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition: 'good' })
      });
      if (res.ok) {
        success++;
      } else if (res.status === 401 || res.status === 403) {
        const err = await res.json().catch(() => ({}));
        handleAdminAccessDenied(err.message || 'Access denied. Admin privileges required.');
        return;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  showToast(`Return confirmed for ${success} record(s)${failed ? ` (${failed} failed)` : ''}.`, failed ? 'warning' : 'success');
  selectedBorrowingIds.clear();
  await loadBorrowings();
  updateTabCounters();
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
        <td colspan="12" style="text-align: center; padding: 40px;">
          <span class="material-symbols-outlined" style="font-size: 48px; color: #9ca3af;">inbox</span>
          <p style="margin-top: 10px; color: #6b7280;">No borrowing records found</p>
        </td>
      </tr>
    `;
    return;
  }
  
  selectedBorrowingIds.clear();
  borrowings.forEach(record => {
    const row = createBorrowingRow(record);
    tbody.appendChild(row);
  });
  initBulkSelection();
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
  const canConfirmPickup = status === 'pending_pickup';
  const canConfirmReturn = status === 'picked_up' || status === 'overdue' || status === 'borrowed' || status === 'pending_return';

  const studentName = escapeHtml(record.student_name || 'Unknown student');
  const studentId = escapeHtml(record.student_id || 'N/A');
  const bookTitle = escapeHtml(record.book_title || 'Untitled');
  const dueDate = record.due_date ? formatDate(record.due_date) : 'N/A';
  const borrowId = Number(record.id);

  return `
    <div class="borrow-card" data-borrowing-id="${borrowId}">
      <div class="card-title">${bookTitle}</div>
      <div class="card-meta">
        Student: ${studentName} (${studentId})<br>
        Due Date: ${dueDate}
      </div>
      <div class="card-actions">
        ${canConfirmPickup ? `<button type="button" class="sa-btn sa-btn-success" onclick="showPickupModal(${borrowId})">Confirm Pickup</button>` : ''}
        ${canConfirmReturn ? `<button type="button" class="sa-btn sa-btn-primary" onclick="showReturnModal(${borrowId})">Confirm Return</button>` : ''}
        <button type="button" class="sa-btn sa-btn-outline" onclick="showDetailsModal(${borrowId})">Details</button>
      </div>
    </div>
  `;
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
    <td style="text-align:center;">
      <input type="checkbox" class="borrowing-row-cb" data-borrowing-id="${record.id}" style="width:16px;height:16px;cursor:pointer;">
    </td>
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

  return tr;
}

function getStatusBadge(status) {
  const statusMap = {
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
    if (['picked_up', 'overdue'].includes(record.display_status)) {
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

  // View Details button (always available, even for orphan records)
  buttons.push(`
    <button 
      class="btn btn-sm btn-secondary" 
      onclick="showDetailsModal(${record.id})"
      title="View Details"
    >
      <span class="material-symbols-outlined" style="font-size: 16px;">info</span>
    </button>
  `);

  return buttons.join('');
}

// ===========================
// MODALS
// ===========================

function showPickupModal(borrowingId) {
  const record = allBorrowings.find(b => b.id === borrowingId);
  
  if (!record) {
    showToast('Borrowing record not found', 'error');
    return;
  }
  
  const modal = document.getElementById('pickupModal');
  const modalBody = modal.querySelector('.modal-body');
  
  modalBody.innerHTML = `
    <div class="modal-detail-grid">
      <div class="detail-row">
        <span class="detail-label">Student:</span>
        <span class="detail-value">${escapeHtml(record.student_name)} (${escapeHtml(record.student_id)})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Book:</span>
        <span class="detail-value">${escapeHtml(record.book_title)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Author:</span>
        <span class="detail-value">${escapeHtml(record.book_author)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Accession No:</span>
        <span class="detail-value"><code>${escapeHtml(record.accession_number || 'N/A')}</code></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Borrow Date:</span>
        <span class="detail-value">${formatDate(record.borrow_date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${formatDate(record.due_date)}</span>
      </div>
      ${record.claim_expires_at ? `
      <div class="detail-row">
        <span class="detail-label">Claim Deadline:</span>
        <span class="detail-value">${formatDate(record.claim_expires_at)}</span>
      </div>
      ` : ''}
    </div>
    <div class="alert alert-info mt-3">
      <span class="material-symbols-outlined">info</span>
      Please verify the student's ID and the book's accession number before confirming pickup.
    </div>
  `;
  
  // Set up confirm button
  const confirmBtn = modal.querySelector('.btn-confirm-pickup');
  confirmBtn.onclick = () => confirmPickup(borrowingId);
  
  // Show modal
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function showReturnModal(borrowingId) {
  const record = allBorrowings.find(b => b.id === borrowingId);
  
  if (!record) {
    showToast('Borrowing record not found', 'error');
    return;
  }
  
  const modal = document.getElementById('returnModal');
  const modalBody = modal.querySelector('.modal-body');
  
  modalBody.innerHTML = `
    <div class="modal-detail-grid">
      <div class="detail-row">
        <span class="detail-label">Student:</span>
        <span class="detail-value">${escapeHtml(record.student_name)} (${escapeHtml(record.student_id)})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Book:</span>
        <span class="detail-value">${escapeHtml(record.book_title)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Accession No:</span>
        <span class="detail-value"><code>${escapeHtml(record.accession_number || 'N/A')}</code></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Picked Up:</span>
        <span class="detail-value">${formatDate(record.picked_up_at)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${formatDate(record.due_date)}</span>
      </div>
      ${record.display_status === 'overdue' ? `
      <div class="alert alert-warning mt-2">
        <span class="material-symbols-outlined">warning</span>
        This book is <strong>OVERDUE</strong>. Please check the book condition and apply any necessary penalties.
      </div>
      ` : ''}
    </div>
    <div class="form-group mt-3">
      <label for="returnCondition">Book Condition (Optional):</label>
      <select id="returnCondition" class="form-control">
        <option value="">-- Select condition --</option>
        <option value="excellent">Excellent</option>
        <option value="good">Good</option>
        <option value="fair">Fair</option>
        <option value="poor">Poor</option>
        <option value="damaged">Damaged</option>
      </select>
    </div>
    <div class="alert alert-info mt-3">
      <span class="material-symbols-outlined">info</span>
      Please inspect the book before confirming return. Check for damages, missing pages, or markings.
    </div>
  `;
  
  // Set up confirm button
  const confirmBtn = modal.querySelector('.btn-confirm-return');
  confirmBtn.onclick = () => confirmReturn(borrowingId);
  
  // Show modal
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function showDetailsModal(borrowingId) {
  const record = allBorrowings.find(b => b.id === borrowingId);
  
  if (!record) {
    showToast('Borrowing record not found', 'error');
    return;
  }
  
  const modal = document.getElementById('detailsModal');
  const modalBody = modal.querySelector('.modal-body');
  
  modalBody.innerHTML = `
    <div class="modal-detail-grid">
      <h4>Student Information</h4>
      <div class="detail-row">
        <span class="detail-label">Name:</span>
        <span class="detail-value">${escapeHtml(record.student_name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">ID:</span>
        <span class="detail-value">${escapeHtml(record.student_id)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${escapeHtml(record.student_email)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Course:</span>
        <span class="detail-value">${escapeHtml(record.student_course || 'N/A')}</span>
      </div>
      
      <h4 class="mt-3">Book Information</h4>
      <div class="detail-row">
        <span class="detail-label">Title:</span>
        <span class="detail-value">${escapeHtml(record.book_title)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Author:</span>
        <span class="detail-value">${escapeHtml(record.book_author)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">ISBN:</span>
        <span class="detail-value">${escapeHtml(record.book_isbn || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Category:</span>
        <span class="detail-value">${escapeHtml(record.book_category || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Accession No:</span>
        <span class="detail-value"><code>${escapeHtml(record.accession_number || 'N/A')}</code></span>
      </div>
      
      <h4 class="mt-3">Borrowing Timeline</h4>
      <div class="detail-row">
        <span class="detail-label">Borrow Date:</span>
        <span class="detail-value">${formatDate(record.borrow_date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${formatDate(record.due_date)}</span>
      </div>
      ${record.claim_expires_at ? `
      <div class="detail-row">
        <span class="detail-label">Claim Deadline:</span>
        <span class="detail-value">${formatDate(record.claim_expires_at)}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Picked Up:</span>
        <span class="detail-value">${record.picked_up_at ? formatDate(record.picked_up_at) : '<span style="color: #9ca3af;">Not picked up</span>'}</span>
      </div>
      ${record.picked_up_by_name ? `
      <div class="detail-row">
        <span class="detail-label">Confirmed by:</span>
        <span class="detail-value">${escapeHtml(record.picked_up_by_name)}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Return Date:</span>
        <span class="detail-value">${record.return_date ? formatDate(record.return_date) : '<span style="color: #9ca3af;">Not returned</span>'}</span>
      </div>
      ${record.returned_by_name ? `
      <div class="detail-row">
        <span class="detail-label">Returned to:</span>
        <span class="detail-value">${escapeHtml(record.returned_by_name)}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${getStatusBadge(record.display_status)}</span>
      </div>
      
      ${record.copy_condition_at_borrow || record.copy_condition_at_return ? `
      <h4 class="mt-3">Book Condition</h4>
      ${record.copy_condition_at_borrow ? `
      <div class="detail-row">
        <span class="detail-label">At Borrow:</span>
        <span class="detail-value">${capitalizeFirst(record.copy_condition_at_borrow)}</span>
      </div>
      ` : ''}
      ${record.copy_condition_at_return ? `
      <div class="detail-row">
        <span class="detail-label">At Return:</span>
        <span class="detail-value">${capitalizeFirst(record.copy_condition_at_return)}</span>
      </div>
      ` : ''}
      ` : ''}
      
      ${record.notes ? `
      <h4 class="mt-3">Notes</h4>
      <div class="detail-row">
        <span class="detail-value">${escapeHtml(record.notes)}</span>
      </div>
      ` : ''}
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

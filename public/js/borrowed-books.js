/**
 * Borrowed Books Management for Admins
 * Handles pickup confirmation and return confirmation
 */

// Global variables
let allBorrowings = [];
let filteredBorrowings = [];
let selectedBorrowingIds = new Set();

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener("DOMContentLoaded", async function () {
  console.log('[Borrowed Books] Initializing...');
  
  // Load data
  await Promise.all([loadBorrowings(), loadCategories()]);
  
  // Setup filters
  setupFilters();
  
  console.log('[Borrowed Books] Initialization complete');
});

// ===========================
// DATA LOADING
// ===========================

async function loadBorrowings() {
  try {
    console.log('[Borrowed Books] Loading borrowings...');
    
    const filterParams = getFilterParams();
    const url = `/api/admin/borrowings${filterParams ? '?' + filterParams : ''}`;
    
    const response = await fetchWithCsrf(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch borrowings');
    }
    
    const result = await response.json();
    allBorrowings = result.data || [];
    filteredBorrowings = allBorrowings;
    
    console.log(`[Borrowed Books] Loaded ${allBorrowings.length} borrowings`);
    
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
    
    const response = await fetchWithCsrf('/api/admin/books');
    
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    
    const result = await response.json();
    const books = result.data || [];
    
    const categories = [...new Set(books.map(b => b.category).filter(c => c && c.trim()))];
    categories.sort();
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="">All Categories</option>';
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
      });
      console.log(`[Borrowed Books] Loaded ${categories.length} categories`);
    }
    
  } catch (error) {
    console.error('[Borrowed Books] Error loading categories:', error);
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
      loadBorrowings();
    }, 300);
  });
  
  // Filter changes
  categoryFilter.addEventListener('change', () => {
    console.log('[Borrowed Books] Category filter changed:', categoryFilter.value);
    loadBorrowings();
  });
  
  statusFilter.addEventListener('change', () => {
    console.log('[Borrowed Books] Status filter changed:', statusFilter.value);
    loadBorrowings();
  });
  
  // Clear filters
  clearFiltersBtn.addEventListener('click', () => {
    console.log('[Borrowed Books] Clearing all filters');
    searchInput.value = '';
    categoryFilter.value = '';
    statusFilter.value = '';
    loadBorrowings();
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
      if (res.ok) success++;
      else failed++;
    } catch {
      failed++;
    }
  }

  showToast(`Pickup confirmed for ${success} record(s)${failed ? ` (${failed} failed)` : ''}.`, failed ? 'warning' : 'success');
  selectedBorrowingIds.clear();
  loadBorrowings();
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
      if (res.ok) success++;
      else failed++;
    } catch {
      failed++;
    }
  }

  showToast(`Return confirmed for ${success} record(s)${failed ? ` (${failed} failed)` : ''}.`, failed ? 'warning' : 'success');
  selectedBorrowingIds.clear();
  loadBorrowings();
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

async function confirmPickup(borrowingId) {
  try {
    console.log('[Borrowed Books] Confirming pickup for:', borrowingId);
    
    const response = await fetchWithCsrf(`/api/admin/borrowings/${borrowingId}/confirm-pickup`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to confirm pickup');
    }
    
    const result = await response.json();
    console.log('[Borrowed Books] Pickup confirmed:', result);
    
    showToast('Pickup confirmed successfully!', 'success');
    closeAllModals();
    
    // Reload borrowings
    await loadBorrowings();
    
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
      const error = await response.json();
      throw new Error(error.message || 'Failed to confirm return');
    }
    
    const result = await response.json();
    console.log('[Borrowed Books] Return confirmed:', result);
    
    showToast('Return confirmed successfully!', 'success');
    closeAllModals();
    
    // Reload borrowings
    await loadBorrowings();
    
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

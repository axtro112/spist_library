// ========== GMAIL-STYLE BULK OPERATIONS ==========
// This file handles bulk selection and operations for the Book Management page
// Features: Select all, bulk delete, bulk edit (similar to Gmail's UI)

// Selection state management
let selectedBookIds = new Set();

/**
 * Parse availability and total quantity from a table row.
 * Prefers data-available / data-quantity attributes; falls back to
 * scanning cells for the "X/Y" pattern.
 * @param {HTMLTableRowElement} row
 * @returns {{ available: number, total: number }}
 */
function parseAvailabilityCell(row) {
  // Prefer data attributes (set during row render)
  const da = row.dataset.available;
  const dq = row.dataset.quantity;
  if (da !== undefined && da !== '' && dq !== undefined && dq !== '') {
    const a = parseInt(da, 10);
    const t = parseInt(dq, 10);
    if (!isNaN(a) && !isNaN(t)) return { available: a, total: t };
  }
  // Fallback: find a cell whose trimmed text matches "digits/digits"
  const cells = row.querySelectorAll('td');
  for (const cell of cells) {
    const text = cell.textContent.trim();
    const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (match) {
      return { available: parseInt(match[1], 10), total: parseInt(match[2], 10) };
    }
  }
  return { available: 0, total: 0 };
}

/**
 * A row is selectable when it has at least one copy in the library
 * (quantity > 0). Admins can bulk-edit/delete any book regardless
 * of how many copies are currently on loan.
 * @param {HTMLTableRowElement} row
 * @returns {boolean}
 */
function isRowSelectable(row) {
  const { total } = parseAvailabilityCell(row);
  return total > 0;
}

function isRowVisible(row) {
  return !!row && row.style.display !== 'none' && !row.classList.contains('books-tab-hidden');
}

/**
 * Disable checkboxes on non-selectable (unavailable) rows and mark the row.
 * Should be called after every table re-render.
 */
function applyRowSelectability() {
  const masterCheckbox = document.getElementById('bulkMasterCheckbox');
  const checkboxes = document.querySelectorAll('.book-row-checkbox');
  let selectableCount = 0;

  checkboxes.forEach(checkbox => {
    const row = checkbox.closest('tr');
    if (!row) return;
    const selectable = isRowSelectable(row);
    if (selectable) {
      checkbox.disabled = false;
      row.classList.remove('row-unavailable');
      if (isRowVisible(row)) selectableCount++;
    } else {
      checkbox.disabled = true;
      checkbox.checked = false;
      const bookId = parseInt(checkbox.dataset.bookId);
      if (!isNaN(bookId)) selectedBookIds.delete(bookId);
      row.classList.add('row-unavailable');
    }
  });

  if (masterCheckbox) {
    if (selectableCount === 0) {
      masterCheckbox.disabled = true;
      masterCheckbox.checked = false;
      masterCheckbox.indeterminate = false;
    } else {
      masterCheckbox.disabled = false;
    }
  }

  updateBulkToolbar();
}

/**
 * Initialize bulk operations when DOM is ready
 * Sets up event listeners for checkboxes and bulk action buttons
 */
function initBulkOperations() {
  // Master checkbox in toolbar
  const masterCheckbox = document.getElementById('bulkMasterCheckbox');
  if (masterCheckbox) {
    masterCheckbox.addEventListener('change', handleMasterCheckboxChange);
  }

  // Bulk action buttons
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkEditBtn = document.getElementById('bulkEditBtn');
  
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  }
  
  if (bulkEditBtn) {
    bulkEditBtn.addEventListener('click', handleBulkEdit);
  }

  // Apply initial selectability state
  applyRowSelectability();

  // Initialize toolbar state
  updateBulkToolbar();
}

/**
 * Handle master checkbox toggle (Select All / Deselect All)
 * Gmail-style behavior: toggles all visible rows
 */
function handleMasterCheckboxChange(e) {
  const isChecked = e.target.checked;
  
  if (isChecked) {
    selectAllCurrentPage();
  } else {
    clearSelection();
  }
}

/**
 * Select all books currently visible in the table
 * Adds all visible book IDs to the selection set
 */
function selectAllCurrentPage() {
  const checkboxes = document.querySelectorAll('.book-row-checkbox');
  
  checkboxes.forEach(checkbox => {
    const row = checkbox.closest('tr');
    if (!row || !isRowVisible(row) || !isRowSelectable(row)) return;
    const bookId = parseInt(checkbox.dataset.bookId);
    checkbox.checked = true;
    selectedBookIds.add(bookId);
  });
  
  updateBulkToolbar();
}

/**
 * Clear all selections
 * Unchecks all checkboxes and empties the selection set
 */
function clearSelection() {
  selectedBookIds.clear();
  
  const checkboxes = document.querySelectorAll('.book-row-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  const masterCheckbox = document.getElementById('bulkMasterCheckbox');
  if (masterCheckbox) {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = false;
  }
  
  updateBulkToolbar();
}

/**
 * Handle individual row checkbox change
 * Updates selection state and syncs master checkbox
 */
function handleRowCheckboxChange(checkbox) {
  const row = checkbox.closest('tr');
  if (row && !isRowSelectable(row)) {
    checkbox.checked = false;
    return;
  }
  const bookId = parseInt(checkbox.dataset.bookId);
  
  if (checkbox.checked) {
    selectedBookIds.add(bookId);
  } else {
    selectedBookIds.delete(bookId);
  }
  
  updateMasterCheckboxState();
  updateBulkToolbar();
}

/**
 * Update master checkbox state based on row selections
 * - Checked: all rows selected
 * - Unchecked: no rows selected
 * - Indeterminate: some rows selected
 */
function updateMasterCheckboxState() {
  const masterCheckbox = document.getElementById('bulkMasterCheckbox');
  if (!masterCheckbox) return;

  const selectableCheckboxes = Array.from(
    document.querySelectorAll('.book-row-checkbox')
  ).filter(cb => {
    const row = cb.closest('tr');
    return row && isRowVisible(row) && isRowSelectable(row);
  });

  const totalSelectable = selectableCheckboxes.length;
  const checkedSelectable = selectableCheckboxes.filter(cb => cb.checked).length;

  if (totalSelectable === 0) {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = false;
    masterCheckbox.disabled = true;
  } else if (checkedSelectable === 0) {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = false;
    masterCheckbox.disabled = false;
  } else if (checkedSelectable >= totalSelectable) {
    masterCheckbox.checked = true;
    masterCheckbox.indeterminate = false;
    masterCheckbox.disabled = false;
  } else {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = true;
    masterCheckbox.disabled = false;
  }
}

/**
 * Update bulk toolbar UI based on selection state
 * Shows/hides selection count (in copies) and enables/disables action buttons
 */
function updateBulkToolbar() {
  const selectionText = document.getElementById('bulkSelectionText');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkEditBtn   = document.getElementById('bulkEditBtn');

  const count = selectedBookIds.size;

  // Sum available and total copies across all selected book rows
  let totalAvail = 0;
  let totalQty   = 0;
  selectedBookIds.forEach(bookId => {
    const cb  = document.querySelector(`.book-row-checkbox[data-book-id="${bookId}"]`);
    const row = cb && cb.closest('tr');
    if (row) {
      const { available, total } = parseAvailabilityCell(row);
      totalAvail += available;
      totalQty   += total;
    }
  });

  // Update selection count text
  if (selectionText) {
    if (count > 0) {
      selectionText.textContent = `Selected: ${count} book title${count > 1 ? 's' : ''} (${totalAvail} available / ${totalQty} total copies)`;
      selectionText.style.display = 'inline-block';
    } else {
      selectionText.textContent = '';
      selectionText.style.display = 'none';
    }
  }

  // Enable/disable bulk action buttons based on whether any rows are checked
  const isDisabled = selectedBookIds.size === 0;
  if (bulkDeleteBtn) {
    bulkDeleteBtn.disabled = isDisabled;
    bulkDeleteBtn.style.opacity = isDisabled ? '0.5' : '1';
    bulkDeleteBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
  }
  if (bulkEditBtn) {
    bulkEditBtn.disabled = isDisabled;
    bulkEditBtn.style.opacity = isDisabled ? '0.5' : '1';
    bulkEditBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
  }
}

/**
 * Get array of currently selected book IDs
 * @returns {Array<number>} Array of selected book IDs
 */
function getSelectedBookIds() {
  return Array.from(selectedBookIds);
}

/**
 * Handle bulk delete action
 * Shows confirmation dialog and sends delete request to backend
 */
async function handleBulkDelete() {
  const selectedIds = getSelectedBookIds();
  
  if (selectedIds.length === 0) {
    alert('No books selected.');
    return;
  }
  
  const confirmMessage = `Move ${selectedIds.length} selected book${selectedIds.length > 1 ? 's' : ''} to trash?`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  try {
    const response = await fetchWithCsrf('/api/admin/books/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: selectedIds })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to move books to trash');
    }
    
    alert(`Moved ${result.deletedCount} book${result.deletedCount > 1 ? 's' : ''} to trash`);
    
    // Clear selection and reload table with stats
    clearSelection();
    if (typeof reloadBooksAndStats === 'function') {
      await reloadBooksAndStats();
    } else if (typeof loadBooks === 'function') {
      await loadBooks();
    }
    
  } catch (error) {
    console.error('Bulk delete error:', error);
    alert('Failed to move books to trash: ' + error.message);
  }
}

/**
 * Handle bulk edit action
 * Opens modal for editing multiple books at once
 */
function handleBulkEdit() {
  const selectedIds = getSelectedBookIds();
  
  if (selectedIds.length === 0) {
    alert('No books selected.');
    return;
  }
  
  // Store selected IDs for the modal
  const bulkEditModal = document.getElementById('bulkEditModal');
  if (bulkEditModal) {
    bulkEditModal.dataset.selectedIds = JSON.stringify(selectedIds);
    
    // Update modal title with selection count
    const modalTitle = bulkEditModal.querySelector('h2');
    if (modalTitle) {
      modalTitle.textContent = `Edit ${selectedIds.length} Selected Book${selectedIds.length > 1 ? 's' : ''}`;
    }
    
    // Reset form
    document.getElementById('bulkEditForm')?.reset();
    
    // Show modal
    showModal('bulkEditModal');
  }
}

/**
 * Handle bulk edit form submission
 * Sends update request to backend for selected books
 */
async function handleBulkEditSubmit(e) {
  e.preventDefault();
  
  const bulkEditModal = document.getElementById('bulkEditModal');
  const selectedIds = JSON.parse(bulkEditModal.dataset.selectedIds || '[]');
  
  if (selectedIds.length === 0) {
    alert('No books selected');
    return;
  }
  
  // Collect form data (only non-empty fields)
  const update = {};
  
  const category = document.getElementById('bulkCategory')?.value.trim();
  const status = document.getElementById('bulkStatus')?.value;
  const quantity = document.getElementById('bulkQuantity')?.value;
  
  if (category) update.category = category;
  if (status) update.status = status;
  if (quantity !== '') update.quantity = parseInt(quantity, 10);
  
  if (Object.keys(update).length === 0) {
    alert('Please fill in at least one field to update');
    return;
  }
  
  try {
    const response = await fetchWithCsrf('/api/admin/books/bulk-update', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: selectedIds,
        update: update
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to update books');
    }
    
    const updatedCount = result.data?.updatedCount || 0;
    alert(`Successfully updated ${updatedCount} book${updatedCount > 1 ? 's' : ''}`);
    
    // Close modal, clear selection, and reload table with stats
    closeModal();
    clearSelection();
    if (typeof reloadBooksAndStats === 'function') {
      await reloadBooksAndStats();
    } else if (typeof loadBooks === 'function') {
      await loadBooks();
    }
    
  } catch (error) {
    console.error('Bulk update error:', error);
    alert('Failed to update books: ' + error.message);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBulkOperations);
} else {
  initBulkOperations();
}

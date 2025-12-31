// ========== GMAIL-STYLE BULK OPERATIONS ==========
// This file handles bulk selection and operations for the Book Management page
// Features: Select all, bulk delete, bulk edit (similar to Gmail's UI)

// Selection state management
let selectedBookIds = new Set();

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
  
  const totalCheckboxes = document.querySelectorAll('.book-row-checkbox').length;
  const selectedCount = selectedBookIds.size;
  
  if (selectedCount === 0) {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = false;
  } else if (selectedCount === totalCheckboxes) {
    masterCheckbox.checked = true;
    masterCheckbox.indeterminate = false;
  } else {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = true;
  }
}

/**
 * Update bulk toolbar UI based on selection state
 * Shows/hides selection count and enables/disables action buttons
 */
function updateBulkToolbar() {
  const selectedCount = selectedBookIds.size;
  const selectionText = document.getElementById('bulkSelectionText');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkEditBtn = document.getElementById('bulkEditBtn');
  
  // Update selection count text
  if (selectionText) {
    if (selectedCount > 0) {
      selectionText.textContent = `${selectedCount} selected`;
      selectionText.style.display = 'inline-block';
    } else {
      selectionText.textContent = '';
      selectionText.style.display = 'none';
    }
  }
  
  // Enable/disable bulk action buttons
  const isDisabled = selectedCount === 0;
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
  
  const confirmMessage = `Delete ${selectedIds.length} selected book${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`;
  
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
      throw new Error(result.message || 'Failed to delete books');
    }
    
    alert(`Successfully deleted ${result.deletedCount} book${result.deletedCount > 1 ? 's' : ''}`);
    
    // Clear selection and reload table
    clearSelection();
    if (typeof loadBooks === 'function') {
      await loadBooks();
    }
    
  } catch (error) {
    console.error('Bulk delete error:', error);
    alert('Failed to delete books: ' + error.message);
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
    
    alert(`Successfully updated ${result.updatedCount} book${result.updatedCount > 1 ? 's' : ''}`);
    
    // Close modal, clear selection, and reload table
    closeModal();
    clearSelection();
    if (typeof loadBooks === 'function') {
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

// ========================================
// BOOK PROFILE MODAL WITH BORROWING OVERVIEW
// Bootstrap 5 Modal Implementation
// Used by both Super Admin and System Admin
// ========================================

let currentBookData = {
  profile: null,
  copies: [],
  borrowings: [],
  filteredBorrowings: [],
  currentStatusFilter: 'all'
};

/**
 * Open the Book Profile Modal
 * @param {number} bookId - The book ID to load
 */
function openBookProfileModal(bookId) {
  var el = document.getElementById('bookProfileModal');
  if (!el) { alert('Modal element not found. Please refresh the page.'); return; }

  // Reset state first
  resetModalState();

  // Manually show modal (no Bootstrap JS dependency)
  el.style.display = 'block';
  el.removeAttribute('aria-hidden');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('role', 'dialog');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';

  // Create backdrop if not present
  if (!document.getElementById('bookProfileBackdrop')) {
    var bd = document.createElement('div');
    bd.id = 'bookProfileBackdrop';
    bd.className = 'modal-backdrop fade show';
    document.body.appendChild(bd);
  }

  // Trigger fade-in
  requestAnimationFrame(function() { el.classList.add('show'); });

  // Load data
  loadBookProfileData(bookId);
}

/**
 * Reset modal to initial state
 */

/**
 * Close the Book Profile Modal - pure DOM, no Bootstrap JS dependency
 */
function closeBookProfileModal() {
  var el = document.getElementById('bookProfileModal');
  if (!el) return;
  el.classList.remove('show');
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
  el.removeAttribute('aria-modal');
  el.removeAttribute('role');
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
  // Remove backdrop
  var bd = document.getElementById('bookProfileBackdrop');
  if (bd) bd.remove();
  document.querySelectorAll('.modal-backdrop').forEach(function(b) { b.remove(); });
}
function resetModalState() {
  // Show loading, hide content and error
  document.getElementById('bookProfileLoading').classList.remove('d-none');
  document.getElementById('bookProfileContent').classList.add('d-none');
  document.getElementById('bookProfileError').classList.add('d-none');
  
  // Reset search
  const searchInput = document.getElementById('borrowerSearch');
  if (searchInput) searchInput.value = '';
  
  // Reset status filter to 'all'
  document.querySelectorAll('#statusFilterTabs .nav-link').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.status === 'all') {
      btn.classList.add('active');
    }
  });
  
  // Clear data
  currentBookData = {
    profile: null,
    copies: [],
    borrowings: [],
    filteredBorrowings: [],
    currentStatusFilter: 'all'
  };
}

/**
 * Load all book profile data via Promise.all
 * @param {number} bookId - The book ID
 */
async function loadBookProfileData(bookId) {
  try {
    // Fetch all data in parallel
    const [profileRes, copiesRes, borrowingsRes] = await Promise.all([
      fetchWithCsrf(`/api/admin/books/${bookId}/profile`, { credentials: 'include' }),
      fetchWithCsrf(`/api/admin/books/${bookId}/copies`, { credentials: 'include' }),
      fetchWithCsrf(`/api/admin/books/${bookId}/borrowings?status=all`, { credentials: 'include' })
    ]);
    
    // Check responses
    if (!profileRes.ok || !copiesRes.ok || !borrowingsRes.ok) {
      throw new Error('Failed to fetch book data');
    }
    
    // Parse JSON
    const profileData = await profileRes.json();
    const copiesData = await copiesRes.json();
    const borrowingsData = await borrowingsRes.json();
    
    // Store data
    currentBookData.profile = profileData.data || profileData;
    currentBookData.copies = copiesData.data || [];
    const borrowingsResult = borrowingsData.data || {};
    currentBookData.borrowings = borrowingsResult.borrowings || [];
    currentBookData.filteredBorrowings = currentBookData.borrowings;
    
    // Render content
    renderBookProfile();
    renderAccessionList();
    renderSummaryCountsFromData();
    renderBorrowersList();
    
    // Hide loading, show content
    document.getElementById('bookProfileLoading').classList.add('d-none');
    document.getElementById('bookProfileContent').classList.remove('d-none');
    
  } catch (error) {
    console.error('Error loading book profile:', error);
    showModalError('Failed to load book profile. Please try again.');
  }
}

/**
 * Show error message in modal
 * @param {string} message - Error message
 */
function showModalError(message) {
  document.getElementById('bookProfileLoading').classList.add('d-none');
  document.getElementById('bookProfileContent').classList.add('d-none');
  document.getElementById('bookProfileError').classList.remove('d-none');
  document.getElementById('bookProfileErrorMessage').textContent = message;
}

/**
 * Render book profile information (LEFT column)
 */
function renderBookProfile() {
  const profile = currentBookData.profile;
  if (!profile) return;
  
  document.getElementById('profileTitle').textContent = profile.title || '-';
  document.getElementById('profileAuthor').textContent = profile.author || '-';
  document.getElementById('profileCategory').textContent = profile.category || '-';
  document.getElementById('profileISBN').textContent = profile.isbn || '-';
  document.getElementById('profileTotalQty').textContent = profile.total_quantity || 0;
  document.getElementById('profileAvailableQty').textContent = profile.available_quantity || 0;
}

/**
 * Render accession numbers list
 */
function renderAccessionList() {
  const listContainer = document.getElementById('accessionList');
  const copies = currentBookData.copies;
  
  if (!copies || copies.length === 0) {
    listContainer.innerHTML = '<div class="list-group-item text-muted text-center">No copies available</div>';
    return;
  }
  
  let html = '';
  copies.forEach(copy => {
    const statusClass = copy.status === 'available' ? 'success' : 
                        copy.status === 'borrowed' ? 'primary' : 'secondary';
    const statusLabel = copy.status.charAt(0).toUpperCase() + copy.status.slice(1);
    
    html += `
      <div class="list-group-item d-flex justify-content-between align-items-center">
        <div>
          <strong>${copy.accession_number || 'N/A'}</strong>
          <small class="text-muted d-block">Copy #${copy.copy_number}</small>
        </div>
        <span class="badge bg-${statusClass}">${statusLabel}</span>
      </div>
    `;
  });
  
  listContainer.innerHTML = html;
}

/**
 * Calculate and render summary counts from data
 */
function renderSummaryCountsFromData() {
  const borrowings = currentBookData.borrowings;
  
  const active = borrowings.filter(b => b.status === 'borrowed' || b.status === 'approved').length;
  const overdue = borrowings.filter(b => b.status === 'overdue').length;
  const returned = borrowings.filter(b => b.status === 'returned').length;
  
  document.getElementById('summaryActive').textContent = active;
  document.getElementById('summaryOverdue').textContent = overdue;
  document.getElementById('summaryReturned').textContent = returned;
}

/**
 * Render borrowers list (RIGHT column)
 */
function renderBorrowersList() {
  const listContainer = document.getElementById('borrowersList');
  const borrowings = currentBookData.filteredBorrowings;
  
  if (!borrowings || borrowings.length === 0) {
    listContainer.innerHTML = '<div class="text-muted text-center py-4">No borrowing records found</div>';
    return;
  }
  
  let html = '';
  borrowings.forEach(borrowing => {
    const statusClass = borrowing.status === 'borrowed' || borrowing.status === 'approved' ? 'primary' : 
                        borrowing.status === 'overdue' ? 'danger' : 
                        borrowing.status === 'returned' ? 'success' : 'secondary';
    const statusLabel = borrowing.status.charAt(0).toUpperCase() + borrowing.status.slice(1);
    
    const borrowedDate = borrowing.borrowed_on ? new Date(borrowing.borrowed_on).toLocaleDateString() : '-';
    const dueDate = borrowing.due_date ? new Date(borrowing.due_date).toLocaleDateString() : '-';
    
    html += `
      <div class="card mb-2 border-start border-${statusClass} border-3 shadow-sm">
        <div class="card-body py-2 px-3">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div class="flex-grow-1">
              <h6 class="mb-1 fw-bold">${borrowing.student_name || 'Unknown'}</h6>
              <small class="text-muted d-block">ID: ${borrowing.student_id || '-'}</small>
              ${borrowing.department ? `<small class="text-muted d-block">${borrowing.department}</small>` : ''}
            </div>
            <span class="badge bg-${statusClass} align-self-start">${statusLabel}</span>
          </div>
          <div class="mt-2 small">
            <div class="row g-2">
              <div class="col-6"><strong>Borrowed:</strong> ${borrowedDate}</div>
              <div class="col-6"><strong>Due:</strong> ${dueDate}</div>
              ${borrowing.copy_number ? `<div class="col-12"><strong>Copy:</strong> #${borrowing.copy_number}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  listContainer.innerHTML = html;
}

/**
 * Filter borrowings by search term
 * @param {string} searchTerm - Search input value
 */
function filterBorrowingsBySearch(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  
  if (!term) {
    // No search, show all (respecting status filter)
    applyStatusFilter(currentBookData.currentStatusFilter);
    return;
  }
  
  // Filter by student name or ID
  currentBookData.filteredBorrowings = currentBookData.borrowings.filter(b => {
    const matchesSearch = (b.student_name && b.student_name.toLowerCase().includes(term)) ||
                          (b.student_id && b.student_id.toLowerCase().includes(term));
    
    // Also respect current status filter
    const matchesStatus = filterByStatus(b, currentBookData.currentStatusFilter);
    
    return matchesSearch && matchesStatus;
  });
  
  renderBorrowersList();
}

/**
 * Apply status filter
 * @param {string} status - Status filter: all, active, overdue, returned
 */
function applyStatusFilter(status) {
  currentBookData.currentStatusFilter = status;
  
  // Update active tab
  document.querySelectorAll('#statusFilterTabs .nav-link').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.status === status) {
      btn.classList.add('active');
    }
  });
  
  // Filter borrowings
  if (status === 'all') {
    currentBookData.filteredBorrowings = currentBookData.borrowings;
  } else {
    currentBookData.filteredBorrowings = currentBookData.borrowings.filter(b => 
      filterByStatus(b, status)
    );
  }
  
  // Re-apply search if active
  const searchInput = document.getElementById('borrowerSearch');
  if (searchInput) {
    const searchTerm = searchInput.value;
    if (searchTerm.trim()) {
      filterBorrowingsBySearch(searchTerm);
    } else {
      renderBorrowersList();
    }
  }
}

/**
 * Check if borrowing matches status filter
 * @param {object} borrowing - Borrowing record
 * @param {string} status - Status filter
 * @returns {boolean}
 */
function filterByStatus(borrowing, status) {
  if (status === 'all') return true;
  if (status === 'active') return borrowing.status === 'borrowed' || borrowing.status === 'approved';
  if (status === 'overdue') return borrowing.status === 'overdue';
  if (status === 'returned') return borrowing.status === 'returned';
  return true;
}

// ========================================
// EVENT LISTENERS FOR BOOK PROFILE MODAL
// ========================================

console.log('[Book Profile Modal] Script loaded successfully');

document.addEventListener('DOMContentLoaded', function() {
  console.log('[Book Profile Modal] DOM loaded, setting up event listeners');
  
  // Search input
  const searchInput = document.getElementById('borrowerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      filterBorrowingsBySearch(e.target.value);
    });
  } else {
    console.warn('[Book Profile Modal] borrowerSearch input not found');
  }
  
  // Status filter tabs
  const statusTabs = document.querySelectorAll('#statusFilterTabs .nav-link');
  statusTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const status = this.dataset.status;
      applyStatusFilter(status);
    });
  });
  
  // Reset on modal close
  // Close when clicking outside the dialog box
    const modalElement = document.getElementById('bookProfileModal');
    if (modalElement) {
      modalElement.addEventListener('mousedown', function(e) {
        if (e.target === modalElement) { closeBookProfileModal(); }
      });
    }
});

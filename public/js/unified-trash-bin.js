// Unified Trash Bin JavaScript
// Handles trash operations for Books, Users, and Admins in a single interface

class UnifiedTrashBin {
  constructor() {
    this.currentFilter = 'all';
    this.currentSearch = '';
    this.allItems = {
      books: [],
      users: [],
      admins: []
    };
    this.debounceTimer = null;
    this.adminRole = sessionStorage.getItem('adminRole');
    this.isSuperAdmin = this.adminRole === 'super_admin';
  }

  async init() {
    console.log('[Trash Bin] Initializing unified trash bin');
    console.log('[Trash Bin] Admin Role:', this.adminRole);
    
    // Load admin info
    await this.loadAdminInfo();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load initial data
    await this.loadTrash();
  }

  async loadAdminInfo() {
    try {
      const adminId = sessionStorage.getItem('adminId');
      
      if (!adminId) {
        console.warn('[Trash Bin] No adminId in session');
        return;
      }
      
      console.log('[Trash Bin] Loading admin info for ID:', adminId);
      
      const response = await fetch(`/api/admin/${adminId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('[Trash Bin] Failed to load admin info:', response.status);
        return; // Just skip loading admin info, don't fail the whole page
      }
      
      const result = await response.json();
      const adminData = result.data || result;
      
      if (adminData && adminData.fullname) {
        document.getElementById('adminName').textContent = adminData.fullname;
        document.getElementById('adminEmail').textContent = adminData.email || '';
        document.getElementById('adminInitial').textContent = adminData.fullname.charAt(0).toUpperCase();
        console.log('[Trash Bin] Admin info loaded successfully');
      }
    } catch (error) {
      console.error('[Trash Bin] Error loading admin info:', error);
      // Don't redirect or fail - just log the error
      // The page can still function without admin name in header
    }
  }

  setupEventListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.currentSearch = e.target.value;
        this.loadTrash();
      }, 250);
    });

    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Remove active class from all tabs
        filterTabs.forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        e.target.classList.add('active');
        
        this.currentFilter = e.target.dataset.type;
        this.renderTable();
      });
    });

    // Close modal when clicking outside
    const modal = document.getElementById('confirmModal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
  }

  async loadTrash() {
    try {
      console.log('[Trash Bin] Loading trash with filter:', this.currentFilter, 'search:', this.currentSearch);
      
      const params = new URLSearchParams({
        type: this.currentFilter === 'all' ? 'all' : this.currentFilter,
        search: this.currentSearch
      });

      const response = await fetch(`/api/admin/trash?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[Trash Bin] Loaded trash:', result);

      if (result.success) {
        this.allItems = result.data.items;
        this.updateSummary(result.data.summary);
        this.renderTable();
      } else {
        throw new Error(result.message || 'Failed to load trash');
      }
    } catch (error) {
      console.error('[Trash Bin] Error loading trash:', error);
      this.showToast('Error loading trash items: ' + error.message, 'error');
      this.renderEmptyState('Error loading trash items');
    }
  }

  updateSummary(summary) {
    document.getElementById('totalCount').textContent = summary.total || 0;
    document.getElementById('booksCount').textContent = summary.books || 0;
    
    // Only update users/admins counts if elements exist (Super Admin only)
    const usersCountEl = document.getElementById('usersCount');
    const adminsCountEl = document.getElementById('adminsCount');
    
    if (usersCountEl) {
      usersCountEl.textContent = summary.users || 0;
    }
    if (adminsCountEl) {
      adminsCountEl.textContent = summary.admins || 0;
    }
  }

  renderTable() {
    const tbody = document.getElementById('trashTableBody');
    let items = [];

    // Combine items based on current filter
    if (this.currentFilter === 'all') {
      items = [
        ...this.allItems.books || [],
        ...this.allItems.users || [],
        ...this.allItems.admins || []
      ];
    } else if (this.currentFilter === 'book') {
      items = this.allItems.books || [];
    } else if (this.currentFilter === 'user') {
      items = this.allItems.users || [];
    } else if (this.currentFilter === 'admin') {
      items = this.allItems.admins || [];
    }

    // Sort by deleted_at (most recent first)
    items.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));

    if (items.length === 0) {
      this.renderEmptyState();
      return;
    }

    tbody.innerHTML = items.map(item => this.renderRow(item)).join('');
  }

  renderRow(item) {
    const type = item.item_type;
    const typeBadge = `<span class="type-badge type-badge-${type}">${type}</span>`;
    
    let primaryInfo, secondaryInfo, additionalDetails;

    switch (type) {
      case 'book':
        primaryInfo = this.escapeHtml(item.title);
        secondaryInfo = this.escapeHtml(item.author || 'Unknown Author');
        additionalDetails = `
          <div><strong>Category:</strong> ${this.escapeHtml(item.category || 'N/A')}</div>
          <div><strong>ISBN:</strong> ${this.escapeHtml(item.isbn || 'N/A')}</div>
          <div><strong>Copies:</strong> ${item.total_copies || 0}</div>
        `;
        break;
      
      case 'user':
        primaryInfo = this.escapeHtml(item.fullname);
        secondaryInfo = this.escapeHtml(item.email);
        additionalDetails = `
          <div><strong>Student ID:</strong> ${this.escapeHtml(item.student_id)}</div>
          <div><strong>Department:</strong> ${this.escapeHtml(item.department)}</div>
          <div><strong>Year:</strong> ${this.escapeHtml(item.year_level)}</div>
        `;
        break;
      
      case 'admin':
        primaryInfo = this.escapeHtml(item.fullname);
        secondaryInfo = this.escapeHtml(item.email);
        additionalDetails = `
          <div><strong>Role:</strong> ${this.escapeHtml(item.role === 'super_admin' ? 'Super Admin' : 'System Admin')}</div>
          <div><strong>Status:</strong> ${item.is_active ? 'Active' : 'Inactive'}</div>
        `;
        break;
      
      default:
        primaryInfo = 'Unknown';
        secondaryInfo = 'Unknown';
        additionalDetails = 'No details available';
    }

    const deletedAt = this.formatDate(item.deleted_at);
    
    // Check if user can permanently delete (Super Admin only)
    const canPermanentDelete = this.isSuperAdmin;

    return `
      <tr data-id="${item.id}" data-type="${type}">
        <td>${typeBadge}</td>
        <td><strong>${primaryInfo}</strong></td>
        <td>${secondaryInfo}</td>
        <td><small>${additionalDetails}</small></td>
        <td>${deletedAt}</td>
        <td style="text-align: center;">
          <div class="action-buttons">
            <button 
              class="action-btn restore-btn" 
              onclick="trashBin.restore('${type}', ${item.id})"
              title="Restore this ${type}"
            >
              <span class="material-symbols-outlined" style="font-size: 16px;">restore</span>
              Restore
            </button>
            ${canPermanentDelete ? `
              <button 
                class="action-btn delete-btn" 
                onclick="trashBin.permanentDelete('${type}', ${item.id})"
                title="Permanently delete this ${type}"
              >
                <span class="material-symbols-outlined" style="font-size: 16px;">delete_forever</span>
                Delete
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  renderEmptyState(message = null) {
    const tbody = document.getElementById('trashTableBody');
    const filterText = this.currentFilter === 'all' ? 'items' : `${this.currentFilter}s`;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <span class="material-symbols-outlined">delete_outline</span>
          <h3>${message || 'No ' + filterText + ' in trash'}</h3>
          <p>${message ? 'Please try again later' : 'Deleted ' + filterText + ' will appear here'}</p>
        </td>
      </tr>
    `;
  }

  async restore(type, id) {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    
    this.showConfirmModal(
      `Restore ${typeLabel}`,
      `Are you sure you want to restore this ${type}? It will become active again.`,
      async () => {
        try {
          const response = await fetch(`/api/admin/trash/${type}/${id}/restore`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const result = await response.json();

          if (result.success) {
            this.showToast(`${typeLabel} restored successfully`, 'success');
            await this.loadTrash();
          } else {
            throw new Error(result.message || 'Failed to restore');
          }
        } catch (error) {
          console.error('[Trash Bin] Error restoring:', error);
          this.showToast('Error restoring: ' + error.message, 'error');
        }
      },
      false // Not a dangerous action
    );
  }

  async permanentDelete(type, id) {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    
    this.showConfirmModal(
      `Permanently Delete ${typeLabel}`,
      `⚠️ WARNING: This will permanently delete this ${type}. This action CANNOT be undone. Are you absolutely sure?`,
      async () => {
        try {
          const response = await fetch(`/api/admin/trash/${type}/${id}/permanent`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const result = await response.json();

          if (result.success) {
            this.showToast(`${typeLabel} permanently deleted`, 'success');
            await this.loadTrash();
          } else {
            throw new Error(result.message || 'Failed to delete permanently');
          }
        } catch (error) {
          console.error('[Trash Bin] Error deleting permanently:', error);
          this.showToast('Error deleting: ' + error.message, 'error');
        }
      },
      true // Dangerous action
    );
  }

  showConfirmModal(title, message, onConfirm, isDangerous = false) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('modalConfirmBtn');

    modalTitle.textContent = title;
    modalBody.innerHTML = message;

    // Style the confirm button based on action type
    confirmBtn.className = 'modal-btn ' + (isDangerous ? 'modal-btn-danger' : 'modal-btn-confirm');
    confirmBtn.textContent = isDangerous ? 'Delete Permanently' : 'Confirm';

    // Set up the confirm handler
    confirmBtn.onclick = () => {
      onConfirm();
      this.closeModal();
    };

    modal.classList.add('show');
  }

  closeModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');

    toast.className = 'toast ' + type;
    toastIcon.textContent = type === 'success' ? 'check_circle' : 'error';
    toastMessage.textContent = message;

    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
let trashBin;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Trash Bin] Initializing...');
  
  // Note: Authentication is handled by inline script in the HTML pages
  // This script just initializes the trash bin functionality
  
  trashBin = new UnifiedTrashBin();
  await trashBin.init();
  
  console.log('[Trash Bin] Ready');
});

// Make closeModal globally accessible for the Cancel button
function closeModal() {
  if (trashBin) {
    trashBin.closeModal();
  }
}

// Logout function
function showLogoutModal() {
  console.log('[Logout Modal] Triggered');
  if (confirm('Are you sure you want to logout?')) {
    console.log('[Logout Modal] User confirmed logout');
    sessionStorage.clear();
    window.location.href = '/login';
  } else {
    console.log('[Logout Modal] User canceled logout');
  }
}

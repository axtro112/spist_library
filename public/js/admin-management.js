/**
 * Admin Management Module
 * Handles Edit and Delete admin functionality for Super Admin
 * Compatible with SPIST Library Management System
 */

class AdminManagement {
  constructor() {
    this.currentAdminRole = null;
    this.currentAdminId = null;
    this.admins = [];
    this.init();
  }

  init() {
    // Store current admin context
    this.currentAdminRole = window.currentAdminRole || sessionStorage.getItem('adminRole');
    this.currentAdminId = window.currentAdminId || sessionStorage.getItem('adminId');
    
    console.log('[AdminManagement] Initialized', {
      role: this.currentAdminRole,
      id: this.currentAdminId
    });

    // Show Add Admin button only for super admins
    const addBtn = document.getElementById('addAdminBtn');
    if (addBtn && this.currentAdminRole === 'super_admin') {
      addBtn.style.display = 'flex';
    }

    // Setup event delegation for table buttons
    this.setupEventDelegation();
    
    // Setup modal event listeners
    this.setupModalListeners();
  }

  /**
   * Setup event delegation for dynamically created table buttons
   */
  setupEventDelegation() {
    const tbody = document.querySelector('.user-table tbody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const adminId = button.dataset.adminId;
      if (!adminId) return;

      if (button.classList.contains('edit-btn')) {
        this.openEditModal(adminId);
      } else if (button.classList.contains('delete-btn')) {
        this.openDeleteModal(adminId);
      }
    });
  }

  /**
   * Setup modal event listeners
   */
  setupModalListeners() {
    // Edit modal save button
    const editForm = document.getElementById('editAdminForm');
    if (editForm) {
      editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveEditAdmin();
      });
    }

    // Edit modal cancel button
    const editCancelBtn = document.querySelector('#modalEdit .cancel-btn');
    if (editCancelBtn) {
      editCancelBtn.addEventListener('click', () => this.closeEditModal());
    }

    // Delete modal confirm button
    const deleteConfirmBtn = document.querySelector('#modalDelete .delete-confirm-btn');
    if (deleteConfirmBtn) {
      deleteConfirmBtn.addEventListener('click', () => this.confirmDeleteAdmin());
    }

    // Delete modal cancel button
    const deleteCancelBtn = document.querySelector('#modalDelete .cancel-btn');
    if (deleteCancelBtn) {
      deleteCancelBtn.addEventListener('click', () => this.closeDeleteModal());
    }

    // Add Admin modal submit
    const addAdminForm = document.getElementById('addAdminForm');
    if (addAdminForm) {
      addAdminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitAddAdmin();
      });
    }

    // Add Admin modal cancel
    const addAdminCancelBtn = document.getElementById('addAdminCancelBtn');
    if (addAdminCancelBtn) {
      addAdminCancelBtn.addEventListener('click', () => this.closeAddModal());
    }

    // Password visibility toggles (event delegation on the Add Admin modal)
    const addAdminModal = document.getElementById('modalAddAdmin');
    if (addAdminModal) {
      addAdminModal.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-password');
        if (!btn) return;
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        const icon = btn.querySelector('.material-symbols-outlined');
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) icon.textContent = 'visibility_off';
        } else {
          input.type = 'password';
          if (icon) icon.textContent = 'visibility';
        }
      });
    }

    // Add Admin button
    const addAdminBtn = document.getElementById('addAdminBtn');
    if (addAdminBtn) {
      addAdminBtn.addEventListener('click', () => this.openAddModal());
    }

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
        if (e.target.id === 'modalEdit') this.closeEditModal();
        if (e.target.id === 'modalDelete') this.closeDeleteModal();
        if (e.target.id === 'modalAddAdmin') this.closeAddModal();
      }
    });

    // Close modals on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeEditModal();
        this.closeDeleteModal();
        this.closeAddModal();
      }
    });
  }

  /**
   * Load all admins and render table
   */
  async loadAdmins() {
    try {
      console.log('[AdminManagement] Fetching admins from /api/admin');
      const response = await fetchWithCsrf('/api/admin');
      
      if (!response.ok) {
        throw new Error('Failed to fetch admins');
      }

      const result = await response.json();
      this.admins = result.data || [];
      
      console.log('[AdminManagement] Loaded admins:', this.admins.length);
      this.renderAdminsTable();
      
      return this.admins;
    } catch (error) {
      console.error('[AdminManagement] Error loading admins:', error);
      this.showErrorMessage('Failed to load admins. Please refresh the page.');
      throw error;
    }
  }

  /**
   * Render admins table
   */
  renderAdminsTable() {
    const tbody = document.querySelector('.user-table tbody');
    if (!tbody) {
      console.error('[AdminManagement] Table body not found');
      return;
    }

    tbody.innerHTML = '';

    if (this.admins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No admins found</td></tr>';
      return;
    }

    this.admins.forEach((admin) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-admin-id', admin.id);
      
      // Convert role to display format
      const roleDisplay = admin.role === 'super_admin' ? 'Super Admin' : 'System Admin';
      
      // Format date
      const createdDate = new Date(admin.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      tr.innerHTML = `
        <td>${admin.id}</td>
        <td>${this.escapeHtml(admin.fullname || 'N/A')}</td>
        <td>${roleDisplay}</td>
        <td>${this.escapeHtml(admin.email)}</td>
        <td>${createdDate}</td>
        <td>
          ${this.renderActionButtons(admin)}
        </td>
      `;
      
      tbody.appendChild(tr);
    });
  }

  /**
   * Render action buttons based on user role
   */
  renderActionButtons(admin) {
    // Only Super Admins can edit/delete
    if (this.currentAdminRole !== 'super_admin') {
      return '<span style="color:#888;">View Only</span>';
    }

    // Prevent deleting self
    const isSelf = admin.id === parseInt(this.currentAdminId);
    
    return `
      <button class="btn edit-btn" data-admin-id="${admin.id}">
        <i class="fas fa-edit"></i> Edit
      </button>
      <button class="btn delete-btn" data-admin-id="${admin.id}" ${isSelf ? 'disabled title="Cannot delete yourself"' : ''}>
        <i class="fas fa-trash"></i> Delete
      </button>
    `;
  }

  /**
   * Open Add Admin Modal
   */
  openAddModal() {
    const modal = document.getElementById('modalAddAdmin');
    if (!modal) return;

    // Reset form and clear errors
    document.getElementById('addAdminForm').reset();
    this.clearModalError('addAdminError');

    modal.classList.add('show');
    document.body.classList.add('modal-open');
    document.getElementById('addName').focus();
  }

  /**
   * Close Add Admin Modal
   */
  closeAddModal() {
    const modal = document.getElementById('modalAddAdmin');
    if (!modal) return;
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    document.getElementById('addAdminForm').reset();
    this.clearModalError('addAdminError');
    // Reset password fields back to hidden and icons back to 'visibility'
    ['addPassword', 'addConfirmPassword'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.type = 'password';
      const btn = document.querySelector(`.toggle-password[data-target="${id}"]`);
      if (btn) {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'visibility';
      }
    });
  }

  /**
   * Submit Add Admin Form
   */
  async submitAddAdmin() {
    const fullname = document.getElementById('addName').value.trim();
    const email = document.getElementById('addEmail').value.trim();
    const password = document.getElementById('addPassword').value;
    const confirmPassword = document.getElementById('addConfirmPassword').value;
    const role = document.getElementById('addRole').value;

    // Client-side validation
    if (!fullname) {
      this.showModalError('addAdminError', 'Full name is required');
      return;
    }
    if (!email || !this.isValidEmail(email)) {
      this.showModalError('addAdminError', 'A valid email address is required');
      return;
    }
    if (!password || password.length < 8) {
      this.showModalError('addAdminError', 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      this.showModalError('addAdminError', 'Passwords do not match');
      return;
    }

    const submitBtn = document.getElementById('addAdminSubmitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    this.clearModalError('addAdminError');

    try {
      const response = await fetchWithCsrf('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname,
          email,
          password,
          role,
          currentAdminId: this.currentAdminId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data.message ||
          (data.errors && data.errors[0] && data.errors[0].msg) ||
          'Failed to create admin';
        throw new Error(msg);
      }

      this.closeAddModal();
      this.showToast('Admin created successfully', 'success');
      await this.loadAdmins();

    } catch (error) {
      console.error('[AdminManagement] Error creating admin:', error);
      this.showModalError('addAdminError', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Open Edit Modal
   */
  async openEditModal(adminId) {
    const admin = this.admins.find(a => a.id === parseInt(adminId));
    if (!admin) {
      console.error('[AdminManagement] Admin not found:', adminId);
      return;
    }

    console.log('[AdminManagement] Opening edit modal for:', admin);

    // Populate form fields
    document.getElementById('editName').value = admin.fullname || '';
    document.getElementById('editEmail').value = admin.email || '';
    document.getElementById('editRole').value = admin.role || 'system_admin';

    // Store admin ID in modal dataset
    const modal = document.getElementById('modalEdit');
    modal.dataset.adminId = adminId;

    // Clear previous errors
    this.clearModalError('editAdminError');

    // Show modal
    modal.classList.add('show');
    document.body.classList.add('modal-open');

    // Focus first input
    document.getElementById('editName').focus();
  }

  /**
   * Close Edit Modal
   */
  closeEditModal() {
    const modal = document.getElementById('modalEdit');
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    
    // Reset form
    document.getElementById('editAdminForm').reset();
    this.clearModalError('editAdminError');
  }

  /**
   * Save Edit Admin
   */
  async saveEditAdmin() {
    const modal = document.getElementById('modalEdit');
    const adminId = modal.dataset.adminId;
    
    const fullname = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const role = document.getElementById('editRole').value;

    // Validation
    if (!fullname) {
      this.showModalError('editAdminError', 'Full name is required');
      return;
    }

    if (!email) {
      this.showModalError('editAdminError', 'Email is required');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showModalError('editAdminError', 'Please enter a valid email');
      return;
    }

    // Disable save button during request
    const submitBtn = document.querySelector('#editAdminForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const response = await fetchWithCsrf(`/api/admin/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname,
          email,
          role,
          currentAdminId: this.currentAdminId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update admin');
      }

      console.log('[AdminManagement] Admin updated successfully');
      
      // Show success message
      this.showSuccessMessage('Admin updated successfully');
      
      // Close modal
      this.closeEditModal();
      
      // Reload admin list
      await this.loadAdmins();
      
    } catch (error) {
      console.error('[AdminManagement] Error updating admin:', error);
      this.showModalError('editAdminError', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Open Delete Modal
   */
  openDeleteModal(adminId) {
    const admin = this.admins.find(a => a.id === parseInt(adminId));
    if (!admin) {
      console.error('[AdminManagement] Admin not found:', adminId);
      return;
    }

    console.log('[AdminManagement] Opening delete modal for:', admin);

    // Update modal content
    const modalContent = document.querySelector('#modalDelete .modal-content p');
    modalContent.innerHTML = `Are you sure you want to delete <strong>${this.escapeHtml(admin.fullname)}</strong> (${this.escapeHtml(admin.email)})?<br><br>This action cannot be undone.`;

    // Store admin ID in modal dataset
    const modal = document.getElementById('modalDelete');
    modal.dataset.adminId = adminId;

    // Show modal
    modal.classList.add('show');
    document.body.classList.add('modal-open');
  }

  /**
   * Close Delete Modal
   */
  closeDeleteModal() {
    const modal = document.getElementById('modalDelete');
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  /**
   * Confirm Delete Admin
   */
  async confirmDeleteAdmin() {
    const modal = document.getElementById('modalDelete');
    const adminId = modal.dataset.adminId;

    // Disable delete button during request
    const deleteBtn = document.querySelector('#modalDelete .delete-confirm-btn');
    const originalText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
      const response = await fetchWithCsrf(`/api/admin/${adminId}?currentAdminId=${this.currentAdminId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete admin');
      }

      console.log('[AdminManagement] Admin deleted successfully');
      
      // Show success message
      this.showSuccessMessage('Admin deleted successfully');
      
      // Close modal
      this.closeDeleteModal();
      
      // Reload admin list
      await this.loadAdmins();
      
    } catch (error) {
      console.error('[AdminManagement] Error deleting admin:', error);
      this.showErrorMessage(error.message);
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = originalText;
    }
  }

  /**
   * Helper: Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Helper: Validate email format
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Helper: Show modal error message
   */
  showModalError(errorElementId, message) {
    const errorDiv = document.getElementById(errorElementId);
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Helper: Clear modal error message
   */
  clearModalError(errorElementId) {
    const errorDiv = document.getElementById(errorElementId);
    if (errorDiv) {
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
    }
  }

  /**
   * Helper: Show toast notification
   */
  showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    if (!toast) {
      if (type === 'success') alert(message);
      else alert('Error: ' + message);
      return;
    }
    toast.textContent = message;
    toast.style.background = type === 'success' ? '#4caf50' : '#f44336';
    toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  /**
   * Helper: Show success message (toast/notification)
   */
  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }

  /**
   * Helper: Show error message (toast/notification)
   */
  showErrorMessage(message) {
    this.showToast('Error: ' + message, 'error');
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManagement();
  });
} else {
  window.adminManager = new AdminManagement();
}

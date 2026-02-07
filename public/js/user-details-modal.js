// User Details Modal - Shows comprehensive user information with active borrowings
// Global function: openUserModal(userId)

class UserDetailsModal {
  constructor() {
    this.overlay = null;
    this.currentUserId = null;
    this.init();
  }

  init() {
    // Create modal HTML structure
    const modalHTML = `
      <div class="user-details-overlay" id="userDetailsOverlay">
        <div class="user-details-modal">
          <div class="user-details-header" id="userDetailsHeader">
            <div class="user-avatar" id="userAvatar">?</div>
            <div class="user-header-info">
              <h2 id="userFullName">Loading...</h2>
              <div class="user-header-subtitle" id="userHeaderSubtitle">
                <span class="material-symbols-outlined">badge</span>
                <span>Student ID</span>
              </div>
            </div>
            <button class="user-details-close" id="userDetailsClose" aria-label="Close">×</button>
          </div>
          <div class="user-details-body" id="userDetailsBody">
            <div class="user-details-loading">
              <span class="material-symbols-outlined">progress_activity</span>
              <p>Loading user information...</p>
            </div>
          </div>
          <div class="user-details-footer">
            <button class="user-details-btn user-details-btn-secondary" id="userDetailsCloseBtn">
              <span class="material-symbols-outlined">close</span>
              Close
            </button>
            <button class="user-details-btn user-details-btn-primary" id="userDetailsGoToUsers" style="display: none;">
              <span class="material-symbols-outlined">group</span>
              Go to Users
            </button>
          </div>
        </div>
      </div>
    `;

    // Inject modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Get references
    this.overlay = document.getElementById('userDetailsOverlay');
    this.header = document.getElementById('userDetailsHeader');
    this.body = document.getElementById('userDetailsBody');
    this.avatar = document.getElementById('userAvatar');
    this.fullName = document.getElementById('userFullName');
    this.subtitle = document.getElementById('userHeaderSubtitle');
    this.closeBtn = document.getElementById('userDetailsClose');
    this.closeBtnFooter = document.getElementById('userDetailsCloseBtn');
    this.goToUsersBtn = document.getElementById('userDetailsGoToUsers');

    // Bind events
    this.bindEvents();
  }

  bindEvents() {
    // Close button clicks
    this.closeBtn.addEventListener('click', () => this.close());
    this.closeBtnFooter.addEventListener('click', () => this.close());

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.close();
      }
    });

    // Go to Users button
    this.goToUsersBtn.addEventListener('click', () => this.handleGoToUsers());
  }

  // Deep linking is now handled at page level (admin-users.html, super-admin-users.html)
  // This prevents auto-opening modal on every refresh

  async open(userId) {
    // CRITICAL: Validate userId is provided
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('[User Details Modal] ✗ CRITICAL: Invalid userId provided:', userId);
      alert('Unable to open user details: User ID is missing.');
      return;
    }

    console.log('[User Details Modal] � OPENING MODAL');
    console.log('[User Details Modal] - Requested userId:', userId);
    console.log('[User Details Modal] - Current state before clearing:', {
      currentUserId: this.currentUserId,
      avatarText: this.avatar?.textContent,
      fullNameText: this.fullName?.textContent
    });
    
    this.currentUserId = userId;
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show loading state
    this.showLoading();

    try {
      console.log('[User Details Modal] 🔍 Fetching FRESH data for userId:', userId);
      // Fetch user info and borrowings
      const [userData, borrowingsData] = await Promise.all([
        this.fetchUserInfo(userId),
        this.fetchUserBorrowings(userId)
      ]);

      console.log('[User Details Modal] ✓ Data loaded successfully:', {
        received_student_id: userData.student_id,
        received_fullname: userData.fullname,
        borrowings_count: borrowingsData.length
      });

      this.renderContent(userData, borrowingsData);
      
      console.log('[User Details Modal] ✓ Content rendered successfully');
    } catch (error) {
      console.error('[User Details Modal] ✗ Error:', error);
      this.renderError(error.message);
    }
  }

  async fetchUserInfo(userId) {
    const response = await fetchWithCsrf(`/api/students/${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user information');
    }
    const result = await response.json();
    return result.data || result;
  }

  async fetchUserBorrowings(userId) {
    const response = await fetchWithCsrf(`/api/students/borrowing-history/${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch borrowing history');
    }
    const result = await response.json();
    const borrowings = result.data || result;

    // Filter only active (borrowed) books
    return borrowings.filter(book => book.status === 'borrowed');
  }

  renderContent(user, borrowings) {
    console.log('[User Details Modal] 🎨 RENDERING CONTENT');
    console.log('[User Details Modal] - User object:', {
      student_id: user.student_id,
      fullname: user.fullname,
      email: user.email
    });
    
    // Update header
    const initials = this.getInitials(user.fullname);
    console.log('[User Details Modal] - Computed initials:', initials, 'from name:', user.fullname);
    
    this.avatar.textContent = initials;
    this.fullName.textContent = user.fullname;
    this.subtitle.innerHTML = `
      <span class="material-symbols-outlined">badge</span>
      <span>${user.student_id}</span>
    `;
    
    console.log('[User Details Modal] - Header updated: avatar=' + initials + ', fullname=' + user.fullname + ', student_id=' + user.student_id);

    // Render body content
    this.body.innerHTML = `
      <div class="user-details-grid">
        <!-- Left Column: User Information -->
        <div class="user-info-card">
          <h3>
            <span class="material-symbols-outlined">person</span>
            Personal Information
          </h3>
          <div class="user-info-field">
            <span class="user-info-label">Student ID</span>
            <span class="user-info-value">${this.escapeHtml(user.student_id)}</span>
          </div>
          <div class="user-info-field">
            <span class="user-info-label">Full Name</span>
            <span class="user-info-value">${this.escapeHtml(user.fullname)}</span>
          </div>
          <div class="user-info-field">
            <span class="user-info-label">Email</span>
            <span class="user-info-value">${this.escapeHtml(user.email || 'Not provided')}</span>
          </div>
          <div class="user-info-field">
            <span class="user-info-label">Course / Department</span>
            <span class="user-info-value">${this.escapeHtml(user.course || user.department || 'N/A')}</span>
          </div>
          <div class="user-info-field">
            <span class="user-info-label">Year Level</span>
            <span class="user-info-value">${this.escapeHtml(user.year_level || 'N/A')}</span>
          </div>
          <div class="user-info-field">
            <span class="user-info-label">Contact Number</span>
            <span class="user-info-value">${this.escapeHtml(user.contact_number || 'Not provided')}</span>
          </div>
          <div class="user-info-field">
            <span class="user-info-label">Status</span>
            <span class="user-info-value">
              <span class="user-status-badge ${user.status === 'active' ? 'active' : 'inactive'}">
                ${this.escapeHtml(user.status || 'Unknown')}
              </span>
            </span>
          </div>
        </div>

        <!-- Right Column: Active Borrowings -->
        <div class="user-borrowings-card">
          <h3>
            <span class="material-symbols-outlined">menu_book</span>
            Active Borrowings
            ${borrowings.length > 0 ? `<span class="borrowing-count">${borrowings.length}</span>` : ''}
          </h3>
          ${this.renderBorrowings(borrowings)}
        </div>
      </div>
    `;

    // Show "Go to Users" button if not on users page
    const isOnUsersPage = window.location.pathname.includes('users');
    if (!isOnUsersPage) {
      this.goToUsersBtn.style.display = 'flex';
    }
  }

  renderBorrowings(borrowings) {
    if (borrowings.length === 0) {
      return `
        <div class="borrowings-empty">
          <span class="material-symbols-outlined">check_circle</span>
          <p>No active borrowings</p>
        </div>
      `;
    }

    return borrowings.map(book => {
      const dueDate = new Date(book.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = dueDate < today;
      const borrowDate = new Date(book.borrow_date);

      return `
        <div class="borrowing-item ${isOverdue ? 'overdue' : ''}">
          <div class="borrowing-title">${this.escapeHtml(book.title)}</div>
          <div class="borrowing-meta">
            <div class="borrowing-meta-item">
              <span class="material-symbols-outlined">calendar_today</span>
              <span>Borrowed: ${this.formatDate(borrowDate)}</span>
            </div>
            <div class="borrowing-meta-item">
              <span class="material-symbols-outlined">event</span>
              <span>Due: ${this.formatDate(dueDate)}</span>
            </div>
            <span class="borrowing-status ${isOverdue ? 'overdue' : 'borrowed'}">
              ${isOverdue ? 'Overdue' : 'Borrowed'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderError(message) {
    this.body.innerHTML = `
      <div class="user-details-error">
        <span class="material-symbols-outlined">error</span>
        <div>
          <strong>Error loading user details</strong>
          <p>${this.escapeHtml(message)}</p>
        </div>
      </div>
    `;
  }

  showLoading() {
    this.avatar.textContent = '?';
    this.fullName.textContent = 'Loading...';
    this.subtitle.innerHTML = `
      <span class="material-symbols-outlined">badge</span>
      <span>Student ID</span>
    `;
    this.body.innerHTML = `
      <div class="user-details-loading">
        <span class="material-symbols-outlined">progress_activity</span>
        <p>Loading user information...</p>
      </div>
    `;
    this.goToUsersBtn.style.display = 'none';
  }

  handleGoToUsers() {
    const userRole = sessionStorage.getItem('userRole');
    const adminRole = sessionStorage.getItem('adminRole');

    let usersPageUrl = '/admin-users';
    if (userRole === 'admin' && adminRole === 'super_admin') {
      usersPageUrl = '/super-admin-users';
    }

    const url = `${usersPageUrl}?highlight=${encodeURIComponent(this.currentUserId)}`;
    window.location.href = url;
  }

  close() {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.currentUserId = null;
  }

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  formatDate(date) {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Global function to open modal
function openUserModal(userId) {
  console.log('[openUserModal] 🌐 Called with userId:', userId);
  if (window.userDetailsModal) {
    console.log('[openUserModal] ✓ Delegating to userDetailsModal.open()');
    window.userDetailsModal.open(userId);
  } else {
    console.error('[openUserModal] ✗ Modal not initialized - initializing now');
    // Initialize immediately if not already done
    window.userDetailsModal = new UserDetailsModal();
    window.userDetailsModal.open(userId);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (!window.userDetailsModal) {
    window.userDetailsModal = new UserDetailsModal();
    console.log('[User Details Modal] Initialized - Use openUserModal(userId) to open');
  }
});

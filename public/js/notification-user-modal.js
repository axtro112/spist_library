/**
 * Notification User Details Modal
 * Opens when admin clicks a notification to show student/user details
 * Matches Login/Signup green theme and styling
 */

class NotificationUserModal {
  constructor() {
    this.modal = null;
    this.currentStudentId = null;
    this.currentNotificationId = null;
    this.init();
  }s

  init() {
    this.createModalHTML();
    this.bindEvents();
  }

  createModalHTML() {
    if (document.getElementById('notifUserModal')) return;

    const modalHTML = `
      <div id="notifUserModal" class="notif-user-modal-overlay" style="display: none;">
        <div class="notif-user-modal-container">
          <!-- Header -->
          <div class="notif-user-modal-header">
            <h2 class="notif-user-modal-title">Student Details</h2>
            <button class="notif-user-modal-close" aria-label="Close modal">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Loading State -->
          <div id="notifUserModalLoading" class="notif-user-modal-loading">
            <div class="notif-user-modal-spinner"></div>
            <p>Loading student information...</p>
          </div>

          <!-- Error State -->
          <div id="notifUserModalError" class="notif-user-modal-error" style="display: none;">
            <span class="material-symbols-outlined">error</span>
            <p class="notif-user-error-text">Failed to load student details.</p>
            <button id="notifUserRetryBtn" class="notif-user-retry-btn">Try Again</button>
          </div>

          <!-- Content -->
          <div id="notifUserModalContent" class="notif-user-modal-content" style="display: none;">
            <!-- Student Info Section -->
            <div class="notif-user-section">
              <h3 class="notif-user-section-title">
                <span class="material-symbols-outlined">person</span>
                Student Information
              </h3>
              <div class="notif-user-info-grid">
                <div class="notif-user-info-item">
                  <label>Student ID</label>
                  <p id="userModalStudentId">-</p>
                </div>
                <div class="notif-user-info-item">
                  <label>Full Name</label>
                  <p id="userModalFullname">-</p>
                </div>
                <div class="notif-user-info-item">
                  <label>Email</label>
                  <p id="userModalEmail">-</p>
                </div>
                <div class="notif-user-info-item">
                  <label>Department</label>
                  <p id="userModalDepartment">-</p>
                </div>
                <div class="notif-user-info-item">
                  <label>Year Level</label>
                  <p id="userModalYearLevel">-</p>
                </div>
                <div class="notif-user-info-item">
                  <label>Student Type</label>
                  <p id="userModalStudentType">-</p>
                </div>
                <div class="notif-user-info-item">
                  <label>Contact Number</label>
                  <p id="userModalContact">-</p>
                </div>
                <div class="notif-user-info-item">
                  <label>Status</label>
                  <p id="userModalStatus" class="notif-user-status-badge">-</p>
                </div>
              </div>
            </div>

            <!-- Borrowing Info Section (if available) -->
            <div id="borrowingInfoSection" class="notif-user-section" style="display: none;">
              <h3 class="notif-user-section-title">
                <span class="material-symbols-outlined">menu_book</span>
                Related Borrowing Information
              </h3>
              <div class="notif-user-borrowing-card">
                <div class="notif-user-book-title">
                  <span class="material-symbols-outlined">book</span>
                  <h4 id="borrowingBookTitle">-</h4>
                </div>
                <div class="notif-user-borrowing-details">
                  <div class="notif-user-detail-row">
                    <span class="label">Borrowed Date:</span>
                    <span id="borrowingBorrowDate">-</span>
                  </div>
                  <div class="notif-user-detail-row">
                    <span class="label">Due Date:</span>
                    <span id="borrowingDueDate">-</span>
                  </div>
                  <div class="notif-user-detail-row">
                    <span class="label">Status:</span>
                    <span id="borrowingStatus" class="notif-borrowing-status-badge">-</span>
                  </div>
                  <div id="overdueInfo" class="notif-user-overdue-alert" style="display: none;">
                    <span class="material-symbols-outlined">warning</span>
                    <span id="overdueDays">This book is overdue</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div id="notifUserModalFooter" class="notif-user-modal-footer" style="display: none;">
            <button id="notifUserGoToUsersBtn" class="notif-user-btn notif-user-btn-primary">
              <span class="material-symbols-outlined">group</span>
              Go to Users Page
            </button>
            <button id="notifUserCloseBtn" class="notif-user-btn notif-user-btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('notifUserModal');
  }

  bindEvents() {
    const closeBtn = document.querySelector('.notif-user-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.style.display !== 'none') {
        this.close();
      }
    });

    const retryBtn = document.getElementById('notifUserRetryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (this.currentStudentId) {
          this.open(this.currentStudentId, this.currentNotificationId);
        }
      });
    }

    const goToUsersBtn = document.getElementById('notifUserGoToUsersBtn');
    if (goToUsersBtn) {
      goToUsersBtn.addEventListener('click', () => {
        this.goToUsersPage();
      });
    }

    const closeFooterBtn = document.getElementById('notifUserCloseBtn');
    if (closeFooterBtn) {
      closeFooterBtn.addEventListener('click', () => this.close());
    }
  }

  async open(studentId, notificationData = {}) {
    // CRITICAL: Validate studentId is provided
    if (!studentId || studentId === 'undefined' || studentId === 'null') {
      console.error('[Notif User Modal] ✗ CRITICAL: Invalid studentId provided:', studentId);
      console.error('[Notif User Modal] Notification data:', notificationData);
      alert('Unable to open user details: Student ID is missing.');
      return;
    }

    console.log('[Notif User Modal] � OPENING MODAL (NotificationUserModal version)');
    console.log('[Notif User Modal] - Requested studentId:', studentId);
    console.log('[Notif User Modal] - Notification data:', {
      id: notificationData.id,
      type: notificationData.type,
      target_id: notificationData.target_id,
      book_title: notificationData.book_title
    });
    
    // IMPORTANT: Clear any previous student data to avoid showing stale data
    this.currentStudentId = studentId;
    this.currentNotificationId = notificationData.id || null;

    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    this.showLoading();

    try {
      console.log('[Notif User Modal] 🔍 Fetching FRESH student details for studentId:', studentId);
      const studentData = await this.fetchStudentDetails(studentId);
      console.log('[Notif User Modal] ✓ Student data loaded successfully:', {
        received_student_id: studentData.student_id,
        received_fullname: studentData.fullname,
        email: studentData.email
      });
      
      this.renderStudentInfo(studentData);
      
      console.log('[Notif User Modal] ✓ Student info rendered');

      if (notificationData.borrowing_id || notificationData.book_title) {
        await this.renderBorrowingInfo(notificationData, studentData);
      }

      this.showContent();
      console.log('[Notif User Modal] ✓ Modal display complete');
    } catch (error) {
      console.error('[Notif User Modal] ✗ Error:', error);
      this.showError(error.message || 'Failed to load student details.');
    }
  }

  async fetchStudentDetails(studentId) {
    console.log('[Notif User Modal] 🌐 Calling API: /api/students/' + studentId);
    const response = await fetchWithCsrf(`/api/students/${encodeURIComponent(studentId)}`);
    
    if (!response.ok) {
      console.error('[Notif User Modal] API Error:', response.status, response.statusText);
      if (response.status === 404) {
        throw new Error('Student not found.');
      } else if (response.status === 403) {
        throw new Error('Access denied.');
      }
      throw new Error(`Server error (${response.status})`);
    }

    const data = await response.json();
    console.log('[Notif User Modal] API Response:', data);
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch student details.');
    }

    return data.data;
  }

  renderStudentInfo(student) {
    // Update modal header with student name (CRITICAL: was missing this)
    const modalTitle = document.querySelector('.notif-user-modal-title');
    if (modalTitle) {
      modalTitle.textContent = student.fullname || 'Student Details';
      console.log('[Notif User Modal] Updated header title to:', student.fullname);
    }
    
    // Update body content fields
    document.getElementById('userModalStudentId').textContent = student.student_id || '-';
    document.getElementById('userModalFullname').textContent = student.fullname || '-';
    document.getElementById('userModalEmail').textContent = student.email || '-';
    document.getElementById('userModalDepartment').textContent = student.department || '-';
    document.getElementById('userModalYearLevel').textContent = student.year_level || '-';
    document.getElementById('userModalStudentType').textContent = student.student_type || '-';
    document.getElementById('userModalContact').textContent = student.contact_number || '-';
    
    const statusBadge = document.getElementById('userModalStatus');
    statusBadge.textContent = student.status || 'Active';
    statusBadge.className = 'notif-user-status-badge';
    if (student.status === 'Active') {
      statusBadge.classList.add('status-active');
    } else {
      statusBadge.classList.add('status-inactive');
    }
  }

  async renderBorrowingInfo(notificationData, studentData) {
    const section = document.getElementById('borrowingInfoSection');
    
    if (notificationData.book_title) {
      document.getElementById('borrowingBookTitle').textContent = notificationData.book_title;
    }

    if (notificationData.borrowing_id) {
      try {
        const response = await fetchWithCsrf(`/api/book-borrowings/detail/${notificationData.borrowing_id}`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const borrowing = data.data;
          
          document.getElementById('borrowingBorrowDate').textContent = this.formatDate(borrowing.borrow_date);
          document.getElementById('borrowingDueDate').textContent = this.formatDate(borrowing.due_date);
          
          const statusBadge = document.getElementById('borrowingStatus');
          statusBadge.textContent = this.formatStatus(borrowing.status);
          statusBadge.className = 'notif-borrowing-status-badge';
          statusBadge.classList.add(`status-${borrowing.status.toLowerCase()}`);
          
          if (borrowing.status === 'borrowed') {
            const dueDate = new Date(borrowing.due_date);
            const today = new Date();
            if (dueDate < today) {
              const overdueDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
              document.getElementById('overdueDays').textContent = `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`;
              document.getElementById('overdueInfo').style.display = 'flex';
            }
          }
        }
      } catch (error) {
        console.error('[Notif User Modal] Error fetching borrowing details:', error);
      }
    } else {
      if (notificationData.due_date) {
        document.getElementById('borrowingDueDate').textContent = this.formatDate(notificationData.due_date);
      }
      if (notificationData.status) {
        const statusBadge = document.getElementById('borrowingStatus');
        statusBadge.textContent = this.formatStatus(notificationData.status);
        statusBadge.className = 'notif-borrowing-status-badge';
        statusBadge.classList.add(`status-${notificationData.status.toLowerCase()}`);
      }
    }

    section.style.display = 'block';
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatStatus(status) {
    const statusMap = {
      'borrowed': 'Borrowed',
      'returned': 'Returned',
      'overdue': 'Overdue',
      'pending': 'Pending'
    };
    return statusMap[status] || status;
  }

  goToUsersPage() {
    const userRole = sessionStorage.getItem('userRole');
    const adminRole = sessionStorage.getItem('adminRole');
    
    let usersPageUrl;
    if (userRole === 'admin' && adminRole === 'super_admin') {
      usersPageUrl = '/super-admin-users';
    } else {
      usersPageUrl = '/admin-users';
    }

    const url = `${usersPageUrl}?highlight=${encodeURIComponent(this.currentStudentId)}`;
    
    this.close();
    window.location.href = url;
  }

  showLoading() {
    document.getElementById('notifUserModalLoading').style.display = 'block';
    document.getElementById('notifUserModalError').style.display = 'none';
    document.getElementById('notifUserModalContent').style.display = 'none';
    document.getElementById('notifUserModalFooter').style.display = 'none';
  }

  showContent() {
    document.getElementById('notifUserModalLoading').style.display = 'none';
    document.getElementById('notifUserModalError').style.display = 'none';
    document.getElementById('notifUserModalContent').style.display = 'block';
    document.getElementById('notifUserModalFooter').style.display = 'flex';
  }

  showError(message) {
    document.getElementById('notifUserModalLoading').style.display = 'none';
    document.getElementById('notifUserModalError').style.display = 'block';
    document.getElementById('notifUserModalContent').style.display = 'none';
    document.getElementById('notifUserModalFooter').style.display = 'none';
    
    document.querySelector('.notif-user-error-text').textContent = message;
  }

  close() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
      
      this.currentStudentId = null;
      this.currentNotificationId = null;
      
      document.getElementById('borrowingInfoSection').style.display = 'none';
      document.getElementById('overdueInfo').style.display = 'none';
    }
  }
}

// Initialize modal when DOM is ready
let notificationUserModal;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    notificationUserModal = new NotificationUserModal();
    window.notificationUserModal = notificationUserModal;
  });
} else {
  notificationUserModal = new NotificationUserModal();
  window.notificationUserModal = notificationUserModal;
}

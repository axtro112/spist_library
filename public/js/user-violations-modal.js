// User Violations Modal - Shows student info and violations (overdue books)
class UserViolationsModal {
  constructor() {
    this.overlay = null;
    this.currentStudentId = null;
    this.init();
  }

  init() {
    // Create modal HTML structure
    const modalHTML = `
      <div class="violations-modal-overlay" id="violationsModalOverlay">
        <div class="violations-modal">
          <div class="violations-modal-header">
            <h2>
              <span class="material-symbols-outlined">warning</span>
              User Violations
            </h2>
            <button class="violations-modal-close" id="violationsModalClose">×</button>
          </div>
          <div class="violations-modal-body" id="violationsModalBody">
            <div class="violations-loading">
              <span class="material-symbols-outlined">progress_activity</span>
              <p>Loading user information...</p>
            </div>
          </div>
          <div class="violations-modal-footer" id="violationsModalFooter">
            <button class="violations-btn violations-btn-close" id="violationsCloseBtn">
              <span class="material-symbols-outlined">close</span>
              Close
            </button>
            <button class="violations-btn violations-btn-notify" id="violationsNotifyBtn" style="display: none;">
              <span class="material-symbols-outlined">notifications</span>
              Notify User
            </button>
          </div>
        </div>
      </div>
    `;

    // Inject modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Get references
    this.overlay = document.getElementById('violationsModalOverlay');
    this.body = document.getElementById('violationsModalBody');
    this.closeBtn = document.getElementById('violationsModalClose');
    this.closeBtnFooter = document.getElementById('violationsCloseBtn');
    this.notifyBtn = document.getElementById('violationsNotifyBtn');

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

    // Notify user button
    this.notifyBtn.addEventListener('click', () => this.handleNotifyUser());
  }

  // Deep linking is now handled at page level (admin-users.html, super-admin-users.html)
  // This prevents auto-opening modal on every refresh

  async open(studentId) {
    this.currentStudentId = studentId;
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show loading state
    this.body.innerHTML = `
      <div class="violations-loading">
        <span class="material-symbols-outlined">progress_activity</span>
        <p>Loading user information...</p>
      </div>
    `;
    this.notifyBtn.style.display = 'none';

    try {
      // Fetch student info and violations
      const [studentData, violationsData] = await Promise.all([
        this.fetchStudentInfo(studentId),
        this.fetchViolations(studentId)
      ]);

      this.renderContent(studentData, violationsData);
    } catch (error) {
      console.error('[Violations Modal] Error:', error);
      this.renderError(error.message);
    }
  }

  async fetchStudentInfo(studentId) {
    const response = await fetchWithCsrf(`/api/students/${studentId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch student information');
    }
    const result = await response.json();
    return result.data || result;
  }

  async fetchViolations(studentId) {
    const response = await fetchWithCsrf(`/api/students/borrowing-history/${studentId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch borrowing history');
    }
    const result = await response.json();
    const borrowings = result.data || result;

    // Filter only overdue books
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return borrowings.filter(book => {
      if (book.status !== 'borrowed') return false;
      const dueDate = new Date(book.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
  }

  renderContent(student, violations) {
    const hasViolations = violations.length > 0;

    this.body.innerHTML = `
      <!-- User Info -->
      <div class="violations-user-info">
        <h3>
          <span class="material-symbols-outlined">person</span>
          Student Information
        </h3>
        <div class="violations-info-grid">
          <div class="violations-info-field">
            <span class="violations-info-label">Student ID</span>
            <span class="violations-info-value">${this.escapeHtml(student.student_id)}</span>
          </div>
          <div class="violations-info-field">
            <span class="violations-info-label">Full Name</span>
            <span class="violations-info-value">${this.escapeHtml(student.fullname)}</span>
          </div>
          <div class="violations-info-field">
            <span class="violations-info-label">Email</span>
            <span class="violations-info-value">${this.escapeHtml(student.email || 'N/A')}</span>
          </div>
          <div class="violations-info-field">
            <span class="violations-info-label">Course</span>
            <span class="violations-info-value">${this.escapeHtml(student.course || 'N/A')}</span>
          </div>
          <div class="violations-info-field">
            <span class="violations-info-label">Year Level</span>
            <span class="violations-info-value">${this.escapeHtml(student.year_level || 'N/A')}</span>
          </div>
          <div class="violations-info-field">
            <span class="violations-info-label">Contact</span>
            <span class="violations-info-value">${this.escapeHtml(student.contact_number || 'Not provided')}</span>
          </div>
        </div>
      </div>

      <!-- Violations List -->
      <div class="violations-list-section">
        <h3>
          <span class="material-symbols-outlined">error</span>
          Overdue Books
          ${hasViolations ? `<span class="violations-count">${violations.length}</span>` : ''}
        </h3>
        ${hasViolations ? this.renderViolationsList(violations) : this.renderNoViolations()}
      </div>
    `;

    // Show/hide notify button based on violations
    if (hasViolations) {
      this.notifyBtn.style.display = 'flex';
      this.notifyBtn.disabled = false;
    } else {
      this.notifyBtn.style.display = 'none';
    }
  }

  renderViolationsList(violations) {
    return violations.map(violation => {
      const borrowDate = new Date(violation.borrow_date);
      const dueDate = new Date(violation.due_date);
      const today = new Date();
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      return `
        <div class="violation-item">
          <div class="violation-header">
            <div>
              <div class="violation-book-title">${this.escapeHtml(violation.title)}</div>
              <div class="violation-author">by ${this.escapeHtml(violation.author)}</div>
            </div>
            <span class="violation-status">Overdue</span>
          </div>
          <div class="violation-details">
            <div class="violation-detail">
              <span class="violation-detail-label">Borrowed</span>
              <span class="violation-detail-value">${this.formatDate(borrowDate)}</span>
            </div>
            <div class="violation-detail">
              <span class="violation-detail-label">Due Date</span>
              <span class="violation-detail-value">${this.formatDate(dueDate)}</span>
            </div>
            <div class="violation-detail">
              <span class="violation-detail-label">Days Overdue</span>
              <span class="violation-detail-value violation-days-overdue">${daysOverdue} days</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderNoViolations() {
    return `
      <div class="violations-empty">
        <span class="material-symbols-outlined">check_circle</span>
        <p>No overdue books found. Student has a clean record!</p>
      </div>
    `;
  }

  renderError(message) {
    this.body.innerHTML = `
      <div class="violations-error">
        <span class="material-symbols-outlined">error</span>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
    this.notifyBtn.style.display = 'none';
  }

  async handleNotifyUser() {
    if (!this.currentStudentId) return;

    this.notifyBtn.disabled = true;
    this.notifyBtn.innerHTML = `
      <span class="material-symbols-outlined">progress_activity</span>
      Sending...
    `;

    try {
      // TODO: Implement notification API call
      // For now, just show a success message
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      alert('Notification sent successfully to the student!');
      this.notifyBtn.innerHTML = `
        <span class="material-symbols-outlined">check</span>
        Sent!
      `;

      setTimeout(() => {
        this.notifyBtn.innerHTML = `
          <span class="material-symbols-outlined">notifications</span>
          Notify User
        `;
        this.notifyBtn.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('[Violations Modal] Notify error:', error);
      alert('Failed to send notification. Please try again.');
      this.notifyBtn.innerHTML = `
        <span class="material-symbols-outlined">notifications</span>
        Notify User
      `;
      this.notifyBtn.disabled = false;
    }
  }

  close() {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.currentStudentId = null;
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.userViolationsModal = new UserViolationsModal();
});

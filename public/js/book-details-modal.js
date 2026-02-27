// Book Details Modal - Shows comprehensive book information with borrowing overview
// Global function: openBookModal(bookId)

class BookDetailsModal {
  constructor() {
    this.overlay = null;
    this.currentBookId = null;
    this.init();
  }

  init() {
    // Create modal HTML structure
    const modalHTML = `
      <div class="book-details-overlay" id="bookDetailsOverlay">
        <div class="book-details-modal">
          <div class="book-details-header" id="bookDetailsHeader">
            <div class="book-icon">
              <span class="material-symbols-outlined">book</span>
            </div>
            <div class="book-header-info">
              <h2 id="bookTitle">Loading...</h2>
              <div class="book-header-subtitle" id="bookAuthor">
                <span class="material-symbols-outlined">person</span>
                <span>Author</span>
              </div>
            </div>
            <button class="book-details-close" id="bookDetailsClose" aria-label="Close">×</button>
          </div>
          <div class="book-details-body" id="bookDetailsBody">
            <div class="book-details-loading">
              <span class="material-symbols-outlined">progress_activity</span>
              <p>Loading book information...</p>
            </div>
          </div>
          <div class="book-details-footer">
            <button class="book-details-btn book-details-btn-secondary" id="bookDetailsCloseBtn">
              <span class="material-symbols-outlined">close</span>
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    // Inject modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Get references
    this.overlay = document.getElementById('bookDetailsOverlay');
    this.header = document.getElementById('bookDetailsHeader');
    this.body = document.getElementById('bookDetailsBody');
    this.title = document.getElementById('bookTitle');
    this.author = document.getElementById('bookAuthor');
    this.closeBtn = document.getElementById('bookDetailsClose');
    this.closeBtnFooter = document.getElementById('bookDetailsCloseBtn');

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
  }

  async open(bookId) {
    // Validate bookId is provided
    if (!bookId || bookId === 'undefined' || bookId === 'null') {
      console.error('[Book Details Modal] ✗ Invalid bookId provided:', bookId);
      alert('Unable to open book details: Book ID is missing.');
      return;
    }

    console.log('[Book Details Modal] Opening modal for book:', bookId);
    
    this.currentBookId = bookId;
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show loading state
    this.showLoading();

    // Fetch and render data
    await this.fetchBookDetails();
  }

  close() {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.currentBookId = null;
  }

  showLoading() {
    this.body.innerHTML = `
      <div class="book-details-loading">
        <span class="material-symbols-outlined rotating">progress_activity</span>
        <p>Loading book information...</p>
      </div>
    `;
  }

  async fetchBookDetails() {
    try {
      console.log(`[Book Details Modal] Fetching details for book ID: ${this.currentBookId}`);
      
      const response = await fetchWithCsrf(`/api/admin/books/${this.currentBookId}/details`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const data = result.data || result;

      console.log('[Book Details Modal] ✓ Data fetched successfully');
      
      this.renderBookDetails(data);

    } catch (error) {
      console.error('[Book Details Modal] ✗ Error:', error);
      this.showError(error.message);
    }
  }

  renderBookDetails(data) {
    const { book, statistics, recentBorrowings, borrowingTrend, bookCopies } = data;

    // Update header
    this.title.textContent = book.title || 'Unknown Title';
    this.author.innerHTML = `
      <span class="material-symbols-outlined">person</span>
      <span>${book.author || 'Unknown Author'}</span>
    `;

    // Build tabs and content
    const bodyHTML = `
      <div class="book-details-tabs">
        <button class="book-tab active" data-tab="overview">
          <span class="material-symbols-outlined">info</span>
          Overview
        </button>
        <button class="book-tab" data-tab="statistics">
          <span class="material-symbols-outlined">analytics</span>
          Statistics
        </button>
        <button class="book-tab" data-tab="borrowings">
          <span class="material-symbols-outlined">history</span>
          Recent Borrowings
        </button>
        <button class="book-tab" data-tab="copies">
          <span class="material-symbols-outlined">content_copy</span>
          Copies (${bookCopies.length})
        </button>
      </div>

      <div class="book-details-content">
        <!-- Overview Tab -->
        <div class="book-tab-content active" id="tab-overview">
          ${this.renderOverviewTab(book)}
        </div>

        <!-- Statistics Tab -->
        <div class="book-tab-content" id="tab-statistics">
          ${this.renderStatisticsTab(statistics, borrowingTrend)}
        </div>

        <!-- Recent Borrowings Tab -->
        <div class="book-tab-content" id="tab-borrowings">
          ${this.renderBorrowingsTab(recentBorrowings)}
        </div>

        <!-- Copies Tab -->
        <div class="book-tab-content" id="tab-copies">
          ${this.renderCopiesTab(bookCopies)}
        </div>
      </div>
    `;

    this.body.innerHTML = bodyHTML;

    // Bind tab switching
    this.bindTabSwitching();
  }

  renderOverviewTab(book) {
    const statusClass = book.available_quantity > 0 ? 'available' : 'unavailable';
    const statusText = book.available_quantity > 0 ? 'Available' : 'Unavailable';

    return `
      <div class="book-overview">
        <div class="book-info-grid">
          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">tag</span>
              ISBN
            </span>
            <span class="book-info-value">${book.isbn || 'N/A'}</span>
          </div>

          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">category</span>
              Category
            </span>
            <span class="book-info-value">${book.category || 'N/A'}</span>
          </div>

          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">inventory</span>
              Status
            </span>
            <span class="book-info-value">
              <span class="status-badge status-${statusClass}">${statusText}</span>
            </span>
          </div>

          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">numbers</span>
              Total Copies
            </span>
            <span class="book-info-value">${book.total_copies || 0}</span>
          </div>

          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">check_circle</span>
              Available
            </span>
            <span class="book-info-value">${book.available_copies || 0}</span>
          </div>

          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">book_online</span>
              Borrowed
            </span>
            <span class="book-info-value">${book.borrowed_copies || 0}</span>
          </div>

          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">person_add</span>
              Added By
            </span>
            <span class="book-info-value">${book.added_by_name || 'Unknown'}</span>
          </div>

          <div class="book-info-item">
            <span class="book-info-label">
              <span class="material-symbols-outlined">calendar_today</span>
              Added Date
            </span>
            <span class="book-info-value">${this.formatDate(book.added_date)}</span>
          </div>
        </div>

        ${book.description ? `
          <div class="book-description">
            <h4><span class="material-symbols-outlined">description</span> Description</h4>
            <p>${book.description}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderStatisticsTab(stats, trend) {
    const avgDuration = stats.avg_borrow_duration_days 
      ? Math.round(stats.avg_borrow_duration_days) 
      : 0;

    return `
      <div class="book-statistics">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined">assignment</span></div>
            <div class="stat-content">
              <div class="stat-value">${stats.total_borrowings || 0}</div>
              <div class="stat-label">Total Borrowings</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined">group</span></div>
            <div class="stat-content">
              <div class="stat-value">${stats.unique_borrowers || 0}</div>
              <div class="stat-label">Unique Borrowers</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined">book_online</span></div>
            <div class="stat-content">
              <div class="stat-value">${stats.currently_borrowed || 0}</div>
              <div class="stat-label">Currently Borrowed</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined">assignment_turned_in</span></div>
            <div class="stat-content">
              <div class="stat-value">${stats.total_returned || 0}</div>
              <div class="stat-label">Returned</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined">schedule</span></div>
            <div class="stat-content">
              <div class="stat-value">${avgDuration} days</div>
              <div class="stat-label">Avg. Borrow Duration</div>
            </div>
          </div>

          <div class="stat-card ${stats.overdue_count > 0 ? 'stat-warning' : ''}">
            <div class="stat-icon"><span class="material-symbols-outlined">warning</span></div>
            <div class="stat-content">
              <div class="stat-value">${stats.overdue_count || 0}</div>
              <div class="stat-label">Overdue</div>
            </div>
          </div>
        </div>

        ${trend && trend.length > 0 ? `
          <div class="borrowing-trend">
            <h4><span class="material-symbols-outlined">trending_up</span> Borrowing Trend (Last 12 Months)</h4>
            <div class="trend-chart">
              ${trend.slice(0, 6).reverse().map(item => `
                <div class="trend-item">
                  <div class="trend-bar" style="height: ${(item.count / Math.max(...trend.map(t => t.count))) * 100}%">
                    <span class="trend-value">${item.count}</span>
                  </div>
                  <div class="trend-label">${this.formatMonth(item.month)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderBorrowingsTab(borrowings) {
    if (!borrowings || borrowings.length === 0) {
      return `
        <div class="empty-state">
          <span class="material-symbols-outlined">history</span>
          <p>No borrowing history yet</p>
        </div>
      `;
    }

    return `
      <div class="borrowings-list">
        <table class="borrowings-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Department</th>
              <th>Copy #</th>
              <th>Borrow Date</th>
              <th>Due Date</th>
              <th>Return Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${borrowings.map(b => `
              <tr>
                <td>
                  <div class="student-info">
                    <strong>${b.student_name || 'Unknown'}</strong>
                    <small>${b.student_id || ''}</small>
                  </div>
                </td>
                <td>${b.department || 'N/A'}</td>
                <td>${b.copy_number || 'N/A'}</td>
                <td>${this.formatDate(b.borrow_date)}</td>
                <td>${this.formatDate(b.due_date)}</td>
                <td>${b.return_date ? this.formatDate(b.return_date) : '-'}</td>
                <td>
                  <span class="status-badge status-${b.status}">
                    ${this.formatStatus(b.status)}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderCopiesTab(copies) {
    if (!copies || copies.length === 0) {
      return `
        <div class="empty-state">
          <span class="material-symbols-outlined">content_copy</span>
          <p>No copies available</p>
        </div>
      `;
    }

    return `
      <div class="copies-grid">
        ${copies.map(copy => `
          <div class="copy-card">
            <div class="copy-header">
              <span class="copy-number">Copy #${copy.copy_number}</span>
              <span class="status-badge status-${copy.status}">${this.formatStatus(copy.status)}</span>
            </div>
            <div class="copy-details">
              <div class="copy-detail-item">
                <span class="material-symbols-outlined">tag</span>
                <span>${copy.accession_number || 'N/A'}</span>
              </div>
              <div class="copy-detail-item">
                <span class="material-symbols-outlined">calendar_today</span>
                <span>${this.formatDate(copy.acquisition_date)}</span>
              </div>
              ${copy.notes ? `
                <div class="copy-notes">
                  <span class="material-symbols-outlined">note</span>
                  <span>${copy.notes}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  bindTabSwitching() {
    const tabs = this.body.querySelectorAll('.book-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        this.body.querySelectorAll('.book-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        this.body.querySelectorAll('.book-tab-content').forEach(c => c.classList.remove('active'));
        this.body.querySelector(`#tab-${tabName}`).classList.add('active');
      });
    });
  }

  showError(message) {
    this.body.innerHTML = `
      <div class="book-details-error">
        <span class="material-symbols-outlined">error</span>
        <h3>Unable to load book details</h3>
        <p>${message}</p>
      </div>
    `;
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatMonth(monthString) {
    if (!monthString) return '';
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }

  formatStatus(status) {
    const statusMap = {
      'available': 'Available',
      'borrowed': 'Borrowed',
      'returned': 'Returned',
      'overdue': 'Overdue',
      'maintenance': 'Maintenance',
      'lost': 'Lost',
      'damaged': 'Damaged'
    };
    return statusMap[status] || status;
  }
}

// Initialize modal on page load
let bookDetailsModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  bookDetailsModalInstance = new BookDetailsModal();
  console.log('[Book Details Modal] ✓ Initialized');
});

// Global function to open modal
window.openBookModal = function(bookId) {
  if (bookDetailsModalInstance) {
    bookDetailsModalInstance.open(bookId);
  } else {
    console.error('[Book Details Modal] ✗ Modal not initialized');
  }
};

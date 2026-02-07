document.addEventListener("DOMContentLoaded", function () {
  const studentId = sessionStorage.getItem("studentId");
  if (!studentId) {
    window.location.href = "/login";
    return;
  }

  loadBorrowingHistory();
  
  // Auto-refresh borrowing history every 30 seconds
  setInterval(() => {
    loadBorrowingHistory();
  }, 30000);

  // Initialize borrowing details modal
  initBorrowingDetailsModal();

  // Check for deep link parameters
  checkDeepLinkParams();
});

function checkDeepLinkParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const borrowingId = urlParams.get('openBorrowing');
  
  // Validate: must exist, not be "undefined", not empty
  const isValid = borrowingId && borrowingId !== 'undefined' && borrowingId !== 'null' && borrowingId.trim() !== '';
  
  if (isValid) {
    console.log('[Deep Link] Opening borrowing modal for:', borrowingId, '(from URL)');
    // Clean URL BEFORE opening to prevent refresh re-trigger
    window.history.replaceState({}, document.title, window.location.pathname);
    // Wait for table to load, then open modal
    setTimeout(() => {
      openBorrowingDetailsModal(borrowingId);
    }, 800);
  } else {
    console.log('[Deep Link] No valid deep-link params detected - modal stays closed');
  }
}

async function loadBorrowingHistory() {
  try {
    const response = await fetchWithCsrf(
      `/api/students/borrowing-history/${sessionStorage.getItem("studentId")}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch borrowing history");
    }

    const result = await response.json();
    const borrowingHistory = result.data || []; // Extract data from response wrapper
    const tableBody = document.querySelector(".user-table tbody");

    if (borrowingHistory.length === 0) {
      // Show empty state
      document.querySelector(".table-wrapper").style.display = "none";
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML = `
                <span class="material-symbols-outlined">menu_book</span>
                <h3>No Borrowing History</h3>
                <p>You haven't borrowed any books yet. Start exploring our collection!</p>
                <a href="/student-books" class="browse-books-btn">Browse Books</a>
            `;
      document.querySelector(".maincontent").appendChild(emptyState);
      return;
    }

    // Clear existing table content
    tableBody.innerHTML = "";

    // Add borrowing history to table
    borrowingHistory.forEach((book) => {
      const row = document.createElement("tr");
      
      // Add data attribute for highlighting
      if (book.id) {
        row.setAttribute('data-borrowing-id', book.id);
      }
      
      // Format due date with deadline indicator
      let dueDateDisplay = formatDate(book.due_date);
      
      // Add deadline status indicator (plain text, no color styling)
      if (book.deadline_status === 'overdue' && !book.return_date) {
        dueDateDisplay += ' <span style="font-size: 0.85em; font-weight: 600;">(Overdue)</span>';
      } else if (book.deadline_status === 'due_today' && !book.return_date) {
        dueDateDisplay += ' <span style="font-size: 0.85em; font-weight: 600;">(Due Today)</span>';
      }
      
      row.innerHTML = `
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${formatDate(book.borrow_date)}</td>
                <td>${dueDateDisplay}</td>
                <td>${
                  book.return_date
                    ? formatDate(book.return_date)
                    : "Not returned"
                }</td>
                <td>${book.duration} days</td>
            `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error:", error);
    // Show error message to user
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent =
      "Failed to load borrowing history. Please try again later.";
    document.querySelector(".maincontent").prepend(errorDiv);
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}

function initBorrowingDetailsModal() {
  // Create modal HTML if not exists
  if (document.getElementById('borrowingDetailsModal')) return;

  const modalHTML = `
    <div id="borrowingDetailsModal" class="borrowing-modal-overlay" style="display: none;">
      <div class="borrowing-modal">
        <div class="borrowing-modal-header">
          <h3 class="borrowing-modal-title">Borrowing Details</h3>
          <button class="borrowing-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="borrowing-modal-body" id="borrowingModalBody">
          <div class="borrowing-loading">
            <div class="borrowing-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
        <div class="borrowing-modal-footer">
          <button class="borrowing-modal-btn borrowing-modal-btn-secondary" id="borrowingModalClose">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Bind close events
  const modal = document.getElementById('borrowingDetailsModal');
  const closeBtn = modal.querySelector('.borrowing-modal-close');
  const closeBtnFooter = document.getElementById('borrowingModalClose');

  const closeModal = () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  closeBtn.addEventListener('click', closeModal);
  closeBtnFooter.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
}

async function openBorrowingDetailsModal(borrowingId) {
  const modal = document.getElementById('borrowingDetailsModal');
  const modalBody = document.getElementById('borrowingModalBody');

  if (!modal || !modalBody) {
    console.error('[Student Borrowed] Modal not initialized');
    return;
  }

  // Show modal with loading state
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  modalBody.innerHTML = `
    <div class="borrowing-loading">
      <div class="borrowing-spinner"></div>
      <p>Loading borrowing details...</p>
    </div>
  `;

  try {
    // Fetch borrowing details
    const response = await fetchWithCsrf(`/api/book-borrowings/detail/${borrowingId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch borrowing details');
    }

    const result = await response.json();
    const borrowing = result.data;

    if (!borrowing) {
      throw new Error('Borrowing not found');
    }

    // Highlight the row in the table
    highlightBorrowingRow(borrowingId);

    // Render borrowing details
    renderBorrowingDetails(borrowing);

  } catch (error) {
    console.error('[Student Borrowed] Error loading borrowing:', error);
    modalBody.innerHTML = `
      <div class="borrowing-error">
        <span class="material-symbols-outlined" style="font-size: 48px; color: #c62828;">error</span>
        <h4>Failed to Load Borrowing</h4>
        <p>${error.message || 'This borrowing record could not be found.'}</p>
      </div>
    `;
  }
}

function renderBorrowingDetails(borrowing) {
  const modalBody = document.getElementById('borrowingModalBody');
  
  const statusClass = borrowing.status === 'overdue' ? 'status-overdue' : 
                      borrowing.status === 'borrowed' ? 'status-borrowed' : 'status-returned';
  
  const statusText = borrowing.status === 'overdue' ? 'OVERDUE' : 
                     borrowing.status === 'borrowed' ? 'BORROWED' : 'RETURNED';

  const daysOverdue = borrowing.status === 'overdue' && !borrowing.return_date ?
    Math.floor((new Date() - new Date(borrowing.due_date)) / (1000 * 60 * 60 * 24)) : 0;

  modalBody.innerHTML = `
    <div class="borrowing-details">
      <div class="borrowing-status-badge ${statusClass}">
        <span class="material-symbols-outlined">schedule</span>
        ${statusText}
        ${daysOverdue > 0 ? `<span class="days-overdue">(${daysOverdue} days overdue)</span>` : ''}
      </div>

      <div class="borrowing-section">
        <h4><span class="material-symbols-outlined">menu_book</span> Book Information</h4>
        <div class="borrowing-field">
          <span class="field-label">Title:</span>
          <span class="field-value">${escapeHtml(borrowing.title)}</span>
        </div>
        <div class="borrowing-field">
          <span class="field-label">Author:</span>
          <span class="field-value">${escapeHtml(borrowing.author)}</span>
        </div>
        <div class="borrowing-field">
          <span class="field-label">Category:</span>
          <span class="field-value">${escapeHtml(borrowing.category || 'N/A')}</span>
        </div>
        <div class="borrowing-field">
          <span class="field-label">ISBN:</span>
          <span class="field-value">${escapeHtml(borrowing.isbn || 'N/A')}</span>
        </div>
      </div>

      <div class="borrowing-section">
        <h4><span class="material-symbols-outlined">calendar_month</span> Borrowing Timeline</h4>
        <div class="borrowing-field">
          <span class="field-label">Borrowed On:</span>
          <span class="field-value">${formatDate(borrowing.borrow_date)}</span>
        </div>
        <div class="borrowing-field">
          <span class="field-label">Due Date:</span>
          <span class="field-value">${formatDate(borrowing.due_date)}</span>
        </div>
        <div class="borrowing-field">
          <span class="field-label">Return Date:</span>
          <span class="field-value">${borrowing.return_date ? formatDate(borrowing.return_date) : '<em>Not returned yet</em>'}</span>
        </div>
      </div>

      ${borrowing.approved_by_name ? `
        <div class="borrowing-section">
          <h4><span class="material-symbols-outlined">admin_panel_settings</span> Administrative</h4>
          <div class="borrowing-field">
            <span class="field-label">Approved By:</span>
            <span class="field-value">${escapeHtml(borrowing.approved_by_name)}</span>
          </div>
        </div>
      ` : ''}

      ${borrowing.notes ? `
        <div class="borrowing-section">
          <h4><span class="material-symbols-outlined">notes</span> Notes</h4>
          <div class="borrowing-notes">${escapeHtml(borrowing.notes)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function highlightBorrowingRow(borrowingId) {
  // Remove any existing highlights
  document.querySelectorAll('.user-table tbody tr').forEach(row => {
    row.classList.remove('highlight-borrowing');
  });

  // Find and highlight the matching row
  const targetRow = document.querySelector(`tr[data-borrowing-id="${borrowingId}"]`);
  if (targetRow) {
    targetRow.classList.add('highlight-borrowing');
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    console.log('[Student Borrowed] Highlighted row:', borrowingId);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return 'N/A';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

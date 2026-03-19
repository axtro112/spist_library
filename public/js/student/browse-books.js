// ==================================================
// GLOBAL STATE AND FUNCTIONS
// (Must be global for inline onclick handlers)
// ==================================================

//  Multi-Book Selection State
const MAX_SELECTION = 5;
let selectedBooks = new Set();
let allBooksData = [];

// Filter State
let allBooks = []; // Complete list of books
let filteredBooks = []; // Filtered list based on search/filters
let searchDebounceTimer = null;
let currentFilters = {
  search: '',
  status: '',
  category: ''
};

// Smart Borrow Modal State — declared in quick-borrow-modal.js
// (openSmartBorrowModal, showBorrowModal, closeModal, handleBorrow,
//  addToCart, renderCart, etc. also live in quick-borrow-modal.js)

// placeholder comment so the section marker is kept readable
void 0;

/* ========================================
   MODAL FUNCTIONS
   All modal logic (openSmartBorrowModal, showBorrowModal, closeModal,
   handleBorrow, addToCart, renderCart, etc.) lives in:
   /js/student/quick-borrow-modal.js
   ======================================== */

// browse-books uses openSmartBorrowModal() to open the shared Quick Borrow
// modal with any pre-selected books. The function below is intentionally
// NOT redeclared here — the shared version (from quick-borrow-modal.js)
// is used directly.  We just register the page-specific success callback
// inside DOMContentLoaded (further below).

// ─── legacy function stubs that may still be referenced by old code ──
// (safe to remove once confirmed nothing else calls them)


// ==================================================
// AUTHENTICATION AND INITIALIZATION
// ==================================================

document.addEventListener("DOMContentLoaded", async function () {
  const isLoggedIn = sessionStorage.getItem("isLoggedIn");
  const userRole = sessionStorage.getItem("userRole");
  const studentId = sessionStorage.getItem("studentId");

  if (!isLoggedIn || !userRole || userRole !== "student" || !studentId) {
    console.log('[Auth] Session invalid, redirecting to login');
    const isTimeoutLogout = sessionStorage.getItem('timeout-logout') === 'true';
    if (!isTimeoutLogout) {
      alert('Please log in with student credentials to access this page.');
    }
    sessionStorage.clear();
    if (isTimeoutLogout) {
      sessionStorage.setItem('timeout-logout', 'true');
    }
    window.location.href = "/login";
    return;
  }

  // Display user information
  const userNameEl = document.getElementById("userName");
  const userIDEl = document.getElementById("userID");
  if (userNameEl) userNameEl.textContent = sessionStorage.getItem("userName") || "Student";
  if (userIDEl) userIDEl.textContent = sessionStorage.getItem("userID") || "STD-0000-000";

  // After a successful Quick Borrow, clear selection and refresh the book list
  window.onQuickBorrowSuccess = function () {
    selectedBooks.clear();
    updateSelectionUI();
    updateSelectAllCheckbox();
    loadAllBooks();
  };

  await loadAllBooks();
  setupFilterListeners();
});

// Logout functions
function showLogoutModal() {
  const logoutModal = document.getElementById("logoutModal");
  if (logoutModal) logoutModal.style.display = "flex";
}

function closeLogoutModal() {
  const logoutModal = document.getElementById("logoutModal");
  if (logoutModal) logoutModal.style.display = "none";
}

function logout() {
  fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' }
  }).catch(() => {
    // Ignore network errors; client-side redirect still proceeds.
  }).finally(() => {
    sessionStorage.clear();
    window.location.href = "/login";
  });
}

// Function to load all books initially (no filters)
async function loadAllBooks() {
  try {
    console.log('[LoadAllBooks] Fetching all books...');
    const response = await fetchWithCsrf('/api/books?ts=' + Date.now());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch books: ${response.status}`);
    }

    const result = await response.json();
    allBooks = result.data || [];
    allBooksData = allBooks;
    console.log('[LoadAllBooks] Loaded', allBooks.length, 'books');
    
    populateCategoriesFromBooks();
    applyFilters();
  } catch (error) {
    console.error('[LoadAllBooks] Error:', error);
    const tableBody = document.querySelector(".user-table tbody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center" style="color: red; padding: 20px;">
            <strong>Error loading books:</strong><br>${error.message}
          </td>
        </tr>
      `;
    }
  }
}

// Populate categories from loaded books data
function populateCategoriesFromBooks() {
  const categorySelect = document.getElementById('categoryFilter');
  if (!categorySelect) return;
  
  const categories = [...new Set(allBooks
    .map(book => book.category)
    .filter(cat => cat && cat.trim() !== '')
  )].sort();
  
  categorySelect.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

// Apply filters to books list
function applyFilters() {
  filteredBooks = allBooks.filter(book => {
    if (currentFilters.search) {
      const searchLower = currentFilters.search.toLowerCase();
      const matchesSearch = 
        (book.title && book.title.toLowerCase().includes(searchLower)) ||
        (book.author && book.author.toLowerCase().includes(searchLower)) ||
        (book.accession_no && book.accession_no.toLowerCase().includes(searchLower)) ||
        (book.category && book.category.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }
    if (currentFilters.status) {
      if (currentFilters.status === 'available' && !(book.available_quantity > 0)) return false;
      if (currentFilters.status === 'borrowed' && !(book.available_quantity === 0)) return false;
    }
    if (currentFilters.category && book.category !== currentFilters.category) return false;
    return true;
  });
  displayBooks(filteredBooks);
}

// Debounced search handler
function handleSearchInput(value) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentFilters.search = value.trim();
    applyFilters();
  }, 300);
}

// Setup event listeners for filters
function setupFilterListeners() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', (e) => handleSearchInput(e.target.value));
  
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) statusFilter.addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    applyFilters();
  });
  
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) categoryFilter.addEventListener('change', (e) => {
    currentFilters.category = e.target.value;
    applyFilters();
  });
  
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => clearFilters());
}

// Clear all filters
function clearFilters() {
  currentFilters = { search: '', status: '', category: '' };
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) statusFilter.value = '';
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) categoryFilter.value = '';
  applyFilters();
}

// Backward-compatible loadBooks
async function loadBooks(searchQuery = "", category = "") {
  try {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    if (category) params.append("category", category);
    const response = await fetchWithCsrf(`/api/books?${params.toString()}`);
    if (!response.ok) throw new Error(`Failed to fetch books: ${response.status}`);
    const result = await response.json();
    const books = result.data || [];
    displayBooks(books);
  } catch (error) {
    console.error("[LoadBooks] Error:", error);
    const tableBody = document.querySelector(".user-table tbody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: red; padding: 20px;"><strong>Error loading books:</strong><br>${error.message}</td></tr>`;
    }
  }
}

// Display books in the table
function displayBooks(books) {
  const tableBody = document.querySelector(".user-table tbody");
  if (!tableBody) {
    console.error('[DisplayBooks] Table body not found!');
    return;
  }
  
  allBooksData = books;

  if (books.length === 0) {
    const hasActiveFilters = currentFilters.search || currentFilters.status || currentFilters.category;
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center" style="padding: 40px;">
          <div style="color: #666; font-size: 1.1em;">
            <i class="fas fa-search" style="font-size: 3em; color: #ddd; margin-bottom: 15px; display: block;"></i>
            <strong>${hasActiveFilters ? 'No books matched your search' : 'No books found'}</strong>
            <p style="margin-top: 10px; color: #999; font-size: 0.9em;">
              ${hasActiveFilters ? 'Try adjusting your filters or search terms' : 'No books are currently available'}
            </p>
          </div>
        </td>
      </tr>
    `;
    updateSelectAllCheckbox();
    return;
  }

  tableBody.innerHTML = books.map((book) => {
    const bookKey = book.book_id ?? book.id ?? book.accession_no;
    const isAvailable = book.available_quantity > 0;
    const isSelected = selectedBooks.has(bookKey);
    return `
      <tr>
        <td style="text-align: center; vertical-align: middle;">
          <input 
            type="checkbox" 
            class="book-checkbox" 
            data-book-id="${bookKey}"
            ${isSelected ? 'checked' : ''}
            ${!isAvailable ? 'disabled' : ''}
            aria-label="Select ${book.title}"
            style="cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; width: 18px; height: 18px;"
          >
        </td>
        <td>${book.id}</td>
        <td><strong>${book.title}</strong></td>
        <td>${book.author || 'Unknown'}</td>
        <td style="text-align: center;">${book.available_quantity || 0}/${book.quantity || 0}</td>
        <td>${book.category || 'Uncategorized'}</td>
        <td>${book.isbn || 'N/A'}</td>
        <td>
          <span class="status-badge" style="
            padding: 6px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;
            background: ${isAvailable ? '#e8f5e9' : '#ffebee'};
            color: ${isAvailable ? '#2e7d32' : '#c62828'}; display: inline-block;">
            ${isAvailable ? `Available (${book.available_quantity})` : 'Not Available'}
          </span>
        </td>
        <td>
          <button 
            class="action-btn btn-borrow" 
            onclick="showBorrowModal('${book.id}')"
            ${!isAvailable ? 'disabled' : ''}
            style="
              padding: 8px 16px; border: none; border-radius: 6px; font-weight: 600;
              cursor: ${isAvailable ? 'pointer' : 'not-allowed'};
              background: ${isAvailable ? '#4CAF50' : '#ccc'};
              color: white; transition: all 0.3s;"
            onmouseover="if(!this.disabled) this.style.background='#45a049'"
            onmouseout="if(!this.disabled) this.style.background='#4CAF50'"
          >
            ${isAvailable ? 'Borrow' : 'Unavailable'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  updateSelectAllCheckbox();
}

// ==================================================
// BULK BORROW & SELECTION HANDLING
// ==================================================

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  if (!selectAllCheckbox) return;

  const visibleAvailableBooks = allBooksData.filter(b => b.available_quantity > 0);
  const visibleAvailableKeys = visibleAvailableBooks.map(b => b.book_id ?? b.id ?? b.accession_no);
  const selectedVisibleCount = visibleAvailableKeys.filter(key => selectedBooks.has(key)).length;
  
  if (selectedVisibleCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedVisibleCount === visibleAvailableKeys.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

function initCheckboxEventDelegation() {
  const tableBody = document.querySelector(".user-table tbody");
  const selectAllCheckbox = document.getElementById("select-all-checkbox");

  tableBody.addEventListener("change", (e) => {
    if (e.target.classList.contains("book-checkbox")) {
      const bookId = e.target.dataset.bookId;
      if (e.target.checked) {
        if (selectedBooks.size >= MAX_SELECTION) {
          e.target.checked = false;
          showSelectionLimitMessage();
          return;
        }
        selectedBooks.add(bookId);
      } else {
        selectedBooks.delete(bookId);
      }
      updateSelectionUI();
      updateSelectAllCheckbox();
    }
  });

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      const visibleAvailableBooks = allBooksData.filter(b => b.available_quantity > 0);
      const visibleAvailableKeys = visibleAvailableBooks.map(b => b.book_id ?? b.id ?? b.accession_no);
      if (e.target.checked) {
        visibleAvailableKeys.forEach(key => {
          if (selectedBooks.size < MAX_SELECTION) selectedBooks.add(key);
        });
        if (visibleAvailableBooks.length > MAX_SELECTION) showSelectionLimitMessage();
      } else {
        visibleAvailableKeys.forEach(key => selectedBooks.delete(key));
      }
      displayBooks(allBooksData);
      updateSelectionUI();
    });
  }
}

function updateSelectionUI() {
  const count = selectedBooks.size;
  const borrowBtn = document.getElementById("borrow-selected-btn");
  const clearBtn = document.getElementById("clear-selection-btn");
  const countSpan = document.getElementById("selected-count");
  const toolbar = document.querySelector(".selection-toolbar");

  if (countSpan) countSpan.textContent = count;
  if (toolbar) toolbar.style.display = count > 0 ? "flex" : "none";
  if (borrowBtn) {
    if (count > 0) {
      borrowBtn.disabled = false;
      if (clearBtn) clearBtn.style.display = "inline-block";
    } else {
      borrowBtn.disabled = true;
      if (clearBtn) clearBtn.style.display = "none";
    }
  }
}

function showSelectionLimitMessage() {
  const toastContainer = document.getElementById("toast-container") || (() => {
    const container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = "position:fixed;top:20px;right:20px;z-index:10000;max-width:400px;";
    document.body.appendChild(container);
    return container;
  })();

  const toast = document.createElement("div");
  toast.style.cssText = `
    background: linear-gradient(135deg, #2e7d32, #5ab85a);
    color: white; padding: 16px 20px; border-radius: 10px;
    box-shadow: 0 4px 12px rgba(74,161,74,0.3); margin-bottom: 12px;
    display: flex; align-items: center; gap: 12px; font-weight: 600;
    animation: slideIn 0.3s ease-out;
  `;
  toast.innerHTML = '<i class="fas fa-ban" style="font-size: 18px;"></i><span>Limit reached: You can only select up to 5 books.</span>';
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Toast animations
if (!document.querySelector("style[data-toast-animations]")) {
  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-toast-animations", "true");
  styleEl.textContent = `
    @keyframes slideIn { from { transform: translateX(450px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(450px); opacity: 0; } }
  `;
  document.head.appendChild(styleEl);
}

// Bulk borrow button listeners
document.addEventListener("DOMContentLoaded", function() {
  initCheckboxEventDelegation();

  const borrowSelectedBtn = document.getElementById("borrow-selected-btn");
  const clearSelectionBtn = document.getElementById("clear-selection-btn");
  const cancelBorrowBtn = document.getElementById("cancel-borrow-btn");
  const confirmBorrowBtn = document.getElementById("confirm-borrow-btn");

  if (borrowSelectedBtn) {
    borrowSelectedBtn.addEventListener("click", async () => {
      if (selectedBooks.size === 0) return;

      const selectedBooksData = allBooksData.filter(book => {
        const bookKey = book.book_id ?? book.id ?? book.accession_no;
        return selectedBooks.has(bookKey);
      });

      smartBorrowState.cartItems = [];
      await openSmartBorrowModal();
      selectedBooksData.forEach(book => addToCart(book));
    });
  }

  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", () => {
      selectedBooks.clear();
      displayBooks(allBooksData);
      updateSelectionUI();
      updateSelectAllCheckbox();
    });
  }

  if (cancelBorrowBtn) {
    cancelBorrowBtn.addEventListener("click", () => {
      const modal = document.getElementById("bulk-borrow-modal");
      if (modal) modal.style.display = "none";
    });
  }

  if (confirmBorrowBtn) {
    confirmBorrowBtn.addEventListener("click", async () => {
      const originalText = confirmBorrowBtn.textContent;
      confirmBorrowBtn.disabled = true;
      confirmBorrowBtn.textContent = "Processing...";
      try {
        const studentId = sessionStorage.getItem("studentId");
        if (!studentId) throw new Error("Session expired. Please log in again.");

        const response = await fetchWithCsrf("/api/students/borrow-multiple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookIds: Array.from(selectedBooks), studentId }),
        });
        if (response.status === 401) throw new Error("Session expired. Please log in again.");
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || result.error || "Failed to borrow books");

        alert(`Successfully borrowed ${result.successCount} book(s)!\n\nDue date: ${result.dueDate}`);
        const modal = document.getElementById("bulk-borrow-modal");
        if (modal) modal.style.display = "none";
        selectedBooks.clear();

        const searchValue = document.querySelector(".search-bar input")?.value || "";
        const filterValue = document.querySelector(".filter-dropdown select")?.value || "";
        await loadBooks(searchValue, filterValue);
        updateSelectionUI();
      } catch (error) {
        console.error("Bulk borrow error:", error);
        alert(`Error: ${error.message}`);
      } finally {
        confirmBorrowBtn.disabled = false;
        confirmBorrowBtn.textContent = originalText;
      }
    });
  }
});

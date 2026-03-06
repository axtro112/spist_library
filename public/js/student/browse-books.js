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

// Smart Borrow Modal State
let smartBorrowState = {
  cartItems: [], // [{ bookId, title, author, isbn, accessionNo, availableQty, qty }]
  availableBooks: [], // All available books loaded from API
  filteredBooks: [], // Filtered results based on search
  isLoading: false,
  errorMessage: null,
  searchQuery: '' // Current search query
};

/* ========================================
   MODAL FUNCTIONS (GLOBAL SCOPE)
   ======================================== */

// Function to open Smart Borrow modal (unified borrowing)
async function openSmartBorrowModal() {
  console.log('[Modal] openSmartBorrowModal called');
  console.log('[Modal] Current cart state:', smartBorrowState.cartItems.length, 'items');
  
  // Reset modal state EXCEPT cartItems (preserve preloaded cart!)
  smartBorrowState = {
    cartItems: smartBorrowState.cartItems || [],  // PRESERVE existing cart
    availableBooks: [],
    filteredBooks: [],
    isLoading: false,
    errorMessage: null,
    searchQuery: ''
  };
  
  console.log('[Modal] State reset. Cart items preserved:', smartBorrowState.cartItems.length);
  
  // Clear session book ID
  sessionStorage.removeItem("currentBorrowBookId");
  
  // Clear and reset inputs
  const searchInput = document.getElementById("smartSearchInput");
  if (searchInput) {
    searchInput.value = "";
  }
  
  // Set minimum date to tomorrow and maximum date to 7 days from today
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 1); // Minimum tomorrow
  
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7); // Maximum 7 days

  const returnDateInput = document.getElementById("returnDate");
  if (returnDateInput) {
    returnDateInput.min = minDate.toISOString().split("T")[0];
    returnDateInput.max = maxDate.toISOString().split("T")[0];
    returnDateInput.value = maxDate.toISOString().split("T")[0]; // Default to max date (7 days)
  }

  const modal = document.getElementById("modal-user");
  if (!modal) {
    console.error('[Modal] Modal element not found!');
    return;
  }
  
  // Force remove hidden class and show modal
  modal.classList.remove("qb-hidden");
  modal.style.display = "grid";
  modal.setAttribute("aria-hidden", "false");
  
  console.log('[Modal] Modal shown. Loading available books...');
  await loadAvailableBooksForModal();
  
  // Update display
  updateSmartSearchDisplay();
  updateConfirmButtonState();
  
  // Focus on search input
  setTimeout(() => searchInput?.focus(), 100);
}

// Function to show book borrow modal - ONLY call when user clicks Borrow button
async function showBorrowModal(bookId) {
  console.log('[Modal] showBorrowModal called with bookId:', bookId);
  
  // Find the book in cached data
  const book = allBooksData.find(b => b.id == bookId);
  console.log('[Modal] Found book:', book ? book.title : 'NOT FOUND');
  
  // Reset modal state
  smartBorrowState = {
    cartItems: [],
    availableBooks: [],
    filteredBooks: [],
    isLoading: false,
    errorMessage: null,
    searchQuery: ''
  };
  
  sessionStorage.setItem("currentBorrowBookId", bookId);
  
  // Clear search input
  const searchInput = document.getElementById("smartSearchInput");
  if (searchInput) {
    searchInput.value = "";
  }
  
  // Set minimum date to tomorrow and maximum date to 7 days from today
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 1);
  
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);

  const returnDateInput = document.getElementById("returnDate");
  if (returnDateInput) {
    returnDateInput.min = minDate.toISOString().split("T")[0];
    returnDateInput.max = maxDate.toISOString().split("T")[0];
    returnDateInput.value = maxDate.toISOString().split("T")[0];
  }

  const modal = document.getElementById("modal-user");
  if (!modal) {
    console.error('[Modal] Modal element not found!');
    return;
  }
  
  // Force remove hidden class and show modal
  modal.classList.remove("qb-hidden");
  modal.style.display = "grid";
  modal.setAttribute("aria-hidden", "false");
  
  // Load available books first
  await loadAvailableBooksForModal();
  
  // Add book to cart after loading available books
  if (book) {
    addToCart(book);
  }
  
  // Update display
  updateSmartSearchDisplay();
  updateConfirmButtonState();
  
  // Focus on search input
  setTimeout(() => searchInput?.focus(), 100);
}

// Function to close modal
function closeModal(event) {
  console.log('[Modal] closeModal called');
  
  // Prevent event bubbling if event exists
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  const modal = document.getElementById("modal-user");
  if (modal) {
    console.log('[Modal] Before close - classList:', modal.classList.toString());
    
    modal.classList.add("qb-hidden");
    modal.style.display = ""; // Clear inline style
    modal.setAttribute("aria-hidden", "true");
    
    console.log('[Modal] After close - classList:', modal.classList.toString());
  }
  
  // Reset modal state
  smartBorrowState = {
    cartItems: [],
    availableBooks: [],
    filteredBooks: [],
    isLoading: false,
    errorMessage: null,
    searchQuery: ''
  };
  
  // Clear inputs when closing
  const searchInput = document.getElementById("smartSearchInput");
  if (searchInput) {
    searchInput.value = "";
  }
  
  sessionStorage.removeItem("currentBorrowBookId");
}

// Smart Search Handler (unified ISBN and title/author search)
let smartSearchTimeout;

// Load available books for modal
async function loadAvailableBooksForModal() {
  console.log('[LoadBooks] Starting load...');
  smartBorrowState.isLoading = true;
  smartBorrowState.errorMessage = null;
  updateSmartSearchDisplay();

  try {
    console.log('[LoadBooks] Fetching from /api/books...');
    const response = await fetchWithCsrf("/api/books");
    
    if (!response.ok) {
      throw new Error(`Failed to fetch books: ${response.status}`);
    }

    const result = await response.json();
    let books = result.data || result || [];
    
    console.log('[LoadBooks] Raw books fetched:', books.length);
    
    // Filter only available books (available_quantity > 0)
    books = books.filter(b => {
      const qty = Number(b.available_quantity ?? b.available_qty ?? b.quantity ?? 0);
      return qty > 0;
    });
    
    console.log('[LoadBooks] After filtering available:', books.length);
    
    // Normalize book IDs
    books = books.map(b => ({
      ...b,
      id: b.book_id ?? b.id ?? b.accession_no,
      available_quantity: Number(b.available_quantity ?? b.available_qty ?? b.quantity ?? 0)
    }));

    smartBorrowState.availableBooks = books;
    smartBorrowState.filteredBooks = books;
    smartBorrowState.errorMessage = null;
    
    console.log('[LoadBooks] Books loaded successfully. Available:', books.length);
  } catch (error) {
    console.error("Error loading available books:", error);
    smartBorrowState.availableBooks = [];
    smartBorrowState.filteredBooks = [];
    smartBorrowState.errorMessage = "Error loading books. Please try again.";
  } finally {
    smartBorrowState.isLoading = false;
    console.log('[LoadBooks] Load complete. Updating display...');
    updateSmartSearchDisplay();
  }
}

function handleSmartSearch(query) {
  clearTimeout(smartSearchTimeout);
  smartSearchTimeout = setTimeout(() => {
    performSmartSearch(query);
  }, 400);
}

async function performSmartSearch(query) {
  smartBorrowState.searchQuery = query?.trim() || '';
  
  if (!smartBorrowState.searchQuery) {
    smartBorrowState.filteredBooks = smartBorrowState.availableBooks;
    smartBorrowState.errorMessage = null;
    updateSmartSearchDisplay();
    return;
  }

  try {
    const lowerQuery = smartBorrowState.searchQuery.toLowerCase();
    
    const filtered = smartBorrowState.availableBooks.filter((b) => {
      const titleMatch = b.title && b.title.toLowerCase().includes(lowerQuery);
      const authorMatch = b.author && b.author.toLowerCase().includes(lowerQuery);
      const isbnMatch = b.isbn && b.isbn.toString().toLowerCase().includes(lowerQuery);
      return titleMatch || authorMatch || isbnMatch;
    });

    smartBorrowState.filteredBooks = filtered;
    smartBorrowState.errorMessage = filtered.length === 0 
      ? "No books found matching your search" 
      : null;
  } catch (error) {
    console.error("Error searching for book:", error);
    smartBorrowState.filteredBooks = [];
    smartBorrowState.errorMessage = "Error searching. Please try again.";
  } finally {
    updateSmartSearchDisplay();
  }
}

// Normalize book ID from various possible fields
function normalizeBookId(book) {
  return book.book_id ?? book.id ?? book.accession_no;
}

// Add book to cart or increment quantity if already in cart
function addToCart(book) {
  if (!book) {
    console.error('[AddToCart] Book object is null/undefined');
    return;
  }

  const bookId = normalizeBookId(book);
  console.log('[AddToCart] Adding book:', { title: book.title, bookId: bookId, available: book.available_quantity });
  
  const existing = smartBorrowState.cartItems.find(i => i.bookId == bookId);
  
  if (existing) {
    console.log('[AddToCart] Book already in cart, incrementing qty from', existing.qty);
    if (existing.qty < existing.availableQty) {
      existing.qty++;
    }
  } else {
    const newItem = {
      bookId: bookId,
      title: book.title,
      author: book.author || 'Unknown',
      isbn: book.isbn || 'N/A',
      accessionNo: book.accession_no || book.accessionNo || book.isbn,
      availableQty: Number(book.available_quantity ?? book.available_qty ?? book.quantity ?? 1),
      qty: 1
    };
    console.log('[AddToCart] Adding new item to cart:', { title: newItem.title, bookId, availableQty: newItem.availableQty });
    smartBorrowState.cartItems.push(newItem);
  }
  
  console.log('[AddToCart] Cart now has', smartBorrowState.cartItems.length, 'items');
  
  updateSmartSearchDisplay();
  updateConfirmButtonState();
}

// Select book from filtered results
function selectBookFromResults(bookId) {
  const book = smartBorrowState.filteredBooks.find(b => normalizeBookId(b) == bookId);
  if (book && book.available_quantity > 0) {
    addToCart(book);
    smartBorrowState.errorMessage = null;
    updateSmartSearchDisplay();
    updateConfirmButtonState();
  }
}

// Update smart search display in modal
function updateSmartSearchDisplay() {
  const cartContainer = document.getElementById("bookDetailsContainer");
  const availableBooksContainer = document.getElementById("availableBooksContainer");
  
  if (!cartContainer || !availableBooksContainer) return;

  renderCart();

  if (smartBorrowState.isLoading) {
    availableBooksContainer.innerHTML = '<div style="color: #4ba14e; font-style: italic; text-align: center; padding: 15px;">Loading books...</div>';
    return;
  }

  if (smartBorrowState.errorMessage) {
    availableBooksContainer.innerHTML = `<div style="color: #f44336; font-weight: bold; text-align: center; padding: 15px;">${smartBorrowState.errorMessage}</div>`;
    return;
  }

  const booksToShow = smartBorrowState.filteredBooks;
  
  if (booksToShow.length > 0) {
    const resultsHtml = booksToShow.map(book => {
      const bookId = normalizeBookId(book);
      const isAvailable = book.available_quantity > 0;
      const isInCart = smartBorrowState.cartItems.some(i => i.bookId == bookId);
      return `
        <button 
          class="qb-book ${isInCart ? 'qb-selected' : ''} ${!isAvailable ? 'qb-unavailable' : ''}"
          type="button" 
          data-book-id="${bookId}"
          onclick="${isAvailable && !isInCart ? `selectBookFromResults(${bookId})` : ''}" 
          ${!isAvailable || isInCart ? 'disabled' : ''}
        >
          <div class="qb-book-title">${book.title}</div>
          <div class="qb-book-sub">${book.author || 'Unknown'} | ISBN: ${book.isbn || 'N/A'}</div>
          <div class="qb-book-sub">
            ${isInCart 
              ? 'In Cart' 
              : (isAvailable ? `Available (${book.available_quantity})` : 'Not available')}
          </div>
        </button>
      `;
    }).join('');
    availableBooksContainer.innerHTML = resultsHtml;
  } else {
    availableBooksContainer.innerHTML = `
      <div style="color: #999; font-style: italic; text-align: center; padding: 15px;">
        ${smartBorrowState.searchQuery ? 'No books found matching your search' : 'No available books at the moment'}
      </div>
    `;
  }
}

// Render cart items
function renderCart() {
  const cartContainer = document.getElementById("bookDetailsContainer");
  if (!cartContainer) return;

  if (smartBorrowState.cartItems.length === 0) {
    cartContainer.innerHTML = '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">No book selected yet. Search below to add books.</div>';
    return;
  }

  const cartHtml = smartBorrowState.cartItems.map(item => `
    <div class="qb-cart-item" data-book-id="${item.bookId}">
      <div class="qb-cart-title">${item.title}</div>
      <div class="qb-qty">
        <button class="qb-qty-btn" type="button" onclick="changeQuantity(${item.bookId}, -1)" aria-label="Decrease quantity">-</button>
        <input class="qb-qty-input" type="number" min="1" max="${item.availableQty}" value="${item.qty}" onchange="setQuantity(${item.bookId}, this.value)" />
        <button class="qb-qty-btn" type="button" onclick="changeQuantity(${item.bookId}, 1)" aria-label="Increase quantity" ${item.qty >= item.availableQty ? 'disabled' : ''}>+</button>
      </div>
      <button class="qb-remove-btn" type="button" onclick="removeFromCart(${item.bookId})" aria-label="Remove from cart" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');

  cartContainer.innerHTML = cartHtml;
}

// Change quantity by delta
function changeQuantity(bookId, delta) {
  const item = smartBorrowState.cartItems.find(i => i.bookId === bookId);
  if (!item) return;

  const newQty = item.qty + delta;
  if (newQty < 1) {
    removeFromCart(bookId);
    return;
  }
  if (newQty > item.availableQty) return;

  item.qty = newQty;
  renderCart();
  updateConfirmButtonState();
}

// Set quantity directly from input
function setQuantity(bookId, value) {
  const item = smartBorrowState.cartItems.find(i => i.bookId === bookId);
  if (!item) return;

  const qty = parseInt(value, 10);
  if (isNaN(qty) || qty < 1) {
    removeFromCart(bookId);
    return;
  }

  item.qty = Math.min(qty, item.availableQty);
  renderCart();
  updateConfirmButtonState();
}

// Remove item from cart
function removeFromCart(bookId) {
  smartBorrowState.cartItems = smartBorrowState.cartItems.filter(i => i.bookId !== bookId);
  renderCart();
  updateSmartSearchDisplay();
  updateConfirmButtonState();
}

// Update confirm button state
function updateConfirmButtonState() {
  const confirmBtn = document.getElementById("confirmBorrowBtn");
  const returnDate = document.getElementById("returnDate");
  
  if (!confirmBtn) return;

  const hasBooks = smartBorrowState.cartItems.length > 0;
  const hasDate = returnDate && returnDate.value;

  console.log('[UpdateButton] Cart items:', smartBorrowState.cartItems.length, 'Return date:', hasDate);
  
  confirmBtn.disabled = !hasBooks || !hasDate;
}

// Handle borrow confirmation
async function handleBorrow() {
  const messageContainer = document.getElementById("borrowMessageContainer");
  const confirmBtn = document.getElementById("confirmBorrowBtn");
  const originalBtnText = confirmBtn.textContent;

  if (smartBorrowState.cartItems.length === 0) {
    if (messageContainer) {
      messageContainer.innerHTML = '<div style="background: #fff3cd; border: 2px solid #ffc107; padding: 12px; border-radius: 8px; margin: 10px 0;"><p style="margin: 0; color: #856404; font-weight: bold;">Please add books to cart first</p></div>';
    }
    return;
  }

  const returnDate = document.getElementById("returnDate").value;
  if (!returnDate) {
    if (messageContainer) {
      messageContainer.innerHTML = '<div style="background: #fff3cd; border: 2px solid #ffc107; padding: 12px; border-radius: 8px; margin: 10px 0;"><p style="margin: 0; color: #856404; font-weight: bold;">Please select a return date</p></div>';
    }
    return;
  }

  try {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processing...";
    if (messageContainer) {
      messageContainer.innerHTML = '<div style="background: #e3f2fd; border: 2px solid #2196f3; padding: 12px; border-radius: 8px; margin: 10px 0;"><p style="margin: 0; color: #1976d2; font-style: italic;">Processing your request...</p></div>';
    }

    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) {
      throw new Error("Session expired. Please log in again.");
    }

    let successCount = 0;
    let failedBooks = [];
    
    for (const item of smartBorrowState.cartItems) {
      try {
        for (let i = 0; i < item.qty; i++) {
          const response = await fetchWithCsrf("/api/students/borrow-book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: item.bookId,
              studentId: studentId,
              returnDate: returnDate,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || result.message || "Failed to borrow book");
          }
          
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to borrow ${item.title}:`, error);
        failedBooks.push({ title: item.title, error: error.message });
      }
    }

    if (messageContainer) {
      if (failedBooks.length === 0) {
        messageContainer.innerHTML = `
          <div style="background: #d4edda; border: 2px solid #28a745; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p style="margin: 0; color: #155724; font-weight: bold; font-size: 1.1em;">${successCount} book(s) borrowed successfully!</p>
            <p style="margin: 8px 0 0 0; color: #155724;">Due date: ${new Date(returnDate).toLocaleDateString()}</p>
          </div>
        `;
      } else if (successCount > 0) {
        messageContainer.innerHTML = `
          <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p style="margin: 0; color: #856404; font-weight: bold;">Partially successful</p>
            <p style="margin: 8px 0 0 0; color: #856404;">${successCount} book(s) borrowed, ${failedBooks.length} failed</p>
          </div>
        `;
      } else {
        throw new Error(`Failed to borrow books: ${failedBooks[0]?.error || 'Unknown error'}`);
      }
    }

    setTimeout(() => {
      smartBorrowState.cartItems = [];
      selectedBooks.clear();
      updateSelectionUI();
      updateSelectAllCheckbox();
      closeModal();
      if (messageContainer) messageContainer.innerHTML = '';
      const searchValue = document.querySelector(".search-bar input")?.value || "";
      const filterValue = document.querySelector(".filter-dropdown select")?.value || "";
      if (window.loadBooks) loadBooks(searchValue, filterValue);
    }, 2000);

  } catch (error) {
    console.error("Borrow error:", error);
    if (messageContainer) {
      messageContainer.innerHTML = `
        <div style="background: #f8d7da; border: 2px solid #dc3545; padding: 15px; border-radius: 8px; margin: 10px 0;">
          <p style="margin: 0; color: #721c24; font-weight: bold;">Error: ${error.message}</p>
        </div>
      `;
    }
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalBtnText;
  }
}

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
    window.location.href = "/login";
    return;
  }

  // Display user information
  const userNameEl = document.getElementById("userName");
  const userIDEl = document.getElementById("userID");
  if (userNameEl) userNameEl.textContent = sessionStorage.getItem("userName") || "Student";
  if (userIDEl) userIDEl.textContent = sessionStorage.getItem("userID") || "STD-0000-000";

  await loadAllBooks();
  setupFilterListeners();
});

// ESC key to close modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("modal-user");
    if (modal && !modal.classList.contains("qb-hidden")) {
      closeModal();
    }
  }
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
  sessionStorage.clear();
  window.location.href = "/login";
}

// Function to load all books initially (no filters)
async function loadAllBooks() {
  try {
    console.log('[LoadAllBooks] Fetching all books...');
    const response = await fetchWithCsrf('/api/books');
    
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
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to borrow books");

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

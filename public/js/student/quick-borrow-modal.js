// ================================================================
// Quick Borrow Modal — shared across ALL student pages
// Requires: /js/csrf-helper.js  (fetchWithCsrf)
//
// Public API:
//   showBorrowModal(bookId)     — open modal with a single book
//                                 pre-added to the cart
//   openSmartBorrowModal()      — open modal, preserving any
//                                 existing cart items
//   closeModal([event])         — close modal & reset state
//
// Page-level refresh hook:
//   window.onQuickBorrowSuccess(successCount) — called after a
//     successful borrow so each page can refresh its own view
// ================================================================

// ─── Shared modal state ─────────────────────────────────────────
let smartBorrowState = {
  cartItems:      [],   // [{ bookId, title, author, isbn, accessionNo, availableQty, qty }]
  availableBooks: [],   // full list fetched from /api/books
  filteredBooks:  [],   // search-filtered subset
  isLoading:      false,
  errorMessage:   null,
  searchQuery:    ''
};

// ─── Open modal (preserve existing cart) ────────────────────────
async function openSmartBorrowModal() {
  smartBorrowState = {
    cartItems:      smartBorrowState.cartItems || [],
    availableBooks: [],
    filteredBooks:  [],
    isLoading:      false,
    errorMessage:   null,
    searchQuery:    ''
  };

  sessionStorage.removeItem('currentBorrowBookId');
  _qbResetInputs();
  _qbShowModal();

  await loadAvailableBooksForModal();
  updateSmartSearchDisplay();
  updateConfirmButtonState();
  setTimeout(() => document.getElementById('smartSearchInput')?.focus(), 100);
}

// ─── Open modal and pre-add a specific book ──────────────────────
async function showBorrowModal(bookId) {
  smartBorrowState = {
    cartItems:      [],
    availableBooks: [],
    filteredBooks:  [],
    isLoading:      false,
    errorMessage:   null,
    searchQuery:    ''
  };

  sessionStorage.setItem('currentBorrowBookId', bookId);
  _qbResetInputs();
  _qbShowModal();

  // Load books first, then pre-add the target book from the loaded list
  await loadAvailableBooksForModal();

  const book = smartBorrowState.availableBooks.find(b => normalizeBookId(b) == bookId);
  if (book) {
    addToCart(book);
  }

  updateSmartSearchDisplay();
  updateConfirmButtonState();
  setTimeout(() => document.getElementById('smartSearchInput')?.focus(), 100);
}

// ─── Close modal ─────────────────────────────────────────────────
function closeModal(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const modal = document.getElementById('modal-user');
  if (modal) {
    modal.classList.add('qb-hidden');
    modal.style.display = '';
    modal.setAttribute('aria-hidden', 'true');
  }

  smartBorrowState = {
    cartItems:      [],
    availableBooks: [],
    filteredBooks:  [],
    isLoading:      false,
    errorMessage:   null,
    searchQuery:    ''
  };

  const searchInput = document.getElementById('smartSearchInput');
  if (searchInput) searchInput.value = '';

  sessionStorage.removeItem('currentBorrowBookId');
}

// ─── Fetch available books ───────────────────────────────────────
async function loadAvailableBooksForModal() {
  smartBorrowState.isLoading = true;
  smartBorrowState.errorMessage = null;
  updateSmartSearchDisplay();

  try {
    const response = await fetchWithCsrf('/api/books?ts=' + Date.now());
    if (!response.ok) throw new Error('Failed to fetch books: ' + response.status);

    const result = await response.json();
    let books = result.data || result || [];

    // Keep only books with copies available
    books = books.filter(b => {
      const qty = Number(b.available_quantity ?? b.available_qty ?? b.quantity ?? 0);
      return qty > 0;
    });

    // Normalise IDs
    books = books.map(b => ({
      ...b,
      id:                 b.book_id ?? b.id ?? b.accession_no,
      available_quantity: Number(b.available_quantity ?? b.available_qty ?? b.quantity ?? 0)
    }));

    smartBorrowState.availableBooks = books;
    smartBorrowState.filteredBooks  = books;
    smartBorrowState.errorMessage   = null;
  } catch (error) {
    console.error('[QuickBorrow] loadAvailableBooksForModal:', error);
    smartBorrowState.availableBooks = [];
    smartBorrowState.filteredBooks  = [];
    smartBorrowState.errorMessage   = 'Error loading books. Please try again.';
  } finally {
    smartBorrowState.isLoading = false;
    updateSmartSearchDisplay();
  }
}

// ─── Search ───────────────────────────────────────────────────────
let _qbSearchTimeout;

function handleSmartSearch(query) {
  clearTimeout(_qbSearchTimeout);
  _qbSearchTimeout = setTimeout(() => performSmartSearch(query), 400);
}

function performSmartSearch(query) {
  smartBorrowState.searchQuery = (query || '').trim();

  if (!smartBorrowState.searchQuery) {
    smartBorrowState.filteredBooks = smartBorrowState.availableBooks;
    smartBorrowState.errorMessage  = null;
    updateSmartSearchDisplay();
    return;
  }

  const q = smartBorrowState.searchQuery.toLowerCase();
  const filtered = smartBorrowState.availableBooks.filter(b =>
    (b.title  && b.title.toLowerCase().includes(q))  ||
    (b.author && b.author.toLowerCase().includes(q)) ||
    (b.isbn   && b.isbn.toString().toLowerCase().includes(q))
  );

  smartBorrowState.filteredBooks = filtered;
  smartBorrowState.errorMessage  = filtered.length === 0
    ? 'No books found matching your search'
    : null;

  updateSmartSearchDisplay();
}

// ─── Cart helpers ─────────────────────────────────────────────────
function normalizeBookId(book) {
  return book.book_id ?? book.id ?? book.accession_no;
}

function addToCart(book) {
  if (!book) return;

  const bookId   = normalizeBookId(book);
  const existing = smartBorrowState.cartItems.find(i => i.bookId == bookId);

  if (existing) {
    if (existing.qty < existing.availableQty) existing.qty++;
  } else {
    smartBorrowState.cartItems.push({
      bookId:      bookId,
      title:       book.title,
      author:      book.author || 'Unknown',
      isbn:        book.isbn   || 'N/A',
      accessionNo: book.accession_no || book.accessionNo || book.isbn,
      availableQty: Number(book.available_quantity ?? book.available_qty ?? book.quantity ?? 1),
      qty:          1
    });
  }

  updateSmartSearchDisplay();
  updateConfirmButtonState();
}

function selectBookFromResults(bookId) {
  const book = smartBorrowState.filteredBooks.find(b => normalizeBookId(b) == bookId);
  if (book && book.available_quantity > 0) {
    addToCart(book);
    smartBorrowState.errorMessage = null;
    updateSmartSearchDisplay();
    updateConfirmButtonState();
  }
}

function removeFromCart(bookId) {
  smartBorrowState.cartItems = smartBorrowState.cartItems.filter(i => i.bookId !== bookId);
  renderCart();
  updateSmartSearchDisplay();
  updateConfirmButtonState();
}

function changeQuantity(bookId, delta) {
  const item = smartBorrowState.cartItems.find(i => i.bookId === bookId);
  if (!item) return;

  const newQty = item.qty + delta;
  if (newQty < 1) { removeFromCart(bookId); return; }
  if (newQty > item.availableQty) return;

  item.qty = newQty;
  renderCart();
  updateConfirmButtonState();
}

function setQuantity(bookId, value) {
  const item = smartBorrowState.cartItems.find(i => i.bookId === bookId);
  if (!item) return;

  const qty = parseInt(value, 10);
  if (isNaN(qty) || qty < 1) { removeFromCart(bookId); return; }

  item.qty = Math.min(qty, item.availableQty);
  renderCart();
  updateConfirmButtonState();
}

// ─── UI rendering ─────────────────────────────────────────────────
function renderCart() {
  const cartContainer = document.getElementById('bookDetailsContainer');
  if (!cartContainer) return;

  // Update badge count
  const badge      = document.getElementById('qbCartCount');
  const totalBooks = smartBorrowState.cartItems.reduce((sum, i) => sum + (i.qty || 1), 0);
  if (badge) {
    badge.textContent   = totalBooks;
    badge.style.display = totalBooks > 0 ? '' : 'none';
  }

  if (smartBorrowState.cartItems.length === 0) {
    cartContainer.innerHTML =
      '<div style="color:#999;font-style:italic;text-align:center;padding:20px;">No book selected yet. Search below to add books.</div>';
    return;
  }

  cartContainer.innerHTML = smartBorrowState.cartItems.map(item => `
    <div class="qb-cart-item" data-book-id="${item.bookId}">
      <div class="qb-cart-title">${item.title}</div>
      <div class="qb-qty">
        <button class="qb-qty-btn" type="button"
                onclick="changeQuantity(${item.bookId}, -1)"
                aria-label="Decrease quantity">-</button>
        <input class="qb-qty-input" type="number"
               min="1" max="${item.availableQty}" value="${item.qty}"
               onchange="setQuantity(${item.bookId}, this.value)" />
        <button class="qb-qty-btn" type="button"
                onclick="changeQuantity(${item.bookId}, 1)"
                aria-label="Increase quantity"
                ${item.qty >= item.availableQty ? 'disabled' : ''}>+</button>
      </div>
      <button class="qb-remove-btn" type="button"
              onclick="removeFromCart(${item.bookId})"
              aria-label="Remove from cart" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
}

function updateSmartSearchDisplay() {
  const cartContainer   = document.getElementById('bookDetailsContainer');
  const booksContainer  = document.getElementById('availableBooksContainer');
  if (!cartContainer || !booksContainer) return;

  renderCart();

  if (smartBorrowState.isLoading) {
    booksContainer.innerHTML =
      '<div style="color:#4ba14e;font-style:italic;text-align:center;padding:15px;">Loading books...</div>';
    return;
  }

  if (smartBorrowState.errorMessage) {
    booksContainer.innerHTML =
      `<div style="color:#f44336;font-weight:bold;text-align:center;padding:15px;">${smartBorrowState.errorMessage}</div>`;
    return;
  }

  const books = smartBorrowState.filteredBooks;

  if (books.length > 0) {
    booksContainer.innerHTML = books.map(book => {
      const bookId      = normalizeBookId(book);
      const isAvailable = book.available_quantity > 0;
      const isInCart    = smartBorrowState.cartItems.some(i => i.bookId == bookId);
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
            ${isInCart ? 'In Cart' : (isAvailable ? `Available (${book.available_quantity})` : 'Not available')}
          </div>
        </button>
      `;
    }).join('');
  } else {
    booksContainer.innerHTML =
      `<div style="color:#999;font-style:italic;text-align:center;padding:15px;">
        ${smartBorrowState.searchQuery
          ? 'No books found matching your search'
          : 'No available books at the moment'}
       </div>`;
  }
}

function updateConfirmButtonState() {
  const confirmBtn = document.getElementById('confirmBorrowBtn');
  const returnDate = document.getElementById('returnDate');
  if (!confirmBtn) return;
  confirmBtn.disabled = !smartBorrowState.cartItems.length || !returnDate?.value;
}

// ─── Borrow submission ────────────────────────────────────────────
async function handleBorrow() {
  const msgContainer  = document.getElementById('borrowMessageContainer');
  const confirmBtn    = document.getElementById('confirmBorrowBtn');
  const originalLabel = confirmBtn ? confirmBtn.textContent : 'Done';

  if (smartBorrowState.cartItems.length === 0) {
    if (msgContainer) msgContainer.innerHTML =
      '<div style="background:#fff3cd;border:2px solid #ffc107;padding:12px;border-radius:8px;margin:10px 0;"><p style="margin:0;color:#856404;font-weight:bold;">Please add books to cart first</p></div>';
    return;
  }

  const returnDate = document.getElementById('returnDate')?.value;
  if (!returnDate) {
    if (msgContainer) msgContainer.innerHTML =
      '<div style="background:#fff3cd;border:2px solid #ffc107;padding:12px;border-radius:8px;margin:10px 0;"><p style="margin:0;color:#856404;font-weight:bold;">Please select a return date</p></div>';
    return;
  }

  const studentId = sessionStorage.getItem('studentId');
  if (!studentId) {
    if (msgContainer) msgContainer.innerHTML =
      '<div style="background:#f8d7da;border:2px solid #dc3545;padding:12px;border-radius:8px;margin:10px 0;"><p style="margin:0;color:#721c24;font-weight:bold;">Session expired. Please log in again.</p></div>';
    return;
  }

  try {
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Processing...'; }
    if (msgContainer) msgContainer.innerHTML =
      '<div style="background:#e3f2fd;border:2px solid #2196f3;padding:12px;border-radius:8px;margin:10px 0;"><p style="margin:0;color:#1976d2;font-style:italic;">Processing your request...</p></div>';

    let successCount  = 0;
    const failedBooks = [];
    const emailWarnings = [];

    for (const item of smartBorrowState.cartItems) {
      for (let i = 0; i < item.qty; i++) {
        try {
          const response = await fetchWithCsrf('/api/students/borrow-book', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ bookId: item.bookId, studentId, returnDate })
          });
          if (response.status === 401) throw new Error('Session expired. Please log in again.');
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || result.message || 'Failed to borrow book');

          const emailStatus = result?.data?.emailStatus || result?.emailStatus;
          if (emailStatus && emailStatus.success === false) {
            emailWarnings.push({ title: item.title, error: emailStatus.error || 'Pickup QR email not sent' });
          }

          successCount++;
        } catch (err) {
          failedBooks.push({ title: item.title, error: err.message });
        }
      }
    }

    if (msgContainer) {
      if (failedBooks.length === 0) {
        msgContainer.innerHTML =
          `<div style="background:#d4edda;border:2px solid #28a745;padding:15px;border-radius:8px;margin:10px 0;">
             <p style="margin:0;color:#155724;font-weight:bold;font-size:1.1em;">${successCount} book(s) borrowed successfully!</p>
             <p style="margin:8px 0 0 0;color:#155724;">Due date: ${new Date(returnDate).toLocaleDateString()}</p>
             ${emailWarnings.length ? `<p style="margin:8px 0 0 0;color:#856404;">Borrowing succeeded, but ${emailWarnings.length} pickup QR email(s) failed to send.</p>` : ''}
           </div>`;
      } else if (successCount > 0) {
        msgContainer.innerHTML =
          `<div style="background:#fff3cd;border:2px solid #ffc107;padding:15px;border-radius:8px;margin:10px 0;">
             <p style="margin:0;color:#856404;font-weight:bold;">Partially successful: ${successCount} borrowed, ${failedBooks.length} failed</p>
             ${emailWarnings.length ? `<p style="margin:8px 0 0 0;color:#856404;">Also, ${emailWarnings.length} pickup QR email(s) failed to send.</p>` : ''}
           </div>`;
      } else {
        throw new Error('Failed to borrow books: ' + (failedBooks[0]?.error || 'Unknown error'));
      }
    }

    // Close after delay, then trigger page-specific refresh
    setTimeout(() => {
      closeModal();
      if (msgContainer) msgContainer.innerHTML = '';
      if (typeof window.onQuickBorrowSuccess === 'function') {
        window.onQuickBorrowSuccess(successCount);
      }
    }, 2000);

  } catch (error) {
    console.error('[QuickBorrow] handleBorrow:', error);
    if (msgContainer) msgContainer.innerHTML =
      `<div style="background:#f8d7da;border:2px solid #dc3545;padding:15px;border-radius:8px;margin:10px 0;"><p style="margin:0;color:#721c24;font-weight:bold;">Error: ${error.message}</p></div>`;
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = originalLabel; }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────
function _qbResetInputs() {
  const searchInput = document.getElementById('smartSearchInput');
  if (searchInput) searchInput.value = '';

  const today   = new Date();
  const minDate = new Date(today); minDate.setDate(today.getDate() + 1);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 7);

  const dateInput = document.getElementById('returnDate');
  if (dateInput) {
    dateInput.min   = minDate.toISOString().split('T')[0];
    dateInput.max   = maxDate.toISOString().split('T')[0];
    dateInput.value = maxDate.toISOString().split('T')[0];
  }
}

function _qbShowModal() {
  const modal = document.getElementById('modal-user');
  if (!modal) { console.error('[QuickBorrow] #modal-user not found'); return; }
  modal.classList.remove('qb-hidden');
  modal.style.display = 'grid';
  modal.setAttribute('aria-hidden', 'false');
}

// ESC key closes the modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal-user');
    if (modal && !modal.classList.contains('qb-hidden')) closeModal();
  }
});

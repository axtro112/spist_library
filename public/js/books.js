let currentBookIdForDeletion = null;
let students = [];

function closeModal() {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => (modal.style.display = "none"));
  document.body.classList.remove("modal-open");
  currentBookIdForDeletion = null;
}

function showModal(modalId) {
  document.getElementById(modalId).style.display = "flex";
  document.body.classList.add("modal-open");
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  const isLoggedIn = sessionStorage.getItem("isLoggedIn");
  const userRole = sessionStorage.getItem("userRole");

  if (!isLoggedIn || !userRole) {
    alert("Please log in to access this page.");
    window.location.href = "/login";
    return;
  }

  const addBookForm = document.getElementById("addBookForm");
  const editBookForm = document.getElementById("editBookForm");
  const deleteConfirmBtn = document.querySelector(".delete-confirm-btn");

  if (addBookForm) {
    addBookForm.addEventListener("submit", handleAddBook);
  }

  if (editBookForm) {
    editBookForm.addEventListener("submit", handleEditBook);
  }

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", handleDeleteBook);
  }

  const statusEdit = document.getElementById("statusEdit");
  if (statusEdit) {
    statusEdit.addEventListener("change", handleStatusChange);
  }

  await Promise.all([loadBooks(), loadStudents(), loadCategories()]);
  
  // Set up search and filter event listeners
  setupSearchAndFilters();
});

// Load unique categories from all books to populate the dropdown
async function loadCategories() {
  console.log('[Books Filter] Loading categories...');
  try {
    const response = await fetchWithCsrf('/api/admin/books');
    if (!response.ok) {
      console.error('[Books Filter] Failed to fetch books for categories');
      return;
    }
    
    const result = await response.json();
    const books = result.data || []; // Extract books from response wrapper
    console.log('[Books Filter] Total books loaded:', books.length);
    
    const categories = [...new Set(books.map(b => b.category).filter(c => c && c.trim()))];
    categories.sort();
    console.log('[Books Filter] Unique categories found:', categories);
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      // Keep the "All Categories" option and add the rest
      const currentValue = categoryFilter.value;
      categoryFilter.innerHTML = '<option value="">All Categories</option>';
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
      });
      categoryFilter.value = currentValue;
      console.log('[Books Filter] Category dropdown populated with', categories.length, 'categories');
    } else {
      console.error('[Books Filter] Category filter element not found!');
    }
  } catch (error) {
    console.error('[Books Filter] Error loading categories:', error);
  }
}

// Search and Filter functionality
function setupSearchAndFilters() {
  console.log('[Books Filter] Initializing filters...');
  
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const clearFiltersBtn = document.getElementById('clearFilters');
  
  console.log('[Books Filter] Elements found:', {
    searchInput: !!searchInput,
    categoryFilter: !!categoryFilter,
    statusFilter: !!statusFilter,
    clearFiltersBtn: !!clearFiltersBtn
  });
  
  // Check if all required elements exist
  if (!searchInput || !categoryFilter || !statusFilter || !clearFiltersBtn) {
    console.error('[Books Filter] Some filter elements not found! Cannot initialize filters.');
    return;
  }
  
  // Debounce search input to avoid too many requests
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadBooks();
    }, 300); // Wait 300ms after user stops typing
  });
  
  // Apply filters immediately when changed
  categoryFilter.addEventListener('change', () => {
    console.log('[Books Filter] Category changed to:', categoryFilter.value);
    loadBooks();
  });
  
  statusFilter.addEventListener('change', () => {
    console.log('[Books Filter] Status changed to:', statusFilter.value);
    loadBooks();
  });
  
  // Clear all filters button
  clearFiltersBtn.addEventListener('click', () => {
    console.log('[Books Filter] Clearing all filters');
    searchInput.value = '';
    categoryFilter.value = '';
    statusFilter.value = '';
    loadBooks();
  });
  
  console.log('[Books Filter] All event listeners attached successfully');
}

function getFilterParams() {
  const search = document.getElementById('searchInput')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';
  
  console.log('[Books Filter] Current filter values:', { search, category, status });
  
  const params = new URLSearchParams();
  if (search.trim()) params.append('search', search.trim());
  if (category.trim()) params.append('category', category.trim());
  if (status.trim()) params.append('status', status.trim());
  
  console.log('[Books Filter] Filter params:', params.toString());
  
  return params.toString();
}

async function loadBooks() {
  try {
    const filterParams = getFilterParams();
    const url = `/api/admin/books${filterParams ? '?' + filterParams : ''}`;
    
    console.log("[FRONTEND] Fetching books from:", url);
    const response = await fetchWithCsrf(url);
    console.log("[FRONTEND] Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const data = await response.json();
      console.error("[FRONTEND] API error:", data);
      throw new Error(data.message || "Failed to fetch books");
    }
    const result = await response.json();
    const books = result.data || []; // Extract books from response wrapper
    console.log("[FRONTEND] Books data received:", books.length, "books");
    displayBooks(books);
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to load books. Please try again later.");
  }
}

// Auto-reload function for refreshing books and statistics after CRUD operations
async function reloadBooksAndStats() {
  await loadBooks();
  // Also refresh dashboard stats if totalBooks element exists (dashboard page)
  const totalBooksElement = document.getElementById('totalBooks');
  if (totalBooksElement && typeof refreshDashboardStats === 'function') {
    await refreshDashboardStats();
  }
}

function displayBooks(books) {
  const tbody = document.querySelector(".user-table tbody");
  console.log("[FRONTEND] displayBooks called with", books.length, "books");
  console.log("[FRONTEND] Table tbody element found:", !!tbody);
  
  if (!tbody) {
    console.error("[FRONTEND] ERROR: Table tbody not found!");
    return;
  }
  
  tbody.innerHTML = "";

  if (books.length === 0) {
    console.warn("[FRONTEND] No books to display (empty array)");
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No books found</td></tr>';
    return;
  }

  books.forEach((book, index) => {
    console.log(`[FRONTEND] Processing book ${index + 1}/${books.length}:`, book.title);
    const row = createBookRow(book);
    tbody.appendChild(row);
  });
  
  console.log("[FRONTEND] Successfully rendered", books.length, "book rows");
  
  // Clear bulk selection when table is reloaded
  if (typeof clearSelection === 'function') {
    clearSelection();
  }
}

function createBookRow(book) {
  const row = document.createElement("tr");
  
  // Add data attribute for highlighting
  if (book.id) {
    row.setAttribute('data-book-id', book.id);
  }
  
  // Make row clickable - cursor pointer
  row.style.cursor = 'pointer';
  
  // Determine availability status
  const availableQty = book.available_quantity !== undefined ? book.available_quantity : book.quantity;
  const totalQty = book.quantity || 1;
  let statusText = `Available (${availableQty}/${totalQty})`;
  let statusClass = "status-available";
  
  if (availableQty === 0) {
    statusText = "All Borrowed";
    statusClass = "status-borrowed";
  }

  const isBorrowed =
    book.current_status && (book.current_status.toLowerCase() === "borrowed" ||
    book.current_status.toLowerCase() === "overdue");

  // Gmail-style bulk operations: Add checkbox column
  row.innerHTML = `
    <td class="checkbox-col">
      <input 
        type="checkbox" 
        class="book-row-checkbox" 
        data-book-id="${book.id}"
        onchange="handleRowCheckboxChange(this)"
      />
    </td>
    <td>${book.id}</td>
    <td>${book.title}</td>
    <td>${book.author}</td>
    <td>${availableQty}/${totalQty}</td>
    <td>${book.category}</td>
    <td>${book.isbn}</td>
    <td>${formatDate(book.added_date)}</td>
    <td class="${statusClass}">${statusText}</td>
    <td class="borrowed-by ${isBorrowed ? "active" : ""}">${
    book.borrowed_by || "-"
  }</td>
    <td>
      <div class="actions-dropdown">
        <button class="btn btn-actions dropdown-toggle" type="button" aria-expanded="false" aria-haspopup="true" data-book-id="${book.id}">
          Actions <span class="caret-icon">&#9662;</span>
        </button>
        <ul class="actions-menu" role="menu">
          <li role="none"><a href="#" class="dropdown-item action-scan-qr" role="menuitem" data-book-id="${book.id}"><span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;margin-right:6px;">qr_code_2</span>Scan QR</a></li>
          <li role="none"><a href="#" class="dropdown-item action-edit" role="menuitem" data-book='${JSON.stringify(book)}'><span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;margin-right:6px;">edit</span>Edit</a></li>
        </ul>
      </div>
      <button class="btn delete-btn" data-book-id="${book.id}" ${
    isBorrowed ? "disabled" : ""
  }>Delete</button>
    </td>
  `;

  attachRowEventListeners(row);

  return row;
}

function attachRowEventListeners(row) {
  // Scan QR and Edit are handled by document-level event delegation (Actions dropdown)
  const deleteBtn = row.querySelector(".delete-btn");
  const bookId = row.getAttribute('data-book-id');

  deleteBtn.addEventListener("click", function (e) {
    e.stopPropagation(); // Prevent row click
    const bookId = this.dataset.bookId;
    const modalDelete = document.getElementById("modalDelete");
    modalDelete.dataset.bookId = bookId;
    showModal("modalDelete");
  });
  
  // Add click handler to row to open Book Profile Modal
  row.addEventListener('click', function(e) {
    // Don't trigger if clicking on:
    // - Checkbox
    // - Actions button/menu
    // - Delete button
    if (e.target.closest('.checkbox-col') || 
        e.target.closest('.actions-dropdown') || 
        e.target.closest('.delete-btn')) {
      return;
    }
    
    console.log('[Books] Row clicked, bookId:', bookId);
    
    // Open the Book Profile Modal
    if (bookId) {
      if (typeof openBookProfileModal === 'function') {
        console.log('[Books] Calling openBookProfileModal...');
        openBookProfileModal(bookId);
      } else {
        console.error('[Books] openBookProfileModal function not found!');
        alert('Book profile modal is not available. Please refresh the page.');
      }
    } else {
      console.error('[Books] No bookId found for this row');
    }
  });
}

// ── Actions Dropdown: Event Delegation ──────────────────────────────────────

/** Close every open Actions dropdown on the page */
function closeAllActionDropdowns() {
  document.querySelectorAll('.actions-dropdown.show').forEach(function (dd) {
    dd.classList.remove('show');
    var toggle = dd.querySelector('.dropdown-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Single document-level click listener that handles:
 *  1) Toggling the Actions dropdown open / closed
 *  2) "Scan QR" item  → bookCopyManager.showCopies()
 *  3) "Edit" item     → handleEditClick()
 *  4) Closing dropdowns when clicking anywhere else
 */
document.addEventListener('click', function (e) {

  /* ── 1. Toggle button ─────────────────────────────────────────────── */
  var toggleBtn = e.target.closest('.btn-actions.dropdown-toggle');
  if (toggleBtn) {
    e.preventDefault();
    e.stopPropagation();
    var dropdown = toggleBtn.closest('.actions-dropdown');
    var isOpen = dropdown.classList.contains('show');
    closeAllActionDropdowns();          // close any other open dropdown first
    if (!isOpen) {
      dropdown.classList.add('show');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    return;
  }

  /* ── 2. Scan QR action ────────────────────────────────────────────── */
  var scanQrItem = e.target.closest('.action-scan-qr');
  if (scanQrItem) {
    e.preventDefault();
    var bookId = scanQrItem.dataset.bookId;
    if (!bookId) { console.error('Actions dropdown: missing book ID for Scan QR'); return; }
    closeAllActionDropdowns();
    if (typeof bookCopyManager !== 'undefined') {
      bookCopyManager.showCopies(bookId);
    } else {
      alert('Book copy manager not loaded. Please refresh the page.');
    }
    return;
  }

  /* ── 3. Edit action ───────────────────────────────────────────────── */
  var editItem = e.target.closest('.action-edit');
  if (editItem) {
    e.preventDefault();
    var bookDataStr = editItem.dataset.book;
    if (!bookDataStr) { console.error('Actions dropdown: missing book data for Edit'); return; }
    closeAllActionDropdowns();
    try {
      var bookData = JSON.parse(bookDataStr);
      handleEditClick(bookData);
    } catch (err) {
      console.error('Actions dropdown: failed to parse book data', err);
      alert('Error loading book data. Please try again.');
    }
    return;
  }

  /* ── 4. Click outside → close all ─────────────────────────────────── */
  if (!e.target.closest('.actions-dropdown')) {
    closeAllActionDropdowns();
  }
});

function handleEditClick(book) {
  if (!book?.id) {
    console.error("Invalid book data:", book);
    alert("Error loading book data. Please try again.");
    return;
  }

  const formElements = {
    title: document.getElementById("titleEdit"),
    author: document.getElementById("authorEdit"),
    quantity: document.getElementById("No#BooksEdit"),
    category: document.getElementById("categoryEdit"),
    isbn: document.getElementById("isbnEdit"),
    status: document.getElementById("statusEdit"),
    student: document.getElementById("studentEdit"),
  };

  if (!Object.values(formElements).every((element) => element)) {
    console.error("Required form elements not found");
    alert("Error loading edit form. Please try again.");
    return;
  }

  formElements.title.value = book.title || "";
  formElements.author.value = book.author || "";
  formElements.quantity.value = book.quantity || "";
  formElements.category.value = book.category || "";
  formElements.isbn.value = book.isbn || "";

  const isBorrowed = book.current_status?.toLowerCase() === "borrowed";
  formElements.status.value = isBorrowed ? "borrowed" : "available";

  const studentSelectGroup = document.getElementById("studentSelectGroup");
  if (isBorrowed) {
    studentSelectGroup.style.display = "block";
    formElements.student.required = true;

    if (formElements.student.options.length <= 1) {
      students.forEach((student) => {
        const option = document.createElement("option");
        option.value = student.student_id;
        option.textContent = `${student.fullname} (${student.email})`;
        formElements.student.appendChild(option);
      });
    }

    if (book.borrowed_by) {
      const currentBorrower = students.find(
        (s) => s.fullname === book.borrowed_by
      );
      if (currentBorrower) {
        formElements.student.value = currentBorrower.student_id;
      }
    }
  } else {
    studentSelectGroup.style.display = "none";
    formElements.student.required = false;
  }

  const modal = document.getElementById("adminEdit");
  modal.dataset.bookId = book.id;
  modal.style.display = "flex";
  document.body.classList.add("modal-open");
}

async function handleAddBook(e) {
  e.preventDefault();

  const quantityValue = document.getElementById("No#Books").value;
  const adminId = sessionStorage.getItem("adminId"); // Get admin ID from session
  
  const formData = {
    title: document.getElementById("title").value.trim(),
    author: document.getElementById("author").value.trim(),
    quantity: quantityValue ? parseInt(quantityValue, 10) : 1,
    category: document.getElementById("category").value.trim(),
    isbn: document.getElementById("isbn").value.trim(),
    adminId: adminId ? parseInt(adminId, 10) : null, // Include admin ID
  };

  // Validate required fields
  if (!formData.title || !formData.author || formData.quantity === null || !formData.category || !formData.isbn) {
    alert("Please fill in all fields");
    return;
  }

  if (!validateISBN(formData.isbn)) {
    alert("Please enter a valid ISBN/barcode");
    return;
  }

  try {
    const response = await fetchWithCsrf("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to add book");

    alert("Book added successfully!");
    closeModal();
    await reloadBooksAndStats();
    document.getElementById("addBookForm").reset();
  } catch (error) {
    console.error("Error:", error);
    alert(error.message || "Failed to add book. Please try again.");
  }
}

async function handleEditBook(e) {
  e.preventDefault();

  const bookId = document.getElementById("adminEdit").dataset.bookId;
  const quantityValue = document.getElementById("No#BooksEdit").value;
  
  const formData = {
    title: document.getElementById("titleEdit").value.trim(),
    author: document.getElementById("authorEdit").value.trim(),
    quantity: quantityValue ? parseInt(quantityValue, 10) : null,
    category: document.getElementById("categoryEdit").value.trim(),
    isbn: document.getElementById("isbnEdit").value.trim(),
    status: document.getElementById("statusEdit").value,
  };

  // Validate required fields
  if (!formData.title || !formData.author || formData.quantity === null || !formData.category || !formData.isbn) {
    alert("Please fill in all fields");
    return;
  }

  if (formData.status === "borrowed") {
    const studentId = document.getElementById("studentEdit").value;
    if (!studentId) {
      alert("Please select a student when status is borrowed");
      return;
    }
    formData.student_id = studentId;
  }

  if (!validateISBN(formData.isbn)) {
    alert("Please enter a valid ISBN/barcode");
    return;
  }

  try {
    console.log("Sending update request with data:", formData);
    console.log("Quantity being sent:", formData.quantity, "Type:", typeof formData.quantity);
    const response = await fetchWithCsrf(`/api/admin/books/${bookId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to update book");

    alert("Book updated successfully!");
    closeModal();
    await reloadBooksAndStats();
  } catch (error) {
    console.error("Error:", error);
    alert(error.message || "Failed to update book. Please try again.");
  }
}

async function handleDeleteBook() {
  const modal = document.getElementById("modalDelete");
  const bookId = modal.dataset.bookId;

  if (!bookId) {
    console.error("No book ID found for deletion");
    alert("Error: Could not find book to delete");
    return;
  }

  try {
    const response = await fetchWithCsrf(`/api/admin/books/${bookId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to delete book");

    alert(data.message || "Book deleted successfully");
    closeModal();
    await reloadBooksAndStats();
  } catch (error) {
    console.error("Error deleting book:", error);
    alert(error.message || "Failed to delete book. Please try again.");
  }
}

function validateISBN(isbn) {
  // Accept any non-empty ISBN/barcode format
  return isbn && isbn.trim().length > 0;
}

document.addEventListener("DOMContentLoaded", function () {
  const deleteConfirmBtn = document.querySelector(".delete-confirm-btn");
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", handleDeleteBook);
  }

  const cancelButtons = document.querySelectorAll(".cancel-btn");
  cancelButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });
});

async function loadStudents() {
  try {
    const response = await fetchWithCsrf("/api/admin/students");
    if (!response.ok) {
      throw new Error("Failed to fetch students");
    }
    const result = await response.json();
    students = result.data || []; // Extract students from response wrapper
  } catch (error) {
    console.error("Error loading students:", error);
  }
}

function handleStatusChange(e) {
  const studentSelectGroup = document.getElementById("studentSelectGroup");
  const studentSelect = document.getElementById("studentEdit");

  if (e.target.value === "borrowed") {
    studentSelectGroup.style.display = "block";
    studentSelect.required = true;

    if (studentSelect.options.length <= 1) {
      students.forEach((student) => {
        const option = document.createElement("option");
        option.value = student.student_id;
        option.textContent = `${student.fullname} (${student.email})`;
        studentSelect.appendChild(option);
      });
    }
  } else {
    studentSelectGroup.style.display = "none";
    studentSelect.required = false;
    studentSelect.value = "";
  }
}
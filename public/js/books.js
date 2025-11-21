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

  await Promise.all([loadBooks(), loadStudents()]);
});

async function loadBooks() {
  try {
    const response = await fetch("/api/admin/books");
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to fetch books");
    }
    const books = await response.json();
    console.log("Books data received:", books);
    displayBooks(books);
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to load books. Please try again later.");
  }
}

function displayBooks(books) {
  const tbody = document.querySelector(".user-table tbody");
  tbody.innerHTML = "";

  books.forEach((book) => {
    console.log("Processing book:", book);
    const row = createBookRow(book);
    tbody.appendChild(row);
  });
}

function createBookRow(book) {
  const row = document.createElement("tr");
  const statusClass =
    book.current_status.toLowerCase() === "borrowed" ||
    book.current_status.toLowerCase() === "overdue"
      ? "status-borrowed"
      : "status-available";

  const isBorrowed =
    book.current_status.toLowerCase() === "borrowed" ||
    book.current_status.toLowerCase() === "overdue";

  row.innerHTML = `
    <td>${book.id}</td>
    <td>${book.title}</td>
    <td>${book.author}</td>
    <td>${book.quantity !== null && book.quantity !== undefined ? book.quantity : ''}</td>
    <td>${book.category}</td>
    <td>${book.isbn}</td>
    <td>${formatDate(book.added_date)}</td>
    <td class="${statusClass}">${book.current_status}</td>
    <td class="borrowed-by ${isBorrowed ? "active" : ""}">${
    book.borrowed_by || "-"
  }</td>
    <td>
      <button class="btn edit-btn" data-book='${JSON.stringify(
        book
      )}'>Edit</button>
      <button class="btn delete-btn" data-book-id="${book.id}" ${
    isBorrowed ? "disabled" : ""
  }>Delete</button>
    </td>
  `;

  attachRowEventListeners(row);

  return row;
}

function attachRowEventListeners(row) {
  const editBtn = row.querySelector(".edit-btn");
  const deleteBtn = row.querySelector(".delete-btn");

  editBtn.addEventListener("click", function () {
    const bookData = JSON.parse(this.dataset.book);
    handleEditClick(bookData);
  });

  deleteBtn.addEventListener("click", function () {
    const bookId = this.dataset.bookId;
    const modalDelete = document.getElementById("modalDelete");
    modalDelete.dataset.bookId = bookId;
    showModal("modalDelete");
  });
}

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
  
  const formData = {
    title: document.getElementById("title").value.trim(),
    author: document.getElementById("author").value.trim(),
    quantity: quantityValue ? parseInt(quantityValue, 10) : null,
    category: document.getElementById("category").value.trim(),
    isbn: document.getElementById("isbn").value.trim(),
  };

  // Validate required fields
  if (!formData.title || !formData.author || formData.quantity === null || !formData.category || !formData.isbn) {
    alert("Please fill in all fields");
    return;
  }

  if (!validateISBN(formData.isbn)) {
    alert("Please enter a valid 10 or 13-digit ISBN number");
    return;
  }

  try {
    const response = await fetch("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to add book");

    alert("Book added successfully!");
    closeModal();
    await loadBooks();
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
    alert("Please enter a valid 10 or 13-digit ISBN number");
    return;
  }

  try {
    console.log("Sending update request with data:", formData);
    console.log("Quantity being sent:", formData.quantity, "Type:", typeof formData.quantity);
    const response = await fetch(`/api/admin/books/${bookId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to update book");

    alert("Book updated successfully!");
    closeModal();
    await loadBooks();
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
    const response = await fetch(`/api/admin/books/${bookId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to delete book");

    alert(data.message || "Book deleted successfully");
    closeModal();
    await loadBooks();
  } catch (error) {
    console.error("Error deleting book:", error);
    alert(error.message || "Failed to delete book. Please try again.");
  }
}

function validateISBN(isbn) {
  const isbnRegex = /^(?:\d{10}|\d{13}|\d{3}-\d{10})$/;
  return isbnRegex.test(isbn.replace(/-/g, ""));
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
    const response = await fetch("/api/admin/students");
    if (!response.ok) {
      throw new Error("Failed to fetch students");
    }
    students = await response.json();
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

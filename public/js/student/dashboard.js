/**
 * student/dashboard.js
 * Student Dashboard module.
 * Requires: /js/csrf-helper.js, /js/api.js, /js/core/utils.js
 * Exposed as window.Student.Dashboard
 */
(function (Student) {
  "use strict";

  /* ------------------------------------------------------------------
   * Auth guard
   * ------------------------------------------------------------------ */
  function _guard() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const userRole   = sessionStorage.getItem("userRole");
    const studentId  = sessionStorage.getItem("studentId");

    if (!isLoggedIn || !userRole || userRole !== "student" || !studentId) {
      window.location.href = "/login";
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------
   * Profile
   * ------------------------------------------------------------------ */
  async function _loadProfile() {
    const studentId = sessionStorage.getItem("studentId");
    try {
      const res = await fetch("/api/students/" + studentId);
      if (!res.ok) throw new Error("Failed to fetch student data: " + res.status);

      const studentData = await res.json();

      sessionStorage.setItem("userName",  studentData.fullname);
      sessionStorage.setItem("userID",    studentData.student_id);

      Core.utils.setText("userName",        studentData.fullname   || "Student");
      Core.utils.setText("userNameHeading", studentData.fullname   || "Student");
      Core.utils.setText("userID",          studentData.student_id || "c22-0000-000");
    } catch (err) {
      console.error("[Student.Dashboard] loadProfile:", err);
      Core.utils.setText("userName",        "Student");
      Core.utils.setText("userNameHeading", "Student");
      Core.utils.setText("userID",          "c22-0000-000");
    }
  }

  /* ------------------------------------------------------------------
   * Stats
   * ------------------------------------------------------------------ */
  async function updateDashboardStats() {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) return;

    try {
      const res = await fetch("/api/students/" + studentId + "/dashboard-stats");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats: " + res.status);

      const result = await res.json();
      const stats  = result.data || result;
      Core.utils.setText("availableBooksCount", stats.availableBooks);
      Core.utils.setText("borrowedBooksCount",  stats.borrowedBooks);
      Core.utils.setText("dueSoonCount",         stats.dueSoon);
    } catch (err) {
      console.error("[Student.Dashboard] updateDashboardStats:", err);
      Core.utils.setText("availableBooksCount", "Error");
      Core.utils.setText("borrowedBooksCount",  "Error");
      Core.utils.setText("dueSoonCount",         "Error");
    }
  }

  /* ------------------------------------------------------------------
   * Borrowed books
   * ------------------------------------------------------------------ */
  async function updateBorrowedBooks() {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) return;

    const tableBody = document.getElementById("borrowedBooksTableBody");
    if (!tableBody) return;

    try {
      const res = await fetch("/api/book-borrowings/" + studentId);
      if (!res.ok) throw new Error("Failed to fetch borrowed books: " + res.status);

      const result = await res.json();
      const data   = result.data || result;

      if (!data.books || data.books.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center">No books currently borrowed</td></tr>';
        return;
      }

      tableBody.innerHTML = data.books.map(function (book) {
        return (
          "<tr>" +
            "<td>" + book.title + "</td>" +
            "<td>" + book.author + "</td>" +
            "<td>" + Core.utils.formatDate(book.borrow_date) + "</td>" +
            "<td>" + Core.utils.formatDate(book.due_date) + "</td>" +
            "<td>" +
              '<span class="status-pill ' + book.status.toLowerCase() + '">' +
                book.status.charAt(0).toUpperCase() + book.status.slice(1) +
              "</span>" +
            "</td>" +
          "</tr>"
        );
      }).join("");
    } catch (err) {
      console.error("[Student.Dashboard] updateBorrowedBooks:", err);
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Error loading borrowed books</td></tr>';
    }
  }

  /* ------------------------------------------------------------------
   * Recommended books
   * ------------------------------------------------------------------ */
  async function updateRecommendedBooks() {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) return;

    const tableBody = document.getElementById("recommendedBooksTableBody");
    if (!tableBody) return;

    try {
      const res = await fetch("/api/students/books/recommended/" + studentId);
      if (!res.ok) throw new Error("Failed to fetch recommended books: " + res.status);

      const result = await res.json();
      const books  = result.data || [];

      if (!books || books.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center">No book recommendations available yet. Try borrowing some books first!</td></tr>';
        return;
      }

      tableBody.innerHTML = books.map(function (book) {
        const statusLower = book.current_status.toLowerCase();
        const statusLabel = book.current_status.charAt(0).toUpperCase() + book.current_status.slice(1);
        const actionCell  = statusLower === "available"
          ? '<button class="book-borrow-btn" onclick="Student.Dashboard.showBorrowModal(\'' + book.id + '\')">Borrow</button>'
          : '<button class="book-borrow-btn" disabled>Not Available</button>';

        return (
          "<tr>" +
            "<td>" + book.title + "</td>" +
            "<td>" + book.author + "</td>" +
            "<td>" + book.category + "</td>" +
            "<td>" +
              '<span class="status-pill ' + statusLower + '">' + statusLabel + "</span>" +
            "</td>" +
            "<td>" + actionCell + "</td>" +
          "</tr>"
        );
      }).join("");
    } catch (err) {
      console.error("[Student.Dashboard] updateRecommendedBooks:", err);
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Error loading recommended books</td></tr>';
    }
  }

  /* ------------------------------------------------------------------
   * Borrow modal
   * ------------------------------------------------------------------ */
  function showBorrowModal(bookId) {
    sessionStorage.setItem("currentBorrowBookId", bookId);

    const today   = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);

    const returnDateInput = document.getElementById("returnDate");
    if (returnDateInput) {
      returnDateInput.min   = today.toISOString().split("T")[0];
      returnDateInput.max   = maxDate.toISOString().split("T")[0];
      returnDateInput.value = maxDate.toISOString().split("T")[0];
    }

    const modal = document.getElementById("modal-user");
    if (modal) modal.style.display = "flex";
  }

  function closeModal() {
    const modal = document.getElementById("modal-user");
    if (modal) modal.style.display = "none";
    sessionStorage.removeItem("currentBorrowBookId");
  }

  async function handleBorrow() {
    const bookId     = sessionStorage.getItem("currentBorrowBookId");
    const studentId  = sessionStorage.getItem("studentId");
    const returnDate = document.getElementById("returnDate")
      ? document.getElementById("returnDate").value
      : null;

    if (!bookId || !studentId) {
      alert("Missing book or student information");
      return;
    }
    if (!returnDate) {
      alert("Please select a return date");
      return;
    }
    if (new Date(returnDate) < new Date()) {
      alert("Return date cannot be in the past");
      return;
    }

    try {
      const res = await fetch("/api/students/borrow-book", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bookId: bookId, studentId: studentId, returnDate: returnDate }),
      });
      const result = await res.json();

      if (result.success) {
        alert("Book borrowed successfully!");
        updateDashboardStats();
        updateBorrowedBooks();
        updateRecommendedBooks();
      } else {
        alert(result.message || "Failed to borrow book");
      }
    } catch (err) {
      console.error("[Student.Dashboard] handleBorrow:", err);
      alert("An error occurred while borrowing the book");
    } finally {
      closeModal();
    }
  }

  /* ------------------------------------------------------------------
   * Logout modal
   * ------------------------------------------------------------------ */
  function showLogoutModal() {
    const modal = document.getElementById("logoutModal");
    if (modal) modal.style.display = "flex";
  }

  function closeLogoutModal() {
    const modal = document.getElementById("logoutModal");
    if (modal) modal.style.display = "none";
  }

  function logout() {
    sessionStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userID");
    closeLogoutModal();
    setTimeout(function () { window.location.href = "/login"; }, 1000);
  }

  /* ------------------------------------------------------------------
   * Expose globals needed by inline HTML onclick attributes
   * ------------------------------------------------------------------ */
  function _bindGlobals() {
    window.showBorrowModal    = showBorrowModal;
    window.handleBorrow       = handleBorrow;
    window.closeModal         = closeModal;
    window.showLogoutModal    = showLogoutModal;
    window.closeLogoutModal   = closeLogoutModal;
    window.logout             = logout;
  }

  /* ------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------ */
  async function init() {
    _bindGlobals();

    if (!_guard()) return;

    await _loadProfile();
    await updateDashboardStats();
    await updateBorrowedBooks();
    await updateRecommendedBooks();

    Core.utils.addInterval(async function () {
      await updateDashboardStats();
      await updateBorrowedBooks();
    }, 60000);

    Core.utils.addInterval(updateRecommendedBooks, 300000);
  }

  /* ------------------------------------------------------------------
   * Export
   * ------------------------------------------------------------------ */
  Student.Dashboard = {
    init:                   init,
    showBorrowModal:        showBorrowModal,
    handleBorrow:           handleBorrow,
    closeModal:             closeModal,
    showLogoutModal:        showLogoutModal,
    closeLogoutModal:       closeLogoutModal,
    logout:                 logout,
    updateDashboardStats:   updateDashboardStats,
    updateBorrowedBooks:    updateBorrowedBooks,
    updateRecommendedBooks: updateRecommendedBooks,
  };

}(window.Student = window.Student || {}));

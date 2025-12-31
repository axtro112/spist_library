document.addEventListener("DOMContentLoaded", function () {
  const studentId = sessionStorage.getItem("userID");
  if (!studentId) {
    window.location.href = "/login";
    return;
  }

  loadBorrowingHistory();
});

async function loadBorrowingHistory() {
  try {
    const response = await fetchWithCsrf(
      `/api/students/borrowing-history/${sessionStorage.getItem("userID")}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch borrowing history");
    }

    const borrowingHistory = await response.json();
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
      row.innerHTML = `
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${formatDate(book.borrow_date)}</td>
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
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}

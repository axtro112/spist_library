/* ========================================
   MODAL FUNCTIONS - STUDENT BOOK BORROWING
   ======================================== */

// IMPORTANT:
// Modal must only open when the user explicitly clicks the Borrow button on a book.
// Do NOT trigger modal automatically on page load or page navigation.

function showBookuser() {
    document.getElementById('modal-user').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-user').style.display = 'none';
}
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET /api/books - Get all books with optional search and category filters
router.get("/", async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = `
      SELECT b.*, a.fullname as added_by_name,
        CASE WHEN b.available_quantity > 0 THEN 1 ELSE 0 END as is_available
      FROM books b
      LEFT JOIN admins a ON b.added_by = a.id
      WHERE b.status = 'active'
    `;
    const params = [];

    // Add search filter if provided
    if (search) {
      query += " AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)";
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    // Add category filter if provided
    if (category && category !== "") {
      query += " AND b.category = ?";
      params.push(category);
    }

    // Add order by
    query += " ORDER BY b.title ASC";

    // Execute query using the queryDB helper function
    const books = await queryDB(query, params);
    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res
      .status(500)
      .json({ message: "Error fetching books", error: error.message });
  }
});

// GET /api/books/categories - Get all unique categories
router.get("/categories", async (req, res) => {
  try {
    const query =
      "SELECT DISTINCT category FROM books WHERE status = 'active' ORDER BY category ASC";
    const categories = await queryDB(query);
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res
      .status(500)
      .json({ message: "Error fetching categories", error: error.message });
  }
});

// Helper function for database queries
const queryDB = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// POST /api/books/borrow - Borrow a book
router.post("/borrow", async (req, res) => {
  const { bookId, studentId, borrowDate, returnDate, notes, adminId } = req.body;

  try {
    // Check if book has available copies
    const books = await queryDB("SELECT available_quantity FROM books WHERE id = ? AND status = 'active'", [
      bookId,
    ]);
    if (!books.length || books[0].available_quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "No copies available for borrowing",
      });
    }

    // Create borrowing record and decrease available quantity in transaction
    await new Promise((resolve, reject) => {
      db.beginTransaction(async (err) => {
        if (err) return reject(err);

        try {
          // Create borrowing record
          await queryDB(
            "INSERT INTO book_borrowings (book_id, student_id, borrow_date, due_date, approved_by, notes, status) VALUES (?, ?, ?, ?, ?, ?, 'borrowed')",
            [bookId, studentId, borrowDate, returnDate, adminId || null, notes]
          );

          // Decrease available quantity
          await queryDB("UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ?", [
            bookId,
          ]);

          db.commit((err) => {
            if (err) return reject(err);
            resolve();
          });
        } catch (error) {
          db.rollback(() => reject(error));
        }
      });
    });

    res.json({ success: true, message: "Book borrowed successfully" });
  } catch (error) {
    console.error("Error borrowing book:", error);
    res.status(500).json({
      success: false,
      message: "Error borrowing book",
      error: error.message,
    });
  }
});

module.exports = router;

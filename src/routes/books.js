const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const { requireAuth } = require("../middleware/auth");

// GET /api/books - Get all books with optional search and category filters
router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = `
      SELECT b.*, a.fullname as added_by_name,
        CASE WHEN b.available_quantity > 0 THEN 1 ELSE 0 END as is_available
      FROM books b
      LEFT JOIN admins a ON b.added_by = a.id
      WHERE b.status = 'available'
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

    // Execute query using the db utility
    const books = await db.query(query, params);
    logger.info('Books fetched successfully', { count: books.length, search, category });
    response.success(res, books);
  } catch (error) {
    logger.error('Error fetching books', { error: error.message });
    response.error(res, 'Error fetching books', error);
  }
});

// GET /api/books/categories - Get all unique categories
router.get("/categories", requireAuth, async (req, res) => {
  try {
    const query =
      "SELECT DISTINCT category FROM books WHERE status = 'available' AND category IS NOT NULL AND category != '' ORDER BY category ASC";
    const categories = await db.query(query);
    logger.info('Categories fetched successfully', { count: categories.length });
    response.success(res, categories);
  } catch (error) {
    logger.error('Error fetching categories', { error: error.message });
    response.error(res, 'Error fetching categories', error);
  }
});

// GET /api/books/:id - Get single book by ID (for notification modal deep link)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const bookId = req.params.id;

    const query = `
      SELECT 
        id,
        title,
        author,
        category,
        isbn,
        description,
        quantity,
        available_quantity,
        status,
        added_date,
        updated_at
      FROM books
      WHERE id = ? AND status != 'deleted'
      LIMIT 1
    `;

    const books = await db.query(query, [bookId]);

    if (!books || books.length === 0) {
      logger.warn('Book not found for detail fetch', { bookId });
      return response.notFound(res, 'Book not found');
    }

    logger.info('Book detail fetched', { bookId });
    response.success(res, books[0]);
  } catch (error) {
    logger.error('Error fetching book detail', { error: error.message, bookId: req.params.id });
    response.error(res, 'Error fetching book detail', error);
  }
});

// POST /api/books/borrow - Borrow a book
router.post("/borrow", async (req, res) => {
  const { bookId, studentId, borrowDate, returnDate, notes, adminId } = req.body;

  try {
    // Check if book has available copies
    const books = await db.query("SELECT available_quantity FROM books WHERE id = ? AND status = 'available'", [
      bookId,
    ]);
    if (!books.length || books[0].available_quantity <= 0) {
      logger.warn('Book borrow attempt - no copies available', { bookId });
      return response.validationError(res, 'No copies available for borrowing');
    }

    await db.withTransaction(async (conn) => {
      await conn.queryAsync(
        "INSERT INTO book_borrowings (book_id, student_id, borrow_date, due_date, approved_by, notes, status) VALUES (?, ?, ?, ?, ?, ?, 'borrowed')",
        [bookId, studentId, borrowDate, returnDate, adminId || null, notes]
      );
      await conn.queryAsync("UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ?", [bookId]);
    });

    logger.info('Book borrowed successfully', { bookId, studentId });
    response.success(res, null, 'Book borrowed successfully');
  } catch (error) {
    logger.error('Error borrowing book', { error: error.message, bookId, studentId });
    response.error(res, 'Error borrowing book', error);
  }
});

// Add logging to debug the 500 error
router.get('/api/admin/books', async (req, res) => {
  try {
    logger.info('Fetching books data');
    const books = await db.query('SELECT * FROM books');
    logger.info('Books data fetched successfully', { count: books.length });
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    logger.error('Error fetching books data', { error: error.message });
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

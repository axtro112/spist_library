const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const { requireAuth } = require("../middleware/auth");

// GET /api/books - Get all books with optional search and category filters
router.get("/", requireAuth, async (req, res) => {
  try {
    // Prevent browser caching - user-specific data must be fetched fresh each time
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const { search, category } = req.query;
    // Show ALL books to students (not just available ones), but flag which are available
    // This allows students to see the complete catalog and know which books are on the shelf
    let query = `
      SELECT b.*, a.fullname as added_by_name,
        CASE WHEN b.available_quantity > 0 THEN 1 ELSE 0 END as is_available
      FROM books b
      LEFT JOIN admins a ON b.added_by = a.id
      WHERE b.deleted_at IS NULL
        AND COALESCE(b.status, 'available') NOT IN ('maintenance', 'retired', 'missing')
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
    // Prevent browser caching
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const query =
      "SELECT DISTINCT category FROM books WHERE deleted_at IS NULL AND category IS NOT NULL AND category != '' ORDER BY category ASC";
    const categories = await db.query(query);
    logger.info('Categories fetched successfully', { count: categories.length });
    response.success(res, categories);
  } catch (error) {
    logger.error('Error fetching categories', { error: error.message });
    response.error(res, 'Error fetching categories', error);
  }
});

// GET /api/books/popular - Get most frequently borrowed books
router.get("/popular", requireAuth, async (req, res) => {
  try {
    // Prevent browser caching
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const query = `
      SELECT
        b.id,
        b.title,
        b.author,
        b.category,
        b.isbn,
        b.quantity,
        b.available_quantity,
        COUNT(bb.id) AS borrow_count
      FROM books b
      LEFT JOIN book_borrowings bb ON b.id = bb.book_id
      WHERE b.status = 'available' AND b.deleted_at IS NULL
      GROUP BY b.id, b.title, b.author, b.category, b.isbn, b.quantity, b.available_quantity
      ORDER BY borrow_count DESC, b.title ASC
      LIMIT ?
    `;
    const books = await db.query(query, [limit]);
    logger.info('Popular books fetched', { count: books.length });
    response.success(res, books);
  } catch (error) {
    logger.error('Error fetching popular books', { error: error.message });
    response.error(res, 'Error fetching popular books', error);
  }
});

// GET /api/books/:id - Get single book by ID (for notification modal deep link)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    // Prevent browser caching
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
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
      WHERE id = ? AND status != 'deleted' AND deleted_at IS NULL
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
    const books = await db.query("SELECT available_quantity FROM books WHERE id = ? AND status = 'available' AND deleted_at IS NULL", [
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
      // [ORPHAN FIX] Recalculate from ground truth to prevent counter drift
      await conn.queryAsync(
        `UPDATE books
         SET available_quantity = GREATEST(0,
           quantity - (
             SELECT COUNT(*) FROM book_borrowings
             WHERE book_id = ? AND status IN ('borrowed','overdue') AND return_date IS NULL
           )
         )
         WHERE id = ?`,
        [bookId, bookId]
      );
    });

    logger.info('Book borrowed successfully', { bookId, studentId });
    response.success(res, null, 'Book borrowed successfully');
  } catch (error) {
    logger.error('Error borrowing book', { error: error.message, bookId, studentId });
    response.error(res, 'Error borrowing book', error);
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const { sendBorrowingClaimEmailForBorrowings } = require("../services/borrowService");
const bcrypt = require("bcrypt");
const upload = require("../middleware/upload");
const { requireAdmin, requireSuperAdmin } = require("../middleware/auth");
const {
  ensureBookCopyCoverage,
  getNextAccessionNumber,
  getQrCodeImagePath,
} = require('../utils/accession');
const {
  parseCSV,
  parseExcel,
  importBooks,
  exportBooksToCSV,
  exportBooksToExcel,
  cleanupFile,
} = require("../utils/csvParser");
const rateLimit = require('express-rate-limit');
const { createAdminRules, validate } = require('../validators/admin.validators');
const { addAdmin } = require('../controllers/admin.controller');

// 10 create attempts per IP per 15 minutes
const addAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin creation attempts. Please try again in 15 minutes.' },
});

// =============================
// Add Admin (Super Admin Only)
// =============================
router.post('/admins', requireSuperAdmin, addAdminLimiter, createAdminRules, validate, addAdmin);


// Middleware to log all admin API requests
router.use((req, res, next) => {
  logger.debug('Admin API Request', {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
  });
  next();
});

// Get all active students
router.get("/students", requireAdmin, async (req, res) => {
  const query = `
    SELECT 
      student_id,
      fullname,
      email,
      status
    FROM students
    WHERE status = 'active' AND deleted_at IS NULL
    ORDER BY fullname ASC
  `;

  try {
    const results = await db.query(query);
    logger.info('Active students fetched', { count: results.length });
    response.success(res, results);
  } catch (err) {
    logger.error('Failed to fetch students', { error: err.message });
    response.error(res, 'Failed to fetch students', err);
  }
});

// Book Management Routes with Search and Filter Support
router.get("/books", requireAdmin, async (req, res) => {
  // Extract search and filter parameters from query string
  const { search, category, status } = req.query;
  
  // Build WHERE conditions dynamically
  let whereConditions = [];
  let queryParams = [];
  
  // Base condition: exclude soft-deleted books
  whereConditions.push("b.deleted_at IS NULL");
  
  // Include valid statuses (available, active, maintenance, retired, borrowed, missing)
  whereConditions.push("b.status IN ('available', 'active', 'maintenance', 'retired', 'borrowed', 'missing')");
  
  // Search condition: search across title, author, ISBN, and category (partial match, case-insensitive)
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereConditions.push("(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.category LIKE ?)");
    queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  // Category filter: exact match
  if (category && category.trim()) {
    whereConditions.push("b.category = ?");
    queryParams.push(category.trim());
  }
  
  // Status filter: match computed status (Available, All Borrowed, etc.)
  // This is applied after computing current_status, so we'll filter in JavaScript if needed
  // For SQL-level filtering, we check available_quantity
  if (status && status.trim()) {
    if (status === 'Available') {
      whereConditions.push("b.available_quantity > 0");
    } else if (status === 'All Borrowed') {
      whereConditions.push("b.available_quantity = 0");
    } else if (status === 'maintenance') {
      whereConditions.push("b.status = 'maintenance'");
    }
  }
  
  const whereClause = whereConditions.length > 0 
    ? "WHERE " + whereConditions.join(" AND ")
    : "";
  
  const query = `
    SELECT 
      b.id, b.title, b.author, b.isbn, b.category, 
      b.added_date, b.status, b.quantity, b.available_quantity,
      a.fullname as added_by_name,
      CASE 
        WHEN b.available_quantity > 0 THEN 'Available'
        WHEN b.available_quantity = 0 THEN 'All Borrowed'
        ELSE 'Unavailable'
      END as current_status,
      bb.borrow_date, bb.due_date, bb.claim_expires_at, bb.picked_up_at,
      s.fullname as borrowed_by,
      bb.status as borrow_status,
      CASE
        WHEN bb.id IS NULL THEN 'available'
        WHEN bb.status = 'overdue' OR (bb.status = 'borrowed' AND bb.return_date IS NULL AND bb.due_date < NOW()) THEN 'overdue'
        WHEN bb.status = 'pending_pickup' AND COALESCE(LEAST(bb.claim_expires_at, DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)), DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)) < NOW() THEN 'claim_expired'
        WHEN bb.status = 'pending_pickup' THEN 'pending_pickup'
        WHEN bb.status = 'borrowed' THEN 'picked_up'
        ELSE bb.status
      END as display_status
    FROM books b
    LEFT JOIN admins a ON b.added_by = a.id
    LEFT JOIN (
      SELECT bb1.*
      FROM book_borrowings bb1
      LEFT JOIN book_borrowings bb2 
        ON bb1.book_id = bb2.book_id 
        AND bb1.id < bb2.id
        AND bb2.return_date IS NULL
        AND bb2.status IN ('borrowed', 'overdue')
      WHERE bb2.id IS NULL
        AND bb1.return_date IS NULL
        AND bb1.status IN ('borrowed', 'overdue')
    ) bb ON b.id = bb.book_id
    LEFT JOIN students s
      ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
    ${whereClause}
    ORDER BY b.id DESC
  `;

  try {
    const results = await db.query(query, queryParams);
    logger.info('Books fetched with filters', { count: results.length, search, category, status, whereClause });
    logger.debug('Books query details', { queryParams, whereClause, query: query.substring(0, 200) });
    
    if (results.length > 0 && process.env.NODE_ENV !== 'production') {
      logger.debug('Sample books', { books: results.slice(0, 3).map(b => ({
        id: b.id,
        title: b.title,
        status: b.status,
        available_quantity: b.available_quantity
      }))});
    }
    
    response.success(res, results);
  } catch (err) {
    logger.error('Database error fetching books', { error: err.message });
    response.error(res, 'Database error', err);
  }
});

router.post("/books", requireAdmin, async (req, res) => {
  const { title, author, category, isbn, quantity, adminId, status } = req.body;
  logger.debug('Adding new book', { title, author, category, isbn, quantity, adminId, status });

  if (!title || !author || !category || !isbn) {
    return response.validationError(res, 'All fields are required');
  }

  try {
    // Check for duplicate ISBN
    const existingBook = await db.query("SELECT id FROM books WHERE isbn = ?", [
      isbn,
    ]);
    if (existingBook.length > 0) {
      logger.warn('Book creation failed - duplicate ISBN', { isbn });
      return response.validationError(res, 'A book with this ISBN already exists');
    }

    const parsedQty = Number.parseInt(quantity, 10);
    const bookQuantity = Number.isFinite(parsedQty) && parsedQty >= 0 ? parsedQty : 1;

    // UI sends available|maintenance|retired, while DB uses active|maintenance|retired.
    const requestedStatus = String(status || 'available').toLowerCase();
    const dbStatus = requestedStatus === 'maintenance'
      ? 'maintenance'
      : (requestedStatus === 'retired' ? 'retired' : 'active');

    // Non-available statuses should not increase available_quantity.
    const initialAvailableQuantity = dbStatus === 'active' ? bookQuantity : 0;
    const createdCopies = [];
    let newBookId = null;

    await db.withTransaction(async (conn) => {
      const insertBookQuery = `
        INSERT INTO books (title, author, isbn, category, added_date, status, quantity, available_quantity, added_by)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
      `;

      const bookResult = await conn.queryAsync(insertBookQuery, [
        title,
        author,
        isbn,
        category,
        dbStatus,
        bookQuantity,
        initialAvailableQuantity,
        adminId || null,
      ]);

      newBookId = bookResult.insertId;

      if (bookQuantity > 0) {
        const copyStatus = dbStatus === 'active' ? 'available' : dbStatus;

        for (let i = 1; i <= bookQuantity; i++) {
          const accessionNumber = await getNextAccessionNumber(conn);

          await conn.queryAsync(
            `INSERT INTO book_copies
             (accession_number, book_id, copy_number, condition_status, location, status)
             VALUES (?, ?, ?, 'excellent', 'Main Library', ?)`,
            [accessionNumber, newBookId, i, copyStatus]
          );

          await conn.queryAsync(
            `INSERT INTO book_copy_audit (accession_number, action, new_value, performed_by, notes)
             VALUES (?, 'created', ?, ?, ?)`,
            [
              accessionNumber,
              JSON.stringify({ source: 'add_book', status: copyStatus }),
              req.session?.user?.id || req.session?.adminId || null,
              'Copy auto-created from Add Book',
            ]
          );

          createdCopies.push({
            accession_number: accessionNumber,
            copy_number: i,
            qr_code_image_url: getQrCodeImagePath(accessionNumber),
          });
        }
      }
    });

    logger.info('Book created successfully', {
      bookId: newBookId,
      title,
      isbn,
      autoCopies: createdCopies.length,
    });

    response.success(
      res,
      {
        message: 'Book added successfully',
        bookId: newBookId,
        copies_created: createdCopies.length,
        copies: createdCopies,
      },
      'Book added successfully',
      201
    );
  } catch (err) {
    logger.error('Error adding book', { error: err.message, title, isbn });
    response.error(res, 'Error adding book', err);
  }
});

router.put("/books/:id", requireAdmin, async (req, res) => {
  const bookId = req.params.id;
  const { title, author, category, isbn, status, student_id, quantity } = req.body;
  const adminId = req.session.user?.id || req.session.adminId || null;

  logger.debug('Book update request', { bookId, title, author, category, isbn, status, student_id, quantity });

  if (!title || !author || !category || !isbn) {
    return response.validationError(res, 'All fields are required');
  }

  try {
    await db.withTransaction(async (conn) => {
      const book = await conn.queryAsync(
        "SELECT id, status, quantity, available_quantity FROM books WHERE id = ? AND deleted_at IS NULL",
        [bookId]
      );
      if (book.length === 0) throw new Error("Book not found");

      const bookQuantity = parseInt(quantity) || 1;
      const [borrowingCount] = await conn.queryAsync(
        `SELECT COUNT(*) as count FROM book_borrowings WHERE book_id = ? AND return_date IS NULL AND status IN ('borrowed', 'overdue')`,
        [bookId]
      );
      const activeBorrowings = borrowingCount.count || 0;
      if (bookQuantity < activeBorrowings) {
        throw new Error(`VALIDATION:Quantity cannot be lower than the ${activeBorrowings} active borrowing(s) for this book.`);
      }

      // Only explicit return-confirm routes may mark borrowings as returned.
      if (status === "available" && activeBorrowings > 0) {
        logger.warn('BOOK_UPDATE_BLOCKED', {
          reason: 'active_borrowings_require_confirm_return',
          adminId,
          bookId,
          requestedStatus: status,
          activeBorrowings,
        });
        throw new Error("VALIDATION:Cannot mark book as available while it has active borrowings. Confirm return first.");
      }

      const newAvailableQty = Math.max(0, bookQuantity - activeBorrowings);

      let dbStatus = 'active';
      if (status === 'maintenance') dbStatus = 'maintenance';
      else if (status === 'retired') dbStatus = 'retired';

      await conn.queryAsync(
        `UPDATE books SET title = ?, author = ?, category = ?, isbn = ?, status = ?, quantity = ?, available_quantity = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
        [title, author, category, isbn, dbStatus, bookQuantity, newAvailableQty, bookId]
      );

      await ensureBookCopyCoverage(conn, {
        bookId,
        quantity: bookQuantity,
        bookStatus: dbStatus,
        performedBy: adminId,
        source: 'admin_update_book',
      });

      logger.info('Book updated', { bookId, dbStatus, bookQuantity, newAvailableQty });

      if (status === "borrowed") {
        if (!student_id) throw new Error("Student ID is required when status is borrowed");

        const currentBorrowing = await conn.queryAsync(
          `SELECT bb.id, bb.student_id FROM book_borrowings bb WHERE bb.book_id = ? AND bb.status IN ('borrowed', 'overdue') AND bb.return_date IS NULL`,
          [bookId]
        );

        if (currentBorrowing.length > 0) {
          if (currentBorrowing[0].student_id !== student_id) {
            logger.warn('BOOK_UPDATE_BLOCKED', {
              reason: 'book_borrowed_by_different_student',
              adminId,
              bookId,
              requestedStatus: status,
              currentBorrowingId: currentBorrowing[0].id,
              currentStudentId: currentBorrowing[0].student_id,
              requestedStudentId: student_id,
            });
            throw new Error("VALIDATION:This book is currently borrowed by another student. Confirm return first before reassigning.");
          }
        } else {
          await conn.queryAsync(
            `INSERT INTO book_borrowings (book_id, student_id, borrow_date, due_date, status) VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY), 'borrowed')`,
            [bookId, student_id]
          );
        }
      }
    });

    response.success(res, null, 'Book updated successfully');
  } catch (err) {
    if (err.message && err.message.startsWith('VALIDATION:')) {
      return response.validationError(res, err.message.replace('VALIDATION:', ''));
    }
    logger.error('Error updating book', { bookId, error: err.message });
    response.error(res, 'Error updating book', err);
  }
});

router.delete("/books/:id", requireAdmin, async (req, res) => {
  const bookId = req.params.id;

  try {
    // Verify book exists
    const book = await db.query("SELECT id FROM books WHERE id = ?", [bookId]);
    if (book.length === 0) {
      logger.warn('Book delete attempt - not found', { bookId });
      return response.notFound(res, 'Book not found');
    }

    // [ORPHAN FIX] Check for active borrowings using correct ENUM values
    const borrowStatus = await db.query(
      "SELECT id FROM book_borrowings WHERE book_id = ? AND status IN ('borrowed', 'overdue') AND return_date IS NULL",
      [bookId]
    );
    if (borrowStatus.length > 0) {
      logger.warn('Book delete attempt - currently borrowed', { bookId });
      return response.validationError(res, 'Cannot move book to trash: it has active borrowings that must be returned first');
    }

    // Soft delete the book (move to trash)
    await db.query("UPDATE books SET deleted_at = NOW(), trash_id = UUID() WHERE id = ?", [bookId]);

    logger.info('Book moved to trash successfully', { bookId });
    response.success(res, null, 'Book moved to trash successfully');
  } catch (err) {
    logger.error('Error deleting book', { bookId, error: err.message });
    response.error(res, 'Error deleting book', err);
  }
});

// Dashboard Statistics Route
router.get("/dashboard/stats", requireAdmin, async (req, res) => {
  const queries = {
        pendingPickup: `
          SELECT COUNT(*) as count
          FROM book_borrowings
          WHERE status = 'pending_pickup'
        `,
    totalBooks: "SELECT COALESCE(SUM(quantity), 0) as count FROM books WHERE status IN ('available', 'borrowed', 'maintenance')",
    totalCopies: "SELECT COALESCE(SUM(quantity), 0) as count FROM books WHERE status IN ('available', 'borrowed', 'maintenance')",
    availableBooks: "SELECT COALESCE(SUM(available_quantity), 0) as count FROM books WHERE status IN ('available', 'borrowed', 'maintenance')",
    borrowedBooks: "SELECT COALESCE(SUM(quantity - available_quantity), 0) as count FROM books WHERE status IN ('available', 'borrowed', 'maintenance')",
    activeBorrowings: `
      SELECT COUNT(*) as count 
      FROM book_borrowings 
      WHERE status IN ('borrowed', 'overdue')
    `,
    registeredStudents:
      "SELECT COUNT(*) as count FROM students WHERE status = 'active'",
    totalAdmins:
      "SELECT COUNT(*) as count FROM admins WHERE is_active = 1",
    overdueBooks:
      "SELECT COUNT(*) as count FROM book_borrowings WHERE status = 'overdue'",
    borrowingTrends: `
      SELECT 
        DATE_FORMAT(borrow_date, '%Y-%m') as month,
        COUNT(*) as count
      FROM book_borrowings
      WHERE borrow_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(borrow_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `,
    popularCategories: `
      SELECT 
        COALESCE(b.category, 'Uncategorized') as category, 
        COUNT(DISTINCT bb.id) as count
      FROM books b
      INNER JOIN book_borrowings bb ON b.id = bb.book_id
      WHERE b.status != 'deleted'
      GROUP BY b.category
      ORDER BY count DESC
      LIMIT 5
    `,
    recentActivities: `
      (SELECT 
        CAST('book_borrowed' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as type,
        CONCAT(
          CAST(COALESCE(b.title, 'Unknown Book') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
          ' borrowed by ' COLLATE utf8mb4_unicode_ci,
          CAST(COALESCE(s.fullname, 'Unknown Student') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        ) COLLATE utf8mb4_unicode_ci as detail,
        bb.borrow_date as timestamp
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      WHERE bb.status = 'borrowed'
      AND bb.borrow_date IS NOT NULL
      ORDER BY bb.borrow_date DESC
      LIMIT 5)
      
      UNION ALL
      
      (SELECT 
        CAST('book_returned' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as type,
        CONCAT(
          CAST(COALESCE(b.title, 'Unknown Book') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
          ' returned by ' COLLATE utf8mb4_unicode_ci,
          CAST(COALESCE(s.fullname, 'Unknown Student') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        ) COLLATE utf8mb4_unicode_ci as detail,
        bb.return_date as timestamp
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      WHERE bb.status = 'returned'
      AND bb.return_date IS NOT NULL
      ORDER BY bb.return_date DESC
      LIMIT 5)
      
      UNION ALL
      
      (SELECT 
        CAST('book_overdue' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as type,
        CONCAT(
          CAST(COALESCE(b.title, 'Unknown Book') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
          ' overdue from ' COLLATE utf8mb4_unicode_ci,
          CAST(COALESCE(s.fullname, 'Unknown Student') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        ) COLLATE utf8mb4_unicode_ci as detail,
        bb.due_date as timestamp
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      WHERE bb.status = 'overdue'
      AND bb.due_date IS NOT NULL
      ORDER BY bb.due_date DESC
      LIMIT 5)
      
      ORDER BY timestamp DESC
      LIMIT 10
    `,
  };

  try {
    const results = await Promise.allSettled(
      Object.entries(queries).map(async ([key, query]) => {
        logger.debug('Executing dashboard stats query', { key, query });
        const result = await db.query(query);
        logger.debug('Dashboard stats result', { key, rawResult: result, count: Array.isArray(result) ? (result[0]?.count || result.length) : result });
        return { key, result };
      })
    );

    const stats = {};
    results.forEach(({ status, value }) => {
      if (status === "fulfilled") {
        if (
          ["borrowingTrends", "popularCategories", "recentActivities"].includes(
            value.key
          )
        ) {
          stats[value.key] = value.result;
        } else {
          stats[value.key] = value.result[0]?.count || 0;
        }
        logger.debug('Processed dashboard stat', { key: value.key, rawValue: value.result[0], finalValue: stats[value.key] });
      } else {
        logger.error('Error executing dashboard query', { key: value?.key, reason: value?.reason });
        stats[value?.key] = [];
      }
    });

    // Set total_books as a number (SUM of quantity for active books)
    stats.total_books = stats.totalBooks || 0;

    // Log final computed stats for debugging with detailed breakdown
    logger.info('Dashboard stats computed - DETAILED', {
      totalBooks_raw: stats.totalBooks,
      total_books_final: stats.total_books,
      totalCopies: stats.totalCopies,
      availableBooks: stats.availableBooks,
      borrowedBooks: stats.borrowedBooks,
      activeBorrowings: stats.activeBorrowings,
      allStats: stats
    });

    response.success(res, stats);
  } catch (err) {
    logger.error('Error fetching dashboard statistics', { error: err.message });
    response.error(res, 'Error fetching dashboard statistics', err);
  }
});

// GET /api/admin  OR  GET /api/admin/admins - List all admins
async function listAdmins(req, res) {
  try {
    // Extract search and filter parameters
    const { search, role } = req.query;
    
    // Build WHERE conditions dynamically
    let whereConditions = [];
    let queryParams = [];
    
    // Base condition: exclude soft-deleted admins
    whereConditions.push("deleted_at IS NULL");
    
    // Search condition: search across fullname and email (partial match, case-insensitive)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push("(fullname LIKE ? OR email LIKE ?)");
      queryParams.push(searchTerm, searchTerm);
    }
    
    // Role filter: exact match
    if (role && role.trim()) {
      whereConditions.push("role = ?");
      queryParams.push(role.trim());
    }
    
    const whereClause = whereConditions.length > 0 
      ? "WHERE " + whereConditions.join(" AND ")
      : "";
    
    const query = `SELECT id, fullname, email, role, created_at FROM admins ${whereClause}`;
    logger.debug('Admins query with filters', { search, role });
    
    const admins = await db.query(query, queryParams);
    logger.info('Admins fetched', { count: admins.length, filters: { search, role } });
    response.success(res, admins);
  } catch (err) {
    logger.error('Failed to fetch admins', { error: err.message });
    response.error(res, 'Failed to fetch admins', err);
  }
}

router.get("/", requireAdmin, listAdmins);
router.get("/admins", requireAdmin, listAdmins);

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { fullname, email, password, role, currentAdminId } = req.body;

    //  AUTHORIZATION: Only super_admin can create admins
    if (!currentAdminId) {
      return response.unauthorized(res, 'Authentication required. Please provide currentAdminId.');
    }
    const currentAdmin = await db.query(
      "SELECT role FROM admins WHERE id = ?",
      [currentAdminId]
    );
    if (currentAdmin.length === 0 || currentAdmin[0].role !== 'super_admin') {
      logger.warn('Admin create attempt - not super_admin', { currentAdminId });
      return response.forbidden(res, 'Access denied. Only Super Admins can create admin accounts.');
    }

    //  VALIDATION: Ensure all required fields are present
    if (!fullname || !email || !password || !role) {
      return response.validationError(res, 'All fields are required');
    }

    //  ROLE VALIDATION: Ensure role is valid enum value
    // Only accept: 'super_admin' or 'system_admin'
    if (role !== 'super_admin' && role !== 'system_admin') {
      logger.error('Invalid role in admin create', { role });
      return response.validationError(res, `Invalid role. Must be 'super_admin' or 'system_admin'`);
    }

    logger.debug('Creating admin', { role, email });

    const existingAdmin = await db.query(
      "SELECT id FROM admins WHERE email = ?",
      [email]
    );

    if (existingAdmin.length > 0) {
      logger.warn('Admin create failed - email exists', { email });
      return response.validationError(res, 'Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO admins (fullname, email, password, role) VALUES (?, ?, ?, ?)",
      [fullname, email, hashedPassword, role]
    );

    logger.info('Admin created successfully', { adminId: result.insertId, role, email });

    response.success(res, {
      message: "Admin created successfully",
      adminId: result.insertId,
    }, 'Admin created successfully', 201);
  } catch (err) {
    logger.error('Failed to create admin', { error: err.message, code: err.code, sqlMessage: err.sqlMessage });
    response.error(res, 'Failed to create admin', err);
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { fullname, email, password, role, currentAdminId } = req.body;
    const adminId = req.params.id;

    //  AUTHORIZATION: Only super_admin can update admins
    if (!currentAdminId) {
      return response.unauthorized(res, 'Authentication required. Please provide currentAdminId.');
    }
    const currentAdmin = await db.query(
      "SELECT role FROM admins WHERE id = ?",
      [currentAdminId]
    );
    if (currentAdmin.length === 0 || currentAdmin[0].role !== 'super_admin') {
      logger.warn('Admin update attempt - not super_admin', { currentAdminId, targetAdminId: adminId });
      return response.forbidden(res, 'Access denied. Only Super Admins can update admin accounts.');
    }

    //  ROLE VALIDATION: If role is being updated, validate it
    if (role && role !== 'super_admin' && role !== 'system_admin') {
      logger.error('Invalid role in admin update', { role, adminId });
      return response.validationError(res, `Invalid role. Must be 'super_admin' or 'system_admin'`);
    }

    if (role) {
      logger.debug('Updating admin role', { adminId, newRole: role });
    }

    const admin = await db.query("SELECT id FROM admins WHERE id = ?", [
      adminId,
    ]);
    if (admin.length === 0) {
      logger.warn('Admin update failed - not found', { adminId });
      return response.notFound(res, 'Admin not found');
    }

    if (email) {
      const existingAdmin = await db.query(
        "SELECT id FROM admins WHERE email = ? AND id != ?",
        [email, adminId]
      );

      if (existingAdmin.length > 0) {
        logger.warn('Admin update failed - email exists', { email, adminId });
        return response.validationError(res, 'Email already exists');
      }
    }

    let updates = [];
    let params = [];

    if (fullname) {
      updates.push("fullname = ?");
      params.push(fullname);
    }
    if (email) {
      updates.push("email = ?");
      params.push(email);
    }
    if (password) {
      updates.push("password = ?");
      params.push(await bcrypt.hash(password, 10));
    }
    if (role) {
      updates.push("role = ?");
      params.push(role);
    }

    if (updates.length === 0) {
      return response.validationError(res, 'No fields to update');
    }

    params.push(adminId);
    await db.query(
      `UPDATE admins SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    logger.info('Admin updated successfully', { adminId, role: role || 'unchanged' });

    response.success(res, null, 'Admin updated successfully');
  } catch (err) {
    logger.error('Failed to update admin', { adminId: req.params.id, error: err.message });
    response.error(res, 'Failed to update admin', err);
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const currentAdminId = req.query.currentAdminId || req.body.currentAdminId;

    //  AUTHORIZATION: Only super_admin can delete admins
    if (!currentAdminId) {
      return response.unauthorized(res, 'Authentication required. Please provide currentAdminId.');
    }
    const currentAdmin = await db.query(
      "SELECT role FROM admins WHERE id = ?",
      [currentAdminId]
    );
    if (currentAdmin.length === 0 || currentAdmin[0].role !== 'super_admin') {
      logger.warn('Admin delete attempt - not super_admin', { currentAdminId, targetAdminId: req.params.id });
      return response.forbidden(res, 'Access denied. Only Super Admins can delete admin accounts.');
    }

    const result = await db.query("DELETE FROM admins WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      logger.warn('Admin delete failed - not found', { adminId: req.params.id });
      return response.notFound(res, 'Admin not found');
    }

    logger.info('Admin deleted successfully', { adminId: req.params.id });
    response.success(res, null, 'Admin deleted successfully');
  } catch (err) {
    logger.error('Failed to delete admin', { adminId: req.params.id, error: err.message });
    response.error(res, 'Failed to delete admin', err);
  }
});

// ========== CSV IMPORT/EXPORT ROUTES ==========

/**
 * GET /api/admin/books/export
 * Combined CSV export endpoint - handles both template downloads and full data exports
 * 
 * UNIFIED CSV EXPORT - ROUTE HANDLER
 * Single endpoint that serves dual purposes based on query parameter mode.
 * Simplifies API surface by consolidating template and export functionality.
 * 
 * QUERY PARAMETER:
 * - ?mode=template → Returns header-only template for import
 * - No query or any other value → Returns full book export
 * 
 * ========== TEMPLATE MODE (mode=template) ==========
 * 
 * Purpose:
 * - Provides import template with correct column headers
 * - Helps users format their CSV correctly before importing
 * - Prevents format errors and import failures
 * 
 * Response Format:
 * - Content-Type: text/csv
 * - Filename: books_template.csv (fixed name, no timestamp)
 * - Content: Single header row only
 * 
 * CSV Structure:
 * - Headers: title,author,isbn,category,quantity
 * - No data rows (header-only)
 * - Plain UTF-8, no BOM
 * 
 * Use Case:
 * - User downloads template before importing books
 * - Opens in Excel/Google Sheets
 * - Fills in their book data
 * - Uploads via Import CSV feature
 * 
 * ========== FULL EXPORT MODE (default) ==========
 * 
 * Purpose:
 * - Export all books from database to CSV file
 * - Backup inventory data
 * - Generate reports for offline analysis
 * 
 * Response Format:
 * - Content-Type: text/csv
 * - Filename: books_export_YYYY-MM-DD_HH-mm-ss.csv (timestamped)
 * - Content: Headers + all book records
 * 
 * CSV Structure:
 * - Headers: title,author,isbn,category,quantity,status,added_date
 * - Data rows: All books from database (ordered by id DESC)
 * - Text fields: Quoted and comma-escaped
 * - Dates: YYYY-MM-DD format
 * 
 * Column Details:
 * - title: Book title (string, quoted)
 * - author: Author name (string, quoted)
 * - isbn: ISBN number (string)
 * - category: Book category (string, quoted)
 * - quantity: Current stock (integer, 0 if null)
 * - status: "available", "borrowed", or "missing"
 * - added_date: Date added in YYYY-MM-DD format
 * 
 * Use Cases:
 * - Backup entire book inventory
 * - Generate reports for administration
 * - Migrate data to other systems
 * - Audit inventory counts
 * 
 * ========== BENEFITS OF UNIFIED ENDPOINT ==========
 * 
 * 1. Simplified API:
 *    - One endpoint instead of two (/export and /template)
 *    - Easier to maintain and document
 *    - Consistent behavior and error handling
 * 
 * 2. Code Reusability:
 *    - Shared timestamp generation logic
 *    - Common CSV header setting
 *    - Single error handling path
 * 
 * 3. Flexibility:
 *    - Easy to add more export modes in future (e.g., ?mode=partial)
 *    - Query parameter approach is RESTful
 *    - Backwards compatible (default mode unchanged)
 * 
 * 4. Frontend Simplicity:
 *    - Same base URL for both operations
 *    - Just append ?mode=template for template download
 * 
 * ========== PROCESS FLOW ==========
 * 
 * Template Mode:
 * 1. Check if req.query.mode === "template"
 * 2. Build CSV string with header only
 * 3. Set Content-Type and Content-Disposition headers
 * 4. Send template CSV to client
 * 
 * Full Export Mode:
 * 1. Query database for all books
 * 2. Call exportBooksToCSV() to generate CSV with data
 * 3. Generate timestamp for unique filename
 * 4. Set Content-Type and Content-Disposition headers
 * 5. Send full CSV to client
 * 
 * Error Handling:
 * - Database errors: Returns 500 with error message
 * - All errors logged to console for debugging
 * - Template mode has no database dependency (no errors expected)
 * 
 * @route GET /api/admin/books/export
 * @query {string} mode - Optional. Set to "template" for header-only download
 * @returns {text/csv} CSV file download (template or full export)
 */
router.get("/books/export", requireAdmin, async (req, res) => {
  try {
    const mode = req.query.mode;

    // TEMPLATE MODE: Return header-only CSV
    if (mode === "template") {
      logger.info('Generating CSV template');

      const templateCSV = "title,author,isbn,category,quantity\n";

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="books_template.csv"'
      );

      res.send(templateCSV);
      logger.info('CSV template sent successfully');
      return;
    }

    // FULL EXPORT MODE: Return all books with data
    logger.info('Exporting books to CSV');

    const csvData = await exportBooksToCSV();

    // Generate timestamp for unique filename (YYYY-MM-DD_HH-mm-ss)
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/T/, "_")
      .replace(/:/g, "-")
      .slice(0, 19);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="books_export_${timestamp}.csv"`
    );

    res.send(csvData);
    logger.info('CSV export successful', { filename: `books_export_${timestamp}.csv` });
  } catch (err) {
    logger.error('CSV export failed', { error: err.message });
    response.error(res, "Failed to export books", err);
  }
});

/**
 * GET /api/admin/books/export-excel
 * Export all books to Excel file (.xlsx)
 * 
 * EXPORT BOOKS (EXCEL) - ROUTE HANDLER
 * Public endpoint that generates and downloads an Excel (.xlsx) file with all books.
 * This is the preferred export format for non-technical users due to better readability.
 * 
 * Response Format:
 * - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 * - Filename: books_export_YYYY-MM-DDTHH-MM-SS.xlsx (timestamped)
 * - Sheet Name: "Books"
 * - Headers: ID, Title, Author, ISBN, Category, Quantity, Status, Added Date
 * 
 * Excel Features:
 * - Auto-sized columns for optimal display
 * - Professional formatting (no quote escaping needed)
 * - Immediately opens in Excel/Google Sheets/LibreOffice
 * - Column widths optimized for readability
 * 
 * Advantages Over CSV:
 * - No comma/quote escaping issues
 * - Better visual presentation
 * - Easier for non-technical staff to use
 * - Preserves data types (dates, numbers)
 * 
 * Use Cases:
 * - Generate professional reports for administration
 * - Share inventory data with non-technical staff
 * - Create printable book lists with proper formatting
 * - Provide user-friendly exports for analysis
 * 
 * Process Flow:
 * 1. Call exportBooksToExcel() to generate binary buffer
 * 2. Create timestamp for unique filename
 * 3. Set response headers (Content-Type for .xlsx, Content-Disposition)
 * 4. Send binary buffer to client
 * 5. Browser triggers automatic download
 * 
 * Error Handling:
 * - Database errors: Returns 500 with error message
 * - xlsx generation errors: Caught and logged
 * - All errors logged to console for debugging
 * 
 * @route GET /api/admin/books/export-excel
 * @returns {application/vnd.openxmlformats-officedocument.spreadsheetml.sheet} Excel file download
 */
router.get("/books/export-excel", requireAdmin, async (req, res) => {
  try {
    logger.info('Exporting books to Excel');

    const excelBuffer = await exportBooksToExcel();

    // Set headers for Excel download
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="books_export_${timestamp}.xlsx"`
    );

    res.send(excelBuffer);
    logger.info('Excel export successful', { filename: `books_export_${timestamp}.xlsx` });
  } catch (err) {
    logger.error('Excel export failed', { error: err.message });
    response.error(res, "Failed to export books to Excel", err);
  }
});

/**
 * POST /api/admin/books/import
 * Import books from uploaded CSV or Excel file
 * 
 * IMPORT BOOKS (CSV/EXCEL) - ROUTE HANDLER
 * Multipart endpoint that accepts CSV file uploads and processes book imports.
 * Implements comprehensive validation, duplicate checking, and detailed error reporting.
 * 
 * Expected CSV Structure:
 * - Columns: title,author,isbn,category,quantity
 * - Headers must match exactly (case-sensitive)
 * - All rows processed sequentially
 * 
 * Request Format:
 * - Content-Type: multipart/form-data
 * - Field name: "file"
 * - Accepted file types: .csv only
 * - Max file size: 5MB (configured in multer middleware)
 * 
 * VALIDATION RULES (per row):
 * 
 * 1. Required Fields:
 *    - title, author, isbn, category must be non-empty
 *    - Missing fields → skip row, track in skipped_missing_fields
 * 
 * 2. Duplicate ISBN Check:
 *    - Query database for existing ISBN
 *    - Duplicate found → skip row, track in skipped_duplicate_isbns
 * 
 * 3. Quantity Handling:
 *    - Default to 1 if empty/null
 *    - If 0 → track in zero_quantity_entries for review
 * 
 * 4. Status Assignment:
 *    - quantity >= 1 → "available"
 *    - quantity = 0 + borrowed → "borrowed"
 *    - quantity = 0 + not borrowed → "missing"
 * 
 * 5. Automatic Fields:
 *    - added_date: Set to NOW() by database
 * 
 * Response JSON Structure:
 * {
 *   success: true,
 *   message: "Import completed successfully",
 *   summary: {
 *     total_rows: <number>,
 *     successfully_imported: <number>,
 *     skipped_missing_fields: [{row, data, reason}, ...],
 *     skipped_duplicate_isbns: [{row, isbn, title}, ...],
 *     zero_quantity_entries: [{row, isbn, title}, ...]
 *   }
 * }
 * 
 * Process Flow:
 * 1. Multer middleware intercepts upload and saves to /uploads
 * 2. Validate file was uploaded (400 if missing)
 * 3. Parse CSV file into array of book objects
 * 4. Process each row with validation (importBooks)
 * 5. Generate detailed import summary
 * 6. Clean up uploaded file (always, even on error)
 * 7. Return summary to frontend for display
 * 
 * Error Handling:
 * - No file uploaded: 400 "No file uploaded"
 * - Parse errors: 500 "Failed to parse CSV"
 * - Database errors: 500 "Failed to import books"
 * - File cleanup: Always executed in finally block
 * - All errors logged to console
 * 
 * Frontend Integration:
 * - Called by handleImportSubmit() in books-import-export.js
 * - Progress bar updated during upload
 * - Results displayed in modal with color-coded sections
 * - Books table reloaded after successful import
 * 
 * @route POST /api/admin/books/import
 * @param {File} req.file - Uploaded CSV file (handled by multer middleware)
 * @returns {Object} JSON response with import summary and validation details
 */
router.post("/books/import", requireAdmin, upload.single("file"), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please select a CSV or Excel file.",
      });
    }

    filePath = req.file.path;
    const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
    
    logger.info('Processing import file', { filename: req.file.originalname, type: fileExtension });

    // Detect file type and parse accordingly
    let books;
    if (fileExtension === 'csv') {
      logger.debug('Parsing as CSV');
      books = await parseCSV(filePath);
    } else if (fileExtension === 'xlsx') {
      logger.debug('Parsing as Excel');
      books = await parseExcel(filePath);
    } else {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: "Unsupported file type. Please upload a CSV (.csv) or Excel (.xlsx) file.",
      });
    }

    if (!books || books.length === 0) {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: "File is empty or contains no valid data",
      });
    }

    logger.info('File parsed successfully', { rowCount: books.length, fileType: fileExtension.toUpperCase() });

    // Import books with validation (same logic for both CSV and Excel)
    const summary = await importBooks(books);

    // Clean up uploaded file
    cleanupFile(filePath);

    // Return detailed summary
    res.json({
      success: true,
      message: `Import completed: ${summary.successfully_imported} books imported, ${summary.updated_existing || 0} updated, ${(summary.skipped_duplicate_isbns || []).length} skipped (ISBN in trash), ${
        summary.skipped_missing_fields.length + summary.skipped_duplicate_isbns.length
      } skipped`,
      summary: summary,
    });

    logger.info('Import completed', { 
      imported: summary.successfully_imported, 
      skipped: summary.skipped_missing_fields.length + summary.skipped_duplicate_isbns.length 
    });
  } catch (err) {
    logger.error('Import failed', { error: err.message });
    
    // Clean up file on error
    if (filePath) {
      cleanupFile(filePath);
    }

    response.error(res, "Failed to import books", err);
  }
});

// ========== GMAIL-STYLE BULK OPERATIONS ==========

/**
 * POST /api/admin/books/bulk-delete
 * Delete multiple books at once
 * 
 * BULK DELETE - Gmail-style bulk operations
 * Accepts an array of book IDs and deletes them in a single transaction.
 * Checks each book to ensure it's not currently borrowed before deletion.
 * 
 * Request body: { ids: [1, 2, 3] }
 * Response: { success: true, deletedCount: N }
 */
router.post("/books/bulk-delete", requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return response.validationError(res, "No book IDs provided");
    }
    
    logger.info('Bulk delete initiated', { bookCount: ids.length, bookIds: ids });
    
    let deletedCount = 0;
    const errors = [];
    
    // Process each book
    for (const bookId of ids) {
      try {
        // Check if book exists
        const book = await db.query("SELECT id, title, deleted_at FROM books WHERE id = ?", [bookId]);
        if (book.length === 0) {
          errors.push(`Book ID ${bookId} not found`);
          logger.warn('Book not found in bulk delete', { bookId });
          continue;
        }
        
        // Check if book is currently borrowed
        const borrowStatus = await db.query(
          "SELECT COUNT(*) as count FROM book_borrowings WHERE book_id = ? AND status IN ('borrowed', 'overdue') AND return_date IS NULL",
          [bookId]
        );
        
        if (borrowStatus[0].count > 0) {
          errors.push(`Cannot move "${book[0].title}" (ID: ${bookId}) to trash - currently borrowed`);
          logger.warn('Cannot bulk-delete borrowed book', { bookId, title: book[0].title, activeLoans: borrowStatus[0].count });
          continue;
        }
        
        // Skip if already in trash
        if (book[0].deleted_at) {
          errors.push(`"${book[0].title}" (ID: ${bookId}) is already in trash`);
          continue;
        }
        
        // Soft delete — move to trash
        await db.query("UPDATE books SET deleted_at = NOW(), trash_id = UUID() WHERE id = ?", [bookId]);
        
        deletedCount++;
        logger.info('Book moved to trash in bulk operation', { bookId, title: book[0].title });
        
      } catch (err) {
        logger.error('Error deleting book in bulk operation', { bookId, error: err.message });
        errors.push(`Error deleting book ID ${bookId}: ${err.message}`);
      }
    }
    
    const responseData = {
      deletedCount: deletedCount,
      requested: ids.length,
      errors: errors.length > 0 ? errors : undefined
    };
    
    const message = errors.length > 0
      ? `Moved ${deletedCount} out of ${ids.length} books to trash. ${errors.length} error(s) occurred.`
      : `Successfully moved ${deletedCount} book(s) to trash`;
    
    logger.info('Bulk move-to-trash completed', { deletedCount, requested: ids.length, errorCount: errors.length });
    response.success(res, responseData, message);
    
  } catch (err) {
    logger.error('Bulk delete failed', { error: err.message });
    response.error(res, "Failed to delete books", err);
  }
});

/**
 * PATCH /api/admin/books/bulk-update
 * Update multiple books at once
 * 
 * BULK UPDATE - Gmail-style bulk operations
 * Accepts an array of book IDs and applies the same updates to all of them.
 * Only updates fields that are provided in the update object.
 * 
 * Request body: { 
 *   ids: [1, 2, 3],
 *   update: { category: "New Category", status: "available", quantity: 5 }
 * }
 * Response: { success: true, updatedCount: N }
 */
router.patch("/books/bulk-update", requireAdmin, async (req, res) => {
  try {
    const { ids, update } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return response.validationError(res, "No book IDs provided");
    }
    
    if (!update || Object.keys(update).length === 0) {
      return response.validationError(res, "No update fields provided");
    }
    
    logger.info('Bulk update requested', { bookCount: ids.length, updates: update });
    
    // Build dynamic UPDATE query based on provided fields
    const updates = [];
    const params = [];
    
    if (update.category !== undefined) {
      updates.push("category = ?");
      params.push(update.category);
    }
    
    if (update.status !== undefined) {
      updates.push("status = ?");
      params.push(update.status);
      
      // If changing status to "Available" without changing quantity,
      // automatically make all copies available
      if (update.status === "available" && update.quantity === undefined) {
        updates.push("available_quantity = quantity");
      }
    }
    
    if (update.quantity !== undefined) {
      const quantity = parseInt(update.quantity, 10);
      updates.push("quantity = ?");
      params.push(quantity);
      
      // Update available_quantity based on new quantity
      // If increasing quantity, increase available_quantity proportionally
      // If decreasing, ensure available_quantity doesn't exceed new quantity
      updates.push("available_quantity = LEAST(?, available_quantity + ? - quantity)");
      params.push(quantity); // max value
      params.push(quantity); // adjustment
    }
    
    if (updates.length === 0) {
      return response.validationError(res, "No valid update fields provided");
    }
    
    updates.push("updated_at = NOW()");
    
    let updatedCount = 0;
    const errors = [];
    
    logger.info('Bulk update initiated', { bookCount: ids.length, bookIds: ids, fields: update });
    
    // Update each book
    for (const bookId of ids) {
      try {
        await db.withTransaction(async (conn) => {
          const book = await conn.queryAsync(
            "SELECT id, title, quantity, status FROM books WHERE id = ? FOR UPDATE",
            [bookId]
          );

          if (book.length === 0) {
            errors.push(`Book ID ${bookId} not found`);
            logger.warn('Book not found in bulk update', { bookId });
            return;
          }

          if (update.quantity !== undefined) {
            const [borrowingCount] = await conn.queryAsync(
              `SELECT COUNT(*) AS count
                 FROM book_borrowings
                WHERE book_id = ?
                  AND return_date IS NULL
                  AND status IN ('borrowed', 'overdue')`,
              [bookId]
            );
            const activeBorrowings = Number(borrowingCount.count || 0);
            const requestedQuantity = Number.parseInt(update.quantity, 10) || 0;

            if (requestedQuantity < activeBorrowings) {
              throw new Error(`VALIDATION:Quantity cannot be lower than the ${activeBorrowings} active borrowing(s) for this book.`);
            }
          }

          const query = `UPDATE books SET ${updates.join(", ")} WHERE id = ?`;
          const queryParams = [...params, bookId];
          await conn.queryAsync(query, queryParams);

          const updatedBookRows = await conn.queryAsync(
            "SELECT quantity, status FROM books WHERE id = ?",
            [bookId]
          );
          const updatedBook = updatedBookRows[0];

          await ensureBookCopyCoverage(conn, {
            bookId,
            quantity: updatedBook.quantity,
            bookStatus: updatedBook.status,
            performedBy: req.session?.user?.id || req.session?.adminId || null,
            source: 'admin_bulk_update_books',
          });
        });

        updatedCount++;
        
        logger.info('Book updated in bulk operation', { bookId });
        
      } catch (err) {
        logger.error('Error updating book in bulk operation', { bookId, error: err.message });
        errors.push(`Error updating book ID ${bookId}: ${err.message}`);
      }
    }
    
    const responseData = {
      updatedCount: updatedCount,
      requested: ids.length,
      errors: errors.length > 0 ? errors : undefined
    };
    
    const message = errors.length > 0
      ? `Updated ${updatedCount} out of ${ids.length} books. ${errors.length} error(s) occurred.`
      : `Successfully updated ${updatedCount} book(s)`;
    
    logger.info('Bulk update completed', { updatedCount, requested: ids.length, errorCount: errors.length });
    response.success(res, responseData, message);
    
  } catch (err) {
    logger.error('Bulk update failed', { error: err.message });
    response.error(res, "Failed to update books", err);
  }
});

// =============================
// BORROWED BOOKS MANAGEMENT
// =============================

/**
 * GET /api/admin/borrowings
 * List all borrow transactions with filters
 * Access: Super Admin + System Admin
 */
router.get("/borrowings", requireAdmin, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    // Search filter: student name, student ID, book title, accession number, ISBN
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(`(
        s.fullname LIKE ? OR 
        s.student_id LIKE ? OR 
        b.title LIKE ? OR 
        bb.accession_number LIKE ? OR 
        b.isbn LIKE ?
      )`);
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Category filter
    if (category && category.trim()) {
      whereConditions.push("b.category = ?");
      queryParams.push(category.trim());
    }
    
    // Status filter
    if (status && status.trim()) {
      if (status === 'pending_pickup') {
        whereConditions.push("bb.status = 'pending_pickup'");
      } else if (status === 'picked_up') {
        whereConditions.push("bb.status = 'borrowed'");
      } else if (status === 'overdue') {
        // Overdue: either marked overdue in DB, or past due date and not yet returned
        whereConditions.push("(bb.status = 'overdue' OR (bb.status = 'borrowed' AND bb.return_date IS NULL AND bb.due_date < NOW()))");
      } else {
        // Direct status match (returned, etc.)
        whereConditions.push("bb.status = ?");
        queryParams.push(status);
      }
    }
    
    const whereClause = whereConditions.length > 0 
      ? "WHERE " + whereConditions.join(" AND ")
      : "";
    
    const query = `
      SELECT 
        bb.id,
        bb.book_id,
        bb.accession_number,
        bb.student_id,
        bb.borrow_date,
        bb.due_date,
        bb.claim_expires_at,
        bb.picked_up_at,
        bb.return_date,
        bb.status,
        CASE
          WHEN bb.return_date IS NULL AND bb.status <> 'returned' THEN 1
          ELSE 0
        END AS is_active,
        bb.copy_condition_at_borrow,
        bb.copy_condition_at_return,
        bb.notes,
        s.fullname AS student_name,
        s.email AS student_email,
        s.department AS student_department,
        s.year_level AS student_year_level,
        -- [ORPHAN FIX] COALESCE so soft/hard deleted books show a safe placeholder
        COALESCE(b.title, '(Removed from system)') AS book_title,
        COALESCE(b.author, '') AS book_author,
        COALESCE(b.isbn, '') AS book_isbn,
        COALESCE(b.category, '') AS book_category,
        -- [ORPHAN FIX] book_missing = 1 when book row is gone or trashed
        IF(b.id IS NULL OR b.deleted_at IS NOT NULL, 1, 0) AS book_missing,
        a_approved.fullname AS approved_by_name,
        a_picked.fullname AS picked_up_by_name,
        a_returned.fullname AS returned_by_name,
        CASE 
          WHEN bb.status = 'returned' THEN 'returned'
          WHEN bb.return_date IS NULL AND (bb.status = 'overdue' OR (bb.status = 'borrowed' AND bb.due_date < NOW())) THEN 'overdue'
          WHEN bb.status = 'pending_pickup' AND COALESCE(LEAST(bb.claim_expires_at, DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)), DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)) < NOW() THEN 'claim_expired'
          WHEN bb.status = 'borrowed' THEN 'picked_up'
          WHEN bb.status = 'pending_pickup' THEN 'pending_pickup'
          ELSE bb.status
        END AS display_status
      FROM book_borrowings bb
      INNER JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      -- [ORPHAN FIX] LEFT JOIN so records survive even when book was hard-deleted
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN admins a_approved ON bb.approved_by = a_approved.id
      LEFT JOIN admins a_picked ON bb.picked_up_by_admin_id = a_picked.id
      LEFT JOIN admins a_returned ON bb.returned_by_admin_id = a_returned.id
      ${whereClause}
      ORDER BY bb.borrow_date DESC
    `;
    
    const borrowings = await db.query(query, queryParams);
    
    logger.info('Borrowings fetched', { 
      count: borrowings.length, 
      search: search || 'none', 
      category: category || 'none',
      status: status || 'all'
    });
    
    response.success(res, borrowings);
    
  } catch (error) {
    logger.error('Error fetching borrowings', { error: error.message });
    response.error(res, 'Error fetching borrowings', error);
  }
});

router.get("/borrowings/:id", requireAdmin, async (req, res) => {
  const borrowingId = req.params.id;

  try {
    const rows = await db.query(
      `SELECT 
        bb.id,
        bb.book_id,
        bb.accession_number,
        bb.student_id,
        bb.borrow_date,
        bb.due_date,
        bb.claim_expires_at,
        bb.picked_up_at,
        bb.return_date,
        bb.status,
        CASE
          WHEN bb.return_date IS NULL AND bb.status <> 'returned' THEN 1
          ELSE 0
        END AS is_active,
        bb.copy_condition_at_borrow,
        bb.copy_condition_at_return,
        bb.notes,
        s.fullname AS student_name,
        s.email AS student_email,
        s.department AS student_department,
        s.year_level AS student_year_level,
        COALESCE(b.title, '(Removed from system)') AS book_title,
        COALESCE(b.author, '') AS book_author,
        COALESCE(b.isbn, '') AS book_isbn,
        COALESCE(b.category, '') AS book_category,
        IF(b.id IS NULL OR b.deleted_at IS NOT NULL, 1, 0) AS book_missing,
        a_approved.fullname AS approved_by_name,
        a_picked.fullname AS picked_up_by_name,
        a_returned.fullname AS returned_by_name,
        CASE 
          WHEN bb.status = 'returned' THEN 'returned'
          WHEN bb.return_date IS NULL AND (bb.status = 'overdue' OR (bb.status = 'borrowed' AND bb.due_date < NOW())) THEN 'overdue'
          WHEN bb.status = 'pending_pickup' AND COALESCE(LEAST(bb.claim_expires_at, DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)), DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)) < NOW() THEN 'claim_expired'
          WHEN bb.status = 'borrowed' THEN 'picked_up'
          WHEN bb.status = 'pending_pickup' THEN 'pending_pickup'
          ELSE bb.status
        END AS display_status
      FROM book_borrowings bb
      INNER JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN admins a_approved ON bb.approved_by = a_approved.id
      LEFT JOIN admins a_picked ON bb.picked_up_by_admin_id = a_picked.id
      LEFT JOIN admins a_returned ON bb.returned_by_admin_id = a_returned.id
      WHERE bb.id = ?
      LIMIT 1`,
      [borrowingId]
    );

    if (!rows || rows.length === 0) {
      return response.notFound(res, 'Borrowing record not found');
    }

    return response.success(res, rows[0]);
  } catch (error) {
    logger.error('Error fetching borrowing detail', { borrowingId, error: error.message });
    return response.error(res, 'Error fetching borrowing detail', error);
  }
});

/**
 * POST /api/admin/borrowings/:id/approve
 * Approve a pending borrow request (change status from 'pending' to 'borrowed')
 * Only available if REQUIRE_BORROW_APPROVAL environment variable is set
 * Access: Super Admin + System Admin
 */
router.post("/borrowings/:id/approve", requireAdmin, async (req, res) => {
  const borrowingId = req.params.id;
  const adminId = req.session.user?.id || req.session.adminId;
  
  // Check if approval is required
  const requireAdminApproval = process.env.REQUIRE_BORROW_APPROVAL === 'true';
  if (!requireAdminApproval) {
    return response.validationError(res, 'Admin approval is not required in current configuration');
  }
  
  try {
    const claimExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    let assignedAccessionNumber = null;

    const [borrowing] = await db.query(
      "SELECT id, status, student_id, book_id FROM book_borrowings WHERE id = ?",
      [borrowingId]
    );
    
    if (!borrowing) {
      return response.notFound(res, 'Borrowing record not found');
    }
    
    // Validate status
    if (borrowing.status !== 'pending') {
      return response.validationError(res, `Cannot approve borrowing with status '${borrowing.status}'. Only 'pending' borrows can be approved.`);
    }

    await db.withTransaction(async (conn) => {
      const copyRows = await conn.queryAsync(
        `SELECT accession_number, condition_status
         FROM book_copies
         WHERE book_id = ? AND status = 'available'
         ORDER BY copy_number ASC
         LIMIT 1
         FOR UPDATE`,
        [borrowing.book_id]
      );

      if (!copyRows || copyRows.length === 0) {
        throw new Error('VALIDATION:No available copy is left to assign for this approval.');
      }

      const copy = copyRows[0];
      assignedAccessionNumber = copy.accession_number;

      await conn.queryAsync(
        `UPDATE book_borrowings 
         SET status = 'borrowed',
             approved_by = ?,
             accession_number = ?,
             copy_condition_at_borrow = ?,
             borrow_date = NOW(),
             claim_expires_at = ?,
             email_sent_at = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [adminId, copy.accession_number, copy.condition_status || null, claimExpiresAt, borrowingId]
      );

      await conn.queryAsync(
        `UPDATE book_copies
         SET status = 'borrowed'
         WHERE accession_number = ?`,
        [copy.accession_number]
      );
    });

    console.log('[ADMIN BORROW] Attempting to send email', { studentId: borrowing.student_id, borrowingId });
    const emailStatus = await sendBorrowingClaimEmailForBorrowings(
      borrowing.student_id,
      [Number(borrowingId)],
      claimExpiresAt
    );
    console.log('[ADMIN BORROW] Email send completed', { borrowingId, success: emailStatus.success });

    logger.info('Borrow request approved', {
      borrowingId,
      adminId,
      studentId: borrowing.student_id,
      bookId: borrowing.book_id,
      accessionNumber: assignedAccessionNumber,
      emailSent: emailStatus.success === true,
    });
    
    return response.success(
      res,
      {
        borrowingId,
        status: 'borrowed',
        accessionNumber: assignedAccessionNumber,
        claimExpiresAt,
        emailStatus,
      },
      'Borrow request approved successfully'
    );
    
  } catch (error) {
    if (error.message && error.message.startsWith('VALIDATION:')) {
      return response.validationError(res, error.message.replace('VALIDATION:', ''));
    }
    logger.error('Error approving borrow request', {
      error: error.message,
      borrowingId
    });
    return response.error(res, 'Error approving borrow request', error);
  }
});

/**
 * POST /api/admin/borrowings/:id/confirm-pickup
 * Confirm that book was physically handed to student
 * Access: Super Admin + System Admin
 */
router.post("/borrowings/:id/confirm-pickup", requireAdmin, async (req, res) => {
  const borrowingId = req.params.id;
  const adminId = req.session.user?.id || req.session.adminId;
  
  try {
    // Get borrowing details
    const borrowing = await db.query(
      "SELECT id, status, borrow_date, claim_expires_at, picked_up_at, student_id FROM book_borrowings WHERE id = ?",
      [borrowingId]
    );
    
    if (!borrowing || borrowing.length === 0) {
      logger.warn('Borrowing not found for pickup confirmation', { borrowingId });
      return response.notFound(res, 'Borrowing record not found');
    }
    
    const record = borrowing[0];
    
    // Validate status transition
    if (record.picked_up_at) {
      logger.warn('Pickup already confirmed', { borrowingId, picked_up_at: record.picked_up_at });
      return response.validationError(res, 'Pickup has already been confirmed');
    }

    const allowedStatuses = new Set(['pending_pickup', 'borrowed']);
    if (!allowedStatuses.has(record.status)) {
      logger.warn('Invalid status for pickup', { borrowingId, status: record.status });
      return response.validationError(res, `Can only confirm pickup for pending_pickup or borrowed items. Current status: ${record.status}`);
    }

    // Enforce strict pickup window (max 24 hours from borrow_date).
    // If claim_expires_at exists, use the earlier of that value and borrow_date + 24h.
    const borrowDate = new Date(record.borrow_date);
    const hardLimit = new Date(borrowDate.getTime() + 24 * 60 * 60 * 1000);
    const claimExpires = record.claim_expires_at ? new Date(record.claim_expires_at) : null;
    const effectiveExpiry = claimExpires && !Number.isNaN(claimExpires.getTime()) && claimExpires < hardLimit
      ? claimExpires
      : hardLimit;

    if (new Date() > effectiveExpiry) {
      logger.warn('Pickup window expired', {
        borrowingId,
        studentId: record.student_id,
        effectiveExpiry: effectiveExpiry.toISOString(),
      });
      return response.validationError(res, 'Pickup window has expired (24-hour limit reached).');
    }
    
    // Update borrowing record — set status to 'borrowed' and record pickup time
    await db.query(
      `UPDATE book_borrowings 
       SET status = 'borrowed',
           picked_up_at = NOW(), 
           picked_up_by_admin_id = ?
       WHERE id = ?`,
      [adminId, borrowingId]
    );
    
    // Fetch updated record
    const updated = await db.query(
      `SELECT 
        bb.*,
        s.fullname AS student_name,
        b.title AS book_title,
        a.fullname AS picked_up_by_name
       FROM book_borrowings bb
      LEFT JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
       LEFT JOIN books b ON bb.book_id = b.id
       LEFT JOIN admins a ON bb.picked_up_by_admin_id = a.id
       WHERE bb.id = ?`,
      [borrowingId]
    );
    
    logger.info('Pickup confirmed', { 
      borrowingId, 
      adminId, 
      studentId: record.student_id 
    });
    
    response.success(res, updated[0], 'Pickup confirmed successfully');
    
  } catch (error) {
    logger.error('Error confirming pickup', { borrowingId, error: error.message });
    response.error(res, 'Error confirming pickup', error);
  }
});

/**
 * POST /api/admin/borrowings/:id/confirm-return
 * Confirm that book was returned to library
 * Access: Super Admin + System Admin
 */
router.post("/borrowings/:id/confirm-return", requireAdmin, async (req, res) => {
  const borrowingId = req.params.id;
  const adminId = req.session.user?.id || req.session.adminId;
  const { condition } = req.body; // Optional: copy condition at return
  
  try {
    // Get borrowing details
    const borrowing = await db.query(
      `SELECT bb.id, bb.status, bb.return_date, bb.accession_number, bb.book_id
       FROM book_borrowings bb
       WHERE bb.id = ?`,
      [borrowingId]
    );
    
    if (!borrowing || borrowing.length === 0) {
      logger.warn('Borrowing not found for return confirmation', { borrowingId });
      return response.notFound(res, 'Borrowing record not found');
    }
    
    const record = borrowing[0];
    
    // Validate status transition
    if (record.status === 'returned') {
      logger.warn('Return already confirmed', { borrowingId });
      return response.validationError(res, 'Return has already been confirmed');
    }
    
    if (!['borrowed', 'overdue'].includes(record.status)) {
      logger.warn('Invalid status for return', { borrowingId, status: record.status });
      return response.validationError(res, 'Can only confirm return for borrowed or overdue items');
    }
    
    // Start transaction
    await db.query('START TRANSACTION');
    
    try {
      // Update borrowing record
      const updateFields = [
        'return_date = NOW()',
        'returned_by_admin_id = ?',
        "status = 'returned'"
      ];
      const updateParams = [adminId];
      
      if (condition && ['excellent', 'good', 'fair', 'poor', 'damaged'].includes(condition)) {
        updateFields.push('copy_condition_at_return = ?');
        updateParams.push(condition);
      }
      
      await db.query(
        `UPDATE book_borrowings 
         SET ${updateFields.join(', ')}
         WHERE id = ?`,
        [...updateParams, borrowingId]
      );
      
      // Update book copy status back to available
      if (record.accession_number) {
        await db.query(
          "UPDATE book_copies SET status = 'available' WHERE accession_number = ?",
          [record.accession_number]
        );
        
        logger.info('Book copy marked as available', { accession_number: record.accession_number });
      }
      
      // [ORPHAN FIX] Recalculate available_quantity from ground truth instead of
      // incrementing, so counter drift can never cause a CHECK constraint violation.
      await db.query(
        `UPDATE books
         SET available_quantity = GREATEST(0,
           quantity - (
             SELECT COUNT(*) FROM book_borrowings
             WHERE book_id = ? AND status IN ('borrowed','overdue') AND return_date IS NULL
           )
         )
         WHERE id = ?`,
        [record.book_id, record.book_id]
      );
      
      await db.query('COMMIT');
      
      // Fetch updated record
      const updated = await db.query(
        `SELECT 
          bb.*,
          s.fullname AS student_name,
          b.title AS book_title,
          a.fullname AS returned_by_name
         FROM book_borrowings bb
         LEFT JOIN students s
           ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
         LEFT JOIN books b ON bb.book_id = b.id
         LEFT JOIN admins a ON bb.returned_by_admin_id = a.id
         WHERE bb.id = ?`,
        [borrowingId]
      );
      
      logger.info('Return confirmed', { 
        borrowingId, 
        adminId, 
        accession_number: record.accession_number 
      });
      
      response.success(res, updated[0], 'Return confirmed successfully');
      
    } catch (txError) {
      await db.query('ROLLBACK');
      throw txError;
    }
    
  } catch (error) {
    logger.error('Error confirming return', { borrowingId, error: error.message });
    response.error(res, 'Error confirming return', error);
  }
});

/**
 * POST /api/admin/borrowings/:id/cancel
 * Admin cancels a pending pickup request (restores book availability)
 * Access: Super Admin + System Admin
 */
router.post('/borrowings/:id/cancel', requireAdmin, async (req, res) => {
  const borrowingId = req.params.id;
  const adminId = req.session.user?.id || req.session.adminId;

  try {
    const borrowings = await db.query(
      `SELECT bb.id, bb.status, bb.picked_up_at, bb.book_id, bb.accession_number, bb.student_id,
              b.title AS book_title, s.email AS student_email
       FROM book_borrowings bb
       LEFT JOIN books b ON bb.book_id = b.id
       LEFT JOIN students s
         ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
       WHERE bb.id = ?`,
      [borrowingId]
    );

    if (!borrowings || borrowings.length === 0) {
      return response.notFound(res, 'Borrowing record not found');
    }

    const record = borrowings[0];

    const cancellableStatuses = new Set(['pending', 'approved', 'pending_pickup', 'borrowed']);
    if (!cancellableStatuses.has(record.status) || record.picked_up_at) {
      const pickedUpState = record.picked_up_at ? 'already picked up' : 'not picked up';
      return response.validationError(
        res,
        `Only pending (not yet picked up) requests can be cancelled. Current status: ${record.status}, ${pickedUpState}.`
      );
    }

    await db.withTransaction(async (conn) => {
      await conn.queryAsync(
        `UPDATE book_borrowings
         SET status = 'cancelled',
             notes = CONCAT(COALESCE(notes, ''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END, 'Cancelled by admin')
         WHERE id = ? AND status IN ('pending', 'approved', 'pending_pickup', 'borrowed') AND picked_up_at IS NULL`,
        [borrowingId]
      );

      if (record.accession_number) {
        await conn.queryAsync(
          `UPDATE book_copies SET status = 'available' WHERE accession_number = ?`,
          [record.accession_number]
        );
      }

      await conn.queryAsync(
        `UPDATE books SET available_quantity = LEAST(quantity, available_quantity + 1) WHERE id = ?`,
        [record.book_id]
      );
    });

    const { createNotification } = require('../routes/notifications');
    await createNotification({
      user_type: 'student',
      user_id: record.student_id,
      title: 'Borrow Request Cancelled by Admin',
      message: `Your borrow request for "${record.book_title}" has been cancelled by an administrator.`,
      type: 'SYSTEM',
      related_table: 'book_borrowings',
      related_id: borrowingId
    });

    logger.info('Borrow request cancelled by admin', { borrowingId, adminId, studentId: record.student_id });
    response.success(res, null, 'Borrow request cancelled successfully');
  } catch (error) {
    logger.error('Error cancelling borrow request', { borrowingId, error: error.message });
    response.error(res, 'Error cancelling borrow request', error);
  }
});

// =============================
// BOOK DETAILS & STATISTICS
// =============================

// Get book details with borrowing overview
router.get('/books/:id/details', requireAdmin, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    
    // Get book details with copies count
    const [book] = await db.query(`
      SELECT 
        b.*,
        a.fullname as added_by_name,
        COUNT(DISTINCT bc.id) as total_copies,
        COUNT(DISTINCT CASE WHEN bc.status = 'available' THEN bc.id END) as available_copies,
        COUNT(DISTINCT CASE WHEN bc.status = 'borrowed' THEN bc.id END) as borrowed_copies
      FROM books b
      LEFT JOIN admins a ON b.added_by = a.id
      LEFT JOIN book_copies bc ON b.id = bc.book_id
      WHERE b.id = ? AND b.deleted_at IS NULL
      GROUP BY b.id
    `, [bookId]);
    
    if (!book) {
      return response.notFound(res, 'Book not found');
    }
    
    // Get borrowing statistics
    const borrowingStats = await db.query(`
      SELECT 
        COUNT(*) as total_borrowings,
        COUNT(DISTINCT student_id) as unique_borrowers,
        SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END) as currently_borrowed,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as total_returned,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        AVG(CASE 
          WHEN status = 'returned' AND return_date IS NOT NULL 
          THEN DATEDIFF(return_date, borrow_date) 
          ELSE NULL 
        END) as avg_borrow_duration_days
      FROM book_borrowings
      WHERE book_id = ?
    `, [bookId]);
    
    // Get recent borrowings (last 10)
    const recentBorrowings = await db.query(`
      SELECT 
        bb.id,
        bb.student_id,
        s.fullname as student_name,
        s.department,
        bb.borrow_date,
        bb.due_date,
        bb.return_date,
        bb.status,
        bb.accession_number,
        bc.copy_number
      FROM book_borrowings bb
      LEFT JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      LEFT JOIN book_copies bc
        ON bb.accession_number COLLATE utf8mb4_unicode_ci = bc.accession_number COLLATE utf8mb4_unicode_ci
      WHERE bb.book_id = ?
      ORDER BY bb.borrow_date DESC
      LIMIT 10
    `, [bookId]);
    
    // Get monthly borrowing trend (last 12 months)
    const borrowingTrend = await db.query(`
      SELECT 
        DATE_FORMAT(borrow_date, '%Y-%m') as month,
        COUNT(*) as count
      FROM book_borrowings
      WHERE book_id = ? AND borrow_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(borrow_date, '%Y-%m')
      ORDER BY month DESC
    `, [bookId]);
    
    // Get book copies with status
    const bookCopies = await db.query(`
      SELECT 
        id,
        copy_number,
        accession_number,
        status,
        acquisition_date,
        notes
      FROM book_copies
      WHERE book_id = ?
      ORDER BY copy_number ASC
    `, [bookId]);
    
    const result = {
      book,
      statistics: borrowingStats[0] || {},
      recentBorrowings,
      borrowingTrend,
      bookCopies
    };
    
    response.success(res, result, 'Book details fetched successfully');
    
  } catch (error) {
    logger.error('Error fetching book details', { bookId: req.params.id, error: error.message });
    response.error(res, 'Error fetching book details', error);
  }
});

// =============================
// BOOK PROFILE WITH BORROWING OVERVIEW
// (Accessible by both Super Admin and System Admin)
// =============================

// Get book profile data
router.get('/books/:bookId/profile', requireAdmin, async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId);
    
    const books = await db.query(`
      SELECT 
        id,
        title,
        author,
        category,
        isbn,
        quantity as total_quantity,
        available_quantity,
        status,
        added_date
      FROM books
      WHERE id = ? AND deleted_at IS NULL
    `, [bookId]);
    
    if (!books || books.length === 0) {
      return response.notFound(res, 'Book not found');
    }
    
    response.success(res, books[0], 'Book profile fetched successfully');
    
  } catch (error) {
    logger.error('Error fetching book profile', { bookId: req.params.bookId, error: error.message, stack: error.stack });
    response.error(res, 'Error fetching book profile', error);
  }
});

// Get book copies with accession numbers
router.get('/books/:bookId/copies', requireAdmin, async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId);
    
    const copies = await db.query(`
      SELECT 
        id,
        accession_number,
        copy_number,
        status,
        acquisition_date,
        notes
      FROM book_copies
      WHERE book_id = ?
      ORDER BY copy_number ASC
    `, [bookId]);
    
    response.success(res, copies, `Found ${copies.length} copies`);
    
  } catch (error) {
    logger.error('Error fetching book copies', { bookId: req.params.bookId, error: error.message });
    response.error(res, 'Error fetching book copies', error);
  }
});

// Get book borrowings with student information
router.get('/books/:bookId/borrowings', requireAdmin, async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const statusFilter = req.query.status || 'all'; // all, active, overdue, returned
    
    let query = `
      SELECT 
        bb.id,
        bb.student_id,
        s.fullname as student_name,
        s.email as student_email,
        s.department,
        bb.borrow_date as borrowed_on,
        bb.due_date,
        bb.return_date,
        bb.status,
        bb.accession_number,
        bc.copy_number
      FROM book_borrowings bb
      LEFT JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
       AND s.deleted_at IS NULL
      LEFT JOIN book_copies bc
        ON bb.accession_number COLLATE utf8mb4_unicode_ci = bc.accession_number COLLATE utf8mb4_unicode_ci
      WHERE bb.book_id = ?
    `;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        query += ` AND bb.status IN ('borrowed', 'approved')`;
      } else if (statusFilter === 'overdue') {
        query += ` AND bb.status = 'overdue'`;
      } else if (statusFilter === 'returned') {
        query += ` AND bb.status = 'returned'`;
      }
    }
    
    query += ` ORDER BY bb.borrow_date DESC LIMIT 100`;
    
    const borrowings = await db.query(query, [bookId]);
    
    // Calculate summary counts from all borrowings (not filtered)
    const allBorrowingsQuery = `
      SELECT status FROM book_borrowings WHERE book_id = ?
    `;
    const allBorrowings = await db.query(allBorrowingsQuery, [bookId]);
    
    const summary = {
      total: allBorrowings.length,
      active: allBorrowings.filter(b => b.status === 'borrowed' || b.status === 'approved').length,
      overdue: allBorrowings.filter(b => b.status === 'overdue').length,
      returned: allBorrowings.filter(b => b.status === 'returned').length
    };
    
    response.success(res, { borrowings, summary }, 'Borrowings fetched successfully');
    
  } catch (error) {
    logger.error('Error fetching book borrowings', { bookId: req.params.bookId, error: error.message, stack: error.stack });
    response.error(res, 'Error fetching book borrowings', error);
  }
});

// =============================
// TRASH/BIN MANAGEMENT
// =============================

// ===== BOOKS TRASH (Admin - both Super Admin and System Admin) =====

// Get all trashed books
router.get('/books/trash', requireAdmin, async (req, res) => {
  try {
    const { search, category } = req.query;
    
    let query = `
      SELECT 
        b.*,
        b.trash_id,
        a.fullname as added_by_name,
        COUNT(DISTINCT bc.id) as total_copies
      FROM books b
      LEFT JOIN admins a ON b.added_by = a.id
      LEFT JOIN book_copies bc ON b.id = bc.book_id
      WHERE b.deleted_at IS NOT NULL
    `;
    
    const queryParams = [];
    
    if (search) {
      query += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (category) {
      query += ` AND b.category = ?`;
      queryParams.push(category);
    }
    
    query += ` GROUP BY b.id ORDER BY b.deleted_at DESC`;
    
    const trashedBooks = await db.query(query, queryParams);
    
    response.success(res, trashedBooks, `Found ${trashedBooks.length} trashed books`);
    
  } catch (error) {
    logger.error('Error fetching trashed books', { error: error.message });
    response.error(res, 'Error fetching trashed books', error);
  }
});

// Soft delete a book (move to trash)
router.post('/books/:id/soft-delete', requireAdmin, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    
    // Check if book exists and is not already deleted
    const [book] = await db.query(
      'SELECT id, title, deleted_at FROM books WHERE id = ?',
      [bookId]
    );
    
    if (!book) {
      return response.notFound(res, 'Book not found');
    }
    
    if (book.deleted_at) {
      return response.validationError(res, 'Book is already in trash');
    }

    // [ORPHAN FIX] Block trash if book has active borrowings
    const [activeBorrow] = await db.query(
      `SELECT COUNT(*) AS count FROM book_borrowings
       WHERE book_id = ? AND status IN ('borrowed', 'overdue') AND return_date IS NULL`,
      [bookId]
    );
    if (activeBorrow.count > 0) {
      return response.validationError(res, 'Cannot move book to trash: it has active borrowings that must be returned first');
    }

    // Soft delete the book
    await db.query(
      'UPDATE books SET deleted_at = NOW(), trash_id = UUID() WHERE id = ?',
      [bookId]
    );
    
    logger.info('Book moved to trash', { 
      bookId, 
      title: book.title,
      adminId: req.session.user.id 
    });
    
    response.success(res, { id: bookId }, 'Book moved to trash successfully');
    
  } catch (error) {
    logger.error('Error moving book to trash', { bookId: req.params.id, error: error.message });
    response.error(res, 'Error moving book to trash', error);
  }
});

// Restore a book from trash
router.post('/books/:id/restore', requireAdmin, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    
    // Check if book exists and is deleted
    const [book] = await db.query(
      'SELECT id, title, isbn, deleted_at FROM books WHERE id = ?',
      [bookId]
    );
    
    if (!book) {
      return response.notFound(res, 'Book not found');
    }
    
    if (!book.deleted_at) {
      return response.validationError(res, 'Book is not in trash');
    }

    const isbnConflict = await db.query(
      'SELECT id FROM books WHERE isbn = ? AND deleted_at IS NULL AND id != ? LIMIT 1',
      [book.isbn, bookId]
    );
    if (isbnConflict.length > 0) {
      return response.validationError(res, 'Cannot restore book: an active book with the same ISBN already exists');
    }
    
    // Restore the book
    await db.query(
      'UPDATE books SET deleted_at = NULL, trash_id = NULL WHERE id = ?',
      [bookId]
    );
    
    logger.info('Book restored from trash', { 
      bookId, 
      title: book.title,
      adminId: req.session.user.id 
    });
    
    response.success(res, { id: bookId }, 'Book restored successfully');
    
  } catch (error) {
    logger.error('Error restoring book', { bookId: req.params.id, error: error.message });
    response.error(res, 'Error restoring book', error);
  }
});

// Permanently delete a book (Super Admin only)
router.delete('/books/:id/permanent-delete', requireSuperAdmin, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    
    // Check if book exists and is in trash
    const [book] = await db.query(
      'SELECT id, title, deleted_at FROM books WHERE id = ?',
      [bookId]
    );
    
    if (!book) {
      return response.notFound(res, 'Book not found');
    }
    
    if (!book.deleted_at) {
      return response.validationError(res, 'Book must be in trash before permanent deletion');
    }
    
    // [ORPHAN FIX] Check all active statuses including overdue
    const activeBorrowings = await db.query(
      `SELECT COUNT(*) AS count FROM book_borrowings
       WHERE book_id = ? AND status IN ('borrowed', 'overdue', 'approved') AND return_date IS NULL`,
      [bookId]
    );

    if (activeBorrowings[0].count > 0) {
      return response.validationError(res, 'Cannot permanently delete book with active borrowings');
    }
    
    // Permanently delete book copies first (foreign key constraint)
    await db.query('DELETE FROM book_copies WHERE book_id = ?', [bookId]);
    
    // Permanently delete the book
    await db.query('DELETE FROM books WHERE id = ?', [bookId]);
    
    logger.info('Book permanently deleted', { 
      bookId, 
      title: book.title,
      adminId: req.session.user.id 
    });
    
    response.success(res, { id: bookId }, 'Book permanently deleted');
    
  } catch (error) {
    logger.error('Error permanently deleting book', { bookId: req.params.id, error: error.message });
    response.error(res, 'Error permanently deleting book', error);
  }
});

// ===== USERS CRUD (Super Admin only) =====

// Create new student/user
router.post('/users', requireSuperAdmin, async (req, res) => {
  try {
    const { student_id, fullname, email, password, department, education_stage, year_level, student_type, contact_number, status } = req.body;
    if (!student_id || !fullname || !password || !education_stage || !year_level) {
      return response.validationError(res, 'Student ID, Full Name, Password, Education Stage, and Year Level are required');
    }
    if (education_stage === 'College' && !String(department || '').trim()) {
      return response.validationError(res, 'Program / course is required for college students');
    }
    // Auto-generate school email from student_id if admin left it blank
    const studentEmailDomain = process.env.STUDENT_EMAIL_DOMAIN || 'spist.edu.ph';
    const resolvedEmail = String(email || '').trim() ||
      `${String(student_id).trim().toLowerCase()}@${studentEmailDomain}`;
    const existing = await db.query('SELECT id FROM students WHERE student_id = ? OR email = ?', [student_id, resolvedEmail]);
    if (existing.length > 0) {
      return response.validationError(res, 'Student ID or email already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO students (student_id, fullname, email, password, department, education_stage, year_level, student_type, contact_number, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [student_id, fullname, resolvedEmail, hashedPassword, department || '', education_stage, year_level, student_type || 'undergraduate', contact_number || '', status || 'active']
    );
    logger.info('Student created', { id: result.insertId, student_id });
    response.success(res, { id: result.insertId }, 'Student created successfully', 201);
  } catch (err) {
    logger.error('Failed to create student', { error: err.message });
    response.error(res, 'Failed to create student', err);
  }
});

// Update student/user
router.put('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullname, email, password, department, education_stage, year_level, student_type, contact_number, status } = req.body;
    const existing = await db.query('SELECT id, department, education_stage FROM students WHERE id = ? AND deleted_at IS NULL', [userId]);
    if (existing.length === 0) return response.notFound(res, 'Student not found');
    const currentStudent = existing[0];
    if (email) {
      const dup = await db.query('SELECT id FROM students WHERE email = ? AND id != ?', [email, userId]);
      if (dup.length > 0) return response.validationError(res, 'Email already in use');
    }
    if (password && String(password).length < 6) {
      return response.validationError(res, 'Password must be at least 6 characters');
    }
    const nextEducationStage = education_stage !== undefined ? education_stage : (currentStudent.education_stage || 'College');
    const nextDepartment = department !== undefined ? department : (currentStudent.department || '');
    if (nextEducationStage === 'College' && !String(nextDepartment || '').trim()) {
      return response.validationError(res, 'Program / course is required for college students');
    }
    const updates = [], params = [];
    if (fullname)                    { updates.push('fullname = ?');        params.push(fullname); }
    if (email)                       { updates.push('email = ?');           params.push(email); }
    if (department !== undefined)    { updates.push('department = ?');      params.push(department); }
    if (education_stage !== undefined){ updates.push('education_stage = ?'); params.push(education_stage); }
    if (year_level !== undefined)    { updates.push('year_level = ?');      params.push(year_level); }
    if (student_type !== undefined)  { updates.push('student_type = ?');    params.push(student_type); }
    if (contact_number !== undefined){ updates.push('contact_number = ?');  params.push(contact_number); }
    if (status)                      { updates.push('status = ?');          params.push(status); }
    if (password)                    { updates.push('password = ?');        params.push(await bcrypt.hash(password, 10)); }
    if (updates.length === 0) return response.validationError(res, 'No fields to update');
    params.push(userId);
    await db.query('UPDATE students SET ' + updates.join(', ') + ' WHERE id = ?', params);
    logger.info('Student updated', { userId });
    response.success(res, null, 'Student updated successfully');
  } catch (err) {
    logger.error('Failed to update student', { userId: req.params.id, error: err.message });
    response.error(res, 'Failed to update student', err);
  }
});

// ===== USERS TRASH (Super Admin only) =====

// Get all trashed users/students
router.get('/users/trash', requireSuperAdmin, async (req, res) => {
  try {
    const { search, department, education_stage, year_level, status } = req.query;
    
    let query = `
      SELECT 
        id,
        student_id,
        fullname,
        email,
        department,
        education_stage,
        year_level,
        student_type,
        contact_number,
        status,
        created_at,
        deleted_at
      FROM students
      WHERE deleted_at IS NOT NULL
    `;
    
    const queryParams = [];
    
    if (search) {
      query += ` AND (fullname LIKE ? OR student_id LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (department) {
      query += ` AND department = ?`;
      queryParams.push(department);
    }

    if (education_stage) {
      query += ` AND education_stage = ?`;
      queryParams.push(education_stage);
    }
    
    if (year_level) {
      query += ` AND year_level = ?`;
      queryParams.push(year_level);
    }
    
    if (status) {
      query += ` AND status = ?`;
      queryParams.push(status);
    }
    
    query += ` ORDER BY deleted_at DESC`;
    
    const trashedUsers = await db.query(query, queryParams);
    
    response.success(res, trashedUsers, `Found ${trashedUsers.length} trashed users`);
    
  } catch (error) {
    logger.error('Error fetching trashed users', { error: error.message });
    response.error(res, 'Error fetching trashed users', error);
  }
});

// Soft delete a user (move to trash)
router.post('/users/:id/soft-delete', requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user exists and is not already deleted
    const [user] = await db.query(
      'SELECT id, fullname, student_id, deleted_at FROM students WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return response.notFound(res, 'User not found');
    }
    
    if (user.deleted_at) {
      return response.validationError(res, 'User is already in trash');
    }
    
    // Check for active borrowings
    const activeBorrowings = await db.query(
      'SELECT COUNT(*) as count FROM book_borrowings WHERE student_id = ? AND status IN ("borrowed", "approved")',
      [user.student_id]
    );
    
    if (activeBorrowings[0].count > 0) {
      return response.validationError(res, 'Cannot delete user with active borrowings. Please return all books first.');
    }
    
    // Soft delete the user
    await db.query(
      'UPDATE students SET deleted_at = NOW(), status = "inactive" WHERE id = ?',
      [userId]
    );
    
    logger.info('User moved to trash', { 
      userId, 
      studentId: user.student_id,
      fullname: user.fullname,
      adminId: req.session.user.id 
    });
    
    response.success(res, { id: userId }, 'User moved to trash successfully');
    
  } catch (error) {
    logger.error('Error moving user to trash', { userId: req.params.id, error: error.message });
    response.error(res, 'Error moving user to trash', error);
  }
});

// Restore a user from trash
router.post('/users/:id/restore', requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user exists and is deleted
    const [user] = await db.query(
      'SELECT id, fullname, student_id, deleted_at FROM students WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return response.notFound(res, 'User not found');
    }
    
    if (!user.deleted_at) {
      return response.validationError(res, 'User is not in trash');
    }
    
    // Restore the user
    await db.query(
      'UPDATE students SET deleted_at = NULL, status = "active" WHERE id = ?',
      [userId]
    );
    
    logger.info('User restored from trash', { 
      userId, 
      studentId: user.student_id,
      fullname: user.fullname,
      adminId: req.session.user.id 
    });
    
    response.success(res, { id: userId }, 'User restored successfully');
    
  } catch (error) {
    logger.error('Error restoring user', { userId: req.params.id, error: error.message });
    response.error(res, 'Error restoring user', error);
  }
});

// Permanently delete a user (Super Admin only)
router.delete('/users/:id/permanent-delete', requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user exists and is in trash
    const [user] = await db.query(
      'SELECT id, fullname, student_id, deleted_at FROM students WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return response.notFound(res, 'User not found');
    }
    
    if (!user.deleted_at) {
      return response.validationError(res, 'User must be in trash before permanent deletion');
    }
    
    // Check for any borrowing history (even returned)
    const borrowingHistory = await db.query(
      'SELECT COUNT(*) as count FROM book_borrowings WHERE student_id = ?',
      [user.student_id]
    );
    
    if (borrowingHistory[0].count > 0) {
      return response.validationError(res, 'Cannot permanently delete user with borrowing history. Data retention required for records.');
    }
    
    // Permanently delete the user
    await db.query('DELETE FROM students WHERE id = ?', [userId]);
    
    logger.info('User permanently deleted', { 
      userId, 
      studentId: user.student_id,
      fullname: user.fullname,
      adminId: req.session.user.id 
    });
    
    response.success(res, { id: userId }, 'User permanently deleted');
    
  } catch (error) {
    logger.error('Error permanently deleting user', { userId: req.params.id, error: error.message });
    response.error(res, 'Error permanently deleting user', error);
  }
});

// ===== ADMINS TRASH (Super Admin only) =====

// Get all trashed admins
router.get('/admins/trash', requireSuperAdmin, async (req, res) => {
  try {
    const { search, role } = req.query;
    
    let query = `
      SELECT 
        id,
        fullname,
        email,
        role,
        is_active,
        created_at,
        deleted_at
      FROM admins
      WHERE deleted_at IS NOT NULL
    `;
    
    const queryParams = [];
    
    if (search) {
      query += ` AND (fullname LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }
    
    if (role) {
      query += ` AND role = ?`;
      queryParams.push(role);
    }
    
    query += ` ORDER BY deleted_at DESC`;
    
    const trashedAdmins = await db.query(query, queryParams);
    
    response.success(res, trashedAdmins, `Found ${trashedAdmins.length} trashed admins`);
    
  } catch (error) {
    logger.error('Error fetching trashed admins', { error: error.message });
    response.error(res, 'Error fetching trashed admins', error);
  }
});

// Soft delete an admin (move to trash)
router.post('/admins/:id/soft-delete', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    const currentAdminId = req.session.user.id;
    
    // Prevent self-deletion
    if (adminId === currentAdminId) {
      return response.validationError(res, 'You cannot delete your own account');
    }
    
    // Check if admin exists and is not already deleted
    const [admin] = await db.query(
      'SELECT id, fullname, email, role, deleted_at FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (!admin) {
      return response.notFound(res, 'Admin not found');
    }
    
    if (admin.deleted_at) {
      return response.validationError(res, 'Admin is already in trash');
    }
    
    // Check if this is the last super admin
    if (admin.role === 'super_admin') {
      const activeSuperAdmins = await db.query(
        'SELECT COUNT(*) as count FROM admins WHERE role = "super_admin" AND deleted_at IS NULL AND id != ?',
        [adminId]
      );
      
      if (activeSuperAdmins[0].count === 0) {
        return response.validationError(res, 'Cannot delete the last super admin');
      }
    }
    
    // Soft delete the admin
    await db.query(
      'UPDATE admins SET deleted_at = NOW(), is_active = 0 WHERE id = ?',
      [adminId]
    );
    
    logger.info('Admin moved to trash', { 
      adminId, 
      fullname: admin.fullname,
      email: admin.email,
      deletedBy: currentAdminId 
    });
    
    response.success(res, { id: adminId }, 'Admin moved to trash successfully');
    
  } catch (error) {
    logger.error('Error moving admin to trash', { adminId: req.params.id, error: error.message });
    response.error(res, 'Error moving admin to trash', error);
  }
});

// Restore an admin from trash
router.post('/admins/:id/restore', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    
    // Check if admin exists and is deleted
    const [admin] = await db.query(
      'SELECT id, fullname, email, deleted_at FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (!admin) {
      return response.notFound(res, 'Admin not found');
    }
    
    if (!admin.deleted_at) {
      return response.validationError(res, 'Admin is not in trash');
    }
    
    // Restore the admin
    await db.query(
      'UPDATE admins SET deleted_at = NULL, is_active = 1 WHERE id = ?',
      [adminId]
    );
    
    logger.info('Admin restored from trash', { 
      adminId, 
      fullname: admin.fullname,
      email: admin.email,
      restoredBy: req.session.user.id 
    });
    
    response.success(res, { id: adminId }, 'Admin restored successfully');
    
  } catch (error) {
    logger.error('Error restoring admin', { adminId: req.params.id, error: error.message });
    response.error(res, 'Error restoring admin', error);
  }
});

// Permanently delete an admin (Super Admin only)
router.delete('/admins/:id/permanent-delete', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    const currentAdminId = req.session.user.id;
    
    // Prevent self-deletion
    if (adminId === currentAdminId) {
      return response.validationError(res, 'You cannot delete your own account');
    }
    
    // Check if admin exists and is in trash
    const [admin] = await db.query(
      'SELECT id, fullname, email, role, deleted_at FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (!admin) {
      return response.notFound(res, 'Admin not found');
    }
    
    if (!admin.deleted_at) {
      return response.validationError(res, 'Admin must be in trash before permanent deletion');
    }
    
    // Permanently delete the admin
    await db.query('DELETE FROM admins WHERE id = ?', [adminId]);
    
    logger.info('Admin permanently deleted', { 
      adminId, 
      fullname: admin.fullname,
      email: admin.email,
      deletedBy: currentAdminId 
    });
    
    response.success(res, { id: adminId }, 'Admin permanently deleted');
    
  } catch (error) {
    logger.error('Error permanently deleting admin', { adminId: req.params.id, error: error.message });
    response.error(res, 'Error permanently deleting admin', error);
  }
});

// GET /api/admin/:id - Get single admin (requires admin authentication)
// IMPORTANT: This route must be LAST as it catches all /api/admin/* paths
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const admin = await db.query(
      "SELECT id, fullname, email, role FROM admins WHERE id = ?",
      [req.params.id]
    );

    // Debug log to inspect the query and parameters
    logger.debug('Executing query to fetch admin', {
      query: "SELECT id, fullname, email, role FROM admins WHERE id = ?",
      params: [req.params.id]
    });

    if (admin.length === 0) {
      logger.warn('Admin not found', { adminId: req.params.id });
      return response.notFound(res, 'Admin not found');
    }

    logger.info('Admin fetched', { adminId: req.params.id });
    response.success(res, admin[0]);
  } catch (err) {
    logger.error('Failed to fetch admin', {
      adminId: req.params.id,
      error: err.message,
      stack: err.stack
    });
    response.error(res, 'Failed to fetch admin', err);
  }
});

// ===== UNIFIED TRASH BIN =====
// Combines Books, Users, and Admins trash into a single endpoint

// Get unified trash (all deleted items)
router.get('/trash', requireAdmin, async (req, res) => {
  try {
    const { type = 'all', search = '' } = req.query;
    const adminRole = req.session.user.adminRole;
    const isSuperAdmin = adminRole === 'super_admin';
    
    const result = {
      books: [],
      users: [],
      admins: []
    };
    
    // Books (both Super Admin and System Admin can view)
    if (type === 'all' || type === 'book') {
      let booksQuery = `
        SELECT 
          b.id,
          b.trash_id,
          b.title,
          b.author,
          b.isbn,
          b.category,
          b.quantity,
          b.added_date,
          b.deleted_at,
          a.fullname as added_by_name,
          COUNT(DISTINCT bc.id) as total_copies,
          'book' as item_type
        FROM books b
        LEFT JOIN admins a ON b.added_by = a.id
        LEFT JOIN book_copies bc ON b.id = bc.book_id
        WHERE b.deleted_at IS NOT NULL
      `;
      
      const booksParams = [];
      if (search) {
        booksQuery += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.category LIKE ?)`;
        const searchTerm = `%${search}%`;
        booksParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      booksQuery += ` GROUP BY b.id ORDER BY b.deleted_at DESC`;
      result.books = await db.query(booksQuery, booksParams);
    }
    
    // Users (Super Admin only)
    if (isSuperAdmin && (type === 'all' || type === 'user')) {
      let usersQuery = `
        SELECT 
          id,
          student_id,
          fullname,
          email,
          department,
          year_level,
          student_type,
          status,
          created_at,
          deleted_at,
          'user' as item_type
        FROM students
        WHERE deleted_at IS NOT NULL
      `;
      
      const usersParams = [];
      if (search) {
        usersQuery += ` AND (fullname LIKE ? OR student_id LIKE ? OR email LIKE ? OR department LIKE ?)`;
        const searchTerm = `%${search}%`;
        usersParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      usersQuery += ` ORDER BY deleted_at DESC`;
      result.users = await db.query(usersQuery, usersParams);
    }
    
    // Admins (Super Admin only)
    if (isSuperAdmin && (type === 'all' || type === 'admin')) {
      let adminsQuery = `
        SELECT 
          id,
          fullname,
          email,
          role,
          is_active,
          created_at,
          deleted_at,
          'admin' as item_type
        FROM admins
        WHERE deleted_at IS NOT NULL
      `;
      
      const adminsParams = [];
      if (search) {
        adminsQuery += ` AND (fullname LIKE ? OR email LIKE ? OR role LIKE ?)`;
        const searchTerm = `%${search}%`;
        adminsParams.push(searchTerm, searchTerm, searchTerm);
      }
      
      adminsQuery += ` ORDER BY deleted_at DESC`;
      result.admins = await db.query(adminsQuery, adminsParams);
    }
    
    // Calculate totals
    const summary = {
      total: result.books.length + result.users.length + result.admins.length,
      books: result.books.length,
      users: result.users.length,
      admins: result.admins.length
    };
    
    logger.info('Unified trash fetched', { 
      summary,
      adminRole,
      filter: type,
      searchTerm: search
    });
    
    response.success(res, { items: result, summary }, 'Trash items retrieved');
    
  } catch (error) {
    logger.error('Error fetching unified trash', { error: error.message });
    response.error(res, 'Error fetching trash items', error);
  }
});

// Unified restore endpoint
router.post('/trash/:type/:id/restore', requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;
    const itemId = parseInt(id);
    const adminRole = req.session.user.adminRole;
    const isSuperAdmin = adminRole === 'super_admin';
    
    // Permission checks
    if (!isSuperAdmin && (type === 'admin' || type === 'user')) {
      return response.forbidden(res, 'Only Super Admins can restore admins and users');
    }
    
    switch (type) {
      case 'book': {
        const [book] = await db.query(
          'SELECT id, title, isbn, deleted_at FROM books WHERE id = ?',
          [itemId]
        );
        
        if (!book) {
          return response.notFound(res, 'Book not found');
        }
        
        if (!book.deleted_at) {
          return response.validationError(res, 'Book is not in trash');
        }

        const isbnConflict = await db.query(
          'SELECT id FROM books WHERE isbn = ? AND deleted_at IS NULL AND id != ? LIMIT 1',
          [book.isbn, itemId]
        );
        if (isbnConflict.length > 0) {
          return response.validationError(res, 'Cannot restore book: an active book with the same ISBN already exists');
        }
        
        await db.query('UPDATE books SET deleted_at = NULL, trash_id = NULL WHERE id = ?', [itemId]);
        
        logger.info('Book restored from unified trash', { 
          bookId: itemId, 
          title: book.title,
          adminId: req.session.user.id 
        });
        
        return response.success(res, { id: itemId, type }, 'Book restored successfully');
      }
      
      case 'user': {
        const [user] = await db.query(
          'SELECT id, fullname, student_id, deleted_at FROM students WHERE id = ?',
          [itemId]
        );
        
        if (!user) {
          return response.notFound(res, 'User not found');
        }
        
        if (!user.deleted_at) {
          return response.validationError(res, 'User is not in trash');
        }
        
        await db.query(
          'UPDATE students SET deleted_at = NULL, status = "active" WHERE id = ?',
          [itemId]
        );
        
        logger.info('User restored from unified trash', { 
          userId: itemId, 
          studentId: user.student_id,
          fullname: user.fullname,
          adminId: req.session.user.id 
        });
        
        return response.success(res, { id: itemId, type }, 'User restored successfully');
      }
      
      case 'admin': {
        const [admin] = await db.query(
          'SELECT id, fullname, email, deleted_at FROM admins WHERE id = ?',
          [itemId]
        );
        
        if (!admin) {
          return response.notFound(res, 'Admin not found');
        }
        
        if (!admin.deleted_at) {
          return response.validationError(res, 'Admin is not in trash');
        }
        
        await db.query(
          'UPDATE admins SET deleted_at = NULL, is_active = TRUE WHERE id = ?',
          [itemId]
        );
        
        logger.info('Admin restored from unified trash', { 
          adminId: itemId, 
          fullname: admin.fullname,
          restoredBy: req.session.user.id 
        });
        
        return response.success(res, { id: itemId, type }, 'Admin restored successfully');
      }
      
      default:
        return response.validationError(res, 'Invalid item type. Must be: book, user, or admin');
    }
    
  } catch (error) {
    logger.error('Error restoring item from unified trash', { 
      type: req.params.type,
      id: req.params.id,
      error: error.message 
    });
    response.error(res, 'Error restoring item', error);
  }
});

// Unified permanent delete endpoint
router.delete('/trash/:type/:id/permanent', requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;
    const itemId = parseInt(id);
    const adminRole = req.session.user.adminRole;
    const isSuperAdmin = adminRole === 'super_admin';
    
    // Permission checks - only Super Admin can permanently delete anything
    if (!isSuperAdmin) {
      return response.forbidden(res, 'Only Super Admins can permanently delete items');
    }
    
    switch (type) {
      case 'book': {
        const [book] = await db.query(
          'SELECT id, title, deleted_at FROM books WHERE id = ?',
          [itemId]
        );
        
        if (!book) {
          return response.notFound(res, 'Book not found');
        }
        
        if (!book.deleted_at) {
          return response.validationError(res, 'Book must be in trash before permanent deletion');
        }
        
        // Check for active borrowings
        const activeBorrowings = await db.query(
          'SELECT COUNT(*) as count FROM book_borrowings WHERE book_id = ? AND status IN ("borrowed", "approved")',
          [itemId]
        );
        
        if (activeBorrowings[0].count > 0) {
          return response.validationError(res, 'Cannot delete book with active borrowings');
        }
        
        // Delete book copies first
        await db.query('DELETE FROM book_copies WHERE book_id = ?', [itemId]);
        await db.query('DELETE FROM books WHERE id = ?', [itemId]);
        
        logger.info('Book permanently deleted from unified trash', { 
          bookId: itemId, 
          title: book.title,
          adminId: req.session.user.id 
        });
        
        return response.success(res, { id: itemId, type }, 'Book permanently deleted');
      }
      
      case 'user': {
        const [user] = await db.query(
          'SELECT id, fullname, student_id, deleted_at FROM students WHERE id = ?',
          [itemId]
        );
        
        if (!user) {
          return response.notFound(res, 'User not found');
        }
        
        if (!user.deleted_at) {
          return response.validationError(res, 'User must be in trash before permanent deletion');
        }
        
        // Check for borrowing history
        const borrowingHistory = await db.query(
          'SELECT COUNT(*) as count FROM book_borrowings WHERE student_id = ?',
          [user.student_id]
        );
        
        if (borrowingHistory[0].count > 0) {
          return response.validationError(res, 'Cannot permanently delete user with borrowing history. Data retention required for records.');
        }
        
        await db.query('DELETE FROM students WHERE id = ?', [itemId]);
        
        logger.info('User permanently deleted from unified trash', { 
          userId: itemId, 
          studentId: user.student_id,
          fullname: user.fullname,
          adminId: req.session.user.id 
        });
        
        return response.success(res, { id: itemId, type }, 'User permanently deleted');
      }
      
      case 'admin': {
        const currentAdminId = req.session.user.id;
        
        if (itemId === currentAdminId) {
          return response.validationError(res, 'You cannot delete your own account');
        }
        
        const [admin] = await db.query(
          'SELECT id, fullname, email, deleted_at FROM admins WHERE id = ?',
          [itemId]
        );
        
        if (!admin) {
          return response.notFound(res, 'Admin not found');
        }
        
        if (!admin.deleted_at) {
          return response.validationError(res, 'Admin must be in trash before permanent deletion');
        }
        
        await db.query('DELETE FROM admins WHERE id = ?', [itemId]);
        
        logger.info('Admin permanently deleted from unified trash', { 
          adminId: itemId, 
          fullname: admin.fullname,
          deletedBy: req.session.user.id 
        });
        
        return response.success(res, { id: itemId, type }, 'Admin permanently deleted');
      }
      
      default:
        return response.validationError(res, 'Invalid item type. Must be: book, user, or admin');
    }
    
  } catch (error) {
    logger.error('Error permanently deleting item from unified trash', { 
      type: req.params.type,
      id: req.params.id,
      error: error.message 
    });
    response.error(res, 'Error permanently deleting item', error);
  }
});

// ─────────────────────────────────────────────────────────────────
// UNIFIED TRASH MANAGER — clean entity-based endpoints
// Used by views/super-admin/trash.ejs  +  public/js/admin/trash/
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/trash/:entity   — list trashed items by entity
// entity = 'books' | 'users' | 'admins'
router.get('/trash/:entity', requireAdmin, async (req, res) => {
  const { entity } = req.params;
  const role = req.session?.user?.role;
  const VALID = ['books', 'users', 'admins'];
  if (!VALID.includes(entity)) return response.validationError(res, 'Invalid entity. Must be: books, users, or admins');
  if ((entity === 'users' || entity === 'admins') && role !== 'super_admin') {
    return response.forbidden(res, 'Super Admin access required');
  }
  const { search = '', category, year_level, department, role: filterRole } = req.query;
  try {
    if (entity === 'books') {
      let q = `SELECT b.*, a.fullname AS added_by_name,
                      (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id) AS total_copies
               FROM books b
               LEFT JOIN admins a ON b.added_by = a.id
               WHERE b.deleted_at IS NOT NULL`;
      const p = [];
      if (search)   { q += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)'; const s = `%${search}%`; p.push(s, s, s); }
      if (category) { q += ' AND b.category = ?'; p.push(category); }
      q += ' ORDER BY b.deleted_at DESC';
      const rows = await db.query(q, p);
      return response.success(res, rows, `Found ${rows.length} trashed books`);
    }
    if (entity === 'users') {
      let q = `SELECT id, student_id, fullname, email, department, year_level, student_type, status, created_at, deleted_at
               FROM students WHERE deleted_at IS NOT NULL`;
      const p = [];
      if (search)     { q += ' AND (fullname LIKE ? OR student_id LIKE ? OR email LIKE ?)'; const s = `%${search}%`; p.push(s, s, s); }
      if (department) { q += ' AND department = ?'; p.push(department); }
      if (year_level) { q += ' AND year_level = ?'; p.push(year_level); }
      q += ' ORDER BY deleted_at DESC';
      const rows = await db.query(q, p);
      return response.success(res, rows, `Found ${rows.length} trashed users`);
    }
    if (entity === 'admins') {
      let q = `SELECT id, fullname, email, role, is_active, created_at, deleted_at
               FROM admins WHERE deleted_at IS NOT NULL`;
      const p = [];
      if (search)     { q += ' AND (fullname LIKE ? OR email LIKE ?)'; const s = `%${search}%`; p.push(s, s); }
      if (filterRole) { q += ' AND role = ?'; p.push(filterRole); }
      q += ' ORDER BY deleted_at DESC';
      const rows = await db.query(q, p);
      return response.success(res, rows, `Found ${rows.length} trashed admins`);
    }
  } catch (err) {
    logger.error(`[UnifiedTrash] GET ${entity} error`, { error: err.message });
    return response.error(res, `Error listing ${entity} trash`, err);
  }
});

// POST /api/admin/trash/:entity/restore   — restore single item (id in body)
router.post('/trash/:entity/restore', requireAdmin, async (req, res) => {
  const { entity } = req.params;
  const { id, trashId } = req.body;
  const role = req.session?.user?.role;
  if (!['books', 'users', 'admins'].includes(entity)) return response.validationError(res, 'Invalid entity');
  const idStr = id == null ? '' : String(id).trim();
  const trashIdStr = trashId == null ? '' : String(trashId).trim();
  const hasNumericId = /^\d+$/.test(idStr);
  const itemId = hasNumericId ? parseInt(idStr, 10) : NaN;
  const hasTrashId = !!trashIdStr || (!!idStr && !hasNumericId);
  if (!hasNumericId && !hasTrashId) return response.validationError(res, 'Invalid id');
  if ((entity === 'users' || entity === 'admins') && role !== 'super_admin') return response.forbidden(res, 'Super Admin access required');
  try {
    if (entity === 'books') {
      const bookLookupSql = hasTrashId
        ? 'SELECT id, isbn, trash_id, deleted_at FROM books WHERE trash_id = ?'
        : 'SELECT id, isbn, trash_id, deleted_at FROM books WHERE id = ?';
      const bookLookupParam = hasTrashId ? (trashIdStr || idStr) : itemId;
      const [book] = await db.query(bookLookupSql, [bookLookupParam]);
      if (!book)            return response.notFound(res, 'Book not found');
      if (!book.deleted_at) return response.validationError(res, 'Book is not in trash');

      const isbnConflict = await db.query(
        'SELECT id FROM books WHERE isbn = ? AND deleted_at IS NULL AND id != ? LIMIT 1',
        [book.isbn, book.id]
      );
      if (isbnConflict.length > 0) {
        return response.validationError(res, 'Cannot restore book: an active book with the same ISBN already exists');
      }

      await db.query('UPDATE books SET deleted_at = NULL, trash_id = NULL WHERE id = ?', [book.id]);
      return response.success(res, { id: book.id }, 'Book restored');
    }
    if (entity === 'users') {
      const [user] = await db.query('SELECT id, deleted_at FROM students WHERE id = ?', [itemId]);
      if (!user)            return response.notFound(res, 'User not found');
      if (!user.deleted_at) return response.validationError(res, 'User is not in trash');
      await db.query("UPDATE students SET deleted_at = NULL, status = 'active' WHERE id = ?", [itemId]);
      return response.success(res, { id: itemId }, 'User restored');
    }
    if (entity === 'admins') {
      const [admin] = await db.query('SELECT id, deleted_at FROM admins WHERE id = ?', [itemId]);
      if (!admin)            return response.notFound(res, 'Admin not found');
      if (!admin.deleted_at) return response.validationError(res, 'Admin is not in trash');
      await db.query('UPDATE admins SET deleted_at = NULL, is_active = TRUE WHERE id = ?', [itemId]);
      return response.success(res, { id: itemId }, 'Admin restored');
    }
  } catch (err) {
    logger.error(`[UnifiedTrash] POST restore ${entity}/${id} error`, { error: err.message });
    return response.error(res, `Error restoring ${entity}`, err);
  }
});

// DELETE /api/admin/trash/:entity/permanent   — permanent delete single item (id in body)
router.delete('/trash/:entity/permanent', requireSuperAdmin, async (req, res) => {
  const { entity } = req.params;
  const { id, trashId } = req.body;
  if (!['books', 'users', 'admins'].includes(entity)) return response.validationError(res, 'Invalid entity');
  const idStr = id == null ? '' : String(id).trim();
  const trashIdStr = trashId == null ? '' : String(trashId).trim();
  const hasNumericId = /^\d+$/.test(idStr);
  const itemId = hasNumericId ? parseInt(idStr, 10) : NaN;
  const hasTrashId = !!trashIdStr || (!!idStr && !hasNumericId);
  if (!hasNumericId && !hasTrashId) return response.validationError(res, 'Invalid id');
  try {
    if (entity === 'books') {
      const bookLookupSql = hasTrashId
        ? 'SELECT id, title, trash_id, deleted_at FROM books WHERE trash_id = ?'
        : 'SELECT id, title, trash_id, deleted_at FROM books WHERE id = ?';
      const bookLookupParam = hasTrashId ? (trashIdStr || idStr) : itemId;
      const [book] = await db.query(bookLookupSql, [bookLookupParam]);
      if (!book)            return response.notFound(res, 'Book not found');
      if (!book.deleted_at) return response.validationError(res, 'Book must be in trash first');
      const [{ cnt }] = await db.query("SELECT COUNT(*) AS cnt FROM book_borrowings WHERE book_id = ? AND status IN ('borrowed','overdue','approved') AND return_date IS NULL", [book.id]);
      if (cnt > 0) return response.validationError(res, 'Cannot delete book with active borrowings');
      await db.query('DELETE FROM book_copies WHERE book_id = ?', [book.id]);
      await db.query('DELETE FROM books WHERE id = ?', [book.id]);
      return response.success(res, { id: book.id }, 'Book permanently deleted');
    }
    if (entity === 'users') {
      const [user] = await db.query('SELECT id, student_id, deleted_at FROM students WHERE id = ?', [itemId]);
      if (!user)            return response.notFound(res, 'User not found');
      if (!user.deleted_at) return response.validationError(res, 'User must be in trash first');
      await db.query('DELETE FROM students WHERE id = ?', [itemId]);
      return response.success(res, { id: itemId }, 'User permanently deleted');
    }
    if (entity === 'admins') {
      if (itemId === req.session.user.id) return response.validationError(res, 'Cannot delete your own account');
      const [admin] = await db.query('SELECT id, deleted_at FROM admins WHERE id = ?', [itemId]);
      if (!admin)            return response.notFound(res, 'Admin not found');
      if (!admin.deleted_at) return response.validationError(res, 'Admin must be in trash first');
      await db.query('DELETE FROM admins WHERE id = ?', [itemId]);
      return response.success(res, { id: itemId }, 'Admin permanently deleted');
    }
  } catch (err) {
    logger.error(`[UnifiedTrash] DELETE permanent ${entity}/${id} error`, { error: err.message });
    return response.error(res, `Error permanently deleting ${entity}`, err);
  }
});

// POST /api/admin/trash/:entity/bulk-restore
router.post('/trash/:entity/bulk-restore', requireAdmin, async (req, res) => {
  const { entity } = req.params;
  const { ids } = req.body;
  const role = req.session?.user?.role;
  if (!['books', 'users', 'admins'].includes(entity)) return response.validationError(res, 'Invalid entity');
  if (!Array.isArray(ids) || ids.length === 0) return response.validationError(res, 'ids must be a non-empty array');
  if (ids.length > 100) return response.validationError(res, 'Cannot bulk restore more than 100 items at once');
  if ((entity === 'users' || entity === 'admins') && role !== 'super_admin') return response.forbidden(res, 'Super Admin access required');
  const rawIds = ids.map(id => String(id).trim()).filter(Boolean);
  const safeIds = rawIds.filter(id => /^\d+$/.test(id)).map(id => parseInt(id, 10));
  const safeTrashIds = rawIds.filter(id => !/^\d+$/.test(id));
  if (entity !== 'books' && safeIds.length === 0) return response.validationError(res, 'No valid IDs provided');
  if (entity === 'books' && safeIds.length === 0 && safeTrashIds.length === 0) return response.validationError(res, 'No valid IDs provided');
  const ph = safeIds.map(() => '?').join(',');
  const phTrash = safeTrashIds.map(() => '?').join(',');
  try {
    let result;
    if (entity === 'books') {
      const where = [];
      const params = [];
      if (safeIds.length > 0) { where.push(`id IN (${ph})`); params.push(...safeIds); }
      if (safeTrashIds.length > 0) { where.push(`trash_id IN (${phTrash})`); params.push(...safeTrashIds); }
      result = await db.query(
        `UPDATE books b
         LEFT JOIN books a
           ON a.isbn = b.isbn
          AND a.deleted_at IS NULL
          AND a.id <> b.id
         SET b.deleted_at = NULL, b.trash_id = NULL
         WHERE (${where.map(clause => `b.${clause}`).join(' OR ')})
           AND b.deleted_at IS NOT NULL
           AND a.id IS NULL`,
        params
      );
    }
    if (entity === 'users')  result = await db.query(`UPDATE students SET deleted_at = NULL, status = 'active'  WHERE id IN (${ph}) AND deleted_at IS NOT NULL`, safeIds);
    if (entity === 'admins') result = await db.query(`UPDATE admins   SET deleted_at = NULL, is_active = TRUE   WHERE id IN (${ph}) AND deleted_at IS NOT NULL`, safeIds);
    const restoredCount = result?.affectedRows || 0;
    logger.info(`[UnifiedTrash] Bulk restore ${entity}`, { ids: safeIds, restoredCount, adminId: req.session.user.id });
    return response.success(res, { restoredCount }, `${restoredCount} ${entity} restored`);
  } catch (err) {
    logger.error(`[UnifiedTrash] Bulk restore ${entity} error`, { error: err.message });
    return response.error(res, `Error bulk restoring ${entity}`, err);
  }
});

// DELETE /api/admin/trash/:entity/bulk-permanent  (Super Admin only)
router.delete('/trash/:entity/bulk-permanent', requireSuperAdmin, async (req, res) => {
  const { entity } = req.params;
  const { ids } = req.body;
  if (!['books', 'users', 'admins'].includes(entity)) return response.validationError(res, 'Invalid entity');
  if (!Array.isArray(ids) || ids.length === 0) return response.validationError(res, 'ids must be a non-empty array');
  if (ids.length > 50) return response.validationError(res, 'Cannot bulk delete more than 50 items at once');
  const rawIds = ids.map(id => String(id).trim()).filter(Boolean);
  const safeIds = rawIds.filter(id => /^\d+$/.test(id)).map(id => parseInt(id, 10));
  const safeTrashIds = rawIds.filter(id => !/^\d+$/.test(id));
  if (entity !== 'books' && safeIds.length === 0) return response.validationError(res, 'No valid IDs provided');
  if (entity === 'books' && safeIds.length === 0 && safeTrashIds.length === 0) return response.validationError(res, 'No valid IDs provided');
  const ph = safeIds.map(() => '?').join(',');
  const phTrash = safeTrashIds.map(() => '?').join(',');
  try {
    let deletedCount = 0;
    if (entity === 'books') {
      const where = [];
      const params = [];
      if (safeIds.length > 0) { where.push(`id IN (${ph})`); params.push(...safeIds); }
      if (safeTrashIds.length > 0) { where.push(`trash_id IN (${phTrash})`); params.push(...safeTrashIds); }
      const targetRows = await db.query(`SELECT id FROM books WHERE deleted_at IS NOT NULL AND (${where.join(' OR ')})`, params);
      const targetIds = targetRows.map(r => r.id);
      if (targetIds.length === 0) {
        return response.success(res, { deletedCount: 0 }, `0 ${entity} permanently deleted`);
      }
      const phTarget = targetIds.map(() => '?').join(',');
      const countResult = await db.query(`SELECT COUNT(*) AS cnt FROM book_borrowings WHERE book_id IN (${phTarget}) AND status IN ('borrowed','overdue','approved') AND return_date IS NULL`, targetIds);
      const cnt = Array.isArray(countResult) && countResult.length > 0 ? countResult[0].cnt : 0;
      if (cnt > 0) return response.validationError(res, 'Cannot delete: some selected books have active borrowings');
      // Delete all borrowing records first (including returned ones) due to foreign key constraint
      await db.query(`DELETE FROM book_borrowings WHERE book_id IN (${phTarget})`, targetIds);
      await db.query(`DELETE FROM book_copies WHERE book_id IN (${phTarget})`, targetIds);
      const r = await db.query(`DELETE FROM books WHERE id IN (${phTarget}) AND deleted_at IS NOT NULL`, targetIds);
      deletedCount = r?.affectedRows || 0;
    }
    if (entity === 'users') {
      const r = await db.query(`DELETE FROM students WHERE id IN (${ph}) AND deleted_at IS NOT NULL`, safeIds);
      deletedCount = r?.affectedRows || 0;
    }
    if (entity === 'admins') {
      const currentId = req.session.user.id;
      const filteredIds = safeIds.filter(id => id !== currentId);
      if (filteredIds.length === 0) return response.validationError(res, 'Cannot delete your own account');
      const ph2 = filteredIds.map(() => '?').join(',');
      const r = await db.query(`DELETE FROM admins WHERE id IN (${ph2}) AND deleted_at IS NOT NULL`, filteredIds);
      deletedCount = r?.affectedRows || 0;
    }
    logger.info(`[UnifiedTrash] Bulk permanent delete ${entity}`, { ids: safeIds, deletedCount, adminId: req.session.user.id });
    return response.success(res, { deletedCount }, `${deletedCount} ${entity} permanently deleted`);
  } catch (err) {
    logger.error(`[UnifiedTrash] Bulk permanent delete ${entity} error`, { error: err.message, stack: err.stack });
    console.error(`[BULK DELETE ERROR] Entity: ${entity}, Error:`, err);
    return response.error(res, `Error bulk deleting ${entity}`, err);
  }
});

module.exports = router;


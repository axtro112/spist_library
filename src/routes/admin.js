const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const bcrypt = require("bcrypt");
const upload = require("../middleware/upload");
const { requireAdmin, requireSuperAdmin: requireSuperAdminMiddleware } = require("../middleware/auth");
const {
  parseCSV,
  parseExcel,
  importBooks,
  exportBooksToCSV,
  exportBooksToExcel,
  cleanupFile,
} = require("../utils/csvParser");
const { body, validationResult } = require('express-validator');

// =============================
// Add Admin (Super Admin Only)
// =============================
router.post(
  '/admins',
  requireSuperAdmin,
  [
    body('fullname').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['system_admin', 'super_admin']).withMessage('Role must be system_admin or super_admin'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { fullname, email, password, role } = req.body;
    const adminRole = role && ['system_admin', 'super_admin'].includes(role) ? role : 'system_admin';
    // Validate fullname
    if (!fullname || fullname.trim() === '') {
      return response.validationError(res, 'Fullname is required');
    }

    const trimmedFullname = fullname.trim();

    const existingAdmin = await db.query(
      "SELECT id FROM admins WHERE email = ?",
      [email]
    );

    if (existingAdmin.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO admins (fullname, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [trimmedFullname, email, hashedPassword, adminRole]
    );

    const newAdmin = {
      id: result.insertId,
      fullname,
      email,
      role: adminRole,
      created_at: new Date().toISOString(),
    };
    return res.status(201).json({ success: true, data: newAdmin });
  }
);


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

// Authorization middleware for admin management
async function requireSuperAdmin(req, res, next) {
  try {
    const { currentAdminId } = req.body;
    
    if (!currentAdminId) {
      return response.unauthorized(res, 'Authentication required');
    }

    const results = await db.query(
      "SELECT role FROM admins WHERE id = ?",
      [currentAdminId]
    );

    if (results.length === 0) {
      return response.unauthorized(res, 'Admin not found');
    }

    if (results[0].role !== 'super_admin') {
      return response.forbidden(res, 'Access denied. Only Super Admins can manage admin accounts.');
    }

    next();
  } catch (err) {
    logger.error('Authorization check failed', { error: err.message });
    response.error(res, 'Authorization check failed', err);
  }
}

// Get all active students
router.get("/students", async (req, res) => {
  const query = `
    SELECT 
      student_id,
      fullname,
      email,
      status
    FROM students
    WHERE status = 'active'
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
router.get("/books", async (req, res) => {
  // Extract search and filter parameters from query string
  const { search, category, status } = req.query;
  
  // Build WHERE conditions dynamically
  let whereConditions = [];
  let queryParams = [];
  
  // Base condition: only show active books (v2.0 status values)
  whereConditions.push("b.status IN ('active', 'maintenance', 'retired')");
  
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
      bb.borrow_date, bb.due_date,
      s.fullname as borrowed_by,
      bb.status as borrow_status
    FROM books b
    LEFT JOIN admins a ON b.added_by = a.id
    LEFT JOIN (
      SELECT bb1.*
      FROM book_borrowings bb1
      LEFT JOIN book_borrowings bb2 
        ON bb1.book_id = bb2.book_id 
        AND bb1.id < bb2.id
      WHERE bb2.id IS NULL
        AND bb1.return_date IS NULL
        AND bb1.status IN ('borrowed', 'overdue')
    ) bb ON b.id = bb.book_id
    LEFT JOIN students s ON bb.student_id = s.student_id
    ${whereClause}
    ORDER BY b.id DESC
  `;

  try {
    const results = await db.query(query, queryParams);
    logger.info('Books fetched with filters', { count: results.length, search, category, status });
    logger.debug('Books query details', { queryParams, whereClause });
    
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

router.post("/books", async (req, res) => {
  const { title, author, category, isbn, quantity, adminId } = req.body;
  logger.debug('Adding new book', { title, author, category, isbn, quantity, adminId });

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

    const bookQuantity = quantity || 1;
    const query = `
      INSERT INTO books (title, author, isbn, category, added_date, status, quantity, available_quantity, added_by)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', ?, ?, ?)
    `;

    const result = await db.query(query, [title, author, isbn, category, bookQuantity, bookQuantity, adminId || null]);
    logger.info('Book created successfully', { bookId: result.insertId, title, isbn });
    response.success(res, {
      message: "Book added successfully",
      bookId: result.insertId,
    }, 'Book added successfully', 201);
  } catch (err) {
    logger.error('Error adding book', { error: err.message, title, isbn });
  }
});

router.put("/books/:id", async (req, res) => {
  const bookId = req.params.id;
  const { title, author, category, isbn, status, student_id, quantity } = req.body;

  logger.debug('Book update request', { bookId, title, author, category, isbn, status, student_id, quantity });

  if (!title || !author || !category || !isbn) {
    return response.validationError(res, 'All fields are required');
  }

  try {
    // Start transaction
    await db.beginTransaction();
    try {
      // Verify book exists
      const book = await db.query(
        "SELECT id, status, quantity, available_quantity FROM books WHERE id = ?",
        [bookId]
      );
      if (book.length === 0) {
        throw new Error("Book not found");
      }

      // Ensure quantity and available_quantity are set properly
      const bookQuantity = parseInt(quantity) || 1;
      
      // Calculate available quantity based on ACTUAL borrowings
      const [borrowingCount] = await db.query(
        `SELECT COUNT(*) as count 
         FROM book_borrowings 
         WHERE book_id = ? AND return_date IS NULL AND status IN ('borrowed', 'overdue')`,
        [bookId]
      );
      const activeBorrowings = borrowingCount.count || 0;
      const newAvailableQty = Math.max(0, bookQuantity - activeBorrowings);

      // Map frontend status to v2.0 status values (active, maintenance, retired)
      let dbStatus = 'active';
      if (status === 'maintenance') {
        dbStatus = 'maintenance';
      } else if (status === 'retired') {
        dbStatus = 'retired';
      } else if (status === 'borrowed' || status === 'available' || status === 'All Borrowed' || status === 'Available') {
        // For borrowed/available status, keep as 'active' but manage via available_quantity
        dbStatus = 'active';
      } else {
        // Default to active for any other status
        dbStatus = 'active';
      }

      // Update book details with quantity and available_quantity
      await db.query(
        `UPDATE books 
         SET title = ?, author = ?, category = ?, isbn = ?, 
             status = ?, quantity = ?, available_quantity = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [title, author, category, isbn, dbStatus, bookQuantity, newAvailableQty, bookId]
      );

      logger.info('Book updated', { bookId, dbStatus, bookQuantity, newAvailableQty });

      // Handle borrowing status
      if (status === "borrowed") {
        if (!student_id) {
          throw new Error("Student ID is required when status is borrowed");
        }

        // Check if book is already borrowed
        const currentBorrowing = await db.query(
          `SELECT bb.id, bb.student_id 
           FROM book_borrowings bb 
           WHERE bb.book_id = ? 
           AND bb.status IN ('borrowed', 'overdue') 
           AND bb.return_date IS NULL`,
          [bookId]
        );

        if (currentBorrowing.length > 0) {
          // If current borrower is different from new borrower
          if (currentBorrowing[0].student_id !== student_id) {
            // Return the current borrowing
            await db.query(
              `UPDATE book_borrowings 
               SET status = 'returned', return_date = CURRENT_TIMESTAMP 
               WHERE id = ?`,
              [currentBorrowing[0].id]
            );

            // Create new borrowing record
            await db.query(
              `INSERT INTO book_borrowings 
               (book_id, student_id, borrow_date, due_date, status) 
               VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY), 'borrowed')`,
              [bookId, student_id]
            );
          }
          // If same borrower, do nothing
        } else {
          // No current borrowing, create new one
          await db.query(
            `INSERT INTO book_borrowings 
             (book_id, student_id, borrow_date, due_date, status) 
             VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY), 'borrowed')`,
            [bookId, student_id]
          );
        }
      } else if (status === "available") {
        // Mark any existing borrowings as returned
        await db.query(
          `UPDATE book_borrowings 
           SET status = 'returned', return_date = CURRENT_TIMESTAMP 
           WHERE book_id = ? 
           AND status IN ('borrowed', 'overdue') 
           AND return_date IS NULL`,
          [bookId]
        );
      }

      await db.commit();
      response.success(res, null, 'Book updated successfully');
    } catch (transactionError) {
      await db.rollback();
      throw transactionError;
    }
  } catch (err) {
    logger.error('Error updating book', { bookId, error: err.message });
    response.error(res, 'Error updating book', err);
  }
});

router.delete("/books/:id", async (req, res) => {
  const bookId = req.params.id;

  try {
    // Verify book exists
    const book = await db.query("SELECT id FROM books WHERE id = ?", [bookId]);
    if (book.length === 0) {
      logger.warn('Book delete attempt - not found', { bookId });
      return response.notFound(res, 'Book not found');
    }

    // Check if book is borrowed
    const borrowStatus = await db.query(
      "SELECT status FROM book_borrowings WHERE book_id = ? AND status = 'active'",
      [bookId]
    );
    if (borrowStatus.length > 0) {
      logger.warn('Book delete attempt - currently borrowed', { bookId });
      return response.validationError(res, 'Cannot delete book that is currently borrowed');
    }

    // Delete book and its borrowing records in a transaction
    await db.beginTransaction();
    try {
      await db.query("DELETE FROM book_borrowings WHERE book_id = ?", [
        bookId,
      ]);
      await db.query("DELETE FROM books WHERE id = ?", [bookId]);

      await db.commit();
      logger.info('Book deleted successfully', { bookId });
      response.success(res, null, 'Book deleted successfully');
    } catch (transactionError) {
      await db.rollback();
      throw transactionError;
    }
  } catch (err) {
    logger.error('Error deleting book', { bookId, error: err.message });
    response.error(res, 'Error deleting book', err);
  }
});

// Dashboard Statistics Route
router.get("/dashboard/stats", async (req, res) => {
  const queries = {
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
      LEFT JOIN book_borrowings bb ON b.id = bb.book_id
      WHERE b.status != 'deleted'
      GROUP BY b.category
      ORDER BY count DESC
      LIMIT 5
    `,
    recentActivities: `
      (SELECT 
        'book_borrowed' as type,
        CONCAT(b.title, ' borrowed by ', s.fullname) as detail,
        bb.borrow_date as timestamp
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s ON bb.student_id = s.student_id
      WHERE bb.status = 'borrowed'
      AND bb.borrow_date IS NOT NULL
      ORDER BY bb.borrow_date DESC
      LIMIT 5)
      
      UNION ALL
      
      (SELECT 
        'book_returned' as type,
        CONCAT(b.title, ' returned by ', s.fullname) as detail,
        bb.return_date as timestamp
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s ON bb.student_id = s.student_id
      WHERE bb.status = 'returned'
      AND bb.return_date IS NOT NULL
      ORDER BY bb.return_date DESC
      LIMIT 5)
      
      UNION ALL
      
      (SELECT 
        'book_overdue' as type,
        CONCAT(b.title, ' overdue from ', s.fullname) as detail,
        bb.due_date as timestamp
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s ON bb.student_id = s.student_id
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

// GET /api/admin - List all admins (requires admin authentication)
router.get("/", requireAdmin, async (req, res) => {
  try {
    // Extract search and filter parameters
    const { search, role } = req.query;
    
    // Build WHERE conditions dynamically
    let whereConditions = [];
    let queryParams = [];
    
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
});

// GET /api/admin/:id - Get single admin (requires admin authentication)
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

router.post("/", async (req, res) => {
  try {
    const { fullname, email, password, role, currentAdminId } = req.body;

    //  AUTHORIZATION: Only super_admin can create admins
    if (currentAdminId) {
      const currentAdmin = await db.query(
        "SELECT role FROM admins WHERE id = ?",
        [currentAdminId]
      );
      
      if (currentAdmin.length === 0 || currentAdmin[0].role !== 'super_admin') {
        logger.warn('Admin create attempt - not super_admin', { currentAdminId });
        return response.forbidden(res, 'Access denied. Only Super Admins can create admin accounts.');
      }
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

router.put("/:id", async (req, res) => {
  try {
    const { fullname, email, password, role, currentAdminId } = req.body;
    const adminId = req.params.id;

    //  AUTHORIZATION: Only super_admin can update admins
    if (currentAdminId) {
      const currentAdmin = await db.query(
        "SELECT role FROM admins WHERE id = ?",
        [currentAdminId]
      );
      
      if (currentAdmin.length === 0 || currentAdmin[0].role !== 'super_admin') {
        logger.warn('Admin update attempt - not super_admin', { currentAdminId, targetAdminId: adminId });
        return response.forbidden(res, 'Access denied. Only Super Admins can update admin accounts.');
      }
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

router.delete("/:id", async (req, res) => {
  try {
    const currentAdminId = req.query.currentAdminId || req.body.currentAdminId;

    //  AUTHORIZATION: Only super_admin can delete admins
    if (currentAdminId) {
      const currentAdmin = await db.query(
        "SELECT role FROM admins WHERE id = ?",
        [currentAdminId]
      );
      
      if (currentAdmin.length === 0 || currentAdmin[0].role !== 'super_admin') {
        logger.warn('Admin delete attempt - not super_admin', { currentAdminId, targetAdminId: req.params.id });
        return response.forbidden(res, 'Access denied. Only Super Admins can delete admin accounts.');
      }
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
router.get("/books/export", async (req, res) => {
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
router.get("/books/export-excel", async (req, res) => {
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
router.post("/books/import", upload.single("file"), async (req, res) => {
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
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      logger.debug('Parsing as Excel');
      books = await parseExcel(filePath);
    } else {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: "Unsupported file type. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.",
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
      message: `Import completed: ${summary.successfully_imported} books imported, ${
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
router.post("/books/bulk-delete", async (req, res) => {
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
        const book = await db.query("SELECT id, title FROM books WHERE id = ?", [bookId]);
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
          errors.push(`Cannot delete "${book[0].title}" (ID: ${bookId}) - currently borrowed`);
          logger.warn('Cannot delete borrowed book', { bookId, title: book[0].title, activeLoans: borrowStatus[0].count });
          continue;
        }
        
        // Delete book's borrowing history
        await db.query("DELETE FROM book_borrowings WHERE book_id = ?", [bookId]);
        
        // Delete book
        await db.query("DELETE FROM books WHERE id = ?", [bookId]);
        
        deletedCount++;
        logger.info('Book deleted in bulk operation', { bookId, title: book[0].title });
        
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
      ? `Deleted ${deletedCount} out of ${ids.length} books. ${errors.length} error(s) occurred.`
      : `Successfully deleted ${deletedCount} book(s)`;
    
    logger.info('Bulk delete completed', { deletedCount, requested: ids.length, errorCount: errors.length });
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
router.patch("/books/bulk-update", async (req, res) => {
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
    
    logger.info('Bulk update initiated', { bookCount: ids.length, bookIds: ids, fields: updateData });
    
    // Update each book
    for (const bookId of ids) {
      try {
        // Check if book exists
        const book = await db.query("SELECT id, title FROM books WHERE id = ?", [bookId]);
        if (book.length === 0) {
          errors.push(`Book ID ${bookId} not found`);
          logger.warn('Book not found in bulk update', { bookId });
          continue;
        }
        
        // Build and execute UPDATE query
        const query = `UPDATE books SET ${updates.join(", ")} WHERE id = ?`;
        const queryParams = [...params, bookId];
        
        await db.query(query, queryParams);
        updatedCount++;
        
        logger.info('Book updated in bulk operation', { bookId, title: book[0].title });
        
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

module.exports = router;


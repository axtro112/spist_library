const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const { requireStudent, requireAdmin } = require("../middleware/auth");



const SELECT_STUDENT_FIELDS = `
  SELECT id, student_id, fullname, email, department,
         year_level, student_type, contact_number, status
  FROM students
`;

// Get student dashboard statistics
router.get("/:studentId/dashboard-stats", async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Get total available books
    const availableBooksQuery = `
      SELECT COUNT(*) as count 
      FROM books 
      WHERE status = 'available'
    `;

    // Get books borrowed by student
    const borrowedBooksQuery = `
      SELECT COUNT(*) as count
      FROM book_borrowings
      WHERE student_id = ?
      AND status IN ('borrowed', 'overdue')
    `;

    // Get books due soon (within next 7 days)
    const dueSoonQuery = `
      SELECT COUNT(*) as count
      FROM book_borrowings
      WHERE student_id = ?
      AND status = 'borrowed'
      AND due_date <= DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY)
      AND due_date > CURRENT_DATE
    `;

    const [availableBooks, borrowedBooks, dueSoon] = await Promise.all([
      db.query(availableBooksQuery),
      db.query(borrowedBooksQuery, [studentId]),
      db.query(dueSoonQuery, [studentId]),
    ]);

    const stats = {
      availableBooks: availableBooks[0].count,
      borrowedBooks: borrowedBooks[0].count,
      dueSoon: dueSoon[0].count,
    };

    logger.info('Dashboard stats fetched', { studentId, stats });
    response.success(res, stats);
  } catch (err) {
    logger.error('Error fetching dashboard stats', { studentId: req.params.studentId, error: err.message });
    response.error(res, 'Error fetching dashboard stats', err);
  }
});

router.get("/", async (req, res) => {
  try {
    // Extract search and filter parameters
    const { search, department, year_level, status } = req.query;
    
    // Build WHERE conditions dynamically
    let whereConditions = [];
    let queryParams = [];
    
    // Search condition: search across name, student_id, email, department (partial match, case-insensitive)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push("(fullname LIKE ? OR student_id LIKE ? OR email LIKE ? OR department LIKE ?)");
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Department filter: exact match
    if (department && department.trim()) {
      whereConditions.push("department = ?");
      queryParams.push(department.trim());
    }
    
    // Year level filter: exact match
    if (year_level && year_level.trim()) {
      whereConditions.push("year_level = ?");
      queryParams.push(year_level.trim());
    }
    
    // Status filter: exact match
    if (status && status.trim()) {
      whereConditions.push("status = ?");
      queryParams.push(status.trim());
    }
    
    const whereClause = whereConditions.length > 0 
      ? "WHERE " + whereConditions.join(" AND ")
      : "";
    
    const query = `${SELECT_STUDENT_FIELDS} ${whereClause} ORDER BY student_id ASC`;
    logger.debug('Students query with filters', { search, department, year_level, status });
    
    const students = await db.query(query, queryParams);
    logger.info('Students fetched', { count: students.length, filters: { search, department, year_level, status } });
    response.success(res, students);
  } catch (err) {
    logger.error('Error fetching students', { error: err.message });
    response.error(res, 'Error fetching students', err);
  }
});

router.get("/:studentId", async (req, res) => {
  try {
    const query = `${SELECT_STUDENT_FIELDS} WHERE student_id = ?`;
    const students = await db.query(query, [req.params.studentId]);

    if (students.length === 0) {
      logger.warn('Student not found', { studentId: req.params.studentId });
      return response.notFound(res, 'Student not found');
    }

    logger.info('Student fetched', { studentId: req.params.studentId });
    response.success(res, students[0]);
  } catch (err) {
    logger.error('Error fetching student', { studentId: req.params.studentId, error: err.message });
    response.error(res, 'Error fetching student', err);
  }
});

router.get("/books/recommended/:studentId", async (req, res) => {
  try {
    const studentId = req.params.studentId;
    logger.debug('Fetching recommendations for student', { studentId });

    // Validate student ID
    if (!studentId) {
      return response.validationError(res, 'Student ID is required');
    }

    // First, get the user's reading preferences based on their history
    const preferencesQuery = `
      SELECT 
        b.author,
        b.category,
        COUNT(*) as borrow_count
      FROM book_borrowings bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.student_id = ?
      GROUP BY b.author, b.category
      ORDER BY borrow_count DESC
      LIMIT 3
    `;

    try {
      const preferences = await db.query(preferencesQuery, [studentId]);
      logger.debug('User preferences fetched', { count: preferences.length });

      if (preferences.length === 0) {
        // If no borrowing history, return popular books or random selection
        const generalRecsQuery = `
          SELECT DISTINCT
            b.id,
            b.title,
            b.author,
            b.category,
            b.status,
            CASE 
              WHEN bb.id IS NOT NULL THEN 'borrowed'
              ELSE b.status
            END as current_status,
            COUNT(bb2.id) as popularity
          FROM books b
          LEFT JOIN (
            SELECT book_id, id
            FROM book_borrowings
            WHERE status = 'borrowed'
          ) bb ON b.id = bb.book_id
          LEFT JOIN book_borrowings bb2 ON b.id = bb2.book_id
          WHERE b.status = 'available'
          AND b.status != 'deleted'
          GROUP BY b.id, b.title, b.author, b.category, b.status, bb.id
          ORDER BY popularity DESC, RAND()
          LIMIT 10
        `;
        logger.debug('Fetching general recommendations');
        const generalRecs = await db.query(generalRecsQuery);
        logger.info('General recommendations fetched', { count: generalRecs.length, studentId });
        return response.success(res, generalRecs);
      }

      // Build conditions for recommendations based on preferences
      const dbConnection = require('../config/database');
      
      // Extract unique authors and categories, filtering out nulls
      const uniqueAuthors = [...new Set(preferences.map(p => p.author).filter(a => a))];
      const uniqueCategories = [...new Set(preferences.map(p => p.category).filter(c => c))];
      
      // Build conditions only if we have valid authors or categories
      const conditions = preferences
        .filter(pref => pref.author || pref.category)
        .map(
          (pref) =>
            `(b.author = ${dbConnection.escape(pref.author)} OR b.category = ${dbConnection.escape(
              pref.category
            )})`
        )
        .join(" OR ");
      
      // If no valid conditions, fall back to general recommendations
      if (!conditions) {
        const generalRecsQuery = `
          SELECT DISTINCT
            b.id,
            b.title,
            b.author,
            b.category,
            b.status,
            CASE 
              WHEN bb.id IS NOT NULL THEN 'borrowed'
              ELSE b.status
            END as current_status,
            COUNT(bb2.id) as popularity
          FROM books b
          LEFT JOIN (
            SELECT book_id, id
            FROM book_borrowings
            WHERE status = 'borrowed'
          ) bb ON b.id = bb.book_id
          LEFT JOIN book_borrowings bb2 ON b.id = bb2.book_id
          WHERE b.status = 'available'
          AND b.status != 'deleted'
          GROUP BY b.id, b.title, b.author, b.category, b.status, bb.id
          ORDER BY popularity DESC, RAND()
          LIMIT 10
        `;
        logger.debug('No valid preferences, fetching general recommendations');
        const generalRecs = await db.query(generalRecsQuery);
        logger.info('General recommendations fetched', { count: generalRecs.length, studentId });
        return response.success(res, generalRecs);
      }

      // Get recommended books based on user preferences
      const recommendationsQuery = `
        SELECT DISTINCT
          b.id,
          b.title,
          b.author,
          b.category,
          b.status,
          CASE 
            WHEN bb.id IS NOT NULL THEN 'borrowed'
            ELSE b.status
          END as current_status,
          CASE
            WHEN b.author IN (${uniqueAuthors
              .map((a) => dbConnection.escape(a))
              .join(",")}) THEN 2
            WHEN b.category IN (${uniqueCategories
              .map((c) => dbConnection.escape(c))
              .join(",")}) THEN 1
            ELSE 0
          END as relevance_score
        FROM books b
        LEFT JOIN (
          SELECT book_id, id
          FROM book_borrowings
          WHERE status = 'borrowed'
        ) bb ON b.id = bb.book_id
        LEFT JOIN (
          SELECT book_id
          FROM book_borrowings
          WHERE student_id = ?
        ) user_borrows ON b.id = user_borrows.book_id
        WHERE b.status != 'deleted'
          AND (${conditions})
          AND (user_borrows.book_id IS NULL OR b.status = 'available')
        ORDER BY relevance_score DESC, RAND()
        LIMIT 10
      `;

      logger.debug('Fetching personalized recommendations');
      const recommendations = await db.query(recommendationsQuery, [
        studentId,
      ]);
      logger.info('Personalized recommendations fetched', { count: recommendations.length, studentId });

      // If we didn't get enough recommendations, add some general ones
      if (recommendations.length < 10) {
        const remainingCount = 10 - recommendations.length;
        
        // Build the NOT IN clause only if there are recommendations to exclude
        const notInClause = recommendations.length > 0
          ? `AND b.id NOT IN (${recommendations.map((r) => dbConnection.escape(r.id)).join(",")})`
          : '';
        
        const additionalRecsQuery = `
          SELECT DISTINCT
            b.id,
            b.title,
            b.author,
            b.category,
            b.status,
            CASE 
              WHEN bb.id IS NOT NULL THEN 'borrowed'
              ELSE b.status
            END as current_status
          FROM books b
          LEFT JOIN (
            SELECT book_id, id
            FROM book_borrowings
            WHERE status = 'borrowed'
          ) bb ON b.id = bb.book_id
          WHERE b.status = 'available'
          AND b.status != 'deleted'
          ${notInClause}
          ORDER BY RAND()
          LIMIT ?
        `;

        const additionalRecs = await db.query(additionalRecsQuery, [
          remainingCount,
        ]);
        recommendations.push(...additionalRecs);
      }

      response.success(res, recommendations);
    } catch (err) {
      logger.error('Error fetching recommendations (inner)', { studentId, error: err.message });
      response.error(res, 'Error fetching recommendations', err);
    }
  } catch (err) {
    logger.error('Error fetching recommendations (outer)', { error: err.message });
    response.error(res, 'Error fetching recommendations', err);
  }
});

router.post("/borrow-book", requireStudent, async (req, res) => {
  try {
    const { studentId, bookId, returnDate } = req.body;

    // Validation 1: Return date is required
    if (!returnDate) {
      return res.status(400).json({
        success: false,
        message: "Return date is required",
      });
    }

    // Validation 2: Return date must be valid date format
    const returnDateObj = new Date(returnDate);
    if (isNaN(returnDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid return date format",
      });
    }

    // Validation 3: Return date must be within 7 days from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const returnDateOnly = new Date(returnDate);
    returnDateOnly.setHours(0, 0, 0, 0);

    const minReturnDate = new Date(today);
    minReturnDate.setDate(today.getDate() + 1); // Minimum tomorrow

    const maxReturnDate = new Date(today);
    maxReturnDate.setDate(today.getDate() + 7); // Maximum 7 days from today

    if (returnDateOnly < minReturnDate) {
      return res.status(400).json({
        success: false,
        message: `Return date must be at least tomorrow (${minReturnDate.toISOString().split('T')[0]})`,
      });
    }

    if (returnDateOnly > maxReturnDate) {
      return res.status(400).json({
        success: false,
        message: `Maximum borrowing period is 7 days. Return date must be on or before ${maxReturnDate.toISOString().split('T')[0]}`,
      });
    }

    // Validation 4: Book availability - Check if book has available copies
    const bookQuery = `
      SELECT status, available_quantity 
      FROM books 
      WHERE id = ? AND status = 'available'
    `;
    const bookResult = await db.query(bookQuery, [bookId]);

    if (bookResult.length === 0) {
      logger.warn('Book borrow attempt - book not available', { bookId, studentId });
      return response.validationError(res, 'Book is not available for borrowing');
    }

    if (bookResult[0].available_quantity <= 0) {
      logger.warn('Book borrow attempt - no copies available', { bookId, studentId });
      return response.validationError(res, 'No copies available for this book');
    }

    // Get first available copy (accession number)
    const availableCopyQuery = `
      SELECT accession_number, condition_status
      FROM book_copies
      WHERE book_id = ? AND status = 'available'
      ORDER BY copy_number ASC
      LIMIT 1
    `;
    const [availableCopy] = await db.query(availableCopyQuery, [bookId]);

    if (!availableCopy) {
      logger.warn('Book borrow attempt - no available copies found', { bookId, studentId });
      return response.validationError(res, 'No physical copies available for this book');
    }

    const accessionNumber = availableCopy.accession_number;
    const copyCondition = availableCopy.condition_status;

    // Validation 5: Check for overdue books
    const overdueQuery = `
      SELECT COUNT(*) as overdue_count
      FROM book_borrowings
      WHERE student_id = ?
      AND status = 'overdue'
      AND return_date IS NULL
    `;
    const overdueResult = await db.query(overdueQuery, [studentId]);

    if (overdueResult[0].overdue_count > 0) {
      logger.warn('Book borrow attempt - has overdue books', { studentId });
      return response.validationError(res, 'Cannot borrow new books while having overdue books');
    }

    // Validation 6: Check total active borrowings (max 5)
    const activeBorrowingsQuery = `
      SELECT COUNT(*) as active_count
      FROM book_borrowings
      WHERE student_id = ?
      AND status IN ('borrowed', 'overdue', 'pending')
    `;
    const activeBorrowingsResult = await db.query(activeBorrowingsQuery, [studentId]);

    if (activeBorrowingsResult[0].active_count >= 5) {
      logger.warn('Book borrow attempt - max limit reached', { studentId, activeCount: activeBorrowingsResult[0].active_count });
      return response.validationError(res, 'You have reached the maximum limit of 5 borrowed books');
    }

    // Create borrowing transaction
    await db.beginTransaction();
    try {
      const borrowQuery = `
        INSERT INTO book_borrowings (
          book_id, 
          student_id,
          accession_number,
          copy_condition_at_borrow,
          borrow_date, 
          due_date,
          status
        ) VALUES (
          ?, 
          ?,
          ?,
          ?,
          CURRENT_TIMESTAMP, 
          ?,
          'borrowed'
        )
      `;
      await db.query(borrowQuery, [bookId, studentId, accessionNumber, copyCondition, returnDate]);

      // Mark the specific copy as borrowed
      await db.query(
        "UPDATE book_copies SET status = 'borrowed' WHERE accession_number = ?",
        [accessionNumber]
      );

      // Decrement available_quantity
      const updateBookQuery = `
        UPDATE books 
        SET available_quantity = available_quantity - 1 
        WHERE id = ?
        AND available_quantity > 0
      `;
      const updateResult = await db.query(updateBookQuery, [bookId]);

      if (updateResult.affectedRows === 0) {
        throw new Error("Failed to update book quantity - no copies available");
      }

      // Log to audit trail
      await db.query(`
        INSERT INTO book_copy_audit (accession_number, action, new_value, notes)
        VALUES (?, 'borrowed', ?, ?)
      `, [
        accessionNumber,
        JSON.stringify({ student_id: studentId, due_date: returnDate }),
        `Borrowed by ${studentId}`
      ]);

      await db.commit();
      logger.info('Single book borrowed successfully', { studentId, bookId, accessionNumber, returnDate });

      response.success(res, { 
        dueDate: returnDate,
        accessionNumber: accessionNumber 
      }, `Book borrowed successfully (Copy: ${accessionNumber})`);
    } catch (transactionError) {
      await db.rollback();
      throw transactionError;
    }
  } catch (err) {
    logger.error('Error borrowing book', { error: err.message, studentId, bookId });
    response.error(res, 'Error borrowing book', err);
  }
});

// Get student's borrowing history
router.get("/borrowing-history/:studentId", requireStudent, async (req, res) => {
  try {
    const { studentId } = req.params;

    const query = `
      SELECT 
        bb.id,
        b.title,
        b.author,
        bb.borrow_date,
        bb.due_date,
        bb.return_date,
        bb.status,
        DATEDIFF(COALESCE(bb.return_date, CURRENT_DATE), bb.borrow_date) as duration,
        CASE
          WHEN bb.return_date IS NULL AND bb.due_date < CURRENT_DATE THEN 'overdue'
          WHEN bb.return_date IS NULL AND DATE(bb.due_date) = CURRENT_DATE THEN 'due_today'
          WHEN bb.return_date IS NULL THEN 'active'
          ELSE 'returned'
        END as deadline_status
      FROM book_borrowings bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.student_id = ?
      ORDER BY bb.borrow_date DESC
    `;

    const borrowingHistory = await db.query(query, [studentId]);
    
    logger.info('Borrowing history fetched', { studentId, count: borrowingHistory.length });
    
    response.success(res, borrowingHistory);
  } catch (error) {
    logger.error('Error fetching borrowing history', { studentId: req.params.studentId, error: error.message });
    response.error(res, 'Error fetching borrowing history', error);
  }
});

/**
 * � NEW ENDPOINT: Bulk Book Borrowing
 * POST /api/students/borrow-multiple
 * 
 * Allows students to borrow multiple books (up to 5) in a single transaction.
 */
router.post("/borrow-multiple", async (req, res) => {
  const { bookIds, studentId } = req.body;
  
  logger.debug('Bulk borrow request received', { bookIds, studentId, hasSession: !!req.session });

  // Validation 1: Authentication - Accept studentId from body (matching single borrow pattern)
  if (!studentId) {
    logger.warn('Bulk borrow attempt without studentId');
    return response.unauthorized(res, 'Not authenticated. Please log in.');
  }

  logger.debug('Processing bulk borrow', { studentId });

  // Validation 2: Request format
  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return response.validationError(res, 'Invalid request. Please provide an array of book IDs.');
  }

  // Validation 3: Maximum 5 books per request
  if (bookIds.length > 5) {
    return response.validationError(res, 'You can only borrow up to 5 books at a time.');
  }

  // Validation 4: Unique book IDs (prevent duplicates)
  const uniqueBookIds = [...new Set(bookIds)];
  if (uniqueBookIds.length !== bookIds.length) {
    return response.validationError(res, 'Duplicate book IDs detected. Each book can only be borrowed once.');
  }

  try {
    // Start transaction
    await db.beginTransaction();

    // Check current active borrowings for student
    const countQuery = `
      SELECT COUNT(*) as activeCount 
      FROM book_borrowings 
      WHERE student_id = ? 
      AND status IN ('borrowed', 'overdue', 'pending')
    `;

    const countResult = await db.query(countQuery, [studentId]);
    const currentActiveBorrowings = countResult[0].activeCount;

    // Validation 5: Total borrowing limit (5 active at a time)
    if (currentActiveBorrowings + uniqueBookIds.length > 5) {
      await new Promise((resolve) => {
        db.rollback(() => resolve());
      });

      return res.status(400).json({ 
        error: `You currently have ${currentActiveBorrowings} active borrowing(s). You can only have 5 books borrowed at a time.`,
        currentBorrowings: currentActiveBorrowings,
        maxAllowed: 5
      });
    }

    // Fetch book details and validate availability
    const booksQuery = `
      SELECT id, title, author, isbn, available_quantity, status 
      FROM books 
      WHERE id IN (?) 
      AND status = 'active'
    `;

    const books = await db.query(booksQuery, [uniqueBookIds]);

    // Validation 6: All books must exist
    if (books.length !== uniqueBookIds.length) {
      await new Promise((resolve) => {
        db.rollback(() => resolve());
      });

      return res.status(404).json({ 
        error: "One or more books not found or are not available for borrowing." 
      });
    }

    // Validation 7: All books must have available copies
    const unavailableBooks = books.filter(book => book.available_quantity <= 0);
    if (unavailableBooks.length > 0) {
      await new Promise((resolve) => {
        db.rollback(() => resolve());
      });

      return res.status(400).json({ 
        error: `The following books are not available: ${unavailableBooks.map(b => b.title).join(', ')}`,
        unavailableBooks: unavailableBooks.map(b => ({
          id: b.id,
          title: b.title
        }))
      });
    }

    // Calculate default dates (current date + 14 days)
    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2 weeks borrowing period

    const borrowDateStr = borrowDate.toISOString().split('T')[0];
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Create borrowing records with accession numbers
    const borrowings = [];

    for (const book of books) {
      // Get first available copy for this book
      const availableCopyQuery = `
        SELECT accession_number, condition_status
        FROM book_copies
        WHERE book_id = ? AND status = 'available'
        ORDER BY copy_number ASC
        LIMIT 1
      `;
      const [availableCopy] = await db.query(availableCopyQuery, [book.id]);

      if (!availableCopy) {
        throw new Error(`No available copies found for book: ${book.title}`);
      }

      const accessionNumber = availableCopy.accession_number;
      const copyCondition = availableCopy.condition_status;

      // Insert borrowing record with accession number
      const insertQuery = `
        INSERT INTO book_borrowings 
        (book_id, student_id, accession_number, copy_condition_at_borrow, borrow_date, due_date, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'borrowed')
      `;

      const borrowingResult = await db.query(insertQuery, [
        book.id, 
        studentId,
        accessionNumber,
        copyCondition,
        borrowDateStr, 
        dueDateStr
      ]);

      // Mark the specific copy as borrowed
      await db.query(
        "UPDATE book_copies SET status = 'borrowed' WHERE accession_number = ?",
        [accessionNumber]
      );

      // Decrement available_quantity (atomic operation with row lock)
      const updateQuery = `
        UPDATE books 
        SET available_quantity = available_quantity - 1 
        WHERE id = ? 
        AND available_quantity > 0
      `;

      const updateResult = await db.query(updateQuery, [book.id]);

      // Log to audit trail
      await db.query(`
        INSERT INTO book_copy_audit (accession_number, action, new_value, notes)
        VALUES (?, 'borrowed', ?, ?)
      `, [
        accessionNumber,
        JSON.stringify({ student_id: studentId, due_date: dueDateStr }),
        `Bulk borrowed by ${studentId}`
      ]);

      // Validation 8: Ensure quantity was actually decremented
      if (updateResult.affectedRows === 0) {
        throw new Error(`Failed to update quantity for book: ${book.title}`);
      }

      borrowings.push({
        borrowingId: borrowingResult.insertId,
        bookId: book.id,
        title: book.title,
        author: book.author,
        accessionNumber: accessionNumber,
        borrowDate: borrowDateStr,
        dueDate: dueDateStr
      });
    }

    // Commit transaction
    await db.commit();

    // Log successful bulk borrow
    logger.info('Bulk borrow successful', { 
      studentId, 
      bookCount: borrowings.length, 
      books: borrowings.map(b => b.title) 
    });

    // Success response
    res.json({
      success: true,
      successCount: borrowings.length,
      message: `Successfully borrowed ${borrowings.length} book(s). Due date: ${dueDateStr}`,
      borrowings: borrowings,
      dueDate: dueDateStr
    });

  } catch (error) {
    // Rollback on any error
    await db.rollback();

    logger.error('Bulk borrow error', { error: error.message, studentId, bookIds });
    response.error(res, 'Failed to process bulk borrowing request. Please try again.', error);
  }
});

// Bulk delete students endpoint
router.delete("/bulk", requireAdmin, async (req, res) => {
  const { studentIds } = req.body;

  // Validation: studentIds must be a non-empty array
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return response.validationError(res, 'studentIds must be a non-empty array');
  }

  // Safety limit: max 50 students per request
  if (studentIds.length > 50) {
    return response.validationError(res, 'Cannot delete more than 50 students at once');
  }

  logger.info('Bulk delete students request', { count: studentIds.length, studentIds });

  const successfulDeletes = [];
  const failedDeletes = [];

  try {
    await db.beginTransaction();

    for (const studentId of studentIds) {
      try {
        // Check if student has active borrowings
        const activeBorrowings = await db.query(
          `SELECT COUNT(*) as count FROM book_borrowings 
           WHERE student_id = ? AND status IN ('borrowed', 'overdue')`,
          [studentId]
        );

        if (activeBorrowings[0].count > 0) {
          failedDeletes.push({
            studentId,
            reason: 'Student has active book borrowings'
          });
          continue;
        }

        // Delete borrowing history first
        await db.query(
          'DELETE FROM book_borrowings WHERE student_id = ?',
          [studentId]
        );

        // Delete student
        const deleteResult = await db.query(
          'DELETE FROM students WHERE student_id = ?',
          [studentId]
        );

        if (deleteResult.affectedRows > 0) {
          successfulDeletes.push(studentId);
        } else {
          failedDeletes.push({
            studentId,
            reason: 'Student not found'
          });
        }
      } catch (error) {
        logger.error('Error deleting student', { studentId, error: error.message });
        failedDeletes.push({
          studentId,
          reason: error.message
        });
      }
    }

    await db.commit();

    logger.info('Bulk delete completed', { 
      successful: successfulDeletes.length, 
      failed: failedDeletes.length 
    });

    response.success(res, {
      successfulDeletes,
      failedDeletes,
      totalRequested: studentIds.length,
      successCount: successfulDeletes.length,
      failureCount: failedDeletes.length
    }, `Successfully deleted ${successfulDeletes.length} student(s)`);

  } catch (error) {
    await db.rollback();
    logger.error('Bulk delete transaction error', { error: error.message });
    response.error(res, 'Failed to process bulk delete request', error);
  }
});

// Add logging to debug the 500 error
router.get('/api/admin/students', async (req, res) => {
  try {
    logger.info('Fetching students data');
    const students = await db.query('SELECT * FROM students');
    logger.info('Students data fetched successfully', { count: students.length });
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    logger.error('Error fetching students data', { error: error.message });
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

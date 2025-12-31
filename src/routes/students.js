const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { requireStudent, requireAdmin } = require("../middleware/auth");

const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) reject(err);
      resolve(results);
    });
  });
};

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
      executeQuery(availableBooksQuery),
      executeQuery(borrowedBooksQuery, [studentId]),
      executeQuery(dueSoonQuery, [studentId]),
    ]);

    res.json({
      availableBooks: availableBooks[0].count,
      borrowedBooks: borrowedBooks[0].count,
      dueSoon: dueSoon[0].count,
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ error: "Internal server error" });
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
    console.log("[BACKEND] Students query with filters:", { search, department, year_level, status });
    
    const students = await executeQuery(query, queryParams);
    res.json(students);
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:studentId", async (req, res) => {
  try {
    const query = `${SELECT_STUDENT_FIELDS} WHERE student_id = ?`;
    const students = await executeQuery(query, [req.params.studentId]);

    if (students.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(students[0]);
  } catch (err) {
    console.error("Error fetching student:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/books/recommended/:studentId", async (req, res) => {
  try {
    const studentId = req.params.studentId;
    console.log("Fetching recommendations for student:", studentId);

    // Validate student ID
    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required" });
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
      const preferences = await executeQuery(preferencesQuery, [studentId]);
      console.log("User preferences:", preferences);

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
        console.log("Fetching general recommendations");
        const generalRecs = await executeQuery(generalRecsQuery);
        console.log("General recommendations found:", generalRecs.length);
        return res.json(generalRecs);
      }

      // Build conditions for recommendations based on preferences
      const conditions = preferences
        .map(
          (pref) =>
            `(b.author = ${db.escape(pref.author)} OR b.category = ${db.escape(
              pref.category
            )})`
        )
        .join(" OR ");

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
            WHEN b.author IN (${preferences
              .map((p) => db.escape(p.author))
              .join(",")}) THEN 2
            WHEN b.category IN (${preferences
              .map((p) => db.escape(p.category))
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

      console.log("Fetching personalized recommendations");
      const recommendations = await executeQuery(recommendationsQuery, [
        studentId,
      ]);
      console.log(
        "Personalized recommendations found:",
        recommendations.length
      );

      // If we didn't get enough recommendations, add some general ones
      if (recommendations.length < 10) {
        const remainingCount = 10 - recommendations.length;
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
          AND b.id NOT IN (${recommendations
            .map((r) => db.escape(r.id))
            .join(",")})
          ORDER BY RAND()
          LIMIT ?
        `;

        const additionalRecs = await executeQuery(additionalRecsQuery, [
          remainingCount,
        ]);
        recommendations.push(...additionalRecs);
      }

      res.json(recommendations);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (err) {
    console.error("Error fetching recommendations:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/borrow-book", async (req, res) => {
  try {
    const { studentId, bookId, returnDate } = req.body;

    // Validate return date
    if (!returnDate) {
      return res.status(400).json({
        success: false,
        message: "Return date is required",
      });
    }

    const bookQuery = `
      SELECT status 
      FROM books 
      WHERE id = ? AND status = 'available'
    `;
    const bookResult = await executeQuery(bookQuery, [bookId]);

    if (bookResult.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Book is not available for borrowing",
      });
    }

    const overdueQuery = `
      SELECT COUNT(*) as overdue_count
      FROM book_borrowings
      WHERE student_id = ?
      AND status = 'overdue'
      AND return_date IS NULL
    `;
    const overdueResult = await executeQuery(overdueQuery, [studentId]);

    if (overdueResult[0].overdue_count > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot borrow new books while having overdue books",
      });
    }

    await new Promise((resolve, reject) => {
      db.beginTransaction(async (err) => {
        if (err) reject(err);

        try {
          const borrowQuery = `
            INSERT INTO book_borrowings (
              book_id, 
              student_id, 
              borrow_date, 
              due_date,
              status
            ) VALUES (
              ?, 
              ?, 
              CURRENT_TIMESTAMP, 
              ?,
              'borrowed'
            )
          `;
          await executeQuery(borrowQuery, [bookId, studentId, returnDate]);

          const updateBookQuery = `
            UPDATE books 
            SET status = 'borrowed' 
            WHERE id = ?
          `;
          await executeQuery(updateBookQuery, [bookId]);

          db.commit((err) => {
            if (err) reject(err);
            resolve();
          });
        } catch (err) {
          db.rollback(() => reject(err));
        }
      });
    });

    res.json({
      success: true,
      message: "Book borrowed successfully",
    });
  } catch (err) {
    console.error("Error borrowing book:", err);
    res.status(500).json({
      success: false,
      message: "Error borrowing book",
    });
  }
});

// Get student's borrowing history
router.get("/borrowing-history/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    const query = `
      SELECT 
        b.title,
        b.author,
        bb.borrow_date,
        bb.return_date,
        DATEDIFF(COALESCE(bb.return_date, CURRENT_DATE), bb.borrow_date) as duration
      FROM book_borrowings bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.student_id = ?
      ORDER BY bb.borrow_date DESC
    `;

    const borrowingHistory = await executeQuery(query, [studentId]);
    res.json(borrowingHistory);
  } catch (error) {
    console.error("Error fetching borrowing history:", error);
    res.status(500).json({
      message: "Error fetching borrowing history",
      error: error.message,
    });
  }
});

/**
 * 🆕 NEW ENDPOINT: Bulk Book Borrowing
 * POST /api/students/borrow-multiple
 * 
 * Allows students to borrow multiple books (up to 5) in a single transaction.
 */
router.post("/borrow-multiple", async (req, res) => {
  const { bookIds } = req.body;
  
  console.log("[BULK BORROW DEBUG] Full session:", JSON.stringify(req.session, null, 2));
  console.log("[BULK BORROW DEBUG] Session user:", req.session.user);
  console.log("[BULK BORROW DEBUG] Session ID:", req.sessionID);
  
  // Get the actual student_id (like "GOOGLE-xxx" or "STD-xxx"), not the numeric id
  const studentId = req.session.user?.studentId;

  console.log("[BULK BORROW] Using student_id:", studentId);

  // Validation 1: Authentication
  if (!studentId) {
    console.log("[BULK BORROW ERROR] No studentId in session");
    return res.status(401).json({ 
      error: "Not authenticated. Please log in.",
      debug: {
        hasSession: !!req.session,
        hasUser: !!req.session.user,
        userKeys: req.session.user ? Object.keys(req.session.user) : []
      }
    });
  }

  // Validation 2: Request format
  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return res.status(400).json({ 
      error: "Invalid request. Please provide an array of book IDs." 
    });
  }

  // Validation 3: Maximum 5 books per request
  if (bookIds.length > 5) {
    return res.status(400).json({ 
      error: "You can only borrow up to 5 books at a time." 
    });
  }

  // Validation 4: Unique book IDs (prevent duplicates)
  const uniqueBookIds = [...new Set(bookIds)];
  if (uniqueBookIds.length !== bookIds.length) {
    return res.status(400).json({ 
      error: "Duplicate book IDs detected. Each book can only be borrowed once." 
    });
  }

  try {
    // Start transaction
    await new Promise((resolve, reject) => {
      db.beginTransaction((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check current active borrowings for student
    const countQuery = `
      SELECT COUNT(*) as activeCount 
      FROM book_borrowings 
      WHERE student_id = ? 
      AND status IN ('borrowed', 'overdue', 'pending')
    `;

    const countResult = await executeQuery(countQuery, [studentId]);
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

    const books = await executeQuery(booksQuery, [uniqueBookIds]);

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

    // Create borrowing records and decrement quantities
    const borrowings = [];

    for (const book of books) {
      // Insert borrowing record
      const insertQuery = `
        INSERT INTO book_borrowings 
        (book_id, student_id, borrow_date, due_date, status) 
        VALUES (?, ?, ?, ?, 'borrowed')
      `;

      const borrowingResult = await executeQuery(insertQuery, [
        book.id, 
        studentId, 
        borrowDateStr, 
        dueDateStr
      ]);

      // Decrement available_quantity (atomic operation with row lock)
      const updateQuery = `
        UPDATE books 
        SET available_quantity = available_quantity - 1 
        WHERE id = ? 
        AND available_quantity > 0
      `;

      const updateResult = await executeQuery(updateQuery, [book.id]);

      // Validation 8: Ensure quantity was actually decremented
      if (updateResult.affectedRows === 0) {
        throw new Error(`Failed to update quantity for book: ${book.title}`);
      }

      borrowings.push({
        borrowingId: borrowingResult.insertId,
        bookId: book.id,
        title: book.title,
        author: book.author,
        borrowDate: borrowDateStr,
        dueDate: dueDateStr
      });
    }

    // Commit transaction
    await new Promise((resolve, reject) => {
      db.commit((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Log successful bulk borrow
    console.log(`[BULK BORROW SUCCESS] Student ${studentId} borrowed ${borrowings.length} books:`, 
      borrowings.map(b => b.title).join(', ')
    );

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
    await new Promise((resolve) => {
      db.rollback(() => resolve());
    });

    console.error("[BULK BORROW ERROR]", error);
    res.status(500).json({ 
      error: "Failed to process bulk borrowing request. Please try again.",
      details: error.message 
    });
  }
});

module.exports = router;

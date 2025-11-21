const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcrypt");

// Helper functions
const queryDB = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const handleError = (res, message, err) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: message,
    error: err.message,
  });
};

// Middleware to log all admin API requests
router.use((req, res, next) => {
  console.log("Admin API Request:", {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
  });
  next();
});

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
    const results = await queryDB(query);
    res.json(results);
  } catch (err) {
    handleError(res, "Failed to fetch students", err);
  }
});

// Book Management Routes
router.get("/books", async (req, res) => {
  const query = `
    SELECT 
      b.id, b.title, b.author, b.isbn, b.category, 
      b.added_date, b.status, b.quantity,
      CASE 
        WHEN bb.status = 'borrowed' THEN 'Borrowed'
        WHEN bb.status = 'overdue' THEN 'Overdue'
        ELSE 'Available'
      END as current_status,
      bb.borrow_date, bb.due_date,
      s.fullname as borrowed_by,
      bb.status as borrow_status
    FROM books b
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
    WHERE b.status != 'deleted'
    ORDER BY b.id DESC
  `;

  try {
    const results = await queryDB(query);
    console.log("Books query results:", results); // Debug line
    res.json(results);
  } catch (err) {
    handleError(res, "Database error", err);
  }
});

router.post("/books", async (req, res) => {
  const { title, author, category, isbn, quantity } = req.body;
  console.log("Adding new book:", { title, author, category, isbn, quantity });

  if (!title || !author || !category || !isbn) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    // Check for duplicate ISBN
    const existingBook = await queryDB("SELECT id FROM books WHERE isbn = ?", [
      isbn,
    ]);
    if (existingBook.length > 0) {
      return res.status(400).json({
        success: false,
        message: "A book with this ISBN already exists",
      });
    }

    const bookQuantity = quantity || 1;
    const query = `
      INSERT INTO books (title, author, isbn, category, added_date, status, quantity)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'available', ?)
    `;

    const result = await queryDB(query, [title, author, isbn, category, bookQuantity]);
    res.status(201).json({
      success: true,
      message: "Book added successfully",
      bookId: result.insertId,
    });
  } catch (err) {
    handleError(res, "Error adding book", err);
  }
});

router.put("/books/:id", async (req, res) => {
  const bookId = req.params.id;
  const { title, author, category, isbn, status, student_id, quantity } = req.body;

  console.log("PUT /books/:id received data:", { title, author, category, isbn, status, student_id, quantity });
  console.log("Quantity type:", typeof quantity, "Value:", quantity);

  if (!title || !author || !category || !isbn) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    // Start transaction
    await new Promise((resolve, reject) => {
      db.beginTransaction(async (err) => {
        if (err) reject(err);

        try {
          // Verify book exists
          const book = await queryDB(
            "SELECT id, status FROM books WHERE id = ?",
            [bookId]
          );
          if (book.length === 0) {
            throw new Error("Book not found");
          }

          // Update book details with quantity
          const bookQuantity = quantity || 1;
          await queryDB(
            "UPDATE books SET title = ?, author = ?, category = ?, isbn = ?, status = ?, quantity = ? WHERE id = ?",
            [title, author, category, isbn, status, bookQuantity, bookId]
          );

          // Handle borrowing status
          if (status === "borrowed") {
            if (!student_id) {
              throw new Error("Student ID is required when status is borrowed");
            }

            // Check if book is already borrowed
            const currentBorrowing = await queryDB(
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
                await queryDB(
                  `UPDATE book_borrowings 
                   SET status = 'returned', return_date = CURRENT_TIMESTAMP 
                   WHERE id = ?`,
                  [currentBorrowing[0].id]
                );

                // Create new borrowing record
                await queryDB(
                  `INSERT INTO book_borrowings 
                   (book_id, student_id, borrow_date, due_date, status) 
                   VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY), 'borrowed')`,
                  [bookId, student_id]
                );
              }
              // If same borrower, do nothing
            } else {
              // No current borrowing, create new one
              await queryDB(
                `INSERT INTO book_borrowings 
                 (book_id, student_id, borrow_date, due_date, status) 
                 VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY), 'borrowed')`,
                [bookId, student_id]
              );
            }
          } else if (status === "available") {
            // Mark any existing borrowings as returned
            await queryDB(
              `UPDATE book_borrowings 
               SET status = 'returned', return_date = CURRENT_TIMESTAMP 
               WHERE book_id = ? 
               AND status IN ('borrowed', 'overdue') 
               AND return_date IS NULL`,
              [bookId]
            );
          }

          db.commit((err) => {
            if (err) reject(err);
            resolve();
          });
        } catch (err) {
          db.rollback(() => reject(err));
          throw err;
        }
      });
    });

    res.json({
      success: true,
      message: "Book updated successfully",
    });
  } catch (err) {
    handleError(res, "Error updating book", err);
  }
});

router.delete("/books/:id", async (req, res) => {
  const bookId = req.params.id;

  try {
    // Verify book exists
    const book = await queryDB("SELECT id FROM books WHERE id = ?", [bookId]);
    if (book.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Check if book is borrowed
    const borrowStatus = await queryDB(
      "SELECT status FROM book_borrowings WHERE book_id = ? AND status = 'active'",
      [bookId]
    );
    if (borrowStatus.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete book that is currently borrowed",
      });
    }

    // Delete book and its borrowing records in a transaction
    await new Promise((resolve, reject) => {
      db.beginTransaction(async (err) => {
        if (err) reject(err);

        try {
          await queryDB("DELETE FROM book_borrowings WHERE book_id = ?", [
            bookId,
          ]);
          await queryDB("DELETE FROM books WHERE id = ?", [bookId]);

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
      message: "Book deleted successfully",
    });
  } catch (err) {
    handleError(res, "Error deleting book", err);
  }
});

// Dashboard Statistics Route
router.get("/dashboard/stats", async (req, res) => {
  const queries = {
    totalBooks: "SELECT COUNT(*) as count FROM books WHERE status != 'deleted'",
    activeBorrowings: `
      SELECT COUNT(*) as count 
      FROM book_borrowings 
      WHERE status IN ('borrowed', 'overdue')
    `,
    registeredStudents:
      "SELECT COUNT(*) as count FROM students WHERE status = 'active'",
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
        console.log(`Executing query for ${key}...`);
        const result = await queryDB(query);
        console.log(`Results for ${key}:`, result);
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
        console.log(`Processed ${value.key}:`, stats[value.key]);
      } else {
        console.error(
          `Error executing query for ${value?.key}:`,
          value?.reason
        );
        stats[value?.key] = [];
      }
    });

    console.log("Final dashboard stats:", stats);
    res.json(stats);
  } catch (err) {
    handleError(res, "Error fetching dashboard statistics", err);
  }
});

router.get("/", async (req, res) => {
  try {
    const admins = await queryDB(
      "SELECT id, fullname, email, role, created_at FROM admins"
    );
    res.json(admins);
  } catch (err) {
    handleError(res, "Failed to fetch admins", err);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const admin = await queryDB(
      "SELECT id, fullname, email, role FROM admins WHERE id = ?",
      [req.params.id]
    );

    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json(admin[0]);
  } catch (err) {
    handleError(res, "Failed to fetch admin", err);
  }
});

router.post("/", async (req, res) => {
  try {
    const { fullname, email, password, role } = req.body;

    if (!fullname || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingAdmin = await queryDB(
      "SELECT id FROM admins WHERE email = ?",
      [email]
    );

    if (existingAdmin.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queryDB(
      "INSERT INTO admins (fullname, email, password, role) VALUES (?, ?, ?, ?)",
      [fullname, email, hashedPassword, role]
    );

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      adminId: result.insertId,
    });
  } catch (err) {
    handleError(res, "Failed to create admin", err);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { fullname, email, password, role } = req.body;
    const adminId = req.params.id;

    const admin = await queryDB("SELECT id FROM admins WHERE id = ?", [
      adminId,
    ]);
    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (email) {
      const existingAdmin = await queryDB(
        "SELECT id FROM admins WHERE email = ? AND id != ?",
        [email, adminId]
      );

      if (existingAdmin.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
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
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    params.push(adminId);
    await queryDB(
      `UPDATE admins SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: "Admin updated successfully",
    });
  } catch (err) {
    handleError(res, "Failed to update admin", err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await queryDB("DELETE FROM admins WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (err) {
    handleError(res, "Failed to delete admin", err);
  }
});

module.exports = router;

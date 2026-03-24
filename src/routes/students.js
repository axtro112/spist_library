const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const { requireAuth, requireAdmin, requireSuperAdmin } = require("../middleware/auth");

function isAdminSession(req) {
  return req.session && req.session.user && req.session.user.userRole === "admin";
}

function canAccessStudent(req, targetId) {
  if (isAdminSession(req)) return true;
  const user = req.session && req.session.user;
  if (!user || user.userRole !== "student") return false;
  return String(user.studentId) === String(targetId) || String(user.id) === String(targetId);
}

async function getStudentByIdOrStudentId(idOrStudentId) {
  const rows = await db.query(
    `SELECT id, student_id, fullname, email, department, year_level, student_type, contact_number, status
     FROM students
     WHERE deleted_at IS NULL
       AND (id = ? OR student_id = ?)
     LIMIT 1`,
    [idOrStudentId, idOrStudentId]
  );
  return rows[0] || null;
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { search, department, year_level, status } = req.query;

    let query = `
      SELECT id, student_id, fullname, email, department, year_level, student_type, contact_number, status
      FROM students
      WHERE deleted_at IS NULL
    `;
    const params = [];

    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      query += ` AND (fullname LIKE ? OR student_id LIKE ? OR email LIKE ?)`;
      params.push(s, s, s);
    }
    if (department && String(department).trim()) {
      query += ` AND department = ?`;
      params.push(String(department).trim());
    }
    if (year_level && String(year_level).trim()) {
      query += ` AND year_level = ?`;
      params.push(String(year_level).trim());
    }
    if (status && String(status).trim()) {
      query += ` AND status = ?`;
      params.push(String(status).trim());
    }

    query += ` ORDER BY fullname ASC`;

    const students = await db.query(query, params);
    return response.success(res, students);
  } catch (err) {
    logger.error("Failed to fetch students", { error: err.message });
    return response.error(res, "Failed to fetch students", err);
  }
});

router.get("/books/recommended/:studentId", requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!canAccessStudent(req, studentId)) {
      return response.forbidden(res, "Access denied");
    }

    const books = await db.query(
      `SELECT id, title, author, category, isbn,
              CASE
                WHEN available_quantity > 0 THEN 'available'
                ELSE 'borrowed'
              END AS current_status,
              quantity,
              available_quantity
       FROM books
       WHERE deleted_at IS NULL
         AND status IN ('active', 'available', 'borrowed', 'maintenance')
       ORDER BY available_quantity DESC, id DESC
       LIMIT 12`
    );

    return response.success(res, books);
  } catch (err) {
    logger.error("Failed to fetch recommended books", { error: err.message });
    return response.error(res, "Failed to fetch recommended books", err);
  }
});

router.get("/:id/dashboard-stats", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!canAccessStudent(req, id)) {
      return response.forbidden(res, "Access denied");
    }

    const student = await getStudentByIdOrStudentId(id);
    if (!student) return response.notFound(res, "Student not found");

    const [availableBooksRow] = await db.query(
      `SELECT COALESCE(SUM(available_quantity), 0) AS count
       FROM books
       WHERE deleted_at IS NULL
         AND status IN ('active', 'available', 'borrowed', 'maintenance')`
    );

    const [borrowedBooksRow] = await db.query(
      `SELECT COUNT(*) AS count
       FROM book_borrowings
       WHERE student_id = ?
         AND return_date IS NULL
         AND status IN ('borrowed', 'overdue')
         AND picked_up_at IS NOT NULL`,
      [student.student_id]
    );

    const [dueSoonRow] = await db.query(
      `SELECT COUNT(*) AS count
       FROM book_borrowings
       WHERE student_id = ?
         AND return_date IS NULL
         AND status IN ('borrowed', 'overdue')
         AND picked_up_at IS NOT NULL
         AND due_date >= CURDATE()
         AND due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)`,
      [student.student_id]
    );

    const [pendingPickupRow] = await db.query(
      `SELECT COUNT(*) AS count
       FROM book_borrowings
       WHERE student_id = ?
         AND return_date IS NULL
         AND status = 'borrowed'
         AND picked_up_at IS NULL`,
      [student.student_id]
    );

    return response.success(res, {
      availableBooks: availableBooksRow?.count || 0,
      borrowedBooks: borrowedBooksRow?.count || 0,
      dueSoon: dueSoonRow?.count || 0,
      pendingBooks: pendingPickupRow?.count || 0,
    });
  } catch (err) {
    logger.error("Failed to fetch student dashboard stats", { error: err.message });
    return response.error(res, "Failed to fetch student dashboard stats", err);
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!canAccessStudent(req, id)) {
      return response.forbidden(res, "Access denied");
    }

    const student = await getStudentByIdOrStudentId(id);
    if (!student) return response.notFound(res, "Student not found");

    return response.success(res, student);
  } catch (err) {
    logger.error("Failed to fetch student", { error: err.message });
    return response.error(res, "Failed to fetch student", err);
  }
});

router.patch("/bulk-update", requireSuperAdmin, async (req, res) => {
  try {
    const { studentIds, update } = req.body || {};
    const ids = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];
    if (!ids.length) return response.validationError(res, "studentIds are required");

    const updates = [];
    const params = [];
    if (update && Object.prototype.hasOwnProperty.call(update, "department")) {
      updates.push("department = ?");
      params.push(update.department);
    }
    if (update && Object.prototype.hasOwnProperty.call(update, "year_level")) {
      updates.push("year_level = ?");
      params.push(update.year_level);
    }
    if (update && Object.prototype.hasOwnProperty.call(update, "status")) {
      updates.push("status = ?");
      params.push(update.status);
    }
    if (!updates.length) return response.validationError(res, "No fields to update");

    const placeholders = ids.map(() => "?").join(",");
    const sql = `UPDATE students SET ${updates.join(", ")} WHERE student_id IN (${placeholders}) AND deleted_at IS NULL`;
    const result = await db.query(sql, [...params, ...ids]);

    return response.success(res, { updatedCount: result.affectedRows || 0 }, "Students updated successfully");
  } catch (err) {
    logger.error("Bulk update students failed", { error: err.message });
    return response.error(res, "Bulk update failed", err);
  }
});

router.delete("/bulk", requireSuperAdmin, async (req, res) => {
  try {
    const { studentIds } = req.body || {};
    const ids = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];
    if (!ids.length) return response.validationError(res, "studentIds are required");

    let successCount = 0;
    const failedDeletes = [];

    for (const sid of ids) {
      try {
        const users = await db.query(
          `SELECT id, student_id, fullname
           FROM students
           WHERE student_id = ? AND deleted_at IS NULL
           LIMIT 1`,
          [sid]
        );
        const user = users[0];
        if (!user) {
          failedDeletes.push({ studentId: sid, reason: "Student not found" });
          continue;
        }

        const activeBorrowings = await db.query(
          `SELECT COUNT(*) AS count
           FROM book_borrowings
           WHERE student_id = ?
             AND return_date IS NULL
             AND status IN ('borrowed', 'overdue', 'approved')`,
          [user.student_id]
        );

        if ((activeBorrowings[0] && activeBorrowings[0].count) > 0) {
          failedDeletes.push({ studentId: sid, reason: "Has active borrowings" });
          continue;
        }

        await db.query(
          `UPDATE students
           SET deleted_at = NOW(), status = 'inactive'
           WHERE student_id = ? AND deleted_at IS NULL`,
          [sid]
        );
        successCount += 1;
      } catch (e) {
        failedDeletes.push({ studentId: sid, reason: e.message });
      }
    }

    return response.success(res, {
      successCount,
      failureCount: failedDeletes.length,
      failedDeletes,
    });
  } catch (err) {
    logger.error("Bulk delete students failed", { error: err.message });
    return response.error(res, "Bulk delete failed", err);
  }
});

router.post("/borrow-book", requireAuth, async (req, res) => {
  try {
    const { bookId, studentId, returnDate } = req.body || {};
    if (!bookId || !studentId) {
      return response.validationError(res, "bookId and studentId are required");
    }
    if (!canAccessStudent(req, studentId) && !isAdminSession(req)) {
      return response.forbidden(res, "Access denied");
    }

    const student = await getStudentByIdOrStudentId(studentId);
    if (!student) return response.notFound(res, "Student not found");

    const books = await db.query(
      `SELECT id, title, available_quantity, status
       FROM books
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [bookId]
    );
    const book = books[0];
    if (!book) return response.notFound(res, "Book not found");
    if ((book.available_quantity || 0) <= 0) {
      return response.validationError(res, "Book is not currently available");
    }

    const dueDate = returnDate ? new Date(returnDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dueDateSql = dueDate.toISOString().slice(0, 19).replace("T", " ");
    
    // Check if admin approval is required (controlled via environment variable)
    const requireAdminApproval = process.env.REQUIRE_BORROW_APPROVAL === 'true';
    const borrowStatus = requireAdminApproval ? 'pending' : 'borrowed';

    await db.withTransaction(async (conn) => {
      await conn.queryAsync(
        `INSERT INTO book_borrowings (book_id, student_id, borrow_date, due_date, status)
         VALUES (?, ?, NOW(), ?, ?)`,
        [book.id, student.student_id, dueDateSql, borrowStatus]
      );

      await conn.queryAsync(
        `UPDATE books
         SET available_quantity = CASE WHEN available_quantity > 0 THEN available_quantity - 1 ELSE 0 END,
             status = CASE WHEN available_quantity - 1 <= 0 THEN 'borrowed' ELSE status END,
             updated_at = NOW()
         WHERE id = ?`,
        [book.id]
      );
    });

    return response.success(res, { bookId: book.id, studentId: student.student_id, status: borrowStatus }, "Book borrowed successfully" + (borrowStatus === 'pending' ? " - Awaiting admin approval" : ""), 201);
  } catch (err) {
    logger.error("Borrow book failed", { error: err.message });
    return response.error(res, "Borrow book failed", err);
  }
});

router.post("/borrow-multiple", requireAuth, async (req, res) => {
  try {
    const { bookIds, studentId } = req.body || {};
    const ids = Array.isArray(bookIds) ? bookIds.filter(Boolean) : [];
    if (!ids.length || !studentId) {
      return response.validationError(res, "bookIds and studentId are required");
    }
    if (!canAccessStudent(req, studentId) && !isAdminSession(req)) {
      return response.forbidden(res, "Access denied");
    }

    const student = await getStudentByIdOrStudentId(studentId);
    if (!student) return response.notFound(res, "Student not found");

    let successCount = 0;
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dueDateSql = dueDate.toISOString().slice(0, 19).replace("T", " ");

    for (const bookId of ids) {
      const books = await db.query(
        `SELECT id, available_quantity
         FROM books
         WHERE id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [bookId]
      );
      const book = books[0];
      if (!book || (book.available_quantity || 0) <= 0) continue;

      await db.withTransaction(async (conn) => {
        await conn.queryAsync(
          `INSERT INTO book_borrowings (book_id, student_id, borrow_date, due_date, status)
           VALUES (?, ?, NOW(), ?, 'borrowed')`,
          [book.id, student.student_id, dueDateSql]
        );

        await conn.queryAsync(
          `UPDATE books
           SET available_quantity = CASE WHEN available_quantity > 0 THEN available_quantity - 1 ELSE 0 END,
               status = CASE WHEN available_quantity - 1 <= 0 THEN 'borrowed' ELSE status END,
               updated_at = NOW()
           WHERE id = ?`,
          [book.id]
        );
      });

      successCount += 1;
    }

    return response.success(res, {
      successCount,
      dueDate: dueDate.toLocaleDateString(),
    });
  } catch (err) {
    logger.error("Borrow multiple failed", { error: err.message });
    return response.error(res, "Borrow multiple failed", err);
  }
});

module.exports = router;

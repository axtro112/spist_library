const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const { requireAuth } = require("../middleware/auth");

function getUserContext(req) {
  const userRole = req.session.user?.userRole || req.session.userRole;
  const userType = userRole === 'admin' ? 'admin' : userRole === 'student' ? 'student' : null;

  let userId = null;
  if (req.session.user) {
    userId = userType === 'admin' ? String(req.session.user.id) : req.session.user.studentId;
  } else {
    userId = userType === 'admin' ? String(req.session.adminId) : req.session.studentId;
  }

  return { userType, userId };
}

// GET /api/book-borrowings/detail/:id - single borrowing (for notification modal)
router.get("/detail/:id", requireAuth, async (req, res) => {
  try {
    const { userType, userId } = getUserContext(req);
    const borrowingId = req.params.id;

    const query = `
      SELECT 
        bb.id,
        bb.book_id,
        bb.student_id,
        bb.borrow_date,
        bb.due_date,
        bb.return_date,
        bb.status,
        bb.approved_by,
        bb.notes,
        b.title,
        b.author,
        b.category,
        b.isbn,
        a.fullname AS approved_by_name
      FROM book_borrowings bb
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN admins a ON bb.approved_by = a.id
      WHERE bb.id = ?
      LIMIT 1
    `;

    const rows = await db.query(query, [borrowingId]);

    if (!rows || rows.length === 0) {
      logger.warn('Borrowing not found', { borrowingId });
      return response.notFound(res, 'Borrowing not found');
    }

    const borrowing = rows[0];

    // Authorization: students can only view their own borrowing
    if (userType === 'student' && borrowing.student_id !== userId) {
      logger.warn('Borrowing access denied for student', { borrowingId, studentId: userId });
      return response.forbidden(res, 'Access denied');
    }

    logger.info('Borrowing detail fetched', { borrowingId, userType, userId });
    response.success(res, borrowing);
  } catch (error) {
    logger.error('Error fetching borrowing detail', { error: error.message, borrowingId: req.params.id });
    response.error(res, 'Error fetching borrowing detail', error);
  }
});

// Get all borrowings for a student
router.get("/:studentId", async (req, res) => {
  try {
    const query = `
      SELECT 
        bb.id as borrow_id,
        bb.book_id,
        bb.student_id,
        bb.borrow_date,
        bb.due_date,
        bb.return_date,
        bb.status as borrow_status,
        b.title,
        b.author,
        b.status as book_status
      FROM book_borrowings bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.student_id = ?
        AND (bb.status = 'borrowed' OR bb.status = 'overdue')
      ORDER BY bb.due_date ASC
    `;

    const borrowings = await db.query(query, [req.params.studentId]);

    // Format the response
    const result = {
      total_borrowed: borrowings.length,
      books: borrowings.map((b) => ({
        borrow_id: b.borrow_id,
        title: b.title,
        author: b.author,
        borrow_date: b.borrow_date,
        due_date: b.due_date,
        status: b.borrow_status,
      })),
    };

    logger.info('Borrowings fetched for student', { studentId: req.params.studentId, count: borrowings.length });
    response.success(res, result);
  } catch (error) {
    logger.error('Error fetching borrowings', { studentId: req.params.studentId, error: error.message });
    response.error(res, 'Error fetching borrowings', error);
  }
});

module.exports = router;

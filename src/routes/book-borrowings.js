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
        bb.accession_number,
        bb.picked_up_at,
        bb.status as borrow_status,
        CASE
          WHEN bb.status = 'borrowed' AND bb.picked_up_at IS NULL THEN 'pending_pickup'
          WHEN bb.status = 'borrowed' AND bb.picked_up_at IS NOT NULL AND bb.due_date < CURRENT_DATE THEN 'overdue'
          WHEN bb.status = 'borrowed' AND bb.picked_up_at IS NOT NULL THEN 'borrowed'
          WHEN bb.status = 'returned' THEN 'returned'
          WHEN bb.status = 'cancelled' THEN 'cancelled'
          ELSE bb.status
        END as display_status,
        CASE
          WHEN bb.return_date IS NULL AND bb.status <> 'returned' AND bb.status <> 'cancelled' THEN 1
          ELSE 0
        END as is_active,
        b.title,
        b.author,
        b.category,
        b.isbn,
        b.status as book_status
      FROM book_borrowings bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.student_id = ?
      ORDER BY COALESCE(bb.return_date, bb.due_date, bb.borrow_date) DESC
    `;

    const borrowings = await db.query(query, [req.params.studentId]);

    // Format the response
    const result = {
      total_borrowed: borrowings.length,
      books: borrowings.map((b) => ({
        borrow_id: b.borrow_id,
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        accession_number: b.accession_number,
        borrow_date: b.borrow_date,
        due_date: b.due_date,
        return_date: b.return_date,
        is_active: Number(b.is_active) === 1,
        status: b.display_status,
      })),
    };

    logger.info('Borrowings fetched for student', { studentId: req.params.studentId, count: borrowings.length });
    response.success(res, result);
  } catch (error) {
    logger.error('Error fetching borrowings', { studentId: req.params.studentId, error: error.message });
    response.error(res, 'Error fetching borrowings', error);
  }
});

// POST /api/book-borrowings/:id/cancel - Student cancels own pending pickup request
router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { userType, userId } = getUserContext(req);
    const borrowingId = req.params.id;

    if (userType !== 'student' || !userId) {
      return response.forbidden(res, 'Only students can cancel borrow requests here');
    }

    const rows = await db.query(
      `SELECT bb.id, bb.student_id, bb.status, bb.picked_up_at, bb.book_id, bb.accession_number,
              b.title AS book_title
       FROM book_borrowings bb
       LEFT JOIN books b ON bb.book_id = b.id
       WHERE bb.id = ?
       LIMIT 1`,
      [borrowingId]
    );

    if (!rows || rows.length === 0) {
      return response.notFound(res, 'Borrowing record not found');
    }

    const record = rows[0];

    if (String(record.student_id) !== String(userId)) {
      logger.warn('Borrow cancel denied - ownership mismatch', { borrowingId, studentId: userId, recordStudentId: record.student_id });
      return response.forbidden(res, 'You can only cancel your own requests');
    }

    if (record.status !== 'borrowed' || record.picked_up_at) {
      return response.validationError(res, 'Only pending pickup requests can be cancelled');
    }

    await db.withTransaction(async (conn) => {
      await conn.queryAsync(
        `UPDATE book_borrowings
         SET status = 'cancelled',
             notes = CONCAT(COALESCE(notes, ''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END, 'Cancelled by student')
         WHERE id = ? AND student_id = ? AND status = 'borrowed' AND picked_up_at IS NULL`,
        [borrowingId, userId]
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

    try {
      const { createNotification } = require('./notifications');
      await createNotification({
        user_type: 'student',
        user_id: record.student_id,
        title: 'Borrow Request Cancelled',
        message: `You cancelled your borrow request for "${record.book_title}".`,
        type: 'SYSTEM',
        related_table: 'book_borrowings',
        related_id: borrowingId,
        book_id: record.book_id,
        book_title: record.book_title,
        borrowing_id: borrowingId,
        status: 'cancelled'
      });
    } catch (notificationError) {
      logger.warn('Borrow request cancelled but notification creation failed', {
        borrowingId,
        studentId: record.student_id,
        error: notificationError.message
      });
    }

    logger.info('Borrow request cancelled by student', { borrowingId, studentId: userId, bookId: record.book_id });
    return response.success(res, null, 'Borrow request cancelled successfully');
  } catch (error) {
    logger.error('Error cancelling borrow request by student', { borrowingId: req.params.id, error: error.message });
    return response.error(res, 'Error cancelling borrow request', error);
  }
});

module.exports = router;

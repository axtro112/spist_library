/**
 * BOOK RETURN WITH CONDITION TRACKING
 * 
 * Handles book returns with copy condition recording
 * Route: POST /api/book-borrowings/return/:borrowingId
 */

const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const response = require('../utils/response');
const logger = require('../utils/logger');
const { sendReturnConfirmationEmail } = require('../utils/mailer');

/**
 * POST /api/book-borrowings/return/:borrowingId
 * Return a borrowed book and record condition
 */
router.post('/return/:borrowingId', requireAdmin, async (req, res) => {
  try {
    const { borrowingId } = req.params;
    const { condition_at_return, notes } = req.body;
    
    // Validation
    const validConditions = ['excellent', 'good', 'fair', 'poor', 'damaged'];
    if (condition_at_return && !validConditions.includes(condition_at_return)) {
      return response.validationError(res, 'Invalid condition value');
    }
    
    await db.beginTransaction();
    
    try {
      // Get borrowing details with student and book info
      const [borrowing] = await db.query(`
        SELECT 
          bb.*,
          bc.accession_number,
          bc.condition_status as original_condition,
          s.email as student_email,
          s.first_name,
          s.last_name,
          b.title as book_title,
          b.author
        FROM book_borrowings bb
        LEFT JOIN book_copies bc ON bb.accession_number = bc.accession_number
        LEFT JOIN students s ON bb.student_id = s.student_id
        LEFT JOIN books b ON bb.book_id = b.id
        WHERE bb.id = ?
      `, [borrowingId]);
      
      if (!borrowing) {
        await db.rollback();
        return response.notFound(res, 'Borrowing record not found');
      }
      
      if (borrowing.status === 'returned') {
        await db.rollback();
        return response.validationError(res, 'This book has already been returned');
      }
      
      const returnCondition = condition_at_return || borrowing.original_condition || 'good';
      
      // Update borrowing record
      await db.query(`
        UPDATE book_borrowings 
        SET 
          status = 'returned',
          return_date = CURRENT_TIMESTAMP,
          copy_condition_at_return = ?,
          returned_by_admin_id = ?,
          notes = CONCAT(COALESCE(notes, ''), '\\nReturn: ', ?)
        WHERE id = ?
      `, [returnCondition, req.session?.user?.id || null, notes || 'Returned in good condition', borrowingId]);
      
      // Update copy status and condition
      if (borrowing.accession_number) {
        await db.query(`
          UPDATE book_copies 
          SET 
            status = 'available',
            condition_status = ?,
            last_checked = CURRENT_DATE
          WHERE accession_number = ?
        `, [returnCondition, borrowing.accession_number]);
        
        // Log to audit trail
        await db.query(`
          INSERT INTO book_copy_audit 
          (accession_number, action, old_value, new_value, performed_by, notes)
          VALUES (?, 'returned', ?, ?, ?, ?)
        `, [
          borrowing.accession_number,
          JSON.stringify({ condition: borrowing.original_condition, status: 'borrowed' }),
          JSON.stringify({ condition: returnCondition, status: 'available' }),
          req.session?.user?.id || null,
          notes || 'Book returned'
        ]);
      }
      
      // Increment available quantity
      await db.query(
        'UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?',
        [borrowing.book_id]
      );
      
      await db.commit();
      
      logger.info('Book returned successfully', { 
        borrowingId, 
        accessionNumber: borrowing.accession_number,
        condition: returnCondition 
      });
      
      // Send return confirmation email asynchronously (don't wait for it)
      if (borrowing.student_email) {
        const studentName = `${borrowing.first_name || ''} ${borrowing.last_name || ''}`.trim() || 'Student';
        sendReturnConfirmationEmail(
          borrowing.student_email,
          studentName,
          borrowing.book_title || 'Unknown Book',
          borrowing.author || '',
          returnCondition,
          notes
        ).catch(err => {
          logger.warn('Failed to send return confirmation email', {
            error: err.message,
            borrowingId,
            studentEmail: borrowing.student_email
          });
        });
      }
      
      response.success(res, {
        accession_number: borrowing.accession_number,
        condition: returnCondition
      }, 'Book returned successfully');
      
    } catch (txError) {
      await db.rollback();
      throw txError;
    }
    
  } catch (error) {
    logger.error('Error returning book', { error: error.message, borrowingId: req.params.borrowingId });
    response.error(res, 'Error returning book', error);
  }
});

module.exports = router;

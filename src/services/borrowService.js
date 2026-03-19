const db = require("../utils/db");
const logger = require("../utils/logger");
const { sendBorrowingClaimEmail } = require("../utils/mailer");

/**
 * Create a borrowing transaction and send claim notification email
 * 
 * This service abstracts the borrowing logic to ensure consistency across:
 * - Single book borrow
 * - Bulk/Quick borrow
 * - Smart borrow
 * 
 * @param {string} studentId - Student ID for the borrower
 * @param {Array<{bookId, quantity}>} borrowItems - Books to borrow
 * @param {Date|string} returnDate - Due date for return
 * @param {Object} options - Optional config
 * @returns {Promise<{success, borrowings, claimExpiresAt, emailStatus}>}
 * 
 * Example:
 *   const result = await createBorrowTransactionAndEmail(
 *     'STD-2024-001',
 *     [{ bookId: 1, quantity: 1 }, { bookId: 2, quantity: 2 }],
 *     '2026-03-10',
 *     { sendEmail: true }
 *   );
 */
async function createBorrowTransactionAndEmail(
  studentId,
  borrowItems,
  returnDate,
  options = {}
) {
  const { sendEmail = true } = options;
  const borrowingRecords = [];

  try {
    // Validation
    if (!studentId || !borrowItems || borrowItems.length === 0 || !returnDate) {
      throw new Error('Missing required parameters: studentId, borrowItems, returnDate');
    }

    // Parse return date
    const returnDateObj = new Date(returnDate);
    if (isNaN(returnDateObj.getTime())) {
      throw new Error('Invalid return date format');
    }

    // Strict pickup window: exactly 24 hours from borrow creation time
    const claimExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Execute within a database transaction
    const results = await db.withTransaction(async (conn) => {
      const borrowings = [];

      for (const item of borrowItems) {
        const { bookId, quantity = 1 } = item;

        // For each copy needed
        for (let i = 0; i < quantity; i++) {
          // Get an available copy
          const availableCopyQuery = `
            SELECT accession_number, condition_status, book_id
            FROM book_copies
            WHERE book_id = ? AND status = 'available'
            ORDER BY copy_number ASC
            LIMIT 1
            FOR UPDATE
          `;
          const availableCopyRows = await conn.queryAsync(availableCopyQuery, [bookId]);

          if (!availableCopyRows || availableCopyRows.length === 0) {
            throw new Error(`No available copies found for book ID ${bookId}`);
          }

          const copy = availableCopyRows[0];
          const accessionNumber = copy.accession_number;
          const copyCondition = copy.condition_status;

          // Insert borrowing record
          const insertBorrowQuery = `
            INSERT INTO book_borrowings (
              book_id,
              student_id,
              accession_number,
              copy_condition_at_borrow,
              borrow_date,
              due_date,
              claim_expires_at,
              status
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'borrowed')
          `;
          const borrowResult = await conn.queryAsync(insertBorrowQuery, [
            bookId,
            studentId,
            accessionNumber,
            copyCondition,
            returnDate,
            claimExpiresAt
          ]);

          // Mark copy as borrowed
          await conn.queryAsync(
            "UPDATE book_copies SET status = 'borrowed' WHERE accession_number = ?",
            [accessionNumber]
          );

          // Decrement available quantity
          const updateBookQuery = `
            UPDATE books
            SET available_quantity = available_quantity - 1
            WHERE id = ? AND available_quantity > 0
          `;
          const updateResult = await conn.queryAsync(updateBookQuery, [bookId]);

          if (updateResult.affectedRows === 0) {
            throw new Error(`Failed to update quantity for book ID ${bookId}`);
          }

          borrowings.push({
            borrowingId: borrowResult.insertId,
            bookId,
            accessionNumber,
            copyCondition,
            dueDate: returnDate
          });
        }
      }

      return borrowings;
    });

    borrowingRecords.push(...results);

    // Log success
    logger.info('Borrowing transaction created', {
      studentId,
      borrowingCount: borrowingRecords.length,
      claimExpiresAt: claimExpiresAt.toISOString()
    });

    // Fetch detailed information for email
    let emailStatus = { success: false, reason: 'Email not sent' };

    if (sendEmail) {
      try {
        // Get student info
        const studentQuery = `SELECT fullname, email FROM students WHERE student_id = ?`;
        const studentRows = await db.query(studentQuery, [studentId]);

        if (!studentRows || studentRows.length === 0) {
          throw new Error('Student not found');
        }

        const student = studentRows[0];
        const { fullname, email } = student;

        // Get detailed book info for all borrowed items
        const borrowingIds = borrowingRecords.map(b => b.borrowingId).join(',');
        const booksQuery = `
          SELECT DISTINCT
            bb.accession_number,
            b.title,
            b.author,
            b.isbn,
            b.category
          FROM book_borrowings bb
          JOIN books b ON bb.book_id = b.id
          WHERE bb.id IN (${borrowingIds})
          ORDER BY bb.id ASC
        `;
        const booksRows = await db.query(booksQuery, []);

        // Format for email
        const borrowedItems = booksRows.map(row => ({
          bookTitle: row.title,
          author: row.author,
          isbn: row.isbn,
          category: row.category,
          accessionNumber: row.accession_number
        }));

        // Send email
        emailStatus = await sendBorrowingClaimEmail(
          email,
          fullname,
          studentId,
          borrowedItems,
          claimExpiresAt
        );

        // Update email_sent_at in database (even if email attempted)
        if (emailStatus.success) {
          await db.query(
            `UPDATE book_borrowings SET email_sent_at = CURRENT_TIMESTAMP WHERE id IN (${borrowingIds})`
          );

          logger.info('Borrowing claim email confirmed sent', {
            studentId,
            borrowings: borrowingRecords.length,
            messageId: emailStatus.messageId
          });
        } else {
          logger.warn('Borrowing claim email send failed (but borrowing succeeded)', {
            studentId,
            borrowings: borrowingRecords.length,
            error: emailStatus.error
          });
        }

      } catch (emailError) {
        logger.error('Email preparation failed', {
          studentId,
          error: emailError.message
        });
        // Don't fail the borrowing transaction if email preparation fails
        emailStatus = { success: false, error: emailError.message };
      }
    }

    return {
      success: true,
      borrowings: borrowingRecords,
      claimExpiresAt,
      emailStatus
    };

  } catch (error) {
    logger.error('Borrowing transaction failed', {
      studentId,
      error: error.message,
      stack: error.stack
    });

    throw error;
  }
}

module.exports = {
  createBorrowTransactionAndEmail
};

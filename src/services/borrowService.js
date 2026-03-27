const db = require("../utils/db");
const logger = require("../utils/logger");
const { sendBorrowingClaimEmail } = require("../utils/mailer");
const {
  buildBorrowingPickupQrValue,
  generateQrCodePngBuffer,
} = require("../utils/accession");

const DEFAULT_STUDENT_EMAIL_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || "spist.edu.ph";

function resolveStudentEmail(studentId, rawEmail) {
  const candidate = String(rawEmail || "").trim().toLowerCase();
  if (candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    return candidate;
  }

  const normalizedStudentId = String(studentId || "")
    .trim()
    .toLowerCase();

  if (!normalizedStudentId) return null;
  return `${normalizedStudentId}@${DEFAULT_STUDENT_EMAIL_DOMAIN}`;
}

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

    let emailStatus = { success: false, reason: 'Email not sent' };

    if (sendEmail) {
      emailStatus = await sendBorrowingClaimEmailForBorrowings(
        studentId,
        borrowingRecords.map((record) => record.borrowingId),
        claimExpiresAt
      );
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

async function sendBorrowingClaimEmailForBorrowings(studentId, borrowingIds, claimExpiresAt) {
  try {
    if (!studentId || !Array.isArray(borrowingIds) || borrowingIds.length === 0 || !claimExpiresAt) {
      throw new Error('Missing required parameters for borrowing claim email');
    }

    const borrowingIdList = borrowingIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (!borrowingIdList.length) {
      throw new Error('No valid borrowing IDs provided');
    }

    const studentQuery = `SELECT fullname, email FROM students WHERE student_id = ?`;
    const studentRows = await db.query(studentQuery, [studentId]);
    if (!studentRows || studentRows.length === 0) {
      throw new Error('Student not found');
    }

    const borrowingIdsSql = borrowingIdList.join(',');
    const booksQuery = `
      SELECT DISTINCT
        bb.id AS borrowing_id,
        bb.accession_number,
        b.title,
        b.author,
        b.isbn,
        b.category
      FROM book_borrowings bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.id IN (${borrowingIdsSql})
      ORDER BY bb.id ASC
    `;
    const booksRows = await db.query(booksQuery, []);

    const borrowedItemsWithQr = await Promise.all(
      booksRows.map(async (row) => {
        const pickupQrValue = buildBorrowingPickupQrValue(row.borrowing_id);
        const pickupQrCid = `pickup-qr-${row.borrowing_id}@spist-library`;
        return {
          borrowingId: row.borrowing_id,
          bookTitle: row.title,
          author: row.author,
          isbn: row.isbn,
          category: row.category,
          accessionNumber: row.accession_number,
          pickupQrValue,
          pickupQrCid,
          pickupQrBuffer: await generateQrCodePngBuffer(pickupQrValue),
        };
      })
    );

    const { fullname, email } = studentRows[0];
    const targetEmail = resolveStudentEmail(studentId, email);

    if (!targetEmail) {
      throw new Error('Unable to resolve student recipient email');
    }

    if (!email || String(email).trim().toLowerCase() !== targetEmail) {
      logger.info('Using dynamic student email fallback', {
        studentId,
        sourceEmail: email || null,
        resolvedEmail: targetEmail,
      });
    }

    const emailStatus = await sendBorrowingClaimEmail(
      targetEmail,
      fullname,
      studentId,
      borrowedItemsWithQr,
      claimExpiresAt
    );

    if (emailStatus.success) {
      await db.query(
        `UPDATE book_borrowings SET email_sent_at = CURRENT_TIMESTAMP WHERE id IN (${borrowingIdsSql})`
      );

      logger.info('Borrowing claim email confirmed sent', {
        studentId,
        borrowings: borrowingIdList.length,
        messageId: emailStatus.messageId,
      });
    } else {
      logger.warn('Borrowing claim email send failed', {
        studentId,
        borrowings: borrowingIdList.length,
        error: emailStatus.error,
      });
    }

    return emailStatus;
  } catch (emailError) {
    logger.error('Email preparation failed', {
      studentId,
      borrowingIds,
      error: emailError.message,
    });

    return { success: false, error: emailError.message };
  }
}

module.exports = {
  createBorrowTransactionAndEmail,
  sendBorrowingClaimEmailForBorrowings,
};

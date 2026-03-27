/**
 * QR Pickup Routes
 * Handles QR code generation, download, and pickup validation
 * 
 * Endpoints:
 * - GET /api/borrowings/:id/qr - Generate and return QR code image
 * - GET /api/borrowings/:id/qr/download - Download QR code as file
 * - POST /api/pickup - Validate token and complete pickup
 */

const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const logger = require('../utils/logger');
const response = require('../utils/response');
const { requireAuth } = require('../middleware/auth');
const { generateQRCodeImage } = require('../utils/qrCodeGenerator');

/**
 * GET /api/borrowings/:id/qr
 * Generate and return QR code as PNG image
 * 
 * Validation:
 * - Borrowing must exist and belong to authenticated user (student) or be accessible to admin
 * - Status must be 'pending_pickup'
 * - Claim must not be expired
 * - QR code is generated on-demand (not stored in DB after first access)
 */
router.get('/borrowings/:id/qr', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userType = req.session.user?.userRole || req.session.userRole;
    const userId = req.session.user?.studentId || req.session.studentId;
    const adminId = req.session.user?.id || req.session.adminId;

    if (!id) {
      return response.validationError(res, 'Borrowing ID is required');
    }

    // Fetch borrowing record
    const borrowings = await db.query(
      'SELECT * FROM book_borrowings WHERE id = ?',
      [id]
    );

    if (borrowings.length === 0) {
      return response.notFound(res, 'Borrowing record not found');
    }

    const borrowing = borrowings[0];

    // Authorization: student can only view own borrowing, admins can view all
    if (userType === 'student' && borrowing.student_id !== userId) {
      return response.forbidden(res, 'You can only view your own QR codes');
    }

    // Validation: status must be pending_pickup
    if (borrowing.status !== 'pending_pickup') {
      return response.validationError(res, `Cannot fetch QR code: status is ${borrowing.status}. Only pending pickup requests have QR codes.`);
    }

    // Validation: claim must not be expired
    const claimExpiry = new Date(borrowing.claim_expires_at).getTime();
    if (Date.now() > claimExpiry) {
      return response.validationError(res, 'Pickup claim has expired. Please request a new borrow.');
    }

    // Generate QR code image containing just the accession_number
    const qrImage = await generateQRCodeImage(borrowing.accession_number, id);

    // Return as PNG image
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.send(qrImage);

    logger.info('QR code served', {
      borrowing_id: id,
      student_id: borrowing.student_id,
      accession_number: borrowing.accession_number,
      accessed_by: userType === 'student' ? userId : `admin-${adminId}`
    });
  } catch (error) {
    logger.error('Error generating QR code', { error: error.message });
    response.error(res, { message: 'Failed to generate QR code', error: error.message }, 500);
  }
});

/**
 * GET /api/borrowings/:id/qr/download
 * Download QR code as downloadable PNG file
 * Same validation as /qr endpoint but forces download
 */
router.get('/borrowings/:id/qr/download', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userType = req.session.user?.userRole || req.session.userRole;
    const userId = req.session.user?.studentId || req.session.studentId;

    if (!id) {
      return response.validationError(res, 'Borrowing ID is required');
    }

    // Fetch borrowing record
    const borrowings = await db.query(
      'SELECT * FROM book_borrowings WHERE id = ?',
      [id]
    );

    if (borrowings.length === 0) {
      return response.notFound(res, 'Borrowing record not found');
    }

    const borrowing = borrowings[0];

    // Authorization
    if (userType === 'student' && borrowing.student_id !== userId) {
      return response.forbidden(res, 'You can only download your own QR codes');
    }

    // Validation
    if (borrowing.status !== 'pending_pickup') {
      return response.validationError(res, `Cannot download QR code: status is ${borrowing.status}`);
    }

    const claimExpiry = new Date(borrowing.claim_expires_at).getTime();
    if (Date.now() > claimExpiry) {
      return response.validationError(res, 'Pickup claim has expired');
    }

    // Generate QR code image containing the accession_number
    const qrImage = await generateQRCodeImage(borrowing.accession_number, id);

    // Return as downloadable file
    const filename = `Pickup-QR-${borrowing.id}-${Date.now()}.png`;
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(qrImage);

    logger.info('QR code downloaded', {
      borrowing_id: id,
      student_id: borrowing.student_id,
      accession_number: borrowing.accession_number,
      filename
    });
  } catch (error) {
    logger.error('Error downloading QR code', { error: error.message });
    response.error(res, { message: 'Failed to download QR code', error: error.message }, 500);
  }
});

/**
 * POST /api/pickup
 * Validate scanned accession number and complete pickup
 *
 * Request body: { accession_number: "ACC-2026-00322" }
 *
 * Flow:
 * 1. Find latest pending_pickup record for accession_number
 * 2. Validate claim_expires_at > NOW
 * 3. Update status = 'borrowed', picked_up_at = NOW
 * 4. Update book_copy status = 'borrowed'
 */
router.post('/pickup', async (req, res) => {
  try {
    const { accession_number } = req.body;

    if (!accession_number) {
      return response.validationError(res, 'accession_number is required');
    }

    // Find the latest pending_pickup borrowing for this copy
    const borrowings = await db.query(
      `SELECT bb.*,
              s.fullname AS student_name,
              b.title AS book_title,
              b.author AS book_author,
              b.category AS book_category
       FROM book_borrowings bb
       LEFT JOIN students s
         ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
       LEFT JOIN books b ON bb.book_id = b.id
       WHERE bb.accession_number = ?
         AND bb.status = 'pending_pickup'
       ORDER BY bb.borrow_date DESC
       LIMIT 1`,
      [accession_number]
    );

    if (!borrowings || borrowings.length === 0) {
      return response.validationError(res, 'No pending pickup request found for this book copy. It may have already been picked up, cancelled, or expired.');
    }

    const borrowing = borrowings[0];

    // Validate: not expired
    if (borrowing.claim_expires_at && new Date() > new Date(borrowing.claim_expires_at)) {
      return response.validationError(res, 'Pickup claim has expired. The book copy has been released back to inventory.');
    }

    // Atomic pickup confirmation
    await db.withTransaction(async (conn) => {
      const updateResult = await conn.queryAsync(
        `UPDATE book_borrowings
         SET status = 'borrowed',
             picked_up_at = NOW(),
             qr_scanned_at = NOW()
         WHERE id = ? AND status = 'pending_pickup'`,
        [borrowing.id]
      );

      if (!updateResult || updateResult.affectedRows === 0) {
        throw new Error('Pickup already processed or status changed');
      }

      await conn.queryAsync(
        "UPDATE book_copies SET status = 'borrowed' WHERE accession_number = ?",
        [accession_number]
      );
    });

    const pickedUpAt = new Date().toISOString();

    logger.info('Book pickup completed via QR scan', {
      borrowing_id: borrowing.id,
      student_id: borrowing.student_id,
      accession_number,
      timestamp: pickedUpAt
    });

    response.success(res, {
      borrowing: {
        id: borrowing.id,
        student_name: borrowing.student_name || borrowing.student_id,
        picked_up_at: pickedUpAt,
        accession_number,
        due_date: borrowing.due_date,
        status: 'borrowed'
      },
      book: {
        title: borrowing.book_title || 'N/A',
        author: borrowing.book_author || 'N/A',
        accession_number,
        category: borrowing.book_category || 'N/A'
      }
    }, 'Pickup successful! Book is now checked out.');
  } catch (error) {
    logger.error('Pickup validation error', { error: error.message });
    response.error(res, { message: error.message || 'Pickup failed' }, 500);
  }
});

module.exports = router;

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
const { generateQRToken } = require('../utils/qrToken');
const { generateQRCodeImage, generateQRCodeDataUrl } = require('../utils/qrCodeGenerator');
const { validateQRToken, checkPickupEligibility } = require('../utils/qrToken');

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

    // Generate QR token (create if doesn't exist, or regenerate)
    let qrToken = borrowing.qr_token;
    if (!qrToken) {
      qrToken = generateQRToken(borrowing);
      // Store token in database for future reference
      await db.query(
        'UPDATE book_borrowings SET qr_token = ?, qr_generated_at = NOW() WHERE id = ?',
        [qrToken, id]
      );
    }

    // Generate QR code image
    const qrImage = await generateQRCodeImage(qrToken, id);

    // Return as PNG image
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.send(qrImage);

    logger.info('QR code served', {
      borrowing_id: id,
      student_id: borrowing.student_id,
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

    // Generate or use existing token
    let qrToken = borrowing.qr_token;
    if (!qrToken) {
      qrToken = generateQRToken(borrowing);
      await db.query(
        'UPDATE book_borrowings SET qr_token = ?, qr_generated_at = NOW() WHERE id = ?',
        [qrToken, id]
      );
    }

    // Generate QR code image
    const qrImage = await generateQRCodeImage(qrToken, id);

    // Return as downloadable file
    const filename = `Pickup-QR-${borrowing.id}-${Date.now()}.png`;
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(qrImage);

    logger.info('QR code downloaded', {
      borrowing_id: id,
      student_id: borrowing.student_id,
      filename
    });
  } catch (error) {
    logger.error('Error downloading QR code', { error: error.message });
    response.error(res, { message: 'Failed to download QR code', error: error.message }, 500);
  }
});

/**
 * POST /api/pickup
 * Validate QR token and complete pickup process
 * 
 * Request body:
 * {
 *   token: "jwt_token_from_qr_scan"
 * }
 * 
 * Response:
 * - 200 OK: Pickup successful, borrowing status updated to 'borrowed', book copy marked 'borrowed'
 * - 400 Bad Request: Invalid/expired token or validation failed
 * - 409 Conflict: Borrowing already picked up or expired
 */
router.post('/pickup', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return response.validationError(res, 'QR token is required');
    }

    // Decode and validate token
    let decoded;
    try {
      decoded = validateQRToken(token);
    } catch (error) {
      return response.validationError(res, error.message);
    }

    const borrowingId = decoded.borrowing_id;

    // Fetch borrowing record
    const borrowings = await db.query(
      'SELECT * FROM book_borrowings WHERE id = ?',
      [borrowingId]
    );

    if (borrowings.length === 0) {
      return response.notFound(res, 'Borrowing record not found');
    }

    const borrowing = borrowings[0];

    // Check pickup eligibility
    const eligibility = checkPickupEligibility(decoded, borrowing);
    if (!eligibility.valid) {
      return response.validationError(res, eligibility.reason);
    }

    // Use transaction for atomic pickup
    const result = await db.withTransaction(async (conn) => {
      // Update borrowing status to 'borrowed' and record pickup
      const updateBorrowing = await conn.queryAsync(
        `UPDATE book_borrowings 
         SET status = 'borrowed', 
             picked_up_at = NOW(),
             qr_scanned_at = NOW()
         WHERE id = ? AND status = 'pending_pickup'`,
        [borrowingId]
      );

      if (!updateBorrowing || updateBorrowing.affectedRows === 0) {
        throw new Error('Pickup failed: Borrowing already processed or status changed');
      }

      // Update book copy status to 'borrowed'
      if (borrowing.accession_number) {
        const updateCopy = await conn.queryAsync(
          "UPDATE book_copies SET status = 'borrowed' WHERE accession_number = ?",
          [borrowing.accession_number]
        );
      }

      return { success: true, borrowingId };
    });

    logger.info('Book pickup completed', {
      borrowing_id: borrowingId,
      student_id: borrowing.student_id,
      accession_number: borrowing.accession_number,
      timestamp: new Date().toISOString()
    });

    response.success(res, {
      message: 'Pickup successful! Book is now available in your borrowed items.',
      borrowing_id: borrowingId,
      status: 'borrowed',
      picked_up_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Pickup validation error', { error: error.message });
    response.error(res, { message: 'Pickup failed', error: error.message }, 500);
  }
});

module.exports = router;

/**
 * QR Token Utility
 * Generates and validates secure JWT tokens for contactless book pickup
 * 
 * Token contains:
 * - borrowing_id: Unique borrowing record ID
 * - student_id: Student ID claiming the book
 * - book_id: Book ID being borrowed
 * - accession_number: Specific book copy
 * - claim_expires_at: Pickup deadline (Unix timestamp)
 * - iat: Token issued time
 * - exp: Token expiration (same as claim_expires_at + grace period)
 */

const jwt = require('jsonwebtoken');
const logger = require('./logger');

const QR_TOKEN_ALGORITHM = 'HS256';
const QR_TOKEN_GRACE_PERIOD_MINUTES = 5; // Allow 5 min scan after claim expiry for grace

/**
 * Generate secure QR token for a borrowing record
 * @param {Object} borrowing - Borrowing record from database
 * @param {number} borrowing.id - Borrowing ID
 * @param {string} borrowing.student_id - Student ID
 * @param {number} borrowing.book_id - Book ID
 * @param {string} borrowing.accession_number - Book copy accession number
 * @param {Date|string} borrowing.claim_expires_at - Claim expiration datetime
 * @returns {string} Signed JWT token
 */
function generateQRToken(borrowing) {
  if (!borrowing || !borrowing.id || !borrowing.student_id || !borrowing.claim_expires_at) {
    throw new Error('Invalid borrowing data for QR token generation');
  }

  const claimExpiryTime = new Date(borrowing.claim_expires_at).getTime();
  if (isNaN(claimExpiryTime)) {
    throw new Error('Invalid claim_expires_at timestamp');
  }

  const payload = {
    borrowing_id: borrowing.id,
    student_id: borrowing.student_id,
    book_id: borrowing.book_id || null,
    accession_number: borrowing.accession_number || null,
    claim_expires_at: Math.floor(claimExpiryTime / 1000), // Convert to Unix timestamp (seconds)
  };

  // Token expires at claim_expires_at + grace period
  const expiresIn = Math.ceil((claimExpiryTime + (QR_TOKEN_GRACE_PERIOD_MINUTES * 60 * 1000) - Date.now()) / 1000);

  try {
    const token = jwt.sign(payload, process.env.QR_TOKEN_SECRET || 'qr-secret-default', {
      algorithm: QR_TOKEN_ALGORITHM,
      expiresIn: Math.max(expiresIn, 60), // At least 60 seconds
      issuer: 'spist-library',
      audience: 'qr-pickup'
    });

    logger.debug('QR token generated', {
      borrowing_id: borrowing.id,
      student_id: borrowing.student_id,
      expires_in_seconds: Math.max(expiresIn, 60)
    });

    return token;
  } catch (error) {
    logger.error('QR token generation failed', {
      borrowing_id: borrowing.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Validate and decode QR token
 * @param {string} token - JWT token from QR scan
 * @returns {Object} Decoded payload: {borrowing_id, student_id, book_id, accession_number, claim_expires_at}
 * @throws {Error} If token is invalid, expired, or signature doesn't match
 */
function validateQRToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.QR_TOKEN_SECRET || 'qr-secret-default', {
      algorithms: [QR_TOKEN_ALGORITHM],
      issuer: 'spist-library',
      audience: 'qr-pickup'
    });

    logger.debug('QR token validated', {
      borrowing_id: decoded.borrowing_id,
      student_id: decoded.student_id
    });

    return decoded;
  } catch (error) {
    const errorType = error.name || 'UnknownError';
    logger.warn('QR token validation failed', {
      token_preview: token.substring(0, 20) + '...',
      error_type: errorType,
      error_message: error.message
    });

    if (error.name === 'TokenExpiredError') {
      throw new Error('QR code has expired. Please request a new pickup claim.');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid QR code. Please scan a valid QR code.');
    } else {
      throw new Error('QR code validation failed. Please try again.');
    }
  }
}

/**
 * Check if token and borrowing record are still valid for pickup
 * @param {Object} decoded - Decoded token from validateQRToken()
 * @param {Object} borrowing - Current borrowing record from database
 * @returns {Object} {valid: boolean, reason: string}
 */
function checkPickupEligibility(decoded, borrowing) {
  // Check status
  if (borrowing.status !== 'pending_pickup') {
    return {
      valid: false,
      reason: `Book cannot be picked up: status is ${borrowing.status}. Only pending pickup requests can be scanned.`
    };
  }

  // Check claim hasn't expired in database (token exp is separate)
  const claimExpiry = new Date(borrowing.claim_expires_at).getTime();
  if (Date.now() > claimExpiry + (QR_TOKEN_GRACE_PERIOD_MINUTES * 60 * 1000)) {
    return {
      valid: false,
      reason: 'Pickup claim has expired. Please request a new borrow.'
    };
  }

  // Check token matches borrowing
  if (decoded.borrowing_id !== borrowing.id) {
    return {
      valid: false,
      reason: 'QR code does not match this borrowing request.'
    };
  }

  if (decoded.student_id !== borrowing.student_id) {
    return {
      valid: false,
      reason: 'QR code student ID does not match the borrowing student.'
    };
  }

  // All checks passed
  return {
    valid: true,
    reason: 'Eligible for pickup'
  };
}

module.exports = {
  generateQRToken,
  validateQRToken,
  checkPickupEligibility,
  QR_TOKEN_ALGORITHM,
  QR_TOKEN_GRACE_PERIOD_MINUTES
};

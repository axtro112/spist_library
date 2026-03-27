/**
 * BOOK COPIES ROUTES (Accession Number System)
 * 
 * Handles individual book copy management with accession numbers
 * Routes: /api/book-copies/*
 */

const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const response = require('../utils/response');
const logger = require('../utils/logger');
const {
  getNextAccessionNumber,
  generateQrCodeDataUrl,
  generateQrCodePngBuffer,
  getQrCodeImagePath,
} = require('../utils/accession');

/**
 * GET /api/book-copies/qr/:accessionNumber
 * Render PNG QR code for a copy accession number
 */
router.get('/qr/:accessionNumber', requireAuth, async (req, res) => {
  try {
    const { accessionNumber } = req.params;
    const qrPng = await generateQrCodePngBuffer(accessionNumber);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(qrPng);
  } catch (error) {
    logger.error('Error generating QR code image', {
      error: error.message,
      accessionNumber: req.params.accessionNumber,
    });
    return response.error(res, 'Failed to generate QR code image', error);
  }
});

/**
 * GET /api/book-copies/:bookId
 * Get all copies of a specific book
 */
router.get('/:bookId', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const query = `
      SELECT 
        bc.*,
        b.title,
        b.author,
        b.isbn,
        bb.student_id,
        bb.due_date,
        s.fullname as borrowed_by
      FROM book_copies bc
      LEFT JOIN books b ON bc.book_id = b.id
      LEFT JOIN book_borrowings bb
        ON bc.accession_number COLLATE utf8mb4_unicode_ci = bb.accession_number COLLATE utf8mb4_unicode_ci
        AND bb.status IN ('borrowed', 'overdue') 
        AND bb.return_date IS NULL
      LEFT JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      WHERE bc.book_id = ?
      ORDER BY bc.copy_number ASC
    `;
    
    const copies = await db.query(query, [bookId]);
    
    logger.info('Book copies fetched', { bookId, count: copies.length });
    response.success(res, copies);
    
  } catch (error) {
    logger.error('Error fetching book copies', { error: error.message, bookId: req.params.bookId });
    response.error(res, 'Error fetching book copies', error);
  }
});

/**
 * GET /api/book-copies/accession/:accessionNumber
 * Get specific copy by accession number
 */
router.get('/accession/:accessionNumber', requireAuth, async (req, res) => {
  try {
    const { accessionNumber } = req.params;
    
    const query = `
      SELECT 
        bc.*,
        b.title,
        b.author,
        b.isbn,
        b.category,
        bb.id as borrowing_id,
        bb.student_id,
        bb.borrow_date,
        bb.due_date,
        bb.copy_condition_at_borrow,
        s.fullname as borrowed_by,
        s.email as borrower_email
      FROM book_copies bc
      INNER JOIN books b ON bc.book_id = b.id
      LEFT JOIN book_borrowings bb
        ON bc.accession_number COLLATE utf8mb4_unicode_ci = bb.accession_number COLLATE utf8mb4_unicode_ci
        AND bb.status IN ('borrowed', 'overdue') 
        AND bb.return_date IS NULL
      LEFT JOIN students s
        ON bb.student_id COLLATE utf8mb4_unicode_ci = s.student_id COLLATE utf8mb4_unicode_ci
      WHERE bc.accession_number = ?
    `;
    
    const [copy] = await db.query(query, [accessionNumber]);
    
    if (!copy) {
      return response.notFound(res, `Copy ${accessionNumber} not found`);
    }
    
    logger.info('Book copy fetched by accession', { accessionNumber });
    response.success(res, copy);
    
  } catch (error) {
    logger.error('Error fetching copy by accession', { error: error.message, accessionNumber: req.params.accessionNumber });
    response.error(res, 'Error fetching copy', error);
  }
});

/**
 * POST /api/book-copies
 * Add new copy to existing book
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { book_id, condition_status, location, notes } = req.body;
    
    if (!book_id) {
      return response.validationError(res, 'Book ID is required');
    }
    
    let accessionNumber, copyNumber;

    await db.withTransaction(async (conn) => {
      // Generate accession number from yearly sequence with row lock
      accessionNumber = await getNextAccessionNumber(conn);

      // Get next copy number for this book
      const maxCopyRows = await conn.queryAsync(
        'SELECT COALESCE(MAX(copy_number), 0) as max_copy FROM book_copies WHERE book_id = ?',
        [book_id]
      );
      copyNumber = maxCopyRows[0].max_copy + 1;

      await conn.queryAsync(`
        INSERT INTO book_copies 
        (accession_number, book_id, copy_number, condition_status, location, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, 'available')
      `, [
        accessionNumber,
        book_id,
        copyNumber,
        condition_status || 'excellent',
        location || 'Main Library',
        notes
      ]);

      await conn.queryAsync(
        'UPDATE books SET quantity = quantity + 1, available_quantity = available_quantity + 1 WHERE id = ?',
        [book_id]
      );

      await conn.queryAsync(
        `INSERT INTO book_copy_audit (accession_number, action, new_value, performed_by, notes)
         VALUES (?, 'created', ?, ?, ?)`,
        [
          accessionNumber,
          JSON.stringify({ condition_status: condition_status || 'excellent', location: location || 'Main Library' }),
          req.session?.user?.id || req.session?.adminId || null,
          'Copy created via Add Copy',
        ]
      );
    });

    const qrCodeDataUrl = await generateQrCodeDataUrl(accessionNumber);
    const qrCodeImageUrl = getQrCodeImagePath(accessionNumber);

    logger.info('New book copy created', { accessionNumber, bookId: book_id, copyNumber });
    response.success(
      res,
      {
        accession_number: accessionNumber,
        copy_number: copyNumber,
        qr_code_data_url: qrCodeDataUrl,
        qr_code_image_url: qrCodeImageUrl,
      },
      'Copy added successfully'
    );
    
  } catch (error) {
    logger.error('Error creating book copy', { error: error.message });
    response.error(res, 'Error creating book copy', error);
  }
});

/**
 * PUT /api/book-copies/:accessionNumber
 * Update copy details (condition, location, notes)
 */
router.put('/:accessionNumber', requireAdmin, async (req, res) => {
  try {
    const { accessionNumber } = req.params;
    const { condition_status, location, notes, status } = req.body;
    
    // Get current state for audit
    const [currentCopy] = await db.query(
      'SELECT * FROM book_copies WHERE accession_number = ?',
      [accessionNumber]
    );
    
    if (!currentCopy) {
      return response.notFound(res, `Copy ${accessionNumber} not found`);
    }
    
    const updates = [];
    const params = [];
    
    if (condition_status) {
      updates.push('condition_status = ?');
      params.push(condition_status);
    }
    if (location) {
      updates.push('location = ?');
      params.push(location);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    
    updates.push('last_checked = CURRENT_DATE');
    params.push(accessionNumber);
    
    await db.query(
      `UPDATE book_copies SET ${updates.join(', ')} WHERE accession_number = ?`,
      params
    );
    
    // Log audit trail
    await db.query(`
      INSERT INTO book_copy_audit (accession_number, action, old_value, new_value, performed_by)
      VALUES (?, 'condition_changed', ?, ?, ?)
    `, [
      accessionNumber,
      JSON.stringify({ condition: currentCopy.condition_status, location: currentCopy.location }),
      JSON.stringify({ condition: condition_status, location }),
      req.session?.user?.id || null
    ]);
    
    logger.info('Book copy updated', { accessionNumber, updates: req.body });
    response.success(res, null, 'Copy updated successfully');
    
  } catch (error) {
    logger.error('Error updating book copy', { error: error.message, accessionNumber: req.params.accessionNumber });
    response.error(res, 'Error updating book copy', error);
  }
});

/**
 * GET /api/book-copies/audit/:accessionNumber
 * Get audit history for a copy
 */
router.get('/audit/:accessionNumber', requireAdmin, async (req, res) => {
  try {
    const { accessionNumber } = req.params;
    
    const query = `
      SELECT 
        bca.*,
        a.fullname as performed_by_name
      FROM book_copy_audit bca
      LEFT JOIN admins a ON bca.performed_by = a.id
      WHERE bca.accession_number = ?
      ORDER BY bca.performed_at DESC
      LIMIT 50
    `;
    
    const audit = await db.query(query, [accessionNumber]);
    
    logger.info('Copy audit fetched', { accessionNumber, records: audit.length });
    response.success(res, audit);
    
  } catch (error) {
    logger.error('Error fetching copy audit', { error: error.message });
    response.error(res, 'Error fetching audit history', error);
  }
});

module.exports = router;

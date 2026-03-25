const QRCode = require('qrcode');

/**
 * Generates the next accession number in a transaction-safe way.
 * Format: ACC-YYYY-00001
 */
async function getNextAccessionNumber(conn) {
  const year = new Date().getFullYear();

  await conn.queryAsync(
    `INSERT INTO accession_sequence (year, last_sequence)
     VALUES (?, 0)
     ON DUPLICATE KEY UPDATE year = VALUES(year)`,
    [year]
  );

  const rows = await conn.queryAsync(
    'SELECT last_sequence FROM accession_sequence WHERE year = ? FOR UPDATE',
    [year]
  );

  const nextSequence = (rows[0]?.last_sequence || 0) + 1;

  await conn.queryAsync(
    'UPDATE accession_sequence SET last_sequence = ? WHERE year = ?',
    [nextSequence, year]
  );

  return `ACC-${year}-${String(nextSequence).padStart(5, '0')}`;
}

function getDefaultCopyStatus(bookStatus) {
  const normalizedStatus = String(bookStatus || '').trim().toLowerCase();

  if (normalizedStatus === 'maintenance') {
    return 'maintenance';
  }

  if (normalizedStatus === 'retired') {
    return 'retired';
  }

  return 'available';
}

async function ensureBookCopyCoverage(conn, options = {}) {
  const {
    bookId,
    quantity,
    bookStatus,
    performedBy = null,
    source = 'inventory_sync',
  } = options;

  const targetQuantity = Math.max(0, Number.parseInt(quantity, 10) || 0);

  if (!bookId || targetQuantity <= 0) {
    return {
      created: 0,
      copies: [],
    };
  }

  const copyStatus = getDefaultCopyStatus(bookStatus);
  const coverageRows = await conn.queryAsync(
    `SELECT COUNT(*) AS copy_count, COALESCE(MAX(copy_number), 0) AS max_copy_number
       FROM book_copies
      WHERE book_id = ?
      FOR UPDATE`,
    [bookId]
  );

  const existingCopyCount = Number(coverageRows[0]?.copy_count || 0);
  let nextCopyNumber = Number(coverageRows[0]?.max_copy_number || 0);
  const missingCopyCount = Math.max(0, targetQuantity - existingCopyCount);
  const createdCopies = [];

  for (let index = 0; index < missingCopyCount; index += 1) {
    nextCopyNumber += 1;
    const accessionNumber = await getNextAccessionNumber(conn);

    await conn.queryAsync(
      `INSERT INTO book_copies
         (accession_number, book_id, copy_number, condition_status, location, status)
       VALUES (?, ?, ?, 'excellent', 'Main Library', ?)`,
      [accessionNumber, bookId, nextCopyNumber, copyStatus]
    );

    await conn.queryAsync(
      `INSERT INTO book_copy_audit (accession_number, action, new_value, performed_by, notes)
       VALUES (?, 'created', ?, ?, ?)`,
      [
        accessionNumber,
        JSON.stringify({ source, status: copyStatus, auto_created: true }),
        performedBy,
        `Copy auto-created from ${source}`,
      ]
    );

    createdCopies.push({
      accession_number: accessionNumber,
      copy_number: nextCopyNumber,
    });
  }

  return {
    created: createdCopies.length,
    copies: createdCopies,
  };
}

async function generateQrCodeDataUrl(value) {
  return QRCode.toDataURL(String(value), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 220,
  });
}

async function generateQrCodePngBuffer(value) {
  return QRCode.toBuffer(String(value), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
  });
}

function buildBorrowingPickupQrValue(borrowingId) {
  return `SPIST-BORROW:${String(borrowingId).trim()}`;
}

function getQrCodeImagePath(accessionNumber) {
  return `/api/book-copies/qr/${encodeURIComponent(accessionNumber)}`;
}

module.exports = {
  ensureBookCopyCoverage,
  getNextAccessionNumber,
  generateQrCodeDataUrl,
  generateQrCodePngBuffer,
  buildBorrowingPickupQrValue,
  getQrCodeImagePath,
};

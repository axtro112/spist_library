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

function getQrCodeImagePath(accessionNumber) {
  return `/api/book-copies/qr/${encodeURIComponent(accessionNumber)}`;
}

module.exports = {
  getNextAccessionNumber,
  generateQrCodeDataUrl,
  generateQrCodePngBuffer,
  getQrCodeImagePath,
};

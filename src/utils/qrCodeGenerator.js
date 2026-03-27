/**
 * QR Code Generation Utility
 * Generates QR code images containing secure tokens for contactless pickup
 * 
 * QR codes are generated on-demand (not stored in DB)
 * Token is embedded in the QR code itself
 */

const QRCode = require('qrcode');
const logger = require('./logger');

/**
 * Generate QR code as PNG buffer
 * QR contains the accession number for SMTP-independent in-app pickup
 * @param {string} accessionNumber - Book copy accession number
 * @param {number} borrowingId - Borrowing record ID (for reference)
 * @param {Object} options - Optional QR code options
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateQRCodeImage(accessionNumber, borrowingId, options = {}) {
  try {
    if (!accessionNumber) {
      throw new Error('Accession number is required');
    }

    // QR content: plain accession number — scanned directly by the admin terminal
    const pickupUrl = accessionNumber;

    // QR code options
    const qrOptions = {
      errorCorrectionLevel: 'H', // High error correction
      type: 'image/png',
      width: options.width || 300, // Default 300x300 pixels
      margin: options.margin || 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      ...options
    };

    logger.debug('Generating QR code', {
      borrowing_id: borrowingId,
      url_length: pickupUrl.length
    });

    const imageBuffer = await QRCode.toBuffer(pickupUrl, qrOptions);

    logger.debug('QR code generated successfully', {
      borrowing_id: borrowingId,
      buffer_size: imageBuffer.length
    });

    return imageBuffer;
  } catch (error) {
    logger.error('QR code generation failed', {
      borrowing_id: borrowingId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Generate QR code as data URL (base64 encoded)
 * Useful for embedding in HTML without file download
 * @param {string} qrToken - Secure QR token
 * @param {number} borrowingId - Borrowing record ID
 * @returns {Promise<string>} Data URL: data:image/png;base64,...
 */
async function generateQRCodeDataUrl(accessionNumber, borrowingId, options = {}) {
  try {
    const pickupUrl = accessionNumber;

    const qrOptions = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: options.width || 300,
      margin: options.margin || 2,
      ...options
    };

    const dataUrl = await QRCode.toDataURL(pickupUrl, qrOptions);
    return dataUrl;
  } catch (error) {
    logger.error('QR code data URL generation failed', {
      borrowing_id: borrowingId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Generate QR code as SVG string
 * Scalable, lightweight alternative to PNG
 * @param {string} qrToken - Secure QR token
 * @param {number} borrowingId - Borrowing record ID
 * @returns {Promise<string>} SVG XML string
 */
async function generateQRCodeSVG(accessionNumber, borrowingId, options = {}) {
  try {
    const pickupUrl = accessionNumber;

    const qrOptions = {
      errorCorrectionLevel: 'H',
      type: 'image/svg+xml',
      width: options.width || 300,
      margin: options.margin || 2,
      ...options
    };

    const svgString = await QRCode.toString(pickupUrl, qrOptions);
    return svgString;
  } catch (error) {
    logger.error('QR code SVG generation failed', {
      borrowing_id: borrowingId,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  generateQRCodeImage,
  generateQRCodeDataUrl,
  generateQRCodeSVG
};

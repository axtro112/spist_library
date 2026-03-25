const nodemailer = require("nodemailer");
const logger = require("./logger");
require("dotenv").config();

/**
 * Email Transporter Configuration
 * Supports multiple SMTP providers via environment variables
 */

// Build config from environment - supports both generic and Gmail-specific vars
const emailConfig = {
  // Generic SMTP config (preferred for production)
  host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
  port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587),
  secure: (process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true') ? true : false,
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASSWORD,
  },
};

const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@spistlibrary.edu.ph';

// Validate email config
if (!emailConfig.auth.user || !emailConfig.auth.pass) {
  logger.warn('Email not configured. Borrowing notifications will be unavailable.', {
    hasUser: !!emailConfig.auth.user,
    hasPass: !!emailConfig.auth.pass
  });
}

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Test connection on startup (non-blocking)
if (emailConfig.auth.user && emailConfig.auth.pass) {
  transporter.verify((error, success) => {
    if (error) {
      logger.warn('Email transporter verification failed', { error: error.message });
    } else {
      logger.info('Email transporter ready', { from: fromEmail });
    }
  });
}

/**
 * Send borrowing claim notification email
 * 
 * @param {string} studentEmail - Student email address
 * @param {string} studentName - Student full name
 * @param {string} studentId - Student ID
 * @param {Array<Object>} borrowedItems - Array of { bookTitle, author, isbn, category, accessionNumber }
 * @param {Date} claimExpiresAt - Exact expiration timestamp (borrow_date + 24 hours)
 * @returns {Promise<Object>} { success, messageId, error }
 */
async function sendBorrowingClaimEmail(
  studentEmail,
  studentName,
  studentId,
  borrowedItems,
  claimExpiresAt
) {
  try {
    // Validate inputs
    if (!studentEmail || !studentName || !borrowedItems || borrowedItems.length === 0) {
      throw new Error('Missing required email parameters');
    }

    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      logger.warn('Email not configured. Skipping email send.', {
        studentId,
        studentEmail,
        itemCount: borrowedItems.length
      });
      return { success: false, error: 'Email not configured' };
    }

    // Format expiration time
    const expirationFormatted = claimExpiresAt.toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Build HTML table for borrowed items
    let itemsTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
        <thead>
          <tr style="background-color: #f5f5f5; border-bottom: 2px solid #4caf50;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Title</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Author</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">ISBN</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Category</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Accession No.</th>
          </tr>
        </thead>
        <tbody>
    `;

    borrowedItems.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
      itemsTableHtml += `
        <tr style="background-color: ${bgColor}; border-bottom: 1px solid #ddd;">
          <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(item.bookTitle || 'N/A')}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(item.author || 'N/A')}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(item.isbn || 'N/A')}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(item.category || 'N/A')}</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #4caf50;">${escapeHtml(item.accessionNumber || 'N/A')}</td>
        </tr>
      `;
    });

    itemsTableHtml += `
        </tbody>
      </table>
    `;

    const qrBlocksHtml = borrowedItems.map((item) => `
      <div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin: 16px 0; background-color: #ffffff;">
        <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 6px;">${escapeHtml(item.bookTitle || 'Borrowed Book')}</div>
        <div style="font-size: 12px; color: #4b5563; margin-bottom: 10px;">Present this QR code at the library counter to confirm pickup for borrowing record ${escapeHtml(item.borrowingId || 'N/A')}.</div>
        ${item.pickupQrCid ? `<img src="cid:${item.pickupQrCid}" alt="Pickup QR for borrowing ${escapeHtml(item.borrowingId || '')}" style="display:block; width:220px; max-width:100%; height:auto; margin:0 auto 10px;">` : ''}
        <div style="font-size: 12px; color: #4b5563; text-align: center; margin-bottom: 8px;">If the QR preview is hidden in Gmail, open the attached PNG file for this borrowing.</div>
        <div style="font-size: 12px; color: #374151; text-align: center; word-break: break-word;">${escapeHtml(item.pickupQrValue || '')}</div>
      </div>
    `).join('');

    const attachments = borrowedItems
      .filter((item) => item.pickupQrBuffer && item.pickupQrCid)
      .flatMap((item) => ([
        {
          filename: `pickup-qr-${item.borrowingId || 'borrowing'}-inline.png`,
          content: item.pickupQrBuffer,
          contentType: 'image/png',
          cid: item.pickupQrCid,
          contentDisposition: 'inline',
        },
        {
          filename: `pickup-qr-${item.borrowingId || 'borrowing'}.png`,
          content: item.pickupQrBuffer,
          contentType: 'image/png',
          contentDisposition: 'attachment',
        }
      ]));

    // Build HTML email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4caf50; color: white; padding: 20px; border-radius: 5px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
            .info-box { background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 15px 0; border-radius: 3px; }
            .message-box { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0; border-radius: 3px; }
            .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; border-top: 1px solid #ddd; }
            strong { color: #4caf50; }
            .highlight { background-color: #ffffcc; padding: 2px 4px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>SPIST LIBRARY - BORROWING NOTIFICATION</h2>
            </div>

            <div class="content">
              <p>Good day, <strong>${escapeHtml(studentName)}!</strong></p>

              <p>This is to inform you that you have <span class="highlight">24 hours</span> remaining to claim the books you borrowed.</p>

              <div class="info-box">
                <strong>Borrowed Books Details:</strong>
                ${itemsTableHtml}
              </div>

              <div class="info-box">
                <strong>Claim Deadline:</strong><br>
                ${expirationFormatted} (Asia/Manila Time)<br>
                <small>Late claims will be automatically cancelled.</small>
              </div>

              <div class="info-box">
                <strong>Pickup QR Codes:</strong><br>
                Scan or present the matching QR code below when claiming each borrowed copy.
                ${qrBlocksHtml}
              </div>

              <div class="message-box">
                <strong>Gmail Notice:</strong><br>
                If the QR image does not appear in Gmail web or the Gmail mobile app, download and open the attached PNG file for the matching borrowing record.
              </div>

              <div class="message-box">
                <strong>Where to Claim:</strong><br>
                Please proceed to the <strong>Library – Imus City, Cavite (Anabu Main Campus)</strong> within the given time to claim your books.<br><br>
                Failure to do so will result in the cancellation of your borrowing request.
              </div>

              <p><strong>Questions?</strong> Kindly contact the library staff for assistance.</p>

              <p style="margin-top: 30px; color: #666;">
                Thank you for using SPIST Library Management System!
              </p>
            </div>

            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; 2026 Southern Philippines Institute of Science &amp; Technology Library</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text fallback
    const textContent = `
SPIST LIBRARY - BORROWING NOTIFICATION

Good day, ${studentName}!

This is to inform you that you have 24 hours remaining to claim the books you borrowed.

BORROWED BOOKS:
${borrowedItems.map((item, idx) => 
  `${idx + 1}. "${item.bookTitle}" by ${item.author}\n   ISBN: ${item.isbn} | Category: ${item.category}\n   Accession No: ${item.accessionNumber}\n   Pickup QR: ${item.pickupQrValue || 'N/A'}`
).join('\n\n')}

CLAIM DEADLINE:
${expirationFormatted} (Asia/Manila Time)

WHERE TO CLAIM:
Please proceed to the Library – Imus City, Cavite (Anabu Main Campus) within the given time to claim your books.
Failure to do so will result in the cancellation of your borrowing request.

If Gmail does not show the QR image inline, open the attached PNG file for each borrowing.

If you have any questions, kindly contact the library staff.

Thank you for using SPIST Library Management System!
---
This is an automated email. Please do not reply to this message.
© 2026 Southern Philippines Institute of Science & Technology Library
    `;

    // Send email
    const mailOptions = {
      from: `"SPIST Library" <${fromEmail}>`,
      to: studentEmail,
      subject: `SPIST Library Borrowing Request - Claim Within 24 Hours`,
      text: textContent,
      html: htmlContent,
      replyTo: 'library-support@spist.edu.ph',
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('Borrowing claim email sent', {
      studentId,
      studentEmail,
      messageId: info.messageId,
      itemCount: borrowedItems.length,
      claimExpiresAt: claimExpiresAt.toISOString()
    });

    return {
      success: true,
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Failed to send borrowing claim email', {
      studentId: studentId || 'unknown',
      studentEmail: studentEmail || 'unknown',
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Escape HTML special characters to prevent XSS in emails
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Send book return confirmation email to a student.
 * Notifies student that their book return has been processed.
 * 
 * @param {string} studentEmail - Student email address
 * @param {string} studentName - Student full name
 * @param {string} bookTitle - Title of returned book
 * @param {string} author - Author of returned book
 * @param {string} condition - Condition of book at return (excellent/good/fair/poor/damaged)
 * @param {string} notes - Optional notes about the return
 * @returns {Promise<Object>} { success, messageId, error }
 */
async function sendReturnConfirmationEmail(studentEmail, studentName, bookTitle, author, condition = 'good', notes = '') {
  try {
    if (!studentEmail || !studentName || !bookTitle) {
      throw new Error('Missing required parameters for return confirmation email');
    }

    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      logger.warn('Email not configured. Skipping return confirmation email.', {
        studentEmail,
        bookTitle
      });
      return { success: false, error: 'Email not configured' };
    }

    // Format condition display
    const conditionDisplay = {
      excellent: '✨ Excellent',
      good: '✅ Good',
      fair: '⚠️ Fair',
      poor: '⚠️ Poor',
      damaged: '❌ Damaged'
    }[condition] || condition;

    // Build HTML email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4caf50; color: white; padding: 20px; border-radius: 5px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
            .info-box { background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 15px 0; border-radius: 3px; }
            .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; border-top: 1px solid #ddd; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .detail-label { font-weight: bold; color: #4caf50; }
            strong { color: #4caf50; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📚 SPIST LIBRARY - BOOK RETURN CONFIRMATION</h2>
            </div>

            <div class="content">
              <p>Good day, <strong>${escapeHtml(studentName)}!</strong></p>

              <p>We are writing to confirm that your book return has been successfully processed.</p>

              <div class="info-box">
                <h3 style="margin-top: 0; color: #4caf50;">Return Details</h3>
                <div class="detail-row">
                  <div><span class="detail-label">Book Title:</span> ${escapeHtml(bookTitle)}</div>
                </div>
                <div class="detail-row">
                  <div><span class="detail-label">Author:</span> ${escapeHtml(author || 'N/A')}</div>
                </div>
                <div class="detail-row">
                  <div><span class="detail-label">Condition at Return:</span> ${escapeHtml(conditionDisplay)}</div>
                </div>
                ${notes ? `<div class="detail-row">
                  <div><span class="detail-label">Notes:</span> ${escapeHtml(notes)}</div>
                </div>` : ''}
                <div class="detail-row">
                  <div><span class="detail-label">Return Date:</span> ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</div>
                </div>
              </div>

              <p>The book has been inspected and recorded in our system. If you have any questions regarding this return or the condition assessment, please contact the library staff.</p>

              <p style="margin-top: 30px; color: #666;">
                Thank you for using SPIST Library Management System!
              </p>
            </div>

            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; 2026 Southern Philippines Institute of Science &amp; Technology Library</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text fallback
    const textContent = `
SPIST LIBRARY - BOOK RETURN CONFIRMATION

Good day, ${studentName}!

We are writing to confirm that your book return has been successfully processed.

RETURN DETAILS:
- Book Title: ${bookTitle}
- Author: ${author || 'N/A'}
- Condition at Return: ${conditionDisplay}
- Return Date: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
${notes ? `- Notes: ${notes}` : ''}

The book has been inspected and recorded in our system. If you have any questions regarding this return or the condition assessment, please contact the library staff.

Thank you for using SPIST Library Management System!

---
This is an automated email. Please do not reply to this message.
© 2026 Southern Philippines Institute of Science & Technology Library
    `;

    // Send email
    const mailOptions = {
      from: `"SPIST Library" <${fromEmail}>`,
      to: studentEmail,
      subject: `SPIST Library - Book Return Confirmed: ${bookTitle}`,
      text: textContent,
      html: htmlContent,
      replyTo: 'library-support@spist.edu.ph'
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('Return confirmation email sent', {
      studentEmail,
      bookTitle,
      author,
      condition,
      messageId: info.messageId
    });

    return {
      success: true,
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Failed to send return confirmation email', {
      error: error.message,
      studentEmail,
      bookTitle
    });
    return { success: false, error: error.message };
  }
}

/**
 * Send an overdue book reminder email to a student.
 *
 * @param {string} studentEmail
 * @param {string} studentName
 * @param {string} studentId
 * @param {string} bookTitle
 * @param {Date|string} dueDate
 * @param {number} daysOverdue
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendOverdueReminderEmail(studentEmail, studentName, studentId, bookTitle, dueDate, daysOverdue) {
  try {
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      logger.warn('Email not configured — skipping overdue reminder.', { studentId });
      return { success: false, error: 'Email not configured' };
    }

    const dueDateFormatted = new Date(dueDate).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;line-height:1.6;">
          <div style="max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#c62828;color:#fff;padding:20px;border-radius:5px;text-align:center;">
              <h2>&#128203; SPIST LIBRARY — OVERDUE BOOK REMINDER</h2>
            </div>
            <div style="padding:20px;background:#fafafa;border-radius:5px;margin-top:10px;">
              <p>Good day, <strong>${escapeHtml(studentName)}</strong>,</p>
              <p>This is a reminder that the following book you borrowed is <strong style="color:#c62828;">overdue by ${daysOverdue} day(s)</strong>:</p>
              <div style="background:#fff3e0;padding:15px;border-left:4px solid #e65100;border-radius:3px;margin:15px 0;">
                <strong>Book:</strong> ${escapeHtml(bookTitle)}<br/>
                <strong>Due Date:</strong> ${dueDateFormatted}<br/>
                <strong>Days Overdue:</strong> ${daysOverdue} day(s)
              </div>
              <p>Please return the book to the SPIST Library as soon as possible to avoid further penalties.</p>
              <p style="margin-top:30px;color:#666;">Thank you for using SPIST Library Management System!</p>
            </div>
            <div style="text-align:center;color:#999;font-size:12px;padding:10px;border-top:1px solid #ddd;margin-top:10px;">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; 2026 Southern Philippines Institute of Science &amp; Technology Library</p>
            </div>
          </div>
        </body>
      </html>`;

    const info = await transporter.sendMail({
      from: `"SPIST Library" <${fromEmail}>`,
      to: studentEmail,
      subject: `Overdue Book Reminder — ${escapeHtml(bookTitle)} (${daysOverdue} day(s) overdue)`,
      html: htmlContent,
      text: `Good day ${studentName},\n\nYour borrowed book "${bookTitle}" is overdue by ${daysOverdue} day(s). Due date was ${dueDateFormatted}.\n\nPlease return it to the SPIST Library immediately.\n\nThank you.`
    });

    logger.info('Overdue reminder email sent', { studentId, studentEmail, messageId: info.messageId, daysOverdue });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send overdue reminder email', { studentId, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendBorrowingClaimEmail,
  sendReturnConfirmationEmail,
  sendOverdueReminderEmail,
  transporter
};

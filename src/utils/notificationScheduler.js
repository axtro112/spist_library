const db = require("./db");
const logger = require("./logger");
const { createNotification, isDuplicateNotification } = require("../routes/notifications");
const { sendOverdueReminderEmail } = require("./mailer");

/**
 * Notification Scheduler
 * Runs every 5 minutes to check for due date reminders and overdue books
 */

// Track last run to avoid duplicate processing
let lastRunTimestamp = null;

async function checkDueDateReminders() {
  try {
    logger.debug('Running due date reminder check...');

    // Get all active borrowings with student preferences
    const query = `
      SELECT 
        bb.id as borrowing_id,
        bb.book_id,
        bb.student_id,
        bb.due_date,
        b.title as book_title,
        b.author as book_author,
        s.fullname as student_name,
        np.enable_due_reminders,
        np.reminder_days_before,
        DATEDIFF(bb.due_date, NOW()) as days_until_due
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s ON bb.student_id = s.student_id
      LEFT JOIN notification_preferences np ON np.user_type = 'student' AND np.user_id = bb.student_id
      WHERE bb.status = 'borrowed'
        AND bb.due_date >= NOW()
        AND bb.due_date <= DATE_ADD(NOW(), INTERVAL COALESCE(np.reminder_days_before, 2) DAY)
    `;

    const borrowings = await db.query(query);
    logger.debug(`Found ${borrowings.length} borrowings due soon`);

    for (const borrowing of borrowings) {
      // Skip if reminders disabled
      if (borrowing.enable_due_reminders === 0) {
        continue;
      }

      // Check for duplicate notification today
      const isDuplicate = await isDuplicateNotification(
        'student',
        borrowing.student_id,
        'DUE_SOON',
        'book_borrowings',
        borrowing.borrowing_id
      );

      if (isDuplicate) {
        continue;
      }

      // Create due date reminder
      const title = `Book Due Soon: ${borrowing.book_title}`;
      const message = `Your borrowed book "${borrowing.book_title}" by ${borrowing.book_author} is due in ${borrowing.days_until_due} day(s). Please return it on time to avoid late fees.`;

      await createNotification({
        user_type: 'student',
        user_id: borrowing.student_id,
        title,
        message,
        type: 'DUE_SOON',
        related_table: 'book_borrowings',
        related_id: borrowing.borrowing_id
      });

      logger.info('Due date reminder sent', {
        student_id: borrowing.student_id,
        book: borrowing.book_title,
        days_until_due: borrowing.days_until_due
      });
    }
  } catch (error) {
    logger.error('Error checking due date reminders', { error: error.message });
  }
}

async function checkOverdueBooks() {
  try {
    logger.debug('Running overdue books check...');

    // Fetch all un-returned borrowings past their due date.
    // last_overdue_notified_at is used for anti-spam (send email once per 24 h).
    const query = `
      SELECT
        bb.id                       AS borrowing_id,
        bb.book_id,
        bb.student_id,
        bb.due_date,
        bb.last_overdue_notified_at,
        b.title                     AS book_title,
        b.author                    AS book_author,
        s.fullname                  AS student_name,
        s.email                     AS student_email,
        np.enable_overdue_alerts,
        DATEDIFF(NOW(), bb.due_date) AS days_overdue
      FROM book_borrowings bb
      INNER JOIN books b  ON bb.book_id  = b.id
      INNER JOIN students s ON bb.student_id = s.student_id
      LEFT JOIN notification_preferences np
             ON np.user_type = 'student' AND np.user_id = bb.student_id
      WHERE bb.return_date IS NULL
        AND (bb.status = 'borrowed' OR bb.status = 'overdue')
        AND bb.due_date < NOW()
    `;

    const overdueBorrowings = await db.query(query);
    logger.debug(`Found ${overdueBorrowings.length} overdue borrowing(s)`);

    for (const borrowing of overdueBorrowings) {

      // ── 1. Mark status = 'overdue' in DB ────────────────────────────
      await db.query(
        `UPDATE book_borrowings SET status = 'overdue'
         WHERE id = ? AND status IN ('borrowed', 'overdue') AND return_date IS NULL`,
        [borrowing.borrowing_id]
      );

      // Skip everything else if overdue alerts are explicitly disabled
      if (borrowing.enable_overdue_alerts === 0) continue;

      const now = new Date();
      const lastNotified = borrowing.last_overdue_notified_at
        ? new Date(borrowing.last_overdue_notified_at)
        : null;
      // Anti-spam: allow notification only once per 24 hours
      const shouldNotify = !lastNotified || (now - lastNotified) >= 24 * 60 * 60 * 1000;

      if (shouldNotify) {

        // ── 2. In-app notification → student ──────────────────────────
        const isDuplicate = await isDuplicateNotification(
          'student', borrowing.student_id, 'OVERDUE', 'book_borrowings', borrowing.borrowing_id
        );

        if (!isDuplicate) {
          await createNotification({
            user_type:     'student',
            user_id:       borrowing.student_id,
            title:         `Overdue Book: ${borrowing.book_title}`,
            message:       `Your borrowed book "${borrowing.book_title}" by ${borrowing.book_author} is ${borrowing.days_overdue} day(s) overdue. Please return it immediately to avoid additional late fees.`,
            type:          'OVERDUE',
            related_table: 'book_borrowings',
            related_id:    borrowing.borrowing_id
          });
        }

        // ── 3. Email reminder → student ───────────────────────────────
        if (borrowing.student_email) {
          await sendOverdueReminderEmail(
            borrowing.student_email,
            borrowing.student_name,
            borrowing.student_id,
            borrowing.book_title,
            borrowing.due_date,
            borrowing.days_overdue
          );
        }

        // Stamp anti-spam timestamp regardless of email success
        await db.query(
          `UPDATE book_borrowings SET last_overdue_notified_at = NOW() WHERE id = ?`,
          [borrowing.borrowing_id]
        );

        logger.info('Overdue reminder sent (in-app + email)', {
          student_id:  borrowing.student_id,
          book:        borrowing.book_title,
          days_overdue: borrowing.days_overdue
        });
      }

      // ── 4. Escalation: 3+ days overdue → notify every active admin ─
      if (borrowing.days_overdue >= 3) {
        const adminsQuery = `
          SELECT a.id, np.enable_overdue_alerts
          FROM admins a
          LEFT JOIN notification_preferences np
                 ON np.user_type = 'admin' AND np.user_id = CAST(a.id AS CHAR)
          WHERE a.is_active = 1
            AND (np.enable_overdue_alerts IS NULL OR np.enable_overdue_alerts = 1)
        `;
        const admins = await db.query(adminsQuery);

        for (const admin of admins) {
          const isAdminDuplicate = await isDuplicateNotification(
            'admin', String(admin.id), 'OVERDUE', 'book_borrowings', borrowing.borrowing_id
          );
          if (isAdminDuplicate) continue;

          await createNotification({
            user_type:     'admin',
            user_id:       String(admin.id),
            title:         `Escalation: Overdue ${borrowing.days_overdue} Day(s) — ${borrowing.book_title}`,
            message:       `Student ${borrowing.student_name} (${borrowing.student_id}) has an overdue book: "${borrowing.book_title}" — ${borrowing.days_overdue} day(s) overdue.`,
            type:          'OVERDUE',
            related_table: 'book_borrowings',
            related_id:    borrowing.borrowing_id,
            target_type:   'student',
            target_id:     borrowing.student_id,
            book_id:       borrowing.book_id,
            book_title:    borrowing.book_title,
            borrowing_id:  borrowing.borrowing_id,
            due_date:      borrowing.due_date,
            status:        'overdue'
          });
        }

        logger.info('Escalation notifications sent to admins', {
          student_id:  borrowing.student_id,
          book:        borrowing.book_title,
          days_overdue: borrowing.days_overdue
        });
      }
    }
  } catch (error) {
    logger.error('Error checking overdue books', { error: error.message });
  }
}

async function checkExpiredPickupClaims() {
  try {
    logger.debug('Running expired pickup claim check...');

    const query = `
      SELECT
        bb.id as borrowing_id,
        bb.book_id,
        bb.student_id,
        bb.accession_number,
        bb.borrow_date,
        bb.claim_expires_at,
        b.title as book_title
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      WHERE bb.status = 'borrowed'
        AND bb.return_date IS NULL
        AND bb.picked_up_at IS NULL
        AND COALESCE(
          LEAST(bb.claim_expires_at, DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)),
          DATE_ADD(bb.borrow_date, INTERVAL 24 HOUR)
        ) < NOW()
    `;

    const expiredClaims = await db.query(query);
    logger.debug(`Found ${expiredClaims.length} expired pickup claim(s)`);

    for (const claim of expiredClaims) {
      const cancelled = await db.withTransaction(async (conn) => {
        const updateBorrowing = await conn.queryAsync(
          `UPDATE book_borrowings
           SET status = 'cancelled',
               notes = CONCAT(
                 COALESCE(notes, ''),
                 CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END,
                 'Auto-cancelled: pickup window expired'
               )
           WHERE id = ?
             AND status = 'borrowed'
             AND picked_up_at IS NULL
             AND return_date IS NULL`,
          [claim.borrowing_id]
        );

        if (!updateBorrowing || updateBorrowing.affectedRows === 0) {
          return false;
        }

        if (claim.accession_number) {
          await conn.queryAsync(
            "UPDATE book_copies SET status = 'available' WHERE accession_number = ?",
            [claim.accession_number]
          );
        }

        await conn.queryAsync(
          `UPDATE books
           SET available_quantity = LEAST(quantity, available_quantity + 1)
           WHERE id = ?`,
          [claim.book_id]
        );

        return true;
      });

      if (!cancelled) {
        continue;
      }

      await createNotification({
        user_type: 'student',
        user_id: claim.student_id,
        title: 'Borrow Request Auto-Cancelled',
        message: `Your claim window for "${claim.book_title}" expired after 24 hours and was automatically cancelled. You may submit a new borrow request.`,
        type: 'SYSTEM',
        related_table: 'book_borrowings',
        related_id: claim.borrowing_id,
        target_type: 'book',
        target_id: claim.book_id,
        book_id: claim.book_id,
        book_title: claim.book_title,
        borrowing_id: claim.borrowing_id,
        status: 'cancelled'
      });

      logger.info('Expired pickup claim auto-cancelled', {
        borrowingId: claim.borrowing_id,
        studentId: claim.student_id,
        bookId: claim.book_id,
      });
    }
  } catch (error) {
    logger.error('Error checking expired pickup claims', { error: error.message });
  }
}

/**
 * Run all scheduled notification checks
 */
async function runScheduledChecks() {
  const now = new Date();
  
  // Prevent running multiple times within same minute
  if (lastRunTimestamp && (now - lastRunTimestamp) < 60000) {
    return;
  }

  lastRunTimestamp = now;
  logger.info('Running scheduled notification checks', { timestamp: now.toISOString() });

  try {
    await checkDueDateReminders();
    await checkOverdueBooks();
    await checkExpiredPickupClaims();
    logger.info('Scheduled notification checks completed');
  } catch (error) {
    logger.error('Error in scheduled checks', { error: error.message });
  }
}

/**
 * Start the notification scheduler
 * Runs every 5 minutes
 */
function startNotificationScheduler() {
  logger.info('Starting notification scheduler (runs every 5 minutes)');
  
  // Run immediately on startup
  setTimeout(runScheduledChecks, 10000); // 10 second delay on startup

  // Run every 5 minutes
  const interval = setInterval(runScheduledChecks, 5 * 60 * 1000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    logger.info('Notification scheduler stopped');
  });

  return interval;
}

module.exports = {
  startNotificationScheduler,
  runScheduledChecks,
  checkDueDateReminders,
  checkOverdueBooks,
  checkExpiredPickupClaims
};

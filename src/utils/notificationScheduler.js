const db = require("./db");
const logger = require("./logger");
const { createNotification, isDuplicateNotification } = require("../routes/notifications");

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

    // Get all overdue borrowings
    const query = `
      SELECT 
        bb.id as borrowing_id,
        bb.book_id,
        bb.student_id,
        bb.due_date,
        b.title as book_title,
        b.author as book_author,
        s.fullname as student_name,
        s.email as student_email,
        np.enable_overdue_alerts,
        DATEDIFF(NOW(), bb.due_date) as days_overdue
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      INNER JOIN students s ON bb.student_id = s.student_id
      LEFT JOIN notification_preferences np ON np.user_type = 'student' AND np.user_id = bb.student_id
      WHERE bb.status = 'borrowed'
        AND bb.due_date < NOW()
    `;

    const overdueBorrowings = await db.query(query);
    logger.debug(`Found ${overdueBorrowings.length} overdue borrowings`);

    for (const borrowing of overdueBorrowings) {
      // Update borrowing status to overdue if not already
      await db.query(
        `UPDATE book_borrowings SET status = 'overdue' WHERE id = ? AND status = 'borrowed'`,
        [borrowing.borrowing_id]
      );

      // Skip if overdue alerts disabled
      if (borrowing.enable_overdue_alerts === 0) {
        continue;
      }

      // Check for duplicate notification today
      const isDuplicate = await isDuplicateNotification(
        'student',
        borrowing.student_id,
        'OVERDUE',
        'book_borrowings',
        borrowing.borrowing_id
      );

      if (isDuplicate) {
        continue;
      }

      // Notify student
      const studentTitle = `Overdue Book: ${borrowing.book_title}`;
      const studentMessage = `Your borrowed book "${borrowing.book_title}" by ${borrowing.book_author} is ${borrowing.days_overdue} day(s) overdue. Please return it immediately to avoid additional late fees.`;

      await createNotification({
        user_type: 'student',
        user_id: borrowing.student_id,
        title: studentTitle,
        message: studentMessage,
        type: 'OVERDUE',
        related_table: 'book_borrowings',
        related_id: borrowing.borrowing_id
      });

      logger.info('Overdue alert sent to student', {
        student_id: borrowing.student_id,
        book: borrowing.book_title,
        days_overdue: borrowing.days_overdue
      });

      // Notify all admins with overdue alerts enabled
      const adminsQuery = `
        SELECT a.id, a.fullname, a.email, np.enable_overdue_alerts
        FROM admins a
        LEFT JOIN notification_preferences np ON np.user_type = 'admin' AND np.user_id = CAST(a.id AS CHAR)
        WHERE a.is_active = 1
          AND (np.enable_overdue_alerts IS NULL OR np.enable_overdue_alerts = 1)
      `;

      const admins = await db.query(adminsQuery);

      for (const admin of admins) {
        // Check for duplicate
        const isAdminDuplicate = await isDuplicateNotification(
          'admin',
          String(admin.id),
          'OVERDUE',
          'book_borrowings',
          borrowing.borrowing_id
        );

        if (isAdminDuplicate) {
          continue;
        }

        const adminTitle = `Student Has Overdue Book`;
        const adminMessage = `Student ${borrowing.student_name} (${borrowing.student_id}) has an overdue book: "${borrowing.book_title}" - ${borrowing.days_overdue} day(s) overdue.`;

        await createNotification({
          user_type: 'admin',
          user_id: String(admin.id),
          title: adminTitle,
          message: adminMessage,
          type: 'OVERDUE',
          related_table: 'book_borrowings',
          related_id: borrowing.borrowing_id,
          target_type: 'student',
          target_id: borrowing.student_id,
          book_id: borrowing.book_id,
          book_title: borrowing.book_title,
          borrowing_id: borrowing.borrowing_id,
          due_date: borrowing.due_date,
          status: 'overdue'
        });
      }
    }
  } catch (error) {
    logger.error('Error checking overdue books', { error: error.message });
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
  checkOverdueBooks
};

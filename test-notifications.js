/**
 * Comprehensive Notification System Test Suite
 * Run this from Node.js to test backend functionality
 */

const db = require('./src/utils/db');
const dbConnection = require('./src/config/database');

const tests = {
  passed: 0,
  failed: 0,
  results: []
};

function log(status, message, details = '') {
  const icon = status === 'PASS' ? '✓' : '✗';
  const color = status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${message}`);
  if (details) console.log(`  ${details}`);
  
  tests.results.push({ status, message, details });
  if (status === 'PASS') tests.passed++;
  else tests.failed++;
}

async function testDatabaseTables() {
  console.log('\n=== Testing Database Tables ===\n');
  
  try {
    // Check notifications table
    const notifTable = await db.query('SHOW TABLES LIKE "notifications"');
    if (notifTable.length > 0) {
      log('PASS', 'notifications table exists');
      
      // Check columns
      const columns = await db.query('DESCRIBE notifications');
      const requiredCols = ['id', 'user_type', 'user_id', 'title', 'message', 'type', 'is_read', 'created_at'];
      const existingCols = columns.map(c => c.Field);
      const missing = requiredCols.filter(col => !existingCols.includes(col));
      
      if (missing.length === 0) {
        log('PASS', 'All required columns exist in notifications table');
      } else {
        log('FAIL', 'Missing columns in notifications table', `Missing: ${missing.join(', ')}`);
      }
    } else {
      log('FAIL', 'notifications table does not exist');
    }
    
    // Check notification_preferences table
    const prefTable = await db.query('SHOW TABLES LIKE "notification_preferences"');
    if (prefTable.length > 0) {
      log('PASS', 'notification_preferences table exists');
    } else {
      log('FAIL', 'notification_preferences table does not exist');
    }
  } catch (error) {
    log('FAIL', 'Database table check failed', error.message);
  }
}

async function testNotificationCreation() {
  console.log('\n=== Testing Notification Creation ===\n');
  
  try {
    // Get a test student
    const students = await db.query('SELECT student_id FROM students LIMIT 1');
    if (students.length === 0) {
      log('FAIL', 'No students found for testing');
      return;
    }
    
    const studentId = students[0].student_id;
    
    // Create test notification
    const result = await db.query(`
      INSERT INTO notifications 
      (user_type, user_id, title, message, type, is_read)
      VALUES ('student', ?, 'Test Notification', 'This is a test', 'SYSTEM', 0)
    `, [studentId]);
    
    if (result.insertId) {
      log('PASS', 'Test notification created', `ID: ${result.insertId}`);
      
      // Verify it was created
      const check = await db.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
      if (check.length > 0) {
        log('PASS', 'Notification successfully stored in database');
        
        // Clean up
        await db.query('DELETE FROM notifications WHERE id = ?', [result.insertId]);
        log('PASS', 'Test notification cleaned up');
      } else {
        log('FAIL', 'Notification not found after creation');
      }
    } else {
      log('FAIL', 'Failed to create test notification');
    }
  } catch (error) {
    log('FAIL', 'Notification creation test failed', error.message);
  }
}

async function testDueSoonLogic() {
  console.log('\n=== Testing Due Soon Logic ===\n');
  
  try {
    // Check for borrowings due within 3 days
    const dueSoon = await db.query(`
      SELECT 
        bb.id,
        bb.student_id,
        b.title,
        bb.due_date,
        DATEDIFF(bb.due_date, NOW()) as days_until_due
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      WHERE bb.status = 'borrowed'
        AND bb.due_date >= NOW()
        AND bb.due_date <= DATE_ADD(NOW(), INTERVAL 3 DAY)
      LIMIT 5
    `);
    
    log('PASS', `Found ${dueSoon.length} borrowings due soon`, 
      dueSoon.map(b => `${b.title} (${b.days_until_due} days)`).join(', '));
  } catch (error) {
    log('FAIL', 'Due soon logic test failed', error.message);
  }
}

async function testOverdueLogic() {
  console.log('\n=== Testing Overdue Logic ===\n');
  
  try {
    // Check for overdue borrowings
    const overdue = await db.query(`
      SELECT 
        bb.id,
        bb.student_id,
        b.title,
        bb.due_date,
        DATEDIFF(NOW(), bb.due_date) as days_overdue
      FROM book_borrowings bb
      INNER JOIN books b ON bb.book_id = b.id
      WHERE bb.status IN ('borrowed', 'overdue')
        AND bb.due_date < NOW()
      LIMIT 5
    `);
    
    log('PASS', `Found ${overdue.length} overdue borrowings`, 
      overdue.map(b => `${b.title} (${b.days_overdue} days overdue)`).join(', '));
  } catch (error) {
    log('FAIL', 'Overdue logic test failed', error.message);
  }
}

async function testPreferences() {
  console.log('\n=== Testing Notification Preferences ===\n');
  
  try {
    // Get count of users with preferences
    const count = await db.query('SELECT COUNT(*) as count FROM notification_preferences');
    log('PASS', `${count[0].count} users have notification preferences`);
    
    // Check default values
    const sample = await db.query('SELECT * FROM notification_preferences LIMIT 1');
    if (sample.length > 0) {
      const pref = sample[0];
      if (pref.enable_in_app && pref.enable_realtime && pref.enable_due_reminders) {
        log('PASS', 'Default preferences are correctly set to enabled');
      } else {
        log('FAIL', 'Default preferences not set correctly');
      }
    }
  } catch (error) {
    log('FAIL', 'Preferences test failed', error.message);
  }
}

async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   SPIST Library - Notification System Test Suite        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  await testDatabaseTables();
  await testNotificationCreation();
  await testDueSoonLogic();
  await testOverdueLogic();
  await testPreferences();
  
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║   Test Results: ${tests.passed} passed, ${tests.failed} failed${' '.repeat(24 - tests.passed.toString().length - tests.failed.toString().length)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  dbConnection.end();
  process.exit(tests.failed > 0 ? 1 : 0);
}

runAllTests();

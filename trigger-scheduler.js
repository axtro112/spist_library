/**
 * Manually trigger notification scheduler for testing
 */

const db = require('./src/utils/db');
const dbConnection = require('./src/config/database');
const { runScheduledChecks } = require('./src/utils/notificationScheduler');

async function runScheduler() {
  console.log('\n🔔 Running Notification Scheduler Manually...\n');
  
  try {
    // Run scheduled checks
    await runScheduledChecks();
    
    // Show created notifications
    console.log('\n📋 Created Notifications:\n');
    const notifications = await db.query(`
      SELECT n.id, n.user_id, n.title, n.type, n.created_at
      FROM notifications n
      WHERE DATE(n.created_at) = CURDATE()
      ORDER BY n.created_at DESC
      LIMIT 10
    `);
    
    if (notifications.length === 0) {
      console.log('   ℹ️  No new notifications created today');
      console.log('   This could mean:');
      console.log('   - No borrowings are due soon or overdue');
      console.log('   - Notifications were already created today (duplicate prevention)');
      console.log('   - User preferences disabled notifications\n');
    } else {
      notifications.forEach(n => {
        console.log(`   ${n.type.padEnd(12)} | ${n.title}`);
        console.log(`   User: ${n.user_id} | ID: ${n.id} | ${n.created_at}`);
        console.log('');
      });
    }
    
    console.log('✅ Scheduler completed!\n');
    
  } catch (error) {
    console.error('❌ Scheduler error:', error.message);
    console.error(error.stack);
  } finally {
    dbConnection.end();
  }
}

runScheduler();

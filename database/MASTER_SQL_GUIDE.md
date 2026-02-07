# SPIST Library Master SQL - Safe Deployment Guide

## 📋 Overview

The `spist_library_master.sql` file is a **comprehensive, idempotent master schema** that safely combines all migrations into a single file. It can be run on existing databases without breaking current routes or data.

## ✅ What's Included

### Combined Migrations (in order):
1. **Base Schema** - Core tables (admins, students, books, book_borrowings, audit_logs)
2. **Google Authentication** - OAuth integration columns
3. **Notification System** - In-app notifications with deep linking and targeting
4. **Accession System** - Individual book copy tracking
5. **Foreign Keys & Constraints** - All relationships and data integrity rules
6. **Seed Data** (optional, commented out) - Sample data for testing

### Safety Features:
- ✅ Fully idempotent (safe to run multiple times)
- ✅ Uses `CREATE TABLE IF NOT EXISTS`
- ✅ Uses `ALTER TABLE` with `INFORMATION_SCHEMA` checks
- ✅ Preserves all existing data
- ✅ No table/column renames
- ✅ Foreign keys added only if missing
- ✅ Indexes added only if missing
- ✅ Check constraints added only if supported and missing

---

## 🚨 BEFORE RUNNING: Critical Checklist

### 1. **BACKUP YOUR DATABASE**

#### Using MySQL command line:
```bash
# Full database backup
mysqldump -u root -p spist_library > backup_$(date +%Y%m%d_%H%M%S).sql

# Tables only (no data)
mysqldump -u root -p --no-data spist_library > backup_schema_$(date +%Y%m%d_%H%M%S).sql

# Specific tables
mysqldump -u root -p spist_library admins students books book_borrowings > backup_core_$(date +%Y%m%d_%H%M%S).sql
```

#### Using phpMyAdmin:
1. Open phpMyAdmin → Select `spist_library` database
2. Click **Export** tab
3. Select **Quick** export method → Format: **SQL**
4. Click **Go** to download backup

#### Using XAMPP Control Panel:
1. Open **XAMPP Control Panel** → Click **Shell**
2. Run: `mysqldump -u root spist_library > C:\backup_library.sql`

### 2. **Verify Database Connection**

```bash
# Test connection
mysql -u root -p -e "SELECT DATABASE();"

# Check current database
mysql -u root -p spist_library -e "SHOW TABLES;"
```

### 3. **Check MySQL Version**

```bash
# Verify MySQL version (8.0+ recommended for CHECK constraints)
mysql -u root -p -e "SELECT VERSION();"
```

---

## 🎯 How to Run Safely

### **Option 1: Run on STAGING First (Recommended)**

```bash
# Step 1: Create staging database
mysql -u root -p -e "CREATE DATABASE spist_library_staging;"

# Step 2: Copy production data to staging
mysqldump -u root -p spist_library | mysql -u root -p spist_library_staging

# Step 3: Run master SQL on staging
mysql -u root -p spist_library_staging < database/spist_library_master.sql

# Step 4: Test your application with staging database
# Update .env: DB_NAME=spist_library_staging

# Step 5: If successful, run on production
mysql -u root -p spist_library < database/spist_library_master.sql
```

### **Option 2: Direct Production Run (After Backup)**

```bash
# ONLY after creating backup!
mysql -u root -p spist_library < database/spist_library_master.sql
```

### **Option 3: Using XAMPP/phpMyAdmin**

1. Open **phpMyAdmin** → Select `spist_library` database
2. Click **Import** tab
3. Click **Choose File** → Select `spist_library_master.sql`
4. **Format**: SQL
5. Click **Go**
6. Wait for "Import has been successfully finished" message

---

## 📊 Expected Success Criteria

After running the master SQL, you should see:

### 1. **Tables Created/Updated**
```
✅ admins
✅ students
✅ books
✅ book_borrowings
✅ book_copies
✅ notifications
✅ notification_preferences
✅ audit_logs
✅ accession_sequence
✅ book_copy_audit
```

### 2. **New Columns Added** (if they didn't exist)
- `admins.google_id`
- `students.google_id`
- `students.student_type` (if missing)
- `books.available_quantity`
- `book_borrowings.accession_number`
- `book_borrowings.copy_condition_at_borrow`
- `book_borrowings.copy_condition_at_return`
- `notifications.link_type`, `link_id`, `link_url`
- `notifications.target_type`, `target_id`, `book_id`, `book_title`, `borrowing_id`, `due_date`, `status`

### 3. **Verification Queries**

Run these to verify success:

```sql
-- Check all tables exist
SHOW TABLES;

-- Check row counts
SELECT 
  'admins' AS table_name, COUNT(*) AS row_count FROM admins
UNION ALL
SELECT 'students', COUNT(*) FROM students
UNION ALL
SELECT 'books', COUNT(*) FROM books
UNION ALL
SELECT 'book_borrowings', COUNT(*) FROM book_borrowings;

-- Check new columns exist
DESCRIBE admins;
DESCRIBE students;
DESCRIBE notifications;
DESCRIBE book_borrowings;

-- Check foreign keys
SELECT 
  CONSTRAINT_NAME,
  TABLE_NAME,
  REFERENCED_TABLE_NAME,
  UPDATE_RULE,
  DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'spist_library';

-- Check indexes
SELECT 
  TABLE_NAME, 
  INDEX_NAME, 
  COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'spist_library'
ORDER BY TABLE_NAME, INDEX_NAME;
```

### 4. **Expected Console Output**

You should see messages like:
```
✅ Tables created successfully!
✅ Column google_id already exists in students (or added)
✅ Notification link columns already exist (or added)
✅ Foreign key fk_books_added_by already exists (or added)
✅ Master schema migration completed successfully!
```

---

## 🧪 Testing After Migration

### 1. **Test Application Routes**

```bash
# Start server
npm start

# Test these endpoints:
curl http://localhost:3000/api/admin
curl http://localhost:3000/api/students
curl http://localhost:3000/api/books
curl http://localhost:3000/api/book-borrowings/STD-2024-001
```

### 2. **Test Admin Login**
- Navigate to `/login`
- Try logging in with existing admin account
- Verify dashboard loads correctly

### 3. **Test Student Features**
- Navigate to `/admin-users`
- Verify student list loads
- Test borrowing/returning books

### 4. **Test Notifications**
- Check notification bell works
- Verify notifications display correctly
- Test marking notifications as read

---

## 🚨 Rollback Plan

If something goes wrong:

### **Option 1: Restore from Backup**

```bash
# Drop current database
mysql -u root -p -e "DROP DATABASE spist_library;"

# Create fresh database
mysql -u root -p -e "CREATE DATABASE spist_library;"

# Restore from backup
mysql -u root -p spist_library < backup_YYYYMMDD_HHMMSS.sql
```

### **Option 2: Selective Rollback**

```sql
-- If only new tables are causing issues, drop them:
DROP TABLE IF EXISTS book_copy_audit;
DROP TABLE IF EXISTS accession_sequence;
DROP TABLE IF EXISTS book_copies;
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS notifications;

-- Your core data (admins, students, books, book_borrowings) remains intact
```

---

## 📝 Optional: Enable Seed Data

The seed data section is **commented out by default** for safety.

To enable it (ONLY for development/testing):

1. Open `spist_library_master.sql`
2. Find section: `-- 90 SEED DATA (OPTIONAL)`
3. Remove the `/*` and `*/` comment markers
4. Run the SQL again

**Seed data includes:**
- 3 sample admin accounts (password: `admin123`)
- 5 sample student accounts (password: `student123`)
- 10 sample books
- 5 sample borrowing records

---

## 🔧 Troubleshooting

### Error: "Duplicate column name 'google_id'"
**Solution:** This is normal! The script detected the column already exists. No action needed.

### Error: "Foreign key constraint fails"
**Solution:** Check that referenced tables exist first:
```sql
SHOW TABLES LIKE 'admins';
SHOW TABLES LIKE 'students';
SHOW TABLES LIKE 'books';
```

### Error: "Table 'spist_library' doesn't exist"
**Solution:** Create the database first:
```bash
mysql -u root -p -e "CREATE DATABASE spist_library;"
```

### Error: "CHECK constraint is ignored"
**Solution:** Your MySQL version is < 8.0.16. CHECK constraints will be ignored but won't cause errors.

### Script hangs or runs very slowly
**Solution:** Large tables may take time. Check progress:
```sql
-- In another terminal
SHOW PROCESSLIST;
```

---

## 📞 Support Checklist

Before asking for help, please provide:

1. ✅ MySQL version: `mysql --version`
2. ✅ Backup confirmation: "Yes, I have a backup"
3. ✅ Error message (exact text)
4. ✅ Database name: `SELECT DATABASE();`
5. ✅ Table list: `SHOW TABLES;`
6. ✅ Application logs from Node.js server

---

## 🎉 Success Confirmation

You've successfully migrated when:

- ✅ All 10 tables exist
- ✅ Server starts without errors
- ✅ Admin login works
- ✅ Student list loads
- ✅ Books page displays inventory
- ✅ No console errors in browser
- ✅ Notifications work (if implemented)
- ✅ All existing data is intact

---

## 📚 Related Documentation

- [README.md](../README.md) - Main project documentation
- [SECURITY_CONFIGURATION.md](../SECURITY_CONFIGURATION.md) - Security setup
- [GOOGLE_OAUTH_IMPLEMENTATION.md](../GOOGLE_OAUTH_IMPLEMENTATION.md) - OAuth setup
- Individual migration files in `database/migrations/` - Reference only

---

**Last Updated:** February 2, 2026  
**Schema Version:** 3.0 Master  
**Compatibility:** MySQL 5.7+ (8.0+ recommended)

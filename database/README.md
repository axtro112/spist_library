# Database Directory - SPIST Library Management System

## 📁 Directory Structure

```
database/
├── spist_library_master.sql          ⭐ USE THIS - Master schema (idempotent)
├── spist_library_primary.sql         📚 Reference - Original base schema
├── sample_books.sql                  🌱 Seed - Sample book data
├── sample_data.sql                   🌱 Seed - Sample users/borrowings
├── MASTER_SQL_GUIDE.md               📖 Full deployment guide
├── MASTER_SQL_QUICKSTART.md          ⚡ Quick reference
└── migrations/
    ├── add_google_auth.sql           ✅ Merged into master
    ├── add_notifications_system.sql  ✅ Merged into master
    ├── add_notification_links.sql    ✅ Merged into master
    ├── add_notification_target_fields.sql ✅ Merged into master
    └── add_accession_system.sql      ✅ Merged into master
```

## 🎯 Which File Should I Use?

### For New Installation or Existing Database:
**Use:** `spist_library_master.sql`
- ✅ Safe for existing databases
- ✅ Combines all migrations
- ✅ Idempotent (can run multiple times)
- ✅ Won't break current routes

### For Reference Only:
- `spist_library_primary.sql` - Original base schema
- `migrations/*.sql` - Individual migration files (already included in master)

### For Development/Testing:
- `sample_books.sql` - Sample book inventory
- `sample_data.sql` - Sample users and borrowings

---

## 🚀 Quick Start

### 1️⃣ Backup First (CRITICAL!)
```bash
mysqldump -u root -p spist_library > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2️⃣ Run Master SQL
```bash
mysql -u root -p spist_library < database/spist_library_master.sql
```

### 3️⃣ Verify Success
```bash
mysql -u root -p spist_library -e "SHOW TABLES;"
```

Expected output: 10 tables
```
admins
students
books
book_borrowings
book_copies
notifications
notification_preferences
audit_logs
accession_sequence
book_copy_audit
```

---

## 📋 Schema Version History

| Version | Date | Changes | File |
|---------|------|---------|------|
| 1.0 | Initial | Base schema (4 tables) | `spist_library_primary.sql` |
| 2.0 | Dec 2025 | + Google OAuth | `migrations/add_google_auth.sql` |
| 2.1 | Jan 2026 | + Notification system | `migrations/add_notifications_system.sql` |
| 2.2 | Jan 2026 | + Notification links/targets | `migrations/add_notification_*.sql` |
| 2.3 | Jan 2026 | + Accession system | `migrations/add_accession_system.sql` |
| **3.0** | **Feb 2026** | **Master consolidated** | **`spist_library_master.sql`** ⭐ |

---

## 🔧 Common Tasks

### Create New Database
```bash
mysql -u root -p -e "CREATE DATABASE spist_library;"
mysql -u root -p spist_library < database/spist_library_master.sql
```

### Add Sample Data (Dev/Test Only)
```bash
# Uncomment seed data section in spist_library_master.sql
# OR run individual seed files:
mysql -u root -p spist_library < database/sample_data.sql
mysql -u root -p spist_library < database/sample_books.sql
```

### Create Staging Database
```bash
mysql -u root -p -e "CREATE DATABASE spist_library_staging;"
mysqldump -u root -p spist_library | mysql -u root -p spist_library_staging
```

### Restore from Backup
```bash
mysql -u root -p -e "DROP DATABASE spist_library;"
mysql -u root -p -e "CREATE DATABASE spist_library;"
mysql -u root -p spist_library < backup_YYYYMMDD_HHMMSS.sql
```

### Export Schema Only (No Data)
```bash
mysqldump -u root -p --no-data spist_library > schema_export.sql
```

---

## 📊 Database Schema Overview

### Core Tables
- **admins** - Administrator accounts (super_admin, system_admin)
- **students** - Student accounts and profiles
- **books** - Book inventory (title, author, ISBN, quantity)
- **book_borrowings** - Borrowing transactions and history

### Enhancement Tables
- **book_copies** - Individual book copies with accession numbers
- **notifications** - In-app notifications for users
- **notification_preferences** - User notification settings
- **audit_logs** - Audit trail for database changes
- **accession_sequence** - Accession number generation tracking
- **book_copy_audit** - Audit trail for book copy changes

---

## 🔐 Security Notes

### Default Credentials (Sample Data)
If you run the sample data seed:
- **Admin:** admin@spist.edu / admin123
- **Student:** STD-2024-001 / student123

⚠️ **CHANGE IMMEDIATELY** in production!

### Production Recommendations
1. Never use sample data in production
2. Use strong passwords (bcrypt hashed)
3. Enable Google OAuth for added security
4. Regular database backups
5. Restrict MySQL user permissions
6. Use SSL/TLS for database connections

---

## 📈 Migration Strategy

### For Existing Production Database:

1. **Backup** (non-negotiable)
   ```bash
   mysqldump -u root -p spist_library > backup_production.sql
   ```

2. **Test on Staging**
   ```bash
   mysql -u root -p spist_library_staging < database/spist_library_master.sql
   ```

3. **Verify Application**
   - Start server: `npm start`
   - Test all routes
   - Check for errors

4. **Run on Production** (off-peak hours)
   ```bash
   mysql -u root -p spist_library < database/spist_library_master.sql
   ```

5. **Verify Production**
   ```bash
   mysql -u root -p spist_library -e "SHOW TABLES;"
   npm start
   ```

---

## 🛠️ Troubleshooting

### "Table already exists"
✅ **Normal!** The script uses `CREATE TABLE IF NOT EXISTS`. No action needed.

### "Duplicate column name"
✅ **Normal!** The script checks before adding columns. No action needed.

### "Foreign key constraint fails"
❌ **Check:** Ensure parent tables exist and have correct columns.
```sql
SHOW TABLES;
DESCRIBE admins;
DESCRIBE students;
```

### "Database doesn't exist"
❌ **Fix:** Create database first:
```bash
mysql -u root -p -e "CREATE DATABASE spist_library;"
```

### "Access denied"
❌ **Fix:** Check MySQL credentials:
```bash
mysql -u root -p -e "SELECT USER();"
```

---

## 📞 Support & Resources

### Documentation
- [MASTER_SQL_GUIDE.md](./MASTER_SQL_GUIDE.md) - Complete deployment guide
- [MASTER_SQL_QUICKSTART.md](./MASTER_SQL_QUICKSTART.md) - Quick reference
- [../README.md](../README.md) - Main project documentation
- [../SECURITY_CONFIGURATION.md](../SECURITY_CONFIGURATION.md) - Security setup

### Verification Queries
```sql
-- Check all tables
SHOW TABLES;

-- Check table structures
DESCRIBE admins;
DESCRIBE students;
DESCRIBE notifications;

-- Check row counts
SELECT 
  'admins' AS table_name, COUNT(*) AS rows FROM admins
UNION ALL
SELECT 'students', COUNT(*) FROM students
UNION ALL
SELECT 'books', COUNT(*) FROM books;

-- Check foreign keys
SELECT 
  CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE();
```

---

## 🎉 Next Steps After Migration

1. ✅ Update `.env` file with correct `DB_NAME`
2. ✅ Start Node.js server: `npm start`
3. ✅ Test admin login at `/login`
4. ✅ Verify all routes work
5. ✅ Check browser console for errors
6. ✅ Test notifications (if enabled)
7. ✅ Import books via CSV/Excel (if needed)

---

## 📝 Notes

- **Idempotent:** All SQL operations are safe to run multiple times
- **Non-destructive:** Preserves all existing data
- **Route-safe:** Won't break current application routes
- **MySQL 5.7+:** Compatible with MySQL 5.7 and 8.0+
- **CHECK constraints:** Require MySQL 8.0.16+ (gracefully ignored on older versions)

---

**Last Updated:** February 2, 2026  
**Schema Version:** 3.0 Master  
**Maintainer:** SPIST Library Development Team

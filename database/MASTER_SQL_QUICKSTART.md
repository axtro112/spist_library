# Quick Reference: Master SQL Deployment

## 🎯 One-Command Deployment

```bash
# AFTER creating backup:
mysql -u root -p spist_library < database/spist_library_master.sql
```

## 📦 What It Does

Safely combines these migrations in order:
1. ✅ Base schema (admins, students, books, book_borrowings, audit_logs)
2. ✅ Google OAuth columns
3. ✅ Notification system (10 new columns across 2 tables)
4. ✅ Accession number system (3 new tables, 3 new columns)
5. ✅ All foreign keys and indexes
6. ✅ Seed data (commented out - safe by default)

## 🚨 Critical: Backup First!

```bash
mysqldump -u root -p spist_library > backup_$(date +%Y%m%d_%H%M%S).sql
```

## ✅ Success Indicators

After running, verify:
- 10 tables exist (run `SHOW TABLES;`)
- Server starts without errors
- Admin login works
- No console errors

## 🔄 Rollback

```bash
mysql -u root -p spist_library < backup_YYYYMMDD_HHMMSS.sql
```

## 📚 Full Documentation

See [MASTER_SQL_GUIDE.md](./MASTER_SQL_GUIDE.md) for complete instructions.

---

**Safe to run multiple times** - The script is fully idempotent and won't duplicate data or break existing routes.

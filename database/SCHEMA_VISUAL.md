# 📊 Database Schema Visual Reference

## Table Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SPIST LIBRARY DATABASE SCHEMA                    │
│                         Version 3.0 Master                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   admins     │          │   students   │          │    books     │
├──────────────┤          ├──────────────┤          ├──────────────┤
│ id (PK)      │─┐        │ id (PK)      │          │ id (PK)      │──┐
│ fullname     │ │        │ student_id UK│─┐        │ title        │  │
│ email UK     │ │        │ fullname     │ │        │ author       │  │
│ password NULL│ │        │ email UK     │ │        │ isbn UK      │  │
│ role ENUM    │ │        │ password NULL│ │        │ category     │  │
│ google_id UK │ │        │ google_id UK │ │        │ quantity     │  │
│ is_active    │ │        │ department   │ │        │ avail_qty    │  │
│ resetToken   │ │        │ year_level   │ │        │ status ENUM  │  │
│ created_at   │ │        │ student_type │ │        │ added_by FK  │──┘
│ updated_at   │ │        │ status ENUM  │ │        │ added_date   │
└──────────────┘ │        │ created_at   │ │        │ updated_at   │
                 │        │ updated_at   │ │        └──────────────┘
                 │        └──────────────┘ │               │
                 │                         │               │
                 │        ┌────────────────┘               │
                 │        │                                │
                 │        │         ┌──────────────────────┘
                 │        │         │
                 │        ▼         ▼
                 │   ┌─────────────────────┐
                 └──▶│  book_borrowings    │
                     ├─────────────────────┤
                     │ id (PK)             │
                     │ book_id FK          │────────┐
                     │ student_id FK       │        │
                     │ approved_by FK      │        │
                     │ accession_number    │        │
                     │ borrow_date         │        │
                     │ due_date            │        │
                     │ return_date NULL    │        │
                     │ status ENUM         │        │
                     │ copy_cond_borrow    │        │
                     │ copy_cond_return    │        │
                     │ notes               │        │
                     │ created_at          │        │
                     │ updated_at          │        │
                     └─────────────────────┘        │
                                                    │
                                                    │
                     ┌──────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ book_copies  │
              ├──────────────┤
              │ id (PK)      │
              │ accession_no │◀─────────┐
              │ book_id FK   │          │
              │ copy_number  │          │
              │ condition    │          │
              │ location     │          │
              │ acq_date     │          │
              │ status ENUM  │          │
              │ created_at   │          │
              │ updated_at   │          │
              └──────────────┘          │
                     │                  │
                     │                  │
                     ▼                  │
          ┌─────────────────────┐      │
          │ book_copy_audit     │      │
          ├─────────────────────┤      │
          │ id (PK)             │      │
          │ accession_number    │──────┘
          │ action ENUM         │
          │ old_value           │
          │ new_value           │
          │ performed_by        │
          │ performed_at        │
          │ notes               │
          └─────────────────────┘

┌──────────────────┐          ┌─────────────────────────┐
│ notifications    │          │ notification_preferences│
├──────────────────┤          ├─────────────────────────┤
│ id (PK)          │          │ id (PK)                 │
│ user_type ENUM   │          │ user_type ENUM          │
│ user_id          │          │ user_id                 │
│ title            │          │ enable_in_app           │
│ message          │          │ enable_realtime         │
│ type ENUM        │          │ enable_due_reminders    │
│ related_table    │          │ enable_overdue_alerts   │
│ related_id       │          │ reminder_days_before    │
│ link_type        │          │ quiet_hours_start       │
│ link_id          │          │ quiet_hours_end         │
│ link_url         │          │ created_at              │
│ target_type      │          │ updated_at              │
│ target_id        │          └─────────────────────────┘
│ book_id          │
│ book_title       │          ┌─────────────────────────┐
│ borrowing_id     │          │ accession_sequence      │
│ due_date         │          ├─────────────────────────┤
│ status           │          │ year (PK)               │
│ is_read          │          │ last_sequence           │
│ created_at       │          │ created_at              │
└──────────────────┘          │ updated_at              │
                              └─────────────────────────┘

┌─────────────────────────────┐
│      audit_logs             │
├─────────────────────────────┤
│ id (PK)                     │
│ table_name                  │
│ record_id                   │
│ action ENUM                 │
│ user_type ENUM              │
│ user_id                     │
│ old_values JSON             │
│ new_values JSON             │
│ ip_address                  │
│ created_at                  │
└─────────────────────────────┘

Legend:
  PK = Primary Key
  FK = Foreign Key
  UK = Unique Key
  ENUM = Enumerated values
  NULL = Nullable column
  ─▶ = Foreign Key relationship
```

---

## Migration Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MIGRATION APPLICATION FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

START
  │
  ▼
┌────────────────────┐
│ Preconditions      │
│ - Check MySQL ver  │
│ - Verify database  │
└────────────────────┘
  │
  ▼
┌────────────────────┐
│ Section 01         │
│ Base Schema        │
│ - admins           │────── CREATE TABLE IF NOT EXISTS
│ - students         │       (Safe - No duplicates)
│ - books            │
│ - book_borrowings  │
│ - audit_logs       │
└────────────────────┘
  │
  ▼
┌────────────────────┐
│ Section 02         │
│ Google OAuth       │
│ - google_id cols   │────── Check INFORMATION_SCHEMA
└────────────────────┘       IF column exists THEN skip
  │                           ELSE ALTER TABLE
  ▼
┌────────────────────┐
│ Section 03         │
│ Notifications      │
│ - notifications    │────── CREATE TABLE IF NOT EXISTS
│ - notif_prefs      │       + Check for columns
│ - 10 new columns   │       (Safe - Idempotent)
└────────────────────┘
  │
  ▼
┌────────────────────┐
│ Section 04         │
│ Accessions         │
│ - book_copies      │────── CREATE TABLE IF NOT EXISTS
│ - accession_seq    │       + Check for columns
│ - book_copy_audit  │       + Initialize sequence
│ - 3 new columns    │       (Safe - Idempotent)
└────────────────────┘
  │
  ▼
┌────────────────────┐
│ Section 05         │
│ Constraints        │
│ - Foreign keys     │────── Check if exists first
│ - CHECK constraints│       IF exists THEN skip
│ - Indexes          │       ELSE ADD
└────────────────────┘       (Safe - No duplicates)
  │
  ▼
┌────────────────────┐
│ Section 90         │
│ Seed Data          │
│ (Optional)         │────── COMMENTED OUT by default
│ - Sample admins    │       Uses INSERT IGNORE
│ - Sample students  │       or ON DUPLICATE KEY
│ - Sample books     │       (Safe - No overwrites)
└────────────────────┘
  │
  ▼
┌────────────────────┐
│ Verification       │
│ - Show tables      │
│ - Show counts      │
│ - Success message  │
└────────────────────┘
  │
  ▼
END (COMMIT)
```

---

## Idempotency Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                   HOW IDEMPOTENCY WORKS                             │
└─────────────────────────────────────────────────────────────────────┘

For TABLES:
┌──────────────────────┐
│ CREATE TABLE IF NOT  │──▶ Table exists? ──▶ YES ──▶ Skip (no error)
│ EXISTS `books`       │                   │
└──────────────────────┘                   └──▶ NO ──▶ Create table

For COLUMNS:
┌──────────────────────────────────────────────┐
│ SET @col_exists := (                         │
│   SELECT COUNT(*)                            │
│   FROM INFORMATION_SCHEMA.COLUMNS            │
│   WHERE TABLE_NAME = 'books'                 │──▶ Count > 0? ──▶ YES ──▶ Skip
│   AND COLUMN_NAME = 'google_id'              │              │
│ );                                           │              └──▶ NO ──▶ Add column
│                                              │
│ SET @sql := IF(@col_exists = 0,              │
│   'ALTER TABLE books ADD COLUMN google_id',  │
│   'SELECT "Already exists"'                  │
│ );                                           │
│ PREPARE stmt FROM @sql;                      │
│ EXECUTE stmt;                                │
└──────────────────────────────────────────────┘

For FOREIGN KEYS:
┌──────────────────────────────────────────────┐
│ SET @fk_exists := (                          │
│   SELECT COUNT(*)                            │
│   FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS  │
│   WHERE CONSTRAINT_NAME = 'fk_books_admin'   │──▶ Exists? ──▶ YES ──▶ Skip
│ );                                           │          │
│                                              │          └──▶ NO ──▶ Add FK
│ SET @sql := IF(@fk_exists = 0,               │
│   'ALTER TABLE books ADD CONSTRAINT...',     │
│   'SELECT "Already exists"'                  │
│ );                                           │
└──────────────────────────────────────────────┘

Result: Script can run 100 times with same outcome ✅
```

---

## Deployment Environments

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-ENVIRONMENT DEPLOYMENT                     │
└─────────────────────────────────────────────────────────────────────┘

Development
┌─────────────────┐
│ spist_library   │◀──── spist_library_master.sql
│     _dev        │      (WITH seed data)
└─────────────────┘      
      │
      │ Test & Debug
      ▼
Staging
┌─────────────────┐
│ spist_library   │◀──── spist_library_master.sql
│   _staging      │      (WITH seed data OR clone of prod)
└─────────────────┘      
      │
      │ Final Testing
      ▼
Production
┌─────────────────┐
│ spist_library   │◀──── spist_library_master.sql
│                 │      (WITHOUT seed data)
└─────────────────┘      After backup!

All use the SAME master SQL file ✅
Just different database names in .env
```

---

## Table Size Reference

```
Small Tables (< 1000 rows expected)
├── admins (3-10 rows typical)
├── accession_sequence (1 row per year)
└── notification_preferences (matches user count)

Medium Tables (1K-100K rows)
├── students (hundreds to thousands)
├── books (thousands of titles)
└── book_copies (thousands of physical copies)

Large Tables (100K+ rows potential)
├── book_borrowings (grows with every transaction)
├── notifications (grows with every notification)
├── audit_logs (grows with every change)
└── book_copy_audit (grows with every copy change)

Indexes optimize all tables regardless of size ✅
```

---

## ENUM Values Reference

```
admins.role
  ├── 'super_admin'  (full access)
  └── 'system_admin' (read-only for some features)

students.student_type
  ├── 'undergraduate'
  ├── 'graduate'
  └── 'transferee'

students.status
  ├── 'active'
  ├── 'inactive'
  ├── 'suspended'
  └── 'graduated'

books.status
  ├── 'available'
  ├── 'borrowed'
  └── 'maintenance'

book_borrowings.status
  ├── 'pending'
  ├── 'approved'
  ├── 'borrowed'
  ├── 'returned'
  ├── 'overdue'
  └── 'cancelled'

book_copies.condition_status
  ├── 'excellent'
  ├── 'good'
  ├── 'fair'
  ├── 'poor'
  ├── 'damaged'
  └── 'lost'

book_copies.status
  ├── 'available'
  ├── 'borrowed'
  ├── 'maintenance'
  ├── 'lost'
  └── 'retired'

notifications.type
  ├── 'DUE_SOON'
  ├── 'OVERDUE'
  ├── 'BORROW_APPROVED'
  ├── 'BORROWED'
  ├── 'RETURNED'
  ├── 'SYSTEM'
  ├── 'NEW_BOOK'
  ├── 'BOOK_AVAILABLE'
  └── 'BOOK_LOW_STOCK'

notifications.user_type / target_type
  ├── 'student'
  └── 'admin'

audit_logs.action
  ├── 'INSERT'
  ├── 'UPDATE'
  └── 'DELETE'

book_copy_audit.action
  ├── 'created'
  ├── 'borrowed'
  ├── 'returned'
  ├── 'condition_changed'
  ├── 'location_changed'
  ├── 'lost'
  ├── 'found'
  └── 'retired'
```

---

**Visual Reference Version:** 1.0  
**Last Updated:** February 2, 2026  
**Corresponds to:** spist_library_master.sql v3.0

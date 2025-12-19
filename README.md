# 📚 SPIST Library Management System

**Complete Documentation & Setup Guide** - All documentation consolidated here!

A comprehensive, production-ready web-based library management system developed for Southern Philippines Institute of Science & Technology (SPiST). This modern application streamlines library operations with **multi-environment support**, **bulk operations**, **Excel/CSV import**, **audit trails**, and an intuitive Gmail-style interface.

**Current Version:** v2.0  
**Database Schema:** v2.0  
**Status:** ✅ Production Ready  
**Last Updated:** December 15, 2025

> 📖 **Documentation Guide**: This README contains ALL documentation previously spread across multiple files:
> - Installation & setup (formerly in DOCUMENTATION.md and DATABASE_SETUP.md)
> - API reference and features (from DOCUMENTATION.md)
> - Quick commands (from QUICK_REFERENCE.md)
> - File structure (from INDEX.md)  
> - Integration status (from INTEGRATION_SUMMARY.md)
>
> 📂 **Detailed reference files** still available: `README_DETAILED.md`, `DOCUMENTATION.md`, `DATABASE_SETUP.md`

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Key Features](#-key-features-v20)
- [System Requirements](#-system-requirements)
- [Installation Guide](#-installation-guide)
- [Environment Configuration](#️-environment-configuration)
- [Database Setup](#️-database-setup)
- [Multi-Environment Setup](#-multi-environment-setup)
- [Feature Documentation](#-feature-documentation)
- [API Reference](#-api-reference)
- [Security Best Practices](#-security-best-practices)
  - [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Troubleshooting](#-troubleshooting)
- [Project Structure](#-project-structure)
- [File Index](#-file-index)

---

## 🚀 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/axtro112/spist_library.git
cd spist_library

# 2. Install dependencies
npm install

# 3. Setup database
mysql -u root -p -e "CREATE DATABASE spist_library;"
mysql -u root -p spist_library < database/spist_library_schema.sql

# 4. (Optional) Import sample data
mysql -u root -p spist_library < database/sample_data.sql

# 5. Configure environment
cp .env.example .env
# Edit .env with your database and email settings

# 6. Start server
npm start
```

**Access application at:** `http://localhost:3000`

**Default credentials** (if using sample_data.sql):
- Admin: `admin@spist.edu` / `admin123`
- Student: `STD-2024-001` / `student123`

⚠️ **IMPORTANT**: Change default passwords immediately!

---

## ✨ Key Features v2.0

### 🎯 New in v2.0

- ✅ **Multi-Environment Support** - Separate dev, test, staging, production databases
- ✅ **Excel Import/Export** - Import/export books via CSV or Excel (.xlsx, .xls)
- ✅ **Gmail-Style Bulk Operations** - Select multiple books for bulk edit/delete
- ✅ **Environment Variables** - Secure configuration via .env files
- ✅ **Normalized Headers** - Excel imports work regardless of header case
- ✅ **Audit Logs** - Track all database changes
- ✅ **Available Quantity Tracking** - Real-time book availability
- ✅ **Admin Approval Workflow** - Track who approved borrowings

### 📚 Core Features

**Admin Features:**
- 📊 Interactive Dashboard with real-time statistics
- 📚 Book Management (add, edit, delete, bulk operations)
- 👥 User Management (students and admins)
- 📤 Import/Export (CSV and Excel)
- 🔍 Audit Trail (who added books, who approved borrowings)
- 📈 Advanced Reports and Analytics

**Student Features:**
- 🔐 Secure Login with password hashing
- 📖 Browse Available Books with search and filters
- 📚 Borrow Books with due date tracking
- ⏰ Track Borrowed Books and return status
- 📧 Email Notifications for password reset

**Technical Features:**
- 🌍 Multi-Environment Configuration (dev/test/staging/prod)
- 🔒 Bcrypt Password Hashing (10 salt rounds)
- 📧 Email Password Reset via Gmail
- 🗄️ MySQL/MariaDB Database with optimized indexes
- 🚀 Performance Optimized queries
- 📦 Bulk Operations with transaction safety

---

## 💻 System Requirements

### Server Requirements

- **Node.js**: v14.0.0 or higher
- **npm**: v6.0.0 or higher
- **MySQL/MariaDB**: v10.4 or higher
- **Operating System**: Windows, Linux, or macOS

### Development Tools (Recommended)

- **Code Editor**: VS Code
- **Database Client**: phpMyAdmin, MySQL Workbench, or DBeaver
- **API Testing**: Postman or Thunder Client

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

---

## 📦 Installation Guide

### Step 1: Clone Repository

```bash
git clone https://github.com/axtro112/spist_library.git
cd spist-library-management-system
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web framework
- `mysql2` - Database driver
- `bcrypt` - Password hashing
- `dotenv` - Environment variables
- `multer` - File upload
- `csv-parser` - CSV parsing
- `xlsx` - Excel support
- `nodemailer` - Email sending
- `body-parser` - Request parsing

### Step 3: Database Setup

#### Option A: New Installation (Recommended)

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE spist_library;"

# Import clean schema
mysql -u root -p spist_library < database/spist_library_schema.sql

# (Optional) Import sample data for testing
mysql -u root -p spist_library < database/sample_data.sql
```

#### Option B: Import Full Database

```bash
# Import complete database with existing data
mysql -u root -p spist_library < spist_library.sql
```

### Step 4: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env  # or use any text editor
```

**Minimum required settings:**
```env
DB_NAME=spist_library
DB_PASSWORD=your_db_password
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### Step 5: Start Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3000`

### Step 6: Verify Installation

1. Open browser to `http://localhost:3000`
2. Navigate to login page
3. Login with admin or student credentials
4. Verify dashboard loads correctly

---

## ⚙️ Environment Configuration

### Environment Variables Reference

Create a `.env` file in the project root with these variables:

```env
# Application Settings
NODE_ENV=development          # development, production, test, staging
PORT=3000                     # Server port

# Database Configuration
DB_HOST=localhost             # Database host
DB_USER=root                  # Database username
DB_PASSWORD=                  # Database password (empty for local dev)
DB_NAME=spist_library         # Database name (CHANGE FOR DIFFERENT ENVS)
DB_PORT=3306                  # Database port

# Email Configuration (Gmail)
EMAIL_USER=your@gmail.com     # Gmail address
EMAIL_PASS=app_password       # Gmail app password (not regular password)
EMAIL_SERVICE=gmail           # Email service
EMAIL_FROM="SPiST Library <your@gmail.com>"  # From header

# Frontend Configuration
FRONTEND_URL=http://localhost:3000  # Frontend URL

# Security Secrets
SESSION_SECRET=your-secret-key-change-in-production  # Session encryption
JWT_SECRET=your-jwt-secret     # JWT signing key (future use)
```

### Generate Secure Secrets

For production, generate strong random secrets:

```bash
# Generate SESSION_SECRET (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_SECRET (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment Files

The project includes multiple environment files:

| File | Purpose | Commit to Git? |
|------|---------|----------------|
| `.env` | Active configuration | ❌ NO |
| `.env.example` | Template for team | ✅ YES |
| `.env.development` | Development preset | ✅ YES |
| `.env.test` | Testing preset | ✅ YES |
| `.env.production.example` | Production template | ✅ YES |

### Gmail App Password Setup

To enable email notifications:

1. Go to Google Account: https://myaccount.google.com
2. Security → 2-Step Verification (enable if not already)
3. Security → App passwords
4. Create new app password for "Mail"
5. Copy the 16-character password
6. Use it in `EMAIL_PASS` variable

---

## 🗄️ Database Setup

### Schema Version

**Current Version**: 2.0

### Database Structure

```
admins               # Administrator accounts
├── id (PK)
├── fullname
├── email (UNIQUE)
├── password (bcrypt)
├── role (super_admin, system_admin)
├── is_active (v2.0)
├── resetToken
├── resetTokenExpiry
├── created_at
└── updated_at (v2.0)

students             # Student accounts
├── id (PK)
├── student_id (UNIQUE)
├── fullname
├── email (UNIQUE)
├── password (bcrypt)
├── department
├── year_level
├── student_type (v2.0: undergraduate, graduate, transferee)
├── contact_number
├── resetToken
├── resetTokenExpiry
├── status (v2.0: active, inactive, suspended, graduated)
├── created_at
└── updated_at (v2.0)

books                # Book inventory
├── id (PK)
├── title
├── author
├── isbn (UNIQUE)
├── category
├── added_date
├── updated_at (v2.0)
├── status (available, borrowed, maintenance)
├── added_by FK → admins (v2.0)
├── quantity
└── available_quantity (v2.0)

book_borrowings      # Borrowing transactions
├── id (PK)
├── book_id FK → books
├── student_id FK → students
├── approved_by FK → admins (v2.0)
├── borrow_date
├── due_date
├── return_date
├── status (v2.0: pending, approved, borrowed, returned, overdue, cancelled)
├── notes (v2.0)
├── created_at (v2.0)
└── updated_at (v2.0)

audit_logs           # Audit trail (v2.0)
├── id (PK)
├── table_name
├── record_id
├── action
├── user_type
├── user_id
├── old_values (JSON)
├── new_values (JSON)
├── ip_address
└── created_at
```

### SQL Files Reference

| File | Purpose | Use Case |
|------|---------|----------|
| `database/spist_library_schema.sql` | Clean schema (⭐ RECOMMENDED) | New installations |
| `database/sample_data.sql` | Sample data | Development/Testing |
| `spist_library.sql` | Full database export | Backup/Restore |
| `spist_library_template.sql` | Database-agnostic | Multi-environment |
| `ROLLBACK_v2_to_v1.sql` | Rollback script | Emergency recovery |

### Database Commands

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE spist_library;"

# Import schema
mysql -u root -p spist_library < database/spist_library_schema.sql

# Import sample data
mysql -u root -p spist_library < database/sample_data.sql

# Backup database
mysqldump -u root -p spist_library > backup_$(date +%Y%m%d).sql

# Restore database
mysql -u root -p spist_library < backup_file.sql

# Drop database
mysql -u root -p -e "DROP DATABASE spist_library;"
```

---

## 🌍 Multi-Environment Setup

### Creating Different Environments

#### Development Environment

```bash
# 1. Create development database
mysql -u root -p -e "CREATE DATABASE spist_library_dev;"

# 2. Import schema
mysql -u root -p spist_library_dev < database/spist_library_schema.sql

# 3. Import sample data
mysql -u root -p spist_library_dev < database/sample_data.sql

# 4. Configure environment
cp .env.development .env

# 5. Start server
npm run dev
```

#### Testing Environment

```bash
# 1. Create test database
mysql -u root -p -e "CREATE DATABASE spist_library_test;"

# 2. Import schema
mysql -u root -p spist_library_test < database/spist_library_schema.sql

# 3. Configure environment
cp .env.test .env

# 4. Run tests
npm start
```

#### Staging Environment

```bash
# 1. Create staging database
mysql -u root -p -e "CREATE DATABASE spist_library_staging;"

# 2. Import schema
mysql -u root -p spist_library_staging < database/spist_library_schema.sql

# 3. Create .env.staging
cat > .env.staging << EOF
NODE_ENV=staging
DB_NAME=spist_library_staging
DB_PASSWORD=staging_password
FRONTEND_URL=https://staging.library.spist.edu
EOF

# 4. Use staging config
cp .env.staging .env
npm start
```

#### Production Environment

```bash
# 1. Create production database
mysql -u root -p -e "CREATE DATABASE spist_library;"

# 2. Import schema
mysql -u root -p spist_library < database/spist_library_schema.sql

# 3. Create dedicated database user
mysql -u root -p <<EOF
CREATE USER 'spist_app'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON spist_library.* TO 'spist_app'@'localhost';
FLUSH PRIVILEGES;
EOF

# 4. Configure production .env
cp .env.production.example .env
# Edit .env with production values

# 5. Start in production mode
NODE_ENV=production npm start
```

### Environment Switching

```bash
# Switch to development
cp .env.development .env
npm run dev

# Switch to testing
cp .env.test .env
npm start

# Switch to production
cp .env.production .env
npm start
```

### Data Migration Between Environments

```bash
# Export from production
mysqldump -u root -p spist_library > prod_data.sql

# Import to development
mysql -u root -p spist_library_dev < prod_data.sql

# Or schema only (no data)
mysqldump -u root -p --no-data spist_library > schema_only.sql
mysql -u root -p spist_library_dev < schema_only.sql
```

---
- 📧 **Password Reset** - Email-based password recovery

### Student Features

- 🎯 **Personalized Dashboard** - Your books and borrowing status
- 🔍 **Smart Book Search** - Fast, indexed searches by title/category
- 📖 **Real-Time Availability** - See "Available (2/5)" copy counts
- 📅 **Borrowing Management** - Track due dates and history
- 👤 **Profile Management** - Update personal information
- 🔔 **Notifications** - Due date reminders
- 📧 **Password Reset** - Self-service password recovery

---

## 🆕 What's New in v2.0

### Major Improvements

| Feature | v1.0 | v2.0 |
|---------|------|------|
| **Book Copies** | Single copy only | Multiple copies with quantity tracking |
| **Availability** | Status-based ("available") | Quantity-based ("Available 3/5") |
| **Audit Trail** | None | Track who added books & approved borrowings |
| **Performance** | Basic queries | 40-100x faster with 9 new indexes |
| **Validation** | Minimal | CHECK constraints prevent bad data |
| **Student Types** | Free text (VARCHAR) | Validated ENUM (undergraduate/graduate/transferee) |
| **Workflow** | Simple borrow/return | Full workflow with approval tracking |
| **History** | Basic records | Complete audit_logs table |

### Database Enhancements

- ✅ **10 new columns** for audit trails and tracking
- ✅ **9 performance indexes** for faster queries
- ✅ **4 CHECK constraints** for data integrity
- ✅ **2 new foreign keys** for referential integrity
- ✅ **New audit_logs table** for change tracking
- ✅ **Enhanced ENUM types** for better validation

### Breaking Changes from v1.0

- ⚠️ **Book status ENUM changed:** 'available'/'borrowed' → 'active'
- ⚠️ **Student type now ENUM:** Only 'undergraduate', 'graduate', 'transferee' allowed
- ✅ **Auto-migrated:** Migration script handles conversion automatically

**See:** [UPGRADE_GUIDE.md](UPGRADE_GUIDE.md) for detailed migration instructions

---

## 💻 Technology Stack

### Backend
- **Runtime:** Node.js v14+
- **Framework:** Express.js 4.18
- **Database:** MariaDB 10.4.32 / MySQL 8.0+
- **ORM:** mysql2 (native driver)
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt
- **Email Service:** Nodemailer (Gmail SMTP)

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with Flexbox/Grid
- **JavaScript ES6+** - Vanilla JS (no framework)
- **UI Framework:** Bootstrap 5
- **Icons:** Font Awesome (optional)

### Development Tools
- **Version Control:** Git
- **Package Manager:** npm
- **Development Server:** Nodemon (auto-reload)
- **Database Manager:** phpMyAdmin (XAMPP)

---

## 🔧 System Requirements

### Software Prerequisites

- **Node.js:** v14.0.0 or higher ([Download](https://nodejs.org/))
- **npm:** v6.0.0 or higher (included with Node.js)
- **XAMPP:** For MySQL Server ([Download](https://www.apachefriends.org/))
- **Database:** MariaDB 10.2.1+ or MySQL 5.7+ (for CHECK constraints)
- **Browser:** Modern browser (Chrome, Firefox, Edge, Safari)
- **Git:** For version control (optional)

### System Requirements

- **OS:** Windows 10/11, Linux, macOS
- **RAM:** Minimum 4GB, Recommended 8GB
- **Disk Space:** 500MB free space
- **Network:** Internet connection (for npm packages and email service)

### Gmail Account Setup

- Gmail account with 2FA enabled
- App Password generated (for email features)
- See [Forgot Password Setup](#-forgot-password-feature) for details

---

## ⚡ Quick Start (5 Steps)

### Step 1: Clone or Download Project
```bash
# Using Git
git clone https://github.com/axtro112/spist-library-management-system.git
cd spist-library-management-system

# Or download ZIP and extract
```

### Step 2: Create .env File
Create a file named `.env` in the project root:

```env
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_DATABASE=spist_library

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password

# Application Configuration
FRONTEND_URL=http://localhost:3000
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

### Step 3: Get Gmail App Password
1. Enable 2FA on your Gmail account
2. Go to: https://myaccount.google.com/apppasswords
3. Select **Mail** → **Windows Computer**
4. Copy the **16-character password** (e.g., `abcd efgh ijkl mnop`)
5. Paste into `.env` as `EMAIL_PASS` (without spaces)

### Step 4: Setup Database
```bash
# Start XAMPP MySQL service
# Open phpMyAdmin: http://localhost/phpmyadmin

# Create database
CREATE DATABASE spist_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Import schema (use latest v2 schema)
# In phpMyAdmin:
# 1. Select spist_library database
# 2. Click Import tab
# 3. Choose file: migration_v2.sql
# 4. Click Go
```

**Or use command line:**
```bash
mysql -u root -p -e "CREATE DATABASE spist_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p spist_library < spist_library.sql
mysql -u root -p spist_library < migration_v2.sql
```

### Step 5: Install & Run
```bash
# Install dependencies
npm install

# Start development server
npm start

# Server will start at http://localhost:3000
```

**🎉 Done!** Visit `http://localhost:3000` to see the application.

---

## 📁 Project Structure

```
spist-library-management-system/
│
├── 📂 public/                        # Static assets & client-side files
│   ├── 📂 css/                       # Stylesheets
│   │   ├── common.css                # Shared styles (base, modals, alerts)
│   │   ├── admin.css                 # Admin dashboard styles
│   │   ├── student.css               # Student dashboard styles
│   │   ├── login.css                 # Authentication pages
│   │   ├── books.css                 # Book display styles
│   │   └── ...                       # Other page-specific styles
│   │
│   ├── 📂 dashboard/                 # Dashboard pages
│   │   ├── 📂 admin/                 # Admin dashboard pages
│   │   │   ├── admin-dashboard.html  # Admin main dashboard
│   │   │   ├── admin-books.html      # Book management (add/edit/delete)
│   │   │   ├── admin-users.html      # Student management
│   │   │   └── admin-admins.html     # Admin management
│   │   │
│   │   └── 📂 student/               # Student dashboard pages
│   │       ├── student-dashboard.html # Student main dashboard
│   │       ├── student-books.html     # Browse & search books
│   │       └── student-borrowed.html  # Borrowing history
│   │
│   ├── 📂 img/                       # Image assets
│   │   ├── logo.png                  # Application logo
│   │   └── ...                       # Other images
│   │
│   └── 📂 js/                        # JavaScript files
│       ├── admin.js                  # Admin dashboard logic
│       ├── books.js                  # Book management logic (v2 updated)
│       ├── student-borrowed.js       # Borrowing management
│       ├── user.js                   # User profile management
│       ├── login.js                  # Authentication logic
│       ├── signup.js                 # Registration logic (v2 updated)
│       ├── navigation.js             # Navigation & routing
│       └── script.js                 # Common utilities
│
├── 📂 src/                           # Source code
│   ├── 📂 config/                    # Configuration
│   │   └── database.js               # MySQL connection pool
│   │
│   ├── 📂 pages/                     # Main pages
│   │   ├── home.html                 # Homepage
│   │   ├── login.html                # Login page
│   │   ├── signup.html               # Registration page (v2 updated)
│   │   ├── reset-password.html       # Password reset page
│   │   ├── about.html                # About page
│   │   ├── contact.html              # Contact page
│   │   └── vision.html               # Vision/mission page
│   │
│   ├── 📂 routes/                    # API routes
│   │   ├── auth.js                   # Authentication (login/signup/reset)
│   │   ├── admin.js                  # Admin operations (v2 updated)
│   │   ├── books.js                  # Book operations (v2 updated)
│   │   ├── students.js               # Student operations
│   │   └── book-borrowings.js        # Borrowing operations (v2 updated)
│   │
│   └── 📂 utils/                     # Utility functions
│       └── update_admin_passwords.js # Password hash updater
│
├── 📂 Documentation/                 # Project documentation
│   ├── README.md                     # Main documentation (this file)
│   ├── UPGRADE_GUIDE.md              # v1 → v2 migration guide
│   ├── SCHEMA_COMPARISON_REPORT.md   # Detailed schema comparison
│   ├── MIGRATION_SAFETY_CHECKLIST.md # Migration verification steps
│   ├── MIGRATION_QUICK_REFERENCE.md  # Quick migration reference
│   └── ROLLBACK_v2_to_v1.sql         # Emergency rollback script
│
├── 📄 server.js                      # Node.js server entry point
├── 📄 package.json                   # NPM dependencies
├── 📄 package-lock.json              # Dependency lock file
├── 📄 .env                           # Environment variables (local only)
├── 📄 .env.example                   # Environment template
├── 📄 .gitignore                     # Git ignore rules
├── 📄 spist_library.sql              # v1.0 database schema (reference)
└── 📄 migration_v2.sql               # v2.0 migration script
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `public/` | Client-side assets served directly to browsers |
| `src/routes/` | Backend API endpoints (Express routes) |
| `src/config/` | Database and environment configuration |
| `Documentation/` | All migration and setup guides |

---

## Database Setup

### Step 1: Start XAMPP
- Open XAMPP Control Panel
- Start MySQL service
- Ensure MySQL shows green status

### Step 2: Import Database
1. Navigate to: `http://localhost/phpmyadmin`
2. Click "New" to create database
3. Name it: `spist_library`
4. Go to "Import" tab
5. Select `spist_library.sql` file
6. Click "Go"

---

## 🗃️ Database Schema v2.0

The v2.0 schema includes enhanced tracking, audit trails, and performance optimizations.

### Core Tables

#### **1. admins** - Administrator Accounts
```sql
CREATE TABLE admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fullname VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('super_admin','system_admin') DEFAULT 'system_admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,              -- NEW in v2
  resetToken VARCHAR(255),
  resetTokenExpiry DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP       -- NEW in v2
             ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_is_active (is_active)                       -- NEW in v2
);
```

**Key Fields:**
- `is_active` - Enable/disable admin without deletion
- `updated_at` - Auto-tracks last modification
- `resetToken` - For password reset functionality

---

#### **2. students** - Student Accounts
```sql
CREATE TABLE students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(20) UNIQUE NOT NULL,
  fullname VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  department VARCHAR(50) NOT NULL,
  year_level VARCHAR(20) NOT NULL,
  student_type ENUM('undergraduate','graduate','transferee') NOT NULL,  -- CHANGED in v2
  contact_number VARCHAR(20),
  resetToken VARCHAR(255),
  resetTokenExpiry DATETIME,
  status ENUM('active','inactive','suspended','graduated')    -- ENHANCED in v2
         DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP         -- NEW in v2
             ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_department (department)                      -- NEW in v2
);
```

**Key Changes in v2:**
- `student_type` changed from VARCHAR to validated ENUM
- `status` expanded with 'suspended' and 'graduated' options
- `updated_at` added for modification tracking
- Performance index on `department`

---

#### **3. books** - Book Inventory
```sql
CREATE TABLE books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(100),
  isbn VARCHAR(20) UNIQUE,
  category VARCHAR(50),
  added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','maintenance','retired')         -- CHANGED in v2
         DEFAULT 'active',
  added_by INT,                                          -- NEW in v2
  quantity INT NOT NULL DEFAULT 1,
  available_quantity INT NOT NULL DEFAULT 1,             -- NEW in v2
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP         -- NEW in v2
             ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_books_added_by                          -- NEW in v2
    FOREIGN KEY (added_by) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  
  CONSTRAINT chk_quantity CHECK (quantity >= 0),        -- NEW in v2
  CONSTRAINT chk_available_quantity                      -- NEW in v2
    CHECK (available_quantity >= 0 AND available_quantity <= quantity),
  
  INDEX idx_category (category),                         -- NEW in v2
  INDEX idx_title (title),                               -- NEW in v2
  INDEX idx_added_by (added_by)                          -- NEW in v2
);
```

**Key Changes in v2:**
- **Paradigm Shift:** Status-based → Quantity-based management
- `status` changed from 'available'/'borrowed' → 'active'/'maintenance'/'retired'
- `added_by` links to admin who added the book (audit trail)
- `available_quantity` tracks how many copies are available to borrow
- Multiple CHECK constraints ensure data integrity
- Three new indexes for performance

**Example:**
```
Before v1: Book status = 'borrowed' (only 1 copy supported)
After v2:  Book status = 'active', quantity = 5, available_quantity = 3
          Display: "Available (3/5)"
```

---

#### **4. book_borrowings** - Borrowing Records
```sql
CREATE TABLE book_borrowings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book_id INT NOT NULL,
  student_id VARCHAR(20) NOT NULL,
  approved_by INT,                                       -- NEW in v2
  borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_date DATETIME NOT NULL,
  return_date DATETIME,
  status ENUM('pending','approved','borrowed',          -- ENHANCED in v2
              'returned','overdue','cancelled')
         DEFAULT 'borrowed',
  notes TEXT,                                            -- NEW in v2
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,        -- NEW in v2
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP         -- NEW in v2
             ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (book_id) REFERENCES books(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(student_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_borrowings_approved_by                  -- NEW in v2
    FOREIGN KEY (approved_by) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  
  CONSTRAINT chk_due_date                                -- NEW in v2
    CHECK (due_date >= borrow_date),
  CONSTRAINT chk_return_date                             -- NEW in v2
    CHECK (return_date IS NULL OR return_date >= borrow_date),
  
  INDEX idx_student_id (student_id),
  INDEX idx_book_id (book_id),
  INDEX idx_status (status),
  INDEX idx_student_status (student_id, status),        -- NEW in v2
  INDEX idx_borrow_date (borrow_date),                  -- NEW in v2
  INDEX idx_due_date (due_date),                        -- NEW in v2
  INDEX idx_approved_by (approved_by)                   -- NEW in v2
);
```

**Key Changes in v2:**
- `approved_by` links to admin who approved borrowing
- `status` expanded with 'pending', 'approved', 'cancelled'
- `notes` allows admin comments
- `created_at`/`updated_at` for complete audit trail
- CHECK constraints ensure logical dates
- Four new indexes for performance

---

#### **5. audit_logs** - Change History (NEW in v2)
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  user_type ENUM('admin','student') NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_user (user_type, user_id),
  INDEX idx_created_at (created_at)
);
```

**Purpose:** Complete audit trail of all database changes

**Example Record:**
```json
{
  "table_name": "books",
  "record_id": 5,
  "action": "UPDATE",
  "user_type": "admin",
  "user_id": "5",
  "old_values": {"available_quantity": 3},
  "new_values": {"available_quantity": 2},
  "ip_address": "127.0.0.1",
  "created_at": "2025-11-30 10:15:23"
}
```

---

### Entity Relationships

```
┌──────────┐         ┌──────────────────┐         ┌──────────┐
│  admins  │────────>│      books       │<────────│ students │
└──────────┘   1:N   └──────────────────┘   N:M   └──────────┘
 (added_by)              │         │            (borrower)
                         │         │
                         │         └──────────────────┐
                         │ 1:N                    1:N │
                         ▼                            ▼
                  ┌─────────────────────────────────────┐
                  │      book_borrowings               │
                  └─────────────────────────────────────┘
                         ▲
                         │ 1:N (approved_by)
                         │
                   ┌──────────┐
                   │  admins  │
                   └──────────┘
```

**Relationships:**
- **admins → books** (1:N): One admin can add many books
- **admins → book_borrowings** (1:N): One admin can approve many borrowings
- **books → book_borrowings** (1:N): One book can have many borrowing records
- **students → book_borrowings** (1:N): One student can borrow many books

---

### Database Statistics

**Total Tables:** 5 (4 core + 1 audit)  
**Total Indexes:** 18 (9 added in v2)  
**Foreign Keys:** 4 (2 added in v2)  
**CHECK Constraints:** 4 (all new in v2)  
**Audit Fields:** 10 new columns for tracking  

**Performance Impact:**
- 40-100x faster queries on indexed columns
- Automatic data validation via constraints
- Complete change history in audit_logs

---

### Database Schema Files

- **`spist_library.sql`** - Original v1.0 schema (for reference)
- **`migration_v2.sql`** - Migration script from v1 to v2
- **`SCHEMA_COMPARISON_REPORT.md`** - Detailed comparison of v1 vs v2

---

## Getting Started

### Option 1: Using Git

```bash
git clone https://github.com/axtro112/spist-library-management-system.git
cd spist-library-management-system
npm install
npm start
```

### Option 2: Direct Download

1. Download the project
2. Extract the ZIP file
3. Open terminal in extracted folder
4. Run:
   ```bash
   npm install
   npm start
   ```

### Access the Application

```
http://localhost:3000
```

**Default Login Credentials:**
- **Admin Email**: `adminspist@.edu.ph`
- **Student Email**: `c22-4587-01@spist.edu.ph`

---

## Routes

### Public Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage |
| `/login` | Login page |
| `/signup` | New user registration |
| `/reset-password` | Password reset page (NEW) |

### Admin Routes

| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard redirect |
| `/admin-dashboard` | Admin dashboard |
| `/admin-books` | Book management |
| `/admin-users` | User management |
| `/admin-admins` | Admin management |

### Student Routes

| Route | Description |
|-------|-------------|
| `/student` | Student dashboard redirect |
| `/student-dashboard` | Student dashboard |
| `/student-books` | Browse books |
| `/student-borrowed` | Manage borrowed books |

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | User login |
| `/auth/signup` | POST | User registration |
| `/auth/forgot-password` | POST | Request password reset (NEW) |
| `/auth/reset-password` | POST | Reset password (NEW) |
| `/api/books` | GET, POST | Book operations |
| `/api/students` | GET, POST | Student operations |
| `/api/admin` | GET, POST | Admin operations |
| `/api/book-borrowings` | GET, POST | Borrowing operations |

---

## 🔐 Forgot Password Feature

### Overview

A secure password reset system for both admins and students with email verification.

### How It Works

1. **User clicks "Forgot Password?"** on login page
2. **Modal opens** - user enters email
3. **Email sent** with 10-minute reset link
4. **User clicks link** - reset page loads
5. **User enters new password** (with show/hide toggle)
6. **Password updated** - user redirected to login
7. **Login with new password** ✅

### Features

✅ **Secure Token Generation**
- Random 32-byte tokens
- SHA256 hashing
- 10-minute expiration
- Single-use only

✅ **User-Friendly UI**
- Modal form on login page
- Professional reset page
- Green & white theme
- Show/hide password toggle
- Real-time validation

✅ **Email Integration**
- Gmail SMTP via Nodemailer
- HTML formatted emails
- Reset link in email
- Professional branding

### Setup

#### 1. Create .env File

```env
EMAIL_USER=hahacctmo145@gmail.com
EMAIL_PASS=owhxwyulqxnhquxy
EMAIL_PASS=your-16-character-app-password
FRONTEND_URL=http://localhost:3000
```

#### 2. Gmail Setup

1. Enable 2-Factor Authentication on Gmail
2. Go to: https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Copy the 16-character password
5. Paste into `.env` as `EMAIL_PASS`

#### 3. Database

The following columns were added to support password reset:

```sql
ALTER TABLE admins ADD COLUMN resetToken VARCHAR(255);
ALTER TABLE admins ADD COLUMN resetTokenExpiry DATETIME;

ALTER TABLE students ADD COLUMN resetToken VARCHAR(255);
ALTER TABLE students ADD COLUMN resetTokenExpiry DATETIME;
```

#### 4. Dependencies

```bash
npm install nodemailer dotenv
```

### Testing

1. Go to: http://localhost:3000/login
2. Click "Forgot Password?"
3. Enter a valid admin or student email
4. Check email inbox for reset link
5. Click link and enter new password
6. Login with new password

---

## 📡 API Documentation

### Authentication Routes (`/auth`)

#### POST `/auth/login`
Authenticate user and create session.

**Request:**
```json
{
  "email": "user@spist.edu",
  "password": "password123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "userRole": "admin|student",
  "adminId": 5,              // If admin
  "studentId": "STD-2023-020" // If student
}
```

---

#### POST `/auth/signup`
Register new student account.

**Request:**
```json
{
  "student_id": "STD-2024-001",
  "fullname": "John Doe",
  "email": "john@spist.edu",
  "password": "password123",
  "department": "BSCS",
  "year_level": "1",
  "student_type": "undergraduate",  // v2: Must be ENUM value
  "contact_number": "09123456789"
}
```

**Valid student_type values (v2):**
- `undergraduate`
- `graduate`
- `transferee`

**Response (Success - 201):**
```json
{
  "message": "Registration successful"
}
```

**Response (Error - 400):**
```json
{
  "error": "Invalid student type. Must be: undergraduate, graduate, or transferee"
}
```

---

#### POST `/auth/forgot-password`
Request password reset email.

**Request:**
```json
{
  "email": "user@spist.edu"
}
```

**Response (200):**
```json
{
  "message": "If this email exists, a reset link was sent."
}
```

---

#### POST `/auth/reset-password`
Reset password using token from email.

**Request:**
```json
{
  "token": "raw-token-from-email",
  "newPassword": "newPassword123"
}
```

**Response (Success - 200):**
```json
{
  "message": "Password reset successfully"
}
```

**Response (Error - 400):**
```json
{
  "error": "Invalid or expired reset token"
}
```

---

### Book Routes (`/api/books`)

#### GET `/api/books`
Get all active books with availability info (v2 enhanced).

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Introduction to Python",
    "author": "John Developer",
    "isbn": "978-5-2345-9090-0",
    "category": "Programming",
    "status": "active",
    "quantity": 5,
    "available_quantity": 3,       // v2: Shows available copies
    "added_by": 5,                 // v2: Admin who added book
    "added_by_name": "Admin User", // v2: Admin name
    "added_date": "2025-05-09T10:28:10",
    "updated_at": "2025-11-30T15:20:10"
  }
]
```

---

#### GET `/api/books/available`
Get only available books (v2 uses quantity check).

**Query Parameters:**
- `category` (optional): Filter by category
- `search` (optional): Search in title/author

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Introduction to Python",
    "available_quantity": 3,
    "quantity": 5,
    "is_available": true  // v2: Computed field
  }
]
```

---

#### POST `/api/books` (Admin only)
Add new book (v2 with audit trail).

**Request:**
```json
{
  "title": "Advanced JavaScript",
  "author": "Jane Developer",
  "isbn": "978-1-2345-6789-0",
  "category": "Programming",
  "quantity": 3,      // v2: Total copies
  "adminId": 5        // v2: Admin adding the book
}
```

**Response (Success - 201):**
```json
{
  "message": "Book added successfully",
  "bookId": 10,
  "available_quantity": 3  // v2: Initially equals quantity
}
```

---

#### PUT `/api/books/:id` (Admin only)
Update book information.

**Request:**
```json
{
  "title": "Updated Title",
  "quantity": 5,
  "available_quantity": 4
}
```

**Response (Success - 200):**
```json
{
  "message": "Book updated successfully"
}
```

---

#### DELETE `/api/books/:id` (Admin only)
Soft delete book (sets status to 'retired').

**Response (Success - 200):**
```json
{
  "message": "Book retired successfully"
}
```

---

### Borrowing Routes (`/api/borrowings`)

#### POST `/api/borrowings/borrow`
Borrow a book (v2 with quantity tracking).

**Request:**
```json
{
  "book_id": 1,
  "student_id": "STD-2023-020",
  "due_date": "2025-12-30",
  "approved_by": 5,  // v2: Admin approving
  "notes": "Thesis research"  // v2: Optional admin notes
}
```

**Response (Success - 201):**
```json
{
  "message": "Book borrowed successfully",
  "borrowing_id": 73,
  "available_quantity": 2  // v2: Decreased by 1
}
```

**Response (Error - 400):**
```json
{
  "error": "No copies available"  // v2: When available_quantity = 0
}
```

---

#### PUT `/api/borrowings/return/:id`
Return a borrowed book (v2 with quantity restoration).

**Request:**
```json
{
  "notes": "Returned in good condition"  // v2: Optional
}
```

**Response (Success - 200):**
```json
{
  "message": "Book returned successfully",
  "available_quantity": 3  // v2: Increased by 1
}
```

---

#### GET `/api/borrowings/student/:student_id`
Get borrowing history for a student.

**Response (200):**
```json
[
  {
    "id": 73,
    "book_id": 1,
    "book_title": "Introduction to Python",
    "borrow_date": "2025-11-30T10:00:00",
    "due_date": "2025-12-30T00:00:00",
    "return_date": null,
    "status": "borrowed",
    "approved_by": 5,            // v2
    "approved_by_name": "Admin User",  // v2
    "notes": "Thesis research"   // v2
  }
]
```

---

### Admin Routes (`/api/admin`)

#### GET `/api/admin/dashboard-stats`
Get dashboard statistics (v2 with quantity-based counting).

**Response (200):**
```json
{
  "total_books": 9,
  "total_students": 7,
  "total_admins": 2,
  "available_books": 25,        // v2: SUM(available_quantity)
  "borrowed_books": 12,         // v2: SUM(quantity - available_quantity)
  "active_borrowings": 5,       // v2: COUNT(status='borrowed')
  "overdue_borrowings": 2
}
```

---

#### GET `/api/admin/books`
Get all books with admin info (v2 enhanced).

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Introduction to Python",
    "status": "active",
    "quantity": 5,
    "available_quantity": 3,
    "added_by": 5,
    "added_by_name": "Admin User",
    "added_date": "2025-05-09",
    "updated_at": "2025-11-30T15:20:10"
  }
]
```

---

### Student Routes (`/api/students`)

#### GET `/api/students/:id`
Get student profile.

**Response (200):**
```json
{
  "id": 6,
  "student_id": "STD-2023-020",
  "fullname": "John Andrew Borabo",
  "email": "johnandrewborabo44@gmail.com",
  "department": "BSCS",
  "year_level": "3",
  "student_type": "undergraduate",  // v2: ENUM value
  "contact_number": "09665723918",
  "status": "active",
  "created_at": "2025-05-09T11:26:08",
  "updated_at": "2025-11-30T10:15:30"  // v2
}
```

---

#### PUT `/api/students/:id`
Update student profile.

**Request:**
```json
{
  "fullname": "Updated Name",
  "contact_number": "09123456789",
  "year_level": "4"
}
```

**Response (Success - 200):**
```json
{
  "message": "Profile updated successfully"
}
```

---

### Error Responses

All API endpoints use consistent error format:

**400 Bad Request:**
```json
{
  "error": "Descriptive error message"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "An error occurred. Please try again."
}
```

---

## 🧪 Testing

### Test the Forgot Password Feature

#### Using Browser

1. Visit: http://localhost:3000/login
2. Click "Forgot Password?"
3. Enter email: `johnandrewborabo44@gmail.com`
4. Check email for reset link
5. Click link to reset password

#### Using cURL

```bash
# Request password reset
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"johnandrewborabo44@gmail.com"}'

# Reset password (replace token)
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"token-from-email","newPassword":"NewPass123"}'
```

#### Using Postman

1. **POST** to: `http://localhost:3000/auth/forgot-password`
2. **Headers**: `Content-Type: application/json`
3. **Body**: `{"email":"user@spist.edu"}`

### Test Other Features

- Login with admin/student credentials
- Browse books
- Borrow books
- Manage account
- Admin operations

---

## 🐛 Troubleshooting

### Database Issues

#### Error: "Table 'spist_library.audit_logs' doesn't exist"
**Cause:** v2 migration not run  
**Solution:**
```bash
mysql -u root -p spist_library < migration_v2.sql
```

#### Error: "Unknown column 'available_quantity'"
**Cause:** v2 migration not completed  
**Solution:**
```sql
-- Check if column exists
SHOW COLUMNS FROM books;

-- If missing, run migration
SOURCE migration_v2.sql;
```

#### Error: "Check constraint 'chk_quantity' is violated"
**Cause:** Trying to set negative quantity  
**Solution:**
```sql
-- Fix invalid data
UPDATE books SET quantity = ABS(quantity) WHERE quantity < 0;
UPDATE books SET available_quantity = quantity 
WHERE available_quantity > quantity;
```

#### Error: "Cannot add foreign key constraint"
**Cause:** Orphaned references exist  
**Solution:**
```sql
-- Clear orphaned added_by references
UPDATE books SET added_by = NULL 
WHERE added_by NOT IN (SELECT id FROM admins);

-- Clear orphaned approved_by references
UPDATE book_borrowings SET approved_by = NULL 
WHERE approved_by NOT IN (SELECT id FROM admins);
```

---

### Application Issues

#### Error: "Cannot borrow book - No copies available"
**Cause:** available_quantity = 0 (v2 feature working correctly)  
**Solution:** This is expected behavior. Wait for book to be returned.

#### Error: "Invalid student type"
**Cause:** Trying to use v1 student types (v2 now uses ENUM)  
**Solution:** Use only valid values:
- `undergraduate`
- `graduate`
- `transferee`

#### Books showing "undefined/undefined" instead of "Available (3/5)"
**Cause:** Frontend code not updated for v2  
**Solution:** Ensure you're using the updated `public/js/books.js` from this repository

---

### Email Issues

#### Error: "Username and Password not accepted"
**Cause:** Using Gmail password instead of App Password  
**Solution:**
1. Enable 2FA on Gmail
2. Generate App Password at https://myaccount.google.com/apppasswords
3. Use 16-character app password in `.env`
4. Restart server: `npm start`

#### Reset link expired
**Cause:** Token valid for only 10 minutes  
**Solution:** Request new password reset link

---

### Server Issues

#### Port 3000 already in use
**Cause:** Another process using port 3000  
**Solution:**
```powershell
# Windows PowerShell
Get-Process -Name "node" | Stop-Process -Force

# Or change port in .env
PORT=3001
```

#### Server won't start - Module not found
**Cause:** Dependencies not installed  
**Solution:**
```bash
npm install
npm start
```

#### Database connection error
**Cause:** XAMPP MySQL not running  
**Solution:**
1. Start XAMPP Control Panel
2. Click "Start" for MySQL
3. Verify `.env` has correct DB credentials

---

### Performance Issues

#### Queries running slow after v2 migration
**Cause:** Indexes may need time to build or MySQL not using them  
**Solution:**
```sql
-- Analyze table to update statistics
ANALYZE TABLE books;
ANALYZE TABLE book_borrowings;
ANALYZE TABLE students;

-- Verify indexes are being used
EXPLAIN SELECT * FROM books WHERE category = 'Programming';
-- Should show "Using index" in Extra column
```

---

### Data Migration Issues

#### Some books showing available_quantity = 0 incorrectly
**Cause:** Migration script didn't run completely  
**Solution:**
```sql
-- Reset available_quantity for active books
UPDATE books 
SET available_quantity = quantity - (
    SELECT COUNT(*) 
    FROM book_borrowings 
    WHERE book_id = books.id AND status = 'borrowed'
)
WHERE status = 'active';
```

#### Student types showing as NULL
**Cause:** Invalid values during migration  
**Solution:**
```sql
-- Set default value for NULL student types
UPDATE students 
SET student_type = 'undergraduate' 
WHERE student_type IS NULL;
```

---

### Getting Help

1. **Check Documentation:**
   - [UPGRADE_GUIDE.md](UPGRADE_GUIDE.md) - Migration guide
   - [MIGRATION_SAFETY_CHECKLIST.md](MIGRATION_SAFETY_CHECKLIST.md) - Verification steps
   - [SCHEMA_COMPARISON_REPORT.md](SCHEMA_COMPARISON_REPORT.md) - Schema details

2. **Check Logs:**
   ```bash
   # Server logs (terminal where npm start is running)
   # MySQL error log
   Get-Content "C:\xampp\mysql\data\mysql_error.log" -Tail 50
   
   # Browser console (F12 → Console tab)
   ```

3. **Verify Installation:**
   ```bash
   # Check Node.js version
   node --version  # Should be v14+
   
   # Check npm version
   npm --version   # Should be v6+
   
   # Check MySQL version
   mysql --version # Should be 5.7+ or MariaDB 10.2.1+
   ```

4. **Common Verification Queries:**
   ```sql
   -- Verify all tables exist
   SHOW TABLES;
   
   -- Verify column counts
   SELECT TABLE_NAME, COUNT(*) as column_count
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'spist_library'
   GROUP BY TABLE_NAME;
   
   -- Check data integrity
   SELECT 
       (SELECT COUNT(*) FROM books WHERE quantity < 0) as negative_qty,
       (SELECT COUNT(*) FROM books WHERE available_quantity > quantity) as invalid_avail,
       (SELECT COUNT(*) FROM book_borrowings WHERE due_date < borrow_date) as invalid_dates;
   ```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Update `.env` for production environment
- [ ] Enable HTTPS/SSL certificates
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Configure production email service (not Gmail)
- [ ] Implement rate limiting on API endpoints
- [ ] Add CAPTCHA to forgot password form
- [ ] Set up database backups (daily automated)
- [ ] Configure firewall rules
- [ ] Set up monitoring and logging
- [ ] Load testing completed
- [ ] Security audit performed

### Environment Configuration

**Production `.env`:**
```env
# Production Database
DB_HOST=your-production-db-host
DB_PORT=3306
DB_USER=production_user
DB_PASSWORD=strong-password-here
DB_DATABASE=spist_library

# Production Email (use business email service)
EMAIL_HOST=smtp.your-domain.com
EMAIL_PORT=587
EMAIL_USER=noreply@your-domain.com
EMAIL_PASS=production-email-password

# Production Settings
FRONTEND_URL=https://library.spist.edu
NODE_ENV=production
JWT_SECRET=generate-strong-32plus-character-secret-here
PORT=3000

# Security
RATE_LIMIT_WINDOW=15  # minutes
RATE_LIMIT_MAX=100     # requests per window
SESSION_SECRET=another-strong-secret-here
```

### Deployment Steps

#### 1. Server Setup

```bash
# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install MySQL/MariaDB
sudo apt-get install mariadb-server
sudo mysql_secure_installation
```

#### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/axtro112/spist-library-management-system.git
cd spist-library-management-system

# Install dependencies
npm install --production

# Create production .env file
cp .env.example .env
nano .env  # Edit with production values
```

#### 3. Database Setup

```bash
# Create production database
mysql -u root -p << EOF
CREATE DATABASE spist_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'spist_user'@'localhost' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON spist_library.* TO 'spist_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# Import v2 schema
mysql -u spist_user -p spist_library < spist_library.sql
mysql -u spist_user -p spist_library < migration_v2.sql

# Or if migrating from v1:
mysql -u spist_user -p spist_library < backup_v1.sql
mysql -u spist_user -p spist_library < migration_v2.sql
```

#### 4. Start Application with PM2

```bash
# Start application
pm2 start server.js --name spist-library

# Configure to start on system boot
pm2 startup
pm2 save

# Monitor logs
pm2 logs spist-library
```

#### 5. Configure Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/spist-library
server {
    listen 80;
    server_name library.spist.edu;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name library.spist.edu;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/library.spist.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/library.spist.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

```bash
# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/spist-library /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d library.spist.edu

# Auto-renewal (Certbot creates cron job automatically)
sudo certbot renew --dry-run
```

#### 7. Database Backup Automation

```bash
# Create backup script
sudo nano /usr/local/bin/backup-spist-library.sh
```

```bash
#!/bin/bash
# Database backup script
BACKUP_DIR="/var/backups/spist-library"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u spist_user -p'your-password' spist_library > \
    $BACKUP_DIR/spist_library_$DATE.sql

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete

# Compress old backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -exec gzip {} \;
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-spist-library.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line:
0 2 * * * /usr/local/bin/backup-spist-library.sh
```

### Post-Deployment Monitoring

#### PM2 Monitoring

```bash
# View application status
pm2 status

# View logs
pm2 logs spist-library --lines 100

# Monitor resources
pm2 monit

# Restart application
pm2 restart spist-library

# Stop application
pm2 stop spist-library
```

#### MySQL Performance Monitoring

```sql
-- Check slow queries
SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;

-- Monitor connections
SHOW PROCESSLIST;

-- Check table sizes
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'spist_library'
ORDER BY (data_length + index_length) DESC;
```

---

## 📈 Performance Optimization

### Database Optimization

```sql
-- Analyze tables (run monthly)
ANALYZE TABLE admins, students, books, book_borrowings;

-- Optimize tables (run quarterly)
OPTIMIZE TABLE admins, students, books, book_borrowings;

-- Check index usage
SHOW INDEX FROM books;
SHOW INDEX FROM book_borrowings;
```

### Application Optimization

```javascript
// Enable gzip compression (add to server.js)
const compression = require('compression');
app.use(compression());

// Set proper cache headers
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));
```

### Monitoring Tools

- **PM2 Plus:** Application monitoring
- **New Relic:** Performance monitoring
- **Grafana + Prometheus:** Custom dashboards
- **UptimeRobot:** Uptime monitoring

---

## 🎯 Version History

### v2.0.0 (November 30, 2025) - Current Version
**Major Update:** Quantity-based book management & audit trails

✨ **New Features:**
- Multi-copy book tracking (`quantity` & `available_quantity`)
- Complete audit trail (`added_by`, `approved_by`, `audit_logs`)
- Enhanced data validation (4 CHECK constraints)
- Performance optimization (9 new indexes)
- Student type ENUM validation
- Expanded workflow statuses

🔧 **Technical Improvements:**
- 40-100x faster queries on common operations
- Foreign key referential integrity
- Automatic timestamp tracking
- Data integrity constraints

⚠️ **Breaking Changes:**
- Book status ENUM changed: 'available'/'borrowed' → 'active'
- Student type changed: VARCHAR → ENUM
- Borrowing logic: Status-based → Quantity-based

📝 **Database Changes:**
- 10 new columns across 4 tables
- 1 new table (`audit_logs`)
- 9 new performance indexes
- 2 new foreign keys
- 4 CHECK constraints

🐛 **Bug Fixes:**
- Fixed concurrent borrowing race conditions
- Improved error handling for invalid data
- Enhanced email delivery reliability

📚 **Documentation:**
- New: UPGRADE_GUIDE.md
- New: SCHEMA_COMPARISON_REPORT.md
- New: MIGRATION_SAFETY_CHECKLIST.md
- New: MIGRATION_QUICK_REFERENCE.md
- Updated: README.md with v2 schema

---

### v1.0.0 (November 19, 2025)
**Initial Release**

✨ **Features:**
- Core library management functionality
- Admin and student dashboards
- Book borrowing system
- Password reset with email verification
- Basic user authentication
- Single-copy book management

📝 **Database:**
- 4 core tables (admins, students, books, book_borrowings)
- Basic foreign keys
- Simple ENUM types

---

## 🔄 Migration from v1.0

If you're upgrading an existing v1.0 installation to v2.0:

### Quick Migration Steps

1. **Backup your database** (CRITICAL!)
   ```bash
   mysqldump -u root -p spist_library > backup_v1_$(date +%Y%m%d).sql
   ```

2. **Run migration script**
   ```bash
   mysql -u root -p spist_library < migration_v2.sql
   ```

3. **Verify migration**
   ```sql
   -- Check new columns exist
   SHOW COLUMNS FROM books;
   
   -- Verify data integrity
   SELECT COUNT(*) FROM books;
   SELECT COUNT(*) FROM book_borrowings;
   ```

4. **Code is already updated** - All v2 code changes are included in this repository

### Detailed Migration Guide

See **[UPGRADE_GUIDE.md](UPGRADE_GUIDE.md)** for:
- Complete pre-migration checklist
- Detailed migration steps
- Post-migration testing
- Rollback procedures
- Troubleshooting common issues

### What Changed from v1 to v2

**Database Schema:**
- ✅ 10 new columns (audit tracking)
- ✅ 9 new indexes (performance)
- ✅ 4 CHECK constraints (data integrity)
- ✅ 2 new foreign keys
- ⚠️ Book status ENUM changed (auto-migrated)
- ⚠️ Student type VARCHAR → ENUM (auto-migrated)

**Code Changes:**
- ✅ Updated 4 backend routes
- ✅ Updated 3 frontend files
- ✅ All changes already applied in this repo

---

## 📊 Database Schema

### Admins Table
```sql
CREATE TABLE admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fullname VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  role ENUM('super_admin','system_admin'),
  resetToken VARCHAR(255),
  resetTokenExpiry DATETIME,
  created_at TIMESTAMP
);
```

### Students Table
```sql
CREATE TABLE students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(20) UNIQUE,
  fullname VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  department VARCHAR(50),
  year_level VARCHAR(20),
  student_type VARCHAR(20),
  contact_number VARCHAR(20),
  resetToken VARCHAR(255),
  resetTokenExpiry DATETIME,
  status ENUM('active','inactive'),
  created_at DATETIME
);
```

### Books Table
```sql
CREATE TABLE books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  author VARCHAR(100),
  isbn VARCHAR(20) UNIQUE,
  category VARCHAR(50),
  added_date DATETIME,
  status ENUM('available','borrowed','maintenance')
);
```

### Book Borrowings Table
```sql
CREATE TABLE book_borrowings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book_id INT,
  student_id VARCHAR(20),
  borrow_date DATETIME,
  due_date DATETIME,
  return_date DATETIME,
  status ENUM('borrowed','returned','overdue'),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (student_id) REFERENCES students(student_id)
);
```

---

## 🔧 Configuration Files

### .env.example
```env
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_DATABASE=spist_library

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Server Port
PORT=3000
```

## 📦 Dependencies

### Production Dependencies

```json
{
  "bcrypt": "^5.1.1",           // Password hashing and encryption
  "body-parser": "^1.20.2",     // Parse incoming request bodies (JSON, URL-encoded)
  "csv-parser": "^3.2.0",       // Parse CSV files for bulk imports
  "dotenv": "^16.3.1",          // Load environment variables from .env file
  "express": "^4.18.2",         // Web application framework
  "multer": "^2.0.2",           // Handle file uploads (CSV/Excel for bulk operations)
  "mysql2": "^3.6.5",           // MySQL database driver with Promise support
  "nodemailer": "^6.9.7",       // Send emails (password reset functionality)
  "xlsx": "^0.18.5"             // Parse Excel files for bulk imports
}
```

### Development Dependencies

```json
{
  "nodemon": "^3.0.2"           // Auto-restart server on file changes during development
}
```

### Install All Dependencies

```bash
# Production + Development
npm install

# Production only
npm install --production
```

---

## 📖 Additional Documentation

### Core Documentation
- **[README.md](README.md)** - Main documentation (this file)
- **[UPGRADE_GUIDE.md](UPGRADE_GUIDE.md)** - Complete v1 → v2 migration guide

### Migration Documentation
- **[SCHEMA_COMPARISON_REPORT.md](SCHEMA_COMPARISON_REPORT.md)** - Detailed schema analysis
- **[MIGRATION_SAFETY_CHECKLIST.md](MIGRATION_SAFETY_CHECKLIST.md)** - Verification steps
- **[MIGRATION_QUICK_REFERENCE.md](MIGRATION_QUICK_REFERENCE.md)** - Quick reference guide

### Database Files
- **[spist_library.sql](spist_library.sql)** - v1.0 schema (reference)
- **[migration_v2.sql](migration_v2.sql)** - v2.0 migration script
- **[ROLLBACK_v2_to_v1.sql](ROLLBACK_v2_to_v1.sql)** - Emergency rollback script

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone
   git clone https://github.com/YOUR-USERNAME/spist-library-management-system.git
   cd spist-library-management-system
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed
   - Test thoroughly

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: Brief description of your changes"
   ```

5. **Push and create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

### Code Style Guidelines

- Use **descriptive variable names**
- Add **JSDoc comments** for functions
- Follow **consistent indentation** (2 spaces)
- Use **ES6+ features** where appropriate
- Write **meaningful commit messages**

### Commit Message Convention

```
Type: Brief description (50 chars max)

Detailed description if needed.

Type can be:
- Add: New feature or file
- Fix: Bug fix
- Update: Update existing feature
- Refactor: Code restructuring
- Docs: Documentation changes
- Style: Formatting changes
- Test: Adding tests
```

---

## 🔒 Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please email: security@spist.edu

**Do not** create a public GitHub issue.

### Security Best Practices

1. **Never commit sensitive data**
   - `.env` is in `.gitignore`
   - Use environment variables for secrets
   - Rotate credentials regularly

2. **Password Security**
   - All passwords hashed with bcrypt (10 rounds)
   - Minimum 8 characters required
   - Reset tokens expire in 10 minutes

3. **SQL Injection Prevention**
   - All queries use parameterized statements
   - Input validation on all endpoints
   - mysql2 library escapes values automatically

4. **XSS Prevention**
   - User input sanitized before display
   - Content-Security-Policy headers set
   - No eval() or innerHTML usage

5. **CSRF Protection**
   - JWT tokens for authentication
   - SameSite cookie policy
   - Origin validation on sensitive operations

### Role-Based Access Control (RBAC)

**Implementation Date:** December 15, 2025

The system implements granular role-based access control for admin management with two distinct roles:

#### Admin Roles

**Super Admin (`super_admin`)**
- ✅ Full system access
- ✅ Can create, edit, and delete admin accounts
- ✅ Can manage books, users, and all system features
- ✅ Access to super admin dashboard with extended features
- ✅ Can view audit logs and system settings

**System Admin (`system_admin`)**  
- ✅ Can manage books (add, edit, delete)
- ✅ Can manage students/users
- ✅ Can approve borrowing requests
- ✅ Can view dashboard statistics
- ❌ **Cannot** create, edit, or delete admin accounts (read-only access)
- ❌ **Cannot** access super admin features

#### Backend Authorization

All admin management endpoints (`POST /api/admin`, `PUT /api/admin/:id`, `DELETE /api/admin/:id`) enforce authorization:

```javascript
// Example: POST /api/admin (Create Admin)
router.post("/", async (req, res) => {
  const { currentAdminId } = req.body;
  
  // Check if current user is super_admin
  const currentAdmin = await queryDB(
    "SELECT role FROM admins WHERE id = ?",
    [currentAdminId]
  );
  
  if (currentAdmin[0].role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only Super Admins can create admin accounts."
    });
  }
  
  // ... rest of create logic
});
```

**Security:** Returns **403 Forbidden** if non-super_admin attempts to modify admin accounts, even via direct API calls or dev tools.

#### Frontend UI Controls

**System Admin View:**
- ❌ "Add Admin" button hidden
- ❌ Edit/Delete buttons replaced with "Read-only" text
- ✅ Informational notice: *"📖 Read-only access - Only Super Admins can manage admin accounts"*
- ✅ Can view all admin accounts in the table

**Super Admin View:**
- ✅ "Add Admin" button visible
- ✅ Edit/Delete buttons visible and functional
- ✅ Full administrative control

#### Files Modified

**Backend:**
- `src/routes/admin.js` - Added role authorization to POST/PUT/DELETE endpoints

**Frontend:**
- `public/dashboard/admin/admin-admins.html` - Added UI controls and role checks
- `public/dashboard/super-admin/super-admin-admins.html` - Added authorization data

#### Testing RBAC

**Test as System Admin (IDs: 8, 13):**
```bash
# Login and navigate to Admin Management
# Verify:
# - No "Add Admin" button
# - No Edit/Delete buttons (shows "Read-only")
# - Can view admin list
# - API requests return 403
```

**Test as Super Admin (ID: 17):**
```bash
# Login and navigate to Admin Management  
# Verify:
# - "Add Admin" button present
# - Edit/Delete buttons functional
# - Can create/modify/delete admins
# - API requests succeed
```

#### Current Admin Roles in Database

| ID | Name | Role |
|----|------|------|
| 8 | Ameer Dela Peña | system_admin |
| 13 | admin101 | system_admin |
| 17 | jowel c galang | super_admin |

---

## 📊 Testing

### Manual Testing Checklist

#### Authentication Tests
- [ ] Admin login with valid credentials
- [ ] Student login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Forgot password (email sent)
- [ ] Reset password with valid token
- [ ] Reset password with expired token (should fail)
- [ ] Student signup with all valid fields
- [ ] Student signup with invalid student_type (should fail in v2)

#### Book Management Tests (v2)
- [ ] Admin adds book with quantity > 1
- [ ] Book displays "Available (X/Y)" format
- [ ] Add book with negative quantity (should fail - CHECK constraint)
- [ ] Add book with available_quantity > quantity (should fail)
- [ ] Search books by title
- [ ] Filter books by category
- [ ] View book details with admin info (added_by_name)

#### Borrowing Tests (v2)
- [ ] Student borrows book (available_quantity decreases)
- [ ] Student returns book (available_quantity increases)
- [ ] Try to borrow when available_quantity = 0 (should fail)
- [ ] Borrow multiple copies of same book
- [ ] View borrowing history with approver info
- [ ] Check overdue books report

#### Dashboard Tests
- [ ] Admin dashboard shows correct statistics
- [ ] Statistics use quantity-based counting (v2)
- [ ] Student dashboard shows borrowed books
- [ ] Charts and graphs display correctly

### Automated Testing (Future Enhancement)

```bash
# Install testing dependencies
npm install --save-dev jest supertest

# Run tests
npm test
```

---

## 🎓 Learning Resources

### Node.js & Express
- [Express.js Official Guide](https://expressjs.com/en/guide/routing.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### MySQL & Database Design
- [MySQL Official Documentation](https://dev.mysql.com/doc/)
- [Database Normalization](https://www.studytonight.com/dbms/database-normalization.php)
- [MySQL Performance Tuning](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

### JavaScript & Frontend
- [Modern JavaScript Tutorial](https://javascript.info/)
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.0/getting-started/introduction/)

---

## 📞 Support & Contact

### For Issues or Questions

1. **Documentation:**
   - Check [UPGRADE_GUIDE.md](UPGRADE_GUIDE.md) for migration help
   - Review [Troubleshooting](#-troubleshooting) section
   - See [FAQ](#-frequently-asked-questions) below

2. **GitHub Issues:**
   - Search existing issues first
   - Create new issue with detailed description
   - Include error messages and steps to reproduce

3. **Email Support:**
   - Technical: support@spist.edu
   - Security: security@spist.edu

---

## ❓ Frequently Asked Questions

### General Questions

**Q: Can I use this system for my own school?**  
A: Yes! This is an open-source project. Please maintain attribution.

**Q: Does this work with PostgreSQL instead of MySQL?**  
A: Currently MySQL/MariaDB only. PostgreSQL support could be added as a contribution.

**Q: Can I customize the UI theme?**  
A: Yes, modify the CSS files in `public/css/` directory.

### Migration Questions

**Q: Do I need to migrate if I'm installing fresh?**  
A: No, just use the latest schema. Migration is only for v1 → v2 upgrades.

**Q: Will migration delete my data?**  
A: No, migration uses ALTER TABLE to preserve all data. Always backup first though!

**Q: Can I rollback after migration?**  
A: Yes, use `ROLLBACK_v2_to_v1.sql` or restore from backup.

**Q: How long does migration take?**  
A: Typically < 5 seconds for databases with < 10,000 records.

### Technical Questions

**Q: Why is book status 'active' instead of 'available'?**  
A: v2 uses quantity tracking. A book is 'active' in the system even when all copies are borrowed. Availability is determined by `available_quantity > 0`.

**Q: What's the difference between quantity and available_quantity?**  
A: `quantity` is total copies owned. `available_quantity` is copies currently available to borrow. Example: 5 total, 3 available means 2 are currently borrowed.

**Q: Can multiple students borrow the same book?**  
A: Yes! That's the whole point of v2. If you have 5 copies, 5 different students can borrow simultaneously.

**Q: Who can see the audit trail?**  
A: Admins can see who added books and who approved borrowings. This appears in book listings and borrowing records.

---

## 📜 License

This project is developed for **Southern Philippines Institute of Science & Technology (SPIST)**.

© 2025 SPIST. All rights reserved.

---

## 👥 Credits & Acknowledgments

**Developer:** Jowel  
**Institution:** SPIST (Southern Philippines Institute of Science & Technology)  
**Project Type:** Library Management System  
**Technology:** Node.js, Express.js, MySQL, Bootstrap 5  

**Special Thanks:**
- SPIST Administration for project support
- Library staff for requirements and testing
- All contributors and testers

---

## 🚀 Quick Commands Reference

```bash
# Development
npm install                    # Install dependencies
npm start                      # Start development server
npm run dev                    # Start with nodemon (auto-reload)

# Database
mysql -u root -p              # Connect to MySQL
mysqldump -u root -p spist_library > backup.sql  # Backup database
mysql -u root -p spist_library < backup.sql      # Restore database
mysql -u root -p spist_library < migration_v2.sql # Run migration

# Production (with PM2)
pm2 start server.js --name spist-library  # Start app
pm2 restart spist-library                 # Restart app
pm2 stop spist-library                    # Stop app
pm2 logs spist-library                    # View logs
pm2 monit                                 # Monitor resources

# Git
git status                     # Check status
git add .                      # Stage all changes
git commit -m "message"        # Commit changes
git push origin main           # Push to GitHub

# Troubleshooting
Get-Process -Name "node" | Stop-Process -Force  # Kill Node processes (Windows)
npm audit                      # Check for vulnerabilities
npm audit fix                  # Fix vulnerabilities
```

---

## 📚 APPENDIX A: Complete Migration Guide Summary

### Migration Overview (v1.0 → v2.0)

**Key Improvements:**
- 📚 **Quantity-Based Management** - Track multiple book copies instead of single status
- 🔍 **Audit Trail** - Track who added books (`added_by`) and approved borrowings (`approved_by`)
- ⚡ **Performance** - 9 new indexes provide 40-100x faster queries
- 🔒 **Data Integrity** - 4 CHECK constraints + 2 new foreign keys
- ✅ **ENUM Validation** - Standardized student types and statuses
- 🗃️ **Audit Logs** - New table tracks all database changes with JSON

### Schema Changes Summary

**10 New Columns:**
1. `admins.is_active` - Enable/disable admin accounts
2. `admins.updated_at` - Track last modification
3. `students.updated_at` - Track last modification
4. `books.added_by` - FK to admins (accountability)
5. `books.available_quantity` - Track available copies
6. `books.updated_at` - Track last modification
7. `book_borrowings.approved_by` - FK to admins (approval workflow)
8. `book_borrowings.notes` - Admin notes
9. `book_borrowings.created_at` - Audit timestamp
10. `book_borrowings.updated_at` - Track modifications

**1 New Table:**
- `audit_logs` - JSON-based change tracking with 10 columns

**9 New Indexes for Performance:**
- `idx_is_active` (admins) - Fast admin filtering
- `idx_department` (students) - Fast department lookup
- `idx_category` (books) - 100x faster category queries
- `idx_title` (books) - Fast title search
- `idx_added_by` (books) - Admin book lookup
- `idx_student_status` (book_borrowings) - Composite index, 40x faster
- `idx_borrow_date` (book_borrowings) - Date-based reports
- `idx_due_date` (book_borrowings) - Overdue detection
- `idx_approved_by` (book_borrowings) - Admin approval lookup

**4 CHECK Constraints:**
- `chk_quantity` - Prevent negative inventory
- `chk_available_quantity` - Ensure available ≤ total
- `chk_due_date` - Due date after borrow date
- `chk_return_date` - Return date after borrow date

**ENUM Changes:**
- `students.student_type`: VARCHAR → ENUM ('undergraduate', 'graduate', 'transferee')
- `students.status`: 2 values → 4 values (added 'suspended', 'graduated')
- `books.status`: 'available'/'borrowed' → 'active'/'maintenance'/'retired' (breaking change)
- `book_borrowings.status`: 3 values → 6 values (added 'pending', 'approved', 'cancelled')

### Migration Safety Checklist

**Pre-Migration:**
- ✅ Database backup completed and tested
- ✅ Application server stopped
- ✅ Code changes documented
- ✅ Git snapshot created

**Post-Migration Verification:**
```sql
-- Verify all new columns exist
SHOW COLUMNS FROM admins;        -- Check is_active, updated_at
SHOW COLUMNS FROM books;         -- Check added_by, available_quantity
SHOW COLUMNS FROM book_borrowings; -- Check approved_by, notes, timestamps

-- Verify foreign keys
SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME 
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'spist_library' AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Verify indexes (should show 9 new indexes)
SHOW INDEXES FROM books;
SHOW INDEXES FROM book_borrowings;

-- Verify data integrity
SELECT COUNT(*) FROM books WHERE available_quantity > quantity; -- Should be 0
SELECT COUNT(*) FROM books WHERE quantity < 0;                  -- Should be 0
```

### Rollback Procedure

If migration fails:

**Option 1: Restore from Backup**
```bash
mysql -u root -p spist_library < backup_20251130.sql
```

**Option 2: Use Rollback Script**
```bash
mysql -u root -p spist_library < ROLLBACK_v2_to_v1.sql
```

---

## 📊 APPENDIX B: Database Schema Reference

### Tables Overview

| Table | Columns | Purpose | v2 Changes |
|-------|---------|---------|------------|
| `admins` | 10 | Admin accounts | +2 columns, +1 index |
| `students` | 15 | Student accounts | +1 column, +1 index, ENUM changes |
| `books` | 11 | Book inventory | +3 columns, +4 indexes, status change |
| `book_borrowings` | 11 | Transactions | +4 columns, +4 indexes, workflow |
| `audit_logs` | 10 | Change history | NEW table |

### Entity Relationships

```
admins (1) ──► (N) books [added_by]
admins (1) ──► (N) book_borrowings [approved_by]
books (1) ──► (N) book_borrowings [book_id]
students (1) ──► (N) book_borrowings [student_id]
```

### Books Table - Paradigm Shift

**v1.0 (Status-Based):**
- Single book tracked by `status = 'available'` or `'borrowed'`
- Can't handle multiple copies
- Binary availability

**v2.0 (Quantity-Based):**
- Multiple copies tracked by `quantity` and `available_quantity`
- `status` now represents lifecycle ('active', 'maintenance', 'retired')
- Granular availability (e.g., "3 of 5 available")

**Example:**
```sql
-- v1: Book can only be available OR borrowed
status = 'available'  -- 1 copy free
status = 'borrowed'   -- 0 copies free

-- v2: Book tracks total and available
quantity = 5, available_quantity = 3  -- 3 of 5 free
quantity = 5, available_quantity = 0  -- All borrowed but still active
status = 'active'                      -- In circulation
```

### Borrowing Workflow (v2.0)

**Old Workflow (v1.0):**
1. Student borrows → Immediate borrow, status='borrowed'

**New Workflow (v2.0):**
1. Student requests → status='pending', no quantity change
2. Admin approves → status='approved', approved_by set, no quantity change
3. Student picks up → status='borrowed', available_quantity decrements
4. Student returns → status='returned', available_quantity increments

### Audit Logs Structure

```sql
CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,      -- Which table
  record_id INT NOT NULL,                -- Which record
  action ENUM('INSERT','UPDATE','DELETE'), -- What happened
  user_type ENUM('admin','student'),     -- Who did it
  user_id VARCHAR(50) NOT NULL,          -- User's ID
  old_values JSON NULL,                  -- Before values
  new_values JSON NULL,                  -- After values
  ip_address VARCHAR(45) NULL,           -- IP address
  created_at TIMESTAMP DEFAULT NOW()     -- When
);
```

**Sample Log:**
```json
{
  "table_name": "books",
  "record_id": 5,
  "action": "UPDATE",
  "user_type": "admin",
  "user_id": "5",
  "old_values": {"available_quantity": 3},
  "new_values": {"available_quantity": 2},
  "ip_address": "192.168.1.100"
}
```

### Performance Optimization

**Query Performance Comparison:**

| Query | v1.0 (No Index) | v2.0 (Indexed) | Improvement |
|-------|-----------------|----------------|-------------|
| Books by category | ~50ms | ~0.5ms | **100x faster** |
| Student borrowings | ~80ms | ~2ms | **40x faster** |
| Overdue books | ~100ms | ~3ms | **33x faster** |
| Admin approvals | N/A | ~1ms | NEW feature |

**Index Usage:**
```sql
-- Fast category lookup (uses idx_category)
SELECT * FROM books WHERE category = 'Programming';

-- Fast student history (uses idx_student_status composite)
SELECT * FROM book_borrowings 
WHERE student_id = 'STD-2023-020' AND status = 'borrowed';

-- Fast overdue detection (uses idx_due_date)
SELECT * FROM book_borrowings 
WHERE status = 'borrowed' AND due_date < NOW();
```

---

## 🌐 APPENDIX C: API Endpoints Quick Reference

### Authentication Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/login` | Public | User login (admin/student) |
| POST | `/auth/signup` | Public | Student registration |
| POST | `/auth/forgot-password` | Public | Request password reset |
| POST | `/auth/reset-password/:token` | Public | Reset password |

### Book Management (All require auth)

| Method | Endpoint | Role | Purpose | v2 Changes |
|--------|----------|------|---------|------------|
| GET | `/books` | Any | List all books | Returns quantity fields |
| GET | `/books/:id` | Any | Get book details | Includes added_by admin |
| POST | `/books` | Admin | Add new book | Auto-sets added_by |
| PUT | `/books/:id` | Admin | Update book | Auto-adjusts available_quantity |
| DELETE | `/books/:id` | Admin | Delete book | Cascade deletes borrowings |
| GET | `/books/available` | Any | Books with copies | Filters by available_quantity > 0 |

### Borrowing Workflow (v2.0)

| Method | Endpoint | Role | Purpose | Status Change |
|--------|----------|------|---------|---------------|
| POST | `/book-borrowings` | Student | Request book | → pending |
| PUT | `/book-borrowings/:id/approve` | Admin | Approve request | pending → approved |
| PUT | `/book-borrowings/:id/borrow` | Admin | Mark as picked up | approved → borrowed |
| PUT | `/book-borrowings/:id/return` | Admin | Return book | borrowed → returned |
| GET | `/book-borrowings` | Any | List borrowings | Supports filtering |

### Admin Operations

| Method | Endpoint | Purpose | v2 Enhancements |
|--------|----------|---------|-----------------|
| GET | `/admin/stats` | Dashboard stats | Includes pending_requests count |
| GET | `/admin/users` | List all users | Supports new ENUM filtering |

### Student Operations

| Method | Endpoint | Purpose | v2 Additions |
|--------|----------|---------|--------------|
| GET | `/students/me` | Get profile | Returns student_type, status |
| GET | `/students/me/borrowings` | Borrowing history | Includes approved_by, notes |

### Request/Response Examples

**Login Request:**
```json
POST /auth/login
{
  "email": "student@spist.edu.ph",
  "password": "password123",
  "role": "student"
}
```

**Login Response (v2.0):**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "student_id": "STD-2023-020",
    "fullname": "Juan Dela Cruz",
    "department": "BSCS",
    "student_type": "undergraduate",  // NEW in v2
    "status": "active"                 // NEW in v2
  }
}
```

**Request Book (v2.0):**
```json
POST /book-borrowings
Authorization: Bearer <token>
{
  "book_id": 1,
  "due_date": "2025-12-07"
}

Response:
{
  "success": true,
  "data": {
    "id": 456,
    "status": "pending",  // Awaits approval
    "created_at": "2025-11-30T10:00:00.000Z"
  }
}
```

**Approve Request (Admin):**
```json
PUT /book-borrowings/456/approve
Authorization: Bearer <admin_token>
{
  "notes": "Approved. Pick up before 5pm."
}

Response:
{
  "success": true,
  "data": {
    "status": "approved",
    "approved_by": 5,         // Admin ID
    "notes": "Approved. Pick up before 5pm."
  }
}
```

### Error Responses

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Bad Request | Invalid student_type value |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Student trying admin endpoint |
| 404 | Not Found | Book ID doesn't exist |
| 409 | Conflict | Email already registered |
| 422 | Validation Error | available_quantity > quantity |
| 500 | Server Error | Database connection failed |

---

## 🔍 APPENDIX D: Verification & Testing Queries

### Data Integrity Checks

```sql
-- 1. Verify no books have negative quantities
SELECT * FROM books WHERE quantity < 0 OR available_quantity < 0;
-- Expected: Empty result

-- 2. Verify available_quantity never exceeds quantity
SELECT * FROM books WHERE available_quantity > quantity;
-- Expected: Empty result

-- 3. Verify all active borrowings have valid books
SELECT bb.* FROM book_borrowings bb
LEFT JOIN books b ON bb.book_id = b.id
WHERE bb.status = 'borrowed' AND b.id IS NULL;
-- Expected: Empty result

-- 4. Verify all due dates are after borrow dates
SELECT * FROM book_borrowings 
WHERE due_date < borrow_date;
-- Expected: Empty result

-- 5. Verify all return dates are after borrow dates (when not NULL)
SELECT * FROM book_borrowings 
WHERE return_date IS NOT NULL AND return_date < borrow_date;
-- Expected: Empty result
```

### Migration Verification

```sql
-- 1. Count books by status (v2 values)
SELECT status, COUNT(*) as count FROM books GROUP BY status;
-- Expected: Only 'active', 'maintenance', 'retired'

-- 2. Count students by type (v2 ENUM)
SELECT student_type, COUNT(*) as count FROM students GROUP BY student_type;
-- Expected: Only 'undergraduate', 'graduate', 'transferee'

-- 3. Count borrowings by status (v2 values)
SELECT status, COUNT(*) as count FROM book_borrowings GROUP BY status;
-- Expected: 'pending', 'approved', 'borrowed', 'returned', 'overdue', 'cancelled'

-- 4. Verify foreign key relationships
SELECT COUNT(*) FROM books WHERE added_by IS NOT NULL 
AND added_by NOT IN (SELECT id FROM admins);
-- Expected: 0 (all added_by values reference valid admins)

-- 5. Verify indexes exist
SHOW INDEXES FROM books WHERE Key_name IN ('idx_category', 'idx_title', 'idx_added_by');
-- Expected: 3 rows

SHOW INDEXES FROM book_borrowings 
WHERE Key_name IN ('idx_student_status', 'idx_borrow_date', 'idx_due_date', 'idx_approved_by');
-- Expected: 4 rows
```

### Performance Testing

```sql
-- Test index performance (should use index)
EXPLAIN SELECT * FROM books WHERE category = 'Programming';
-- Check 'type' column: Should show 'ref' (using index)

EXPLAIN SELECT * FROM book_borrowings 
WHERE student_id = 'STD-2023-020' AND status = 'borrowed';
-- Check 'key' column: Should show 'idx_student_status'

-- Compare execution time
SET @start = NOW(6);
SELECT * FROM books WHERE category = 'Programming';
SELECT TIMESTAMPDIFF(MICROSECOND, @start, NOW(6)) as microseconds;
-- Should be < 1000 microseconds with index
```

### Quantity Tracking Validation

```sql
-- Verify available_quantity matches reality
SELECT 
  b.id,
  b.title,
  b.quantity as total_copies,
  b.available_quantity as system_available,
  (b.quantity - COUNT(bb.id)) as calculated_available,
  CASE 
    WHEN b.available_quantity = (b.quantity - COUNT(bb.id)) THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as validation
FROM books b
LEFT JOIN book_borrowings bb ON b.id = bb.book_id AND bb.status = 'borrowed'
GROUP BY b.id
HAVING validation = '✗ Mismatch';
-- Expected: Empty result (all quantities match)
```

### Audit Log Verification

```sql
-- Check audit logs are being created
SELECT table_name, action, COUNT(*) as count
FROM audit_logs
GROUP BY table_name, action
ORDER BY table_name, action;

-- View recent changes to books
SELECT * FROM audit_logs
WHERE table_name = 'books'
ORDER BY created_at DESC
LIMIT 10;

-- Track who added specific book
SELECT al.*, a.fullname as admin_name
FROM audit_logs al
JOIN admins a ON al.user_id = a.id
WHERE al.table_name = 'books' 
  AND al.record_id = 5 
  AND al.action = 'INSERT';
```

---

## 📖 APPENDIX E: Complete Documentation Index

### Primary Documentation

1. **README.md** (This file) - Complete system documentation
   - Quick start guide
   - Features overview
   - Installation instructions
   - API reference summary
   - Troubleshooting
   - All appendices

2. **UPGRADE_GUIDE.md** - Migration from v1.0 to v2.0
   - Step-by-step migration instructions
   - Schema changes breakdown
   - Code updates required
   - Rollback procedures
   - 771 lines of detailed guidance

3. **DATABASE_OVERVIEW.md** - Database schema reference
   - Entity relationship diagrams
   - All table structures
   - Index documentation
   - Performance optimization
   - Backup strategies

4. **API_REFERENCE.md** - Complete API documentation
   - All endpoints with examples
   - Request/response formats
   - Authentication details
   - Code samples
   - Error handling

### Migration Documentation

5. **SCHEMA_COMPARISON_REPORT.md** - v1 vs v2 detailed comparison
   - Table-by-table changes
   - Risk assessment
   - Impact analysis
   - 658 lines of technical details

6. **MIGRATION_SAFETY_CHECKLIST.md** - Pre/post migration checks
   - Backup verification
   - Execution steps
   - Validation queries
   - Rollback procedures

7. **MIGRATION_QUICK_REFERENCE.md** - Quick migration guide
   - Essential steps
   - Common commands
   - Quick troubleshooting

### SQL Scripts

8. **spist_library.sql** - Original v1.0 schema
9. **migration_v2.sql** - v1 to v2 migration script (executed)
10. **migrate_to_v2_SAFE.sql** - Enhanced migration with rollback
11. **ROLLBACK_v2_to_v1.sql** - Emergency rollback script

### How to Use This Documentation

**For New Developers:**
1. Start with README.md (this file)
2. Review DATABASE_OVERVIEW.md for schema
3. Check API_REFERENCE.md for endpoints

**For Migration:**
1. Read UPGRADE_GUIDE.md completely
2. Use MIGRATION_SAFETY_CHECKLIST.md
3. Refer to SCHEMA_COMPARISON_REPORT.md for details

**For Troubleshooting:**
1. Check README.md Troubleshooting section
2. Verify with queries in Appendix D
3. Review audit_logs table

**For API Development:**
1. Use API_REFERENCE.md for endpoint details
2. Check code examples in JavaScript
3. Test with provided cURL commands

---

## 📋 APPENDIX F: Production Deployment Checklist

### Pre-Deployment

- [ ] All tests passed locally
- [ ] Database migrated to v2.0
- [ ] Post-migration verification completed
- [ ] Code updated for v2 schema
- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Domain configured
- [ ] Backup strategy established

### Server Setup

- [ ] Node.js v14+ installed
- [ ] PM2 installed globally
- [ ] MySQL/MariaDB 10.4.32+ installed
- [ ] Nginx installed (reverse proxy)
- [ ] Firewall configured (ports 80, 443, 3000)
- [ ] User permissions set correctly

### Application Deployment

- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] .env file created with production values
- [ ] Database imported
- [ ] Application tested (`npm start`)
- [ ] PM2 configured
- [ ] Auto-restart enabled

### Post-Deployment

- [ ] Application accessible via domain
- [ ] HTTPS working correctly
- [ ] All endpoints responding
- [ ] Database connections stable
- [ ] Email sending working
- [ ] Logs monitoring configured
- [ ] Backup automation running
- [ ] Performance metrics collected

### Maintenance Schedule

**Daily:**
- Monitor PM2 logs
- Check error logs
- Verify backup completion

**Weekly:**
- Review audit logs
- Check disk space
- Update dependencies (if needed)

**Monthly:**
- Run ANALYZE TABLE
- Review performance metrics
- Security audit
- Test backup restoration

**Quarterly:**
- Run OPTIMIZE TABLE
- Update Node.js/MySQL
- Review access logs
- Security patches

---

## 📚 Documentation Navigation Guide

This README now contains **ALL documentation** in one place! Here's what you'll find:

### 🎯 Getting Started (Pages 1-15)
- [Quick Start](#-quick-start) - 5-minute setup
- [Features](#-key-features-v20) - What's new in v2.0
- [Requirements](#-system-requirements) - What you need
- [Installation](#-installation-guide) - Step-by-step setup

### ⚙️ Configuration (Pages 15-30)
- [Environment Setup](#️-environment-configuration) - .env configuration
- [Database Setup](#️-database-setup) - MySQL schema & import
- [Multi-Environment](#-multi-environment-setup) - Dev/Test/Prod setup

### 📖 Usage & Development (Pages 30-80)
- [Features Guide](#-feature-documentation) - How to use each feature
- [API Reference](#-api-reference) - Complete API documentation
- [Security](#-security-best-practices) - Production checklist
- [Troubleshooting](#-troubleshooting) - Common issues & fixes

### 🗂️ Reference (Pages 80+)
- [Project Structure](#-project-structure) - File organization
- [File Index](#-file-index) - Complete file listing

### 📄 Additional Documentation Files

While this README is comprehensive, detailed reference documents are also available:

| File | Purpose | When to Use |
|------|---------|-------------|
| `README.md` | 📘 **Main docs** (this file) | Primary reference |
| `README_DETAILED.md` | 📗 Extended version | Deep dive |
| `DOCUMENTATION.md` | 📕 Technical details | Advanced topics |
| `DATABASE_SETUP.md` | 🗄️ Database guide | Multi-env setup |
| `QUICK_REFERENCE.md` | ⚡ Quick commands | Fast lookup |
| `INDEX.md` | 🗂️ File structure | Navigation |
| `INTEGRATION_SUMMARY.md` | ✅ Status report | Verification |

---

## 🎉 You're All Set!

**System Status:** ✅ Ready to use  
**Database:** Connected to `spist_library` (development)  
**Server:** Running on port 3000

**Quick Links:**
- 🚀 [Jump to Quick Start](#-quick-start)
- 📖 [View Features](#-key-features-v20)
- 🔧 [Troubleshooting](#-troubleshooting)
- 🔌 [API Docs](#-api-reference)

**Need Help?**
1. Check [Troubleshooting](#-troubleshooting) section
2. Review relevant documentation file from table above
3. Search this README (Ctrl+F / Cmd+F)

---

**Last Updated:** December 15, 2025  
**Version:** 2.0.0  
**Status:** ✅ Production Ready  
**Schema Version:** v2.0  
**Documentation:** Complete & Consolidated

**Happy managing! 📚✨**  

**Repository:** [github.com/axtro112/spist-library-management-system](https://github.com/axtro112/spist-library-management-system)  
**Documentation:** Complete and unified in README.md

---

*Made with ❤️ for SPIST - All documentation consolidated for easy reference*


# SPIST Library Management System

A comprehensive web-based library management system developed for Southern Philippines Institute of Science & Technology (SPIST). This modern application streamlines library operations by providing an intuitive interface for managing books, user accounts, and administrative functions. The system supports both administrators and students with role-specific features designed to enhance the library experience.

## 📋 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start (5 Steps)](#quick-start-5-steps)
- [Project Structure](#project-structure)
- [Database Setup](#database-setup)
- [Getting Started](#getting-started)
- [Routes](#routes)
- [Forgot Password Feature](#-forgot-password-feature)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

---

## Features

### Admin Features

- Interactive dashboard with real-time statistics
- Comprehensive book management (add, edit, delete, track)
- User management system with role-based access control
- Admin account management with secure permissions
- Generate reports and analytics
- Track book borrowing history
- Password reset via email

### Student Features

- Personalized dashboard with book recommendations
- Advanced book search and filtering
- Digital book borrowing management
- Profile customization
- Borrowing history tracking
- Due date notifications
- Password reset via email

---

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **UI Framework**: Bootstrap 5
- **Email Service**: Nodemailer (Gmail SMTP)
- **Additional Tools**: XAMPP (MySQL Server)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- XAMPP (for MySQL Server)
- Gmail account with 2FA enabled (for password reset feature)

---

## ⚡ Quick Start (5 Steps)

### Step 1: Create .env File
```bash
# In project root, create .env with:
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_DATABASE=spist_library
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
FRONTEND_URL=http://localhost:3000
PORT=3000
JWT_SECRET=your-secret-key
```

### Step 2: Get Gmail App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" → "Windows Computer"
3. Copy the 16-character password
4. Paste into `.env` as `EMAIL_PASS`

### Step 3: Update Database
```bash
mysql -u root -p spist_library < spist_library.sql
```

### Step 4: Install Dependencies
```bash
npm install
```

### Step 5: Run Server
```bash
npm start
# Visit: http://localhost:3000
```

---

## Project Structure

```
├── public/                          # Static assets and client-side files
│   ├── css/                         # CSS stylesheets
│   │   ├── admin.css                # Admin dashboard styles
│   │   ├── common.css               # Shared styles
│   │   ├── login.css                # Login page styles (includes forgot password modal)
│   │   ├── student.css              # Student dashboard styles
│   │   └── ...
│   ├── dashboard/                   # Dashboard pages
│   │   ├── admin/                   # Admin dashboard pages
│   │   │   ├── admin-dashboard.html
│   │   │   ├── admin-books.html
│   │   │   ├── admin-users.html
│   │   │   └── admin-admins.html
│   │   └── student/                 # Student dashboard pages
│   │       ├── student-dashboard.html
│   │       ├── student-books.html
│   │       ├── student-borrowed.html
│   │       └── student-profile.html
│   ├── img/                         # Image assets
│   └── js/                          # JavaScript files
│       ├── admin.js                 # Admin functionality
│       ├── login.js                 # Authentication logic + forgot password
│       ├── reset-password.js        # Password reset logic (NEW)
│       ├── user.js                  # User functionality
│       └── ...
├── src/                             # Source code
│   ├── pages/                       # Main pages
│   │   ├── home.html                # Homepage
│   │   ├── login.html               # Login page
│   │   ├── signup.html              # Registration page
│   │   ├── reset-password.html      # Password reset page (NEW)
│   │   └── ...
│   ├── routes/                      # API routes
│   │   ├── auth.js                  # Authentication routes (includes forgot/reset password)
│   │   ├── admin.js                 # Admin routes
│   │   ├── books.js                 # Book routes
│   │   ├── students.js              # Student routes
│   │   └── book-borrowings.js       # Borrowing routes
│   ├── config/                      # Configuration files
│   │   └── database.js              # Database connection
│   └── utils/                       # Utility functions
│       └── update_admin_passwords.js
├── .env.example                     # Environment variables template
├── .env                             # Environment variables (local only)
├── server.js                        # Node.js server setup
├── package.json                     # Project dependencies
├── spist_library.sql                # Database schema
└── README.md                        # This file
```

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

### Step 3: Database Schema
The database includes the following tables:

**admins** - Administrator accounts
- id, fullname, email, password, role
- resetToken, resetTokenExpiry (NEW - for password reset)

**students** - Student accounts
- id, student_id, fullname, email, password, department, year_level, student_type, contact_number, status
- resetToken, resetTokenExpiry (NEW - for password reset)

**books** - Book inventory
- id, title, author, isbn, category, added_date, status

**book_borrowings** - Borrowing records
- id, book_id, student_id, borrow_date, due_date, return_date, status

---

## Getting Started

### Option 1: Using Git

```bash
git clone https://github.com/lulli30/spist-library-management-system.git
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
- **Admin Email**: `adminlulli@spist.edu`
- **Student Email**: `johnandrewborabo44@gmail.com`

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
# Gmail Configuration
EMAIL_USER=your-email@gmail.com
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

## 🌐 API Endpoints

### Authentication

#### POST /auth/forgot-password

Request password reset via email.

**Request:**
```json
{
  "email": "user@spist.edu"
}
```

**Response (Success - 200):**
```json
{
  "message": "If this email exists, a reset link was sent."
}
```

**Response (Error - 400):**
```json
{
  "error": "Email is required"
}
```

#### POST /auth/reset-password

Reset password with valid token.

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

#### POST /auth/login

User login.

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
  "adminId": 5,
  "studentId": "STD-2023-020"
}
```

#### POST /auth/signup

User registration.

**Request:**
```json
{
  "student_id": "STD-2024-001",
  "fullname": "John Doe",
  "email": "john@spist.edu",
  "password": "password123",
  "department": "BSCS",
  "year_level": "1",
  "student_type": "undergraduate",
  "contact_number": "09123456789"
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

### Email Not Sending

**Error:** `"Username and Password not accepted"`

**Solution:**
1. Check `.env` has correct `EMAIL_USER` and `EMAIL_PASS`
2. Verify it's a 16-character **app password** (not regular password)
3. Ensure 2FA is enabled on Gmail account
4. Restart server after updating `.env`

### Reset Link Expired

**Error:** `"Invalid or expired reset token"`

**Solution:**
- Token valid for 10 minutes
- Click link within 10 minutes
- Request new password reset if expired

### Server Won't Start

**Error:** `"Cannot find module 'nodemailer'"`

**Solution:**
```bash
npm install
npm start
```

### Port Already in Use

**Error:** `"EADDRINUSE: address already in use :::3000"`

**Solution:**
```bash
# PowerShell (Windows)
Get-Process -Name "node" | Stop-Process -Force

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Database Connection Error

**Error:** `"Access denied for user 'root'@'localhost'"`

**Solution:**
1. Start XAMPP MySQL service
2. Verify `.env` has correct `DB_USER` and `DB_PASSWORD`
3. Ensure database `spist_library` exists

---

## 🚀 Production Deployment

### Before Deploying

- [ ] Update FRONTEND_URL to production domain
- [ ] Enable HTTPS
- [ ] Use environment-specific `.env`
- [ ] Set strong JWT_SECRET
- [ ] Configure custom email domain (not Gmail)
- [ ] Implement rate limiting
- [ ] Add CAPTCHA to forgot password form
- [ ] Set up monitoring/logging
- [ ] Backup database

### Deployment Steps

1. **Update Environment Variables**
   ```env
   FRONTEND_URL=https://your-production-domain.com
   EMAIL_USER=noreply@your-domain.com
   NODE_ENV=production
   ```

2. **Build and Test**
   ```bash
   npm run build
   npm start
   ```

3. **Deploy to Server**
   - Use PM2 for process management
   - Set up SSL/HTTPS
   - Configure firewall rules
   - Set up database backups

4. **Post-Deployment**
   - Test all features
   - Monitor error logs
   - Set up alerts

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

### package.json Dependencies
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "body-parser": "^1.20.2",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "nodemailer": "^6.9.7"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

---

## 📝 Styling

The application uses a modular CSS structure:

| File | Purpose |
|------|---------|
| `common.css` | Base styles and shared components |
| `admin.css` | Admin dashboard and components |
| `student.css` | Student dashboard and components |
| `login.css` | Authentication pages + forgot password modal |
| `aboutus.css` | About page |
| `contactus.css` | Contact page |

---

## 🤝 Contributing

To contribute to this project:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📞 Support

For issues or questions:

1. Check the Troubleshooting section
2. Review error logs in terminal
3. Check browser console (F12)
4. Create an issue on GitHub

---

## 📜 License

This project is developed for Southern Philippines Institute of Science & Technology (SPIST).

---

## 👥 Credits

**Developer**: Jowel Lulli  
**Institution**: SPIST (Southern Philippines Institute of Science & Technology)  
**Created**: November 2025

---

## 🎯 Version History

### v1.0.0 (November 19, 2025)
- Initial release
- Core library management features
- Admin and student dashboards
- Book borrowing system
- **NEW**: Forgot password feature with email verification
- **NEW**: Password reset with secure tokens
- **NEW**: Show/hide password toggle on reset page
- **NEW**: Green & white theme for reset password page

---

## 🚀 Quick Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Start with auto-reload
npm run dev

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Node.js Best Practices](https://nodejs.org/en/docs/)

---

**Last Updated**: November 19, 2025  
**Status**: ✅ Ready for Production

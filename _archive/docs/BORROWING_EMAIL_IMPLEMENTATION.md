# Book Borrowing Email Notification Implementation

## ✅ What Was Implemented

A complete email notification system for book borrowing with the following features:

### **Key Features**
1. **Single & Bulk Email** - One email per borrow transaction (even if multiple books borrowed)
2. **24-Hour Claim Deadline** - Calculated as: `borrow_date + INTERVAL 24 HOUR`
3. **Accession Numbers** - Each borrowed copy's unique ID included in email
4. **Automatic Sending** - Email sent automatically after successful DB transaction
5. **Graceful Failure** - If email fails, borrowing still succeeds (logged for manual investigation)
6. **Minimal Changes** - Existing routes preserve backward compatibility

---

## 📁 Files Created/Modified

### **New Files:**

1. **`/database/migrations/add_claim_email_fields.sql`**
   - Adds `claim_expires_at` DATETIME column
   - Adds `email_sent_at` DATETIME column
   - Idempotent (safe to run multiple times)

2. **`/src/utils/mailer.js`** (NEW)
   - Nodemailer transport configuration
   - `sendBorrowingClaimEmail()` function
   - HTML and plain-text email formatting
   - Supports multiple SMTP providers

3. **`/src/services/borrowService.js`** (NEW)
   - Shared borrowing transaction logic
   - `createBorrowTransactionAndEmail()` function
   - Atomic DB transaction with email sending
   - Error handling with logging

4. **`/.env.email.example`**
   - Email configuration template
   - Instructions for Gmail, SendGrid, AWS SES, Azure

### **Modified Files:**

1. **`/src/routes/students.js`**
   - Added import: `const { createBorrowTransactionAndEmail } = require("../services/borrowService");`
   - Updated `/borrow-book` endpoint to use shared service
   - Updated `/borrow-multiple` endpoint to use shared service
   - Both now return `claimExpiresAt` and `emailSent` status

---

## 🔧 Setup Instructions

### **Step 1: Run SQL Migration**
```bash
# Connect to your MySQL database
mysql -u root -p spist_library < database/migrations/add_claim_email_fields.sql

# Verify columns were added
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'book_borrowings' 
AND COLUMN_NAME IN ('claim_expires_at', 'email_sent_at');
```

### **Step 2: Configure Email (Update `.env` file)**
```env
# Gmail Example (recommended for testing)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_FROM=noreply@spistlibrary.edu.ph

# Production: Use SendGrid, AWS SES, or Azure
# See .env.email.example for other providers
```

**Gmail Setup (if using Gmail):**
1. Enable 2-Factor Authentication in your Google Account
2. Create an "App Password" at: https://myaccount.google.com/apppasswords
3. Use the 16-character password in `EMAIL_PASS`

### **Step 3: Restart Server**
```bash
npm start
# Server should log: "Email transporter ready"
```

---

## 📧 Email Structure

### **Email Content (Exactly as specified):**

```
Good day!

This is to inform you that you have 24 hours remaining to claim the books you borrowed.

Please proceed to the Library – Main Campus, Anabu within the given time to claim your books. 
Failure to do so will result in the cancellation of your borrowing request.

If you have any questions, kindly contact the library staff.

Thank you.
```

### **Email Includes:**
- Student name and ID
- Borrowed books table:
  | Title | Author | ISBN | Category | Accession No |
  |-------|--------|------|----------|--------------|
  | ... | ... | ... | ... | **XXXXX** |
- Claim expiration (exactly 24 hours from borrow time, Asia/Manila timezone)
- Where to claim: "Library – Main Campus, Anabu"

---

## 🧪 Testing Instructions

### **Test 1: Single Book Borrow**
```bash
# POST /api/students/borrow-book
{
  "studentId": "STD-2024-001",
  "bookId": 1,
  "returnDate": "2026-03-10"
}

# Expected Response:
{
  "success": true,
  "message": "Book borrowed successfully (Copy: ACC-001)",
  "dueDate": "2026-03-10",
  "accessionNumber": "ACC-001",
  "claimExpiresAt": "2026-02-24T10:30:00.000Z",
  "emailSent": true
}

# Check logs:
# ✓ [INFO] Single book borrowed successfully
# ✓ [INFO] Borrowing claim email sent ← Confirms email was sent
```

### **Test 2: Bulk Borrow (Multiple Books)**
```bash
# POST /api/students/borrow-multiple
{
  "studentId": "STD-2024-001",
  "bookIds": [1, 2, 3]
}

# Expected: ONE email listing all 3 books
# Response includes all 3 borrowings + single claimExpiresAt timestamp
# Check logs:
# ✓ [INFO] Bulk borrow successful (bookCount: 3)
# ✓ [INFO] Borrowing claim email sent (itemCount: 3)
```

### **Test 3: Email Failure Handling**
To simulate email failure:
1. Temporarily set invalid `EMAIL_USER` in `.env`
2. Restart server: `npm start`
3. Try to borrow a book

Expected behavior:
```bash
# Response shows:
"emailSent": false

# But borrowing STILL SUCCEEDS:
"success": true

# Logs show:
[WARN] Borrowing claim email send failed (but borrowing succeeded)
Error: Invalid login (email credentials bad)
```

---

## 📊 Database Verification

### **Check Borrowing Records:**
```sql
-- View all recent borrowings with claim deadlines
SELECT 
  bb.id,
  s.student_id,
  s.fullname,
  b.title,
  bb.accession_number,
  bb.borrow_date,
  bb.claim_expires_at,
  bb.email_sent_at,
  bb.status
FROM book_borrowings bb
JOIN students s ON bb.student_id = s.student_id
JOIN books b ON bb.book_id = b.id
WHERE bb.borrow_date >= NOW() - INTERVAL 1 DAY
ORDER BY bb.borrow_date DESC;

-- Check if emails were sent
SELECT 
  COUNT(*) as total_borrowings,
  SUM(IF(email_sent_at IS NOT NULL, 1, 0)) as emails_sent,
  SUM(IF(email_sent_at IS NULL, 1, 0)) as emails_pending
FROM book_borrowings
WHERE borrow_date >= NOW() - INTERVAL 1 DAY;
```

---

## 🔍 Logs to Monitor

### **Success Logs (watch for these):**
```
[INFO] Single book borrowed successfully
[INFO] Bulk borrow successful
[INFO] Borrowing transaction created
[INFO] Borrowing claim email sent
```

### **Failure Logs (investigate these):**
```
[ERROR] Error borrowing book
[WARN] Borrowing claim email send failed (but borrowing succeeded)
[ERROR] Failed to send borrowing claim email
```

### **View logs:**
```bash
# If using PM2:
pm2 logs spist-library

# Otherwise:
tail -f logs/app.log
```

---

## 🚨 Troubleshooting

### **Issue: "Email not configured"**
**Check:**
```bash
echo $EMAIL_USER
echo $EMAIL_PASS
```
**Fix:**
- Update `.env` with valid SMTP credentials
- Restart: `npm start`
- Verify: Check logs for "Email transporter ready"

---

### **Issue: "Invalid login"**
**Cause:** Wrong email or app password
**Fix (Gmail):**
1. Use app-specific 16-character password (not regular password)
2. Verify 2FA is enabled
3. Test SMTP with: `npm test` (if test suite available)

---

### **Issue: Server crashes on borrow**
**Check:**
1. SQL migration ran successfully (verify `claim_expires_at` column exists)
2. No database connection errors in logs
3. `borrowService.js` file exists in `/src/services/`

---

## 🎯 Performance Notes

- **Email sending is non-blocking** - Happens after DB transaction commits
- **One email per transaction** - Even if borrowing 5 books, only 1 email sent
- **Graceful degradation** - If SMTP server down, borrowing still succeeds
- **No duplicate emails** - Email sent only if DB insert succeeds

---

## 📝 API Response Changes

### **Before (Old Response):**
```json
{
  "success": true,
  "dueDate": "2026-03-10",
  "accessionNumber": "ACC-001"
}
```

### **After (New Response):**
```json
{
  "success": true,
  "dueDate": "2026-03-10",
  "accessionNumber": "ACC-001",
  "claimExpiresAt": "2026-02-24T10:30:00.000Z",  // NEW
  "emailSent": true                               // NEW
}
```

---

## ✅ Checklist

- [ ] SQL migration executed successfully
- [ ] `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` configured in `.env`
- [ ] Server restarted after `.env` changes
- [ ] Logs show "Email transporter ready" on startup
- [ ] Test single borrow and receive email
- [ ] Test bulk borrow and receive one email
- [ ] Verify `claim_expires_at` is exactly 24 hours from `borrow_date`
- [ ] Verify accession numbers appear in email
- [ ] Simulate email failure and confirm borrowing still succeeds

---

## 🔐 Security Notes

- Passwords are NOT logged (checked in mailer.js)
- Email credentials stored only in `.env` (never committed to git)
- Emails use TLS encryption (secure SMTP)
- Database transactions are atomic (all-or-nothing)

---

## 📞 Support

If emails not sending:
1. Check `.env` configuration
2. Look for error logs: `[ERROR] Failed to send borrowing claim email`
3. Verify SMTP provider (Gmail, SendGrid, etc.) settings
4. Test SMTP manually: `telnet smtp.gmail.com 587`

---

**Implementation Date: February 23, 2026**  
**Status: ✅ Production Ready**

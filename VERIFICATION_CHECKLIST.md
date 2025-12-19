# ✅ Implementation Verification Checklist

Use this checklist to verify that Google Sign-In and the new UI are working correctly.

## 📋 Pre-Launch Checklist

### Phase 1: Database Setup
- [ ] MySQL/MariaDB server is running
- [ ] Connected to `spist_library` database
- [ ] Ran migration: `ALTER TABLE students ADD COLUMN google_id...`
- [ ] Ran migration: `ALTER TABLE admins ADD COLUMN google_id...`
- [ ] Ran migration: `ALTER TABLE students MODIFY COLUMN password...`
- [ ] Ran migration: `ALTER TABLE admins MODIFY COLUMN password...`
- [ ] Verified columns exist: `DESCRIBE students;` and `DESCRIBE admins;`

**Verification SQL:**
```sql
USE spist_library;
DESCRIBE students;  -- Should show google_id column
DESCRIBE admins;    -- Should show google_id column
```

---

### Phase 2: Google Cloud Console
- [ ] Created Google Cloud project (or selected existing)
- [ ] Enabled Google+ API (or People API)
- [ ] Configured OAuth consent screen
  - [ ] Added app name: "SPIST Library Management System"
  - [ ] Added support email
  - [ ] Added developer contact
- [ ] Created OAuth 2.0 Client ID (Web application)
- [ ] Added JavaScript origin: `http://localhost:3000`
- [ ] Added redirect URI: `http://localhost:3000/auth/google/callback`
- [ ] Copied Client ID (starts with numbers, ends with `.apps.googleusercontent.com`)
- [ ] Copied Client Secret

**Verification:** Client ID and Secret are saved securely

---

### Phase 3: Environment Configuration
- [ ] Created `.env` file (from `.env.example`)
- [ ] Added `GOOGLE_CLIENT_ID=...`
- [ ] Added `GOOGLE_CLIENT_SECRET=...`
- [ ] Added `GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback`
- [ ] Generated session secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Added `SESSION_SECRET=...` (32+ character random string)
- [ ] Verified database credentials (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
- [ ] Verified email settings (if using forgot password)

**Verification:** Run `cat .env` (or `type .env` on Windows) to confirm all values are set

---

### Phase 4: File Integrity
- [ ] `src/config/passport.js` exists
- [ ] `database/migrations/add_google_auth.sql` exists
- [ ] `public/css/auth-layout.css` exists
- [ ] `.env.example` exists
- [ ] `GOOGLE_SIGNIN_SETUP.md` exists
- [ ] `IMPLEMENTATION_COMPLETE.md` exists
- [ ] `QUICK_START.md` exists
- [ ] `UI_TRANSFORMATION.md` exists
- [ ] `server.js` contains `passport` and `session` imports
- [ ] `src/routes/auth.js` contains `/auth/google` routes
- [ ] `src/pages/login.html` has new two-column design
- [ ] `src/pages/signup.html` has new two-column design

**Verification:** Use `ls` or `dir` to check file existence

---

### Phase 5: Dependencies
- [ ] `package.json` lists `passport`
- [ ] `package.json` lists `passport-google-oauth20`
- [ ] `package.json` lists `express-session`
- [ ] All dependencies installed: `npm install` (no errors)
- [ ] `node_modules/` folder exists and populated

**Verification:** Run `npm list passport passport-google-oauth20 express-session`

Expected output:
```
spist-library-management-system@1.0.0
├── passport@0.7.0
├── passport-google-oauth20@2.0.0
└── express-session@1.18.2
```

---

### Phase 6: Assets
- [ ] School building image added to `public/img/school-building.jpg`
  - OR updated image path in login.html (line 21)
  - OR updated image path in signup.html (line 21)
- [ ] School logo exists at `public/img/school-logo-large.png`
- [ ] Social icons exist (if custom):
  - `public/img/gmaili.png` (optional)
  - `public/img/facebookicon.png` (optional)
  - `public/img/igicon.png` (optional)

**Verification:** Open images in browser to confirm they load

---

## 🚀 Launch Verification

### Phase 7: Server Startup
- [ ] Start server: `npm start` or `node server.js`
- [ ] No errors in console
- [ ] Server listening on port 3000
- [ ] Console shows: "Server running on port 3000" (or similar)

**Expected console output:**
```
Server running on http://localhost:3000
Database connected successfully
```

---

### Phase 8: UI Verification - Login Page
- [ ] Navigate to: `http://localhost:3000/login`
- [ ] Page loads without errors
- [ ] **Desktop view (>968px):**
  - [ ] Left panel shows school building image
  - [ ] Logo appears on left panel
  - [ ] School name overlay visible
  - [ ] Right panel is green (#4A8B5C)
  - [ ] "SPIST Tools" heading visible
  - [ ] Email input field present
  - [ ] Password input field present
  - [ ] "Sign In" button present (white, rounded)
  - [ ] "OR" divider visible
  - [ ] "Sign in with Google" button present (with Google logo)
  - [ ] Social icons at bottom (Email, Facebook, Instagram)
  - [ ] "Forgot Password?" link works
  - [ ] "Sign Up" link navigates to signup page
- [ ] **Mobile view (<968px):**
  - [ ] Only green panel visible
  - [ ] Image panel hidden
  - [ ] All form elements visible and usable
  - [ ] Buttons are touch-friendly (big enough)

**Verification:** Resize browser window to test responsive design

---

### Phase 9: UI Verification - Signup Page
- [ ] Navigate to: `http://localhost:3000/signup`
- [ ] Page loads without errors
- [ ] Same two-column layout as login page
- [ ] All form fields present:
  - [ ] Full Name
  - [ ] Email Address
  - [ ] Student ID
  - [ ] Department dropdown
  - [ ] Year Level dropdown
  - [ ] Student Type dropdown
  - [ ] Contact Number
  - [ ] Password
  - [ ] Confirm Password
- [ ] "Create Account" button present
- [ ] "OR" divider visible
- [ ] "Sign up with Google" button present
- [ ] "Login" link navigates back to login page

---

### Phase 10: Traditional Authentication (Regression Test)
- [ ] Can login with existing email/password
- [ ] Error messages display correctly for wrong password
- [ ] "Forgot Password" modal opens
- [ ] Forgot password email sends (if configured)
- [ ] Can create new account via signup form
- [ ] Form validation works (email format, student ID pattern)
- [ ] Password confirmation validation works
- [ ] After login, redirects to correct dashboard

**Test account:** Use existing admin/student from database

---

### Phase 11: Google Sign-In - First Time User
- [ ] Click "Sign in with Google" button
- [ ] Redirects to Google consent screen
- [ ] Shows app name: "SPIST Library Management System"
- [ ] Lists requested permissions (profile, email)
- [ ] After authorization, redirects back to app
- [ ] **For student email:**
  - [ ] Creates new student record in database
  - [ ] Sets `google_id` field
  - [ ] Sets default values (department='General', year_level=1)
  - [ ] Sets `password` to NULL
  - [ ] Redirects to `/dashboard/student/student-dashboard.html`
  - [ ] Student dashboard loads successfully
- [ ] **For admin email (contains "admin" or @spist-admin.edu.ph):**
  - [ ] Creates new admin record in database
  - [ ] Sets `google_id` field
  - [ ] Sets `role` to 'system_admin'
  - [ ] Sets `password` to NULL
  - [ ] Redirects to `/dashboard/admin/admin-dashboard.html`
  - [ ] Admin dashboard loads successfully

**Verification SQL:**
```sql
SELECT * FROM students WHERE google_id IS NOT NULL;
SELECT * FROM admins WHERE google_id IS NOT NULL;
```

---

### Phase 12: Google Sign-In - Existing User (Account Linking)
- [ ] Create a test student via traditional signup
- [ ] Note the email address used
- [ ] Logout
- [ ] Click "Sign in with Google"
- [ ] Use the SAME email address for Google sign-in
- [ ] System should:
  - [ ] Find existing student by email
  - [ ] Update `google_id` field (not create duplicate)
  - [ ] Redirect to dashboard
  - [ ] Not create a second record with same email

**Verification SQL:**
```sql
-- Should return 1 record, not 2
SELECT COUNT(*) FROM students WHERE email = 'test@example.com';

-- Should have google_id populated
SELECT google_id FROM students WHERE email = 'test@example.com';
```

---

### Phase 13: Session Management
- [ ] After Google sign-in, can navigate between pages
- [ ] Session persists across page refreshes
- [ ] After logout, session is cleared
- [ ] Cannot access dashboard without logging in
- [ ] Cookies are set correctly (check browser DevTools → Application → Cookies)

**Expected cookies:**
- For students: `studentId`, `studentEmail`, `studentName`
- For admins: `adminRole`, `adminEmail`, `adminName`

---

### Phase 14: Role-Based Redirects
- [ ] **Student login** → redirects to `/dashboard/student/student-dashboard.html`
- [ ] **System Admin login** → redirects to `/dashboard/admin/admin-dashboard.html`
- [ ] **Super Admin login** → redirects to `/dashboard/super-admin/super-admin-dashboard.html`
- [ ] Role-based access control still works (RBAC from previous implementation)
- [ ] System admins cannot manage other admins
- [ ] Super admins CAN manage other admins

---

### Phase 15: Error Handling
- [ ] If Google OAuth fails, redirects to `/login.html`
- [ ] If user denies consent, redirects to login with error
- [ ] If `.env` is missing values, server shows error on startup
- [ ] If database connection fails, appropriate error shown
- [ ] If session secret is missing, warning shown

**Test:** Temporarily set `GOOGLE_CLIENT_ID=invalid` and verify error handling

---

### Phase 16: Browser Console Check
Open browser DevTools (F12) and check:
- [ ] No JavaScript errors in Console tab
- [ ] No 404 errors in Network tab
- [ ] CSS files load successfully (`auth-layout.css`)
- [ ] Image files load successfully (school building, logo)
- [ ] `/auth/google` endpoint responds (click button and check Network tab)

---

### Phase 17: Security Verification
- [ ] `.env` file is NOT committed to git
- [ ] `.env` is listed in `.gitignore`
- [ ] Session secret is random and not default value
- [ ] Cookies have `httpOnly` flag in production
- [ ] HTTPS is used in production (not required for localhost)
- [ ] No sensitive data logged in console

**Verification:** Run `git status` and ensure `.env` is ignored

---

## 🎯 Functional Test Scenarios

### Scenario 1: New Student - Google Sign-In
1. [ ] Clear browser cookies
2. [ ] Go to login page
3. [ ] Click "Sign in with Google"
4. [ ] Use a Google account NOT in database
5. [ ] Verify: New student record created
6. [ ] Verify: Redirected to student dashboard
7. [ ] Verify: Can borrow books, view profile

### Scenario 2: Existing Student - Google Link
1. [ ] Create student via traditional signup: `john@spist.edu.ph`
2. [ ] Logout
3. [ ] Click "Sign in with Google"
4. [ ] Use `john@spist.edu.ph` Google account
5. [ ] Verify: No duplicate record
6. [ ] Verify: `google_id` added to existing record
7. [ ] Verify: Can now login with EITHER method

### Scenario 3: Admin Creation
1. [ ] Click "Sign in with Google"
2. [ ] Use email: `admin@spist-admin.edu.ph`
3. [ ] Verify: Admin record created (not student)
4. [ ] Verify: Role is `system_admin`
5. [ ] Verify: Redirected to admin dashboard
6. [ ] Verify: Can view students, books
7. [ ] Verify: CANNOT manage other admins (RBAC)

### Scenario 4: Mixed Authentication
1. [ ] Login with email/password
2. [ ] Navigate around site
3. [ ] Logout
4. [ ] Login with Google (same account)
5. [ ] Verify: Same user, same data
6. [ ] Verify: Session maintained correctly

### Scenario 5: Mobile Usage
1. [ ] Open on mobile device (or use DevTools responsive mode)
2. [ ] Verify: Image panel hidden
3. [ ] Verify: Green panel full-width
4. [ ] Verify: Buttons are touch-friendly
5. [ ] Verify: Google sign-in works on mobile
6. [ ] Verify: Forms are usable on small screens

---

## 🐛 Known Issues to Watch For

| Issue | Symptom | Solution |
|-------|---------|----------|
| redirect_uri_mismatch | Google error page | Check redirect URI in console exactly matches |
| Invalid Client | OAuth error | Verify CLIENT_ID and SECRET in .env |
| Session undefined | User not redirected | Check SESSION_SECRET is set |
| Image not loading | Broken image on left panel | Add school-building.jpg or update path |
| 404 on /auth/google | Button doesn't work | Verify server.js includes authRoutes |
| Duplicate users | Two records for same email | Check passport.js linking logic |

---

## 📊 Database Verification Queries

Run these SQL queries to verify data integrity:

```sql
-- Check for Google-linked students
SELECT student_id, fullname, email, google_id, department, year_level
FROM students
WHERE google_id IS NOT NULL;

-- Check for Google-linked admins
SELECT id, fullname, email, google_id, role
FROM admins
WHERE google_id IS NOT NULL;

-- Check for users with both password and Google
SELECT email, 
       (password IS NOT NULL) as has_password,
       (google_id IS NOT NULL) as has_google
FROM students
WHERE google_id IS NOT NULL;

-- Count authentication methods
SELECT 
  SUM(CASE WHEN password IS NOT NULL AND google_id IS NULL THEN 1 ELSE 0 END) as password_only,
  SUM(CASE WHEN password IS NULL AND google_id IS NOT NULL THEN 1 ELSE 0 END) as google_only,
  SUM(CASE WHEN password IS NOT NULL AND google_id IS NOT NULL THEN 1 ELSE 0 END) as both
FROM students;
```

---

## ✅ Sign-Off Checklist

Before considering implementation complete:

- [ ] All database migrations applied successfully
- [ ] Google OAuth credentials configured
- [ ] Login page displays new UI correctly (desktop + mobile)
- [ ] Signup page displays new UI correctly (desktop + mobile)
- [ ] Traditional email/password login works
- [ ] Google Sign-In creates new users correctly
- [ ] Google Sign-In links to existing users correctly
- [ ] Admin detection works (email-based)
- [ ] Student detection works (default)
- [ ] Role-based redirects function correctly
- [ ] RBAC still enforced (super_admin vs system_admin)
- [ ] Session management works
- [ ] No JavaScript errors in browser console
- [ ] No server errors in terminal
- [ ] Mobile responsive design verified
- [ ] Documentation read and understood
- [ ] `.env` file secured (not in git)
- [ ] Ready for production deployment (with HTTPS)

---

## 🎉 Success Criteria

Your implementation is complete when:

1. ✅ A new user can sign in with Google and access their dashboard
2. ✅ An existing user can link their Google account
3. ✅ The new UI displays correctly on desktop and mobile
4. ✅ Traditional authentication still works alongside Google
5. ✅ No errors in browser console or server logs
6. ✅ All role-based access controls function correctly

---

## 📞 Need Help?

If any checklist item fails:
1. Check `GOOGLE_SIGNIN_SETUP.md` for detailed instructions
2. Review `IMPLEMENTATION_COMPLETE.md` for technical details
3. Check `QUICK_START.md` for common issues
4. Verify `.env` values are correct
5. Check server logs for error messages
6. Check browser console for client-side errors

**Most common issues:**
- Redirect URI mismatch → Fix in Google Console
- Invalid credentials → Check .env file
- Session not working → Verify SESSION_SECRET

---

**✨ Once all items are checked, your Google Sign-In integration is complete!**

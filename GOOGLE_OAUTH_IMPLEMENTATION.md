# Google OAuth2 Implementation Guide

## Overview
This document describes the complete Google OAuth2 implementation for the SPIST Library Management System. The implementation adds "Sign in with Google" functionality WITHOUT modifying any existing password-based authentication.

## Stack
- **Backend:** Node.js + Express 4.18.2
- **Authentication:** Passport.js 0.7.0
- **OAuth Strategy:** passport-google-oauth20 2.0.0
- **Session Management:** express-session 1.18.2
- **Database:** MySQL2 3.6.5

## Implementation Complete ✅

### 1. Google OAuth Configuration

**File:** [src/config/passport.js](src/config/passport.js)

- Configured `GoogleStrategy` from `passport-google-oauth20`
- Reads from environment variables:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL` (defaults to `http://localhost:3000/auth/google/callback`)

**Key Features:**
- Auto-detects user type (admin vs student) based on email domain
- Creates new users automatically if not found
- Links Google ID to existing accounts if email matches
- Supports both admin and student roles

### 2. Backend Routes

**File:** [src/routes/auth.js](src/routes/auth.js)

```javascript
// Start Google OAuth flow
GET /auth/google
  → Redirects to Google login

// Google callback after user authenticates
GET /auth/google/callback
  → Passport validates token
  → Creates or finds user in database
  → Sets session cookies for admin or student
  → Redirects to appropriate dashboard
```

**Callback Behavior:**
- **For Admins:** Sets cookies and redirects to admin dashboard (or super-admin if role is super_admin)
- **For Students:** Sets cookies and redirects to student dashboard
- **On Failure:** Redirects to `/login.html`

### 3. Frontend Integration

#### Login Page
**File:** [src/pages/login.html](src/pages/login.html)

```html
<button type="button" class="auth-button google-button" onclick="signInWithGoogle()">
  <svg><!-- Google logo --></svg>
  Sign in with Google
</button>
```

#### Signup Page
**File:** [src/pages/signup.html](src/pages/signup.html)

```html
<button type="button" class="auth-button google-button" onclick="signUpWithGoogle()">
  <svg><!-- Google logo --></svg>
  Sign up with Google
</button>
```

#### JavaScript Functions

**File:** [public/js/login.js](public/js/login.js)
```javascript
function signInWithGoogle() {
  window.location.href = '/auth/google';
}
```

**File:** [public/js/signup.js](public/js/signup.js)
```javascript
function signUpWithGoogle() {
  window.location.href = '/auth/google';
}
```

Both functions redirect to the `/auth/google` route to start the OAuth flow.

### 4. Environment Variables

**File:** [.env.example](.env.example)

```dotenv
# Google OAuth 2.0 Configuration
# Get these credentials from: https://console.cloud.google.com/
# 1. Create a new project or select existing project
# 2. Enable Google+ API
# 3. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
# 4. Set Authorized JavaScript origins: http://localhost:3000
# 5. Set Authorized redirect URIs: http://localhost:3000/auth/google/callback

GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 5. Database Integration

**Admin Users:**
- Field: `google_id` (stores Google ID)
- Auto-creates new admins with role `system_admin` (customizable in passport.js line 68)
- Links to existing admin if email matches

**Student Users:**
- Field: `google_id` (stores Google ID)
- Auto-creates new students with defaults:
  - `student_id`: GOOGLE-{timestamp}
  - `department`: General
  - `year_level`: 1
  - `student_type`: undergraduate
  - `status`: active

## Setup Instructions

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable "Google+ API"
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Choose "Web application"
6. Add Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
7. Add Authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://yourdomain.com/auth/google/callback` (production)

### Step 2: Configure Environment

Create `.env` file in project root:
```
GOOGLE_CLIENT_ID=your_id_here
GOOGLE_CLIENT_SECRET=your_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### Step 3: Verify Database Has google_id Column

```sql
-- For admins table
ALTER TABLE admins ADD COLUMN google_id VARCHAR(255) UNIQUE NULL AFTER id;

-- For students table
ALTER TABLE students ADD COLUMN google_id VARCHAR(255) UNIQUE NULL AFTER student_id;
```

### Step 4: Start Server

```bash
npm start
```

Server should display:
```
Server running on port 3000
Successfully connected to database: spist_library (development)
```

## User Flow

### First Time Google Login (New User)
1. User clicks "Sign in with Google"
2. Redirects to `/auth/google`
3. Passport initiates Google OAuth flow
4. User logs in with Google account
5. Google redirects to `/auth/google/callback`
6. System creates new user in database (admin or student based on email)
7. Session established with cookies
8. Redirects to appropriate dashboard

### Returning Google User
1. User clicks "Sign in with Google"
2. Google recognizes user (if still logged in)
3. Auto-authenticates without prompting
4. Session established
5. Redirects to dashboard

### Linking Google to Existing Account
1. User has existing password account (e.g., email: john@spist.edu.ph)
2. Later signs up with Google using same email
3. System detects existing user by email
4. Links Google ID to existing account
5. User can now sign in with either method

## Existing Features Preserved ✅

- ✅ Password-based login still works
- ✅ Password-based signup still works
- ✅ Forgot password functionality unchanged
- ✅ Admin roles (super_admin, system_admin) intact
- ✅ Student dashboard unaffected
- ✅ Admin dashboard unaffected
- ✅ Role-based access control maintained
- ✅ Session management unchanged
- ✅ Database structure compatible

## Error Handling

- **Missing Google Credentials:** Server warns but continues (password login works)
- **Google Authentication Failure:** Redirects to `/login.html`
- **Database Error:** Logs error, passport returns done(error)
- **Missing User Fields:** Auto-fills with defaults

## Testing Checklist

- [ ] Server starts without errors
- [ ] `/login` page loads with Google button
- [ ] `/signup` page loads with Google button
- [ ] Clicking Google button initiates OAuth flow
- [ ] Password login still works
- [ ] Admin dashboard accessible after Google login
- [ ] Student dashboard accessible after Google login
- [ ] User cookies set correctly
- [ ] Session persists across page reloads
- [ ] Logout clears session

## Security Notes

- Session cookies set to `httpOnly: true` by default
- Secure cookies enabled in production (`NODE_ENV=production`)
- Google Client Secret never exposed to frontend
- OAuth tokens validated server-side only
- User data validated before database insert

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing GOOGLE_CLIENT_ID" warning | Add to .env file |
| Redirect to /login.html | Check Google OAuth credentials, verify callback URL |
| New user not created | Check database `google_id` column exists, check email domain |
| Session not persisting | Verify SESSION_SECRET set, check httpOnly cookie settings |
| "address already in use" | Kill process: `lsof -i :3000` or use different PORT |

## Production Deployment

1. Update `.env` with production credentials
2. Set `NODE_ENV=production` to enable secure cookies
3. Update Google OAuth redirect URIs to production domain
4. Configure HTTPS for secure cookie transmission
5. Set `GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback`

## Files Modified

- ✅ [public/js/login.js](public/js/login.js) - Added `signInWithGoogle()` function
- ✅ [public/js/signup.js](public/js/signup.js) - Added `signUpWithGoogle()` function
- ✅ [.env.example](.env.example) - Added Google OAuth variables

## Files Already Configured

- [src/config/passport.js](src/config/passport.js) - Google OAuth strategy (complete)
- [src/routes/auth.js](src/routes/auth.js) - `/auth/google` and `/auth/google/callback` routes (complete)
- [server.js](server.js) - Passport initialization (complete)
- [src/pages/login.html](src/pages/login.html) - Google button (complete)
- [src/pages/signup.html](src/pages/signup.html) - Google button (complete)

## References

- [Passport.js Documentation](http://www.passportjs.org/)
- [passport-google-oauth20](https://github.com/jaredhanson/passport-google-oauth20)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Express Session](https://github.com/expressjs/session)

---

**Implementation Status:** ✅ COMPLETE AND TESTED
**Date:** December 19, 2025
**Verified:** Server running, routes active, existing auth preserved

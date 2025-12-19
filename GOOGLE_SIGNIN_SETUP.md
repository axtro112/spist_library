# Google Sign-In Setup Guide

## 📋 Overview
This guide will help you set up Google Sign-In authentication for the SPIST Library Management System.

## 🔧 Step 1: Apply Database Migration

Run the following SQL migration to add Google OAuth support:

```sql
-- Navigate to your MySQL/MariaDB client and run:
SOURCE database/migrations/add_google_auth.sql;

-- OR manually execute in MySQL Workbench or phpMyAdmin:
ALTER TABLE students 
ADD COLUMN google_id VARCHAR(255) NULL UNIQUE 
AFTER email;

ALTER TABLE admins 
ADD COLUMN google_id VARCHAR(255) NULL UNIQUE 
AFTER email;

ALTER TABLE students 
MODIFY COLUMN password VARCHAR(255) NULL;

ALTER TABLE admins 
MODIFY COLUMN password VARCHAR(255) NULL;
```

## 🔐 Step 2: Get Google OAuth Credentials

### 2.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `SPIST Library Management`
4. Click "Create"

### 2.2 Enable Google+ API

1. In the Google Cloud Console, navigate to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and click "Enable"

### 2.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (or Internal if using Google Workspace)
   - App name: `SPIST Library Management System`
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Skip Scopes section (click "Save and Continue")
   - Add test users if needed
   - Click "Save and Continue"

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `SPIST Library Web Client`
   - Authorized JavaScript origins:
     ```
     http://localhost:3000
     http://localhost:3000/
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:3000/auth/google/callback
     ```
   - Click "Create"

5. **Copy your Client ID and Client Secret** (you'll need these for the .env file)

## ⚙️ Step 3: Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and update the following values:

   ```env
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your_actual_client_id_from_google_console
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_from_google_console
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   
   # Generate a random session secret:
   # Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   SESSION_SECRET=paste_the_generated_random_string_here
   ```

3. Generate a session secret by running:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and paste it as the `SESSION_SECRET` value

## 🖼️ Step 4: Add School Building Image

The new login/signup pages expect a school building image at:
```
public/img/school-building.jpg
```

Add your school building photo to this location, or update the image path in:
- `src/pages/login.html` (line 21)
- `src/pages/signup.html` (line 21)

## 🚀 Step 5: Start the Server

1. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```
   Or:
   ```bash
   node server.js
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000/login
   ```

## ✅ Step 6: Test Google Sign-In

### Test Student Sign-In
1. Go to the login page
2. Click "Sign in with Google"
3. Authorize with a Google account
4. The system will:
   - Create a new student account if the email doesn't exist
   - Link the Google account if an email match is found
   - Redirect to the student dashboard

### Test Admin Sign-In
1. Use an email that contains "admin" or ends with `@spist-admin.edu.ph`
2. Click "Sign in with Google"
3. The system will:
   - Create a new admin account with `system_admin` role
   - Link the Google account if an email match is found
   - Redirect to the admin dashboard

## 🔄 How Google Sign-In Works

### User Type Detection
The system automatically determines if a user is an admin or student based on their email:

- **Admin**: Email contains "admin" OR ends with `@spist-admin.edu.ph`
- **Student**: All other emails

### Auto-User Creation
When a user signs in with Google for the first time:

**For Students:**
- Creates a new student record with:
  - `google_id`: Google account ID
  - `fullname`: From Google profile
  - `email`: From Google account
  - `department`: "General" (default)
  - `year_level`: 1 (default)
  - `student_type`: "undergraduate" (default)
  - `password`: NULL (not required for Google sign-in)
  - `status`: "active"

**For Admins:**
- Creates a new admin record with:
  - `google_id`: Google account ID
  - `fullname`: From Google profile
  - `email`: From Google account
  - `role`: "system_admin" (default)
  - `password`: NULL (not required for Google sign-in)

### Account Linking
If a user already exists with the same email:
- The system will link the Google account to the existing user
- Updates the `google_id` field
- User can now sign in with either email/password or Google

## 🎨 UI Changes

### New Two-Column Layout
The login and signup pages now feature a modern two-column design:

**Left Panel:**
- Full-height school building background image
- School logo and name overlay
- Descriptive tagline

**Right Panel:**
- Green panel (#4A8B5C)
- "SPIST Tools" branding
- Login/signup forms
- "Sign in with Google" button
- Social media icons

### Responsive Design
- On screens smaller than 968px, the image panel is hidden
- Mobile-optimized forms and buttons
- Touch-friendly UI elements

## 🔒 Security Features

1. **Session Management**:
   - 24-hour session expiration
   - HTTP-only cookies in production
   - Secure cookies when using HTTPS

2. **Password Requirements**:
   - Not required for Google sign-in users
   - Optional for users who want both login methods

3. **Token Verification**:
   - Google OAuth tokens are verified by Google
   - Passport.js handles all authentication logic

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
**Solution**: Make sure your redirect URI in Google Cloud Console exactly matches:
```
http://localhost:3000/auth/google/callback
```

### Error: "Invalid Client"
**Solution**: Double-check your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

### Error: "Session undefined"
**Solution**: Make sure `SESSION_SECRET` is set in your `.env` file

### Google Sign-In button doesn't work
**Solution**: 
1. Check browser console for errors
2. Verify the server is running
3. Ensure `/auth/google` route is accessible

### User created but not redirected
**Solution**: Check that cookies are enabled in your browser

## 📝 Production Deployment

When deploying to production:

1. Update `.env` with production URLs:
   ```env
   NODE_ENV=production
   FRONTEND_URL=https://yourdomain.com
   GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
   ```

2. Update Google Cloud Console redirect URIs:
   - Add: `https://yourdomain.com/auth/google/callback`

3. Enable HTTPS for secure cookies

4. Set strong `SESSION_SECRET` (32+ characters, random)

5. Consider rate limiting on authentication endpoints

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Documentation](http://www.passportjs.org/)
- [Express Session Documentation](https://github.com/expressjs/session)

## 🎉 Success!

You should now have a fully functional Google Sign-In system integrated with your SPIST Library Management System!

For questions or issues, refer to the main README.md file.

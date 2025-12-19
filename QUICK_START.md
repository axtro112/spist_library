# 🚀 Quick Start Guide - Google Sign-In

## ⚡ 3-Minute Setup

### 1️⃣ Apply Database Migration (30 seconds)
Open MySQL Workbench or phpMyAdmin and run:
```sql
USE spist_library;

ALTER TABLE students ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email;
ALTER TABLE admins ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email;
ALTER TABLE students MODIFY COLUMN password VARCHAR(255) NULL;
ALTER TABLE admins MODIFY COLUMN password VARCHAR(255) NULL;
```

### 2️⃣ Get Google Credentials (2 minutes)
1. Visit: https://console.cloud.google.com/
2. Create project → Enable Google+ API
3. Create OAuth Client ID (Web application)
4. Add redirect URI: `http://localhost:3000/auth/google/callback`
5. Copy Client ID & Secret

### 3️⃣ Configure .env (30 seconds)
```bash
# Copy template
cp .env.example .env

# Edit .env file - Add these 3 values:
GOOGLE_CLIENT_ID=paste_your_client_id
GOOGLE_CLIENT_SECRET=paste_your_client_secret
SESSION_SECRET=run_command_below_to_generate

# Generate session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4️⃣ Add School Image (Optional)
Place image at: `public/img/school-building.jpg`

Or edit these files to use existing image:
- `src/pages/login.html` - Line 21
- `src/pages/signup.html` - Line 21

### 5️⃣ Start & Test
```bash
npm start
# Open: http://localhost:3000/login
# Click "Sign in with Google"
```

---

## 🎯 What You Get

### ✨ New Features
- Google Sign-In button on login/signup pages
- Auto-create users on first Google login
- Link Google accounts to existing users
- Modern two-column UI design

### 🎨 UI Changes
**Before:** Single column centered form  
**After:** Two-column layout (image + green panel)

**Desktop View:**
```
┌─────────────────┬─────────────────┐
│                 │                 │
│  School Image   │  Green Panel    │
│  + Logo         │  + Login Form   │
│  + Text         │  + Google Btn   │
│                 │                 │
└─────────────────┴─────────────────┘
```

**Mobile View:**
```
┌─────────────────┐
│                 │
│  Green Panel    │
│  + Login Form   │
│  + Google Btn   │
│                 │
└─────────────────┘
```

### 🔐 How It Works

**User Type Detection:**
- `*@spist-admin.edu.ph` → Admin
- Email with "admin" → Admin  
- Everything else → Student

**First-Time Sign-In:**
- Creates new account automatically
- Students: Default to General dept, Year 1
- Admins: Default to system_admin role

**Existing Users:**
- Links Google account by email match
- Can use email/password OR Google

---

## 📋 File Changes Summary

### Created (6 files):
1. `src/config/passport.js` - OAuth strategy
2. `database/migrations/add_google_auth.sql` - DB schema
3. `public/css/auth-layout.css` - New UI styles
4. `.env.example` - Config template
5. `GOOGLE_SIGNIN_SETUP.md` - Full guide
6. `IMPLEMENTATION_COMPLETE.md` - Details

### Modified (4 files):
1. `server.js` - Added session + passport
2. `src/routes/auth.js` - Added OAuth routes
3. `src/pages/login.html` - Complete redesign
4. `src/pages/signup.html` - Complete redesign

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "redirect_uri_mismatch" | Check Google Console redirect URI matches exactly |
| "Invalid Client" | Double-check CLIENT_ID and CLIENT_SECRET in .env |
| Button doesn't work | Verify server is running on port 3000 |
| Not redirecting | Check browser allows cookies |
| Migration fails | Run SQL manually in MySQL Workbench |

---

## 📚 Documentation

- **Full Setup:** `GOOGLE_SIGNIN_SETUP.md`
- **Implementation Details:** `IMPLEMENTATION_COMPLETE.md`
- **Environment Config:** `.env.example`
- **Main Docs:** `README.md`

---

## ✅ Testing Checklist

- [ ] Database migration applied
- [ ] .env configured with Google credentials
- [ ] Server starts without errors
- [ ] Login page shows new design
- [ ] Google button initiates OAuth
- [ ] Can sign in with Google
- [ ] User created in database
- [ ] Redirects to correct dashboard
- [ ] Traditional login still works

---

## 🎉 Done!

Your authentication system is now upgraded with:
- ✅ Google Sign-In
- ✅ Modern UI
- ✅ Auto user creation
- ✅ Mobile responsive

**Need help?** Check `GOOGLE_SIGNIN_SETUP.md` for detailed instructions.

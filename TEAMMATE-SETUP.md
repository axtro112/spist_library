# SPIST Library - Teammate Setup Guide

This guide helps you run the project on a new device quickly.

## 1) Prerequisites

Install these first:

- Node.js 18+
- MySQL 8+
- Git
- VS Code (recommended)

Check versions:

```bash
node -v
npm -v
mysql --version
git --version
```

## 2) Clone and Open Project

```bash
git clone https://github.com/axtro112/spist_library.git
cd spist_library
```

## 3) Install Dependencies

```bash
npm install
```

## 4) Create Database and Import Schema

Database name must be `spist_library`.

### Option A - MySQL CLI

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS spist_library;"
mysql -u root -p spist_library < database/spist_library.sql
```

### Option B - MySQL Workbench / GUI

1. Create database `spist_library`
2. Open `database/spist_library.sql`
3. Run full script

## 5) Configure Environment Variables

Create `.env` at project root with this template:

```dotenv
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=spist_library
DB_PORT=3306

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

SESSION_SECRET=
JWT_SECRET=

EMAIL_USER=
EMAIL_PASS=
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM=noreply@spistlibrary.edu.ph

RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
SESSION_MAX_AGE=1800000
SESSION_SECURE_COOKIE=false
```

Notes:

- Keep `.env` local only. Do not commit it.
- If Google login is not needed in local dev, you can leave Google values empty.
- For password reset/email notifications, set `EMAIL_USER` and `EMAIL_PASS`.

## 6) Start the App

Use this command:

```bash
npm start
```

Why `npm start`?

- It runs `scripts/start-clean.js`
- It auto-frees port 3000 if occupied

Open:

- http://localhost:3000

## 7) Quick Health Check

After app starts, verify:

1. Landing page loads
2. Student login works
3. Admin/Super Admin login works
4. Books page loads
5. Manage Copies modal opens
6. QR image endpoint works while logged in:
   - `/api/book-copies/qr/ACC-2026-00060`

## 8) Backfill Existing Books (One-Time, If Needed)

If existing books do not yet have copy accessions:

```bash
npm run backfill:accessions
```

This will:

- Create missing `book_copies` records
- Generate accession numbers (`ACC-YYYY-xxxxx`)
- Link active borrowings that have no accession
- Recompute quantity counters from actual copies

## 9) Common Troubleshooting

### Port 3000 already in use

Use:

```bash
npm start
```

(Do not use `npm run start:raw` unless debugging startup.)

### DB connection errors

- Confirm MySQL service is running
- Confirm `.env` DB values are correct
- Confirm `spist_library` database exists

### QR popup shows broken image

- Hard refresh browser (Ctrl+F5)
- Ensure latest JS is pulled
- Ensure server restarted after pull

### OAuth issues

If using Google login, update Google Console:

- Authorized JavaScript origin: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/auth/google/callback`

### Email not sending

- Use Gmail App Password (not normal password)
- Verify `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`, `EMAIL_PORT`

## 10) Pull Latest and Re-run

When pulling new updates:

```bash
git pull
npm install
npm start
```

If schema changed in future updates, run provided migration scripts from `database/`.

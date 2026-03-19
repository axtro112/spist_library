# SPiST Library Management System - 2-Minute Setup Checklist

Use this checklist when setting up the system on a new device.

## 1) Prerequisites

1. Install Node.js 18+
2. Install MySQL 8+
3. Install Git (optional but recommended)

## 2) Get the Project

1. Clone the repository or copy the project folder
2. Open the project in VS Code
3. Open a terminal in the project root

## 3) Install Dependencies

Run:

npm install

## 4) Create and Import Database

1. Create a MySQL database named: spist_library
2. Import file: database/spist_library.sql

## 5) Configure Environment

Create a .env file in the project root with values like:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=spist_library
DB_PORT=3306
PORT=3000
SESSION_SECRET=your_random_secret

## 6) Start the App

Run:

npm start

Notes:
- The start command auto-cleans port 3000 if it is occupied
- Open in browser: http://localhost:3000

## 7) Quick Health Check

1. Landing page loads
2. Student login works
3. Admin/Super Admin login works
4. Books and notifications load

## 8) Common Fixes

1. If dependencies fail: run npm install again
2. If DB connection fails: verify MySQL is running and .env is correct
3. If startup still fails: run npm run start:raw to inspect direct startup output

## 9) For Teammates

1. Pull latest changes before running
2. Keep .env local to each device
3. Use npm start for normal development

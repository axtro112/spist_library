const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const csrf = require("csurf");
const passport = require("./src/config/passport");
const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const studentRoutes = require("./src/routes/students");
const bookBorrowingRoutes = require("./src/routes/book-borrowings");
const booksRoutes = require("./src/routes/books");
require("dotenv").config();

// ✅ Validate critical environment variables on startup
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

// Optional warnings for feature-specific variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  Google OAuth not configured. Sign in with Google will not work.');
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  Email not configured. Password reset emails will not be sent.');
}

const PORT = process.env.PORT || 3000;

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL session store configuration
const sessionStoreOptions = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spist_library",
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 minutes
  expiration: 1800000, // 30 minutes
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
};

const sessionStore = new MySQLStore(sessionStoreOptions);

// Configure session middleware with MySQL store
app.use(
  session({
    key: 'spist_library_session',
    secret: process.env.SESSION_SECRET || "spist-library-secret-key-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset maxAge on every request
    cookie: {
      maxAge: 1800000, // 30 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: 'strict', // CSRF protection
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// CSRF Protection middleware
const csrfProtection = csrf({ cookie: false }); // Use session-based tokens

// Apply CSRF to routes (except auth routes that handle it separately)
app.use("/api/admin", csrfProtection);
app.use("/api/students", csrfProtection);
app.use("/api/book-borrowings", csrfProtection);
app.use("/api/books", csrfProtection);

// Middleware to make CSRF token available to all routes
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
  next();
});

app.use("/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/book-borrowings", bookBorrowingRoutes);
app.use("/api/books", booksRoutes);

app.use("/api", (err, req, res, next) => {
  console.error("API Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

app.use(express.static("public"));
app.use("/pages", express.static(path.join(__dirname, "src/pages")));

const authPages = {
  "/": "home.html",
  "/login": "login.html",
  "/signup": "signup.html",
  "/login-verification": "login-verification.html",
  "/reset-password": "reset-password.html",
};

Object.entries(authPages).forEach(([route, page]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, "src/pages", page));
  });
});

const adminPages = [
  "admin",
  "admin-dashboard",
  "admin-books",
  "admin-users",
  "admin-admins",
];

adminPages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    const destination = page === "admin" ? "admin-dashboard" : page;
    res.redirect(`/dashboard/admin/${destination}.html`);
  });
});

// Super Admin routes
const superAdminPages = [
  "super-admin",
  "super-admin-dashboard",
  "super-admin-admins",
  "super-admin-books",
  "super-admin-users",
  "super-admin-audit-logs",
  "super-admin-settings",
];

superAdminPages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    const destination = page === "super-admin" ? "super-admin-dashboard" : page;
    res.redirect(`/dashboard/super-admin/${destination}.html`);
  });
});

const studentPages = [
  "student",
  "student-dashboard",
  "student-books",
  "student-borrowed",
];

studentPages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    const destination = page === "student" ? "student-dashboard" : page;
    res.redirect(`/dashboard/student/${destination}.html`);
  });
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API endpoint not found",
    });
  }

  const requestedPage = req.path.substring(1);
  const pagesPath = path.join(__dirname, "src/pages", requestedPage);

  try {
    if (require("fs").existsSync(pagesPath)) {
      return res.sendFile(pagesPath);
    }
    res.sendFile(path.resolve(__dirname, "src/pages/home.html"));
  } catch (err) {
    console.error(err);
    res.sendFile(path.resolve(__dirname, "src/pages/home.html"));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

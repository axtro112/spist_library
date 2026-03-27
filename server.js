﻿const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const fs = require("fs");
const passport = require("./src/config/passport");
const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const bookBorrowingRoutes = require("./src/routes/book-borrowings");
const bookReturnRoutes = require("./src/routes/book-return");
const booksRoutes = require("./src/routes/books");
const bookCopiesRoutes = require("./src/routes/book-copies");
const notificationRoutes = require("./src/routes/notifications");
const qrPickupRoutes = require("./src/routes/qr-pickup");
const { startNotificationScheduler } = require("./src/utils/notificationScheduler");
const { runPendingMigrations } = require("./src/utils/migrationRunner");
const { auditLogMiddleware } = require("./src/middleware/audit");
require("dotenv").config();

const studentsRoutePath = path.join(__dirname, "src/routes/students.js");
const studentRoutes = fs.existsSync(studentsRoutePath)
  ? require("./src/routes/students")
  : null;

// Validate critical environment variables on startup
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'SESSION_SECRET', 'JWT_SECRET', 'QR_TOKEN_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

function validateStrongSecret(secretName, secretValue) {
  const weakPatterns = [
    /change-in-production/i,
    /your-?secret/i,
    /example/i,
    /spist-library-secret-key/i,
  ];

  if (String(secretValue).length < 32) {
    console.error(`${secretName} must be at least 32 characters long.`);
    process.exit(1);
  }

  if (weakPatterns.some((pattern) => pattern.test(String(secretValue)))) {
    console.error(`${secretName} appears to be a placeholder/weak value. Use a strong random value.`);
    process.exit(1);
  }
}

validateStrongSecret('SESSION_SECRET', process.env.SESSION_SECRET);
validateStrongSecret('JWT_SECRET', process.env.JWT_SECRET);
validateStrongSecret('QR_TOKEN_SECRET', process.env.QR_TOKEN_SECRET);

// Optional warnings for feature-specific variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('  Google OAuth not configured. Sign in with Google will not work.');
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('  Email not configured. Password reset emails will not be sent.');
}

const PORT = process.env.PORT || 3000;

const app = express();

// Trust Railway's reverse proxy - required for secure cookies and correct IP detection
app.set('trust proxy', 1);

const STATIC_EXTENSIONS = new Set([
  '.css', '.js', '.mjs', '.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.webp', '.avif', '.json', '.txt', '.xml'
]);

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function buildRateLimitKey(req) {
  const sessionUserId = req.session?.user?.id || req.session?.user?.studentId || req.session?.studentId;
  if (sessionUserId) {
    const role = req.session?.user?.userRole || 'session';
    return `${role}:${sessionUserId}`;
  }
  return `ip:${getClientIp(req)}`;
}

function isSkippableForGeneralLimiter(req) {
  const reqPath = String(req.path || '').toLowerCase();
  if (reqPath.includes('/stream') || reqPath.includes('/notifications/')) {
    return true;
  }
  if (reqPath === '/auth/csrf-token' || reqPath.startsWith('/public/')) {
    return true;
  }
  const ext = path.extname(reqPath);
  return STATIC_EXTENSIONS.has(ext);
}

// ============================================
// EJS VIEW ENGINE
// ============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// 1. Helmet - Secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],  // Allow inline event handlers (onclick, onsubmit, etc.)
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      frameSrc: ["'self'"] // Added frameSrc for iframes
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. CORS - Cross-Origin Resource Sharing
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://spistlibrary-production.up.railway.app',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
];
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, true); // Allow all origins in production to avoid lockout
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 3. Rate Limiting - DDoS Protection
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 1200 : 5000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  skip: isSkippableForGeneralLimiter,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 10 : 100, // More attempts in dev
  message: 'Too many login attempts, please try again after 15 minutes.',
  keyGenerator: (req) => `login:${getClientIp(req)}`,
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 600 : 1000,
  message: 'API rate limit exceeded, please slow down.',
  keyGenerator: buildRateLimitKey,
  skip: (req) => {
    // Skip rate limiting for notification endpoints and SSE
    return isSkippableForGeneralLimiter(req);
  }
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Apply stricter rate limiting to auth routes
app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);
app.use('/auth/forgot-password', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Apply API rate limiting to API routes (but notifications are skipped)
app.use('/api/', apiLimiter);

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL session store configuration
const sessionStoreOptions = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || "localhost",
  port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
  user: process.env.DB_USER || process.env.MYSQL_USER || "root",
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "",
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "spist_library",
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
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset maxAge on every request
    cookie: {
      maxAge: 28800000, // 8 hours (8 * 60 * 60 * 1000)
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax', // 'none' required for cross-site on Railway proxy
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files FIRST (before routes)
app.use(express.static("public"));
app.use("/pages", express.static(path.join(__dirname, "src/pages")));

const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_PROTECTED_AUTH_PATHS = new Set([
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
]);
const CSRF_EXEMPT_PATHS = new Set([
  "/auth/csrf-token",
]);

function tokensMatch(expected, provided) {
  if (!expected || !provided) return false;
  const expectedBuf = Buffer.from(String(expected));
  const providedBuf = Buffer.from(String(provided));
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function shouldProtectRoute(req) {
  if (CSRF_SAFE_METHODS.has(req.method)) return false;
  if (CSRF_EXEMPT_PATHS.has(req.path)) return false;
  if (req.path.startsWith("/api/")) return true;
  if (CSRF_PROTECTED_AUTH_PATHS.has(req.path)) return true;
  return false;
}

function csrfProtection(req, res, next) {
  if (!shouldProtectRoute(req)) return next();

  const sessionToken = req.session && req.session.csrfToken;
  const headerToken =
    req.headers["x-csrf-token"] || req.headers["csrf-token"] || req.body?._csrf;

  if (!tokensMatch(sessionToken, headerToken)) {
    const csrfError = new Error("invalid csrf token");
    csrfError.code = "EBADCSRFTOKEN";
    return next(csrfError);
  }

  return next();
}

// Middleware to make CSRF token available to all routes
app.use((req, res, next) => {
  res.locals.csrfToken = req.session ? req.session.csrfToken || null : null;
  next();
});

app.use(csrfProtection);

// Audit Logging Middleware - logs all CRUD operations
app.use(auditLogMiddleware());

// Debug endpoint to check session (disabled by default; never enabled in production)
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
  app.get('/api/debug/session', (req, res) => {
    res.json({
      hasSession: !!req.session,
      sessionData: req.session,
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    });
  });
}

// Mount routes - auth paths with state changes are CSRF-protected
app.use("/auth", authRoutes);
app.use("/api/admin", adminRoutes);
if (studentRoutes) {
  app.use("/api/students", studentRoutes);
} else {
  console.warn(" Students API routes are disabled: src/routes/students.js not found.");
}
app.use("/api/book-borrowings", bookBorrowingRoutes);
app.use("/api/book-borrowings", bookReturnRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/book-copies", bookCopiesRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", qrPickupRoutes); // QR pickup routes (includes /api/borrowings/:id/qr, /api/pickup)

// CSRF Error Handler - must come AFTER routes but BEFORE general error handler
// Applies to both /auth and /api routes
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error("CSRF Token Error:", {
      method: req.method,
      path: req.path,
      hasToken: !!req.headers['x-csrf-token'],
      hasBody: !!req.body,
      error: err.message
    });
    return res.status(403).json({
      success: false,
      message: "Invalid or missing CSRF token. Please refresh the page and try again.",
      error: "CSRF_TOKEN_INVALID"
    });
  }
  next(err);
});

// General API Error Handler
app.use("/api", (err, req, res, next) => {
  console.error("API Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
});

// ============================================
// LANDING PAGE ROUTE (role-aware)
// ============================================
app.get('/', (req, res) => {
  const sessionUser = req.session && req.session.user;

  // If user is already authenticated, redirect to their dashboard
  if (sessionUser && sessionUser.userRole === 'admin') {
    const role = sessionUser.role;
    if (role === 'super_admin') return res.redirect('/super-admin-dashboard');
    if (role === 'system_admin') return res.redirect('/admin-dashboard');
    return res.redirect('/admin-dashboard');
  }
  if (sessionUser && sessionUser.userRole === 'student') {
    return res.redirect('/student-dashboard');
  }
  // Not logged in – render landing page
  res.render('landing', { pageContent: null });
});

const authEjsPages = {
  "/login": "auth/login",
  "/signup": "auth/signup",
  "/login-verification": "auth/login-verification",
  "/reset-password": "auth/reset-password",
};

Object.entries(authEjsPages).forEach(([route, view]) => {
  app.get(route, (req, res) => {
    res.render(view);
  });
});

const authHtmlPages = {};

Object.entries(authHtmlPages).forEach(([route, page]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, "src/pages", page));
  });
});

const systemAdminPageRoutes = {
  "admin": "system-admin/dashboard",
  "admin-dashboard": "system-admin/dashboard",
  "admin-books": "system-admin/books",
  "admin-borrowed-books": "system-admin/borrowed-books",
  "admin-qr-scanner": "system-admin/qr-scanner",
  "admin-pickup-terminal": "system-admin/pickup-terminal",
  "admin-users": "system-admin/users",
  "admin-admins": "system-admin/admins",
  "admin-trash-bin": "system-admin/trash-bin",
};

app.get('/admin-books-trash', (req, res) => {
  const user = req.session && req.session.user;
  if (!user || user.userRole !== 'admin') {
    return res.redirect('/login');
  }
  return res.redirect('/admin-books');
});

Object.entries(systemAdminPageRoutes).forEach(([route, view]) => {
  app.get(`/${route}`, (req, res) => {
    const user = req.session && req.session.user;
    if (!user || user.userRole !== 'admin') {
      return res.redirect('/login');
    }

    return res.render(view, {
      adminId: user.id || '',
      adminEmail: user.email || '',
      adminRole: user.role || ''
    });
  });
});

// Super Admin routes - EJS rendering
const superAdminPageRoutes = {
  "super-admin": "super-admin/dashboard",
  "super-admin-dashboard": "super-admin/dashboard",
  "super-admin-admins": "super-admin/admins",
  "super-admin-books": "super-admin/books",
  "super-admin-borrowed-books": "super-admin/borrowed-books",
  "super-admin-books-trash": "super-admin/books-trash",
  "super-admin-users": "super-admin/users",
  "super-admin-users-trash": "super-admin/users-trash",
  "super-admin-admins-trash": "super-admin/admins-trash",
  "super-admin-trash-bin": "super-admin/users-trash",
  "super-admin-trash": "super-admin/trash",
  "super-admin-audit-logs": "super-admin/audit-logs",
  "super-admin-settings": "super-admin/settings",
  "super-admin-qr-scanner": "super-admin/qr-scanner",
};

Object.entries(superAdminPageRoutes).forEach(([route, view]) => {
  app.get(`/${route}`, (req, res) => {
    // Basic server-side guard: must be logged in as any admin.
    // Fine-grained role enforcement happens at the API endpoint level.
    const user = req.session && req.session.user;
    if (!user || user.userRole !== 'admin') {
      return res.redirect('/login');
    }
    res.render(view, {
      adminId: user.id || '',
      adminEmail: user.email || '',
      adminRole: user.role || ''
    });
  });
});

// Student dashboard — rendered as EJS with new layout
app.get("/student-dashboard", (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || sessionUser.userRole !== 'student') {
    return res.redirect('/login');
  }

  res.render("student/dashboard", {
    studentId: sessionUser.studentId || sessionUser.id || '',
    userRole: 'student',
  });
});
app.get("/student", (req, res) => res.redirect("/student-dashboard"));

// Student content pages — rendered as EJS with sidebar layout
app.get("/student-books", (req, res) => res.redirect("/student-available"));
app.get("/student-borrowed", (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || sessionUser.userRole !== 'student') {
    return res.redirect('/login');
  }
  res.render("student/borrowed-books", {
    studentId: sessionUser.studentId || sessionUser.id || '',
    userRole: 'student',
  });
});
app.get("/student-available", (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || sessionUser.userRole !== 'student') {
    return res.redirect('/login');
  }
  res.render("student/available-books", {
    studentId: sessionUser.studentId || sessionUser.id || '',
    userRole: 'student',
  });
});

// Legacy static student dashboard URLs (kept for backward compatibility)
app.get("/dashboard/student/student-dashboard.html", (req, res) => res.redirect("/student-dashboard"));
app.get("/dashboard/student/student-books.html", (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/student-available${query}`);
});
app.get("/dashboard/student/student-borrowed.html", (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/student-borrowed${query}`);
});

// Handle Chrome DevTools / browser well-known probes cleanly
// Return 200 JSON for the DevTools config probe so Chrome doesn't log a 404 error.
// Return 204 (no content, silent) for any other /.well-known/* probe.
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.json([]);
});
app.get("/.well-known/*", (req, res) => {
  res.status(204).end();
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API endpoint not found",
    });
  }

  // Route not found - redirect to landing page
  res.status(404).render('404', { pageContent: null });
});

const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  
  // Run pending database migrations (runs in production only)
  await runPendingMigrations();
  
  // Start notification scheduler
  startNotificationScheduler();
  console.log('Notification scheduler started');
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error('');
    console.error(`Port ${PORT} is already in use.`);
    console.error('Stop the existing server process on this port, then start again.');
    console.error('Tip (PowerShell): Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess');
    process.exit(1);
    return;
  }

  console.error('Server startup failed:', error);
  process.exit(1);
});
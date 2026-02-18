const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const csrf = require("csurf");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const passport = require("./src/config/passport");
const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const studentRoutes = require("./src/routes/students");
const bookBorrowingRoutes = require("./src/routes/book-borrowings");
const bookReturnRoutes = require("./src/routes/book-return");
const booksRoutes = require("./src/routes/books");
const bookCopiesRoutes = require("./src/routes/book-copies");
const notificationRoutes = require("./src/routes/notifications");
const { startNotificationScheduler } = require("./src/utils/notificationScheduler");
require("dotenv").config();

//  Validate critical environment variables on startup
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(' Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

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

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// 1. Helmet - Secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],  // Allow inline event handlers (onclick, onsubmit, etc.)
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"]
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
  max: process.env.NODE_ENV === "production" ? 500 : 5000, // Increased limits
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static files and SSE streams
    if (req.url.includes('/stream') || req.url.includes('/notifications/')) {
      return true; // Don't rate limit notification endpoints
    }
    if (process.env.NODE_ENV !== "production") {
      return req.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
    }
    return false;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 10 : 100, // More attempts in dev
  message: 'Too many login attempts, please try again after 15 minutes.',
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 300 : 1000, // Much higher limits
  message: 'API rate limit exceeded, please slow down.',
  skip: (req) => {
    // Skip rate limiting for notification endpoints and SSE
    return req.url.includes('/notifications/') || req.url.includes('/stream');
  }
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Apply stricter rate limiting to auth routes
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
    secret: process.env.SESSION_SECRET || "spist-library-secret-key-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset maxAge on every request
    cookie: {
      maxAge: 1800000, // 30 minutes
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

// CSRF Protection middleware - apply only to specific routes
const csrfProtection = csrf({ cookie: false }); // Use session-based tokens

// Middleware to make CSRF token available to all routes
app.use((req, res, next) => {
  // Only set csrfToken if middleware has been applied
  try {
    res.locals.csrfToken = req.csrfToken();
  } catch (err) {
    res.locals.csrfToken = null;
  }
  next();
});

// Debug endpoint to check session
app.get("/api/debug/session", (req, res) => {
  res.json({
    hasSession: !!req.session,
    sessionData: req.session,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false
  });
});

// Mount routes - CSRF disabled for auth routes (protected by rate limiting + bcrypt)
app.use("/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/book-borrowings", bookBorrowingRoutes);
app.use("/api/book-borrowings", bookReturnRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/book-copies", bookCopiesRoutes);
app.use("/api/notifications", notificationRoutes);

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
  
  // Start notification scheduler
  startNotificationScheduler();
  console.log('Notification scheduler started');
});
